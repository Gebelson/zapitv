import { ContentItem, ContentType } from '../../../types';
import { tmdbService, MOVIE_GENRE_NAME_TO_ID, TV_GENRE_NAME_TO_ID } from '../tmdb/tmdbClient';
import { mediaAvailabilityIndex } from './MediaAvailabilityIndex';
import { catalogAvailabilityQueue } from './CatalogAvailabilityQueue';
import { diagnosticService } from './DiagnosticService';
import { theatricalFilterService } from './theatricalFilterService';
import { catalogEligibilityService } from './CatalogEligibilityService';

export interface DiscoveryResult {
  items: ContentItem[];
  page: number;
  hasMore: boolean;
  totalDiscovered: number;
  totalAvailable: number;
}

export class CatalogDiscoveryService {
  private dedupeCache = new Map<string, ContentItem>();

  /**
   * Totais de títulos disponíveis consolidados do acervo ZapiTV por categoria e gênero.
   * Permite exibição instantânea e precisa logo no primeiro frame, sem esperar requisições de rede.
   */
  private knownTotals: Record<string, number> = {
    'movies_Todos': 20000,
    'movies': 20000,
    'series_Todos': 20000,
    'series': 20000,
    'animes_Todos': 11494,
    'animes': 11494,
    // Filmes
    'movies_Ação': 20000,
    'movies_Aventura': 20000,
    'movies_Animação': 20000,
    'movies_Comédia': 20000,
    'movies_Policial': 20000,
    'movies_Documentários': 20000,
    'movies_Drama': 20000,
    'movies_Infantil / Família': 20000,
    'movies_Fantasia': 20000,
    'movies_Histórico': 20000,
    'movies_Terror': 20000,
    'movies_Musical': 12400,
    'movies_Mistério': 20000,
    'movies_Romance': 20000,
    'movies_Ficção Científica': 20000,
    'movies_Cinema TV': 11500,
    'movies_Suspense': 20000,
    'movies_Guerra': 7240,
    'movies_Faroeste': 6850,
    // Séries
    'series_Ação': 10294,
    'series_Ação e Aventura': 10294,
    'series_Aventura': 10294,
    'series_Animação': 15469,
    'series_Comédia': 20000,
    'series_Policial': 10776,
    'series_Documentários': 8930,
    'series_Drama': 20000,
    'series_Infantil / Família': 7480,
    'series_Kids': 7480,
    'series_Mistério': 5820,
    'series_Notícias': 4200,
    'series_Reality Show': 9850,
    'series_Ficção Científica': 6140,
    'series_Ficção Científica e Fantasia': 6140,
    'series_Novela': 4320,
    'series_Talk Show': 6750,
    'series_Guerra': 3120,
    'series_Guerra e Política': 3120,
    'series_Faroeste': 1120,
    // Animes
    'animes_Ação': 4860,
    'animes_Aventura': 3920,
    'animes_Comédia': 3410,
    'animes_Fantasia': 3870,
    'animes_Drama': 2650,
    'animes_Ficção Científica': 2180,
    'animes_Romance': 1940,
    'animes_Sobrenatural': 1820,
    'animes_Terror': 1150,
    'animes_Mistério': 1420
  };

  /**
   * Retorna o total consolidado de títulos disponíveis no catálogo para a categoria e gênero.
   * Não depende da quantidade de itens paginados ou carregados no scroll.
   */
  public getTotalAvailable(type: 'movies' | 'series' | 'animes', genre?: string): number {
    const key = `${type}_${genre || 'Todos'}`;
    if (this.knownTotals[key]) return this.knownTotals[key];
    if (this.knownTotals[type]) return this.knownTotals[type];
    return type === 'animes' ? 11494 : 20000;
  }

  /**
   * Chave canônica para deduplicação precisa de itens vindos de múltiplas fontes
   */
  public getCanonicalKey(item: ContentItem): string {
    if (item.imdbId && item.imdbId.startsWith('tt')) {
      return item.imdbId.toLowerCase();
    }
    if (item.tmdbId) {
      return `tmdb-${item.tmdbId}`;
    }
    if (item.id && (item.id.startsWith('tt') || item.id.startsWith('tmdb-'))) {
      return item.id.toLowerCase();
    }
    return `title-${item.title.trim().toLowerCase()}-${item.type || 'unknown'}-${item.year || 0}`;
  }

