import { ContentItem, ContentType } from '../../../types';
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE } from '../tmdb/tmdbClient';

export interface TMDBRawLogo {
  file_path: string;
  iso_639_1?: string | null;
  iso_3166_1?: string | null;
  vote_average?: number;
  vote_count?: number;
  width?: number;
  height?: number;
  aspect_ratio?: number;
}

class HeroLogoService {
  private static instance: HeroLogoService;
  private logoCache = new Map<string, string | null>(); // itemId -> logoUrl | null
  private failedLogoUrls = new Set<string>();
  private inFlightResolutions = new Map<string, Promise<string | null>>();
  private inFlightPreloads = new Map<string, Promise<boolean>>();

  private constructor() {}

  public static getInstance(): HeroLogoService {
    if (!HeroLogoService.instance) {
      HeroLogoService.instance = new HeroLogoService();
    }
    return HeroLogoService.instance;
  }

  /**
   * Limpa os caches em memória (útil para testes ou reinicialização)
   */
  public clearCache(): void {
    this.logoCache.clear();
    this.failedLogoUrls.clear();
    this.inFlightResolutions.clear();
    this.inFlightPreloads.clear();
  }

  /**
   * Retorna a logo sincronizada se já estiver em cache
   */
  public getResolvedLogoSync(item: ContentItem | null | undefined): string | null | undefined {
    if (!item?.id) return undefined;
    return this.logoCache.get(item.id);
  }

  /**
   * Marca uma URL de logo como falha (ex: onError no elemento <img>)
   */
  public markLogoFailed(url: string | null | undefined): void {
    if (!url || typeof url !== 'string') return;
    const clean = url.trim();
    if (clean) {
      this.failedLogoUrls.add(clean);
      // Remove do cache de itens para não reutilizar a URL falha
      for (const [id, cachedUrl] of this.logoCache.entries()) {
        if (cachedUrl === clean) {
          this.logoCache.set(id, null);
        }
      }
    }
  }

  /**
   * Valida e pré-carrega uma imagem de logo
   */
  public async validateAndPreloadLogo(
    url: string,
    timeoutMs = 4000,
    signal?: AbortSignal
  ): Promise<boolean> {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.trim();
    if (!cleanUrl || this.failedLogoUrls.has(cleanUrl)) return false;

    // Em ambiente Node.js / testes unitários sem DOM Image
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      return true;
    }

    if (this.inFlightPreloads.has(cleanUrl)) {
      return this.inFlightPreloads.get(cleanUrl)!;
    }

    const promise = new Promise<boolean>((resolve) => {
      let timer: NodeJS.Timeout | null = null;
      let finished = false;

      const finish = (result: boolean) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (!result) {
          this.failedLogoUrls.add(cleanUrl);
        }
        resolve(result);
      };

      const onAbort = () => finish(false);

      if (signal) {
        if (signal.aborted) {
          finish(false);
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      timer = setTimeout(() => finish(false), timeoutMs);

      const img = new Image();
      img.onload = async () => {
        if (img.naturalWidth <= 10 || img.naturalHeight <= 5) {
          finish(false);
          return;
        }
        if ('decode' in img && typeof img.decode === 'function') {
          try {
            await img.decode();
          } catch {}
        }
        finish(true);
      };
      img.onerror = () => finish(false);
      img.src = cleanUrl;
    }).finally(() => {
      this.inFlightPreloads.delete(cleanUrl);
    });

    this.inFlightPreloads.set(cleanUrl, promise);
    return promise;
  }

  /**
   * Extrai o ID numérico do TMDB para uma obra
   */
  private extractTmdbId(item: ContentItem): { id: string | null; isMovie: boolean } {
    const isMovie = item.type === ContentType.MOVIE || item.mediaFormat === 'movie';
    if (item.tmdbId) {
      const clean = String(item.tmdbId).replace(/^tmdb-?/i, '').trim();
      if (/^\d+$/.test(clean)) {
        return { id: clean, isMovie };
      }
    }

    // Se o próprio item.id for numérico ou prefixado por tmdb
    if (typeof item.id === 'string' && /^tmdb-?\d+$/i.test(item.id)) {
      const clean = item.id.replace(/^tmdb-?/i, '').trim();
      return { id: clean, isMovie };
    }

    return { id: null, isMovie };
  }

