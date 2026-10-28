import fs from 'node:fs';
import path from 'node:path';
import { createDatabase } from '../src/server/database/client';
import { inspectMigrations, migrateDatabase } from '../src/server/database/migrations';

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => args[args.indexOf(name) + 1];
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) throw new Error('DATABASE_CONFIG_MISSING');
  const endpoint = new URL(url);
  const expectedHost = args.includes('--expected-host') ? option('--expected-host') : undefined;
  if (!expectedHost || endpoint.hostname !== expectedHost || !['libsql:', 'https:'].includes(endpoint.protocol) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('DATABASE_TARGET_NOT_CONFIRMED');
  if (args.includes('--apply')) {
    const backup = args.includes('--backup') ? option('--backup') : undefined;
    if (!backup || !fs.existsSync(backup)) throw new Error('VERIFIED_BACKUP_REQUIRED');
    const header = Buffer.alloc(16);
    const handle = fs.openSync(backup, 'r');
    try { fs.readSync(handle, header, 0, header.length, 0); } finally { fs.closeSync(handle); }
    if (header.toString() !== 'SQLite format 3\u0000') throw new Error('INVALID_BACKUP_FILE');
  }
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), 60000);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => originalFetch(input, { ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal });
  const connection = createDatabase(url, token);
  try {
    const folder = path.resolve('drizzle');
    const result = args.includes('--apply') ? await migrateDatabase(connection, { migrationsFolder: folder })
      : await inspectMigrations(connection, folder);
    console.log(JSON.stringify({ mode: args.includes('--apply') ? 'apply' : 'read-only', ...result }));
  } finally { connection.client.close(); clearTimeout(timer); globalThis.fetch = originalFetch; }
}

main().catch((error: unknown) => {
  const failure = error as { message?: string; code?: string };
  const code = /^[A-Z_]+(?::[a-z0-9_.]+)?$/.test(failure.message || '') ? failure.message : failure.code || 'DATABASE_MIGRATION_FAILED';
  console.error(JSON.stringify({ status: 'failed', code }));
  process.exitCode = 1;
});
