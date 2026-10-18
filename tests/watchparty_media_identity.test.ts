import assert from 'node:assert/strict';
import { ContentType, type ContentItem } from '../types';
import { matchesRoomMedia, roomMediaFormat, roomMediaType } from '../src/core/watchparty/roomMediaIdentity';

const series: ContentItem = {
  id: 'shared-id', title: 'Série correta', type: ContentType.SERIES,
  mediaFormat: 'series', year: 2024, rating: 8, image: '', tmdbId: '123', imdbId: 'tt123'
};
const roomMedia = {
  id: 'shared-id', title: 'Série correta', type: ContentType.SERIES,
  mediaFormat: 'series' as const, tmdbId: '123', imdbId: 'tt123', season: 2, episode: 4
};

assert.equal(matchesRoomMedia(series, roomMedia), true);
assert.equal(matchesRoomMedia({ ...series, type: ContentType.MOVIE, mediaFormat: 'movie' }, roomMedia), false);
assert.equal(matchesRoomMedia({ ...series, imdbId: 'tt999' }, roomMedia), false);
assert.equal(matchesRoomMedia({ ...series, tmdbId: '999' }, roomMedia), false);
assert.equal(matchesRoomMedia({ ...series, id: 'another-id', title: 'Outra série', tmdbId: undefined, imdbId: undefined }, roomMedia), false);
assert.equal(matchesRoomMedia({ ...series, tmdbId: undefined, imdbId: undefined }, { ...roomMedia, title: 'Outra série' }), false);
assert.equal(roomMediaFormat({ ...roomMedia, type: ContentType.ANIME }), 'series');
assert.equal(roomMediaType({ ...roomMedia, type: ContentType.ANIME }), ContentType.ANIME);
console.log('Identidade de mídia da Watch Party: OK');
