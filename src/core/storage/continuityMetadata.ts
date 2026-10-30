import { isCorruptedPosterUrl } from '../catalog/posterValidation';
import { ContentItem, ContentType } from '../../../types';

export const hasContentTitle = (title: unknown): title is string => typeof title === 'string' &&
  !!title.trim() && !/^(?:tmdb[-:]\d+|tt\d+|(?:movie|series|anime):.*|anilist[-:]\d+|undefined|null|Carregando informações…)$/i.test(title.trim());
export function validContentImage(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || isCorruptedPosterUrl(value) || /(?:undefined|null|unsplash\.com|__NO_IMAGE__)/i.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export function contentPoster(item?: Partial<ContentItem>): string {
  return [item?.poster, item?.image].find(validContentImage) || '';
}
/** Preferred source wins only for usable fields. Identity and progress keys belong to the record. */
export function mergeContinuityMetadata(record: ContentItem, preferred?: Partial<ContentItem>): ContentItem {
  if (!preferred) return { ...record };
  const merged = { ...record, ...Object.fromEntries(Object.entries(preferred).filter(([,v]) => v !== undefined && v !== null && v !== '')),
    id: record.id, canonicalId: record.canonicalId, type: record.type, mediaFormat: record.mediaFormat ?? preferred.mediaFormat } as ContentItem;
  merged.title = hasContentTitle(preferred.title) ? preferred.title : record.title;
  merged.originalTitle = hasContentTitle(preferred.originalTitle) ? preferred.originalTitle : record.originalTitle;
  merged.year = preferred.year && preferred.year > 1800 ? preferred.year : record.year;
  merged.rating = preferred.rating && preferred.rating > 0 ? preferred.rating : record.rating;
  merged.image = contentPoster(preferred) || contentPoster(record);
  merged.poster = merged.image;
  return merged;
}


export function continuityContentType(value: unknown): ContentType | null {
  if (Object.values(ContentType).includes(value as ContentType)) return value as ContentType;
  const alias = String(value || '').toLowerCase();
  return alias === 'movie' || alias === 'filme' ? ContentType.MOVIE : ['series','serie','tv'].includes(alias) ? ContentType.SERIES : alias === 'anime' ? ContentType.ANIME : null;
}
