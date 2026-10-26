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

export interface ResolvedHeroLogoMeta {
  url: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  lang?: string;
  source: 'tmdb' | 'custom' | 'cinemeta';
  resolvedAt: number;
}

export interface CanonicalProductionInfo {
  tmdbId: string;
  isMovie: boolean;
  originalLang?: string;
  canonicalTitle?: string;
  year?: number;
}

/**
 * Registro de produções canônicas de alta relevância (anime, séries e clássicos)
 * Previne ambiguidades críticas entre séries de anime vs filmes live-action,
 * versões ocidentais vs originais, e erros de busca genérica por texto.
 */
export const CANONICAL_PRODUCTIONS: Record<string, CanonicalProductionInfo> = {
  // Death Note (TV Anime 2006-2007) — Previne colisão com filmes de 2006/2017
  'death note': { tmdbId: '13916', isMovie: false, originalLang: 'ja', canonicalTitle: 'Death Note', year: 2006 },
  'anime-death-note': { tmdbId: '13916', isMovie: false, originalLang: 'ja', canonicalTitle: 'Death Note', year: 2006 },
  'tt0877057': { tmdbId: '13916', isMovie: false, originalLang: 'ja', canonicalTitle: 'Death Note', year: 2006 },
  'anime:anilist:1535': { tmdbId: '13916', isMovie: false, originalLang: 'ja', canonicalTitle: 'Death Note', year: 2006 },

  // Blue Lock / Em Busca de Glória (TV 2022-)
  'blue lock': { tmdbId: '131041', isMovie: false, originalLang: 'ja', canonicalTitle: 'Blue Lock', year: 2022 },
  'blue lock: em busca de glória': { tmdbId: '131041', isMovie: false, originalLang: 'ja', canonicalTitle: 'Blue Lock', year: 2022 },
  'blue lock / em busca de glória': { tmdbId: '131041', isMovie: false, originalLang: 'ja', canonicalTitle: 'Blue Lock', year: 2022 },
  'anime-blue-lock': { tmdbId: '131041', isMovie: false, originalLang: 'ja', canonicalTitle: 'Blue Lock', year: 2022 },
  'tt15233118': { tmdbId: '131041', isMovie: false, originalLang: 'ja', canonicalTitle: 'Blue Lock', year: 2022 },
  'anime:anilist:137822': { tmdbId: '131041', isMovie: false, originalLang: 'ja', canonicalTitle: 'Blue Lock', year: 2022 },
  'anime:anilist:163148': { tmdbId: '131041', isMovie: false, originalLang: 'ja', canonicalTitle: 'Blue Lock', year: 2022 },

  // Chainsaw Man (TV 2022-)
  'chainsaw man': { tmdbId: '114410', isMovie: false, originalLang: 'ja', canonicalTitle: 'Chainsaw Man', year: 2022 },
  'chainsawman': { tmdbId: '114410', isMovie: false, originalLang: 'ja', canonicalTitle: 'Chainsaw Man', year: 2022 },
  'o homem motosserra': { tmdbId: '114410', isMovie: false, originalLang: 'ja', canonicalTitle: 'Chainsaw Man', year: 2022 },
  'anime-chainsaw-man': { tmdbId: '114410', isMovie: false, originalLang: 'ja', canonicalTitle: 'Chainsaw Man', year: 2022 },
  'tt13616990': { tmdbId: '114410', isMovie: false, originalLang: 'ja', canonicalTitle: 'Chainsaw Man', year: 2022 },
  'anime:anilist:127230': { tmdbId: '114410', isMovie: false, originalLang: 'ja', canonicalTitle: 'Chainsaw Man', year: 2022 },

  // Dandadan / Dan Da Dan (TV 2024-)
  'dandadan': { tmdbId: '240411', isMovie: false, originalLang: 'ja', canonicalTitle: 'Dandadan', year: 2024 },
  'dan da dan': { tmdbId: '240411', isMovie: false, originalLang: 'ja', canonicalTitle: 'Dandadan', year: 2024 },
  'anime-dandadan': { tmdbId: '240411', isMovie: false, originalLang: 'ja', canonicalTitle: 'Dandadan', year: 2024 },
  'tt30217424': { tmdbId: '240411', isMovie: false, originalLang: 'ja', canonicalTitle: 'Dandadan', year: 2024 },
  'anime:anilist:171018': { tmdbId: '240411', isMovie: false, originalLang: 'ja', canonicalTitle: 'Dandadan', year: 2024 },

  // Solo Leveling
  'solo leveling': { tmdbId: '127532', isMovie: false, originalLang: 'ja', canonicalTitle: 'Solo Leveling', year: 2024 },
  'anime-solo-leveling': { tmdbId: '127532', isMovie: false, originalLang: 'ja', canonicalTitle: 'Solo Leveling', year: 2024 },
  'anime:anilist:151807': { tmdbId: '127532', isMovie: false, originalLang: 'ja', canonicalTitle: 'Solo Leveling', year: 2024 },

  // Jujutsu Kaisen
  'jujutsu kaisen': { tmdbId: '95479', isMovie: false, originalLang: 'ja', canonicalTitle: 'Jujutsu Kaisen', year: 2020 },
  'anime-jujutsu-kaisen': { tmdbId: '95479', isMovie: false, originalLang: 'ja', canonicalTitle: 'Jujutsu Kaisen', year: 2020 },
  'anime:anilist:113415': { tmdbId: '95479', isMovie: false, originalLang: 'ja', canonicalTitle: 'Jujutsu Kaisen', year: 2020 },

  // Frieren
  "frieren: beyond journey's end": { tmdbId: '209867', isMovie: false, originalLang: 'ja', canonicalTitle: 'Frieren', year: 2023 },
  'frieren': { tmdbId: '209867', isMovie: false, originalLang: 'ja', canonicalTitle: 'Frieren', year: 2023 },
  'anime-frieren': { tmdbId: '209867', isMovie: false, originalLang: 'ja', canonicalTitle: 'Frieren', year: 2023 },
  'anime:anilist:154587': { tmdbId: '209867', isMovie: false, originalLang: 'ja', canonicalTitle: 'Frieren', year: 2023 },

  // Breaking Bad
  'breaking bad': { tmdbId: '1396', isMovie: false, originalLang: 'en', canonicalTitle: 'Breaking Bad', year: 2008 },
  'series-breaking-bad-2008': { tmdbId: '1396', isMovie: false, originalLang: 'en', canonicalTitle: 'Breaking Bad', year: 2008 },
  'tt0903747': { tmdbId: '1396', isMovie: false, originalLang: 'en', canonicalTitle: 'Breaking Bad', year: 2008 },

  // Verdade Oculta / Disclaimer
  'verdade oculta': { tmdbId: '138502', isMovie: false, originalLang: 'en', canonicalTitle: 'Disclaimer', year: 2024 },
  'disclaimer': { tmdbId: '138502', isMovie: false, originalLang: 'en', canonicalTitle: 'Disclaimer', year: 2024 },
  'series-verdade-oculta-2024': { tmdbId: '138502', isMovie: false, originalLang: 'en', canonicalTitle: 'Disclaimer', year: 2024 },
  'tt16294384': { tmdbId: '138502', isMovie: false, originalLang: 'en', canonicalTitle: 'Disclaimer', year: 2024 },

  // Verity (2026)
  'verity': { tmdbId: '1283515', isMovie: true, originalLang: 'en', canonicalTitle: 'Verity', year: 2026 },
  'movie-verity-2026': { tmdbId: '1283515', isMovie: true, originalLang: 'en', canonicalTitle: 'Verity', year: 2026 },
  'tt32261958': { tmdbId: '1283515', isMovie: true, originalLang: 'en', canonicalTitle: 'Verity', year: 2026 },

  // Digger (2026)
  'digger': { tmdbId: '1288289', isMovie: true, originalLang: 'en', canonicalTitle: 'Digger', year: 2026 },
  'movie-digger-2026': { tmdbId: '1288289', isMovie: true, originalLang: 'en', canonicalTitle: 'Digger', year: 2026 },
  'tt31454558': { tmdbId: '1288289', isMovie: true, originalLang: 'en', canonicalTitle: 'Digger', year: 2026 }
};

