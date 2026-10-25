import { ContentItem, ContentType } from '../../../types';
import { tmdbService, sameCatalogWork, TMDB_IMAGE_BASE } from '../tmdb/tmdbClient';
import { LruCache } from '../cache/LruCache';
import { tvPerformanceProfileService } from '../tv/tvPerformanceProfileService';
import { tvImagePreloaderService } from '../tv/tvImagePreloaderService';

const POSTER_CACHE_KEY = 'zapitv_poster_recovery_cache_v2';
export const NO_IMAGE_SENTINEL = '__NO_IMAGE__';

export interface RecoveryDiagnosticLog {
  id: string;
  title: string;
  originalUrl: string;
  optimizedUrl?: string;
  failedUrls?: string[];
  attempts: string[];
  recoveredSource: string | null;
  recoveredUrl: string | null;
  finalResult: 'SUCCESS' | 'FAILED';
  failureReason?: string;
}

export function logRecoveryDiagnostic(diag: RecoveryDiagnosticLog): void {
  const isDev = (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') ||
                (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ||
                (typeof window !== 'undefined' && (window as any).__ZAPITV_DEV__);

  if (isDev) {
    if (diag.finalResult === 'SUCCESS') {
      console.info(
        `[PosterRecoveryService][DIAGNOSTIC] ✅ Capa recuperada com sucesso: "${diag.title}" (${diag.id}) | Fonte: ${diag.recoveredSource} | URL: ${diag.recoveredUrl}`
      );
    } else {
      console.warn(
        `[PosterRecoveryService][DIAGNOSTIC] ❌ Falha na recuperação de capa: "${diag.title}" (${diag.id}) | Causa: ${diag.failureReason || 'Todas as fontes esgotadas'} | Tentativas: ${diag.attempts.join(', ')}`
      );
    }
  }
}

export class PosterRecoveryService {
  private static instance: PosterRecoveryService;
  private memoryCache = new LruCache<string, string>(500);
  private inFlight = new Map<string, Promise<string | null>>();
  private queue: Array<{
    item: ContentItem;
    resolve: (url: string | null) => void;
  }> = [];
  private activeWorkers = 0;
  private readonly MAX_CONCURRENT_RECOVERIES = 3;
  private listeners = new Set<(itemId: string, url: string) => void>();

  private constructor() {
    this.loadStorageCache();
  }

  public static getInstance(): PosterRecoveryService {
    if (!PosterRecoveryService.instance) {
      PosterRecoveryService.instance = new PosterRecoveryService();
    }
    return PosterRecoveryService.instance;
  }

  /**
   * Registra um listener para atualizações de capas no cache
   */
  public subscribe(callback: (itemId: string, url: string) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(itemId: string, url: string): void {
    this.listeners.forEach(cb => {
      try {
        cb(itemId, url);
      } catch (err) {
        console.error('[PosterRecoveryService] Erro no listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('zapitv_poster_recovered', { detail: { itemId, url } }));
      } catch {}
    }
  }

  private loadStorageCache(): void {
    if (typeof window === 'undefined') return;
    try {
      try {
        window.sessionStorage.removeItem('zapitv_poster_recovery_cache_v1');
        window.localStorage.removeItem('zapitv_poster_recovery_cache_v1');
      } catch {}

      const stored = window.localStorage.getItem(POSTER_CACHE_KEY) || window.sessionStorage.getItem(POSTER_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'string') {
              if (v.includes('undefined') || (v.includes('metahub.space') && v.includes('tt31828574'))) return;
              this.memoryCache.set(k, v);
            }
          });
        }
      }
    } catch {
      // Ignora erro em ambientes restritos
    }
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private saveStorageCache(): void {
    if (typeof window === 'undefined') return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const obj: Record<string, string> = {};
        this.memoryCache.forEach((v, k) => {
          obj[k] = v;
        });
        const serialized = JSON.stringify(obj);
        try { window.localStorage.setItem(POSTER_CACHE_KEY, serialized); } catch {}
        try { window.sessionStorage.setItem(POSTER_CACHE_KEY, serialized); } catch {}
      } catch {
        // Ignora erro de quota
      }
    }, 300);
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
    if (item.aniListId) {
      keys.push(`anilist:${item.aniListId}`);
    }
    if (item.canonicalId) {
      keys.push(`canonical:${item.canonicalId.toLowerCase()}`);
    }
    const cleanTitle = (item.title || item.originalTitle || '').trim().toLowerCase();
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
      if (cached) {
        if (cached === NO_IMAGE_SENTINEL) return null;
        return cached;
      }
    }
    return null;
  }

  public hasAttemptedRecovery(item: ContentItem): boolean {
    if (!item) return false;
    const keys = this.getCacheKeys(item);
    for (const key of keys) {
      if (this.memoryCache.has(key)) return true;
    }
    return false;
  }

  public setCachedPoster(item: ContentItem, url: string): void {
    if (!item || !url) return;
    const keys = this.getCacheKeys(item);
    keys.forEach(k => this.memoryCache.set(k, url));
    this.saveStorageCache();

    // Pré-carrega e decodifica imediatamente a imagem otimizada para Smart TV
    const opt = tvPerformanceProfileService.getOptimizedPosterUrl(url);
    if (opt) {
      tvImagePreloaderService.preload(opt, 1);
    }

    // Notifica componentes inscritos (cards ativos na tela)
    this.notify(item.id, url);
  }

  /**
   * Indica se a capa já está decodificada e pronta na memória GPU/RAM
   */
  public isPosterReady(item: ContentItem): boolean {
    const raw = this.getCachedPoster(item) || item?.image || item?.poster || item?.backdrop || '';
    if (!raw) return false;
    const opt = tvPerformanceProfileService.getOptimizedPosterUrl(raw);
    return tvImagePreloaderService.isReady(opt);
  }

  /**
   * Pré-carrega a capa da obra de forma coordenada
   */
  public preloadItemPoster(item: ContentItem, priority: 1 | 2 | 3 = 2): Promise<boolean> {
    const raw = this.getCachedPoster(item) || item?.image || item?.poster || item?.backdrop || '';
    if (!raw) return Promise.resolve(false);
    const opt = tvPerformanceProfileService.getOptimizedPosterUrl(raw);
    return tvImagePreloaderService.preload(opt, priority);
  }

  public markNoImageAvailable(item: ContentItem): void {
    if (!item) return;
    const keys = this.getCacheKeys(item);
    keys.forEach(k => this.memoryCache.set(k, NO_IMAGE_SENTINEL));
    this.saveStorageCache();
  }

  /**
   * Valida se uma URL candidata carrega com sucesso
   */
  public async validateImageUrl(url: string, timeoutMs = 4500): Promise<boolean> {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;

    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs) });
        return res.ok;
      } catch {
        return false;
      }
    }

    const opt = tvPerformanceProfileService.getOptimizedPosterUrl(url);
    return tvImagePreloaderService.preload(opt, 1);
  }

  /**
   * Consulta a API oficial do AniList (GraphQL) por ID numérico
   */
  private async queryAniListById(id: number): Promise<string | null> {
    if (!id || id <= 0) return null;
    const query = `
      query ($id: Int) {
        Media (id: $id, type: ANIME) {
          coverImage { extraLarge large medium }
          bannerImage
        }
      }
    `;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { id } }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const media = data?.data?.Media;
      const cover = media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium;
      if (cover && typeof cover === 'string' && cover.startsWith('http')) {
        return cover;
      }
      if (media?.bannerImage && typeof media.bannerImage === 'string' && media.bannerImage.startsWith('http')) {
        return media.bannerImage;
      }
    } catch {
      // Ignora falha de rede do AniList
    }
    return null;
  }

  /**
   * Consulta a API oficial do AniList (GraphQL) por título para animes
   */
  private async queryAniList(title: string): Promise<string | null> {
    if (!title || title.trim().length < 2) return null;
    const cleanSearch = title.replace(/\s*\([^)]*\)/g, '').trim();
    const query = `
      query ($search: String) {
        Media (search: $search, type: ANIME) {
          coverImage { extraLarge large medium }
          bannerImage
        }
      }
    `;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { search: cleanSearch } }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const media = data?.data?.Media;
      const cover = media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium;
      if (cover && typeof cover === 'string' && cover.startsWith('http')) {
        return cover;
      }
      if (media?.bannerImage && typeof media.bannerImage === 'string' && media.bannerImage.startsWith('http')) {
        return media.bannerImage;
      }
    } catch {
      // Ignora falha de rede do AniList
    }
    return null;
  }

  /**
   * Recupera a capa oficial correta de uma obra cujo pôster falhou ou está ausente.
   * Não associa imagens de outras obras: valida estritamente tipo de mídia e ano.
   * Utiliza fila com controle de concorrência limitada (máx 3 simultâneas) para não sobrecarregar Smart TVs.
   */
  public recoverPoster(item: ContentItem): Promise<string | null> {
    if (!item) return Promise.resolve(null);

    // 1. Checa cache em memória (inclusive se já sabemos que não possui imagem)
    if (this.hasAttemptedRecovery(item)) {
      return Promise.resolve(this.getCachedPoster(item));
    }

    const primaryKey = item.imdbId || item.id || item.title;
    if (this.inFlight.has(primaryKey)) {
      return this.inFlight.get(primaryKey)!;
    }

    const task = new Promise<string | null>((resolve) => {
      this.queue.push({
        item,
        resolve
      });
      this.processQueue();
    }).finally(() => {
      this.inFlight.delete(primaryKey);
    });

    this.inFlight.set(primaryKey, task);
    return task;
  }

  private processQueue(): void {
    if (this.activeWorkers >= this.MAX_CONCURRENT_RECOVERIES || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    this.activeWorkers++;
    this.executeRecovery(next.item)
      .then(url => next.resolve(url))
      .catch(() => next.resolve(null))
      .finally(() => {
        this.activeWorkers--;
        this.processQueue();
      });
  }

  private async executeRecovery(item: ContentItem): Promise<string | null> {
    const isMovie = item.type === ContentType.MOVIE || item.mediaFormat === 'movie';
    const isAnime = item.type === ContentType.ANIME || item.genres?.includes('Anime');

    const diag: RecoveryDiagnosticLog = {
      id: item.id,
      title: item.title,
      originalUrl: item.image || item.poster || '',
      attempts: [],
      recoveredSource: null,
      recoveredUrl: null,
      finalResult: 'FAILED'
    };

    try {
      // A. Especializado para Animes com aniListId conhecido ou no canonicalId
      let targetAniListId = item.aniListId;
      if (!targetAniListId && item.canonicalId && item.canonicalId.includes('anilist:')) {
        const match = item.canonicalId.match(/anilist:(\d+)/i);
        if (match) targetAniListId = parseInt(match[1], 10);
      }

      if (isAnime && targetAniListId) {
        diag.attempts.push(`anilist_id:${targetAniListId}`);
        const anilistCover = await this.queryAniListById(targetAniListId);
        if (anilistCover && await this.validateImageUrl(anilistCover)) {
          this.setCachedPoster(item, anilistCover);
          diag.recoveredSource = 'anilist_id';
          diag.recoveredUrl = anilistCover;
          diag.finalResult = 'SUCCESS';
          logRecoveryDiagnostic(diag);
          return anilistCover;
        }
      }

      // B. Se tiver TMDb ID numérico (ex: Séries, Filmes e Animes catalogados no TMDB)
      if (item.tmdbId && /^\d+$/.test(String(item.tmdbId).trim())) {
        diag.attempts.push(`tmdb_id:${item.tmdbId}`);
        try {
          const data = await tmdbService.getDetails(String(item.tmdbId), isMovie ? ContentType.MOVIE : ContentType.SERIES);
          if (data?.item?.image && data.item.image.startsWith('http') && data.item.image !== item.image) {
            if (await this.validateImageUrl(data.item.image)) {
              this.setCachedPoster(item, data.item.image);
              diag.recoveredSource = 'tmdb_id_details';
              diag.recoveredUrl = data.item.image;
              diag.finalResult = 'SUCCESS';
              logRecoveryDiagnostic(diag);
              return data.item.image;
            }
          }

          // Consulta endpoint /images multilíngue do TMDB (posters alternativos)
          const images = await tmdbService.getImages(item.tmdbId, isMovie);
          for (const poster of images.posters) {
            if (poster && poster !== item.image && await this.validateImageUrl(poster)) {
              this.setCachedPoster(item, poster);
              diag.recoveredSource = 'tmdb_id_images';
              diag.recoveredUrl = poster;
              diag.finalResult = 'SUCCESS';
              logRecoveryDiagnostic(diag);
              return poster;
            }
          }

          // Tenta backdrop como alternativa
          if (data?.item?.backdrop && data.item.backdrop.startsWith('http') && data.item.backdrop !== item.backdrop) {
            if (await this.validateImageUrl(data.item.backdrop)) {
              this.setCachedPoster(item, data.item.backdrop);
              diag.recoveredSource = 'tmdb_id_backdrop';
              diag.recoveredUrl = data.item.backdrop;
              diag.finalResult = 'SUCCESS';
              logRecoveryDiagnostic(diag);
              return data.item.backdrop;
            }
          }
        } catch {
          // Continua para outras fontes
        }
      }

      // C. Especializado para Animes por busca de título no AniList
      if (isAnime) {
        const animeTitle = item.originalTitle || item.title;
        diag.attempts.push(`anilist_title:${animeTitle}`);
        const anilistCover = await this.queryAniList(animeTitle);
        if (anilistCover && await this.validateImageUrl(anilistCover)) {
          this.setCachedPoster(item, anilistCover);
          diag.recoveredSource = 'anilist_title';
          diag.recoveredUrl = anilistCover;
          diag.finalResult = 'SUCCESS';
          logRecoveryDiagnostic(diag);
          return anilistCover;
        }
      }

      // D. Se tiver IMDb ID (tt...), busca canônica no TMDB
      if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
        diag.attempts.push(`tmdb_imdb:${item.imdbId.trim()}`);
        try {
          const tmdbItem = await tmdbService.findByImdb(item.imdbId.trim());
          if (tmdbItem?.image && tmdbItem.image.startsWith('http') && tmdbItem.image !== item.image) {
            if (await this.validateImageUrl(tmdbItem.image)) {
              this.setCachedPoster(item, tmdbItem.image);
              diag.recoveredSource = 'tmdb_imdb_find';
              diag.recoveredUrl = tmdbItem.image;
              diag.finalResult = 'SUCCESS';
              logRecoveryDiagnostic(diag);
              return tmdbItem.image;
            }
          }
          if (tmdbItem?.tmdbId) {
            const images = await tmdbService.getImages(tmdbItem.tmdbId, isMovie);
            for (const poster of images.posters) {
              if (poster && poster !== item.image && await this.validateImageUrl(poster)) {
                this.setCachedPoster(item, poster);
                diag.recoveredSource = 'tmdb_imdb_images';
                diag.recoveredUrl = poster;
                diag.finalResult = 'SUCCESS';
                logRecoveryDiagnostic(diag);
                return poster;
              }
            }
          }
        } catch {
          // Continua para busca por título
        }
      }

      // E. Busca rigorosa por título oficial no TMDB
      const searchTitle = item.originalTitle || item.title;
      if (searchTitle && searchTitle.trim().length >= 2) {
        diag.attempts.push(`tmdb_search:${searchTitle.trim()}`);
        try {
          const candidates = await tmdbService.searchMulti(searchTitle.trim());
          const match = candidates.find(cand => sameCatalogWork(cand, item) && ((cand.image && cand.image.startsWith('http')) || (cand.backdrop && cand.backdrop.startsWith('http'))));
          if (match) {
            const resolved = (match.image && match.image.startsWith('http') && match.image !== item.image) ? match.image : match.backdrop;
            if (resolved && await this.validateImageUrl(resolved)) {
              this.setCachedPoster(item, resolved);
              diag.recoveredSource = 'tmdb_search_match';
              diag.recoveredUrl = resolved;
              diag.finalResult = 'SUCCESS';
              logRecoveryDiagnostic(diag);
              return resolved;
            }
          }
        } catch {
          // Continua para fallback final
        }
      }

      // F. Fallback seguro para Cinemeta apenas se tiver poster legítimo
      if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
        diag.attempts.push(`cinemeta_imdb:${item.imdbId.trim()}`);
        const cinemetaType = isMovie ? 'movie' : 'series';
        try {
          const meta = await tmdbService.getCinemetaMeta(cinemetaType, item.imdbId.trim(), 4000);
          const candidatePoster = meta?.poster || meta?.background;
          if (candidatePoster && candidatePoster.startsWith('http') && !candidatePoster.includes('undefined')) {
            if (await this.validateImageUrl(candidatePoster)) {
              this.setCachedPoster(item, candidatePoster);
              diag.recoveredSource = 'cinemeta';
              diag.recoveredUrl = candidatePoster;
              diag.finalResult = 'SUCCESS';
              logRecoveryDiagnostic(diag);
              return candidatePoster;
            }
          }
        } catch {
          // Ignora erro do Cinemeta
        }
      }
    } catch (err: any) {
      diag.failureReason = err?.message || String(err);
      console.warn(`[PosterRecoveryService] Erro na recuperação de imagem para ${item.title}:`, err);
    }

    diag.finalResult = 'FAILED';
    diag.failureReason = 'Todas as estratégias (TMDB, AniList, Cinemeta) falharam ou retornaram imagens inacessíveis';
    logRecoveryDiagnostic(diag);

    // Registra que não há imagem disponível para esta obra para evitar requisições repetitivas
    this.markNoImageAvailable(item);
    return null;
  }
}

export const posterRecoveryService = PosterRecoveryService.getInstance();
