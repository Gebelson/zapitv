/**
 * ZAPITV — PROTEÇÃO CONTRA FORÇA BRUTA E TENTATIVAS ABUSIVAS (P3.A)
 * 
 * Limita tentativas consecutivas de login para prevenir ataques de força bruta.
 * Combina cache em memória de resposta ultra-rápida (< 1ms) com registro
 * no banco de dados para auditoria.
 * 
 * Regra: Máximo 5 falhas consecutivas em janela de 15 minutos por e-mail ou IP.
 */

import crypto from 'crypto';
import { eq, and, gt, desc } from 'drizzle-orm';
import { Database } from '../database/client';
import { loginAttempts } from '../database/schema';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

interface MemoryAttemptRecord {
  failures: number;
  lastAttemptAt: number;
  lockedUntil: number;
}

const memoryLockouts = new Map<string, MemoryAttemptRecord>();

export class RateLimitService {
  /**
   * Limpa registros expirados da memória
   */
  private static pruneMemory() {
    const now = Date.now();
    for (const [key, val] of memoryLockouts.entries()) {
      if (val.lockedUntil < now && now - val.lastAttemptAt > LOCKOUT_WINDOW_MS) {
        memoryLockouts.delete(key);
      }
    }
  }

  /**
   * Verifica se o identificador (e-mail ou IP) está temporariamente bloqueado.
   * Consulta primeiro a memória rápida (L1) e em seguida a tabela persistente
   * login_attempts no banco de dados para garantir proteção entre réplicas e serverless.
   */
  static async isLocked(
    db: Database | null,
    identifier: string
  ): Promise<{ locked: boolean; remainingSeconds: number }> {
    this.pruneMemory();
    const cleanId = identifier.trim().toLowerCase();
    const record = memoryLockouts.get(cleanId);
    const now = Date.now();

    if (record && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds };
    }

    if (db) {
      try {
        const threshold = now - LOCKOUT_WINDOW_MS;
        const attempts = await db.db
          .select({ attemptAt: loginAttempts.attemptAt, success: loginAttempts.success })
          .from(loginAttempts)
          .where(and(eq(loginAttempts.identifier, cleanId), gt(loginAttempts.attemptAt, threshold)))
          .orderBy(desc(loginAttempts.attemptAt));

        let consecutiveFailures = 0;
        let latestFailureTime = 0;
        for (const a of attempts) {
          if (a.success === 1) break;
          consecutiveFailures++;
          if (a.attemptAt > latestFailureTime) latestFailureTime = a.attemptAt;
        }

        if (consecutiveFailures >= MAX_FAILED_ATTEMPTS) {
          const lockedUntil = latestFailureTime + LOCKOUT_WINDOW_MS;
          if (lockedUntil > now) {
            const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
            memoryLockouts.set(cleanId, { failures: consecutiveFailures, lastAttemptAt: latestFailureTime, lockedUntil });
            return { locked: true, remainingSeconds };
          }
        }
      } catch {
        // Fallback seguro em caso de indisponibilidade da tabela de auditoria
      }
    }

    return { locked: false, remainingSeconds: 0 };
  }

  /**
   * Registra uma falha de autenticação e calcula eventual bloqueio
   */
  static async recordFailure(
    db: Database | null,
    identifier: string,
    ipAddress?: string
  ): Promise<{ locked: boolean; remainingAttempts: number; remainingSeconds: number }> {
    const cleanId = identifier.trim().toLowerCase();
    const now = Date.now();
    const existing = memoryLockouts.get(cleanId);

    const failures = existing && (now - existing.lastAttemptAt < LOCKOUT_WINDOW_MS) 
      ? existing.failures + 1 
      : 1;

    const locked = failures >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = locked ? now + LOCKOUT_WINDOW_MS : 0;

    memoryLockouts.set(cleanId, {
      failures,
      lastAttemptAt: now,
      lockedUntil,
    });

    // Registra auditoria persistente no banco de dados compartilhado
    if (db) {
      try {
        await db.db.insert(loginAttempts).values({
          id: crypto.randomUUID(),
          identifier: cleanId,
          attemptAt: now,
          success: 0,
          ipAddress: ipAddress?.slice(0, 45) || null,
        });
      } catch (err) {
        // Falha no log de auditoria não deve derrubar a requisição
      }
    }

    const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - failures);
    const remainingSeconds = locked ? Math.ceil(LOCKOUT_WINDOW_MS / 1000) : 0;

    return { locked, remainingAttempts, remainingSeconds };
  }

  /**
   * Registra sucesso e limpa o histórico de falhas do identificador
   */
  static async recordSuccess(
    db: Database | null,
    identifier: string,
    ipAddress?: string
  ): Promise<void> {
    const cleanId = identifier.trim().toLowerCase();
    memoryLockouts.delete(cleanId);

    if (db) {
      try {
        await db.db.insert(loginAttempts).values({
          id: crypto.randomUUID(),
          identifier: cleanId,
          attemptAt: Date.now(),
          success: 1,
          ipAddress: ipAddress?.slice(0, 45) || null,
        });
      } catch {}
    }
  }

  /**
   * Método de teste para resetar memória de bloqueios
   */
  static resetForTesting(): void {
    memoryLockouts.clear();
  }
}

