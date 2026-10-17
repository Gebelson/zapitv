import { test, expect } from 'vitest';
import { ContentType, type ContentItem } from '../types';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { CamBlockerEngine } from '../src/core/catalog/CamBlockerEngine';
import { streamValidator } from '../src/core/providers/streamValidator';

test('Política de filmes em cartaz e verificação de streams CAM', async () => {
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

  expect(theatricalFilterService.isMovieAllowedSync(inTheaters)).toBe(true);
  expect(catalogEligibilityService.isItemPubliclyPlayableSync(inTheaters)).toBe(true);
  expect(CamBlockerEngine.isCamStream({ title: 'Filme lançado em cartaz WEB-DL 1080p' }, inTheaters)).toBe(false);
  expect(CamBlockerEngine.isCamStream({ title: 'Filme lançado em cartaz HDCAM' }, inTheaters)).toBe(true);
  expect(streamValidator.isStreamMatchingTargetTitle({ title: 'Filme lançado em cartaz HDCAM 720p', url: 'https://example.org/movie.mp4' }, inTheaters.title)).toBe(true);
  expect(streamValidator.isStreamMatchingTargetTitle({ title: 'Filme lançado em cartaz Trailer CAM', url: 'https://example.org/trailer.mp4' }, inTheaters.title)).toBe(false);
  expect(theatricalFilterService.isMovieAllowedSync(upcoming)).toBe(false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [] }), { status: 200 });
  try {
    const evaluation = await theatricalFilterService.evaluateMovie(inTheaters);
    expect(evaluation.status).toBe('IN_THEATERS');
    expect(evaluation.allowed).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
