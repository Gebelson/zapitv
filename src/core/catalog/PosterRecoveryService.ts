import { ContentItem, ContentType } from '../../../types';
import { tmdbService, sameCatalogWork, TMDB_IMAGE_BASE } from '../tmdb/tmdbClient';

const POSTER_CACHE_KEY = 'zapitv_poster_recovery_cache_v2';
export const NO_IMAGE_SENTINEL = '__NO_IMAGE__';

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
      // Limpa caches antigos de versões v1 que podiam conter URLs 404
      try {
        window.sessionStorage.removeItem('zapitv_poster_recovery_cache_v1');
        window.localStorage.removeItem('zapitv_poster_recovery_cache_v1');
      } catch {}

      const stored = window.sessionStorage.getItem(POSTER_CACHE_KEY) || window.localStorage.getItem(POSTER_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'string') {
              // Não carrega URLs quebradas conhecidas
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
        window.sessionStorage.setItem(POSTER_CACHE_KEY, serialized);
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
  }

  public markNoImageAvailable(item: ContentItem): void {
    if (!item) return;
    const keys = this.getCacheKeys(item);
    keys.forEach(k => this.memoryCache.set(k, NO_IMAGE_SENTINEL));
    this.saveStorageCache();
  }

  /**
   * Consulta a API oficial do AniList (GraphQL) para animes sem capa no TMDB
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

    const task = (async (): Promise<string | null> => {
      const isMovie = item.type === ContentType.MOVIE || item.mediaFormat === 'movie';
      const isAnime = item.type === ContentType.ANIME || item.genres?.includes('Anime');

      try {
        // A. Se tiver TMDb ID numérico
        if (item.tmdbId && /^\d+$/.test(String(item.tmdbId).trim())) {
          try {
            const data = await tmdbService.getDetails(String(item.tmdbId), isMovie ? ContentType.MOVIE : ContentType.SERIES);
            if (data?.item?.image && data.item.image.startsWith('http')) {
              this.setCachedPoster(item, data.item.image);
              return data.item.image;
            }
            if (data?.item?.backdrop && data.item.backdrop.startsWith('http')) {
              this.setCachedPoster(item, data.item.backdrop);
              return data.item.backdrop;
            }

            // Consulta endpoint /images multilíngue do TMDB
            const images = await tmdbService.getImages(item.tmdbId, isMovie);
            if (images.posters.length > 0) {
              this.setCachedPoster(item, images.posters[0]);
              return images.posters[0];
            }
            if (images.backdrops.length > 0) {
              this.setCachedPoster(item, images.backdrops[0]);
              return images.backdrops[0];
            }
          } catch {
            // Continua para outras estratégias
          }
        }

        // B. Se tiver IMDb ID (tt...), busca canônica no TMDB
        if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
          try {
            const tmdbItem = await tmdbService.findByImdb(item.imdbId.trim());
            if (tmdbItem?.image && tmdbItem.image.startsWith('http')) {
              this.setCachedPoster(item, tmdbItem.image);
              return tmdbItem.image;
            }
            if (tmdbItem?.backdrop && tmdbItem.backdrop.startsWith('http')) {
              this.setCachedPoster(item, tmdbItem.backdrop);
              return tmdbItem.backdrop;
            }
            if (tmdbItem?.tmdbId) {
              const images = await tmdbService.getImages(tmdbItem.tmdbId, isMovie);
              if (images.posters.length > 0) {
                this.setCachedPoster(item, images.posters[0]);
                return images.posters[0];
              }
              if (images.backdrops.length > 0) {
                this.setCachedPoster(item, images.backdrops[0]);
                return images.backdrops[0];
              }
            }
          } catch {
            // Continua para busca por título
          }
        }

        // C. Especializado para Animes: AniList GraphQL
        if (isAnime) {
          const animeTitle = item.originalTitle || item.title;
          const anilistCover = await this.queryAniList(animeTitle);
          if (anilistCover) {
            this.setCachedPoster(item, anilistCover);
            return anilistCover;
          }
        }

        // D. Busca rigorosa por título oficial no TMDB
        const searchTitle = item.originalTitle || item.title;
        if (searchTitle && searchTitle.trim().length >= 2) {
          try {
            const candidates = await tmdbService.searchMulti(searchTitle.trim());
            const match = candidates.find(cand => sameCatalogWork(cand, item) && ((cand.image && cand.image.startsWith('http')) || (cand.backdrop && cand.backdrop.startsWith('http'))));
            if (match) {
              const resolved = (match.image && match.image.startsWith('http')) ? match.image : match.backdrop;
              if (resolved) {
                this.setCachedPoster(item, resolved);
                return resolved;
              }
            }
          } catch {
            // Continua para fallback final
          }
        }

        // E. Fallback seguro para Cinemeta apenas se tiver poster legítimo
        if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
          const cinemetaType = isMovie ? 'movie' : 'series';
          try {
            const meta = await tmdbService.getCinemetaMeta(cinemetaType, item.imdbId.trim(), 4000);
            const candidatePoster = meta?.poster || meta?.background;
            if (candidatePoster && candidatePoster.startsWith('http') && !candidatePoster.includes('undefined')) {
              this.setCachedPoster(item, candidatePoster);
              return candidatePoster;
            }
          } catch {
            // Ignora erro do Cinemeta
          }
        }
      } catch (err) {
        console.warn(`[PosterRecoveryService] Erro na recuperação de imagem para ${item.title}:`, err);
      }

      // Registra que não há imagem disponível para esta obra para evitar requisições repetitivas
      this.markNoImageAvailable(item);
      return null;
    })().finally(() => {
      this.inFlight.delete(primaryKey);
    });

    this.inFlight.set(primaryKey, task);
    return task;
  }
}

export const posterRecoveryService = PosterRecoveryService.getInstance();
