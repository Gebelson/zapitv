import crypto from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../database/client';
import { loginAttempts, passwordResetTokens, sessions, users } from '../database/schema';
import { hashPassword } from './passwordService';
import { recoveryConfiguration, sendRecoveryEmail } from './recoveryEmail';

const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const response = () => ({ message: 'Se existir uma conta com esse e-mail, você receberá as instruções de recuperação.' });
const fifteenMinutes = 15 * 60000;

export async function requestRecovery(db: Database, email: string, ip: string,
  deliver: (email: string, link: string) => Promise<void> = sendRecoveryEmail) {
  const { origin } = recoveryConfiguration();
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 255) throw new Error('INVALID_RECOVERY_EMAIL');
  const now = Date.now();
  const token = crypto.randomBytes(32).toString('hex');
  const id = crypto.randomUUID();
  const target = await db.db.transaction(async tx => {
    const emailKey = `recovery:email:${digest(cleanEmail)}`;
    const ipKey = `recovery:ip:${digest(ip)}`;
    const count = async (identifier: string, since: number) => Number((await tx.select({ n: sql<number>`count(*)` }).from(loginAttempts)
      .where(and(eq(loginAttempts.identifier, identifier), gt(loginAttempts.attemptAt, since))))[0].n);
    if (await count(emailKey, now - fifteenMinutes) >= 3 || await count(ipKey, now - fifteenMinutes) >= 30 ||
        await count('recovery:delivery', now - 86400000) >= 250) return null;
    for (const identifier of [emailKey, ipKey]) {
      await tx.insert(loginAttempts).values({ id: crypto.randomUUID(), identifier, attemptAt: now, success: 0 });
    }
    const user = (await tx.select({ id: users.id, email: users.email }).from(users)
      .where(and(eq(users.email, cleanEmail), eq(users.status, 'active'))).limit(1))[0];
    if (!user) return null;
    await tx.insert(loginAttempts).values({ id: crypto.randomUUID(), identifier: 'recovery:delivery', attemptAt: now, success: 0 });
    await tx.insert(passwordResetTokens).values({ id, userId: user.id, tokenHash: digest(token), createdAt: now, expiresAt: now + fifteenMinutes });
    return user;
  });
  if (!target) return response();
  try { await deliver(target.email, `${origin}/redefinir-senha#token=${token}`); }
  catch {
    await db.db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, id));
    // Preserve a generic response for account privacy. Never log recipient, token or provider body.
    console.error(JSON.stringify({ event: 'password_recovery_delivery_failed', code: 'EMAIL_PROVIDER_FAILED' }));
  }
  return response();
}

export async function completeRecovery(db: Database, token: string, password: string, confirmation: string) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new Error('RESET_TOKEN_INVALID');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 ||
      !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) || password !== confirmation) throw new Error('RESET_PASSWORD_INVALID');
  const passwordHash = await hashPassword(password);
  const now = Date.now();
  await db.db.transaction(async tx => {
    const claim = await tx.update(passwordResetTokens).set({ usedAt: now })
      .where(and(eq(passwordResetTokens.tokenHash, digest(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
      .returning({ userId: passwordResetTokens.userId });
    if (claim.length !== 1) throw new Error('RESET_TOKEN_INVALID');
    const userId = claim[0].userId;
    const changed = await tx.update(users).set({ passwordHash, updatedAt: now }).where(and(eq(users.id, userId), eq(users.status, 'active'))).returning({ id: users.id });
    if (!changed.length) throw new Error('RESET_TOKEN_INVALID');
    await tx.update(sessions).set({ revokedAt: now, updatedAt: now }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
  });
  return { success: true, message: 'Senha atualizada. Entre novamente na sua conta.' };
}
