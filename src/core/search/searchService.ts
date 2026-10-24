/**
 * ZAPITV — ADVANCED CONTEXTUAL SEARCH SERVICE
 * 
 * Governa a pesquisa do ZapiTV com filtros automáticos por categoria/página:
 * - Filmes: Exclusivamente filmes (não-anime), incluindo longas de animação ocidentais.
 * - Séries: Exclusivamente séries de TV (não-anime), incluindo animações ocidentais e live-actions.
 * - Animes: Exclusivamente produções de anime japonês (séries e filmes de anime).
 * - Global / Home: Pesquisa aberta devidamente categorizada.
 * 
 * Recursos de Alta Performance e Responsividade:
 * - Pesquisa local instantânea em memória via LocalSearchIndexService (< 5ms).
 * - Desacoplamento total entre resultados locais e consultas de rede em segundo plano.
 * - Cancelamento independente por contexto (Header vs Página de Resultados vs Atores).
 * - Versionamento de requisições para descarte atômico de respostas obsoletas.
 * - Integração contínua com CatalogEligibilityService, sem títulos futuros e sem camrips.
 * - Emissão progressiva de resultados parciais para eliminação de telas de espera.
 */

import { ContentItem, ContentType, AppView, Profile, ActorPerson } from '../../../types';
import { tmdbService } from '../tmdb/tmdbClient';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { catalogReleaseStore } from '../catalog/CatalogReleaseStore';
import { adultContentService } from '../adult/AdultContentService';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';
import { LruCache } from '../cache/LruCache';
import { aniListClient } from '../anilist/aniListClient';
import { canonicalCatalogMaster } from '../catalog/CanonicalCatalogMaster';
import { localSearchIndexService } from './localSearchIndexService';

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
  private cache = new LruCache<string, CacheEntry>(60, CACHE_TTL_MS);
  private actorCache = new LruCache<string, { timestamp: number; actors: ActorPerson[] }>(60, CACHE_TTL_MS);

  // Controladores de cancelamento isolados para evitar interferência entre operações
  private headerController: AbortController | null = null;
  private pageSearchController: AbortController | null = null;
  private actorController: AbortController | null = null;

  // Identificadores de versão para descartar respostas de requisições obsoletas
  private headerSearchVersion = 0;
  private pageSearchVersion = 0;

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
   */
  public isAnimeItem(item: ContentItem): boolean {
    if (!item || !item.title) return false;

    // Se tiver marcação explícita de live action, não é anime
    const titleLower = item.title.toLowerCase();
    const isLive = LIVE_ACTION_MARKERS.some(m => m.test(titleLower));
    if (isLive) return false;

    if (item.type === ContentType.ANIME) return true;
    if (item.genres?.some(g => g.toLowerCase() === 'anime')) return true;

    if (KNOWN_ANIME_FRANCHISES.some(pat => pat.test(titleLower) || (item.originalTitle && pat.test(item.originalTitle)))) {
      return true;
    }

    return false;
  }

  /**
   * Classificação canônica: item é filme de anime?
   */
  public isAnimeMovieItem(item: ContentItem): boolean {
    if (!item || !this.isAnimeItem(item)) return false;
    return item.mediaFormat === 'movie';
  }

  /**
   * Classificação canônica: item é anime seriado?
   */
  public isAnimeSeriesItem(item: ContentItem): boolean {
    if (!item || !this.isAnimeItem(item)) return false;
    return item.mediaFormat !== 'movie';
  }

  /**
   * Classificação canônica: item é filme?
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
   * Classificação canônica: item é série de TV convencional?
   */
  public isSeriesItem(item: ContentItem): boolean {
    if (!item) return false;
    if (this.isAnimeItem(item)) return false;
    if (item.mediaFormat === 'movie') return false;
    const typeStr = String(item.type || '').toUpperCase();
    return item.type === ContentType.SERIES || typeStr === 'SERIES' || typeStr === 'SÉRIE' || typeStr === 'TV' || item.mediaFormat === 'series';
  }

  // ============================================================================
  // CANCELAMENTO E CONTROLE DE REQUISIÇÕES INDEPENDENTES
  // ============================================================================

  /**
   * Cancela apenas requisições em segundo plano de sugestões do Header
   */
  public cancelHeaderSuggestions(): void {
    if (this.headerController) {
      this.headerController.abort();
      this.headerController = null;
    }
    if (this.actorController) {
      this.actorController.abort();
      this.actorController = null;
    }
    this.headerSearchVersion++;
  }

  /**
   * Cancela apenas requisições da página principal de resultados
   */
  public cancelPageSearch(): void {
    if (this.pageSearchController) {
      this.pageSearchController.abort();
      this.pageSearchController = null;
    }
    this.pageSearchVersion++;
  }

  /**
   * Cancela todas as requisições de busca pendentes (ex: ao mudar de página ou rota)
   */
  public cancelPending(): void {
    this.cancelHeaderSuggestions();
    this.cancelPageSearch();
  }

  // ============================================================================
  // BUSCA LOCAL INSTANTÂNEA EM MEMÓRIA (< 5ms)
  // ============================================================================

  /**
   * Executa busca local instantânea em memória usando o índice indexado.
   * Não dispara nenhuma requisição de rede e responde imediatamente à digitação.
   */
  public searchLocalInstant(
    query: string,
    category: SearchCategory,
    localCatalog: ContentItem[] = [],
    userProfile?: Profile | null,
    limit = 6
  ): ContentItem[] {
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) return [];

    // Inclui lançamentos aprovados no catálogo local para busca imediata
    const releases = catalogReleaseStore.getReleases();
    const allLocal = releases.length > 0 ? [...localCatalog, ...releases] : localCatalog;

    localSearchIndexService.syncCatalog(allLocal);

    return localSearchIndexService.searchInstant(trimmed, category, {
      limit,
      userProfile,
      isMovieCheck: it => this.isMovieItem(it),
      isSeriesCheck: it => this.isSeriesItem(it),
      isAnimeCheck: it => this.isAnimeItem(it)
    });
  }

  // ============================================================================
  // BUSCA REMOTA EM SEGUNDO PLANO (NÃO-BLOQUEANTE)
  // ============================================================================

  /**
   * Busca sugestões remotas no TMDB / Cinemeta sem esperar atores ou travar o catálogo local
   */
  public async searchRemoteSuggestions(
    query: string,
    category: SearchCategory,
    limit = 6,
    signal?: AbortSignal
  ): Promise<ContentItem[]> {
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) return [];

    const normQuery = trimmed.toLowerCase();
    const cacheKey = `remotesug:${category}:${normQuery}`;
    const now = Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.items.slice(0, limit);
    }

    try {
      let rawResults: ContentItem[] = [];

      switch (category) {
        case 'movies':
          rawResults = await tmdbService.searchMovies(trimmed, signal);
          rawResults = rawResults.filter(it => this.isMovieItem(it));
          break;
        case 'series':
          rawResults = await tmdbService.searchSeries(trimmed, signal);
          rawResults = rawResults.filter(it => this.isSeriesItem(it));
          break;
        case 'animes': {
          const [tmdbList, aniListList] = await Promise.allSettled([
            tmdbService.searchAnimes(trimmed, signal),
            aniListClient.searchAnime(trimmed, 1, 10)
          ]);
          const tList = tmdbList.status === 'fulfilled' ? tmdbList.value : [];
          const aList = aniListList.status === 'fulfilled' ? aniListList.value : [];
          rawResults = [...tList, ...aList].filter(it => this.isAnimeItem(it));
          break;
        }
        case 'all':
        default:
          rawResults = await tmdbService.searchMulti(trimmed, signal);
          for (const item of rawResults) {
            if (this.isAnimeItem(item)) {
              item.type = ContentType.ANIME;
            }
          }
          break;
      }

      // Filtros de segurança e elegibilidade
      const clean = bannedContentRegistry.filterCleanItems(rawResults)
        .filter(it => !adultContentService.isAdultContent(it));
      const eligible = catalogEligibilityService.filterEligibleItemsSync(clean);

      this.cache.set(cacheKey, { timestamp: now, items: eligible });
      return eligible.slice(0, limit);
    } catch (e: any) {
      if (e?.name === 'AbortError' || signal?.aborted) return [];
      return [];
    }
  }

  /**
   * Pesquisa atores e atrizes com cache em memória e controlador próprio
   */
  public async searchPersons(query: string, signal?: AbortSignal): Promise<ActorPerson[]> {
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) return [];

    const normKey = trimmed.toLowerCase();
    const now = Date.now();
    const cached = this.actorCache.get(normKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.actors;
    }

    try {
      const actors = await tmdbService.searchPersons(trimmed, signal);
      this.actorCache.set(normKey, { timestamp: now, actors });
      return actors;
    } catch {
      return [];
    }
  }

  /**
   * Retorna sugestões combinadas com prioridade total para os títulos locais
   */
  public async getSearchSuggestionsWithActors(
    query: string,
    category: SearchCategory,
    limit = 6,
    localCatalog: ContentItem[] = []
  ): Promise<{ items: ContentItem[]; actors: ActorPerson[] }> {
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      return { items: [], actors: [] };
    }

    // 1. Resposta local instantânea
    const localItems = this.searchLocalInstant(trimmed, category, localCatalog, undefined, limit);

    // 2. Cria controller com versionamento para esta sessão de busca
    this.cancelHeaderSuggestions();
    const version = this.headerSearchVersion;
    const controller = new AbortController();
    this.headerController = controller;

    try {
      const [remoteItemsRes, actorsRes] = await Promise.allSettled([
        this.searchRemoteSuggestions(trimmed, category, limit, controller.signal),
        this.searchPersons(trimmed, controller.signal)
      ]);

      if (version !== this.headerSearchVersion) {
        return { items: localItems, actors: [] };
      }

      const remoteItems = remoteItemsRes.status === 'fulfilled' ? remoteItemsRes.value : [];
      const actors = actorsRes.status === 'fulfilled' ? actorsRes.value : [];

      // Mescla priorizando itens locais no topo
      const existingIds = new Set(localItems.map(it => it.id));
      const existingTitles = new Set(localItems.map(it => it.title.toLowerCase().trim()));
      const combined = [...localItems];

      for (const rItem of remoteItems) {
        if (combined.length >= limit) break;
        const normT = rItem.title.toLowerCase().trim();
        if (!existingIds.has(rItem.id) && !existingTitles.has(normT)) {
          combined.push(rItem);
          existingIds.add(rItem.id);
          existingTitles.add(normT);
        }
      }

      return {
        items: combined.slice(0, limit),
        actors: actors.slice(0, 3)
      };
    } catch {
      return { items: localItems, actors: [] };
    } finally {
      if (this.headerController === controller) {
        this.headerController = null;
      }
    }
  }

  // ============================================================================
  // BUSCA COMPLETA DA PÁGINA COM ATUALIZAÇÃO PROGRESSIVA
  // ============================================================================

  /**
   * Executa a pesquisa da página de resultados.
   * Se onPartialResults for fornecido, emite os resultados locais IMEDIATAMENTE (0ms)
   * antes mesmo de aguardar as respostas remotas.
   */
  public async search(
    query: string, 
    category: SearchCategory, 
    localCatalog: ContentItem[] = [],
    userProfile?: Profile | null,
    onPartialResults?: (items: ContentItem[]) => void
  ): Promise<ContentItem[]> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      this.cancelPageSearch();
      return [];
    }

    // Bloqueio absoluto para buscas ilegais ou de exploração
    if (adultContentService.isIllegalOrExploitative(trimmed)) {
      this.cancelPageSearch();
      return [];
    }

    if (bannedContentRegistry.isBannedTitle(trimmed) || bannedContentRegistry.isBannedKeyOrId(trimmed)) {
      this.cancelPageSearch();
      return [];
    }

    // 1. Emissão imediata dos resultados locais em memória
    const localMatches = this.searchLocalInstant(trimmed, category, localCatalog, userProfile, 40);
    if (localMatches.length > 0 && onPartialResults) {
      onPartialResults(localMatches);
    }

    const availableTitles = localCatalog ? localCatalog.map(it => it.title) : [];
    const isIntentionalAdult = adultContentService.isIntentionalAdultSearch(trimmed, availableTitles);
    const isChildProfile = userProfile ? userProfile.isChild === true : false;
    const allowAdult = isIntentionalAdult && !isChildProfile && adultContentService.isAgeConfirmed();

    const normQuery = trimmed.toLowerCase();
    const cacheKey = `${category}:${normQuery}:${allowAdult ? 'adult' : 'safe'}`;
    const now = Date.now();

    // Cache em memória
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      const mergedCache = this.mergeResults(localMatches, cached.items);
      if (onPartialResults) onPartialResults(mergedCache);
      return mergedCache;
    }

    // Cancela buscas anteriores da página e cria novo controller com versionamento
    this.cancelPageSearch();
    const version = this.pageSearchVersion;
    const controller = new AbortController();
    this.pageSearchController = controller;

    try {
      let rawResults: ContentItem[] = [];

      switch (category) {
        case 'movies':
          rawResults = await tmdbService.searchMovies(trimmed, controller.signal, (partial) => {
            if (version === this.pageSearchVersion && onPartialResults) {
              const cleanPart = this.filterAndCleanResults(partial, allowAdult, category);
              onPartialResults(this.mergeResults(localMatches, cleanPart));
            }
          });
          rawResults = rawResults.filter(it => this.isMovieItem(it));
          break;

        case 'series':
          rawResults = await tmdbService.searchSeries(trimmed, controller.signal, (partial) => {
            if (version === this.pageSearchVersion && onPartialResults) {
              const cleanPart = this.filterAndCleanResults(partial, allowAdult, category);
              onPartialResults(this.mergeResults(localMatches, cleanPart));
            }
          });
          rawResults = rawResults.filter(it => this.isSeriesItem(it));
          break;

        case 'animes': {
          const [tmdbRes, anilistRes] = await Promise.allSettled([
            tmdbService.searchAnimes(trimmed, controller.signal, (partial) => {
              if (version === this.pageSearchVersion && onPartialResults) {
                const cleanPart = this.filterAndCleanResults(partial, allowAdult, category);
                onPartialResults(this.mergeResults(localMatches, cleanPart));
              }
            }),
            aniListClient.searchAnime(trimmed, 1, 15)
          ]);
          const tmdbList = tmdbRes.status === 'fulfilled' ? tmdbRes.value : [];
          const aniListList = anilistRes.status === 'fulfilled' ? anilistRes.value : [];
          rawResults = [...tmdbList, ...aniListList].filter(it => this.isAnimeItem(it));
          break;
        }

        case 'all':
        default:
          rawResults = await tmdbService.searchMulti(trimmed, controller.signal, (partial) => {
            if (version === this.pageSearchVersion && onPartialResults) {
              const cleanPart = this.filterAndCleanResults(partial, allowAdult, category);
              onPartialResults(this.mergeResults(localMatches, cleanPart));
            }
          });
          for (const item of rawResults) {
            if (this.isAnimeItem(item)) {
              item.type = ContentType.ANIME;
            }
          }
          break;
      }

      if (version !== this.pageSearchVersion) {
        return localMatches;
      }

      const cleanRemote = this.filterAndCleanResults(rawResults, allowAdult, category);
      const merged = this.mergeResults(localMatches, cleanRemote);

      // Registra no Catálogo Mestre Canônico
      for (const item of merged) {
        canonicalCatalogMaster.registerItem(item);
      }

      this.cache.set(cacheKey, { timestamp: now, items: merged });

      if (onPartialResults) {
        onPartialResults(merged);
      }

      return merged;
    } catch (e: any) {
      if (e?.name === 'AbortError' || controller.signal.aborted) {
        return localMatches;
      }
      console.warn(`[SearchService] Erro na busca (${category}):`, e);
      return localMatches;
    } finally {
      if (this.pageSearchController === controller) {
        this.pageSearchController = null;
      }
    }
  }

  private filterAndCleanResults(items: ContentItem[], allowAdult: boolean, category: SearchCategory): ContentItem[] {
    let list = items;
    if (!allowAdult) {
      list = list.filter(it => !adultContentService.isAdultContent(it));
    }
    list = bannedContentRegistry.filterCleanItems(list);
    list = catalogEligibilityService.filterEligibleItemsSync(list, { allowAdult });

    if (category === 'movies') {
      list = list.filter(it => this.isMovieItem(it));
    } else if (category === 'series') {
      list = list.filter(it => this.isSeriesItem(it));
    } else if (category === 'animes') {
      list = list.filter(it => this.isAnimeItem(it));
    }

    return list;
  }

  private mergeResults(primary: ContentItem[], secondary: ContentItem[]): ContentItem[] {
    const existingIds = new Set(primary.map(it => it.id));
    const existingTitles = new Set(primary.map(it => it.title.toLowerCase().trim()));
    const result = [...primary];

    for (const item of secondary) {
      const normT = item.title.toLowerCase().trim();
      if (!existingIds.has(item.id) && !existingTitles.has(normT)) {
        result.push(item);
        existingIds.add(item.id);
        existingTitles.add(normT);
      }
    }
    return result;
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
    const local = this.searchLocalInstant(query, category, localCatalog, undefined, limit);
    if (local.length >= limit) return local;

    const results = await this.search(query, category, localCatalog);
    return results.slice(0, limit);
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
    return this.searchLocalInstant(query, category, items, userProfile, 50);
  }

  /**
   * Limpa todos os caches de busca e o índice local
   */
  public clearCache(): void {
    this.cache.clear();
    this.actorCache.clear();
    localSearchIndexService.clear();
  }
}

export const searchService = SearchService.getInstance();
