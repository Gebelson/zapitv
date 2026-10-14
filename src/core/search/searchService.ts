/**
 * ZAPITV — ADVANCED CONTEXTUAL SEARCH SERVICE
 * 
 * Governa a pesquisa do ZapiTV com filtros automáticos por categoria/página:
 * - Filmes: Exclusivamente filmes (não-anime), excluindo séries e animes.
 * - Séries: Exclusivamente séries de TV (não-anime), incluindo animações ocidentais e live-actions.
 * - Animes: Exclusivamente produções de anime japonês (séries e filmes de anime).
 * - Global / Home: Pesquisa aberta devidamente categorizada.
 * 
 * Recursos:
 * - Cancelamento automático de requisições pendentes (AbortController) ao mudar página ou termo.
 * - Cache contextual por (categoria + termo normalizado) com TTL de 10 minutos.
 * - Integração estrita com CatalogEligibilityService (disponibilidade real, sem CAM, sem títulos futuros).
 * - Sugestões rápidas para dropdown com debouncing controlado.
 */

import { ContentItem, ContentType, AppView } from '../../../types';
import { tmdbService } from '../tmdb/tmdbClient';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';

export type SearchCategory = 'all' | 'movies' | 'series' | 'animes' | 'live';

interface CacheEntry {
  timestamp: number;
  items: ContentItem[];
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

const KNOWN_ANIME_FRANCHISES = [
  /\bnaruto\b/i,
  /\bbleach\b/i,
  /\bone piece\b/i,
  /\bdragon ball\b|\bdragonball\b/i,
  /\bdeath note\b/i,
  /\bjujutsu kaisen\b/i,
  /\bdemon slayer\b|\bkimetsu no yaiba\b/i,
  /\bmy hero academia\b|\bboku no hero\b/i,
  /\battack on titan\b|\bshingeki no kyojin\b/i,
  /\bfullmetal alchemist\b/i,
  /\bhunter x hunter\b/i,
  /\btokyo ghoul\b/i,
  /\bfairy tail\b/i,
  /\bsword art online\b/i,
  /\bevangelion\b/i,
  /\bcowboy bebop\b/i,
  /\binuyasha\b/i,
  /\bsailor moon\b/i,
  /\byu yu hakusho\b/i,
  /\bsteins;gate\b/i,
  /\bcode geass\b/i,
  /\bchainsaw man\b/i,
  /\bspy x family\b/i,
  /\bsolo leveling\b/i,
  /\bblack clover\b/i,
  /\bvinland saga\b/i,
  /\bfrieren\b/i,
  /\bdungeon meshi\b/i,
  /\bmob psycho\b/i,
  /\bhaikyuu\b/i,
  /\bgintama\b/i,
  /\bberserk\b/i,
  /\bslam dunk\b/i,
  /\bakira\b/i,
  /\bchihiro\b|\bviagem de chihiro\b/i,
  /\btotoro\b/i,
  /\bprincesa mononoke\b/i,
  /\byour name\b|\bkimi no na wa\b/i,
  /\bsuzume\b/i,
  /\bweathering with you\b|\bo tempo com você\b/i,
  /\bboruto\b/i
];

const LIVE_ACTION_MARKERS = [
  /live[- ]action/i,
  /a série$/i,
  /: a série/i,
  /o filme \(live-action\)/i,
  /drama version/i,
  /podcast/i,
  /behind the scenes/i
];

class SearchService {
  private static instance: SearchService;
  private cache = new Map<string, CacheEntry>();
  private activeAbortController: AbortController | null = null;

  private constructor() {}

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Mapeia a visualização ativa (AppView) para a categoria de pesquisa
   */
  public mapAppViewToCategory(view: AppView): SearchCategory {
    switch (view) {
      case 'movies':
        return 'movies';
      case 'series':
        return 'series';
      case 'animes':
        return 'animes';
      case 'live':
        return 'live';
      default:
        return 'all';
    }
  }

  /**
   * Retorna o placeholder contextual para a barra de busca conforme Requisito 4
   */
  public getPlaceholder(category: SearchCategory): string {
    switch (category) {
      case 'movies':
        return 'Buscar filmes...';
      case 'series':
        return 'Buscar séries...';
      case 'animes':
        return 'Buscar animes...';
      case 'live':
        return 'Buscar canais e programas...';
      default:
        return 'Buscar filmes, séries e animes...';
    }
  }

  /**
   * Mensagem de vazio sem fallback forçado para outra categoria conforme Requisito 6
   */
  public getEmptyMessage(category: SearchCategory, query: string): { title: string; subtitle: string } {
    const cleanQuery = query.trim();
    switch (category) {
      case 'movies':
        return {
          title: 'Nenhum filme encontrado.',
          subtitle: `Não encontramos nenhum filme correspondente a "${cleanQuery}".`
        };
      case 'series':
        return {
          title: 'Nenhuma série encontrada.',
          subtitle: `Não encontramos nenhuma série correspondente a "${cleanQuery}".`
        };
      case 'animes':
        return {
          title: 'Nenhum anime encontrado.',
          subtitle: `Não encontramos nenhum anime correspondente a "${cleanQuery}".`
        };
      case 'live':
        return {
          title: 'Nenhum canal ou programa encontrado.',
          subtitle: `Não encontramos canais correspondentes a "${cleanQuery}".`
        };
      default:
        return {
          title: 'Nenhum resultado encontrado.',
          subtitle: `Não encontramos títulos correspondentes a "${cleanQuery}".`
        };
    }
  }

