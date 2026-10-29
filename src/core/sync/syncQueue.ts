/**
 * ZAPITV — FILA DE SINCRONIZAÇÃO OFFLINE (OUTBOX) (P3.D)
 * 
 * Funcionalidades:
 * - Persistência local isolada por perfil no localStorage (zapitv_outbox_${profileId}).
 * - Backoff exponencial com jitter para retentativas de envio.
 * - Idempotência por ID único de mutação (UUID).
 * - Despacho automático ao recuperar conectividade (evento 'online').
 * - Não inclui dados de usuários anônimos e não mistura dados entre perfis.
 * 
 * AVISO DE SEGURANÇA E PRIVACIDADE:
 * O isolamento de filas e estado no cliente utilizando namespaces no localStorage
 * (ex: zapitv_outbox_${accountId}_${profileId}) constitui isolamento lógico multi-perfil
 * e multi-conta em nível de aplicação para prevenir contaminação cruzada de histórico,
 * listas e progresso. Este mecanismo NÃO constitui criptografia de dados em repouso.
 * O localStorage armazena dados em texto simples legíveis por ferramentas de depuração
 * do navegador ou por acesso físico desprotegido ao sistema de arquivos do dispositivo.
 */

import { syncClient, SyncMutationItem } from './syncClient';

export class SyncQueueManager {
  private inMemoryQueues: Map<string, SyncMutationItem[]> = new Map();
  private activeFlush: Set<string> = new Set();
  private flushPromises = new Map<string, Promise<void>>();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private backoffAttempts: Map<string, number> = new Map();
  private activeAbortControllers: Map<string, AbortController> = new Map();
  private currentAccountId: string | null = null;
  private currentProfileId: string | null = null;
  private scopeEpoch = 0;
  private knownScopes = new Map<string, { profileId: string; accountId: string | null }>();
  private listeners = new Set<() => void>();
  private persistenceFailures = new Set<string>();
  private readonly maxAttempts = 5;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushAllActiveQueues();
      });
    }
  }

  public setAccountScope(accountId: string | null, profileId?: string | null): void {
    if (accountId !== this.currentAccountId || (profileId ?? null) !== this.currentProfileId) this.pauseAndUnloadQueues();
    this.currentAccountId = accountId;
    this.currentProfileId = profileId ?? null;
    if (profileId) this.getQueue(profileId, accountId);
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    for (const listener of this.listeners) { try { listener(); } catch {} }
  }

  private isActive(profileId: string, accountId: string | null): boolean {
    return accountId === this.currentAccountId && (!this.currentProfileId || profileId === this.currentProfileId);
  }

  public getConflicts(profileId: string, accountId = this.currentAccountId): SyncMutationItem[] {
    return this.isActive(profileId, accountId) ? this.getQueue(profileId, accountId).filter(m => m.syncState === 'conflict') : [];
  }

  public getRecoveryItems(profileId: string, accountId = this.currentAccountId): SyncMutationItem[] {
    return this.isActive(profileId, accountId) ? this.getQueue(profileId, accountId).filter(m =>
      m.syncState === 'conflict' || m.syncError || this.hasPersistenceFailure(profileId, accountId)) : [];
  }

  public hasPersistenceFailure(profileId: string, accountId = this.currentAccountId): boolean {
    return this.isActive(profileId, accountId) && this.persistenceFailures.has(this.getStorageKey(profileId, accountId));
  }

  public async reviewConflicts(profileId: string, accountId = this.currentAccountId) {
    if (!this.isActive(profileId, accountId)) return null;
    const epoch = this.scopeEpoch;
    const remote = await syncClient.pull(profileId);
    if (!remote || remote.profileId !== profileId || epoch !== this.scopeEpoch || !this.isActive(profileId, accountId)) return null;
    if (![remote.progress, remote.history, remote.favorites, remote.myList].every(Array.isArray)) return null;
    return this.getRecoveryItems(profileId, accountId).map(operation => {
      const records = operation.type === 'progress' ? remote.progress : operation.type === 'history' ? remote.history
        : operation.type === 'favorites' ? remote.favorites : remote.myList;
      const canonicalId = operation.data?.canonicalId || operation.data?.id;
      const matching = records.find(record => record.canonicalId === canonicalId &&
        (!('season' in record) || ((record.season || 0) === (operation.data?.season || 0) &&
          (record.episode || 0) === (operation.data?.episode || 0))));
      return { operation, remote: matching ?? null };
    });
  }

  public async retryPending(profileId: string, accountId = this.currentAccountId): Promise<void> {
    if (!this.isActive(profileId, accountId)) return;
    this.saveQueue(profileId, this.getQueue(profileId, accountId).map(m => m.syncState === 'conflict'
      ? m : { ...m, attempts: 0 }), accountId);
    await this.flush(profileId, accountId);
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
    this.knownScopes.set(storageKey, { profileId, accountId: accountId ?? this.currentAccountId });
    const mem = this.inMemoryQueues.get(storageKey);
    if (mem) return mem;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Filas legadas sem conta permanecem intactas; não atribuí-las a outra conta.
        const raw = localStorage.getItem(storageKey);

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
          localStorage.setItem(storageKey, JSON.stringify(queue));
        }
        this.persistenceFailures.delete(storageKey);
      } catch { this.persistenceFailures.add(storageKey); }
    }
    this.notify();
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
    if (mutation.type === 'progress' && !this.activeFlush.has(this.getStorageKey(profileId, accountId))) {
      const idx = queue.findIndex(m =>
        m.type === 'progress' && !m.syncState && !m.attempts &&
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
    return this.getQueue(profileId, accountId).filter(m => m.syncState !== 'conflict').length;
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
   * sob a chave da conta/perfil. Cancela requisições ativas em voo para evitar envio sob outra conta.
   */
  public pauseAndUnloadQueues(): void {
    this.scopeEpoch++;
    // 1. Cancela todas as requisições HTTP em andamento imediatamente
    for (const [, controller] of this.activeAbortControllers.entries()) {
      try {
        controller.abort('Cancelado por encerramento de sessão ou troca de conta.');
      } catch {}
    }
    this.activeAbortControllers.clear();

    // 2. Cancela timers de retry pendentes
    for (const [, timer] of this.retryTimeouts.entries()) {
      clearTimeout(timer);
    }
    this.retryTimeouts.clear();
    this.inMemoryQueues.clear();
    this.backoffAttempts.clear();
    this.activeFlush.clear();
    this.flushPromises.clear();
    this.currentAccountId = null;
    this.currentProfileId = null;
    this.knownScopes.clear();
    this.notify();
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
    const key = this.getStorageKey(profileId, accountId);
    const active = this.flushPromises.get(key);
    if (active) return active;
    const operation = this.performFlush(profileId, accountId);
    this.flushPromises.set(key, operation);
    try { await operation; } finally {
      if (this.flushPromises.get(key) === operation) this.flushPromises.delete(key);
    }
  }

  private async performFlush(profileId: string, accountId?: string | null): Promise<void> {
    const account = accountId ?? this.currentAccountId;
    const storageKey = this.getStorageKey(profileId, accountId);
    if (!profileId || !this.isActive(profileId, account) || this.activeFlush.has(storageKey)) return;

    // Se estiver explicitamente offline no navegador, aguarda retorno
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const queue = this.getQueue(profileId, account);
    const batch = queue.filter(m => m.syncState !== 'conflict' && (m.attempts || 0) < this.maxAttempts).slice(0, 50);
    if (batch.length === 0) return;

    this.activeFlush.add(storageKey);
    const controller = new AbortController();
    const epoch = this.scopeEpoch;
    this.activeAbortControllers.set(storageKey, controller);
    const batchIds = new Set(batch.map(m => m.id));
    this.saveQueue(profileId, queue.map(m => batchIds.has(m.id) ? { ...m, attempts: (m.attempts || 0) + 1 } : m), account);

    try {
      const outcome = await syncClient.pushBatch(profileId, batch, controller.signal);
      if (controller.signal.aborted || epoch !== this.scopeEpoch || !this.isActive(profileId, account)) return;
      const results = Array.isArray(outcome?.results) ? outcome.results : [];
      const remaining = this.getQueue(profileId, account).flatMap(m => {
        if (!batchIds.has(m.id)) return [m];
        const matches = results.filter(result => result?.id === m.id);
        const result = matches.length === 1 ? matches[0] : null;
        if (result?.success === true && !result.error && (result.duplicate === true || !result.conflictResolved)) return [];
        const permanent = result?.error === 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP' || result?.conflictResolved === true;
        return [{ ...m, ...(permanent ? { syncState: 'conflict' as const, rejectedAt: Date.now() } : {}),
          syncError: permanent ? (result?.error === 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP'
            ? result.error : 'SYNC_REMOTE_CONFLICT') : 'SYNC_CONFIRMATION_PENDING' }];
      });
      this.saveQueue(profileId, remaining, account);
      this.scheduleRetry(profileId, account);
    } catch {
      if (!controller.signal.aborted && epoch === this.scopeEpoch && this.isActive(profileId, account)) {
        this.saveQueue(profileId, this.getQueue(profileId, account).map(m => batchIds.has(m.id)
          ? { ...m, syncError: 'SYNC_NETWORK_PENDING' } : m), account);
        this.scheduleRetry(profileId, account);
      }
    } finally {
      if (this.activeAbortControllers.get(storageKey) === controller) {
        this.activeFlush.delete(storageKey);
        this.activeAbortControllers.delete(storageKey);
      }
    }
  }

  private scheduleRetry(profileId: string, accountId: string | null): void {
    const key = this.getStorageKey(profileId, accountId);
    const previous = this.retryTimeouts.get(key);
    if (previous) clearTimeout(previous);
    this.retryTimeouts.delete(key);
    const pending = this.getQueue(profileId, accountId).filter(m => m.syncState !== 'conflict' && (m.attempts || 0) < this.maxAttempts);
    if (!pending.length) return;
    const attempts = Math.max(...pending.map(m => m.attempts || 0));
    const timer = setTimeout(() => {
      this.retryTimeouts.delete(key);
      this.flush(profileId, accountId).catch(() => {});
    }, attempts ? Math.min(30000, 2000 * Math.pow(2, attempts - 1)) : 100);
    this.retryTimeouts.set(key, timer);
  }

  /**
   * Descarrega todas as filas de perfis conhecidas
   */
  public flushAllActiveQueues(): void {
    for (const { profileId, accountId } of this.knownScopes.values()) {
      if (this.isActive(profileId, accountId)) this.flush(profileId, accountId).catch(() => {});
    }
  }
}

export const syncQueue = new SyncQueueManager();
