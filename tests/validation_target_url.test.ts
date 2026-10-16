import assert from 'node:assert/strict';
import { resolveValidationTargetUrl } from '../src/core/providers/validationTargetUrl';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { DEFAULT_HERO_BANNER_SEEDS } from '../src/core/catalog/heroCarouselStore';

const mediaUrl = 'https://provider.example/video.mp4?token=abc';
assert.equal(resolveValidationTargetUrl(mediaUrl), mediaUrl);
assert.equal(resolveValidationTargetUrl(`/api/proxy?url=${encodeURIComponent(mediaUrl)}`), mediaUrl);
assert.equal(resolveValidationTargetUrl('/api/proxy?url=file%3A%2F%2Fprivate'), null);
assert.equal(resolveValidationTargetUrl('/api/proxy?url='), null);
assert.equal(resolveValidationTargetUrl('/api/other'), null);
for (const item of [
  FEATURED_CATALOG_ITEMS.find(item => item.id === 'movie-verity-2026'),
  DEFAULT_HERO_BANNER_SEEDS.find(item => item.id === 'movie-verity-2026')
]) {
  assert.ok(item);
  assert.notEqual(item.availabilityStatus, 'verified');
  assert.notEqual(item.audioStatus, 'pt-br-dubbed');
}
console.log('Validação da URL real da mídia: OK');
