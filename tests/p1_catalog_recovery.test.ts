import assert from 'node:assert/strict';
import { CatalogDiscoveryService } from '../src/core/catalog/CatalogDiscoveryService';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { aniListClient } from '../src/core/anilist/aniListClient';
import { ContentType, type ContentItem } from '../types';
import { CatalogPaginationSession } from '../src/core/catalog/catalogPaginationSession';

const originals = new Map<string, unknown>();
let failPage = -1;
function replace(target: object, key: string, value: unknown) {
  const object = target as Record<string, unknown>;
  originals.set(key, object[key]); object[key] = value;
}
const data = (type: ContentType, page: number): ContentItem[] => page > 4 ? [] : Array.from({ length: 20 }, (_, n) => ({
  id: `p1-${type}-${page}-${n}`, title: `Catalog fixture ${type} ${page} ${n}`, type, year: 2020, rating: 8,
  image: '/fixture.jpg', genres: type === ContentType.ANIME ? ['Anime', 'Drama'] : ['Drama'], availabilityStatus: 'verified'
}));
const factory = (type: ContentType) => async (page: number) => {
  if (page === failPage) throw new Error('temporary network failure');
  return { items: data(type, page), total: 80 };
};
async function run() {
  for (const [name, type] of [['Movies', ContentType.MOVIE], ['Series', ContentType.SERIES]] as const) {
    replace(tmdbService, `getPopular${name}WithMeta`, factory(type));
    replace(tmdbService, `getDiscover${name}WithMeta`, factory(type));
  }
  replace(tmdbService, 'getAnimesWithMeta', factory(ContentType.ANIME));
  replace(tmdbService, 'getAnimeMoviesWithMeta', async () => ({ items: [], total: 0 }));
  replace(tmdbService, 'getTopRatedMovies', async () => []);
  replace(tmdbService, 'getCinemetaCatalog', async () => []);
  const anilistOriginal = aniListClient.getPopularAnimes;
  aniListClient.getPopularAnimes = async () => [];
  try {
    let partial = true;
    (tmdbService as any).getCinemetaCatalog = async () => { if (partial) throw new Error('temporary secondary failure'); return []; };
    const partialService = new CatalogDiscoveryService();
    assert.equal((await partialService.discoverMovies(1)).isPartial, true, 'positive partial results are preserved');
    partial = false;
    assert.equal((await partialService.discoverMovies(1)).isPartial, false, 'partial response cannot poison the positive cache');
    for (const category of ['Movies', 'Series', 'Animes'] as const) {
      const service = new CatalogDiscoveryService();
      const discover = service[`discover${category}`].bind(service);
      const first = await discover(1);
      assert.equal((await discover(1, 'Drama')).items.length, first.items.length, 'previous discovery cannot hide another filter');
      failPage = 2;
      await assert.rejects(discover(2), /CATALOG_TEMPORARILY_UNAVAILABLE/);
      failPage = -1;
      const ids = new Set(first.items.map(item => item.id));
      for (const page of [2, 3, 4]) {
        const result = await discover(page);
        assert.equal(result.hasMore, true);
        result.items.forEach(item => ids.add(item.id));
      }
      assert.ok(ids.size >= 80, `${category}: full fixture catalog must remain reachable beyond 56`);
      assert.equal((await discover(5)).hasMore, false, 'successful empty response is the real end');
      assert.equal((await discover(2)).items.length, 20, 'cache remains reusable');
      console.log(`P1 catalog ${category}: filters, beginning/middle/end, uniqueness and retry passed (${ids.size} fixture items)`);
    }
    let clock = 0;
    let mode: 'error' | 'partial' | 'ok' = 'error';
    const requested: number[] = [];
    const cursor = new CatalogPaginationSession(async page => {
      requested.push(page);
      if (mode === 'error') throw new Error('temporary');
      return { items: data(ContentType.MOVIE, page), page, hasMore: page < 3,
        isPartial: mode === 'partial', totalAvailable: 60, totalDiscovered: page * 20 };
    }, () => clock);
    await assert.rejects(cursor.loadNext());
    assert.equal(await cursor.loadNext(), null, 'retry cooldown prevents repeated remote commands from flooding providers');
    clock += 3001; mode = 'ok';
    assert.equal((await cursor.loadNext())?.page, 1, 'a failed request cannot skip page one');
    mode = 'partial';
    assert.equal((await cursor.loadNext())?.page, 2);
    clock += 3001; mode = 'ok';
    assert.equal((await cursor.loadNext())?.page, 2, 'partial positive results cannot skip the failed provider page');
    await Promise.all([cursor.loadNext(), cursor.loadNext()]);
    assert.equal(await cursor.loadNext(), null, 'end of catalog does not loop');
    assert.deepEqual(requested, [1, 1, 2, 2, 3]);
    console.log('P1 TV cursor: near-end requests, cooldown, concurrency, retry and exhaustion passed');
  } finally {
    for (const [key, value] of originals) (tmdbService as unknown as Record<string, unknown>)[key] = value;
    aniListClient.getPopularAnimes = anilistOriginal;
  }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
