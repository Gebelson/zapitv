import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { InvalidFirebaseToken, verifyFirebaseIdToken } from '../src/server/database/firebaseAuth';

describe('Firebase Auth Token Verification', () => {
  it('validates and rejects tokens correctly', async () => {
    const projectId = 'zapitv-auth-test';
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
    const keys = createLocalJWKSet({ keys: [jwk] });
    const now = Math.floor(Date.now() / 1000);

    function token(overrides: Record<string, unknown> = {}) {
      return new SignJWT({ auth_time: now, ...overrides })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(`https://securetoken.google.com/${projectId}`)
        .setAudience(projectId)
        .setSubject('admin-uid')
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(privateKey);
    }

    assert.equal(await verifyFirebaseIdToken(await token(), projectId, keys), 'admin-uid');
    await assert.rejects(verifyFirebaseIdToken(await token(), 'other-project', keys), InvalidFirebaseToken);
    await assert.rejects(verifyFirebaseIdToken(await token({ auth_time: now + 3600 }), projectId, keys), InvalidFirebaseToken);
    await assert.rejects(verifyFirebaseIdToken(await token({ auth_time: null }), projectId, keys), InvalidFirebaseToken);
    await assert.rejects(verifyFirebaseIdToken('invalid', projectId, keys), InvalidFirebaseToken);

    const { privateKey: otherPrivateKey } = await generateKeyPair('RS256');
    const forged = await new SignJWT({ auth_time: now })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(`https://securetoken.google.com/${projectId}`)
      .setAudience(projectId)
      .setSubject('admin-uid')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(otherPrivateKey);
    await assert.rejects(verifyFirebaseIdToken(forged, projectId, keys), InvalidFirebaseToken);
  });
});
