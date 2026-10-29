import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { createDatabase } from '../src/server/database/client';
import { migrateDatabase } from '../src/server/database/migrations';
import { users, sessions } from '../src/server/database/schema';
import { hashPassword, verifyPassword } from '../src/server/auth/passwordService';
import { requestRecovery, completeRecovery } from '../src/server/auth/passwordRecovery';
import { recoveryConfiguration, sendRecoveryEmail } from '../src/server/auth/recoveryEmail';

async function fixture(run: (db: ReturnType<typeof createDatabase>, delivered: string[]) => Promise<void>) {
  const previous = { APP_URL: process.env.APP_URL, BREVO_API_KEY: process.env.BREVO_API_KEY, BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL };
  process.env.APP_URL = 'https://staging.example.invalid';
  process.env.BREVO_API_KEY = 'test-only-key';
  process.env.BREVO_SENDER_EMAIL = 'sender@example.invalid';
  const db = createDatabase('file::memory:');
  try {
    await migrateDatabase(db, { migrationsFolder: 'drizzle' });
    for (const id of ['recovery-user', 'unrelated-user']) {
      await db.db.insert(users).values({ id, name: 'Fixture', email: `${id}@example.invalid`, passwordHash: await hashPassword('Original123!'), termsAcceptedAt: 1, createdAt: 1, updatedAt: 1 });
      await db.db.insert(sessions).values({ id: `session-${id}`, userId: id, tokenHash: `hash-${id}`, expiresAt: Date.now() + 60000, createdAt: 1, updatedAt: 1 });
    }
    await run(db, []);
  } finally {
    db.client.close();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}

const tokenFrom = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get('token')!;

test('generic responses, hashed token at rest, fixed HTTPS origin and no account creation', () => fixture(async (db, delivered) => {
  const deliver = async (_email: string, link: string) => { delivered.push(link); };
  const known = await requestRecovery(db, 'recovery-user@example.invalid', 'test-ip', deliver);
  const unknown = await requestRecovery(db, 'missing@example.invalid', 'test-ip', deliver);
  assert.deepEqual(known, unknown);
  assert.equal(delivered.length, 1);
  assert.equal(new URL(delivered[0]).origin, process.env.APP_URL);
  assert.equal(new URL(delivered[0]).search, '');
  const rows = (await db.client.execute('SELECT token_hash,expires_at FROM password_reset_tokens')).rows;
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].token_hash, tokenFrom(delivered[0]));
  assert.ok(Number(rows[0].expires_at) <= Date.now() + 15 * 60000);
  assert.equal((await db.client.execute('SELECT count(*) n FROM users')).rows[0].n, 2);
}));

test('reset changes Argon2id password, revokes only the owner sessions and consumes links once', () => fixture(async (db, delivered) => {
  await requestRecovery(db, 'recovery-user@example.invalid', 'test-ip', async (_, url) => { delivered.push(url); });
  const token = tokenFrom(delivered[0]);
  await assert.rejects(() => completeRecovery(db, token, 'short', 'short'));
  await completeRecovery(db, token, 'Changed123!', 'Changed123!');
  const user = (await db.db.select().from(users).where(eq(users.id, 'recovery-user')))[0];
  assert.ok(await verifyPassword(user.passwordHash, 'Changed123!'));
  assert.equal(await verifyPassword(user.passwordHash, 'Original123!'), false);
  assert.ok((await db.db.select().from(sessions).where(eq(sessions.userId, 'recovery-user')))[0].revokedAt);
  assert.equal((await db.db.select().from(sessions).where(eq(sessions.userId, 'unrelated-user')))[0].revokedAt, null);
  await assert.rejects(() => completeRecovery(db, token, 'Another123!', 'Another123!'), /RESET_TOKEN_INVALID/);
}));

test('expired links and concurrent replay never change a password twice', () => fixture(async (db, delivered) => {
  const deliver = async (_: string, url: string) => { delivered.push(url); };
  await requestRecovery(db, 'recovery-user@example.invalid', 'test-ip', deliver);
  await db.client.execute('UPDATE password_reset_tokens SET expires_at=1');
  await assert.rejects(() => completeRecovery(db, tokenFrom(delivered[0]), 'Changed123!', 'Changed123!'), /RESET_TOKEN_INVALID/);
  await requestRecovery(db, 'recovery-user@example.invalid', 'test-ip', deliver);
  const outcomes = await Promise.allSettled([completeRecovery(db, tokenFrom(delivered[1]), 'Changed123!', 'Changed123!'), completeRecovery(db, tokenFrom(delivered[1]), 'Changed456!', 'Changed456!')]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
}));

test('limits cap repeated email delivery and provider failures never expose or leave a usable token', () => fixture(async (db, delivered) => {
  const deliver = async (_: string, url: string) => { delivered.push(url); };
  for (let i = 0; i < 6; i++) await requestRecovery(db, 'recovery-user@example.invalid', 'test-ip', deliver);
  assert.equal(delivered.length, 3);
  const before = (await db.client.execute('SELECT count(*) n FROM password_reset_tokens')).rows[0].n;
  await requestRecovery(db, 'unrelated-user@example.invalid', 'other-ip', async () => { throw new Error('provider failure'); });
  assert.equal((await db.client.execute('SELECT count(*) n FROM password_reset_tokens')).rows[0].n, before);
  delete process.env.BREVO_API_KEY;
  await assert.rejects(() => requestRecovery(db, 'missing@example.invalid', 'test-ip', deliver), /RECOVERY_NOT_CONFIGURED/);
}));

test('email transport sends only to Brevo with a timeout and sanitizes rejected responses', () => fixture(async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(options?.redirect, 'error');
    assert.ok(options?.signal instanceof AbortSignal);
    const body = JSON.parse(String(options?.body));
    assert.equal(body.sender.email, 'sender@example.invalid');
    assert.deepEqual(body.to, [{ email: 'recipient@example.invalid' }]);
    assert.equal(body.htmlContent, undefined);
    assert.match(body.textContent, /https:\/\/staging.example.invalid\/redefinir-senha#token=/);
    return new Response('private provider error', { status: 401 });
  };
  try {
    await assert.rejects(() => sendRecoveryEmail('recipient@example.invalid', 'https://staging.example.invalid/redefinir-senha#token=test'),
      /^Error: RECOVERY_EMAIL_DELIVERY_FAILED$/);
    assert.equal(requests, 1);
    for (const origin of ['http://localhost', 'https://user:pass@example.invalid', 'https://example.invalid/path', 'https://example.invalid/?redirect=other']) {
      process.env.APP_URL = origin;
      assert.throws(recoveryConfiguration, /RECOVERY_NOT_CONFIGURED/);
    }
  } finally { globalThis.fetch = originalFetch; }
}));
