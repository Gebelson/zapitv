import { ContentItem, ContentType } from '../../../types';
import { tmdbService, MOVIE_GENRE_NAME_TO_ID, TV_GENRE_NAME_TO_ID } from '../tmdb/tmdbClient';
import { mediaAvailabilityIndex } from './MediaAvailabilityIndex';
import { diagnosticService } from './DiagnosticService';
import { theatricalFilterService } from './theatricalFilterService';
import { catalogEligibilityService } from './CatalogEligibilityService';
import { catalogReleaseStore } from './CatalogReleaseStore';
import { adultContentService } from '../adult/AdultContentService';
import { getCanonicalKeysForItem, deduplicateContentItems } from './catalogDeduplication';
import { canonicalCatalogMaster } from './CanonicalCatalogMaster';
import { aniListClient } from '../anilist/aniListClient';

export interface DiscoveryResult {
  items: ContentItem[];
  page: number;
  hasMore: boolean;
  totalDiscovered: number;
  totalAvailable: number;
  isPartial?: boolean;
}

export class CatalogDiscoveryService {
  private requireDiscoveryResponse(results: PromiseSettledResult<unknown>[]): boolean {
    const hasItems = results.some(result => result.status === 'fulfilled' &&
      (Array.isArray(result.value) ? result.value.length > 0 :
        !!result.value && Array.isArray((result.value as { items?: unknown[] }).items) &&
        (result.value as { items: unknown[] }).items.length > 0));
    if (!hasItems && results.some(result => result.status === 'rejected')) throw new Error('CATALOG_TEMPORARILY_UNAVAILABLE');
    return results.some(result => result.status === 'rejected');
  }

  private cinemetaCatalog(type: 'movie' | 'series', genre?: string, skip?: number) {
    return tmdbService.getCinemetaCatalog(type, genre, skip, 8000, true);
  }
  private dedupeCache = new Map<string, ContentItem>();
  private resultCache = new Map<string, { expiresAt: number; result: DiscoveryResult }>();
  private inFlight = new Map<string, Promise<DiscoveryResult>>();
  private cacheGeneration = 0;

