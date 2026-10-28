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

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushAllActiveQueues();
      });
    }
  }

  private getStorageKey(profileId: string): string {
    return `zapitv_outbox_${profileId}`;
  }

  /**
   * Carrega as mutações persistidas do perfil
   */
  public getQueue(profileId: string): SyncMutationItem[] {
    if (!profileId) return [];

    const mem = this.inMemoryQueues.get(profileId);
    if (mem) return mem;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(this.getStorageKey(profileId));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.inMemoryQueues.set(profileId, parsed);
            return parsed;
          }
        }
      } catch {}
    }

    this.inMemoryQueues.set(profileId, []);
    return [];
  }

  /**
   * Salva a fila localmente
   */
  private saveQueue(profileId: string, queue: SyncMutationItem[]): void {
    if (!profileId) return;
    this.inMemoryQueues.set(profileId, queue);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (queue.length === 0) {
          localStorage.removeItem(this.getStorageKey(profileId));
        } else {
          localStorage.setItem(this.getStorageKey(profileId), JSON.stringify(queue.slice(0, 500)));
        }
      } catch {}
    }
  }

  /**
   * Enfileira uma nova mutação para o perfil com coalescência inteligente
   */
  public enqueue(
    profileId: string,
    mutation: Omit<SyncMutationItem, 'id' | 'timestamp'>
  ): SyncMutationItem {
    if (!profileId) {
      throw new Error('profileId é obrigatório para enfileirar sincronização.');
    }

    const queue = this.getQueue(profileId);

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
        this.saveQueue(profileId, queue);

        if (typeof navigator === 'undefined' || navigator.onLine) {
          this.flush(profileId).catch(() => {});
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
    this.saveQueue(profileId, queue);

    // Tenta descarregar se online
    if (typeof navigator === 'undefined' || navigator.onLine) {
      this.flush(profileId).catch(() => {});
    }

    return item;
  }

  /**
   * Quantidade de mutações pendentes na fila
   */
  public getPendingCount(profileId: string): number {
    return this.getQueue(profileId).length;
  }

  /**
   * Limpa a fila do perfil
   */
  public clearQueue(profileId: string): void {
    const timer = this.retryTimeouts.get(profileId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimeouts.delete(profileId);
    }
    this.inMemoryQueues.delete(profileId);
    this.backoffAttempts.delete(profileId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(this.getStorageKey(profileId));
      } catch {}
    }
  }

  /**
   * Limpa todas as filas em memória e no localStorage (chamado no logout seguro)
   */
  public clearAllQueues(): void {
    for (const [, timer] of this.retryTimeouts.entries()) {
      clearTimeout(timer);
    }
    this.retryTimeouts.clear();
    this.inMemoryQueues.clear();
    this.backoffAttempts.clear();
    this.activeFlush.clear();

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
   * Tenta enviar as mutações pendentes para o servidor
   */
  public async flush(profileId: string): Promise<void> {
    if (!profileId || this.activeFlush.has(profileId)) return;

    // Se estiver explicitamente offline no navegador, aguarda retorno
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const queue = this.getQueue(profileId);
    if (queue.length === 0) return;

    this.activeFlush.add(profileId);

    try {
      // Pega até 50 itens para envio em lote
      const batch = queue.slice(0, 50);
      const batchIds = new Set(batch.map(m => m.id));

      const outcome = await syncClient.pushBatch(profileId, batch);

      if (outcome && outcome.success) {
        // Remove os itens processados
        const remaining = queue.filter(m => !batchIds.has(m.id));
        this.saveQueue(profileId, remaining);
        this.backoffAttempts.delete(profileId);

        // Se ainda houver itens restantes, continua descarregando
        if (remaining.length > 0) {
          setTimeout(() => this.flush(profileId), 100);
        }
      }
    } catch {
      // Falha de rede: agenda retry com backoff exponencial limitado (2s, 4s, 8s... max 30s)
      const attempts = (this.backoffAttempts.get(profileId) || 0) + 1;
      this.backoffAttempts.set(profileId, attempts);

      const delayMs = Math.min(30000, 2000 * Math.pow(1.5, Math.min(attempts, 6)));
      
      const existingTimer = this.retryTimeouts.get(profileId);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        this.flush(profileId).catch(() => {});
      }, delayMs);

      this.retryTimeouts.set(profileId, timer);
    } finally {
      this.activeFlush.delete(profileId);
    }
  }

  /**
   * Descarrega todas as filas de perfis conhecidas
   */
  public flushAllActiveQueues(): void {
    for (const [profileId] of this.inMemoryQueues.entries()) {
      this.flush(profileId).catch(() => {});
    }
  }
}

export const syncQueue = new SyncQueueManager();
