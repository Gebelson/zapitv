import assert from 'node:assert/strict';
import { chromium, type Browser } from 'playwright';
import { createServer } from 'vite';

async function run() {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  let browser: Browser | undefined;
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/tests/harness/storage_integrity.html`;
    browser = await chromium.launch({ headless: true });
    for (const mode of [
      { name: 'desktop', viewport: { width: 1440, height: 900 } },
      { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      { name: 'TV (Chromium)', viewport: { width: 1920, height: 1080 } }
    ]) {
      const { name, ...options } = mode;
      const context = await browser.newContext(options);
      try {
        const page = await context.newPage();
        await page.goto(url);
        // Seed pre-existing data in the real browser's IndexedDB and localStorage before loading the service.
        await page.evaluate(async () => {
          const { db } = await import('/db.ts' as string);
          const item = { id: 'storage-fixture', title: 'Storage fixture', type: 'SÉRIE', rating: 8, year: 2020, image: '' };
          const p = { contentId: item.id, item, season: 2, episode: 7, currentTime: 240, duration: 1200,
            percentage: 20, updatedAt: '2026-10-27T10:00:00Z' };
          localStorage.setItem('zapitv_local_progress', JSON.stringify([p, p]));
          await db.keyValueStore.put({ key: 'zapitv_local_progress', value: [{ ...p, currentTime: 100, updatedAt: '2026-10-26T10:00:00Z' }] });
          await db.keyValueStore.put({ key: 'zapitv_local_mylist', value: ['legacy-list'] });
          const { storageService } = await import('/src/core/storage/storageService.ts' as string);
          const history = await storageService.getContinueWatching();
          if (history.length !== 1 || history[0].currentTime !== 240) throw new Error('Legacy migration failed');
          await storageService.saveProgress({ ...p, currentTime: 480, updatedAt: '2026-10-27T11:00:00Z' });
          await storageService.toggleFavorite('saved-favorite');
          await storageService.toggleMyList('saved-list');
        });
        const otherTab = await context.newPage();
        try {
          await otherTab.goto(url);
          await otherTab.evaluate(async () => {
            const { storageService } = await import('/src/core/storage/storageService.ts' as string);
            await storageService.getMyList();
          });
          await Promise.all([page.evaluate(async () => {
            const { storageService } = await import('/src/core/storage/storageService.ts' as string);
            await storageService.toggleMyList('tab-a');
          }), otherTab.evaluate(async () => {
            const { storageService } = await import('/src/core/storage/storageService.ts' as string);
            await storageService.toggleMyList('tab-b');
          })]);
        } finally { await otherTab.close(); }
        await page.reload();
        const result = await page.evaluate(async () => {
          const { storageService } = await import('/src/core/storage/storageService.ts' as string);
          const history = await storageService.getContinueWatching();
          const continuity = storageService.getPlaybackContinuity(history[0].item);
          const favorites = await storageService.getFavorites();
          const myList = (await storageService.getMyList()).sort();
          const rawLegacy = JSON.parse(localStorage.getItem('zapitv_local_progress')!);
          // Simulate quota exhaustion while leaving the actual IndexedDB available.
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError'); };
          try {
            await storageService.saveProgress({ ...history[0], currentTime: 600, updatedAt: '2026-10-27T12:00:00Z' });
          } finally { Storage.prototype.setItem = original; }
          return { count: history.length, time: continuity.currentTime, season: continuity.season,
            episode: continuity.episode, favorites, myList, legacyTime: rawLegacy[0].currentTime };
        });
        assert.deepEqual(result, { count: 1, time: 480, season: 2, episode: 7,
          favorites: ['saved-favorite'], myList: ['legacy-list', 'saved-list', 'tab-a', 'tab-b'], legacyTime: 240 });
        await page.reload();
        assert.equal(await page.evaluate(async () => {
          const { storageService } = await import('/src/core/storage/storageService.ts' as string);
          return (await storageService.getContinueWatching())[0].currentTime;
        }), 600);
        await page.evaluate(async () => {
          const { storageService } = await import('/src/core/storage/storageService.ts' as string);
          await storageService.clearAllProgress();
        });
        await page.reload();
        assert.equal(await page.evaluate(async () => {
          const { storageService } = await import('/src/core/storage/storageService.ts' as string);
          return (await storageService.getContinueWatching()).length;
        }), 0);
        console.log(`storage browser: ${name} — legacy migration, episode resume, lists, quota fallback and reload passed`);
      } finally { await context.close(); }
    }
  } finally {
    try { await browser?.close(); } finally { await server.close(); }
  }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
