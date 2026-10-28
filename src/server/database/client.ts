import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(url: string, authToken?: string) {
  // Garante que o diretório data/ exista caso seja um banco sqlite em arquivo
  if (url.startsWith('file:') && !url.includes(':memory:')) {
    const filePath = url.replace(/^file:/, '');
    const dir = path.dirname(filePath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
  }

  const client = createClient({ url, authToken });
  return { client, db: drizzle(client, { schema }) };
}

let sharedDatabase: Database | undefined;

export function getDatabase(): Database | null {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!url || (!token && !url.startsWith('file:'))) {
    // Se não há Turso remoto configurado, usa SQLite persistente em data/zapitv_auth.db no ambiente local/dev/test
    const isProd = process.env.NODE_ENV === 'production';
    if (process.env.ALLOW_LOCAL_DB === 'true' || !isProd || Boolean(process.env.VITEST)) {
      const localUrl = process.env.LOCAL_DB_URL || 'file:data/zapitv_auth.db';
      sharedDatabase ??= createDatabase(localUrl);
      return sharedDatabase;
    }
    return null;
  }

  sharedDatabase ??= createDatabase(url, token);
  return sharedDatabase;
}

export async function ensureAuthTables(database: Database): Promise<void> {
  await database.client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      terms_accepted_at integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
    CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at);

    CREATE TABLE IF NOT EXISTS sessions (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      token_hash text NOT NULL,
      ip_address text,
      user_agent text,
      expires_at integer NOT NULL,
      revoked_at integer,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

    CREATE TABLE IF NOT EXISTS login_attempts (
      id text PRIMARY KEY NOT NULL,
      identifier text NOT NULL,
      attempt_at integer NOT NULL,
      success integer DEFAULT 0 NOT NULL,
      ip_address text
    );
    CREATE INDEX IF NOT EXISTS login_attempts_identifier_time_idx ON login_attempts (identifier, attempt_at);

    CREATE TABLE IF NOT EXISTS profiles (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      name text NOT NULL,
      avatar_id text NOT NULL,
      is_default integer DEFAULT 0 NOT NULL,
      display_order integer DEFAULT 0 NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles (user_id);
    CREATE INDEX IF NOT EXISTS profiles_user_id_order_idx ON profiles (user_id, display_order);

    CREATE TABLE IF NOT EXISTS device_link_challenges (
      id text PRIMARY KEY NOT NULL,
      device_code_hash text NOT NULL,
      user_code text NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      user_id text,
      device_name text DEFAULT 'Smart TV' NOT NULL,
      device_type text DEFAULT 'smart_tv' NOT NULL,
      client_ip text,
      user_agent text,
      poll_count integer DEFAULT 0 NOT NULL,
      last_polled_at integer,
      expires_at integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      approved_at integer,
      consumed_at integer,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    );
    CREATE UNIQUE INDEX IF NOT EXISTS device_link_challenges_device_code_hash_idx ON device_link_challenges (device_code_hash);
    CREATE UNIQUE INDEX IF NOT EXISTS device_link_challenges_user_code_idx ON device_link_challenges (user_code);
    CREATE INDEX IF NOT EXISTS device_link_challenges_status_expires_idx ON device_link_challenges (status, expires_at);

    CREATE TABLE IF NOT EXISTS linked_devices (
      id text PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      session_id text NOT NULL,
      device_name text NOT NULL,
      device_type text NOT NULL,
      client_ip text,
      user_agent text,
      last_active_at integer NOT NULL,
      created_at integer NOT NULL,
      revoked_at integer,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX IF NOT EXISTS linked_devices_user_id_idx ON linked_devices (user_id);
    CREATE INDEX IF NOT EXISTS linked_devices_session_id_idx ON linked_devices (session_id);
  `);
}

export function resetSharedDatabaseForTesting(): void {
  sharedDatabase = undefined;
}

