import { ContentItem, ContentType } from '../../../types';

export const TMDB_API_KEY = '468925ac3759d7adeb05b540cfd71cb8';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
export const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';
export const CINEMETA_BASE_URL = 'https://v3-cinemeta.strem.io';

export interface TMDBRawItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  media_type?: 'movie' | 'tv';
  original_language?: string;
}

export interface CinemetaMetaItem {
  id: string; // IMDb ID (tt...)
  imdb_id?: string;
  name: string;
  type: string; // 'movie' | 'series'
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  year?: string;
  genres?: string[];
  imdbRating?: string;
  moviedb_id?: number;
  director?: string[] | string;
  cast?: string[] | string;
  videos?: Array<{
    id: string;
    name?: string;
    title?: string;
    season: number;
    number: number;
    episode?: number;
    overview?: string;
    description?: string;
    thumbnail?: string;
    released?: string;
  }>;
}

const GENRE_MAP: Record<number, string> = {
  28: 'Ação',
  12: 'Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Policial',
  99: 'Documentários',
  18: 'Drama',
  10751: 'Infantil / Família',
  14: 'Fantasia',
  36: 'Histórico',
  27: 'Terror',
  10402: 'Musical',
  9648: 'Mistério',
  10749: 'Romance',
  878: 'Ficção Científica',
  10770: 'Cinema TV',
  53: 'Suspense',
  10752: 'Guerra',
  37: 'Faroeste',
  10759: 'Ação e Aventura',
  10762: 'Kids',
  10763: 'Notícias',
  10764: 'Reality Show',
  10765: 'Ficção Científica e Fantasia',
  10766: 'Novela',
  10767: 'Talk Show',
  10768: 'Guerra e Política'
};

export const MOVIE_GENRE_NAME_TO_ID: Record<string, number> = {
  'Ação': 28,
  'Aventura': 12,
  'Animação': 16,
  'Comédia': 35,
  'Policial': 80,
  'Documentários': 99,
  'Drama': 18,
  'Infantil / Família': 10751,
  'Fantasia': 14,
  'Histórico': 36,
  'Terror': 27,
  'Musical': 10402,
  'Mistério': 9648,
  'Romance': 10749,
  'Ficção Científica': 878,
  'Cinema TV': 10770,
  'Suspense': 53,
  'Guerra': 10752,
  'Faroeste': 37
};

export const TV_GENRE_NAME_TO_ID: Record<string, number> = {
  'Ação': 10759,
  'Aventura': 10759,
  'Animação': 16,
  'Comédia': 35,
  'Policial': 80,
  'Documentários': 99,
  'Drama': 18,
  'Infantil / Família': 10762,
  'Fantasia': 10765,
  'Ficção Científica': 10765,
  'Mistério': 9648,
  'Reality Show': 10764,
  'Guerra': 10768,
  'Faroeste': 37
};

export function formatContentItem(raw: TMDBRawItem, forcedType?: ContentType): ContentItem {
  const isMovie = forcedType 
    ? forcedType === ContentType.MOVIE 
    : (raw.media_type === 'movie' || Boolean(raw.title && !raw.name));

  const isAnime = raw.original_language === 'ja' && (raw.genre_ids?.includes(16) || raw.genres?.some(g => g.id === 16));

  const type = isAnime 
    ? ContentType.ANIME 
    : (isMovie ? ContentType.MOVIE : ContentType.SERIES);

  const title = raw.title || raw.name || 'Sem Título';
  const yearStr = raw.release_date || raw.first_air_date || '';
  const year = yearStr ? new Date(yearStr).getFullYear() : 2024;

  const genres: string[] = [];
  if (raw.genres) {
    genres.push(...raw.genres.map(g => g.name));
  } else if (raw.genre_ids) {
    for (const gid of raw.genre_ids) {
      if (GENRE_MAP[gid]) genres.push(GENRE_MAP[gid]);
    }
  }

  if (isAnime && !genres.includes('Anime')) {
    genres.push('Anime');
  }

  const poster = raw.poster_path 
    ? `${TMDB_IMAGE_BASE}${raw.poster_path}` 
    : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500';

  const backdrop = raw.backdrop_path 
    ? `${TMDB_BACKDROP_BASE}${raw.backdrop_path}` 
    : poster;

  return {
    id: `tmdb-${raw.id}`,
    tmdbId: String(raw.id),
    title,
    type,
    rating: raw.vote_average ? Number(raw.vote_average.toFixed(1)) : 8.0,
    year: isNaN(year) ? 2024 : year,
    image: poster,
    backdrop,
    description: raw.overview || 'Sinopse oficial em português disponível em breve.',
    genres,
    isFeatured: (raw.vote_average || 0) > 7.5,
    releaseDate: yearStr ? yearStr.slice(0, 10) : undefined,
    originalTitle: raw.original_title || raw.original_name
  };
}

