/**
 * ZAPITV — CLIENTE DE SINCRONIZAÇÃO REMOTA (P3.D)
 * 
 * Comunicação com a API de sincronização (/api/sync) utilizando credenciais HttpOnly
 * e proteção CSRF. Suporta puxada de dados (pull), salvamento de progresso,
 * histórico, listas e envio em lote (batch).
 */

export interface RemoteProgress {
  id: string;
  profileId: string;
  canonicalId: string;
  contentType: string;
  season: number;
  episode: number;
  positionSec: number;
  durationSec: number;
  progressPercent: number;
  isCompleted: number;
  version: number;
  deviceName?: string;
  updatedAt: number;
}

export interface RemoteHistory {
  id: string;
  profileId: string;
  canonicalId: string;
  contentType: string;
  season: number;
  episode: number;
  title?: string;
  posterUrl?: string;
  year?: number;
  watchedAt: number;
  updatedAt: number;
  version: number;
}

export interface RemoteListItem {
  id: string;
  profileId: string;
  canonicalId: string;
  addedAt: number;
  isRemoved: number;
  removedAt?: number;
  updatedAt: number;
  version: number;
}

export interface SyncPullResponse {
  profileId: string;
  serverTime: number;
  progress: RemoteProgress[];
  history: RemoteHistory[];
  myList: RemoteListItem[];
  favorites: RemoteListItem[];
}

export interface ProgressSyncPayload {
  canonicalId: string;
  contentType: string;
  season?: number;
  episode?: number;
  positionSec: number;
  durationSec: number;
  progressPercent?: number;
  isCompleted?: boolean | number;
  deviceName?: string;
  updatedAt?: number;
}

export interface HistorySyncPayload {
  canonicalId: string;
  contentType: string;
  season?: number;
  episode?: number;
  title?: string;
  posterUrl?: string;
  year?: number;
  watchedAt?: number;
  updatedAt?: number;
}

export interface SyncMutationItem {
  id: string;
  type: 'progress' | 'history' | 'my_list' | 'favorites';
  action: 'save' | 'set' | 'remove';
  data: any;
  timestamp: number;
}

class SyncClient {
  private readonly timeoutMs = 8000;

  /**
   * Puxa o estado agregado atualizado do perfil remoto
   */
  async pull(profileId: string, since?: number): Promise<SyncPullResponse | null> {
    try {
      const url = new URL('/api/sync/pull', window.location.origin);
      url.searchParams.set('profileId', profileId);
      if (since) url.searchParams.set('since', String(since));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Zapi-Client': 'web',
        },
        credentials: 'include',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Envia atualização de progresso de reprodução ao servidor
   */
  async saveProgress(
    profileId: string,
    payload: ProgressSyncPayload
  ): Promise<{ success: boolean; progress?: RemoteProgress; conflictResolved?: boolean }> {
    const res = await fetch('/api/sync/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        profileId,
        ...payload,
        clientSendTime: Date.now(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao sincronizar progresso no servidor.');
    }

    return data;
  }

  /**
   * Registra reprodução no histórico do perfil
   */
  async recordHistory(
    profileId: string,
    payload: HistorySyncPayload
  ): Promise<{ success: boolean; history?: RemoteHistory }> {
    const res = await fetch('/api/sync/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        profileId,
        ...payload,
        clientSendTime: Date.now(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao registrar histórico no servidor.');
    }

    return data;
  }

  /**
   * Adiciona ou remove item de Minha Lista (com tombstone)
   */
  async setMyList(
    profileId: string,
    canonicalId: string,
    isRemoved: boolean,
    timestamp?: number
  ): Promise<{ success: boolean; item?: RemoteListItem; conflictResolved?: boolean }> {
    const res = await fetch('/api/sync/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        profileId,
        canonicalId,
        isRemoved,
        timestamp,
        clientSendTime: Date.now(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao atualizar Minha Lista no servidor.');
    }

    return data;
  }

  /**
   * Adiciona ou remove item de Favoritos (com tombstone)
   */
  async setFavorite(
    profileId: string,
    canonicalId: string,
    isRemoved: boolean,
    timestamp?: number
  ): Promise<{ success: boolean; item?: RemoteListItem; conflictResolved?: boolean }> {
    const res = await fetch('/api/sync/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        profileId,
        canonicalId,
        isRemoved,
        timestamp,
        clientSendTime: Date.now(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao atualizar Favoritos no servidor.');
    }

    return data;
  }

  /**
   * Envia lote de mutações da fila outbox offline ao servidor
   */
  async pushBatch(
    profileId: string,
    mutations: SyncMutationItem[],
    signal?: AbortSignal
  ): Promise<{ success: boolean; processed: number; results: any[] }> {
    const combinedSignal = signal || AbortSignal.timeout(this.timeoutMs);
    const res = await fetch('/api/sync/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      signal: combinedSignal,
      body: JSON.stringify({
        profileId,
        mutations,
        clientSendTime: Date.now(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao sincronizar lote de mutações.');
    }

    return data;
  }
}

export const syncClient = new SyncClient();
