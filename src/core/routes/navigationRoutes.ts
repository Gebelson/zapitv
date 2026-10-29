import { ContentItem, ContentType } from '../../../types';

export const ROUTES = {
  HOME: '/',
  EXPLORE: '/explorar',
  SEARCH: '/buscar',
  MY_ZAPITV: '/minha-zapitv',
  FEATURED: '/em-destaque',
  MOVIES: '/filmes',
  MOVIE_DETAIL: '/filmes/:id',
  SERIES: '/series',
  SERIES_DETAIL: '/series/:id',
  SERIES_EPISODE: '/series/:id/temporada/:season/episodio/:episode',
  ANIMES: '/animes',
  ANIME_DETAIL: '/animes/:id',
  ANIME_EPISODE: '/animes/:id/temporada/:season/episodio/:episode',
  PROGRAMAS: '/programas',
  TELEVISION: '/televisao',
  MY_LIST: '/minha-lista',
  HISTORY: '/historico',
  PROFILE: '/perfil',
  SETTINGS: '/configuracoes',
  HELP: '/ajuda',
  ACTOR_DETAIL: '/atores/:id',
  AUTH: '/login',
  RECOVER_PASSWORD: '/recuperar-senha',
  RESET_PASSWORD: '/redefinir-senha',
  ADMIN: '/admin',
  ADMIN_WILDCARD: '/admin/*',
  DEV_LAB: '/dev/video-enhancement-lab',
  DEV_PLAYER_TEST: '/dev/player-test',
  WATCH_PARTY: '/sala/:roomId',
  WATCH_MOVIE: '/assistir/filme/:id',
  WATCH_SERIES: '/assistir/serie/:id/t/:season/e/:episode',
  WATCH_SERIES_SHORT: '/assistir/serie/:id',
  WATCH_ANIME: '/assistir/anime/:id/t/:season/e/:episode',
  WATCH_ANIME_SHORT: '/assistir/anime/:id',
  TV_WATCH_MOVIE: '/tv/assistir/filme/:id',
  TV_WATCH_SERIES: '/tv/assistir/serie/:id/t/:season/e/:episode',
  TV_WATCH_SERIES_SHORT: '/tv/assistir/serie/:id',
  TV_WATCH_ANIME: '/tv/assistir/anime/:id/t/:season/e/:episode',
  TV_WATCH_ANIME_SHORT: '/tv/assistir/anime/:id',
  NOT_FOUND: '*'
} as const;

export interface ParsedWatchRoute {
  isWatch: boolean;
  isTv: boolean;
  mediaType?: 'movie' | 'series' | 'anime';
  id?: string;
  season?: number;
  episode?: number;
}

export function getActorRoute(actorId: string | number): string {
  const cleanId = String(actorId).replace(/^tmdb-actor-?/i, '');
  return `/atores/${cleanId}`;
}

export function getContentRoute(item: ContentItem): string {
  if (item.type === ContentType.ANIME || item.genres?.includes('Anime')) {
    return `/animes/${item.id}`;
  }
  if (item.type === ContentType.SERIES) {
    return `/series/${item.id}`;
  }
  return `/filmes/${item.id}`;
}

export function getEpisodeRoute(item: ContentItem, season: number, episode: number): string {
  if (item.type === ContentType.ANIME || item.genres?.includes('Anime')) {
    return `/animes/${item.id}/temporada/${season}/episodio/${episode}`;
  }
  return `/series/${item.id}/temporada/${season}/episodio/${episode}`;
}

export function getWatchPartyRoute(roomId: string): string {
  return `/sala/${roomId}`;
}

export function getWatchRoute(
  item: ContentItem,
  season?: number,
  episode?: number,
  isTv: boolean = false
): string {
  const prefix = isTv ? '/tv' : '';
  const isAnime = item.type === ContentType.ANIME || item.genres?.includes('Anime');
  const isSeries = item.mediaFormat !== 'movie' && (item.type === ContentType.SERIES || isAnime);

  if (isSeries) {
    const s = season ?? 1;
    const e = episode ?? 1;
    const typeSegment = isAnime ? 'anime' : 'serie';
    return `${prefix}/assistir/${typeSegment}/${encodeURIComponent(item.id)}/t/${s}/e/${e}`;
  }

  return `${prefix}/assistir/filme/${encodeURIComponent(item.id)}`;
}

export function parseWatchRoute(pathname: string): ParsedWatchRoute {
  if (!pathname) return { isWatch: false, isTv: false };

  // Match /tv/assistir or /assistir
  const isTv = /^\/tv\/assistir(?:\/|$)/.test(pathname);
  const cleanPath = isTv ? pathname.replace(/^\/tv/, '') : pathname;

  if (!cleanPath.startsWith('/assistir/')) {
    return { isWatch: false, isTv: false };
  }

  // 1. /assistir/filme/:id
  const movieMatch = cleanPath.match(/^\/assistir\/filme\/([^/?#]+)\/?$/i);
  if (movieMatch) {
    return {
      isWatch: true,
      isTv,
      mediaType: 'movie',
      id: safeDecodeWatchId(movieMatch[1])
    };
  }

  // 2. /assistir/(serie|anime)/:id/t/:season/e/:episode or /assistir/(serie|anime)/:id
  const seriesMatch = cleanPath.match(/^\/assistir\/(serie|anime)\/([^/?#]+)(?:\/t\/([1-9]\d*)\/e\/([1-9]\d*))?\/?$/i);
  if (seriesMatch) {
    const mediaType = seriesMatch[1].toLowerCase() === 'anime' ? 'anime' : 'series';
    const id = safeDecodeWatchId(seriesMatch[2]);
    const season = seriesMatch[3] ? parseInt(seriesMatch[3], 10) : undefined;
    const episode = seriesMatch[4] ? parseInt(seriesMatch[4], 10) : undefined;
    return {
      isWatch: true,
      isTv,
      mediaType,
      id,
      season,
      episode
    };
  }

  return { isWatch: true, isTv };
}

function safeDecodeWatchId(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

