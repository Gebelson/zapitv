import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { canonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
after(() => canonicalCatalogMaster.dispose());
import { ContentType, type ContentItem } from '../types';
import { LocalDataStore, type LocalDataBackend } from '../src/core/storage/localDataStore';
import { StorageService } from '../src/core/storage/storageService';
import { getWatchStateCodec, mergeWatchStates, resolveContinueWatchingItems, type WatchProgress, type StorageScope } from '../src/core/storage/watchState';
import { syncQueue } from '../src/core/sync/syncQueue';

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};
class MemoryBackend implements LocalDataBackend {
  values = new Map<string, unknown>();
  gates = new Map<string, Array<{ entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> }>>();
  gate(key: string) {
    const gate = { entered: deferred(), release: deferred() };
    this.gates.set(key, [...(this.gates.get(key) ?? []), gate]);
    return gate;
  }
  private async wait(key: string) {
    const gate = this.gates.get(key)?.shift();
    if (gate) { gate.entered.resolve(); await gate.release.promise; }
  }
  async get(key: string) { await this.wait(key); return this.values.get(key); }
  async update(key: string, change: (current: unknown) => Promise<unknown>) {
    await this.wait(key);
    const next = await change(this.values.get(key));
    this.values.set(key, structuredClone(next));
    return next;
  }
}
const item: ContentItem = { id: 'tt1234567', canonicalId: 'tt1234567', title: 'Local fixture', type: ContentType.MOVIE, year: 2020, rating: 8, image: '' };
const progress = (time: number): WatchProgress => ({ contentId: item.id, item, currentTime: time, duration: 1000, percentage: time / 10, updatedAt: new Date().toISOString() });
const A: StorageScope = { userId: 'account-a', profileId: 'shared-profile' };
const B: StorageScope = { userId: 'account-b', profileId: 'shared-profile' };
const selectScope = async (service: StorageService, scope: StorageScope) => {
  await service.setScope(scope);
  // Drain the automatic hydration before installing a test-specific HTTP fixture.
  await new Promise(resolve => setImmediate(resolve));
};

test('continue watching derives membership from active progress and only enriches from recommendations', () => {
  const staleRecommendation = { ...item, id: 'other-account', canonicalId: 'other-account' };
  const catalogItem = { ...item, title: 'Catalog title', image: 'https://image.invalid/catalog.jpg' };
  const rows = resolveContinueWatchingItems([progress(300)], [staleRecommendation, catalogItem]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Catalog title');
  assert.equal(rows[0].image, 'https://image.invalid/catalog.jpg');
  assert.deepEqual(resolveContinueWatchingItems([], [staleRecommendation]), []);
  assert.deepEqual(resolveContinueWatchingItems([progress(1000)], [catalogItem]), []);
  assert.equal(resolveContinueWatchingItems([progress(8)], [catalogItem]).length, 1, 'resume membership must not require watching 2% of a long movie');
});

test('newer server versions resolve previously observed progress even when a local clock was ahead', () => {
  const local = { ...progress(400), updatedAt: '2026-11-01T12:00:00Z' };
  const remote = { ...progress(200), remoteVersion: 1, updatedAt: '2026-10-29T12:00:00Z' };
  const first = mergeWatchStates({ items: [local], episodes: {} }, { items: [remote], episodes: {} });
  assert.equal(first.items[0].currentTime, 400, 'first hydration preserves unknown offline work');
  const next = mergeWatchStates(first, { items: [{ ...remote, remoteVersion: 2, currentTime: 600 }], episodes: {} });
  assert.equal(next.items[0].currentTime, 600, 'observed server version must not be held back permanently by client clock');
  const replay = mergeWatchStates(next, { items: [remote], episodes: {} });
  assert.equal(replay.items[0].currentTime, 600, 'older response cannot undo a newer version');
});

async function fixture() {
  const local = new MemoryStorage();
  const backend = new MemoryBackend();
  const events = new EventTarget();
  const original = new Map(['window', 'localStorage', 'navigator', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(events, { localStorage: local, location: { origin: 'https://local-fixture.invalid' } }) });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  // No real network: every request terminates at this local boundary fixture.
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async () => new Response('{}', { status: 503 }) });
  const store = new LocalDataStore(backend, () => local);
  const service = new StorageService(store);
  await service.getContinueWatching();
  return { local, backend, events, store, service, restore() {
    syncQueue.pauseAndUnloadQueues();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  } };
}