  /**
   * Busca o TMDB ID a partir do IMDb ID via endpoint /find
   */
  private async findTmdbByImdb(imdbId: string, signal?: AbortSignal): Promise<{ id: string; isMovie: boolean } | null> {
    const cleanImdb = imdbId.trim();
    if (!cleanImdb.startsWith('tt')) return null;

    try {
      const url = `${TMDB_BASE_URL}/find/${cleanImdb}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const data = await res.json();

      if (data.movie_results && data.movie_results.length > 0) {
        return { id: String(data.movie_results[0].id), isMovie: true };
      }
      if (data.tv_results && data.tv_results.length > 0) {
        return { id: String(data.tv_results[0].id), isMovie: false };
      }
    } catch {}
    return null;
  }

  /**
   * Ordena os logos retornados pelo TMDB por prioridade de idioma e popularidade
   * 1º Português (pt / pt-BR)
   * 2º Idioma original ou inglês (en)
   * 3º Sem idioma (null / neutro)
   * 4º Outros idiomas
   */
  public sortTmdbLogos(logos: TMDBRawLogo[], originalLang?: string): TMDBRawLogo[] {
    if (!Array.isArray(logos) || logos.length === 0) return [];

    const getLangTier = (logo: TMDBRawLogo): number => {
      const lang = (logo.iso_639_1 || '').toLowerCase();
      if (lang === 'pt') return 1;
      if (originalLang && lang === originalLang.toLowerCase()) return 2;
      if (lang === 'en') return 3;
      if (!lang || lang === 'xx') return 4;
      return 5;
    };

    return [...logos].sort((a, b) => {
      const tierA = getLangTier(a);
      const tierB = getLangTier(b);
      if (tierA !== tierB) return tierA - tierB;

      // Desempate por avaliação / votos
      const votesA = (a.vote_average || 0) * 10 + (a.vote_count || 0);
      const votesB = (b.vote_average || 0) * 10 + (b.vote_count || 0);
      return votesB - votesA;
    });
  }

  /**
   * Resolve a logo oficial para uma obra, com cache, priorização PT-BR e fallbacks transparentes
   */
  public async resolveLogoForItem(
    item: ContentItem | null | undefined,
    signal?: AbortSignal
  ): Promise<string | null> {
    if (!item?.id) return null;

    // 1. Verifica cache em memória
    if (this.logoCache.has(item.id)) {
      const cached = this.logoCache.get(item.id)!;
      if (cached && !this.failedLogoUrls.has(cached)) {
        return cached;
      }
    }

    // 2. Deduplicação de requisições simultâneas em voo
    if (this.inFlightResolutions.has(item.id)) {
      return this.inFlightResolutions.get(item.id)!;
    }

    const resolutionPromise = (async (): Promise<string | null> => {
      try {
        // Se o próprio item já traz uma logo oficial pré-definida
        if (item.logo && typeof item.logo === 'string') {
          const cleanItemLogo = item.logo.trim();
          if (cleanItemLogo && !this.failedLogoUrls.has(cleanItemLogo)) {
            const ok = await this.validateAndPreloadLogo(cleanItemLogo, 3500, signal);
            if (ok) {
              this.logoCache.set(item.id, cleanItemLogo);
              return cleanItemLogo;
            }
          }
        }

        // Obtém o TMDB ID
        let { id: tmdbId, isMovie } = this.extractTmdbId(item);

        if (!tmdbId && item.imdbId) {
          const found = await this.findTmdbByImdb(item.imdbId, signal);
          if (found) {
            tmdbId = found.id;
            isMovie = found.isMovie;
          }
        }

        if (tmdbId) {
          const endpoint = isMovie ? `/movie/${tmdbId}/images` : `/tv/${tmdbId}/images`;
          const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&include_image_language=pt,en,null,ja,es,fr,de,ko`;

          const res = await fetch(url, { signal });
          if (res.ok) {
            const data = await res.json();
            const logos: TMDBRawLogo[] = data.logos || [];

            if (logos.length > 0) {
              const origLang = item.originalLanguage || (item.type === ContentType.ANIME ? 'ja' : 'en');
              const sorted = this.sortTmdbLogos(logos, origLang);

              for (const logo of sorted) {
                if (signal?.aborted) break;
                if (!logo.file_path) continue;
                // Constrói URL oficial do TMDB em w500 (resolução ideal e nítida para telas mobile)
                const candidateUrl = `${TMDB_IMAGE_BASE}${logo.file_path}`;
                if (this.failedLogoUrls.has(candidateUrl)) continue;

                const valid = await this.validateAndPreloadLogo(candidateUrl, 3500, signal);
                if (valid) {
                  this.logoCache.set(item.id, candidateUrl);
                  return candidateUrl;
                }
              }
            }
          }
        }

        // Fallback secundário: Cinemeta Logo por IMDb ID
        if (item.imdbId && item.imdbId.startsWith('tt')) {
          const cinemetaLogo = `https://images.metahub.space/logo/medium/${item.imdbId}/img`;
          if (!this.failedLogoUrls.has(cinemetaLogo)) {
            const ok = await this.validateAndPreloadLogo(cinemetaLogo, 3000, signal);
            if (ok) {
              this.logoCache.set(item.id, cinemetaLogo);
              return cinemetaLogo;
            }
          }
        }

        // Nenhum logo disponível: armazena null para evitar novas consultas repetidas
        this.logoCache.set(item.id, null);
        return null;
      } catch {
        return null;
      } finally {
        this.inFlightResolutions.delete(item.id);
      }
    })();

    this.inFlightResolutions.set(item.id, resolutionPromise);
    return resolutionPromise;
  }

  /**
   * Pré-carrega antecipadamente em segundo plano a logo do próximo item
   */
  public preloadLogoForItem(item: ContentItem | null | undefined): void {
    if (!item?.id) return;
    this.resolveLogoForItem(item).catch(() => {});
  }
}

export const heroLogoService = HeroLogoService.getInstance();
