import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'error' });
await server.listen();
const address = server.httpServer!.address();
assert.ok(address && typeof address !== 'string');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') return route.abort();
    if (u.pathname.endsWith('.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
    return route.continue();
  });
  await page.goto('http://127.0.0.1:' + address.port + '/tests/harness/p1_tv_row.html?tv=1&count=40&resize=1');
  await page.waitForFunction(() => !!(window as any).p1Focus);
  await page.evaluate(() => (window as any).p1Focus());
  await page.locator('[role="button"][data-tv-focused="true"]').waitFor();
  await page.setViewportSize({ width: 960, height: 540 });
  await page.waitForFunction(() => {
    const e = document.querySelector('[role="button"][data-tv-focused="true"]');
    const r = e?.getBoundingClientRect();
    return !!r && r.top >= 0 && r.bottom <= innerHeight;
  }, undefined, { timeout: 4000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).p1Metrics.selected === 'fixture-0');
  console.log('PASS resize 1920x1080 -> 960x540: focused card fully visible, same selection');
} finally { await browser.close(); await server.close(); }
