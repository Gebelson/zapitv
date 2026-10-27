import assert from 'node:assert/strict';
import { ContentType, type ContentItem } from '../types';
import { LocalDataStore, type LocalDataBackend } from '../src/core/storage/localDataStore';
import { StorageService } from '../src/core/storage/storageService';
import { contentKey, listCodec, normalizeProgress, watchStateCodec, type WatchProgress } from '../src/core/storage/watchState';
import { db } from '../db';
import { UserPreferenceStore } from '../src/core/recommendations/userPreferenceStore';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  blocked = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  removeItem(key: string) { if (this.blocked) throw new Error('blocked'); this.values.delete(key); }
  setItem(key: string, value: string) { if (this.blocked) throw new Error('quota'); this.values.set(key, value); }
}

class MemoryBackend implements LocalDataBackend {
  values = new Map<string, unknown>();
  blocked = false;
  private queue = Promise.resolve();
  async get(key: string) { if (this.blocked) throw new Error('IDB blocked'); return this.values.get(key); }
  async remove(key: string) { if (this.blocked) throw new Error('IDB blocked'); this.values.delete(key); }
  update(key: string, change: (current: unknown) => Promise<unknown>): Promise<unknown> {
    const result = this.queue.then(async () => {
      if (this.blocked) throw new Error('IDB blocked');
      const next = await change(this.values.get(key));
      this.values.set(key, structuredClone(next));
      return next;
    });
    this.queue = result.then(() => {}, () => {});
    return result;
  }
}

const movie: ContentItem = { id: '42', tmdbId: '42', title: 'Mesmo título', type: ContentType.MOVIE, year: 2020, rating: 8, image: '' };
const series: ContentItem = { ...movie, type: ContentType.SERIES };
const progress = (item: ContentItem, time = 100, season?: number, episode?: number, date = '2026-10-27T12:00:00Z'): WatchProgress =>
  ({ contentId: item.id, item, currentTime: time, duration: 1000, percentage: 0, updatedAt: date, season, episode });

