import assert from 'node:assert/strict';
import { findCatalogEpisode } from '../src/core/providers/providerRegistry';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { ContentType, type ContentItem } from '../types';

const ep = (season: number | undefined, url: string) => ({ id: url, number: 1, season, title: 'Ep', description: '', image: '', videoUrl: url });
const episodes = [ep(2, '/s2e1.mp4'), ep(1, '/s1e1.mp4'), ep(undefined, '/legacy-s1e1.mp4')];
assert.equal(findCatalogEpisode(episodes, { season: 2, episode: 1 })?.videoUrl, '/s2e1.mp4');
assert.equal(findCatalogEpisode(episodes, { season: 1, episode: 1 }), undefined, 'conflicting duplicates cannot choose a random video');
assert.equal(findCatalogEpisode([ep(undefined, '/legacy.mp4')], { season: 2, episode: 1 }), undefined);
assert.equal(findCatalogEpisode([ep(undefined, '/legacy.mp4')], { season: 1, episode: 1 })?.videoUrl, '/legacy.mp4');
assert.equal(findCatalogEpisode([ep(0, '/special.mp4')], { season: 0, episode: 1 })?.videoUrl, '/special.mp4');
const item: ContentItem = { id: 'fixture', title: 'Fixture Series', type: ContentType.SERIES, year: 2020, rating: 8, image: '' };
const identity = canonicalIdentityService.buildIdentity(item, { season: 0, episode: 1 });
assert.equal(sourceConfidenceEngine.evaluate({ title: 'Fixture Series S01E01', url: 'https://media.example/video.mp4?token=private-secret' }, identity).isMatch, false);
assert.equal(sourceConfidenceEngine.evaluate({ name: 'Fixture Series S02E01', title: '1080p', url: 'https://media.example/fixture.mp4' }, identity).isMatch, false);
assert.ok(!JSON.stringify(sourceConfidenceEngine.getRecentDiagnostics()).includes('private-secret'));
sourceConfidenceEngine.evaluate({ imdbId: 'tt1111111', url: '/api/proxy?url=https%3A%2F%2Fmedia.example%2Fencoded-secret' },
  { ...identity, imdbId: 'tt2222222' });
assert.ok(!JSON.stringify(sourceConfidenceEngine.getRecentDiagnostics()).includes('encoded-secret'));
const hope = canonicalIdentityService.buildIdentity({ ...item, type: ContentType.MOVIE, title: 'Hope: O Primeiro Impacto', year: 2020 });
assert.equal(sourceConfidenceEngine.evaluate({ title: 'unrelated adult release', infoHash: 'd0eacddff07a24173d8f7dc11a18ef3ed32b886a' }, hope).isMatch, false);
console.log('P1 sources: season/episode isolation, ambiguous local sources, quarantine and sanitized diagnostics passed');
process.exit(0);
