import { ContentItem, ContentType } from '../../../types';
import { tmdbService, sameCatalogWork, TMDB_IMAGE_BASE } from '../tmdb/tmdbClient';

const POSTER_CACHE_KEY = 'zapitv_poster_recovery_cache_v1';

export class PosterRecoveryService {
  private static instance: PosterRecoveryService;
  private memoryCache = new Map<string, string>();
  private inFlight = new Map<string, Promise<string | null>>();

  private constructor() {
    this.loadStorageCache();
  }

  public static getInstance(): PosterRecoveryService {
    if (!PosterRecoveryService.instance) {
      PosterRecoveryService.instance = new PosterRecoveryService();
    }
    return PosterRecoveryService.instance;
  }

  private loadStorageCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.sessionStorage.getItem(POSTER_CACHE_KEY) || window.localStorage.getItem(POSTER_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'string') this.memoryCache.set(k, v);
          });
        }
      }
    } catch {
      // Ignora erro em ambientes restritos
    }
  }

  private saveStorageCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, string> = {};
      this.memoryCache.forEach((v, k) => {
        obj[k] = v;
      });
      const serialized = JSON.stringify(obj);
      window.sessionStorage.setItem(POSTER_CACHE_KEY, serialized);
    } catch {
      // Ignora erro de quota
    }
  }

  private getCacheKeys(item: ContentItem): string[] {
    const keys: string[] = [];
    if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
      keys.push(`imdb:${item.imdbId.trim().toLowerCase()}`);
    }
    if (item.tmdbId) {
      keys.push(`tmdb:${item.type || 'all'}:${item.tmdbId}`);
    }
    if (item.id) {
      keys.push(`id:${item.id.toLowerCase()}`);
    }
    const cleanTitle = (item.title || '').trim().toLowerCase();
    if (cleanTitle) {
      keys.push(`title:${item.type || 'all'}:${cleanTitle}:${item.year || 0}`);
    }
    return keys;
  }

  public getCachedPoster(item: ContentItem): string | null {
    if (!item) return null;
    const keys = this.getCacheKeys(item);
    for (const key of keys) {
      const cached = this.memoryCache.get(key);
      if (cached) return cached;
    }
    return null;
  }

  public setCachedPoster(item: ContentItem, url: string): void {
    if (!item || !url) return;
    const keys = this.getCacheKeys(item);
    keys.forEach(k => this.memoryCache.set(k, url));
    this.saveStorageCache();
  }

  /**
   * Recupera a capa oficial correta de uma obra cujo pôster falhou ou está ausente.
   * Não associa imagens de outras obras: valida estritamente tipo de mídia e ano.
   */
  public recoverPoster(item: ContentItem): Promise<string | null> {
    if (!item) return Promise.resolve(null);

    // 1. Checa cache em memória
    const existing = this.getCachedPoster(item);
    if (existing) return Promise.resolve(existing);

    const primaryKey = item.imdbId || item.id || item.title;
    if (this.inFlight.has(primaryKey)) {
      return this.inFlight.get(primaryKey)!;
    }

    const task = (async (): Promise<string | null> => {
      try {
        // A. Se tiver IMDb ID (tt...), busca canônica no TMDB
        if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
          const tmdbItem = await tmdbService.findByImdb(item.imdbId.trim());
          if (tmdbItem?.image && tmdbItem.image.startsWith('http')) {
            this.setCachedPoster(item, tmdbItem.image);
            return tmdbItem.image;
          }
        }

        // B. Se tiver TMDb ID numérico
        if (item.tmdbId && /^\d+$/.test(String(item.tmdbId).trim())) {
          const isMovie = item.type === ContentType.MOVIE || item.mediaFormat === 'movie';
          const endpoint = isMovie ? `/movie/${item.tmdbId}` : `/tv/${item.tmdbId}`;
          try {
            const data = await tmdbService.getDetails(String(item.tmdbId), isMovie ? ContentType.MOVIE : ContentType.SERIES);
            if (data?.item?.image && data.item.image.startsWith('http')) {
              this.setCachedPoster(item, data.item.image);
              return data.item.image;
            }
          } catch {
            // Continua para busca por título
          }
        }

        // C. Busca rigorosa por título oficial no TMDB
        const searchTitle = item.originalTitle || item.title;
        if (searchTitle && searchTitle.trim().length >= 2) {
          const candidates = await tmdbService.searchMulti(searchTitle.trim());
          const match = candidates.find(cand => sameCatalogWork(cand, item) && cand.image && cand.image.startsWith('http'));
          if (match?.image) {
            this.setCachedPoster(item, match.image);
            return match.image;
          }
        }

        // D. Fallback para Cinemeta se tiver IMDb ID
        if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
          const cinemetaType = item.type === ContentType.MOVIE ? 'movie' : 'series';
          const meta = await tmdbService.getCinemetaMeta(cinemetaType, item.imdbId.trim());
          if (meta?.poster && meta.poster.startsWith('http') && !meta.poster.includes('undefined')) {
            this.setCachedPoster(item, meta.poster);
            return meta.poster;
          }
        }
      } catch (err) {
        console.warn(`[PosterRecoveryService] Erro ao recuperar capa para ${item.title}:`, err);
      }
      return null;
    })().finally(() => {
      this.inFlight.delete(primaryKey);
    });

    this.inFlight.set(primaryKey, task);
    return task;
  }
}

export const posterRecoveryService = PosterRecoveryService.getInstance();
