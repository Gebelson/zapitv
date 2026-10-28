import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { readFileSync } from 'node:fs';

// Read-only staging inspection. Never imports getDatabase/ensureAuthTables or a migrator.
function endpoint(raw?: string): string {
  if (!raw) throw new Error('STAGING_CONFIG_MISSING');
  const url = new URL(raw);
  if (!['libsql:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('UNSAFE_DATABASE_ENDPOINT');
  }
  return url.hostname.toLowerCase();
}
async function run() {
  const staging = endpoint(process.env.TURSO_STAGING_DATABASE_URL);
  const production = endpoint(process.env.TURSO_PRODUCTION_DATABASE_URL);
  if (staging === production) throw new Error('STAGING_EQUALS_PRODUCTION');
  if (!process.env.TURSO_STAGING_AUTH_TOKEN) throw new Error('STAGING_TOKEN_MISSING');
  // Different hostnames are a guard, not proof of distinct database identities.
  // Require the operator's prior dashboard/production-binding isolation review.
  if (process.env.P4B2_ISOLATION_REVIEWED !== 'true') throw new Error('ISOLATION_REVIEW_REQUIRED');
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 20000);
  const client = createClient({ url: process.env.TURSO_STAGING_DATABASE_URL!, authToken: process.env.TURSO_STAGING_AUTH_TOKEN,
    fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }) });
  const started = performance.now();
  let tx: Awaited<ReturnType<typeof client.transaction>> | undefined;
  try {
    tx = await client.transaction('read');
    const tables = await tx.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const names = new Set(tables.rows.map(row => String(row.name)));
    const expected = JSON.parse(readFileSync('drizzle/meta/0006_snapshot.json', 'utf8')).tables;
    const missing: string[] = [];
    const entries = Object.entries(expected) as [string, any][];
    const present = entries.filter(([table]) => names.has(table));
    const columnSets = await tx.batch(present.map(([table]) => `PRAGMA table_info("${table}")`));
    const columnsByTable = new Map(present.map(([table], i) => [table, columnSets[i]]));
    for (const [table, schema] of entries) {
      if (!names.has(table)) { missing.push(table); continue; }
      const columns = columnsByTable.get(table)!;
      const actual = new Set(columns.rows.map(row => String(row.name)));
      for (const column of Object.keys(schema.columns)) if (!actual.has(column)) missing.push(`${table}.${column}`);
    }
    const applied = names.has('__drizzle_migrations')
      ? (await tx.execute('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')).rows : [];
    const migrations = readMigrationFiles({ migrationsFolder: './drizzle' });
    const journalMatches = applied.length <= migrations.length && applied.every((row, i) => row.hash === migrations[i].hash && Number(row.created_at) === migrations[i].folderMillis);
    await tx.rollback();
    console.log(JSON.stringify({ mode: 'remote-readonly', durationMs: Math.round(performance.now() - started),
      tableCount: names.size, migrationCount: applied.length, expectedMigrations: migrations.length,
      journalMatches, missingRequiredTablesOrColumns: missing,
      unversionedSchema: names.size > 0 && !names.has('__drizzle_migrations'),
      writesExecuted: 0, migrationExecuted: false, fullSchemaCompatibilityApproved: false }));
  } finally {
    tx?.close(); client.close(); clearTimeout(deadline);
  }
}
run().catch(error => { console.error(JSON.stringify({ status: 'blocked_or_failed', code: error.code ||
  (/^[A-Z_]+$/.test(error.message) ? error.message : 'PREFLIGHT_FAILED'), writesExecuted: 0 })); process.exitCode = 1; });
