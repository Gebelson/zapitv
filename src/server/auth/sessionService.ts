/**
 * ZAPITV — GERENCIAMENTO DE SESSÕES SEGURAS (P3.A)
 * 
 * Implementa controle de sessão persistente via tokens criptográficos aleatórios (256-bit).
 * O banco de dados armazena apenas o HASH SHA-256 do token (blindagem contra vazamentos de dump).
 * A persistência no navegador utiliza cookies HttpOnly, Secure e SameSite=Lax.
 */

import crypto from 'crypto';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { Database } from '../database/client';
import { sessions, users } from '../database/schema';

export const SESSION_COOKIE_NAME = 'zapitv_session';
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export interface UserSessionData {
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
    createdAt: number;
  };
  sessionId: string;
  expiresAt: number;
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(
  db: Database,
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string; durationMs?: number }
): Promise<{ token: string; expiresAt: number; sessionId: string }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = Date.now();
  const expiresAt = now + (meta?.durationMs || SESSION_DURATION_MS);
  const sessionId = crypto.randomUUID();

  await db.db.insert(sessions).values({
    id: sessionId,
    userId,
    tokenHash,
    ipAddress: meta?.ipAddress?.slice(0, 45) || null,
    userAgent: meta?.userAgent?.slice(0, 255) || null,
    expiresAt,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return { token, expiresAt, sessionId };
}

export async function validateSession(
  db: Database,
  token: string
): Promise<UserSessionData | null> {
  if (!token || typeof token !== 'string' || token.length < 32) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const now = Date.now();

  const found = await db.db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userStatus: users.status,
      userCreatedAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.status, 'active')
      )
    )
    .limit(1);

  if (!found || found.length === 0) {
    return null;
  }

  const row = found[0];
  return {
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      status: row.userStatus,
      createdAt: row.userCreatedAt,
    },
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
  };
}

export async function revokeSession(
  db: Database,
  token: string
): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashSessionToken(token);
  const now = Date.now();

  const res = await db.db
    .update(sessions)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));

  return true;
}

export async function revokeAllUserSessions(
  db: Database,
  userId: string
): Promise<boolean> {
  const now = Date.now();
  await db.db
    .update(sessions)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  return true;
}

/**
 * Utilitário para parse de cookies seguro sem dependências pesadas
 */
export function extractCookie(cookieHeader?: string, cookieName: string = SESSION_COOKIE_NAME): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const [name, ...val] = c.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(val.join('='));
    }
  }
  return null;
}

/**
 * Monta cabeçalho Set-Cookie com atributos de segurança padrão
 */
export function formatSetCookie(
  token: string,
  options: { expiresAt?: number; maxAgeSeconds?: number; isProduction?: boolean; clear?: boolean }
): string {
  if (options.clear) {
    return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${options.isProduction ? '; Secure' : ''}`;
  }

  const maxAge = options.maxAgeSeconds ?? Math.floor(SESSION_DURATION_MS / 1000);
  const expires = options.expiresAt ? new Date(options.expiresAt).toUTCString() : undefined;
  
  let cookieStr = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  if (expires) cookieStr += `; Expires=${expires}`;
  if (options.isProduction) cookieStr += '; Secure';
  return cookieStr;
}
