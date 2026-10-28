import { ContentItem, ContentType } from '../../../types';
import type { DataCodec } from './localDataStore';

export interface WatchProgress {
  contentId: string;
  item: ContentItem;
  season?: number;
  episode?: number;
  currentTime: number;
  duration: number;
  percentage: number;
  updatedAt: string;
}

export interface EpisodeWatchProgress extends Omit<WatchProgress, 'item'> {
  season: number;
  episode: number;
  contentKey?: string;
}

export interface WatchState {
  items: WatchProgress[];
  episodes: Record<string, EpisodeWatchProgress>;
}

export function contentAliases(item: ContentItem): string[] {
  const ids = new Set<string>();
  if (typeof item.id === 'string') {
    ids.add(`id:${item.id.trim()}`);
    if (/^tt\d+$/.test(item.id)) ids.add(`imdb:${item.id}`);
    if (/^tmdb-\d+$/.test(item.id)) ids.add(`tmdb:${item.id.slice(5)}`);
  }
  if (item.canonicalId) ids.add(`canonical:${item.canonicalId}`);
  if (item.imdbId) ids.add(`imdb:${item.imdbId.trim()}`);
  if (item.tmdbId) ids.add(`tmdb:${String(item.tmdbId).trim()}`);
  if (item.aniListId) ids.add(`anilist:${item.aniListId}`);
  return [...ids];
}

export function sameContent(a: ContentItem, b: ContentItem): boolean {
  if (a.type !== b.type || (a.mediaFormat && b.mediaFormat && a.mediaFormat !== b.mediaFormat)) return false;
  const ids = contentAliases(b);
  return contentAliases(a).some(id => ids.includes(id));
}

export function contentKey(item: ContentItem): string {
  const identity = item.canonicalId ? `canonical:${item.canonicalId}` : item.imdbId ? `imdb:${item.imdbId}` :
    item.tmdbId ? `tmdb:${item.tmdbId}` : item.aniListId ? `anilist:${item.aniListId}` :
      /^tmdb-\d+$/.test(item.id) ? `tmdb:${item.id.slice(5)}` : `id:${item.id}`;
  return JSON.stringify([item.type, item.mediaFormat ?? (item.type === ContentType.MOVIE ? 'movie' : 'series'), identity]);
}

export const episodeKey = (key: string, season: number, episode: number): string => JSON.stringify([key, season, episode]);
const validPart = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 1;
const validSeason = (n: unknown): n is number => n === 0 || validPart(n);

export function normalizeProgress(value: unknown): WatchProgress | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as WatchProgress;
  if (typeof p.contentId !== 'string' || !p.contentId.trim() || !p.item || typeof p.item.id !== 'string' ||
    !p.item.id.trim() || typeof p.item.title !== 'string' || !Object.values(ContentType).includes(p.item.type) ||
    !Number.isFinite(p.currentTime) || p.currentTime < 0 || !Number.isFinite(p.duration) || p.duration <= 0) return null;
  const ids = [p.item.id, p.item.imdbId, p.item.tmdbId && String(p.item.tmdbId), p.item.tmdbId && `tmdb-${p.item.tmdbId}`, p.item.canonicalId];
  if (!ids.includes(p.contentId)) return null;
  const episodic = p.item.type !== ContentType.MOVIE && p.item.mediaFormat !== 'movie';
  if (episodic && (p.season !== undefined || p.episode !== undefined) && (!validSeason(p.season) || !validPart(p.episode))) return null;
  const currentTime = Math.min(p.currentTime, p.duration);
  const percent = currentTime / p.duration * 100;
  const updatedAt = p.updatedAt === undefined ? new Date(0).toISOString() : p.updatedAt;
  if (!Number.isFinite(Date.parse(updatedAt))) return null;
  return { ...p, contentId: p.contentId.trim(), currentTime,
    season: episodic ? p.season : undefined, episode: episodic ? p.episode : undefined,
    percentage: percent >= 92 ? 100 : Math.round(percent), updatedAt };
}

export function normalizeEpisode(raw: unknown): EpisodeWatchProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as EpisodeWatchProgress;
  if (typeof p.contentId !== 'string' || !p.contentId || !validSeason(p.season) || !validPart(p.episode) ||
    !Number.isFinite(p.currentTime) || p.currentTime < 0 || !Number.isFinite(p.duration) || p.duration <= 0 ||
    !Number.isFinite(Date.parse(p.updatedAt))) return null;
  const currentTime = Math.min(p.currentTime, p.duration);
  const pct = currentTime / p.duration * 100;
  return { ...p, currentTime, percentage: pct >= 92 ? 100 : Math.round(pct),
    contentKey: typeof p.contentKey === 'string' ? p.contentKey : undefined };
}

