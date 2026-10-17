import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return { client, db: drizzle(client, { schema }) };
}

let sharedDatabase: Database | undefined;

export function getDatabase(): Database | null {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || (!token && !url.startsWith('file:'))) return null;
  sharedDatabase ??= createDatabase(url, token);
  return sharedDatabase;
}
