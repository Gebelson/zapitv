import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, type Browser } from 'playwright';
import fs from 'node:fs';

async function run() {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  let browser: Browser | undefined;
  const results: Record<string, unknown>[] = [];
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== 'string');
    browser = await chromium.launch({ headless: true });
    for (const [device, userAgent] of [
      ['FireTV', 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Silk/119.3.2 Safari/537.36'],
      ['Samsung', 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 TV Safari/537.36']
    ]) {
      const context = await browser.newContext({ userAgent, viewport: { width: 960, height: 540 } });
      try {
        const page = await context.newPage();
        await page.route('**/p1-poster.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#245"/></svg>' }));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await page.goto(`http://127.0.0.1:${address.port}/tests/harness/p1_tv_row.html?tv=1`);
        await page.waitForFunction(() => !!(window as any).p1Metrics && document.querySelectorAll('img').length > 0);
        await page.waitForTimeout(400);
        const metrics = await page.evaluate(async () => {
          const m = (window as any).p1Metrics;
          const initial = { ...m };
          for (let n = 0; n < 20; n++) {
            window.dispatchEvent(new Event('resize'));
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          }
          await new Promise(resolve => setTimeout(resolve, 50));
          return { commits: m.commits - initial.commits, renderMs: m.renderMs - initial.renderMs,
            isFireTv: m.isFireTv, dom: document.querySelectorAll('*').length };
        });
        assert.equal(metrics.isFireTv, device === 'FireTV');
        if ((process.env.P1_ASSERT_OPTIMIZED === '1' || process.argv.includes('--verify')) && device === 'FireTV') assert.ok(metrics.commits <= 2);
        await page.evaluate(() => (window as any).p1Focus());
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => (window as any).p1Metrics.selected === 'fixture-1');
        for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowRight']) {
          await page.keyboard.press(key);
          await page.waitForTimeout(400);
        }
        assert.equal(await page.evaluate(() => (window as any).p1Metrics.pagesRequested), 1, 'remote navigation reaches the pagination callback at the end of the row');
        results.push({ device, ...metrics, keyboard: 'ArrowRight + Enter passed' });
      } finally { await context.close(); }
    }
  } finally {
    try { await browser?.close(); } finally { await server.close(); }
  }
  if (process.env.P1_METRICS_FILE) fs.writeFileSync(process.env.P1_METRICS_FILE, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
