import assert from 'node:assert/strict';
import { chromium, type Browser } from 'playwright';
import { createServer } from 'vite';

async function run() {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  let browser: Browser | undefined;
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== 'string');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    let mediaRequests = 0;
    page.on('request', request => { if (request.resourceType() === 'media') mediaRequests++; });
    await page.goto(`http://127.0.0.1:${address.port}/tests/harness/p1_live_lifecycle.html`);
    await page.waitForFunction(() => (window as any).p1LiveCounts?.next === 1);
    for (let n = 0; n < 15; n++) {
      await page.evaluate(() => (window as any).p1LiveRender());
      await page.waitForTimeout(10);
    }
    await page.waitForTimeout(1900);
    assert.deepEqual(await page.evaluate(() => (window as any).p1LiveCounts), { next: 1, close: 0 }, 'rerenders cannot schedule repeated channel changes');
    await page.evaluate(() => (window as any).p1LiveMount(false));
    await page.waitForTimeout(30);
    await page.evaluate(() => (window as any).p1LiveMount(true));
    await page.waitForTimeout(10);
    await page.evaluate(() => (window as any).p1LiveMount(false));
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => (window as any).p1LiveCounts.next), 1, 'unmounted sessions cannot change channels');
    assert.equal(mediaRequests, 0, 'restricted external-access channels do not start unauthorized streaming');
    console.log('P1 Live TV browser: repeated renders, unmount cleanup and restricted-channel isolation passed');
    await page.goto(`http://127.0.0.1:${address.port}/tests/harness/storage_integrity.html`);
    await page.route('**/p1-banner.svg', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#123"/></svg>' }));
    const imageResult = await page.evaluate(async () => {
      const { heroImageService } = await import('/src/core/catalog/heroImageService.ts' as string);
      const url = `${location.origin}/p1-banner.svg`;
      const controller = new AbortController();
      const pending = heroImageService.validateAndPreloadImage(url, 1000, controller.signal);
      controller.abort();
      const aborted = await pending;
      const failed = heroImageService.isUrlFailed(url);
      const reloaded = await heroImageService.validateAndPreloadImage(url, 1000);
      return { aborted, failed, reloaded };
    });
    assert.deepEqual(imageResult, { aborted: false, failed: false, reloaded: true });
    console.log('P1 images browser: real Image cancellation and successful subsequent decode passed');
  } finally {
    try { await browser?.close(); } finally { await server.close(); }
  }
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
