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
 * - Integração com CatalogEligibilityService (disponibilidade real e sem títulos futuros).
 * - Sugestões rápidas para dropdown com debouncing controlado.
 */

import { ContentItem, ContentType, AppView, Profile, ActorPerson } from '../../../types';
import { tmdbService } from '../tmdb/tmdbClient';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { catalogReleaseStore } from '../catalog/CatalogReleaseStore';
import { adultContentService } from '../adult/AdultContentService';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';

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
  private actorCache = new Map<string, { timestamp: number; actors: ActorPerson[] }>();
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
   * Classificação canônica: item é anime (produção de animação japonesa)?
   * Abrange tanto animes seriados quanto longas-metragens/filmes de anime.
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
   * Classificação canônica: item é filme de anime (longa-metragem de anime japonês)?
   */
  public isAnimeMovieItem(item: ContentItem): boolean {
    if (!item || !this.isAnimeItem(item)) return false;
    return item.mediaFormat === 'movie';
  }

  /**
   * Classificação canônica: item é anime seriado (série de TV em anime)?
   */
  public isAnimeSeriesItem(item: ContentItem): boolean {
    if (!item || !this.isAnimeItem(item)) return false;
    return item.mediaFormat !== 'movie';
  }

  /**
   * Classificação canônica: item é filme?
   * Inclui filmes convencionais e longas-metragens de anime (filmes de anime).
   * Exclui terminantemente séries de TV e animes seriados.
   */
  public isMovieItem(item: ContentItem, includeAnimeMovies = false): boolean {
    if (!item) return false;
    const typeStr = String(item.type || '').toUpperCase();
    if ((item.type === ContentType.SERIES || typeStr === 'SERIES' || typeStr === 'SÉRIE' || typeStr === 'TV') && item.mediaFormat !== 'movie') return false;
    if (this.isAnimeItem(item)) {
      return includeAnimeMovies && item.mediaFormat === 'movie';
    }
    return item.type === ContentType.MOVIE || typeStr === 'MOVIE' || typeStr === 'FILME' || item.mediaFormat === 'movie';
  }

  /**
   * Classificação canônica: item é série de TV convencional (não anime)?
   * Exclui filmes e qualquer produção de anime.
   */
  public isSeriesItem(item: ContentItem): boolean {
    if (!item) return false;
    if (this.isAnimeItem(item)) return false;
    if (item.mediaFormat === 'movie') return false;
    const typeStr = String(item.type || '').toUpperCase();
    return item.type === ContentType.SERIES || typeStr === 'SERIES' || typeStr === 'SÉRIE' || typeStr === 'TV' || item.mediaFormat === 'series';
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
    localCatalog: ContentItem[] = [],
    userProfile?: Profile | null
  ): Promise<ContentItem[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      this.cancelPending();
      return [];
    }

    // Bloqueio absoluto para buscas ilegais ou exploração (Regra 5)
    if (adultContentService.isIllegalOrExploitative(trimmed)) {
      this.cancelPending();
      return [];
    }

    // Bloqueio irrestrito de conteúdos banidos (Big Buck Bunny, Caminandes, etc.)
    if (bannedContentRegistry.isBannedTitle(trimmed) || bannedContentRegistry.isBannedKeyOrId(trimmed)) {
      this.cancelPending();
      return [];
    }

    const availableTitles = localCatalog ? localCatalog.map(it => it.title) : [];
    const isIntentionalAdult = adultContentService.isIntentionalAdultSearch(trimmed, availableTitles);
    const isChildProfile = userProfile ? userProfile.isChild === true : false;
    // Conteúdos adultos só são liberados com busca intencional direta, sem ser perfil infantil e com maioridade confirmada (+18)
    const allowAdult = isIntentionalAdult && !isChildProfile && adultContentService.isAgeConfirmed();

    const normQuery = trimmed.toLowerCase();
    const cacheKey = `${category}:${normQuery}:${allowAdult ? 'adult' : 'safe'}`;
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

      // 4. Incorpora resultados locais e lançamentos aprovados compatíveis com a categoria
      const releases = catalogReleaseStore.getReleases();
      const combinedLocal = [...(localCatalog || []), ...releases];
      if (combinedLocal.length > 0) {
        const localMatches = this.filterLocalCatalog(trimmed, category, combinedLocal, userProfile);
        const existingTitles = new Set(rawResults.map(r => r.title.toLowerCase().trim()));
        for (const loc of localMatches) {
          if (!existingTitles.has(loc.title.toLowerCase().trim())) {
            rawResults.unshift(loc);
            existingTitles.add(loc.title.toLowerCase().trim());
          }
        }
      }

      // 5. Isolamento e filtragem de conteúdo adulto por padrão
      if (!allowAdult) {
        rawResults = rawResults.filter(it => !adultContentService.isAdultContent(it));
      }

      // 5.5 Eliminação estrita de conteúdos banidos (Big Buck Bunny, Caminandes, etc.)
      rawResults = bannedContentRegistry.filterCleanItems(rawResults);

      // 6. Filtro central de elegibilidade pública e reprodução real
      const eligible = catalogEligibilityService.filterEligibleItemsSync(rawResults, { allowAdult });

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
      const localFallback = this.filterLocalCatalog(trimmed, category, localCatalog, userProfile);
      return catalogEligibilityService.filterEligibleItemsSync(localFallback, { allowAdult });
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  }

  /**
   * Filtra o acervo local em memória respeitando rigorosamente a categoria e proteção adulta
   */
  public filterLocalCatalog(
    query: string, 
    category: SearchCategory, 
    items: ContentItem[],
    userProfile?: Profile | null
  ): ContentItem[] {
    if (!items || items.length === 0) return [];
    const norm = query.toLowerCase().trim();

    if (adultContentService.isIllegalOrExploitative(norm)) {
      return [];
    }

    const availableTitles = items.map(it => it.title);
    const isIntentionalAdult = adultContentService.isIntentionalAdultSearch(norm, availableTitles);
    const isChildProfile = userProfile ? userProfile.isChild === true : false;
    const allowAdult = isIntentionalAdult && !isChildProfile && adultContentService.isAgeConfirmed();

    return items.filter(item => {
      // Bloqueio irrestrito de conteúdos banidos
      if (bannedContentRegistry.isBanned(item)) {
        return false;
      }

      // Isolamento por padrão: oculta adultos se não for busca intencional autorizada
      const isAdult = adultContentService.isAdultContent(item);
      if (isAdult && !allowAdult) return false;

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
   * Pesquisa atores e atrizes com cache em memória
   */
  public async searchPersons(query: string, signal?: AbortSignal): Promise<ActorPerson[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const normKey = trimmed.toLowerCase();
    const now = Date.now();
    const cached = this.actorCache.get(normKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.actors;
    }

    const actors = await tmdbService.searchPersons(trimmed, signal);
    this.actorCache.set(normKey, { timestamp: now, actors });
    return actors;
  }

  /**
   * Fornece sugestões completas de busca contendo produções (filmes/séries) e pessoas (atores/atrizes)
   */
  public async getSearchSuggestionsWithActors(
    query: string,
    category: SearchCategory,
    limit = 6,
    localCatalog: ContentItem[] = []
  ): Promise<{ items: ContentItem[]; actors: ActorPerson[] }> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { items: [], actors: [] };
    }

    const [items, allActors] = await Promise.all([
      this.getSuggestions(trimmed, category, limit, localCatalog),
      this.searchPersons(trimmed)
    ]);

    // Retorna até 3 atores mais relevantes com foto e títulos conhecidos
    return {
      items,
      actors: allActors.slice(0, 3)
    };
  }

  /**
   * Limpa o cache de busca
   */
  public clearCache(): void {
    this.cache.clear();
    this.actorCache.clear();
  }
}

export const searchService = SearchService.getInstance();
