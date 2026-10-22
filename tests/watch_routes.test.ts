import assert from 'node:assert/strict';
import { ContentItem, ContentType } from '../types';
import { getWatchRoute, parseWatchRoute } from '../src/core/routes/navigationRoutes';
import { playbackSessionService } from '../src/core/session/playbackSessionService';

const movie = { id: 'tt0133093', type: ContentType.MOVIE } as ContentItem;
const series = { id: 'series:tmdb:1399', type: ContentType.SERIES } as ContentItem;
const anime = { id: 'anime:anilist:20', type: ContentType.ANIME, mediaFormat: 'series' } as ContentItem;
const animeMovie = { id: 'anime:anilist:999', type: ContentType.ANIME, mediaFormat: 'movie' } as ContentItem;

for (const [item, season, episode, tv] of [
  [movie, undefined, undefined, false],
  [movie, undefined, undefined, true],
  [series, 2, 7, false],
  [series, 2, 7, true],
  [anime, 1, 12, false],
  [anime, 1, 12, true],
  [animeMovie, undefined, undefined, true],
] as Array<[ContentItem, number | undefined, number | undefined, boolean]>) {
  const url = getWatchRoute(item, season, episode, tv);
  const parsed = parseWatchRoute(url);
  assert.equal(parsed.isWatch, true);
  assert.equal(parsed.isTv, tv);
  assert.equal(parsed.id, item.id);
  if (season) assert.equal(parsed.season, season);
  if (episode) assert.equal(parsed.episode, episode);
}

assert.equal(parseWatchRoute('/tv/assistir/serie/id/t/1/e/2/extra').isWatch, true);
assert.equal(parseWatchRoute('/tv/assistir/serie/id/t/1/e/2/extra').id, undefined);
assert.equal(parseWatchRoute('/assistir/filme/tt123').mediaType, 'movie');
assert.equal(parseWatchRoute('/assistir/serie/id/t/2/e/3').episode, 3);
assert.equal(parseWatchRoute('/tv/filmes').isWatch, false);

const first = playbackSessionService.startSession(movie.id, 'manual_start');
assert.equal(first.introPlayed, false);
const second = playbackSessionService.startSession(movie.id, 'manual_start');
assert.notEqual(second.sessionId, first.sessionId, 'Novo clique manual deve criar nova sessão');
playbackSessionService.markIntroPlayed(second.sessionId);
const nextEpisode = playbackSessionService.startSession(series.id, 'continuous_playback', 2, 8);
assert.equal(nextEpisode.sessionId, second.sessionId);
assert.equal(nextEpisode.introPlayed, true);
playbackSessionService.endSession();

console.log('Rotas de reprodução e continuidade de sessão: OK');
