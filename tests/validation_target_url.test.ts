import { test, expect } from 'vitest';
import { resolveValidationTargetUrl } from '../src/core/providers/validationTargetUrl';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { DEFAULT_HERO_BANNER_SEEDS } from '../src/core/catalog/heroCarouselStore';

test('Validação da URL real da mídia e status do catálogo', () => {
  const mediaUrl = 'https://provider.example/video.mp4?token=abc';
  expect(resolveValidationTargetUrl(mediaUrl)).toBe(mediaUrl);
  expect(resolveValidationTargetUrl(`/api/proxy?url=${encodeURIComponent(mediaUrl)}`)).toBe(mediaUrl);
  expect(resolveValidationTargetUrl('/api/proxy?url=file%3A%2F%2Fprivate')).toBeNull();
  expect(resolveValidationTargetUrl('/api/proxy?url=')).toBeNull();
  expect(resolveValidationTargetUrl('/api/other')).toBeNull();

  for (const item of [
    FEATURED_CATALOG_ITEMS.find(item => item.id === 'movie-verity-2026'),
    DEFAULT_HERO_BANNER_SEEDS.find(item => item.id === 'movie-verity-2026')
  ]) {
    expect(item).toBeDefined();
    expect(item?.availabilityStatus).not.toBe('verified');
    expect(item?.audioStatus).not.toBe('pt-br-dubbed');
  }
});
