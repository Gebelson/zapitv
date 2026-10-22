import { ContentItem, ContentType } from '../../../types';
import { adultContentService } from '../adult/AdultContentService';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';

/** Seleciona referências do catálogo existente sem copiar metadados nem expor obras bloqueadas. */
export function getTvScreensaverItems(groups: ContentItem[][], isChild: boolean): ContentItem[] {
  const buckets: ContentItem[][] = [[], [], []];
  const seenIds = new Set<string>();
  const seenBackdrops = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.type}:${item.canonicalId || item.id}`;
      if (!item.backdrop || seenIds.has(key) || seenBackdrops.has(item.backdrop) ||
          !catalogEligibilityService.isItemPubliclyPlayableSync(item) ||
          adultContentService.isAdultContent(item) ||
          (isChild && /(?:\b16\b|\b18\b|TV-MA|NC-17|^R$)/i.test(item.ageRating || ''))) continue;
      seenIds.add(key);
      seenBackdrops.add(item.backdrop);
      buckets[item.type === ContentType.ANIME ? 2 : item.type === ContentType.SERIES ? 1 : 0].push(item);
      if (seenIds.size >= 90) break;
    }
    if (seenIds.size >= 90) break;
  }
  const ordered: ContentItem[] = [];
  for (let index = 0; ordered.length < seenIds.size; index++) {
    for (const bucket of buckets) if (bucket[index]) ordered.push(bucket[index]);
  }
  return ordered;
}
