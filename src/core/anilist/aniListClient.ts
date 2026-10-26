/**
 * ZapiTV — AniList API Client
 * Integração oficial e autorizada com a API pública GraphQL do AniList (https://graphql.anilist.co).
 * Responsável por metadados canônicos de animes (séries e longas-metragens), contagem de episódios,
 * títulos originais japoneses (kanji/romaji/inglês) e mapeamento cruzado com MyAnimeList (MAL).
 */

import { ContentItem, ContentType } from '../../../types';
import { LruCache } from '../cache/LruCache';

export interface AniListMediaTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

export interface AniListMedia {
  id: number;
  idMal?: number | null;
  title: AniListMediaTitle;
  format?: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC' | null;
  status?: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS' | null;
  episodes?: number | null;
  seasonYear?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
  } | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  averageScore?: number | null;
  description?: string | null;
}

const GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

export class AniListClient {
  private static instance: AniListClient;
  private cache = new LruCache<string, any>(100, CACHE_TTL_MS);

  private constructor() {}

  public static getInstance(): AniListClient {
    if (!AniListClient.instance) {
      AniListClient.instance = new AniListClient();
    }
    return AniListClient.instance;
  }

  /**
   * Executa uma consulta GraphQL com timeout e tratamento resiliente de erros
   */
  private async executeQuery<T>(query: string, variables: Record<string, any>): Promise<T | null> {
    const cacheKey = JSON.stringify({ query, variables });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached as T;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[AniListClient] Rate limit atingido no AniList. Usando fallback silencioso.');
        } else {
          console.warn(`[AniListClient] Erro HTTP ${response.status} da API AniList`);
        }
        return null;
      }

      const json = await response.json();
      if (json.errors && json.errors.length > 0) {
        console.warn('[AniListClient] Erros GraphQL retornados:', json.errors[0]?.message);
        return null;
      }

      const data = json.data as T;
      if (data) {
        this.cache.set(cacheKey, data);
      }
      return data;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[AniListClient] Falha de comunicação com AniList:', err.message || err);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Converte um registro oficial do AniList em um ContentItem padronizado do ZapiTV
   */
  public convertAniListToContentItem(media: AniListMedia): ContentItem {
    const isMovie = media.format === 'MOVIE';
    const mainTitle = media.title.english || media.title.romaji || media.title.native || 'Anime';
    const origTitle = media.title.native || media.title.romaji || undefined;
    const year = media.seasonYear || media.startDate?.year || new Date().getFullYear();
    const poster = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '';
    const backdrop = media.bannerImage || poster;
    const rating = media.averageScore ? Number((media.averageScore / 10).toFixed(1)) : 8.0;

    // Normalização de gêneros garantindo 'Anime'
    const genres = Array.from(new Set(['Anime', ...(media.genres || [])]));

    const cleanDesc = (media.description || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    const episodeCount = media.episodes || (isMovie ? 1 : 12);
    const releaseYear = media.seasonYear || media.startDate?.year || new Date().getFullYear();
    const formattedDate = media.startDate?.year
      ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-${String(media.startDate.day || 1).padStart(2, '0')}`
      : `${releaseYear}-01-01`;

    const episodes = isMovie ? undefined : Array.from({ length: Math.min(episodeCount, 1500) }, (_, idx) => {
      const epNum = idx + 1;
      return {
        id: `ep-${media.id}-${epNum}`,
        number: epNum,
        season: 1,
        title: `Episódio ${epNum}`,
        description: `Episódio ${epNum} de ${mainTitle}`,
        image: poster,
        airDate: formattedDate,
        releaseDate: formattedDate
      };
    });

    return {
      id: `anilist-${media.id}`,
      canonicalId: `anime:anilist:${media.id}`,
      aniListId: media.id,
      malId: media.idMal || undefined,
      title: mainTitle,
      originalTitle: origTitle,
      type: ContentType.ANIME,
      mediaFormat: isMovie ? 'movie' : 'series',
      year,
      rating,
      image: poster,
      backdrop,
      description: cleanDesc,
      overview: cleanDesc,
      genres,
      seasonsCount: 1,
      episodes,
      isFeatured: false,
      availabilityStatus: 'declared'
    };
  }

  /**
   * Pesquisa animes por termo com paginação
   */
  public async searchAnime(query: string, page = 1, perPage = 20): Promise<ContentItem[]> {
    if (!query || query.trim().length === 0) return [];

    const gql = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            format
            status
            episodes
            seasonYear
            startDate {
              year
              month
              day
            }
            coverImage {
              extraLarge
              large
              medium
            }
            bannerImage
            genres
            averageScore
            description
          }
        }
      }
    `;

    const data = await this.executeQuery<{ Page: { media: AniListMedia[] } }>(gql, {
      search: query.trim(),
      page,
      perPage
    });

    if (!data?.Page?.media) return [];
    return data.Page.media.map(m => this.convertAniListToContentItem(m));
  }

  /**
   * Obtém os animes mais populares do AniList
   */
  public async getPopularAnimes(page = 1, perPage = 20): Promise<ContentItem[]> {
    const gql = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: POPULARITY_DESC) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            format
            status
            episodes
            seasonYear
            startDate {
              year
              month
              day
            }
            coverImage {
              extraLarge
              large
            }
            bannerImage
            genres
            averageScore
            description
          }
        }
      }
    `;

    const data = await this.executeQuery<{ Page: { media: AniListMedia[] } }>(gql, { page, perPage });
    if (!data?.Page?.media) return [];
    return data.Page.media.map(m => this.convertAniListToContentItem(m));
  }

  /**
   * Obtém detalhes de um anime por AniList ID
   */
  public async getAnimeById(id: number): Promise<ContentItem | null> {
    const gql = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          format
          status
          episodes
          seasonYear
          startDate {
            year
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          genres
          averageScore
          description
        }
      }
    `;

    const data = await this.executeQuery<{ Media: AniListMedia }>(gql, { id });
    if (!data?.Media) return null;
    return this.convertAniListToContentItem(data.Media);
  }

  /**
   * Obtém detalhes de um anime por MyAnimeList (MAL) ID
   */
  public async getAnimeByMalId(malId: number): Promise<ContentItem | null> {
    const gql = `
      query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          format
          status
          episodes
          seasonYear
          startDate {
            year
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          genres
          averageScore
          description
        }
      }
    `;

    const data = await this.executeQuery<{ Media: AniListMedia }>(gql, { idMal: malId });
    if (!data?.Media) return null;
    return this.convertAniListToContentItem(data.Media);
  }
}

export const aniListClient = AniListClient.getInstance();
