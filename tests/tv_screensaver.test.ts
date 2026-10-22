import assert from 'node:assert/strict';
import { ContentItem, ContentType } from '../types';
import { getTvScreensaverItems } from '../src/core/tv/tvScreensaverCatalog';
import { TV_IDLE_MS } from '../src/core/tv/useTvIdle';
import { TV_SCREENSAVER_SLIDE_MS } from '../src/components/tv/TvScreensaver';

const item = (id: string, type: ContentType, ageRating?: string): ContentItem => ({
  id, title: `Obra ${id}`, type, ageRating, year: 2020, rating: 8,
  image: `https://example.test/${id}-poster.jpg`,
  backdrop: `https://example.test/${id}-backdrop.jpg`,
  availabilityStatus: 'verified'
});

assert.equal(TV_IDLE_MS, 300_000);
assert.equal(TV_SCREENSAVER_SLIDE_MS, 15_000);

const movie = item('movie', ContentType.MOVIE);
const series = item('series', ContentType.SERIES);
const anime = item('anime', ContentType.ANIME);
const mature = item('mature', ContentType.MOVIE, '18');
const unavailable = { ...item('unavailable', ContentType.MOVIE), availabilityStatus: 'unavailable' as const };
const portraitOnly = { ...item('portrait', ContentType.MOVIE), backdrop: undefined };
const duplicateImage = { ...item('duplicate', ContentType.MOVIE), backdrop: movie.backdrop };

const result = getTvScreensaverItems([[movie, mature], [series, anime, unavailable, portraitOnly, duplicateImage]], true);
assert.deepEqual(result.map(entry => entry.id), ['movie', 'series', 'anime']);
assert.equal(getTvScreensaverItems([[mature]], false).length, 1);
assert.equal(getTvScreensaverItems([[movie], [movie]], false).length, 1);
console.log('Descanso de tela TV: tempos, elegibilidade, perfil infantil, diversidade e deduplicação OK');
process.exit(0);