async function run() {
  const local = new MemoryStorage();
  const backend = new MemoryBackend();
  const store = () => new LocalDataStore(backend, () => local);
  const old = progress(movie, 80);
  const recent = progress(movie, 200, undefined, undefined, '2026-10-27T13:00:00Z');
  local.setItem('zapitv_local_progress', JSON.stringify([old, recent, { broken: true }]));
  backend.values.set('zapitv_local_progress', [old]);
  local.setItem('zapitv_local_favorites', JSON.stringify(['42', '42', null]));
  backend.values.set('zapitv_local_mylist', ['saved']);
  const legacy = local.getItem('zapitv_local_progress');
  let service = new StorageService(store());
  assert.equal((await service.getContinueWatching()).length, 1);
  assert.equal(service.resolveWatchProgress(movie)?.currentTime, 200, 'stale IDB must not replace newer local progress');
  assert.equal(local.getItem('zapitv_local_progress'), legacy, 'legacy backup remains byte-for-byte intact');
  assert.deepEqual(await service.getFavorites(), ['42']);
  assert.deepEqual(await service.getMyList(), ['saved']);
  const revision = (backend.values.get(watchStateCodec.key) as { revision: number }).revision;
  await service.getContinueWatching();
  assert.equal((backend.values.get(watchStateCodec.key) as { revision: number }).revision, revision, 'migration is idempotent');

  await service.saveProgress(progress(series, 310, 2, 3));
  assert.equal(service.resolveWatchProgress(movie)?.currentTime, 200, 'TMDB movie and TV namespaces remain isolated');
  assert.equal(service.resolveWatchProgress('42'), null, 'ambiguous untyped IDs cannot select a different work');
  assert.equal(service.getPlaybackContinuity(series).season, 2);
  assert.equal(service.getPlaybackContinuity(series).episode, 3);
  assert.equal(service.resolveWatchProgress({ ...movie, id: 'other', tmdbId: undefined }) , null, 'matching title alone is insufficient');
  await Promise.all([
    service.saveProgress(progress(series, 410, 2, 3, '2026-10-27T14:00:00Z')),
    service.saveProgress(progress(series, 150, 2, 4, '2026-10-27T14:01:00Z')),
    service.toggleFavorite('a'), service.toggleFavorite('b'),
    service.toggleMyList('a'), service.toggleMyList('b')
  ]);
  assert.equal(service.resolveEpisodeWatchProgress(series, 2, 3)?.currentTime, 410);
  assert.equal(service.resolveEpisodeWatchProgress(series, 2, 4)?.currentTime, 150);
  assert.equal(service.resolveEpisodeWatchProgress(series, 1, 3), null);
  assert.deepEqual(await service.getFavorites(), ['42', 'a', 'b']);
  assert.deepEqual(await service.getMyList(), ['saved', 'a', 'b']);
  await service.saveProgress(progress(series, 5, 2, 3, '2026-10-27T11:00:00Z'));
  assert.equal(service.resolveWatchProgress(series)?.episode, 4, 'delayed saves must not replace a newer episode');
  assert.equal(normalizeProgress(progress(movie, Number.NaN)), null);
  assert.equal(normalizeProgress(progress(series, 10, -1, 1)), null);
  assert.equal(normalizeProgress(progress(series, 10, 0, 1))?.season, 0, 'TMDB specials in season zero must remain valid');
  assert.equal(normalizeProgress(progress(movie, 0))?.percentage, 0);
  assert.equal(normalizeProgress(progress(movie, 950))?.percentage, 100);
  assert.equal(service.getPlaybackContinuity({ ...movie, id: 'unknown', tmdbId: undefined }).hasStarted, false);
  const anime = { ...series, id: 'anime-1', tmdbId: undefined, type: ContentType.ANIME, aniListId: 123 };
  await service.saveProgress(progress(anime, 120, 1, 2));
  assert.equal(service.getPlaybackContinuity(anime).episode, 2);
  await service.deleteProgress(anime);
  const animeMovie = { ...anime, id: 'anime-movie', mediaFormat: 'movie' as const };
  await service.saveProgress(progress(animeMovie, 120, 1, 1));
  assert.equal(service.getPlaybackContinuity(animeMovie).label, '02:00');
  await service.deleteProgress(animeMovie);
  const legacyIdentity = { ...series, id: 'alias-old', tmdbId: '900' };
  await service.saveProgress(progress(legacyIdentity, 200, 1, 1));
  const enrichedIdentity = { ...legacyIdentity, id: 'alias-new', imdbId: 'tt12345678' };
  await service.saveProgress(progress(enrichedIdentity, 300, 1, 2, '2026-10-27T18:00:00Z'));
  assert.equal(service.resolveEpisodeWatchProgress(enrichedIdentity, 1, 1)?.currentTime, 200, 'catalog enrichment cannot orphan earlier episodes');
  assert.equal((await service.getContinueWatching()).filter(p => p.item.tmdbId === '900').length, 1);
  await service.deleteProgress(enrichedIdentity);
  assert.equal(normalizeProgress(progress(movie, 300, 1, 1))?.season, undefined, 'movies ignore incidental episode defaults');

  // Reload and separate-tab writers share the same atomic backend, not a process-wide queue.
  service = new StorageService(store());
  await service.getContinueWatching();
  assert.equal(service.getPlaybackContinuity(movie).currentTime, 200);
  assert.equal(service.getPlaybackContinuity(series).currentTime, 150);
  const otherTab = new StorageService(store());
  await Promise.all([service.toggleMyList('tab-a'), otherTab.toggleMyList('tab-b')]);
  assert.ok((await service.getMyList()).includes('tab-a'));
  assert.ok((await service.getMyList()).includes('tab-b'));

  local.blocked = true;
  await service.saveProgress(progress(movie, 500, undefined, undefined, '2026-10-27T15:00:00Z'));
  const withOnlyDb = new StorageService(store());
  await withOnlyDb.getContinueWatching();
  assert.equal(withOnlyDb.getPlaybackContinuity(movie).currentTime, 500, 'quota failure must not skip IDB');
  local.blocked = false;
  backend.blocked = true;
  await service.saveProgress(progress(movie, 600, undefined, undefined, '2026-10-27T16:00:00Z'));
  const withOnlyLocal = new StorageService(store());
  await withOnlyLocal.getContinueWatching();
  assert.equal(withOnlyLocal.getPlaybackContinuity(movie).currentTime, 600, 'IDB failure falls back to localStorage');
  backend.blocked = false;
  const reconnected = new StorageService(store());
  await reconnected.getContinueWatching();
  assert.equal(reconnected.getPlaybackContinuity(movie).currentTime, 600, 'recovered IDB must not resurrect stale progress');
  assert.equal((backend.values.get(watchStateCodec.key) as { data: { items: WatchProgress[] } }).data.items.find(p => p.item.type === ContentType.MOVIE)?.currentTime, 600);
  const malformed = JSON.parse(local.getItem(watchStateCodec.key)!);
  local.setItem(watchStateCodec.key, JSON.stringify({ ...malformed, revision: 999, data: null }));
  const recoveredCopy = new StorageService(store());
  await recoveredCopy.getContinueWatching();
  assert.equal(recoveredCopy.getPlaybackContinuity(movie).currentTime, 600, 'invalid snapshot falls back to the valid replica');

  const beforeInvalidImport = await reconnected.exportDataAsJson();
  assert.equal(await reconnected.importDataFromJson('{"progress":[{}]}'), false);
  assert.equal(await reconnected.importDataFromJson('{"episodeProgress":{"bad":{}}}'), false);
  assert.deepEqual(JSON.parse(await reconnected.exportDataAsJson()).progress, JSON.parse(beforeInvalidImport).progress);
  const exported = JSON.parse(await reconnected.exportDataAsJson());
  delete exported.providers; // This test imports user data, not provider configuration.
  assert.equal(await reconnected.importDataFromJson(JSON.stringify(exported)), true);
  assert.equal((await reconnected.getContinueWatching()).length, 2, 'import cannot duplicate Continue Watching');
  assert.equal(await reconnected.importDataFromJson(JSON.stringify({ version: '1.1', progress: [recent] })), true);
  await reconnected.deleteProgress(series.id);
  assert.equal((await reconnected.getContinueWatching()).length, 2, 'ambiguous raw ID cannot delete two works');
  await reconnected.deleteProgress(series);
  assert.equal((await reconnected.getContinueWatching()).length, 1);
  assert.equal(reconnected.resolveEpisodeWatchProgress(series, 2, 3), null);
  await reconnected.clearAllProgress();
  assert.equal(local.getItem('zapitv_local_progress'), null, 'an explicit clear also removes the legacy history backup');
  const cleared = new StorageService(store());
  assert.deepEqual(await cleared.getContinueWatching(), [], 'a cleared v2 record cannot re-import the legacy backup');
  assert.ok(contentKey(movie) !== contentKey(series));
  assert.ok((await store().read(listCodec('mylist'))).includes('tab-b'));
  local.blocked = true;
  backend.blocked = true;
  await cleared.saveProgress(progress(movie, 700, undefined, undefined, '2026-10-27T17:00:00Z'));
  assert.equal((await cleared.getContinueWatching())[0].currentTime, 700, 'both unavailable stores still preserve the active session');
  local.blocked = false;
  backend.blocked = false;

  // Recommendation preferences must also persist to IDB when localStorage throws.
  const originalPut = db.keyValueStore.put;
  const originalGet = db.keyValueStore.get;
  let written = false;
  db.keyValueStore.put = (async () => { written = true; return 'key'; }) as typeof originalPut;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: local } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  try {
    const prefs = new UserPreferenceStore();
    local.blocked = true;
    await prefs.persistProfile('existing');
    assert.equal(written, true);
    const oldPreferences = { ...prefs.getPreferencesSync('existing'), interactionCount: 2, lastUpdated: 10 };
    local.blocked = false;
    local.setItem('zapitv_user_prefs_existing', JSON.stringify(oldPreferences));
    const newerPreferences = { ...oldPreferences, lastUpdated: 20, watchedContentIds: ['newer'] };
    db.keyValueStore.get = (async () => ({ key: 'key', value: newerPreferences })) as typeof originalGet;
    const reloadedPreferences = new UserPreferenceStore();
    assert.deepEqual((await reloadedPreferences.getPreferences('existing')).watchedContentIds, ['newer']);
    db.keyValueStore.get = (async () => ({ key: 'key', value: { ...newerPreferences, profileId: 'from-idb' } })) as typeof originalGet;
    let savedPreferences: unknown;
    db.keyValueStore.put = (async row => { savedPreferences = row.value; return 'key'; }) as typeof originalPut;
    await new UserPreferenceStore().persistProfile('from-idb');
    assert.deepEqual((savedPreferences as { watchedContentIds: string[] }).watchedContentIds, ['newer'], 'startup metadata must not replace IDB preferences with a blank profile');
  } finally {
    db.keyValueStore.put = originalPut;
    db.keyValueStore.get = originalGet;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
  console.log('storage_integrity: identity, migration, legacy backup, concurrency, reload, lists, invalid data and storage failures passed');
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
