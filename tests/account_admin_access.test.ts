import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { getDatabase } from '../src/server/database/client';
import { migrateDatabase } from '../src/server/database/migrations';
import { users } from '../src/server/database/schema';
import { createSession, revokeSession } from '../src/server/auth/sessionService';
import { hashPassword } from '../src/server/auth/passwordService';
import { authRouter } from '../src/server/auth/routes';
import { databaseRouter } from '../src/server/database/routes';
import { accountRole } from '../src/server/auth/adminAccess';

test('account administration requires an explicit immutable ID, never an email or client role', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.ADMIN_USER_IDS = 'account-admin';
  process.env.ADMIN_EMAILS = 'viewer@example.invalid';
  assert.equal(accountRole('account-admin'), 'admin');
  assert.equal(accountRole('viewer'), 'user');
  assert.equal(accountRole(''), 'user');
  const db = getDatabase()!;
  await migrateDatabase(db, { migrationsFolder: 'drizzle' });
  const password = 'Fixture123!';
  for (const id of ['account-admin', 'viewer']) await db.db.insert(users).values({ id, name: id,
    email: `${id}@example.invalid`, passwordHash: await hashPassword(password), termsAcceptedAt: 1, createdAt: 1, updatedAt: 1 });
  const admin = await createSession(db, 'account-admin');
  const viewer = await createSession(db, 'viewer');
  const app = express(); app.use(express.json()); app.use('/api/auth', authRouter); app.use('/api/db', databaseRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  const cookie = (token: string) => `zapitv_session=${token}`;
  try {
    const me = await fetch(`${origin}/api/auth/me`, { headers: { cookie: cookie(admin.token) } });
    assert.equal((await me.json()).user.role, 'admin');
    const regular = await fetch(`${origin}/api/auth/me`, { headers: { cookie: cookie(viewer.token), 'x-user-role': 'admin' } });
    assert.equal((await regular.json()).user.role, 'user');
    const login = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ email: 'account-admin@example.invalid', password }) });
    assert.equal((await login.json()).user.role, 'admin');
    const write = (token: string, source = origin) => fetch(`${origin}/api/db/global-settings/section-titles`, {
      method: 'PUT', headers: { cookie: cookie(token), origin: source, 'content-type': 'application/json' }, body: '{}' });
    assert.equal((await write(admin.token)).status, 400, 'authorized admin reaches body validation without changing data');
    assert.equal((await write(viewer.token)).status, 403);
    assert.equal((await write(admin.token, 'https://untrusted.example.invalid')).status, 403);
    assert.equal((await write('invalid-session')).status, 403);
    await revokeSession(db, admin.token);
    assert.equal((await write(admin.token)).status, 403, 'revoked sessions immediately lose admin access');
    delete process.env.ADMIN_USER_IDS;
    assert.equal(accountRole('account-admin'), 'user', 'removing the allowlist removes the grant');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.client.close();
  }
});
