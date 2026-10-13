import { ContentItem, ContentType } from '../../../types';
import { tmdbService, MOVIE_GENRE_NAME_TO_ID, TV_GENRE_NAME_TO_ID } from '../tmdb/tmdbClient';
import { mediaAvailabilityIndex } from './MediaAvailabilityIndex';
import { catalogAvailabilityQueue } from './CatalogAvailabilityQueue';
import { diagnosticService } from './DiagnosticService';

export interface DiscoveryResult {
  items: ContentItem[];
  page: number;
  hasMore: boolean;
  totalDiscovered: number;
}

export class CatalogDiscoveryService {
  private dedupeCache = new Map<string, ContentItem>();

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

    try {
      if (genre && genre !== 'Todos') {
        const genreId = MOVIE_GENRE_NAME_TO_ID[genre];
        const discoverPromise = tmdbService.getDiscoverMovies(page, genreId);
        const cinemetaPromise = page === 1 ? tmdbService.getCinemetaCatalog('movie', genre) : Promise.resolve([]);

        const [discoverRes, cineRes] = await Promise.allSettled([discoverPromise, cinemetaPromise]);
        if (discoverRes.status === 'fulfilled') rawResults.push(...discoverRes.value);
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      } else {
        const popularPromise = tmdbService.getPopularMovies(page);
        const topRatedPromise = page <= 3 ? tmdbService.getTopRatedMovies(page) : Promise.resolve([]);
        const cinemetaPromise = page === 1 ? tmdbService.getCinemetaCatalog('movie', undefined, 0) : Promise.resolve([]);

        const [popRes, topRes, cineRes] = await Promise.allSettled([popularPromise, topRatedPromise, cinemetaPromise]);
        if (popRes.status === 'fulfilled') rawResults.push(...popRes.value);
        if (topRes.status === 'fulfilled') rawResults.push(...topRes.value);
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      }
    } catch (err) {
      console.warn(`[CatalogDiscoveryService] Erro ao descobrir filmes (pág ${page}):`, err);
    }

    const items = this.processAndDedupe(rawResults, 'movies');
    return {
      items,
      page,
      hasMore: items.length > 0 && page < 20,
      totalDiscovered: this.dedupeCache.size
    };
  }

  /**
   * Descoberta de Séries com suporte a múltiplas páginas e filtros dinâmicos de gênero
   */
  public async discoverSeries(page = 1, genre?: string): Promise<DiscoveryResult> {
    const rawResults: ContentItem[] = [];

    try {
      if (genre && genre !== 'Todos') {
        const genreId = TV_GENRE_NAME_TO_ID[genre];
        const discoverPromise = tmdbService.getDiscoverSeries(page, genreId);
        const cinemetaPromise = page === 1 ? tmdbService.getCinemetaCatalog('series', genre) : Promise.resolve([]);

        const [discoverRes, cineRes] = await Promise.allSettled([discoverPromise, cinemetaPromise]);
        if (discoverRes.status === 'fulfilled') rawResults.push(...discoverRes.value);
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      } else {
        const popularPromise = tmdbService.getPopularSeries(page);
        const cinemetaPromise = page === 1 ? tmdbService.getCinemetaCatalog('series', undefined, 0) : Promise.resolve([]);

        const [popRes, cineRes] = await Promise.allSettled([popularPromise, cinemetaPromise]);
        if (popRes.status === 'fulfilled') rawResults.push(...popRes.value);
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      }
    } catch (err) {
      console.warn(`[CatalogDiscoveryService] Erro ao descobrir séries (pág ${page}):`, err);
    }

    const items = this.processAndDedupe(rawResults, 'series');
    return {
      items,
      page,
      hasMore: items.length > 0 && page < 20,
      totalDiscovered: this.dedupeCache.size
    };
  }

  /**
   * Descoberta Unificada de Animes (Séries E Longas-Metragens/Filmes)
   */
  public async discoverAnimes(page = 1, genre?: string): Promise<DiscoveryResult> {
    const rawResults: ContentItem[] = [];

    try {
      // 1. Busca Séries de Anime
      const tvAnimePromise = tmdbService.getAnimes(page);
      // 2. Busca Filmes de Anime (Ghibli, Makoto Shinkai, Mugen Train, etc.)
      const movieAnimePromise = tmdbService.getAnimeMovies(page);

      const [tvRes, movieRes] = await Promise.allSettled([tvAnimePromise, movieAnimePromise]);
      if (tvRes.status === 'fulfilled') rawResults.push(...tvRes.value);
      if (movieRes.status === 'fulfilled') rawResults.push(...movieRes.value);

      // Filtro por sub-gênero caso o usuário selecione na dropdown
      if (genre && genre !== 'Todos' && genre !== 'Anime') {
        // Filtra os que possuem esse gênero adicional
        const filtered = rawResults.filter(it => it.genres?.includes(genre));
        const items = this.processAndDedupe(filtered, 'animes');
        return {
          items,
          page,
          hasMore: items.length > 0 && page < 20,
          totalDiscovered: this.dedupeCache.size
        };
      }
    } catch (err) {
      console.warn(`[CatalogDiscoveryService] Erro ao descobrir animes (pág ${page}):`, err);
    }

    const items = this.processAndDedupe(rawResults, 'animes');
    return {
      items,
      page,
      hasMore: items.length > 0 && page < 20,
      totalDiscovered: this.dedupeCache.size
    };
  }

  /**
   * Descoberta de Itens em Destaque / Tendências
   */
  public async discoverTrending(): Promise<ContentItem[]> {
    try {
      const trending = await tmdbService.getTrending();
      return this.processAndDedupe(trending, 'all');
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
