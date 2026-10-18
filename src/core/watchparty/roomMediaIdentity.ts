import { ContentItem, ContentType } from '../../../types';
import { WatchPartyMediaMetadata } from './watchPartyTypes';

type RoomMedia = ContentItem | WatchPartyMediaMetadata;

export const roomMediaFormat = (media: RoomMedia): 'movie' | 'series' =>
  media.mediaFormat || (media.type === ContentType.MOVIE || media.type === 'movie' ? 'movie' : 'series');

export const roomMediaType = (media: RoomMedia): ContentType =>
  Object.values(ContentType).includes(media.type as ContentType)
    ? media.type as ContentType
    : roomMediaFormat(media) === 'movie' ? ContentType.MOVIE : ContentType.SERIES;

export const matchesRoomMedia = (candidate: ContentItem, media: RoomMedia): boolean => {
  const candidateFormat = candidate.mediaFormat || (candidate.type === ContentType.MOVIE ? 'movie' : 'series');
  if (candidateFormat !== roomMediaFormat(media)) return false;
  if (media.imdbId && candidate.imdbId && candidate.imdbId !== media.imdbId) return false;
  if (media.tmdbId && candidate.tmdbId && candidate.tmdbId !== media.tmdbId) return false;
  if (media.imdbId && candidate.imdbId === media.imdbId) return true;
  if (media.tmdbId && candidate.tmdbId === media.tmdbId) return true;
  return Boolean(media.id && candidate.id === media.id && candidate.title === media.title);
};