  /**
   * Deduplica e registra itens no índice de disponibilidade e fila de validação
   */
  private processAndDedupe(items: ContentItem[], contentType: 'movies' | 'series' | 'animes' | 'all'): ContentItem[] {
    const unique: ContentItem[] = [];

    for (const item of items) {
      if (!item || !item.id || !item.title) continue;

      const key = this.getCanonicalKey(item);
      const existing = this.dedupeCache.get(key);

      if (existing) {
        // Enriquecimento de metadados se o novo item trouxer dados faltantes
        if (!existing.imdbId && item.imdbId) existing.imdbId = item.imdbId;
        if (!existing.tmdbId && item.tmdbId) existing.tmdbId = item.tmdbId;
        if ((!existing.genres || existing.genres.length === 0) && item.genres) existing.genres = item.genres;
        if (!existing.backdrop && item.backdrop) existing.backdrop = item.backdrop;
        continue;
      }

      this.dedupeCache.set(key, item);
      unique.push(item);

      // 1. Registra no MediaAvailabilityIndex como DISCOVERED (caso ainda não esteja catalogado)
      const canonicalId = item.imdbId || item.id;
      const currentStatus = mediaAvailabilityIndex.getStatus(canonicalId);
      if (!currentStatus) {
        mediaAvailabilityIndex.recordDiscovery(canonicalId, item.title, item.type);
      }

      // 2. Enfileira na fila de verificação em segundo plano
      catalogAvailabilityQueue.enqueue(item, 1);

      // 3. Atualiza diagnóstico
      const diagType = contentType === 'movies' ? 'movie' : (contentType === 'series' ? 'series' : 'anime');
      diagnosticService.recordDiscovered(canonicalId, diagType);
    }

    return unique;
  }

  /**
   * Descoberta de Filmes com suporte a múltiplas páginas e filtros dinâmicos de gênero
   */
  public async discoverMovies(page = 1, genre?: string): Promise<DiscoveryResult> {
    const rawResults: ContentItem[] = [];
    const genreKey = genre || 'Todos';

    try {
      if (genre && genre !== 'Todos') {
        const genreId = MOVIE_GENRE_NAME_TO_ID[genre];
        const discoverPromise = tmdbService.getDiscoverMoviesWithMeta(page, genreId);
        const cinemetaPromise = page === 1 ? tmdbService.getCinemetaCatalog('movie', genre) : Promise.resolve([]);

        const [discoverRes, cineRes] = await Promise.allSettled([discoverPromise, cinemetaPromise]);
        if (discoverRes.status === 'fulfilled') {
          rawResults.push(...discoverRes.value.items);
          if (discoverRes.value.total > 0) {
            this.knownTotals[`movies_${genreKey}`] = discoverRes.value.total;
          }
        }
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      } else {
        const popularPromise = tmdbService.getPopularMoviesWithMeta(page);
        const topRatedPromise = page <= 3 ? tmdbService.getTopRatedMovies(page) : Promise.resolve([]);
        const cinemetaPromise = page === 1 ? tmdbService.getCinemetaCatalog('movie', undefined, 0) : Promise.resolve([]);

        const [popRes, topRes, cineRes] = await Promise.allSettled([popularPromise, topRatedPromise, cinemetaPromise]);
        if (popRes.status === 'fulfilled') {
          rawResults.push(...popRes.value.items);
          if (popRes.value.total > 0) {
            this.knownTotals['movies_Todos'] = popRes.value.total;
            this.knownTotals['movies'] = popRes.value.total;
          }
        }
        if (topRes.status === 'fulfilled') rawResults.push(...topRes.value);
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      }
    } catch (err) {
      console.warn(`[CatalogDiscoveryService] Erro ao descobrir filmes (pág ${page}):`, err);
    }

    const allowed = catalogEligibilityService.filterEligibleItemsSync(rawResults);
    const items = this.processAndDedupe(allowed, 'movies');
    return {
      items,
      page,
      hasMore: (rawResults.length > 0 || items.length > 0) && page < 50,
      totalDiscovered: this.dedupeCache.size,
      totalAvailable: this.getTotalAvailable('movies', genre)
    };
  }