test('A -> B -> reused A rejects the first delayed local read and publishes the final load', { timeout: 5000 }, async () => {
  const f = await fixture();
  try {
    f.local.setItem('zapitv_local_progress', JSON.stringify([progress(50)]));
    const keyA = getWatchStateCodec(A).key;
    f.backend.values.set(keyA, { version: 2, revision: 1, updatedAt: 1, data: { items: [progress(200)], episodes: {} } });
    const first = f.backend.gate(keyA);
    const second = f.backend.gate(keyA);
    const firstLoad = f.service.setScope(A);
    await first.entered.promise;
    await selectScope(f.service, B);
    assert.equal(f.service.resolveWatchProgress(item), null, 'same profile ID in another account cannot import anonymous/account A progress');
    const finalLoad = f.service.setScope(A);
    first.release.resolve();
    await firstLoad;
    await second.entered.promise;
    assert.equal(f.service.resolveWatchProgress(item), null, 'superseded A read cannot populate the new A session');
    let published = false;
    f.events.addEventListener('zapitv_progress_updated', () => { if (f.service.resolveWatchProgress(item)?.currentTime === 200) published = true; });
    second.release.resolve();
    await finalLoad;
    assert.equal(f.service.resolveWatchProgress(item)?.currentTime, 200);
    assert.equal(published, true, 'local hydration must notify after cache is populated');
  } finally { f.restore(); }
});

test('a delayed progress write stays in its originating account and cannot replace the active cache', async () => {
  const f = await fixture();
  try {
    await selectScope(f.service, A);
    const gate = f.backend.gate(getWatchStateCodec(A).key);
    const saving = f.service.saveProgress(progress(200));
    await gate.entered.promise;
    await selectScope(f.service, B);
    gate.release.resolve();
    await saving;
    assert.equal(f.service.resolveWatchProgress(item), null);
    assert.equal((await f.store.read(getWatchStateCodec(A))).items[0]?.currentTime, 200);
    assert.equal(syncQueue.getQueue(B.profileId!, B.userId).length, 0, 'account B must not receive account A mutation');
    assert.equal(syncQueue.getQueue(A.profileId!, A.userId).filter(m => m.type === 'progress').length, 1);
  } finally { f.restore(); }
});

test('identical profile IDs in separate accounts get independent remote checkpoints', async () => {
  const f = await fixture();
  try {
    await selectScope(f.service, A);
    await f.service.saveProgress(progress(200));
    await selectScope(f.service, B);
    await f.service.saveProgress(progress(200));
    assert.equal(syncQueue.getQueue(B.profileId!, B.userId).filter(m => m.type === 'progress').length, 1);
    assert.equal(syncQueue.getQueue(B.profileId!, B.userId).filter(m => m.type === 'history').length, 1);
  } finally { f.restore(); }
});

test('controlled pull updates the real store reactively and keeps pending offline list removals', async () => {
  const f = await fixture();
  try {
    await selectScope(f.service, A);
    await f.service.toggleMyList(item.id);
    await f.service.toggleMyList(item.id);
    let published = false;
    f.events.addEventListener('zapitv_progress_updated', () => { if (f.service.resolveWatchProgress(item)?.currentTime === 300) published = true; });
    globalThis.fetch = async () => Response.json({ profileId: A.profileId, serverTime: Date.now(), progress: [{ id: 'p', profileId: A.profileId, canonicalId: item.id, contentType: ContentType.MOVIE, season: 0, episode: 0, positionSec: 300, durationSec: 1000, progressPercent: 30, isCompleted: 0, version: 1, updatedAt: Date.now() }], history: [], favorites: [], myList: [{ id: 'l', profileId: A.profileId, canonicalId: item.id, addedAt: 1, isRemoved: 0, updatedAt: 1, version: 1 }] });
    await f.service.hydrateRemoteProfile(A.profileId!);
    assert.equal(f.service.resolveWatchProgress(item)?.currentTime, 300);
    assert.equal(published, true);
    assert.deepEqual(await f.service.getMyList(), [], 'old server list cannot resurrect a queued offline removal');
  } finally { f.restore(); }
});

test('remote progress keeps local artwork and resolves its history metadata on a fresh device', async () => {
  const f = await fixture();
  try {
    await selectScope(f.service, A);
    const richItem = { ...item, title: 'Saved title', image: 'https://image.invalid/local.jpg', poster: 'https://image.invalid/local.jpg' };
    await f.service.saveProgress({ ...progress(100), item: richItem, updatedAt: new Date(Date.now() - 10000).toISOString() });
    globalThis.fetch = async () => Response.json({ profileId: A.profileId, serverTime: Date.now(), progress: [{ id: 'p', profileId: A.profileId, canonicalId: item.id, contentType: ContentType.MOVIE, season: 0, episode: 0, positionSec: 300, durationSec: 1000, progressPercent: 30, isCompleted: 0, version: 2, updatedAt: Date.now() }], history: [{ id: 'h', profileId: A.profileId, canonicalId: item.id, contentType: ContentType.MOVIE, season: 0, episode: 0, title: 'History title', posterUrl: 'https://image.invalid/history.jpg', year: 2020, watchedAt: Date.now(), updatedAt: Date.now(), version: 1 }], favorites: [], myList: [] });
    await f.service.hydrateRemoteProfile(A.profileId!);
    assert.equal(f.service.resolveWatchProgress(item)?.item.title, 'Saved title');
    assert.equal(f.service.resolveWatchProgress(item)?.item.image, 'https://image.invalid/local.jpg');
    await selectScope(f.service, B);
    await f.service.hydrateRemoteProfile(B.profileId!);
    assert.equal(f.service.resolveWatchProgress(item)?.item.title, 'History title');
    assert.equal(f.service.resolveWatchProgress(item)?.item.image, 'https://image.invalid/history.jpg');
  } finally { f.restore(); }
});