export function formatCinemetaItem(raw: CinemetaMetaItem): ContentItem {
  const isMovie = raw.type === 'movie';
  const type = isMovie ? ContentType.MOVIE : ContentType.SERIES;
  const yearNum = Number(raw.releaseInfo || raw.year || 2024);
  const ratingNum = raw.imdbRating ? parseFloat(raw.imdbRating) : 8.0;

  return {
    id: raw.id,
    imdbId: raw.id,
    tmdbId: raw.moviedb_id ? String(raw.moviedb_id) : undefined,
    title: raw.name || 'Sem Título',
    type,
    rating: isNaN(ratingNum) ? 8.0 : ratingNum,
    year: isNaN(yearNum) ? 2024 : yearNum,
    image: raw.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
    backdrop: raw.background || raw.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
    description: raw.description || 'Disponível no catálogo oficial do Stremio / Cinemeta.',
    genres: raw.genres && raw.genres.length > 0 ? raw.genres : ['Geral'],
    isFeatured: ratingNum >= 7.5
  };
}

class TMDBClientService {
  private imdbCache = new Map<string, string>();

  private async request(endpoint: string, timeoutMs = 8000, signal?: AbortSignal): Promise<any> {
    const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}&language=pt-BR`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortHandler = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw new DOMException('Aborted', 'AbortError');
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`Erro TMDB ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortHandler);
    }
  }

  private async searchCinemeta(url: string, signal?: AbortSignal): Promise<any> {
    const timeout = AbortSignal.timeout(8000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await fetch(url, { signal: requestSignal });
    if (!response.ok) throw new Error(`Cinemeta ${response.status}`);
    return response.json();
  }

  public async getImdbId(id: string | number, type: ContentType | 'movie' | 'series' | 'anime'): Promise<string | undefined> {
    const rawStr = String(id).trim();
    if (rawStr.startsWith('tt')) return rawStr;
    const cleanId = rawStr.replace(/^tmdb-?/i, '');
    if (this.imdbCache.has(cleanId)) return this.imdbCache.get(cleanId);
    if (this.imdbCache.has(rawStr)) return this.imdbCache.get(rawStr);

    const isMovie = type === ContentType.MOVIE || type === 'movie';
    const endpoint = isMovie ? `/movie/${cleanId}/external_ids` : `/tv/${cleanId}/external_ids`;
    try {
      const data = await this.request(endpoint);
      const imdbId = data?.imdb_id;
      if (imdbId) {
        this.imdbCache.set(cleanId, imdbId);
        this.imdbCache.set(rawStr, imdbId);
        return imdbId;
      }
    } catch {
      // Ignora erro
    }
    return undefined;
  }

  public async findByImdb(imdbId: string): Promise<ContentItem | null> {
    try {
      const data = await this.request(`/find/${imdbId}?external_source=imdb_id`);
      const movie = data.movie_results?.[0];
      if (movie) {
        const item = formatContentItem(movie, ContentType.MOVIE);
        item.imdbId = imdbId;
        return item;
      }
      const tv = data.tv_results?.[0];
      if (tv) {
        const item = formatContentItem(tv, ContentType.SERIES);
        item.imdbId = imdbId;
        return item;
      }
    } catch {
      // Ignora erro
    }
    return null;
  }

  public async getCinemetaMeta(type: 'movie' | 'series', imdbId: string, timeoutMs = 8000): Promise<CinemetaMetaItem | null> {
    try {
      const res = await fetch(`${CINEMETA_BASE_URL}/meta/${type}/${imdbId}.json`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok) {
        const data = await res.json();
        return data.meta || null;
      }
    } catch {
      // Ignora erro
    }
    return null;
  }

  public async getCinemetaCatalog(type: 'movie' | 'series', genre?: string, skip?: number, timeoutMs = 8000): Promise<ContentItem[]> {
    try {
      let url = `${CINEMETA_BASE_URL}/catalog/${type}/top`;
      const extras: string[] = [];
      if (genre) extras.push(`genre=${encodeURIComponent(genre)}`);
      if (skip) extras.push(`skip=${skip}`);
      if (extras.length > 0) url += `/${extras.join('&')}`;
      url += '.json';

      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const data = await res.json();
        return (data.metas || []).map((m: CinemetaMetaItem) => formatCinemetaItem(m));
      }
    } catch {
      // Ignora erro
    }
    return [];
  }

  public async getTrending(): Promise<ContentItem[]> {
    const data = await this.request('/trending/all/day');
    return (data.results || []).map((r: TMDBRawItem) => formatContentItem(r));
  }

  public async getPopularMovies(page = 1): Promise<ContentItem[]> {
    const data = await this.getPopularMoviesWithMeta(page);
    return data.items;
  }

  public async getPopularMoviesWithMeta(page = 1): Promise<{ items: ContentItem[], total: number }> {
    const data = await this.request(`/movie/popular?page=${page}`);
    return {
      items: (data.results || []).map((r: TMDBRawItem) => formatContentItem(r, ContentType.MOVIE)),
      total: data.total_results || 20000
    };
  }

  public async getPopularSeries(page = 1): Promise<ContentItem[]> {
    const data = await this.getPopularSeriesWithMeta(page);
    return data.items;
  }

  public async getPopularSeriesWithMeta(page = 1): Promise<{ items: ContentItem[], total: number }> {
    const data = await this.request(`/tv/popular?page=${page}`);
    return {
      items: (data.results || []).map((r: TMDBRawItem) => formatContentItem(r, ContentType.SERIES)),
      total: data.total_results || 20000
    };
  }

  public async getTopRatedMovies(page = 1): Promise<ContentItem[]> {
    const data = await this.request(`/movie/top_rated?page=${page}`);
    return (data.results || []).map((r: TMDBRawItem) => formatContentItem(r, ContentType.MOVIE));
  }

  public async getNowPlayingMovies(page = 1): Promise<ContentItem[]> {
    const data = await this.request(`/movie/now_playing?page=${page}`);
    return (data.results || []).map((r: TMDBRawItem) => formatContentItem(r, ContentType.MOVIE));
  }

  public async getAnimes(page = 1): Promise<ContentItem[]> {
    const data = await this.getAnimesWithMeta(page);
    return data.items;
  }

  public async getAnimesWithMeta(page = 1): Promise<{ items: ContentItem[], total: number }> {
    const data = await this.request(
      `/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${page}`
    );
    return {
      items: (data.results || []).map((r: TMDBRawItem) => formatContentItem(r, ContentType.ANIME)),
      total: data.total_results || 5474
    };
  }

  public async getAnimeMovies(page = 1): Promise<ContentItem[]> {
    const data = await this.getAnimeMoviesWithMeta(page);
    return data.items;
  }

  public async getAnimeMoviesWithMeta(page = 1): Promise<{ items: ContentItem[], total: number }> {
    const data = await this.request(
      `/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${page}`
    );
    return {
      items: (data.results || []).map((r: TMDBRawItem) => formatContentItem(r, ContentType.ANIME)),
      total: data.total_results || 6020
    };
  }

  public async getDiscoverMovies(page = 1, genreId?: number, sortBy = 'popularity.desc'): Promise<ContentItem[]> {
    const data = await this.getDiscoverMoviesWithMeta(page, genreId, sortBy);
    return data.items;
  }

  public async getDiscoverMoviesWithMeta(page = 1, genreId?: number, sortBy = 'popularity.desc'): Promise<{ items: ContentItem[], total: number }> {
    const genreParam = genreId ? `&with_genres=${genreId}` : '';
    const data = await this.request(
      `/discover/movie?sort_by=${sortBy}&page=${page}${genreParam}`
    );
    return {
      items: (data.results || []).map((r: TMDBRawItem) => formatContentItem(r, ContentType.MOVIE)),
      total: data.total_results || 20000
    };
  }

  public async getDiscoverSeries(page = 1, genreId?: number, sortBy = 'popularity.desc'): Promise<ContentItem[]> {
    const data = await this.getDiscoverSeriesWithMeta(page, genreId, sortBy);
    return data.items;
  }

  public async getDiscoverSeriesWithMeta(page = 1, genreId?: number, sortBy = 'popularity.desc'): Promise<{ items: ContentItem[], total: number }> {
    const genreParam = genreId ? `&with_genres=${genreId}` : '';
    const data = await this.request(
      `/discover/tv?sort_by=${sortBy}&page=${page}${genreParam}`
    );
    return {
      items: (data.results || []).map((r: TMDBRawItem) => formatContentItem(r, ContentType.SERIES)),
      total: data.total_results || 20000
    };
  }

  public async searchMulti(query: string): Promise<ContentItem[]> {
    if (!query || !query.trim()) return [];
    const trimmed = query.trim();

    // 1. Busca direta por IMDb ID (ex: tt1431045)
    if (/^tt\d+$/i.test(trimmed)) {
      const fromTmdb = await this.findByImdb(trimmed);
      if (fromTmdb) return [fromTmdb];

      const [cineMovie, cineSeries] = await Promise.all([
        this.getCinemetaMeta('movie', trimmed),
        this.getCinemetaMeta('series', trimmed)
      ]);
      const cine = cineMovie || cineSeries;
      if (cine) return [formatCinemetaItem(cine)];
    }

    const normalized = encodeURIComponent(trimmed);

    // 2. Busca Híbrida: TMDB (PT-BR) + Cinemeta Filmes + Cinemeta Séries em paralelo
    const [tmdbRes, cineMovieRes, cineSeriesRes] = await Promise.allSettled([
      this.request(`/search/multi?query=${normalized}`),
      this.searchCinemeta(`${CINEMETA_BASE_URL}/catalog/movie/top/search=${normalized}.json`),
      this.searchCinemeta(`${CINEMETA_BASE_URL}/catalog/series/top/search=${normalized}.json`)
    ]);

    const results: ContentItem[] = [];
    const seenIds = new Set<string>();

    // Adiciona resultados do TMDB (prioridade para títulos e sinopses em PT-BR)
    if (tmdbRes.status === 'fulfilled' && tmdbRes.value?.results) {
      const valid = tmdbRes.value.results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
      for (const r of valid) {
        const item = formatContentItem(r);
        results.push(item);
        seenIds.add(item.id);
        if (item.tmdbId) seenIds.add(item.tmdbId);
      }
    }

    // Adiciona filmes do Cinemeta Stremio Oficial não encontrados no TMDB
    if (cineMovieRes.status === 'fulfilled' && cineMovieRes.value?.metas) {
      for (const m of cineMovieRes.value.metas) {
        const cineItem = formatCinemetaItem(m);
        const normTitle = cineItem.title.toLowerCase().trim();
        const hasImdb = cineItem.imdbId && seenIds.has(cineItem.imdbId);
        const existing = results.find(it =>
          it.type === ContentType.MOVIE &&
          ((cineItem.tmdbId && it.tmdbId === cineItem.tmdbId) || it.title.toLowerCase().trim() === normTitle)
        );
        const hasTmdb = Boolean(existing && cineItem.tmdbId && existing.tmdbId === cineItem.tmdbId);
        const hasTitle = Boolean(existing && existing.title.toLowerCase().trim() === normTitle);

        if (!hasImdb && !hasTmdb && !hasTitle) {
          results.push(cineItem);
          seenIds.add(cineItem.id);
          if (cineItem.imdbId) seenIds.add(cineItem.imdbId);
        } else if (cineItem.imdbId) {
          if (existing && !existing.imdbId) {
            existing.imdbId = cineItem.imdbId;
          }
        }
      }
    }

    // Adiciona séries do Cinemeta Stremio Oficial não encontradas no TMDB
    if (cineSeriesRes.status === 'fulfilled' && cineSeriesRes.value?.metas) {
      for (const m of cineSeriesRes.value.metas) {
        const cineItem = formatCinemetaItem(m);
        const normTitle = cineItem.title.toLowerCase().trim();
        const hasImdb = cineItem.imdbId && seenIds.has(cineItem.imdbId);
        const existing = results.find(it =>
          it.type !== ContentType.MOVIE &&
          ((cineItem.tmdbId && it.tmdbId === cineItem.tmdbId) || it.title.toLowerCase().trim() === normTitle)
        );
        const hasTmdb = Boolean(existing && cineItem.tmdbId && existing.tmdbId === cineItem.tmdbId);
        const hasTitle = Boolean(existing && existing.title.toLowerCase().trim() === normTitle);

        if (!hasImdb && !hasTmdb && !hasTitle) {
          results.push(cineItem);
          seenIds.add(cineItem.id);
          if (cineItem.imdbId) seenIds.add(cineItem.imdbId);
        } else if (cineItem.imdbId) {
          if (existing && !existing.imdbId) {
            existing.imdbId = cineItem.imdbId;
          }
        }
      }
    }

    return results;
  }

  public async searchMovies(query: string, signal?: AbortSignal): Promise<ContentItem[]> {
    if (!query || !query.trim()) return [];
    const trimmed = query.trim();
    if (/^tt\d+$/i.test(trimmed)) {
      const fromTmdb = await this.findByImdb(trimmed);
      if (fromTmdb && fromTmdb.type === ContentType.MOVIE && !fromTmdb.genres?.includes('Anime')) return [fromTmdb];
      const cine = await this.getCinemetaMeta('movie', trimmed);
      if (cine) {
        const item = formatCinemetaItem(cine);
        if (item.type === ContentType.MOVIE && !item.genres?.includes('Anime')) return [item];
      }
      return [];
    }

    const normalized = encodeURIComponent(trimmed);
    const [tmdbRes, cineMovieRes] = await Promise.allSettled([
      this.request(`/search/movie?query=${normalized}`, 8000, signal),
      this.searchCinemeta(`${CINEMETA_BASE_URL}/catalog/movie/top/search=${normalized}.json`, signal)
    ]);

    const results: ContentItem[] = [];
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    if (tmdbRes.status === 'fulfilled' && tmdbRes.value?.results) {
      for (const r of tmdbRes.value.results) {
        const isAnime = r.original_language === 'ja' && (r.genre_ids?.includes(16) || r.genres?.some((g: any) => g.id === 16));
        if (isAnime) continue;

        const item = formatContentItem(r, ContentType.MOVIE);
        if (item.type === ContentType.ANIME || item.genres?.includes('Anime')) continue;

        item.type = ContentType.MOVIE;
        const normTitle = item.title.toLowerCase().trim();
        results.push(item);
        seenIds.add(item.id);
        if (item.tmdbId) seenIds.add(item.tmdbId);
        seenTitles.add(normTitle);
      }
    }

    if (cineMovieRes.status === 'fulfilled' && cineMovieRes.value?.metas) {
      for (const m of cineMovieRes.value.metas) {
        const cineItem = formatCinemetaItem(m);
        if (cineItem.type === ContentType.ANIME || cineItem.genres?.includes('Anime')) continue;
        cineItem.type = ContentType.MOVIE;
        const normTitle = cineItem.title.toLowerCase().trim();
        const hasImdb = cineItem.imdbId && seenIds.has(cineItem.imdbId);
        const hasTmdb = cineItem.tmdbId && seenIds.has(cineItem.tmdbId);
        const hasTitle = seenTitles.has(normTitle);

        if (!hasImdb && !hasTmdb && !hasTitle) {
          results.push(cineItem);
          seenIds.add(cineItem.id);
          if (cineItem.imdbId) seenIds.add(cineItem.imdbId);
          seenTitles.add(normTitle);
        }
      }
    }

    return results;
  }

  public async searchSeries(query: string, signal?: AbortSignal): Promise<ContentItem[]> {
    if (!query || !query.trim()) return [];
    const trimmed = query.trim();
    if (/^tt\d+$/i.test(trimmed)) {
      const fromTmdb = await this.findByImdb(trimmed);
      if (fromTmdb && fromTmdb.type === ContentType.SERIES && !fromTmdb.genres?.includes('Anime')) return [fromTmdb];
      const cine = await this.getCinemetaMeta('series', trimmed);
      if (cine) {
        const item = formatCinemetaItem(cine);
        if (item.type === ContentType.SERIES && !item.genres?.includes('Anime')) return [item];
      }
      return [];
    }

    const normalized = encodeURIComponent(trimmed);
    const [tmdbRes, cineSeriesRes] = await Promise.allSettled([
      this.request(`/search/tv?query=${normalized}`, 8000, signal),
      this.searchCinemeta(`${CINEMETA_BASE_URL}/catalog/series/top/search=${normalized}.json`, signal)
    ]);

    const results: ContentItem[] = [];
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    if (tmdbRes.status === 'fulfilled' && tmdbRes.value?.results) {
      for (const r of tmdbRes.value.results) {
        const isAnime = r.original_language === 'ja' && (r.genre_ids?.includes(16) || r.genres?.some((g: any) => g.id === 16));
        if (isAnime) continue;

        const item = formatContentItem(r, ContentType.SERIES);
        if (item.type === ContentType.ANIME || item.genres?.includes('Anime')) continue;

        item.type = ContentType.SERIES;
        const normTitle = item.title.toLowerCase().trim();
        results.push(item);
        seenIds.add(item.id);
        if (item.tmdbId) seenIds.add(item.tmdbId);
        seenTitles.add(normTitle);
      }
    }

    if (cineSeriesRes.status === 'fulfilled' && cineSeriesRes.value?.metas) {
      for (const m of cineSeriesRes.value.metas) {
        const cineItem = formatCinemetaItem(m);
        if (cineItem.type === ContentType.ANIME || cineItem.genres?.includes('Anime')) continue;
        cineItem.type = ContentType.SERIES;
        const normTitle = cineItem.title.toLowerCase().trim();
        const hasImdb = cineItem.imdbId && seenIds.has(cineItem.imdbId);
        const hasTmdb = cineItem.tmdbId && seenIds.has(cineItem.tmdbId);
        const hasTitle = seenTitles.has(normTitle);

        if (!hasImdb && !hasTmdb && !hasTitle) {
          results.push(cineItem);
          seenIds.add(cineItem.id);
          if (cineItem.imdbId) seenIds.add(cineItem.imdbId);
          seenTitles.add(normTitle);
        }
      }
    }

    return results;
  }

  public async searchAnimes(query: string, signal?: AbortSignal): Promise<ContentItem[]> {
    if (!query || !query.trim()) return [];
    const trimmed = query.trim();
    if (/^tt\d+$/i.test(trimmed)) {
      const fromTmdb = await this.findByImdb(trimmed);
      if (fromTmdb && (fromTmdb.type === ContentType.ANIME || fromTmdb.genres?.includes('Anime'))) return [fromTmdb];
      return [];
    }

    const normalized = encodeURIComponent(trimmed);
    const [tmdbTvRes, tmdbMovieRes, cineSeriesRes] = await Promise.allSettled([
      this.request(`/search/tv?query=${normalized}`, 8000, signal),
      this.request(`/search/movie?query=${normalized}`, 8000, signal),
      this.searchCinemeta(`${CINEMETA_BASE_URL}/catalog/series/top/search=${normalized}.json`, signal)
    ]);

    const results: ContentItem[] = [];
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    const checkAndAdd = (item: ContentItem, raw?: any) => {
      const isJa = raw?.original_language === 'ja';
      const hasAnimationGenre = raw?.genre_ids?.includes(16) || raw?.genres?.some((g: any) => g.id === 16) || item.genres?.includes('Animação') || item.genres?.includes('Animation');
      const isExplicitAnime = item.type === ContentType.ANIME || item.genres?.includes('Anime');

      const isAnime = isExplicitAnime || (isJa && hasAnimationGenre);
      if (!isAnime) return;

      const normTitle = item.title.toLowerCase().trim();
      if (seenIds.has(item.id) || (item.tmdbId && seenIds.has(item.tmdbId)) || seenTitles.has(normTitle)) {
        return;
      }

      item.type = ContentType.ANIME;
      if (!item.genres?.includes('Anime')) {
        item.genres = ['Anime', ...(item.genres || [])];
      }

      results.push(item);
      seenIds.add(item.id);
      if (item.tmdbId) seenIds.add(item.tmdbId);
      if (item.imdbId) seenIds.add(item.imdbId);
      seenTitles.add(normTitle);
    };

    if (tmdbTvRes.status === 'fulfilled' && tmdbTvRes.value?.results) {
      for (const r of tmdbTvRes.value.results) {
        checkAndAdd(formatContentItem(r, ContentType.ANIME), r);
      }
    }

    if (tmdbMovieRes.status === 'fulfilled' && tmdbMovieRes.value?.results) {
      for (const r of tmdbMovieRes.value.results) {
        checkAndAdd(formatContentItem(r, ContentType.ANIME), r);
      }
    }

    if (cineSeriesRes.status === 'fulfilled' && cineSeriesRes.value?.metas) {
      for (const m of cineSeriesRes.value.metas) {
        const item = formatCinemetaItem(m);
        if (item.type === ContentType.ANIME || item.genres?.includes('Anime')) {
          checkAndAdd(item);
        }
      }
    }

    return results;
  }

  public async getDetails(id: string | number, type: ContentType): Promise<{
    item: ContentItem;
    imdbId?: string;
    seasonsCount?: number;
    cast?: string[];
    director?: string;
    similar?: ContentItem[];
  }> {
    const isMovie = type === ContentType.MOVIE;
    const path = isMovie ? `/movie/${id}` : `/tv/${id}`;
    const data = await this.request(`${path}?append_to_response=credits,external_ids,recommendations,similar`);

    const formatted = formatContentItem(data, type);
    const imdbId = data.external_ids?.imdb_id;
    if (imdbId) {
      formatted.imdbId = imdbId;
      this.imdbCache.set(String(id), imdbId);
    }

    const cast = (data.credits?.cast || []).slice(0, 5).map((c: any) => c.name);
    formatted.cast = cast;

    if (isMovie) {
      const dir = (data.credits?.crew || []).find((c: any) => c.job === 'Director');
      if (dir) formatted.director = dir.name;
    } else {
      const creators = (data.created_by || []).map((c: any) => c.name).join(', ');
      if (creators) formatted.director = creators;
    }

    const seasonsCount = data.number_of_seasons || data.seasons?.length || 1;
    const similarRaw = data.recommendations?.results || data.similar?.results || [];
    const similar = similarRaw.slice(0, 9).map((r: TMDBRawItem) => formatContentItem(r, type));

    return {
      item: formatted,
      imdbId,
      seasonsCount,
      cast,
      director: formatted.director,
      similar
    };
  }

  public async getDetailsByImdb(imdbId: string, type: ContentType): Promise<{
    item: ContentItem;
    imdbId?: string;
    seasonsCount?: number;
    cast?: string[];
    director?: string;
    similar?: ContentItem[];
  }> {
    // 1. Tentar encontrar no TMDB para obter metadados em português
    const fromTmdb = await this.findByImdb(imdbId);
    if (fromTmdb?.tmdbId) {
      return this.getDetails(fromTmdb.tmdbId, type);
    }

    // 2. Fallback completo para o Cinemeta Stremio Oficial
    const stremioType = type === ContentType.MOVIE ? 'movie' : 'series';
    const cineMeta = await this.getCinemetaMeta(stremioType, imdbId);
    if (cineMeta) {
      const formatted = formatCinemetaItem(cineMeta);
      const cast = Array.isArray(cineMeta.cast) ? cineMeta.cast : (cineMeta.cast ? [cineMeta.cast] : []);
      const director = Array.isArray(cineMeta.director) ? cineMeta.director.join(', ') : cineMeta.director;
      const seasons = cineMeta.videos ? Math.max(...cineMeta.videos.map(v => v.season || 1), 1) : 1;
      return {
        item: formatted,
        imdbId,
        seasonsCount: seasons,
        cast,
        director,
        similar: []
      };
    }

    return {
      item: {
        id: imdbId,
        imdbId,
        title: imdbId,
        type,
        rating: 8.0,
        year: 2024,
        image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
        backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500',
        description: 'Detalhes sincronizados com o catálogo oficial do Stremio.',
        genres: ['Geral']
      },
      imdbId,
      seasonsCount: 1,
      cast: [],
      similar: []
    };
  }

  public async getSeasonEpisodes(tvId: string | number, seasonNumber: number): Promise<{
    id: string;
    number: number;
    title: string;
    description: string;
    image: string;
    stillPath?: string;
    airDate?: string;
  }[]> {
    try {
      const data = await this.request(`/tv/${tvId}/season/${seasonNumber}`);
      return (data.episodes || []).map((ep: any) => ({
        id: `ep-${tvId}-${seasonNumber}-${ep.episode_number}`,
        number: ep.episode_number,
        title: ep.name || `Episódio ${ep.episode_number}`,
        description: ep.overview || 'Sinopse oficial deste episódio não informada.',
        image: ep.still_path ? `${TMDB_IMAGE_BASE}${ep.still_path}` : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500',
        stillPath: ep.still_path,
        airDate: ep.air_date
      }));
    } catch (err) {
      console.warn(`Erro ao carregar episódios da T${seasonNumber}:`, err);
      return [];
    }
  }

  public async getSeasonEpisodesByImdb(imdbId: string, seasonNumber: number): Promise<{
    id: string;
    number: number;
    title: string;
    description: string;
    image: string;
    stillPath?: string;
    airDate?: string;
  }[]> {
    // 1. Tenta achar ID TMDB correspondente
    const fromTmdb = await this.findByImdb(imdbId);
    if (fromTmdb?.tmdbId) {
      const eps = await this.getSeasonEpisodes(fromTmdb.tmdbId, seasonNumber);
      if (eps && eps.length > 0) return eps;
    }

    // 2. Fallback direto para o Cinemeta Stremio
    const cineMeta = await this.getCinemetaMeta('series', imdbId);
    if (cineMeta?.videos) {
      const filtered = cineMeta.videos.filter(v => v.season === seasonNumber);
      if (filtered.length > 0) {
        return filtered.map(v => ({
          id: v.id || `${imdbId}:${v.season}:${v.number}`,
          number: v.number,
          title: v.name || v.title || `Episódio ${v.number}`,
          description: v.overview || v.description || 'Sinopse oficial via catálogo Stremio Cinemeta.',
          image: v.thumbnail || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500',
          airDate: v.released
        }));
      }
    }

    return [];
  }
}

export const tmdbService = new TMDBClientService();