  /**
   * Classificação canônica: item é anime?
   */
  public isAnimeItem(item: ContentItem): boolean {
    if (!item || !item.title) return false;

    // Se tiver marcação explícita de live action, não é anime (é série ou filme convencional)
    const titleLower = item.title.toLowerCase();
    const isLive = LIVE_ACTION_MARKERS.some(m => m.test(titleLower));
    if (isLive) return false;

    if (item.type === ContentType.ANIME) return true;
    if (item.genres?.some(g => g.toLowerCase() === 'anime')) return true;

    // Se corresponder a uma franquia de anime conhecida
    if (KNOWN_ANIME_FRANCHISES.some(pat => pat.test(titleLower) || (item.originalTitle && pat.test(item.originalTitle)))) {
      return true;
    }

    return false;
  }

  /**
   * Classificação canônica: item é filme (não anime)?
   */
  public isMovieItem(item: ContentItem): boolean {
    if (!item) return false;
    if (this.isAnimeItem(item)) return false;
    return item.type === ContentType.MOVIE;
  }

  /**
   * Classificação canônica: item é série de TV convencional (não anime)?
   */
  public isSeriesItem(item: ContentItem): boolean {
    if (!item) return false;
    if (this.isAnimeItem(item)) return false;
    return item.type === ContentType.SERIES;
  }

  /**
   * Cancela quaisquer requisições de pesquisa pendentes
   */
  public cancelPending(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Executa a pesquisa contextual direcionada na origem (TMDB + Cinemeta)
   */
  public async search(
    query: string, 
    category: SearchCategory, 
    localCatalog: ContentItem[] = []
  ): Promise<ContentItem[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.cancelPending();
      return [];
    }

    const normQuery = trimmed.toLowerCase();
    const cacheKey = `${category}:${normQuery}`;
    const now = Date.now();

    // 1. Verifica cache em memória
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.items;
    }

    // 2. Cancela buscas anteriores em andamento
    this.cancelPending();
    const controller = new AbortController();
    this.activeAbortController = controller;

    try {
      let rawResults: ContentItem[] = [];

      // 3. Chamada direcionada na origem por categoria
      switch (category) {
        case 'movies': {
          rawResults = await tmdbService.searchMovies(trimmed, controller.signal);
          // Garante exclusão estrita de séries e animes
          rawResults = rawResults.filter(it => this.isMovieItem(it));
          break;
        }

        case 'series': {
          rawResults = await tmdbService.searchSeries(trimmed, controller.signal);
          // Garante exclusão estrita de filmes e animes
          rawResults = rawResults.filter(it => this.isSeriesItem(it));
          break;
        }

        case 'animes': {
          rawResults = await tmdbService.searchAnimes(trimmed, controller.signal);
          // Garante exclusão de live-actions e animações ocidentais
          rawResults = rawResults.filter(it => this.isAnimeItem(it));
          break;
        }

        case 'all':
        default: {
          rawResults = await tmdbService.searchMulti(trimmed);
          for (const item of rawResults) {
            if (this.isAnimeItem(item)) {
              item.type = ContentType.ANIME;
            }
          }
          break;
        }
      }

      // 4. Incorpora resultados locais relevantes compatíveis com a categoria
      if (localCatalog && localCatalog.length > 0) {
        const localMatches = this.filterLocalCatalog(trimmed, category, localCatalog);
        const existingTitles = new Set(rawResults.map(r => r.title.toLowerCase().trim()));
        for (const loc of localMatches) {
          if (!existingTitles.has(loc.title.toLowerCase().trim())) {
            rawResults.unshift(loc);
            existingTitles.add(loc.title.toLowerCase().trim());
          }
        }
      }

      // 5. Filtro central de elegibilidade pública e reprodução real
      const eligible = catalogEligibilityService.filterEligibleItemsSync(rawResults);

      // Salva no cache contextual
      this.cache.set(cacheKey, {
        timestamp: now,
        items: eligible
      });

      return eligible;
    } catch (e: any) {
      if (e?.name === 'AbortError' || controller.signal.aborted) {
        return [];
      }
      console.warn(`[SearchService] Erro na busca (${category}):`, e);
      // Fallback local estritamente dentro da categoria
      const localFallback = this.filterLocalCatalog(trimmed, category, localCatalog);
      return catalogEligibilityService.filterEligibleItemsSync(localFallback);
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  }

  /**
   * Filtra o acervo local em memória respeitando rigorosamente a categoria
   */
  public filterLocalCatalog(
    query: string, 
    category: SearchCategory, 
    items: ContentItem[]
  ): ContentItem[] {
    if (!items || items.length === 0) return [];
    const norm = query.toLowerCase().trim();

    return items.filter(item => {
      // 1. Match de texto
      const titleMatch = item.title?.toLowerCase().includes(norm) ||
        (item.originalTitle && item.originalTitle.toLowerCase().includes(norm));
      if (!titleMatch) return false;

      // 2. Filtro estrito de categoria
      switch (category) {
        case 'movies':
          return this.isMovieItem(item);
        case 'series':
          return this.isSeriesItem(item);
        case 'animes':
          return this.isAnimeItem(item);
        case 'all':
          return true;
        default:
          return true;
      }
    });
  }

  /**
   * Fornece sugestões rápidas para dropdown / autocomplete
   */
  public async getSuggestions(
    query: string, 
    category: SearchCategory, 
    limit = 6,
    localCatalog: ContentItem[] = []
  ): Promise<ContentItem[]> {
    const results = await this.search(query, category, localCatalog);
    return results.slice(0, limit);
  }

  /**
   * Limpa o cache de busca
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const searchService = SearchService.getInstance();