test('a delayed pull cannot publish into a different account with the same profile ID', async () => {
  const f = await fixture();
  try {
    await selectScope(f.service, A);
    const entered = deferred(), release = deferred();
    globalThis.fetch = async () => {
      entered.resolve(); await release.promise;
      return Response.json({ profileId: A.profileId, serverTime: 1, progress: [{ id: 'p', profileId: A.profileId, canonicalId: item.id, contentType: ContentType.MOVIE, season: 0, episode: 0, positionSec: 300, durationSec: 1000, progressPercent: 30, isCompleted: 0, version: 1, updatedAt: Date.now() }], history: [], favorites: [], myList: [] });
    };
    const pulling = f.service.hydrateRemoteProfile(A.profileId!);
    await entered.promise;
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    await selectScope(f.service, B);
    release.resolve(); await pulling;
    assert.equal(f.service.resolveWatchProgress(item), null);
    assert.deepEqual((await f.store.read(getWatchStateCodec(B))).items, []);
  } finally { f.restore(); }
});

test('hydration waits for an already active batch before pulling its confirmed result', async () => {
  const f = await fixture();
  try {
    await selectScope(f.service, A);
    await f.service.toggleMyList(item.id);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    const entered = deferred(), release = deferred();
    let confirmed = false;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('/batch')) {
        entered.resolve(); await release.promise; confirmed = true;
        const { mutations } = JSON.parse(String(init?.body));
        return Response.json({ success: true, processed: mutations.length, results: mutations.map((m: { id: string }) => ({ id: m.id, success: true })) });
      }
      return Response.json({ profileId: A.profileId, serverTime: Date.now(), progress: [{ id: 'p', profileId: A.profileId, canonicalId: item.id, contentType: ContentType.MOVIE, season: 0, episode: 0, positionSec: confirmed ? 300 : 200, durationSec: 1000, progressPercent: 30, isCompleted: 0, version: confirmed ? 2 : 1, updatedAt: Date.now() }], history: [], favorites: [], myList: [] });
    };
    const flushing = syncQueue.flush(A.profileId!, A.userId);
    await entered.promise;
    const hydrating = f.service.hydrateRemoteProfile(A.profileId!);
    await new Promise(resolve => setImmediate(resolve));
    release.resolve();
    await Promise.all([flushing, hydrating]);
    assert.equal(f.service.resolveWatchProgress(item)?.currentTime, 300, 'pull must observe the confirmed batch result');
  } finally { f.restore(); }
});

test('a rejected local progress remains reviewable while hydration adopts the server winner', async () => {
  const f = await fixture();
  try {
    await selectScope(f.service, A);
    await f.service.saveProgress({ ...progress(400), updatedAt: new Date(Date.now() + 86400000).toISOString() });
    for (const mutation of syncQueue.getQueue(A.profileId!, A.userId)) {
      if (mutation.type === 'progress') { mutation.syncState = 'conflict'; mutation.syncError = 'SYNC_REMOTE_CONFLICT'; }
    }
    globalThis.fetch = async () => Response.json({ profileId: A.profileId, serverTime: Date.now(), progress: [{ id: 'p', profileId: A.profileId, canonicalId: item.id, contentType: ContentType.MOVIE, season: 0, episode: 0, positionSec: 300, durationSec: 1000, progressPercent: 30, isCompleted: 0, version: 1, updatedAt: Date.now() }], history: [], favorites: [], myList: [] });
    await f.service.hydrateRemoteProfile(A.profileId!);
    assert.equal(f.service.resolveWatchProgress(item)?.currentTime, 300);
    assert.equal(syncQueue.getConflicts(A.profileId!, A.userId).length, 1, 'conflict payload remains for explicit review');
    assert.equal(syncQueue.getConflicts(A.profileId!, A.userId)[0].data.positionSec, 400);
  } finally { f.restore(); }
});

test('a late pull in the same scope cannot undo a newer list tombstone', async () => {
  const f = await fixture();
  try {
    await selectScope(f.service, A);
    const entered = deferred(), release = deferred();
    let first = true;
    globalThis.fetch = async () => {
      const stale = first; first = false;
      if (stale) { entered.resolve(); await release.promise; }
      return Response.json({ profileId: A.profileId, serverTime: Date.now(), progress: [], history: [], favorites: [], myList: [{ id: 'l', profileId: A.profileId, canonicalId: item.id, isRemoved: stale ? 0 : 1, addedAt: 1, updatedAt: stale ? 1 : 2, version: stale ? 1 : 2 }] });
    };
    const oldPull = f.service.hydrateRemoteProfile(A.profileId!);
    await entered.promise;
    await f.service.hydrateRemoteProfile(A.profileId!);
    release.resolve(); await oldPull;
    assert.deepEqual(await f.service.getMyList(), [], 'later tombstone survives an out-of-order pull response');
  } finally { f.restore(); }
});
