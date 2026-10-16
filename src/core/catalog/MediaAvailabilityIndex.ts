import { bannedContentRegistry } from './BannedContentRegistry';

export type AvailabilityStatus =
  | 'DISCOVERED'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'UNAVAILABLE_CONFIRMED'
  | 'TEMPORARY_ERROR'
  | 'EXPIRED';

export interface MediaAvailability {
  canonicalId: string;
  mediaType: 'movie' | 'series' | 'anime';
  title?: string;
  status: AvailabilityStatus;
  validatedSourceCount: number;
  providersChecked: string[];
  providersFailed: string[];
  checkedAt: number | null;
  expiresAt: number | null;
  lastError?: string;
  hasPtBrAudio?: boolean;
  hasPtSubtitles?: boolean;
  bestQuality?: string;
  availableEpisodeCount?: number;
}

export interface AvailabilityStats {
  totalIndexed: number;
  availableCount: number;
  checkingCount: number;
  unavailableConfirmedCount: number;
  temporaryErrorCount: number;
  expiredCount: number;
  moviesAvailable: number;
  seriesAvailable: number;
  animesAvailable: number;
  ptBrDubbedCount: number;
  originalAudioCount: number;
}

const STORAGE_INDEX_KEY = 'zapitv_media_availability_index_v4';
const CACHE_TTL_AVAILABLE_MS = 24 * 60 * 60 * 1000; // 24 horas para itens confirmados disponíveis
const CACHE_TTL_UNAVAILABLE_MS = 6 * 60 * 60 * 1000; // 6 horas para revalidar itens sem fonte
const CACHE_TTL_ERROR_MS = 15 * 60 * 1000; // 15 minutos para erros temporários (reavaliação rápida)

export class MediaAvailabilityIndex {
  private static instance: MediaAvailabilityIndex;
  private index = new Map<string, MediaAvailability>();
  private listeners = new Set<(stats: AvailabilityStats) => void>();

  private constructor() {
    this.cleanOldNegativeCaches();
    this.loadFromStorage();
  }

  public static getInstance(): MediaAvailabilityIndex {
    if (!MediaAvailabilityIndex.instance) {
      MediaAvailabilityIndex.instance = new MediaAvailabilityIndex();
    }
    return MediaAvailabilityIndex.instance;
  }