export function mergeWatchStates(...states: WatchState[]): WatchState {
  const groups: { progress: WatchProgress; members: WatchProgress[] }[] = [];
  const episodes: Record<string, EpisodeWatchProgress> = {};
  for (const state of states) {
    for (const raw of state.items) {
      const p = normalizeProgress(raw);
      if (!p) continue;
      const matches = groups.filter(group => group.members.some(member => sameContent(member.item, p.item)));
      if (!matches.length) groups.push({ progress: p, members: [p] });
      else {
        const first = matches[0];
        for (const group of matches.slice(1)) {
          first.members.push(...group.members);
          if (Date.parse(group.progress.updatedAt) > Date.parse(first.progress.updatedAt)) first.progress = group.progress;
          groups.splice(groups.indexOf(group), 1);
        }
        first.members.push(p);
        if (Date.parse(p.updatedAt) > Date.parse(first.progress.updatedAt)) first.progress = p;
      }
    }
  }
  const items = groups.map(group => group.progress);
  const keyAliases = new Map<string, string>();
  const legacyParents = new Map<string, Set<string>>();
  for (const group of groups) {
    const key = contentKey(group.progress.item);
    for (const previous of group.members) {
      keyAliases.set(contentKey(previous.item), key);
      for (const id of [previous.contentId, previous.item.id, previous.item.imdbId, previous.item.tmdbId]) {
        if (!id || previous.item.type === ContentType.MOVIE || previous.item.mediaFormat === 'movie') continue;
        const keys = legacyParents.get(id) ?? new Set<string>();
        keys.add(key);
        legacyParents.set(id, keys);
      }
    }
  }
  const addEpisode = (raw: unknown) => {
    const ep = normalizeEpisode(raw);
    if (!ep) return;
    const parents = legacyParents.get(ep.contentId);
    if (ep.contentKey) ep.contentKey = keyAliases.get(ep.contentKey) ?? ep.contentKey;
    else if (parents?.size === 1) ep.contentKey = [...parents][0];
    const key = episodeKey(ep.contentKey ?? `legacy:${ep.contentId}`, ep.season, ep.episode);
    if (!episodes[key] || Date.parse(ep.updatedAt) >= Date.parse(episodes[key].updatedAt)) episodes[key] = ep;
  };
  for (const state of states) Object.values(state.episodes).forEach(addEpisode);
  // Recover the latest episode even if a legacy write saved the item but failed to save its episode map.
  for (const p of items) if (p.season !== undefined && p.episode !== undefined) {
    const { item, ...ep } = p;
    addEpisode({ ...ep, contentKey: contentKey(item) });
  }
  return { items, episodes };
}

export function normalizeWatchState(value: unknown): WatchState {
  const state = value as Partial<WatchState> | null;
  return mergeWatchStates({ items: Array.isArray(state?.items) ? state.items : [],
    episodes: state?.episodes && typeof state.episodes === 'object' && !Array.isArray(state.episodes) ? state.episodes : {} });
}

export interface StorageScope {
  userId?: string | null;
  profileId?: string | null;
}

export function scopedKey(baseKey: string, scope?: StorageScope | null): string {
  if (scope && scope.userId && scope.profileId) {
    return `usr_${scope.userId}_prf_${scope.profileId}_${baseKey}`;
  }
  return baseKey;
}

export function getWatchStateCodec(scope?: StorageScope | null): DataCodec<WatchState> {
  const isScoped = Boolean(scope && scope.userId && scope.profileId);
  return {
    key: scopedKey('zapitv_watch_state_v2', scope),
    legacyKeys: isScoped ? [] : ['zapitv_local_progress', 'zapitv_episode_progress', 'zapitv_local_history'],
    isValid: value => !!value && typeof value === 'object' && Array.isArray((value as WatchState).items) &&
      !!(value as WatchState).episodes && typeof (value as WatchState).episodes === 'object' && !Array.isArray((value as WatchState).episodes),
    normalize: normalizeWatchState,
    migrate: copies => mergeWatchStates(...copies.map(value => normalizeWatchState(Array.isArray(value) ?
      { items: value, episodes: {} } : { items: [], episodes: value })))
  };
}

export const watchStateCodec: DataCodec<WatchState> = getWatchStateCodec(null);

export const normalizeIds = (value: unknown): string[] => Array.isArray(value) ?
  [...new Set(value.filter((id): id is string => typeof id === 'string' && !!id.trim()).map(id => id.trim()))] : [];

export function getListCodec(name: 'favorites' | 'mylist', scope?: StorageScope | null): DataCodec<string[]> {
  const isScoped = Boolean(scope && scope.userId && scope.profileId);
  return {
    key: scopedKey(`zapitv_local_${name}_v2`, scope),
    legacyKeys: isScoped ? [] : [`zapitv_local_${name}`],
    normalize: normalizeIds,
    isValid: Array.isArray,
    migrate: copies => normalizeIds(copies.flatMap(value => normalizeIds(value)))
  };
}

export function listCodec(name: 'favorites' | 'mylist'): DataCodec<string[]> {
  return getListCodec(name, null);
}
