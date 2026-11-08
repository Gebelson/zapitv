import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
const baseline = process.env.P1_BASELINE === '1'
  ? execFileSync('git', ['show', 'b2ac051:src/components/tv/TvDetailsModal.tsx'], { encoding: 'utf8' }) : undefined;
const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'error',
  plugins: baseline ? [{ name: 'explicit-red-baseline', enforce: 'pre',
    load(id) { if (id.replaceAll('\\', '/').endsWith('/src/components/tv/TvDetailsModal.tsx')) return baseline; } }] : [] });
await server.listen();
const address = server.httpServer!.address();
assert.ok(address && typeof address !== 'string');
const origin = 'http://127.0.0.1:' + address.port;
const browser = await chromium.launch({ headless: true });
async function focus(page: Page, key: string) {
  await page.waitForFunction(k => {
    const e = document.querySelector<HTMLElement>('[data-focus-key="' + k + '"][data-tv-focused="true"]');
    if (!e || e.matches(':disabled')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  }, key, { timeout: 6000 });
}
try {
  for (const width of [960, 1920]) for (const scenario of ['movie', 'movie-progress', 'series', 'series-progress', 'series-delay', 'series-progress-delay', 'series-return-async', 'series-empty', 'anime']) {
    const context = await browser.newContext({ viewport: { width, height: width === 960 ? 540 : 1080 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.origin !== origin) return route.abort();
      if (u.pathname === '/fixture.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
      return route.continue();
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      const params = new URLSearchParams({ tv: '1', type: scenario.startsWith('movie') ? 'movie' : scenario === 'anime' ? 'anime' : 'series' });
      if (scenario.includes('progress')) params.set('progress', '1');
      if (scenario.includes('delay')) params.set('delay', '1');
      if (scenario.includes('empty')) { params.set('empty', '1'); params.set('progress', '1'); }
      if (scenario === 'series-return-async') { params.set('returnDelay', '1'); params.set('progress', '1'); }
      await page.goto(origin + '/tests/harness/p1_tv_details.html?' + params);
      await focus(page, 'fixture-card');
      await page.keyboard.press('Enter');
      let expectedReturn = ['series-progress', 'series-return-async'].includes(scenario) ? 'tv-details-episode-1-1' : 'tv-details-play';
      await focus(page, expectedReturn);
      // Async completion must not steal a deliberate user focus.
      if (scenario.includes('delay')) {
        await page.keyboard.press('ArrowRight');
        await focus(page, 'tv-details-list');
        await page.evaluate(() => (window as any).releaseEpisodes());
        await page.locator('[data-focus-key="tv-details-episode-1-1"]').waitFor();
        await focus(page, 'tv-details-list');
        await page.keyboard.press('ArrowLeft');
        try { await focus(page, 'tv-details-play'); } catch (error) {
          console.log(await page.evaluate(() => ({ focused: [...document.querySelectorAll('[data-tv-focused]')].map(e => [e.getAttribute('data-focus-key'), e.getAttribute('data-tv-focused')]), text: document.body.innerText.slice(0, 300) })));
          throw error;
        }
      }
      for (const back of ['Escape', 'Backspace']) {
        await page.keyboard.press('Enter');
        await focus(page, 'fixture-player');
        // The real global Back handler intentionally debounces consecutive Back
        // presses for 300ms. Do not make the second iteration a repeat press.
        await page.waitForTimeout(350);
        await page.keyboard.press(back);
        if (scenario === 'series-return-async' && expectedReturn.startsWith('tv-details-episode')) {
          await focus(page, 'tv-details-play');
          await page.evaluate(() => (window as any).releaseEpisodes());
        }
        try { await focus(page, expectedReturn); } catch (error) {
          console.log('RETURN FAILED', back, await page.evaluate(() => ({ focused: [...document.querySelectorAll('[data-tv-focused]')].map(e => [e.getAttribute('data-focus-key'), e.getAttribute('data-tv-focused')]), text: document.body.innerText.slice(0, 300) })));
          throw error;
        }
        if (expectedReturn.startsWith('tv-details-episode')) {
          await page.keyboard.press('ArrowUp');
          await focus(page, 'tv-details-play');
        }
        await page.keyboard.press('ArrowRight');
        await focus(page, 'tv-details-list');
        await page.keyboard.press('ArrowLeft');
        await focus(page, 'tv-details-play');
        expectedReturn = 'tv-details-play';
      }
      await page.waitForTimeout(350);
      await page.keyboard.press('Escape');
      await focus(page, 'fixture-card');
      await page.keyboard.press('Enter');
      if (scenario === 'series-return-async') {
        await focus(page, 'tv-details-play');
        await page.evaluate(() => (window as any).releaseEpisodes());
      }
      await focus(page, !scenario.startsWith('movie') && !scenario.includes('empty') ? 'tv-details-episode-1-1' : 'tv-details-play');
      assert.deepEqual(errors, []);
      console.log('PASS ' + width + ' ' + scenario + ': real D-pad, interrupted player return, Escape/Backspace, reopen');
    } finally { await context.close(); }
    if (process.env.P1_RED_ONLY) break;
  }
} finally { await browser.close(); await server.close(); }
