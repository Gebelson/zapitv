import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sql, type SQL } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import type { Database } from './client';

const legacyTables = new Set(['watchparty_rooms', 'watchparty_signals']);
const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const defaultValue = (value: unknown) => value == null ? null : String(value).replace(/^\((.*)\)$/, '$1');

export async function inspectMigrations(connection: Database, migrationsFolder: string) {
  const migrations = readMigrationFiles({ migrationsFolder });
  const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(path.join(migrationsFolder, `meta/${String(migrations.length - 1).padStart(4, '0')}_snapshot.json`), 'utf8'));
  const names = new Set((await connection.client.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
    .rows.map(row => String(row.name)));
  const ledger = names.has('__drizzle_migrations')
    ? (await connection.client.execute('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')).rows : [];
  if (ledger.length > migrations.length || (!ledger.length && names.size > 0)) throw new Error('MIGRATION_LEDGER_INVALID');
  ledger.forEach((row, index) => {
    const source = fs.readFileSync(path.join(migrationsFolder, `${journal.entries[index].tag}.sql`), 'utf8').replace(/\r\n/g, '\n');
    // Existing Linux and Windows runs differ only by line endings; never rewrite their ledger.
    if (Number(row.created_at) !== migrations[index].folderMillis ||
        ![hash(source), hash(source.replace(/\n/g, '\r\n'))].includes(String(row.hash))) {
      throw new Error('MIGRATION_LEDGER_MISMATCH');
    }
  });

  const adopted = new Set<string>();
  const skippedIndexes = new Set<string>();
  const legacyNullablePrimaryKeys: string[] = [];
  for (const migration of migrations.slice(ledger.length)) {
    for (const statement of migration.sql) {
      const match = statement.match(/^\s*CREATE TABLE [`"]?(\w+)[`"]?/i);
      if (!match || !names.has(match[1])) continue;
      const name = match[1];
      if (!legacyTables.has(name)) throw new Error(`MIGRATION_PREEXISTING_TABLE:${name}`);
      const expected = snapshot.tables[name];
      const columns = (await connection.client.execute(`PRAGMA table_info(${quoted(name)})`)).rows;
      if (columns.length !== Object.keys(expected.columns).length) throw new Error(`LEGACY_SCHEMA_MISMATCH:${name}`);
      for (const column of columns) {
        const wanted = expected.columns[String(column.name)];
        const historicalPrimaryKey = Boolean(wanted?.primaryKey) && Number(column.pk) === 1 && Number(column.notnull) === 0;
        if (!wanted || String(column.type).toLowerCase() !== wanted.type || Boolean(column.pk) !== wanted.primaryKey ||
            (!historicalPrimaryKey && Boolean(column.notnull) !== wanted.notNull) ||
            defaultValue(column.dflt_value) !== defaultValue(wanted.default)) throw new Error(`LEGACY_SCHEMA_MISMATCH:${name}`);
        if (historicalPrimaryKey) {
          const invalid = await connection.client.execute(`SELECT 1 FROM ${quoted(name)} WHERE ${quoted(String(column.name))} IS NULL LIMIT 1`);
          if (invalid.rows.length) throw new Error(`LEGACY_NULL_PRIMARY_KEY:${name}`);
          legacyNullablePrimaryKeys.push(`${name}.${column.name}`);
        }
      }
      if ((await connection.client.execute(`PRAGMA foreign_key_list(${quoted(name)})`)).rows.length) throw new Error(`LEGACY_SCHEMA_MISMATCH:${name}`);
      for (const index of Object.values(expected.indexes) as Array<{ name: string; columns: string[]; isUnique: boolean }>) {
        const existing = (await connection.client.execute(`PRAGMA index_list(${quoted(name)})`)).rows.find(row => row.name === index.name);
        if (!existing) continue;
        const actualColumns = (await connection.client.execute(`PRAGMA index_info(${quoted(index.name)})`)).rows.map(row => row.name);
        if (Boolean(existing.unique) !== index.isUnique || JSON.stringify(actualColumns) !== JSON.stringify(index.columns) || Number(existing.partial)) {
          throw new Error(`LEGACY_INDEX_MISMATCH:${index.name}`);
        }
        skippedIndexes.add(index.name);
      }
      adopted.add(name);
    }
  }
  return { migrationsApplied: ledger.length, migrationsPending: migrations.length - ledger.length,
    adoptedLegacyTables: [...adopted], skippedLegacyIndexes: [...skippedIndexes], legacyNullablePrimaryKeys };
}

export async function migrateDatabase(connection: Database, options: { migrationsFolder: string }) {
  const plan = await inspectMigrations(connection, options.migrationsFolder);
  if (!plan.migrationsPending) return { ...plan, appliedNow: 0 };
  const dialect = new SQLiteSyncDialect();
  // Keep Drizzle's original SQL, migration hashes, ledger and atomic batch. Only adopt
  // the two verified tables historically created by the Watch Party runtime.
  const migrationDatabase = new Proxy(connection.db, {
    get(target, property, receiver) {
      if (property !== 'run') return Reflect.get(target, property, receiver);
      return (query: SQL) => {
        const text = dialect.sqlToQuery(query).sql;
        const table = text.match(/^\s*CREATE TABLE [`"]?(\w+)[`"]?/i)?.[1];
        const index = text.match(/^\s*CREATE (?:UNIQUE )?INDEX [`"]?(\w+)[`"]?/i)?.[1];
        return target.run(table && plan.adoptedLegacyTables.includes(table) || index && plan.skippedLegacyIndexes.includes(index)
          ? sql.raw('SELECT 1') : query);
      };
    },
  });
  await migrate(migrationDatabase, options);
  return { ...plan, appliedNow: plan.migrationsPending };
}