  private cachedDiscovery(key: string, fetchResult: () => Promise<DiscoveryResult>): Promise<DiscoveryResult> {
    const cached = this.resultCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.result);
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const generation = this.cacheGeneration;
    const request = fetchResult().then(result => {
      if (generation === this.cacheGeneration && result.items.length > 0 && !result.isPartial) {
        if (this.resultCache.size >= 100) this.resultCache.delete(this.resultCache.keys().next().value!);
        this.resultCache.set(key, { result, expiresAt: Date.now() + 5 * 60 * 1000 });
      }
      return result;
    }).finally(() => {
      if (this.inFlight.get(key) === request) this.inFlight.delete(key);
    });
    this.inFlight.set(key, request);
    return request;
  }

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
    'movies_Adulto': 1250,
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
    'series_Adulto': 320,
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
    'animes_Mistério': 1420,
    'animes_Adulto': 850
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
    if (!item) return 'unknown';
    const mediaType = (item.mediaFormat === 'movie' || item.type === ContentType.MOVIE) ? 'movie' : 'tv';
    if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
      return item.imdbId.trim().toLowerCase();
    }
    if (item.id && /^tt\d+$/i.test(item.id.trim())) {
      return item.id.trim().toLowerCase();
    }
    if (item.tmdbId) {
      return `tmdb-${mediaType}-${item.tmdbId}`;
    }
    if (item.id && item.id.startsWith('tmdb-')) {
      return `tmdb-${mediaType}-${item.id.replace(/^tmdb-(movie-|tv-|anime-)?/, '').toLowerCase()}`;
    }
    if (item.id) return `${mediaType}-${item.id.toLowerCase()}`;
    return `title-${mediaType}-${(item.title || '').trim().toLowerCase()}-${item.year || 0}`;
  }

  /**
   * Deduplica e registra itens no índice de disponibilidade e fila de validação
   */
  private processAndDedupe(items: ContentItem[], contentType: 'movies' | 'series' | 'animes' | 'all'): ContentItem[] {
    const unique: ContentItem[] = [];
    const seenBatchKeys = new Set<string>();

    for (const item of items) {
      if (!item || (!item.id && !item.title)) continue;

      const keys = getCanonicalKeysForItem(item);
      const isBatchDuplicate = keys.some(k => seenBatchKeys.has(k));
      if (isBatchDuplicate) continue;

      for (const k of keys) {
        seenBatchKeys.add(k);
      }

      // Verifica se já existia no cache de itens descobertos
      let existing: ContentItem | undefined;
      for (const k of keys) {
        if (this.dedupeCache.has(k)) {
          existing = this.dedupeCache.get(k);
          break;
        }
      }

      if (existing) {
        // Enriquecimento de metadados se o novo item trouxer dados faltantes
        if (!existing.imdbId && item.imdbId) existing.imdbId = item.imdbId;
        if (!existing.tmdbId && item.tmdbId) existing.tmdbId = item.tmdbId;
        if ((!existing.genres || existing.genres.length === 0) && item.genres) existing.genres = item.genres;
        if (!existing.backdrop && item.backdrop) existing.backdrop = item.backdrop;
        if (!existing.image && item.image) existing.image = item.image;
        // The same item must remain available in another query/filter; dedupe is per batch and UI snapshot.
        unique.push(existing);
        continue;
      }

      // Registra e enriquece no Catálogo Mestre Canônico
      const masterItem = canonicalCatalogMaster.registerItem(item);

      for (const k of keys) {
        this.dedupeCache.set(k, masterItem);
      }
      unique.push(masterItem);

      // 1. Registra no MediaAvailabilityIndex como DISCOVERED (caso ainda não esteja catalogado)
      const canonicalId = masterItem.canonicalId || masterItem.imdbId || masterItem.id;
      const currentStatus = mediaAvailabilityIndex.getStatus(canonicalId);
      if (!currentStatus) {
        mediaAvailabilityIndex.recordDiscovery(canonicalId, masterItem.title, masterItem.type);
      }

      // 2. Atualiza diagnóstico
      const diagType = contentType === 'movies' ? 'movie' : (contentType === 'series' ? 'series' : 'anime');
      diagnosticService.recordDiscovered(canonicalId, diagType);
    }

    return unique;
  }

  /**
   * Descoberta de Filmes com suporte a múltiplas páginas e filtros dinâmicos de gênero
   */
  public async discoverMovies(page = 1, genre?: string): Promise<DiscoveryResult> {
    return this.cachedDiscovery(`movies:${page}:${genre || 'Todos'}`, () => this.discoverMoviesUncached(page, genre));
  }

  private async discoverMoviesUncached(page: number, genre?: string): Promise<DiscoveryResult> {
    const rawResults: ContentItem[] = [];
    let isPartial = false;
    const genreKey = genre || 'Todos';
    const isAdultGenre = genre === 'Adulto';

    try {
      if (isAdultGenre) {
        const skip = (page - 1) * 20;
        const cineRes = await this.cinemetaCatalog('movie', 'Adult', skip);
        for (const it of cineRes) {
          it.isAdult = true;
          if (!it.genres?.includes('Adulto')) it.genres = ['Adulto', ...(it.genres || [])];
          rawResults.push(it);
        }
      } else if (genre && genre !== 'Todos') {
        const genreId = MOVIE_GENRE_NAME_TO_ID[genre];
        const discoverPromise = page <= 500 ? tmdbService.getDiscoverMoviesWithMeta(page, genreId) : Promise.resolve({ items: [], total: 0 });
        const cinemetaPromise = page <= 500
          ? (page === 1 ? this.cinemetaCatalog('movie', genre) : Promise.resolve([]))
          : this.cinemetaCatalog('movie', genre, (page - 501) * 20);

        const [discoverRes, cineRes] = await Promise.allSettled([discoverPromise, cinemetaPromise]);
        isPartial = this.requireDiscoveryResponse([discoverRes, cineRes]);
        if (discoverRes.status === 'fulfilled') {
          rawResults.push(...discoverRes.value.items);
          if (discoverRes.value.total > 0 && !this.knownTotals[`movies_${genreKey}`]) {
            this.knownTotals[`movies_${genreKey}`] = discoverRes.value.total;
          }
        }
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      } else {
        const popularPromise = page <= 500 ? tmdbService.getPopularMoviesWithMeta(page) : Promise.resolve({ items: [], total: 0 });
        const topRatedPromise = page <= 3 ? tmdbService.getTopRatedMovies(page) : Promise.resolve([]);
        const cinemetaPromise = page <= 500
          ? (page === 1 ? this.cinemetaCatalog('movie', undefined, 0) : Promise.resolve([]))
          : this.cinemetaCatalog('movie', undefined, (page - 501) * 20);

        const [popRes, topRes, cineRes] = await Promise.allSettled([popularPromise, topRatedPromise, cinemetaPromise]);
        isPartial = this.requireDiscoveryResponse([popRes, topRes, cineRes]);
        if (popRes.status === 'fulfilled') {
          rawResults.push(...popRes.value.items);
        }
        if (topRes.status === 'fulfilled') rawResults.push(...topRes.value);
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      }
    } catch (err) {
      throw new Error('CATALOG_TEMPORARILY_UNAVAILABLE: filmes');
    }

    if (page === 1 && !isAdultGenre) {
      const releases = catalogReleaseStore.getReleases().filter(it => 
        (it.type === ContentType.MOVIE || it.mediaFormat === 'movie') &&
        (it.type !== ContentType.ANIME && !it.genres?.includes('Anime')) &&
        (!genre || genre === 'Todos' || it.genres?.includes(genre))
      );
      rawResults.unshift(...releases);
    }

    const allowed = catalogEligibilityService.filterEligibleItemsSync(rawResults, { allowAdult: isAdultGenre });
    const filtered = allowed.filter(it => {
      if (it.type === ContentType.ANIME || it.genres?.includes('Anime') || it.type === ContentType.SERIES || it.mediaFormat === 'series') return false;
      const isAdult = adultContentService.isAdultContent(it);
      return isAdultGenre ? isAdult : !isAdult;
    });
    const items = this.processAndDedupe(filtered, 'movies');
    return {
      items,
      page,
      hasMore: rawResults.length > 0 || items.length > 0,
      isPartial,
      totalDiscovered: this.dedupeCache.size,
      totalAvailable: this.getTotalAvailable('movies', genre)
    };
  }

  /**
   * Descoberta de Séries com suporte a múltiplas páginas e filtros dinâmicos de gênero
   */
  public async discoverSeries(page = 1, genre?: string): Promise<DiscoveryResult> {
    return this.cachedDiscovery(`series:${page}:${genre || 'Todos'}`, () => this.discoverSeriesUncached(page, genre));
  }

  private async discoverSeriesUncached(page: number, genre?: string): Promise<DiscoveryResult> {
    const rawResults: ContentItem[] = [];
    let isPartial = false;
    const genreKey = genre || 'Todos';
    const isAdultGenre = genre === 'Adulto';

    try {
      if (isAdultGenre) {
        const skip = (page - 1) * 20;
        const cineRes = await this.cinemetaCatalog('series', 'Adult', skip);
        for (const it of cineRes) {
          it.isAdult = true;
          if (!it.genres?.includes('Adulto')) it.genres = ['Adulto', ...(it.genres || [])];
          rawResults.push(it);
        }
      } else if (genre && genre !== 'Todos') {
        const genreId = TV_GENRE_NAME_TO_ID[genre];
        const discoverPromise = page <= 500 ? tmdbService.getDiscoverSeriesWithMeta(page, genreId) : Promise.resolve({ items: [], total: 0 });
        const cinemetaPromise = page <= 500
          ? (page === 1 ? this.cinemetaCatalog('series', genre) : Promise.resolve([]))
          : this.cinemetaCatalog('series', genre, (page - 501) * 20);

        const [discoverRes, cineRes] = await Promise.allSettled([discoverPromise, cinemetaPromise]);
        isPartial = this.requireDiscoveryResponse([discoverRes, cineRes]);
        if (discoverRes.status === 'fulfilled') {
          rawResults.push(...discoverRes.value.items);
          if (discoverRes.value.total > 0 && !this.knownTotals[`series_${genreKey}`]) {
            this.knownTotals[`series_${genreKey}`] = discoverRes.value.total;
          }
        }
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      } else {
        const popularPromise = page <= 500 ? tmdbService.getPopularSeriesWithMeta(page) : Promise.resolve({ items: [], total: 0 });
        const cinemetaPromise = page <= 500
          ? (page === 1 ? this.cinemetaCatalog('series', undefined, 0) : Promise.resolve([]))
          : this.cinemetaCatalog('series', undefined, (page - 501) * 20);

        const [popRes, cineRes] = await Promise.allSettled([popularPromise, cinemetaPromise]);
        isPartial = this.requireDiscoveryResponse([popRes, cineRes]);
        if (popRes.status === 'fulfilled') {
          rawResults.push(...popRes.value.items);
        }
        if (cineRes.status === 'fulfilled') rawResults.push(...cineRes.value);
      }
    } catch (err) {
      throw new Error('CATALOG_TEMPORARILY_UNAVAILABLE: séries');
    }

    if (page === 1 && !isAdultGenre) {
      const releases = catalogReleaseStore.getReleases().filter(it => 
        (it.type === ContentType.SERIES || it.mediaFormat === 'series') &&
        (it.type !== ContentType.ANIME && !it.genres?.includes('Anime')) &&
        (!genre || genre === 'Todos' || it.genres?.includes(genre))
      );
      rawResults.unshift(...releases);
    }

    const allowed = catalogEligibilityService.filterEligibleItemsSync(rawResults, { allowAdult: isAdultGenre });
    const filtered = allowed.filter(it => {
      if (it.type === ContentType.ANIME || it.genres?.includes('Anime') || it.type === ContentType.MOVIE || it.mediaFormat === 'movie') return false;
      const isAdult = adultContentService.isAdultContent(it);
      return isAdultGenre ? isAdult : !isAdult;
    });
    const items = this.processAndDedupe(filtered, 'series');
    return {
      items,
      page,
      hasMore: rawResults.length > 0 || items.length > 0,
      isPartial,
      totalDiscovered: this.dedupeCache.size,
      totalAvailable: this.getTotalAvailable('series', genre)
    };
  }

  /**
   * Descoberta Unificada de Animes (Séries E Longas-Metragens/Filmes)
   */
  public async discoverAnimes(page = 1, genre?: string): Promise<DiscoveryResult> {
    return this.cachedDiscovery(`animes:${page}:${genre || 'Todos'}`, () => this.discoverAnimesUncached(page, genre));
  }

  private async discoverAnimesUncached(page: number, genre?: string): Promise<DiscoveryResult> {
    const rawResults: ContentItem[] = [];
    let isPartial = false;
    const isAdultGenre = genre === 'Adulto';

    try {
      if (isAdultGenre) {
        const skip = (page - 1) * 20;
        const cineRes = await this.cinemetaCatalog('series', 'Hentai', skip);
        for (const it of cineRes) {
          it.isAdult = true;
          it.type = ContentType.ANIME;
          if (!it.genres?.includes('Anime')) it.genres = ['Anime', ...(it.genres || [])];
          if (!it.genres?.includes('Adulto')) it.genres = ['Adulto', ...(it.genres || [])];
          rawResults.push(it);
        }
      } else {
        const tvGenreId = (genre && genre !== 'Todos' && genre !== 'Anime' && genre !== 'Adulto') ? TV_GENRE_NAME_TO_ID[genre] : undefined;
        const movieGenreId = (genre && genre !== 'Todos' && genre !== 'Anime' && genre !== 'Adulto') ? MOVIE_GENRE_NAME_TO_ID[genre] : undefined;
        // 1. Busca Séries de Anime convencionais
        const tvAnimePromise = page <= 500 ? tmdbService.getAnimesWithMeta(page, tvGenreId) : Promise.resolve({ items: [], total: 0 });
        // 2. Busca Filmes de Anime convencionais
        const movieAnimePromise = page <= 500 ? tmdbService.getAnimeMoviesWithMeta(page, movieGenreId) : Promise.resolve({ items: [], total: 0 });
        // 3. Suporte contínuo via Cinemeta além da página 500
        const cinemetaPromise = page > 500 ? this.cinemetaCatalog('series', 'Animation', (page - 501) * 20) : Promise.resolve([]);
        // 4. Integração oficial e enriquecimento com AniList
        const anilistPromise = (page <= 10 && (!genre || genre === 'Todos' || genre === 'Anime')) ? aniListClient.getPopularAnimes(page, 20) : Promise.resolve([]);

        const [tvRes, movieRes, cineRes, aniRes] = await Promise.allSettled([tvAnimePromise, movieAnimePromise, cinemetaPromise, anilistPromise]);
        isPartial = this.requireDiscoveryResponse([tvRes, movieRes, cineRes, aniRes]);

        if (tvRes.status === 'fulfilled') {
          rawResults.push(...tvRes.value.items);
        }
        if (movieRes.status === 'fulfilled') {
          rawResults.push(...movieRes.value.items);
        }
        if (cineRes.status === 'fulfilled') {
          rawResults.push(...cineRes.value);
        }
        if (aniRes.status === 'fulfilled') {
          rawResults.push(...aniRes.value);
        }
      }

      // Filtro por sub-gênero caso o usuário selecione na dropdown
      if (genre && genre !== 'Todos' && genre !== 'Anime' && genre !== 'Adulto') {
        const filtered = rawResults.filter(it => it.genres?.includes(genre) || it.genres?.some(g => g.toLowerCase() === genre.toLowerCase()));
        const sourceItems = filtered.length > 0 ? filtered : rawResults;
        const allowed = catalogEligibilityService.filterEligibleItemsSync(sourceItems, { allowAdult: false });
        const onlyAnimes = allowed
          .filter(it => !adultContentService.isAdultContent(it))
          .map(it => {
            if (it.type !== ContentType.ANIME) it.type = ContentType.ANIME;
            if (!it.genres?.includes('Anime')) it.genres = ['Anime', ...(it.genres || [])];
            if (!it.genres?.includes(genre)) it.genres.push(genre);
            return it;
          });
        const items = this.processAndDedupe(onlyAnimes, 'animes');
        return {
          items,
          page,
          hasMore: rawResults.length > 0 || items.length > 0,
          isPartial,
          totalDiscovered: this.dedupeCache.size,
          totalAvailable: this.getTotalAvailable('animes', genre)
        };
      }
    } catch (err) {
      throw new Error('CATALOG_TEMPORARILY_UNAVAILABLE: animes');
    }

    if (page === 1 && !isAdultGenre) {
      const releases = catalogReleaseStore.getReleases().filter(it => 
        (it.type === ContentType.ANIME || it.genres?.includes('Anime')) &&
        (!genre || genre === 'Todos' || it.genres?.includes(genre))
      );
      rawResults.unshift(...releases);
    }

    const allowed = catalogEligibilityService.filterEligibleItemsSync(rawResults, { allowAdult: isAdultGenre });
    const onlyAnimes = allowed
      .filter(it => {
        const isAdult = adultContentService.isAdultContent(it);
        const matchesAdult = isAdultGenre ? isAdult : !isAdult;
        if (!matchesAdult) return false;
        return it.type === ContentType.ANIME || it.genres?.includes('Anime');
      })
      .map(it => {
        if (it.type !== ContentType.ANIME) it.type = ContentType.ANIME;
        if (!it.genres?.includes('Anime')) it.genres = ['Anime', ...(it.genres || [])];
        return it;
      });
    const items = this.processAndDedupe(onlyAnimes, 'animes');
    return {
      items,
      page,
      hasMore: rawResults.length > 0 || items.length > 0,
      isPartial,
      totalDiscovered: this.dedupeCache.size,
      totalAvailable: this.getTotalAvailable('animes', genre)
    };
  }

  /**
   * Descoberta de Itens em Destaque / Tendências
   */
  public async discoverTrending(): Promise<ContentItem[]> {
    try {
      const releases = catalogReleaseStore.getReleases();
      const trending = await tmdbService.getTrending();
      const combined = [...releases, ...trending];
      const allowed = catalogEligibilityService.filterEligibleItemsSync(combined);
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
    this.cacheGeneration++;
    this.dedupeCache.clear();
    this.resultCache.clear();
    this.inFlight.clear();
  }
}

export const catalogDiscoveryService = new CatalogDiscoveryService();
