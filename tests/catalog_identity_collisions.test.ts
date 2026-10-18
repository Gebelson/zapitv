import assert from 'node:assert/strict';
import { ContentType, type ContentItem } from '../types';
import { catalogReleaseStore } from '../src/core/catalog/CatalogReleaseStore';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';

const movie: ContentItem = {
  id: 'tmdb-123', tmdbId: '123', title: 'Obra de teste', type: ContentType.MOVIE,
  mediaFormat: 'movie', year: 2026, rating: 7, image: ''
};
const series: ContentItem = {
  ...movie, type: ContentType.SERIES, mediaFormat: 'series'
};

assert.equal(deduplicateContentItems([structuredClone(movie), structuredClone(series)]).length, 2);
catalogReleaseStore.restoreSnapshot(null);
assert.equal(catalogReleaseStore.addRelease(structuredClone(movie)), true);
assert.equal(catalogReleaseStore.addRelease(structuredClone(series)), true);
assert.equal(catalogReleaseStore.getReleases().length, 2);
assert.equal(catalogReleaseStore.addEpisodeToWork('tmdb-123', {
  id: 'episode-1', number: 1, season: 1, title: 'Episódio 1'
}, ContentType.SERIES), true);
assert.equal(catalogReleaseStore.getReleases().find(item => item.type === ContentType.MOVIE)?.episodes?.length || 0, 0);
assert.equal(catalogReleaseStore.getReleases().find(item => item.type === ContentType.SERIES)?.episodes?.length, 1);
catalogReleaseStore.restoreSnapshot(null);
catalogReleaseStore.recordPending({ id: 'same-id', title: 'Filme pendente', type: ContentType.MOVIE, reason: 'sem fonte' });
catalogReleaseStore.recordPending({ id: 'same-id', title: 'Série pendente', type: ContentType.SERIES, reason: 'sem fonte' });
assert.equal(catalogReleaseStore.getPendingCount(), 2);
console.log('IDs iguais de filme e série não colidem: OK');
process.exit(0);