class HeroLogoService {
  private static instance: HeroLogoService;
  private metaCache = new Map<string, ResolvedHeroLogoMeta | null>();
  private logoCacheLegacy = new Map<string, string | null>(); // Fallback de compatibilidade
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
    this.metaCache.clear();
    this.logoCacheLegacy.clear();
    this.failedLogoUrls.clear();
    this.inFlightResolutions.clear();
    this.inFlightPreloads.clear();
  }

  /**
   * Constrói a chave canônica única do cache considerando identificadores e tipo de mídia
   */
  public getCacheKey(item: ContentItem): string {
    const isMovie = item.type === ContentType.MOVIE || item.mediaFormat === 'movie';
    const mediaType = isMovie ? 'movie' : 'tv';
    const primaryId = item.canonicalId || item.id;
    const tmdbPart = item.tmdbId ? `tmdb:${item.tmdbId}` : '';
    const imdbPart = item.imdbId ? `imdb:${item.imdbId}` : '';
    return `${primaryId}:${mediaType}:${tmdbPart}:${imdbPart}`;
  }

  /**
   * Retorna a logo sincronizada se já estiver em cache
   */
  public getResolvedLogoSync(item: ContentItem | null | undefined): string | null | undefined {
    if (!item?.id) return undefined;
    const key = this.getCacheKey(item);
    if (this.metaCache.has(key)) {
      const meta = this.metaCache.get(key);
      return meta ? meta.url : null;
    }
    return this.logoCacheLegacy.get(item.id);
  }

  /**
   * Retorna os metadados ricos da logo sincronizados (aspectRatio, dimensões, idioma)
   */
  public getResolvedLogoMetaSync(item: ContentItem | null | undefined): ResolvedHeroLogoMeta | null | undefined {
    if (!item?.id) return undefined;
    const key = this.getCacheKey(item);
    return this.metaCache.get(key);
  }

  /**
   * Marca uma URL de logo como falha (ex: onError no elemento <img>)
   */
  public markLogoFailed(url: string | null | undefined): void {
    if (!url || typeof url !== 'string') return;
    const clean = url.trim();
    if (clean) {
      this.failedLogoUrls.add(clean);
      for (const [key, meta] of this.metaCache.entries()) {
        if (meta?.url === clean) {
          this.metaCache.set(key, null);
        }
      }
      for (const [id, cachedUrl] of this.logoCacheLegacy.entries()) {
        if (cachedUrl === clean) {
          this.logoCacheLegacy.set(id, null);
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
   * Extrai o ID numérico do TMDB para uma obra validando contra produções canônicas
   */
  public extractTmdbId(item: ContentItem): { id: string | null; isMovie: boolean; originalLang?: string } {
    const isMovie = item.type === ContentType.MOVIE || item.mediaFormat === 'movie';

    // 1. Tenta consulta ao mapa de produções canônicas verificadas
    const candidateKeys = [
      item.canonicalId?.toLowerCase(),
      item.id?.toLowerCase(),
      item.imdbId?.toLowerCase(),
      item.title?.toLowerCase().trim(),
      item.originalTitle?.toLowerCase().trim()
    ].filter(Boolean) as string[];

    for (const key of candidateKeys) {
      if (CANONICAL_PRODUCTIONS[key]) {
        const entry = CANONICAL_PRODUCTIONS[key];
        return { id: entry.tmdbId, isMovie: entry.isMovie, originalLang: entry.originalLang };
      }
    }

    // 2. Extrai de item.tmdbId se numérico
    if (item.tmdbId) {
      const clean = String(item.tmdbId).replace(/^tmdb-?/i, '').trim();
      if (/^\d+$/.test(clean)) {
        return { id: clean, isMovie, originalLang: item.originalLanguage };
      }
    }

    // 3. Extrai de item.canonicalId com formato tmdb:movie:123 ou tmdb:tv:123
    if (typeof item.canonicalId === 'string') {
      const m = item.canonicalId.match(/tmdb:(movie|series|tv):(\d+)/i);
      if (m) {
        return { id: m[2], isMovie: m[1].toLowerCase() === 'movie', originalLang: item.originalLanguage };
      }
    }

    // 4. Se o próprio item.id for numérico ou prefixado por tmdb
    if (typeof item.id === 'string' && /^tmdb-?\d+$/i.test(item.id)) {
      const clean = item.id.replace(/^tmdb-?/i, '').trim();
      return { id: clean, isMovie, originalLang: item.originalLanguage };
    }

    return { id: null, isMovie, originalLang: item.originalLanguage };
  }

  /**
   * Busca o TMDB ID a partir do IMDb ID via endpoint /find respeitando o tipo de mídia e desambiguando por ano
   */
  private async findTmdbByImdb(
    imdbId: string,
    isMovieTarget: boolean,
    expectedYear?: number,
    signal?: AbortSignal
  ): Promise<{ id: string; isMovie: boolean } | null> {
    const cleanImdb = imdbId.trim();
    if (!cleanImdb.startsWith('tt')) return null;

    try {
      const url = `${TMDB_BASE_URL}/find/${cleanImdb}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const data = await res.json();

      const movieResults = data.movie_results || [];
      const tvResults = data.tv_results || [];

      // Ordem prioritária de busca de acordo com o tipo de mídia
      const lists = isMovieTarget 
        ? [{ list: movieResults, isMovie: true }, { list: tvResults, isMovie: false }]
        : [{ list: tvResults, isMovie: false }, { list: movieResults, isMovie: true }];

      for (const { list, isMovie } of lists) {
        if (list.length > 0) {
          if (expectedYear) {
            const matchYear = list.find((entry: any) => {
              const dateStr = entry.release_date || entry.first_air_date || '';
              const y = parseInt(dateStr.slice(0, 4), 10);
              return !isNaN(y) && Math.abs(y - expectedYear) <= 2;
            });
            if (matchYear) {
              return { id: String(matchYear.id), isMovie };
            }
          }
          return { id: String(list[0].id), isMovie };
        }
      }
    } catch {}
    return null;
  }

  /**
   * Busca no TMDB por nome e ano com validação estrita de identidade
   */
  private async findTmdbBySearch(
    title: string,
    isMovie: boolean,
    expectedYear?: number,
    signal?: AbortSignal
  ): Promise<{ id: string; isMovie: boolean } | null> {
    const cleanTitle = title.trim();
    if (!cleanTitle) return null;

    try {
      const endpoint = isMovie ? '/search/movie' : '/search/tv';
      const yearQuery = expectedYear ? (isMovie ? `&year=${expectedYear}` : `&first_air_date_year=${expectedYear}`) : '';
      const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}&include_adult=false${yearQuery}`;

      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const data = await res.json();
      const results = data.results || [];
      if (results.length === 0) return null;

      // Validação estrita: não aceita qualquer resultado
      const normalizedTitle = cleanTitle.toLowerCase().replace(/[:\-_]/g, ' ').replace(/\s+/g, ' ').trim();

      for (const cand of results) {
        const candTitle = (cand.title || cand.name || '').toLowerCase().replace(/[:\-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const candOrig = (cand.original_title || cand.original_name || '').toLowerCase().replace(/[:\-_]/g, ' ').replace(/\s+/g, ' ').trim();

        const titleMatches = candTitle === normalizedTitle || candOrig === normalizedTitle ||
          candTitle.includes(normalizedTitle) || normalizedTitle.includes(candTitle);

        if (titleMatches) {
          if (expectedYear) {
            const dateStr = cand.release_date || cand.first_air_date || '';
            const y = parseInt(dateStr.slice(0, 4), 10);
            if (!isNaN(y) && Math.abs(y - expectedYear) <= 1) {
              return { id: String(cand.id), isMovie };
            }
          } else {
            return { id: String(cand.id), isMovie };
          }
        }
      }
    } catch {}
    return null;
  }

  /**
   * Ordena os logos retornados pelo TMDB por prioridade rigorosa de idioma e qualidade:
   * 1º Logo oficial brasileira (PT-BR / pt)
   * 2º Logo oficial do idioma original (se existir e for legível/qualidade adequada)
   * 3º Logo oficial internacional em inglês (en)
   * 4º Outra logo oficial comprovadamente correspondente
   */
  public sortTmdbLogos(logos: TMDBRawLogo[], originalLang?: string): TMDBRawLogo[] {
    if (!Array.isArray(logos) || logos.length === 0) return [];

    const getLangTier = (logo: TMDBRawLogo): number => {
      const lang = (logo.iso_639_1 || '').toLowerCase();
      // 1. Logo oficial brasileira (PT-BR)
      if (lang === 'pt' || lang === 'pt-br') return 1;

      // Verificação de qualidade da arte
      const isTooSmall = (logo.width || 0) > 0 && (logo.width || 0) < 600;
      const isVeryLowRes = (logo.height || 0) > 0 && (logo.height || 0) < 40;
      const isLowQuality = isTooSmall || isVeryLowRes;

      // 2. Logo oficial do idioma original
      if (originalLang && lang === originalLang.toLowerCase()) {
        return isLowQuality ? 3.5 : 2;
      }

      // 3. Logo oficial internacional em inglês
      if (lang === 'en') {
        return isLowQuality ? 4.5 : 3;
      }

      // 4. Outra logo oficial comprovadamente correspondente
      if (!lang || lang === 'xx') return 4;
      return 5;
    };

    return [...logos].sort((a, b) => {
      const tierA = getLangTier(a);
      const tierB = getLangTier(b);
      if (tierA !== tierB) return tierA - tierB;

      // Desempate por avaliação e votos
      const scoreA = (a.vote_average || 0) * 10 + Math.min(10, a.vote_count || 0);
      const scoreB = (b.vote_average || 0) * 10 + Math.min(10, b.vote_count || 0);
      if (scoreA !== scoreB) return scoreB - scoreA;

      // Desempate por resolução total
      const resA = (a.width || 0) * (a.height || 0);
      const resB = (b.width || 0) * (b.height || 0);
      return resB - resA;
    });
  }

  /**
   * Resolve a logo oficial para uma obra, com cache, validação canônica e fallbacks transparentes
   */
  public async resolveLogoForItem(
    item: ContentItem | null | undefined,
    signal?: AbortSignal
  ): Promise<string | null> {
    if (!item?.id) return null;

    const cacheKey = this.getCacheKey(item);

    // 1. Verifica cache em memória
    if (this.metaCache.has(cacheKey)) {
      const meta = this.metaCache.get(cacheKey);
      if (meta && meta.url && !this.failedLogoUrls.has(meta.url)) {
        return meta.url;
      }
    }

    // 2. Deduplicação de requisições simultâneas em voo
    if (this.inFlightResolutions.has(cacheKey)) {
      return this.inFlightResolutions.get(cacheKey)!;
    }

    const resolutionPromise = (async (): Promise<string | null> => {
      try {
        // Obtém o TMDB ID e o tipo canônico
        let { id: tmdbId, isMovie, originalLang } = this.extractTmdbId(item);

        // Se não tiver TMDB ID direto, busca por IMDb ID respeitando o tipo de mídia
        if (!tmdbId && item.imdbId) {
          const found = await this.findTmdbByImdb(item.imdbId, isMovie, item.year, signal);
          if (found) {
            tmdbId = found.id;
            isMovie = found.isMovie;
          }
        }

        // Se ainda não tiver, busca por título e ano
        if (!tmdbId && (item.originalTitle || item.title)) {
          const queryTitle = item.originalTitle || item.title;
          const found = await this.findTmdbBySearch(queryTitle, isMovie, item.year, signal);
          if (found) {
            tmdbId = found.id;
            isMovie = found.isMovie;
          }
        }

        // Se identificou a produção no TMDB, busca os logos oficiais
        if (tmdbId) {
          const endpoint = isMovie ? `/movie/${tmdbId}/images` : `/tv/${tmdbId}/images`;
          const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&include_image_language=pt,en,null,ja,es,fr,de,ko`;

          const res = await fetch(url, { signal });
          if (res.ok) {
            const data = await res.json();
            const logos: TMDBRawLogo[] = data.logos || [];

            if (logos.length > 0) {
              const origLang = originalLang || item.originalLanguage || (item.type === ContentType.ANIME ? 'ja' : 'en');
              const sorted = this.sortTmdbLogos(logos, origLang);

              for (const logo of sorted) {
                if (signal?.aborted) break;
                if (!logo.file_path) continue;
                const candidateUrl = `${TMDB_IMAGE_BASE}${logo.file_path}`;
                if (this.failedLogoUrls.has(candidateUrl)) continue;

                const valid = await this.validateAndPreloadLogo(candidateUrl, 3500, signal);
                if (valid) {
                  const meta: ResolvedHeroLogoMeta = {
                    url: candidateUrl,
                    width: logo.width,
                    height: logo.height,
                    aspectRatio: logo.aspect_ratio || (logo.width && logo.height ? logo.width / logo.height : undefined),
                    lang: logo.iso_639_1 || undefined,
                    source: 'tmdb',
                    resolvedAt: Date.now()
                  };
                  this.metaCache.set(cacheKey, meta);
                  this.logoCacheLegacy.set(item.id, candidateUrl);
                  return candidateUrl;
                }
              }
            }
          }
        }

        // Fallback secundário: Cinemeta Logo por IMDb ID (somente se TMDB não tiver logos oficiais)
        if (item.imdbId && item.imdbId.startsWith('tt')) {
          const cinemetaLogo = `https://images.metahub.space/logo/medium/${item.imdbId}/img`;
          if (!this.failedLogoUrls.has(cinemetaLogo)) {
            const ok = await this.validateAndPreloadLogo(cinemetaLogo, 3000, signal);
            if (ok) {
              const meta: ResolvedHeroLogoMeta = {
                url: cinemetaLogo,
                source: 'cinemeta',
                resolvedAt: Date.now()
              };
              this.metaCache.set(cacheKey, meta);
              this.logoCacheLegacy.set(item.id, cinemetaLogo);
              return cinemetaLogo;
            }
          }
        }

        // Fallback terciário: item.logo pré-definido se válido
        if (item.logo && typeof item.logo === 'string') {
          const cleanItemLogo = item.logo.trim();
          if (cleanItemLogo && !this.failedLogoUrls.has(cleanItemLogo)) {
            const ok = await this.validateAndPreloadLogo(cleanItemLogo, 3500, signal);
            if (ok) {
              const meta: ResolvedHeroLogoMeta = {
                url: cleanItemLogo,
                source: 'custom',
                resolvedAt: Date.now()
              };
              this.metaCache.set(cacheKey, meta);
              this.logoCacheLegacy.set(item.id, cleanItemLogo);
              return cleanItemLogo;
            }
          }
        }

        // Nenhum logo confiável disponível: armazena null para evitar novas consultas repetidas
        this.metaCache.set(cacheKey, null);
        this.logoCacheLegacy.set(item.id, null);
        return null;
      } catch {
        return null;
      } finally {
        this.inFlightResolutions.delete(cacheKey);
      }
    })();

    this.inFlightResolutions.set(cacheKey, resolutionPromise);
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
