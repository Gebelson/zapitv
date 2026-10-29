import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Request } from 'express';
import { getDatabase } from './client';
import { extractCookie, validateSession, SESSION_COOKIE_NAME } from '../auth/sessionService';
import { accountRole } from '../auth/adminAccess';

const publicKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
  { timeoutDuration: 5000 },
);

export class InvalidFirebaseToken extends Error {}

export async function verifyFirebaseIdToken(token: string, projectId: string, keys: JWTVerifyGetKey = publicKeys): Promise<string> {
  let verified;
  try {
    verified = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });
  } catch (error) {
    if (error instanceof errors.JWKSTimeout) throw error;
    if (error instanceof errors.JOSEError) throw new InvalidFirebaseToken('Token Firebase inválido.');
    throw error;
  }

  const { payload, protectedHeader } = verified;
  const now = Math.floor(Date.now() / 1000);
  if (!protectedHeader.kid || typeof payload.sub !== 'string' || !payload.sub ||
      !Number.isSafeInteger(payload.iat) || payload.iat > now ||
      !Number.isSafeInteger(payload.auth_time) || payload.auth_time > now) {
    throw new InvalidFirebaseToken('Token Firebase inválido.');
  }
  return payload.sub;
}

export async function authenticateAdmin(authorization: string | undefined, request?: Pick<Request, 'headers' | 'method'>): Promise<string | null> {
  const cookie = extractCookie(request?.headers.cookie, SESSION_COOKIE_NAME);
  const accountToken = cookie || /^Bearer (\S+)$/i.exec(authorization || '')?.[1];
  if (accountToken && process.env.ADMIN_USER_IDS) {
    const db = getDatabase();
    const session = db ? await validateSession(db, accountToken) : null;
    if (session && accountRole(session.user.id) === 'admin') {
      // Cookie-based writes require the same trusted origin as account mutations.
      if (cookie && request && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        try {
          const origin = request.headers.origin || request.headers.referer;
          if (!origin || new URL(origin).host !== request.headers.host) return null;
        } catch { return null; }
      }
      return session.user.id;
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const allowedUids = new Set((process.env.ADMIN_FIREBASE_UIDS || '').split(',').map(uid => uid.trim()).filter(Boolean));
  const match = /^Bearer (\S+)$/i.exec(authorization || '');
  if (!projectId || allowedUids.size === 0 || !match) return null;
  try {
    const uid = await verifyFirebaseIdToken(match[1], projectId);
    return allowedUids.has(uid) ? uid : null;
  } catch (error) {
    if (error instanceof InvalidFirebaseToken) return null;
    throw error;
  }
}
