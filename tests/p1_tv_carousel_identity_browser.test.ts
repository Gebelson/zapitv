import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, type Page } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'error' });
await server.listen();
const address = server.httpServer!.address();
assert.ok(address && typeof address !== 'string');
const browser = await chromium.launch({ headless: true });
const results: object[] = [];

async function settled(page: Page) {
  await page.waitForFunction(() => {
    const track = document.querySelector('[data-row-id="p1-row"] .relative.z-10.flex') as HTMLElement | null;
    return track?.style.transition === 'none';
  });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function select(page: Page, expected: string) {
  await page.keyboard.press('Enter');
  await page.waitForFunction(id => (window as any).p1Metrics.selected === id, expected);
  const focused = await page.evaluate(() => {
    const e = document.querySelector('[role="button"][data-tv-focused="true"]');
    const r = e?.getBoundingClientRect();
    return { key: e?.getAttribute('data-focus-key'), visible: !!r && r.width > 0 && r.height > 0 &&
      r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight };
  });
  assert.equal(focused.visible, true, 'the selected card must remain visible');
  assert.equal(focused.key, `tv-card-${expected}`);
}

try {
  for (const [width, height] of [[960, 540], [1920, 1080]]) {
    for (const count of [40, 1, 6, 7, 8]) {
      const context = await browser.newContext({ viewport: { width, height },
        userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Silk/119.3.2 Safari/537.36' });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (/same key|unique.*key/i.test(message.text())) errors.push(message.text()); });
      let external = 0;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/p1-poster.svg') return route.fulfill({ contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#245"/></svg>' });
        if (url.hostname !== '127.0.0.1') { external++; return route.abort(); }
        return route.continue();
      });
      try {
        await page.goto(`http://127.0.0.1:${address.port}/tests/harness/p1_tv_row.html?tv=1&count=${count}`);
        await page.waitForFunction(() => !!(window as any).p1Focus && document.querySelectorAll('[data-card-poster] img').length > 0);
        await page.evaluate(() => (window as any).p1Focus());
        await page.locator('[data-focus-key="row-p1-row"][data-tv-focused="true"]').waitFor();
        await settled(page);
        await select(page, 'fixture-0');
        await page.evaluate(() => { (window as any).oldCards = new WeakSet(document.querySelectorAll('[data-card-poster] img')); });
        await page.keyboard.press('ArrowRight');
        // Enter while the carousel is moving must select its target, not the previous item.
        await page.keyboard.press('Enter');
        await page.waitForFunction(id => (window as any).p1Metrics.selected === id, `fixture-${count === 1 ? 0 : 1}`);
        await settled(page);
        const retained = await page.evaluate(() => Array.from(document.querySelectorAll('[data-card-poster] img'))
          .filter(img => (window as any).oldCards.has(img)).length);
        assert.ok(retained >= Math.min(count, 8), `${count} items: preserve shared image nodes, retained ${retained}`);
        await select(page, `fixture-${count === 1 ? 0 : 1}`);
        for (const [key, expected] of [
          ['ArrowLeft', 0], ['ArrowLeft', count <= 6 ? 0 : count - 1], ['ArrowRight', count <= 6 ? Math.min(1, count - 1) : 0]
        ] as const) {
          await page.keyboard.press(key);
          await settled(page);
          await select(page, `fixture-${expected}`);
        }
        // New source identity and a shorter list must not retain an earlier item's state.
        await page.evaluate(() => (window as any).p1ReplaceItems(1, 'replacement'));
        await page.waitForFunction(() => document.querySelectorAll('[data-card-poster] img').length === 1);
        await settled(page);
        await select(page, 'replacement-0');
        const cdp = await context.newCDPSession(page);
        const windowObject = await cdp.send('Runtime.evaluate', { expression: 'window' });
        const resizeListeners = async () => {
          const listeners = await cdp.send('DOMDebugger.getEventListeners', { objectId: windowObject.result.objectId! });
          return listeners.listeners.filter(listener => listener.type === 'resize').length;
        };
        await page.evaluate(() => (window as any).p1Mount(false));
        await page.waitForFunction(() => document.querySelectorAll('[data-row-id]').length === 0);
        const unmountedResizeListeners = await resizeListeners();
        for (let cycle = 0; cycle < 3; cycle++) {
          await page.evaluate(() => (window as any).p1Mount(true));
          await page.locator('[data-row-id="p1-row"]').waitFor();
          await page.evaluate(() => (window as any).p1Focus());
          await select(page, 'replacement-0');
          await page.evaluate(() => (window as any).p1Mount(false));
          await page.waitForFunction(() => document.querySelectorAll('[data-row-id]').length === 0);
          assert.equal(await resizeListeners(), unmountedResizeListeners, 'unmount must release row resize listeners');
          assert.equal(await page.locator('[data-tv-focused="true"]').count(), 0, 'unmounted cards cannot retain visible focus');
        }
        await cdp.send('Runtime.releaseObject', { objectId: windowObject.result.objectId! });
        assert.deepEqual(errors, [], 'no duplicate React keys or unhandled errors');
        assert.equal(external, 0, 'fixture must not depend on external services');
        results.push({ width, height, count, retained, navigation: 'passed', replacement: 'passed', lifecycle: 'passed' });
      } finally { await context.close(); }
    }
  }
  console.log(JSON.stringify(results));
} finally { await browser.close(); await server.close(); }
