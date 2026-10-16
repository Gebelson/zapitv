import assert from 'node:assert/strict';
import { ContentType, type ContentItem } from '../types';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { CamBlockerEngine } from '../src/core/catalog/CamBlockerEngine';

const today = new Date().toISOString().slice(0, 10);
const nextYear = new Date().getFullYear() + 1;
const inTheaters: ContentItem = {
  id: 'test-current-theatrical-release',
  title: 'Filme lançado em cartaz',
  type: ContentType.MOVIE,
  year: new Date().getFullYear(),
  releaseDate: today,
  inTheaters: true,
  rating: 8,
  image: '/poster.png'
};
const upcoming: ContentItem = {
  ...inTheaters,
  id: 'test-future-release',
  title: 'Filme futuro',
  year: nextYear,
  releaseDate: `${nextYear}-12-01`,
  inTheaters: false
};

assert.equal(theatricalFilterService.isMovieAllowedSync(inTheaters), true);
assert.equal(catalogEligibilityService.isItemPubliclyPlayableSync(inTheaters), true);
assert.equal(CamBlockerEngine.isCamStream({ title: 'Filme lançado em cartaz WEB-DL 1080p' }, inTheaters), false);
assert.equal(CamBlockerEngine.isCamStream({ title: 'Filme lançado em cartaz HDCAM' }, inTheaters), true);
assert.equal(theatricalFilterService.isMovieAllowedSync(upcoming), false);

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ results: [] }), { status: 200 });
try {
  const evaluation = await theatricalFilterService.evaluateMovie(inTheaters);
  assert.equal(evaluation.status, 'IN_THEATERS');
  assert.equal(evaluation.allowed, true);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Política de filmes em cartaz: OK');