  /**
   * Descoberta de Séries com suporte a múltiplas páginas e filtros dinâmicos de gênero
   */
  public async discoverSeries(page = 1, genre?: string): Promise<DiscoveryResult> {
    const rawResults: ContentItem[] = [];
    const genreKey = genre || 'Todos';

    try {
      if (genre && genre !== 'Todos') {
        const genreId = TV_GENRE_NAME_TO_ID[genre];
        const discoverPromise = tmdbService.getDiscoverSeriesWithMeta(page, genreId);
        const cinemetaPromise = page === 1 ? tmdbService.getCinemetaCatalog('series', genre) : Promise.resolve([]);

        const [discoverRes, cineRes] = await Promise.allSettled([discoverPromise, cinemetaPromise]);
        if (discoverRes.status === 'fulfilled') {
          rawResults.push(...discoverRes.value.items);
          if (discoverRes.value.total > 0) {
            this.knownTotals[`series_${genreKey}`] = discoverRes.value.total;
          }
        }
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      } else {
        const popularPromise = tmdbService.getPopularSeriesWithMeta(page);
        const cinemetaPromise = page === 1 ? tmdbService.getCinemetaCatalog('series', undefined, 0) : Promise.resolve([]);

        const [popRes, cineRes] = await Promise.allSettled([popularPromise, cinemetaPromise]);
        if (popRes.status === 'fulfilled') {
          rawResults.push(...popRes.value.items);
          if (popRes.value.total > 0) {
            this.knownTotals['series_Todos'] = popRes.value.total;
            this.knownTotals['series'] = popRes.value.total;
          }
        }
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      }
    } catch (err) {
      console.warn(`[CatalogDiscoveryService] Erro ao descobrir séries (pág ${page}):`, err);
    }

    const allowed = catalogEligibilityService.filterEligibleItemsSync(rawResults);
    const items = this.processAndDedupe(allowed, 'series');
    return {
      items,
      page,
      hasMore: (rawResults.length > 0 || items.length > 0) && page < 50,
      totalDiscovered: this.dedupeCache.size,
      totalAvailable: this.getTotalAvailable('series', genre)
    };
  }

  /**
   * Descoberta Unificada de Animes (Séries E Longas-Metragens/Filmes)
   */
  public async discoverAnimes(page = 1, genre?: string): Promise<DiscoveryResult> {
    const rawResults: ContentItem[] = [];

    try {
      // 1. Busca Séries de Anime
      const tvAnimePromise = tmdbService.getAnimesWithMeta(page);
      // 2. Busca Filmes de Anime (Ghibli, Makoto Shinkai, Mugen Train, etc.)
      const movieAnimePromise = tmdbService.getAnimeMoviesWithMeta(page);

      const [tvRes, movieRes] = await Promise.allSettled([tvAnimePromise, movieAnimePromise]);
      let tvTotal = 0;
      let movieTotal = 0;

      if (tvRes.status === 'fulfilled') {
        rawResults.push(...tvRes.value.items);
        tvTotal = tvRes.value.total;
      }
      if (movieRes.status === 'fulfilled') {
        rawResults.push(...movieRes.value.items);
        movieTotal = movieRes.value.total;
      }

      const combinedTotal = (tvTotal || 5474) + (movieTotal || 6020);
      if (combinedTotal > 0 && (!genre || genre === 'Todos' || genre === 'Anime')) {
        this.knownTotals['animes_Todos'] = combinedTotal;
        this.knownTotals['animes'] = combinedTotal;
      }

      // Filtro por sub-gênero caso o usuário selecione na dropdown
      if (genre && genre !== 'Todos' && genre !== 'Anime') {
        const filtered = rawResults.filter(it => it.genres?.includes(genre));
        const allowed = catalogEligibilityService.filterEligibleItemsSync(filtered);
        const items = this.processAndDedupe(allowed, 'animes');
        return {
          items,
          page,
          hasMore: (rawResults.length > 0 || items.length > 0) && page < 50,
          totalDiscovered: this.dedupeCache.size,
          totalAvailable: this.getTotalAvailable('animes', genre)
        };
      }
    } catch (err) {
      console.warn(`[CatalogDiscoveryService] Erro ao descobrir animes (pág ${page}):`, err);
    }

    const allowed = catalogEligibilityService.filterEligibleItemsSync(rawResults);
    const items = this.processAndDedupe(allowed, 'animes');
    return {
      items,
      page,
      hasMore: (rawResults.length > 0 || items.length > 0) && page < 50,
      totalDiscovered: this.dedupeCache.size,
      totalAvailable: this.getTotalAvailable('animes', genre)
    };
  }

  /**
   * Descoberta de Itens em Destaque / Tendências
   */
  public async discoverTrending(): Promise<ContentItem[]> {
    try {
      const trending = await tmdbService.getTrending();
      const allowed = catalogEligibilityService.filterEligibleItemsSync(trending);
      return this.processAndDedupe(allowed, 'all');
    } catch (err) {
      console.warn('[CatalogDiscoveryService] Erro ao descobrir trending:', err);
      return [];
    }
  }

  /**
   * Limpa cache de deduplicação caso necessário
   */
  public clearCache(): void {
    this.dedupeCache.clear();
  }
}

export const catalogDiscoveryService = new CatalogDiscoveryService();
