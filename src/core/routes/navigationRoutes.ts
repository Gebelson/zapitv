import { ContentItem, ContentType } from '../../../types';

export const ROUTES = {
  HOME: '/',
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
  DOWNLOADS: '/downloads',
  MY_LIST: '/minha-lista',
  HISTORY: '/historico',
  PROFILE: '/perfil',
  SETTINGS: '/configuracoes',
  HELP: '/ajuda',
  ACTOR_DETAIL: '/atores/:id',
  AUTH: '/login',
  ADMIN: '/admin',
  ADMIN_WILDCARD: '/admin/*',
  NOT_FOUND: '*'
} as const;

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
