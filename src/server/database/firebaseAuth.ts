import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

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

export async function authenticateAdmin(authorization: string | undefined): Promise<string | null> {
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