  /**
   * Invalida caches negativos defeituosos criados por versões anteriores que bloqueavam itens prematuramente
   */
  public cleanOldNegativeCaches(): number {
    let cleanedCount = 0;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Remove chaves legadas com falsos negativos
        localStorage.removeItem('zapitv_availability_cache_v1');
        localStorage.removeItem('zapitv_availability_cache_v2');
        localStorage.removeItem('zapitv_negative_availability_cache');
      } catch {}
    }

    // Reseta entradas com falha temporária ou sem fonte que já expiraram, e purga itens banidos
    const now = Date.now();
    for (const [key, record] of this.index.entries()) {
      if (bannedContentRegistry.isBannedKeyOrId(key) || bannedContentRegistry.isBannedTitle(record.title)) {
        this.index.delete(key);
        cleanedCount++;
        continue;
      }
      if (record.status === 'TEMPORARY_ERROR' || (record.status === 'UNAVAILABLE_CONFIRMED' && record.expiresAt && record.expiresAt < now)) {
        record.status = 'DISCOVERED';
        record.checkedAt = null;
        record.expiresAt = null;
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      this.saveToStorage();
    }
    return cleanedCount;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_INDEX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          let purged = false;
          for (const item of parsed) {
            if (item && item.canonicalId) {
              if (bannedContentRegistry.isBannedKeyOrId(item.canonicalId) || bannedContentRegistry.isBannedTitle(item.title)) {
                purged = true;
                continue;
              }
              // Verifica expiração
              if (item.expiresAt && item.expiresAt < now) {
                item.status = 'EXPIRED';
              }
              // Itens com indisponibilidade confirmada em sessões passadas são resetados para DISCOVERED
              if (item.status === 'UNAVAILABLE_CONFIRMED') {
                item.status = 'DISCOVERED';
              }
              this.index.set(item.canonicalId, item);
            }
          }
          if (purged) {
            this.saveToStorage();
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar índice de disponibilidade:', e);
    }
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  public saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        // Salva os 1000 itens mais recentes para não estourar o localStorage
        const items = Array.from(this.index.values())
          .sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0))
          .slice(0, 1000);
        localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(items));
      } catch (e) {
        console.warn('Erro ao persistir índice de disponibilidade:', e);
      }
    }, 300);
  }

  public getCanonicalKey(item: { id?: string; imdbId?: string; tmdbId?: string | number; title?: string }): string {
    if (item.id) return item.id.toLowerCase();
    if (item.imdbId && item.imdbId.startsWith('tt')) {
      return item.imdbId.toLowerCase();
    }
    if (item.id && item.id.startsWith('tt')) {
      return item.id.toLowerCase();
    }
    if (item.tmdbId) {
      return `tmdb-${item.tmdbId}`;
    }
    if (item.id) {
      return item.id.toLowerCase();
    }
    if (item.title) {
      return item.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-');
    }
    return 'unknown-media';
  }

  public getRecord(key: string): MediaAvailability | undefined {
    return this.index.get(key.toLowerCase());
  }

  public getStatus(key: string): AvailabilityStatus {
    const record = this.getRecord(key);
    if (!record) return 'DISCOVERED';

    if (record.expiresAt && record.expiresAt < Date.now()) {
      record.status = 'EXPIRED';
    }
    return record.status;
  }

  /**
   * Determina se o título pode ser exibido publicamente no catálogo de obras reproduzíveis
   * Regra estrita: apenas itens confirmados como UNAVAILABLE_CONFIRMED são excluídos.
   * Novos itens e checagens em segundo plano permanecem visíveis.
   */
  public isPubliclyPlayable(key: string): boolean {
    if (bannedContentRegistry.isBannedKeyOrId(key)) return false;
    const record = this.getRecord(key);
    if (!record) return true;
    if (record.status === 'UNAVAILABLE_CONFIRMED') return false;
    return true;
  }

  public recordDiscovery(canonicalId: string, title?: string, mediaType?: 'movie' | 'series' | 'anime' | any): void {
    const key = canonicalId.toLowerCase();
    if (!this.index.has(key)) {
      const type = mediaType === 'movie' || mediaType === 'series' || mediaType === 'anime' ? mediaType : 'movie';
      this.index.set(key, {
        canonicalId: key,
        mediaType: type,
        title,
        status: 'DISCOVERED',
        validatedSourceCount: 0,
        providersChecked: [],
        providersFailed: [],
        checkedAt: null,
        expiresAt: null
      });
    }
  }

  public markChecking(canonicalId: string, mediaType: 'movie' | 'series' | 'anime', title?: string): void {
    const key = canonicalId.toLowerCase();
    const existing = this.index.get(key);
    this.index.set(key, {
      canonicalId: key,
      mediaType,
      title: title || existing?.title,
      status: 'CHECKING',
      validatedSourceCount: existing?.validatedSourceCount || 0,
      providersChecked: existing?.providersChecked || [],
      providersFailed: existing?.providersFailed || [],
      checkedAt: existing?.checkedAt || null,
      expiresAt: existing?.expiresAt || null,
      hasPtBrAudio: existing?.hasPtBrAudio,
      hasPtSubtitles: existing?.hasPtSubtitles
    });
    this.notify();
  }

  public markAvailable(
    canonicalId: string,
    mediaType: 'movie' | 'series' | 'anime',
    details: {
      title?: string;
      sourceCount: number;
      providersChecked: string[];
      hasPtBrAudio?: boolean;
      hasPtSubtitles?: boolean;
      bestQuality?: string;
      episodeCount?: number;
    }
  ): void {
    const key = canonicalId.toLowerCase();
    const now = Date.now();
    this.index.set(key, {
      canonicalId: key,
      mediaType,
      title: details.title,
      status: 'AVAILABLE',
      validatedSourceCount: details.sourceCount,
      providersChecked: details.providersChecked,
      providersFailed: [],
      checkedAt: now,
      expiresAt: now + CACHE_TTL_AVAILABLE_MS,
      hasPtBrAudio: details.hasPtBrAudio,
      hasPtSubtitles: details.hasPtSubtitles,
      bestQuality: details.bestQuality || '1080p',
      availableEpisodeCount: details.episodeCount
    });
    this.saveToStorage();
    this.notify();
  }

  public markTemporaryError(
    canonicalId: string,
    mediaType: 'movie' | 'series' | 'anime',
    error: string,
    providersChecked: string[] = [],
    force = false
  ): void {
    const key = canonicalId.toLowerCase();
    const existing = this.index.get(key);
    const now = Date.now();

    // Se já estava confirmado como AVAILABLE antes, não rebaixa para erro temporário por uma falha de conexão efêmera
    if (!force && existing?.status === 'AVAILABLE') {
      return;
    }

    this.index.set(key, {
      canonicalId: key,
      mediaType,
      title: existing?.title,
      status: 'TEMPORARY_ERROR',
      validatedSourceCount: 0,
      providersChecked,
      providersFailed: providersChecked,
      checkedAt: now,
      expiresAt: now + CACHE_TTL_ERROR_MS,
      lastError: error
    });
    this.saveToStorage();
    this.notify();
  }

  public markUnavailableConfirmed(
    canonicalId: string,
    mediaType: 'movie' | 'series' | 'anime',
    providersChecked: string[],
    title?: string
  ): void {
    const key = canonicalId.toLowerCase();
    const existing = this.index.get(key);
    const now = Date.now();

    // Preserva se já tinha fonte encontrada anteriormente
    if (existing?.status === 'AVAILABLE' && existing.validatedSourceCount > 0) {
      return;
    }

    this.index.set(key, {
      canonicalId: key,
      mediaType,
      title: title || existing?.title,
      status: 'UNAVAILABLE_CONFIRMED',
      validatedSourceCount: 0,
      providersChecked,
      providersFailed: [],
      checkedAt: now,
      expiresAt: now + CACHE_TTL_UNAVAILABLE_MS
    });
    this.saveToStorage();
    this.notify();
  }

  public getStats(): AvailabilityStats {
    let availableCount = 0;
    let checkingCount = 0;
    let unavailableConfirmedCount = 0;
    let temporaryErrorCount = 0;
    let expiredCount = 0;
    let moviesAvailable = 0;
    let seriesAvailable = 0;
    let animesAvailable = 0;
    let ptBrDubbedCount = 0;
    let originalAudioCount = 0;

    const now = Date.now();
    for (const item of this.index.values()) {
      const isExpired = item.expiresAt && item.expiresAt < now;
      const status = isExpired ? 'EXPIRED' : item.status;

      switch (status) {
        case 'AVAILABLE':
          availableCount++;
          if (item.mediaType === 'movie') moviesAvailable++;
          else if (item.mediaType === 'series') seriesAvailable++;
          else if (item.mediaType === 'anime') animesAvailable++;
          if (item.hasPtBrAudio) ptBrDubbedCount++;
          else originalAudioCount++;
          break;
        case 'CHECKING':
          checkingCount++;
          break;
        case 'UNAVAILABLE_CONFIRMED':
          unavailableConfirmedCount++;
          break;
        case 'TEMPORARY_ERROR':
          temporaryErrorCount++;
          break;
        case 'EXPIRED':
          expiredCount++;
          break;
      }
    }

    return {
      totalIndexed: this.index.size,
      availableCount,
      checkingCount,
      unavailableConfirmedCount,
      temporaryErrorCount,
      expiredCount,
      moviesAvailable,
      seriesAvailable,
      animesAvailable,
      ptBrDubbedCount,
      originalAudioCount
    };
  }

  public subscribe(listener: (stats: AvailabilityStats) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    if (this.listeners.size === 0) return;
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      if (this.listeners.size === 0) return;
      const stats = this.getStats();
      for (const listener of this.listeners) {
        try {
          listener(stats);
        } catch {}
      }
    }, 120);
  }

  public clearAll(): void {
    this.index.clear();
    this.cleanOldNegativeCaches();
    this.notify();
  }
}

export const mediaAvailabilityIndex = MediaAvailabilityIndex.getInstance();
