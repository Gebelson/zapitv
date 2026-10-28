import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrateDatabase as migrateCompatible } from '../src/server/database/migrations';
import { createDatabase } from '../src/server/database/client';

const folder = path.resolve('drizzle');
const migrateDatabase = (connection: ReturnType<typeof createDatabase>) => migrateCompatible(connection, { migrationsFolder: folder });

async function fixture(run: (connection: ReturnType<typeof createDatabase>) => Promise<void>) {
  const connection = createDatabase('file::memory:');
  try { await run(connection); }
  finally {
    connection.client.close();
  }
}

async function legacy(connection: ReturnType<typeof createDatabase>, incompatible = false) {
  await connection.client.execute('CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)');
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  for (const migration of migrations.slice(0, 2)) {
    for (const statement of migration.sql) await connection.client.execute(statement);
    await connection.client.execute({ sql: 'INSERT INTO __drizzle_migrations(hash, created_at) VALUES (?,?)', args: [migration.hash, migration.folderMillis] });
  }
  for (const statement of migrations[2].sql.filter(sql => /CREATE TABLE `watchparty_/.test(sql))) {
    const runtimeDDL = statement.replace(/(room_id|id)` text PRIMARY KEY NOT NULL/, '$1` text PRIMARY KEY');
    await connection.client.execute(incompatible && statement.includes('watchparty_rooms') ? runtimeDDL.replace('`host_peer_id` text', '`host_peer_id` integer') : runtimeDDL);
  }
  await connection.client.execute("INSERT INTO watchparty_rooms(room_id,host_peer_id,host_nickname,created_at,updated_at) VALUES ('fixture-room','host','Fixture',1,1)");
  await connection.client.execute("INSERT INTO watchparty_signals(id,room_id,sender_peer_id,type,timestamp) VALUES ('fixture-signal','fixture-room','host','fixture',1)");
}

test('fresh database applies the existing seven migrations and stays idempotent', () => fixture(async connection => {
  await migrateDatabase(connection);
  await migrateDatabase(connection);
  assert.equal((await connection.client.execute('SELECT count(*) n FROM __drizzle_migrations')).rows[0].n, 7);
  assert.equal((await connection.client.execute('PRAGMA foreign_key_check')).rows.length, 0);
}));

test('legacy Watch Party tables survive account migrations without losing rows', () => fixture(async connection => {
  await legacy(connection);
  await migrateDatabase(connection);
  await migrateDatabase(connection);
  assert.equal((await connection.client.execute('SELECT count(*) n FROM __drizzle_migrations')).rows[0].n, 7);
  assert.equal((await connection.client.execute('SELECT room_id FROM watchparty_rooms')).rows[0].room_id, 'fixture-room');
  assert.equal((await connection.client.execute('SELECT id FROM watchparty_signals')).rows[0].id, 'fixture-signal');
  assert.equal((await connection.client.execute('SELECT count(*) n FROM users')).rows[0].n, 0);
}));

test('incompatible legacy schema is rejected before creating account tables', () => fixture(async connection => {
  await legacy(connection, true);
  await assert.rejects(() => migrateDatabase(connection));
  assert.equal((await connection.client.execute("SELECT count(*) n FROM sqlite_schema WHERE name='users'")).rows[0].n, 0);
  assert.equal((await connection.client.execute('SELECT count(*) n FROM __drizzle_migrations')).rows[0].n, 2);
}));

test('unknown ledger hashes are rejected without changing the database', () => fixture(async connection => {
  await legacy(connection);
  await connection.client.execute("UPDATE __drizzle_migrations SET hash='unknown' WHERE created_at=(SELECT max(created_at) FROM __drizzle_migrations)");
  await assert.rejects(() => migrateDatabase(connection), /MIGRATION_LEDGER_MISMATCH/);
  assert.equal((await connection.client.execute("SELECT count(*) n FROM sqlite_schema WHERE name='users'")).rows[0].n, 0);
}));

test('legacy null primary keys and incompatible indexes are not adopted', () => fixture(async connection => {
  await legacy(connection);
  await connection.client.execute("INSERT INTO watchparty_signals(id,room_id,sender_peer_id,type,timestamp) VALUES (NULL,'fixture-room','host','fixture',2)");
  await assert.rejects(() => migrateDatabase(connection), /LEGACY_NULL_PRIMARY_KEY/);
  await connection.client.execute('DELETE FROM watchparty_signals WHERE id IS NULL');
  await connection.client.execute('CREATE INDEX watchparty_signals_room_time_idx ON watchparty_signals(timestamp)');
  await assert.rejects(() => migrateDatabase(connection), /LEGACY_INDEX_MISMATCH/);
  assert.equal((await connection.client.execute('SELECT count(*) n FROM __drizzle_migrations')).rows[0].n, 2);
}));
