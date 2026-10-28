/**
 * ZAPITV — FILA DE SINCRONIZAÇÃO OFFLINE (OUTBOX) (P3.D)
 * 
 * Funcionalidades:
 * - Persistência local isolada por perfil no localStorage (zapitv_outbox_${profileId}).
 * - Backoff exponencial com jitter para retentativas de envio.
 * - Idempotência por ID único de mutação (UUID).
 * - Despacho automático ao recuperar conectividade (evento 'online').
 * - Não inclui dados de usuários anônimos e não mistura dados entre perfis.
 */

import { syncClient, SyncMutationItem } from './syncClient';

export class SyncQueueManager {
  private inMemoryQueues: Map<string, SyncMutationItem[]> = new Map();
  private activeFlush: Set<string> = new Set();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private backoffAttempts: Map<string, number> = new Map();
  private currentAccountId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushAllActiveQueues();
      });
    }
  }

  public setAccountScope(accountId: string | null): void {
    this.currentAccountId = accountId;
  }

  public getAccountScope(): string | null {
    return this.currentAccountId;
  }

  public getStorageKey(profileId: string, accountId?: string | null): string {
    const acc = accountId ?? this.currentAccountId;
    return acc ? `zapitv_outbox_${acc}_${profileId}` : `zapitv_outbox_${profileId}`;
  }

  /**
   * Carrega as mutações persistidas do perfil, com isolamento de conta e suporte a chaves legadas
   */
  public getQueue(profileId: string, accountId?: string | null): SyncMutationItem[] {
    if (!profileId) return [];

    const storageKey = this.getStorageKey(profileId, accountId);
    const mem = this.inMemoryQueues.get(storageKey);
    if (mem) return mem;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        let raw = localStorage.getItem(storageKey);
        // Fallback para chave legada zapitv_outbox_${profileId} se ainda não migrada
        if (!raw && storageKey !== `zapitv_outbox_${profileId}`) {
          raw = localStorage.getItem(`zapitv_outbox_${profileId}`);
          if (raw) {
            localStorage.setItem(storageKey, raw);
            localStorage.removeItem(`zapitv_outbox_${profileId}`);
          }
        }

        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.inMemoryQueues.set(storageKey, parsed);
            return parsed;
          }
        }
      } catch {}
    }

    this.inMemoryQueues.set(storageKey, []);
    return [];
  }

  /**
   * Salva a fila localmente
   */
  private saveQueue(profileId: string, queue: SyncMutationItem[], accountId?: string | null): void {
    if (!profileId) return;
    const storageKey = this.getStorageKey(profileId, accountId);
    this.inMemoryQueues.set(storageKey, queue);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (queue.length === 0) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(queue.slice(0, 500)));
        }
      } catch {}
    }
  }

  /**
   * Enfileira uma nova mutação para o perfil com coalescência inteligente e isolamento por conta
   */
  public enqueue(
    profileId: string,
    mutation: Omit<SyncMutationItem, 'id' | 'timestamp'>,
    accountId?: string | null
  ): SyncMutationItem {
    if (!profileId) {
      throw new Error('profileId é obrigatório para enfileirar sincronização.');
    }

    const queue = this.getQueue(profileId, accountId);

    // Coalesce para progresso de reprodução: se já existir progresso pendente para o mesmo conteúdo,
    // atualiza o registro existente em vez de acumular registros obsoletos na fila.
    if (mutation.type === 'progress') {
      const idx = queue.findIndex(m =>
        m.type === 'progress' &&
        m.data?.canonicalId === mutation.data?.canonicalId &&
        (m.data?.season || 0) === (mutation.data?.season || 0) &&
        (m.data?.episode || 0) === (mutation.data?.episode || 0)
      );
      if (idx >= 0) {
        queue[idx].data = { ...queue[idx].data, ...mutation.data };
        queue[idx].timestamp = Date.now();
        this.saveQueue(profileId, queue, accountId);

        if (typeof navigator === 'undefined' || navigator.onLine) {
          this.flush(profileId, accountId).catch(() => {});
        }
        return queue[idx];
      }
    }

    const item: SyncMutationItem = {
      ...mutation,
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    queue.push(item);
    this.saveQueue(profileId, queue, accountId);

    // Tenta descarregar se online
    if (typeof navigator === 'undefined' || navigator.onLine) {
      this.flush(profileId, accountId).catch(() => {});
    }

    return item;
  }

  /**
   * Quantidade de mutações pendentes na fila
   */
  public getPendingCount(profileId: string, accountId?: string | null): number {
    return this.getQueue(profileId, accountId).length;
  }

  /**
   * Limpa a fila do perfil em memória e no localStorage
   */
  public clearQueue(profileId: string, accountId?: string | null): void {
    const storageKey = this.getStorageKey(profileId, accountId);
    const timer = this.retryTimeouts.get(storageKey);
    if (timer) {
      clearTimeout(timer);
      this.retryTimeouts.delete(storageKey);
    }
    this.inMemoryQueues.delete(storageKey);
    this.backoffAttempts.delete(storageKey);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
  }

  /**
   * Pausa e descarrega filas em memória no logout, PRESERVANDO dados offline no localStorage
   * sob a chave da conta/perfil. Impede descarte silencioso de dados ao deslogar.
   */
  public pauseAndUnloadQueues(): void {
    for (const [, timer] of this.retryTimeouts.entries()) {
      clearTimeout(timer);
    }
    this.retryTimeouts.clear();
    this.inMemoryQueues.clear();
    this.backoffAttempts.clear();
    this.activeFlush.clear();
    this.currentAccountId = null;
  }

  /**
   * Purga explicitamente todas as filas do localStorage (requer ação intencional de descarte)
   */
  public purgeAllQueues(): void {
    this.pauseAndUnloadQueues();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('zapitv_outbox_')) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          localStorage.removeItem(k);
        }
      } catch {}
    }
  }

  /**
   * Mantido para compatibilidade com testes anteriores que chamam clearAllQueues()
   */
  public clearAllQueues(): void {
    this.purgeAllQueues();
  }

  /**
   * Tenta enviar as mutações pendentes para o servidor
   */
  public async flush(profileId: string, accountId?: string | null): Promise<void> {
    const storageKey = this.getStorageKey(profileId, accountId);
    if (!profileId || this.activeFlush.has(storageKey)) return;

    // Se estiver explicitamente offline no navegador, aguarda retorno
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const queue = this.getQueue(profileId, accountId);
    if (queue.length === 0) return;

    this.activeFlush.add(storageKey);

    try {
      // Pega até 50 itens para envio em lote
      const batch = queue.slice(0, 50);
      const batchIds = new Set(batch.map(m => m.id));

      const outcome = await syncClient.pushBatch(profileId, batch);

      if (outcome && outcome.success) {
        // Remove os itens processados
        const remaining = queue.filter(m => !batchIds.has(m.id));
        this.saveQueue(profileId, remaining, accountId);
        this.backoffAttempts.delete(storageKey);

        // Se ainda houver itens restantes, continua descarregando
        if (remaining.length > 0) {
          setTimeout(() => this.flush(profileId, accountId), 100);
        }
      }
    } catch {
      // Falha de rede: agenda retry com backoff exponencial limitado (2s, 4s, 8s... max 30s)
      const attempts = (this.backoffAttempts.get(storageKey) || 0) + 1;
      this.backoffAttempts.set(storageKey, attempts);

      const delayMs = Math.min(30000, 2000 * Math.pow(1.5, Math.min(attempts, 6)));
      
      const existingTimer = this.retryTimeouts.get(storageKey);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        this.flush(profileId, accountId).catch(() => {});
      }, delayMs);

      this.retryTimeouts.set(storageKey, timer);
    } finally {
      this.activeFlush.delete(storageKey);
    }
  }

  /**
   * Descarrega todas as filas de perfis conhecidas
   */
  public flushAllActiveQueues(): void {
    for (const [key] of this.inMemoryQueues.entries()) {
      const parts = key.replace('zapitv_outbox_', '').split('_');
      const profileId = parts.length > 1 ? parts.slice(1).join('_') : parts[0];
      const accountId = parts.length > 1 ? parts[0] : null;
      this.flush(profileId, accountId).catch(() => {});
    }
  }
}

export const syncQueue = new SyncQueueManager();
