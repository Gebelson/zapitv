/**
 * ZAPITV — SERVIÇO DE POLÍTICA GLOBAL DE AUTENTICAÇÃO (MANDATORY AUTH POLICY)
 * 
 * Armazena a política de forma persistente e distribuída na tabela `global_settings`,
 * com cache em memória de curta duração (TTL 3s) para compatibilidade serverless.
 */

import type { Database } from '../database/client';
import { readSetting, writeSetting } from '../database/settings';

export const AUTH_POLICY_KEY = 'auth_policy';

export interface AuthPolicy {
  mandatoryAuth: boolean;
  version: number;
  updatedAt: number;
}

let cachedPolicy: AuthPolicy | null = null;
let cachedPolicyExpiresAt = 0;

/**
 * Consulta a política global de autenticação obrigatória
 */
export async function getAuthPolicy(db?: Database | null): Promise<AuthPolicy> {
  const now = Date.now();
  if (cachedPolicy && now < cachedPolicyExpiresAt) {
    return cachedPolicy;
  }

  const defaultPolicy: AuthPolicy = {
    mandatoryAuth: process.env.MANDATORY_AUTH !== 'false',
    version: 0,
    updatedAt: now,
  };

  if (!db) {
    try {
      const { getValidDatabase } = await import('./authMiddleware');
      db = await getValidDatabase();
    } catch {}
  }

  if (!db) {
    return defaultPolicy;
  }

  try {
    const setting = await readSetting(db, AUTH_POLICY_KEY);
    if (setting && typeof setting.value === 'object' && setting.value !== null) {
      const val = setting.value as { mandatoryAuth?: boolean };
      cachedPolicy = {
        mandatoryAuth: typeof val.mandatoryAuth === 'boolean' ? val.mandatoryAuth : defaultPolicy.mandatoryAuth,
        version: setting.version,
        updatedAt: setting.updatedAt,
      };
      cachedPolicyExpiresAt = now + 3000;
      return cachedPolicy;
    }
  } catch {
    // Falha silenciosa: retorna default seguro
  }

  cachedPolicy = defaultPolicy;
  cachedPolicyExpiresAt = now + 3000;
  return defaultPolicy;
}

/**
 * Altera a política global de autenticação obrigatória
 */
export async function setAuthPolicy(
  db: Database,
  mandatoryAuth: boolean,
  actorUid = 'admin',
  expectedVersion?: number
): Promise<AuthPolicy> {
  let versionToUse = expectedVersion;
  if (versionToUse === undefined) {
    const currentSetting = await readSetting(db, AUTH_POLICY_KEY);
    versionToUse = currentSetting ? currentSetting.version : 0;
  }

  const result = await writeSetting(
    db,
    AUTH_POLICY_KEY,
    { mandatoryAuth },
    versionToUse,
    actorUid
  );

  cachedPolicy = {
    mandatoryAuth,
    version: result.version,
    updatedAt: result.updatedAt,
  };
  cachedPolicyExpiresAt = Date.now() + 3000;
  return cachedPolicy;
}

export function invalidateAuthPolicyCache(): void {
  cachedPolicy = null;
  cachedPolicyExpiresAt = 0;
}
