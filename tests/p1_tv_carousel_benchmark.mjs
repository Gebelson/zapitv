import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
// Keep background source/artifact changes from restarting a measurement.
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, watch: null, hmr: false }, logLevel: 'error' });
let browser;
const results = [];
const soak = process.argv.includes('--soak');
const lifecycle = process.argv.includes('--lifecycle');
const outputArgument = process.argv.indexOf('--output');
const outputFile = outputArgument < 0 ? undefined : process.argv[outputArgument + 1];
if (outputArgument >= 0 && !outputFile) throw new Error('--output requires a path');
const stepCount = soak ? 60 : 6;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({ headless: true });
  for (const [device, width, height, userAgent] of [
    ['FireTV', 960, 540, 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Silk/119.3.2 Safari/537.36'],
    ['FireTV', 1920, 1080, 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Silk/119.3.2 Safari/537.36'],
    ['Samsung', 960, 540, 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 TV Safari/537.36']
  ].slice(0, soak || lifecycle ? 1 : 3)) {
    const context = await browser.newContext({ userAgent, viewport: { width, height } });
    let blockedExternalRequests = 0;
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.pathname === '/p1-poster.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#245"/></svg>' });
      if (u.hostname !== '127.0.0.1') { blockedExternalRequests++; return route.abort(); }
      return route.continue();
    });
    await context.addInitScript(() => {
      window.__p1Probe = { adds: 0, removes: 0, inputs: [] };
      const add = EventTarget.prototype.addEventListener;
      const remove = EventTarget.prototype.removeEventListener;
      EventTarget.prototype.addEventListener = function (...args) { window.__p1Probe.adds++; return add.apply(this, args); };
      EventTarget.prototype.removeEventListener = function (...args) { window.__p1Probe.removes++; return remove.apply(this, args); };
      window.addEventListener('keydown', () => {
        const start = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => window.__p1Probe.inputs.push(performance.now() - start)));
      }, true);
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`http://127.0.0.1:${port}/tests/harness/p1_tv_row.html?tv=1`);
    await page.waitForFunction(() => window.p1Metrics && document.querySelectorAll('[data-card-poster] img').length === 9);
    await page.evaluate(() => window.p1Focus());
    await page.locator('[data-focus-key="row-p1-row"][data-tv-focused="true"]').waitFor();
    await cdp.send('HeapProfiler.collectGarbage');
    const heapBefore = await cdp.send('Runtime.getHeapUsage');
    const before = await page.evaluate(() => ({ ...window.__p1Probe, ...window.p1Metrics }));
    const steps = [];
    const heapCheckpoints = [];
    for (let i = 0; i < stepCount; i++) {
      await page.evaluate(() => {
        window.__p1OldImages = new WeakSet(document.querySelectorAll('[data-card-poster] img'));
        window.__p1StepStart = performance.now();
      });
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('[data-row-id="p1-row"] .relative.z-10.flex')?.style.transition !== 'none');
      await page.waitForFunction(() => document.querySelector('[data-row-id="p1-row"] .relative.z-10.flex')?.style.transition === 'none');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      steps.push(await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('[data-card-poster] img'));
        return { mountedImages: imgs.length, retainedImages: imgs.filter(n => window.__p1OldImages.has(n)).length, settledMs: performance.now() - window.__p1StepStart };
      }));
      if (soak && (i + 1) % 20 === 0) {
        await cdp.send('HeapProfiler.collectGarbage');
        heapCheckpoints.push({ step: i + 1, ...(await cdp.send('Runtime.getHeapUsage')) });
      }
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(expected => window.p1Metrics.selected === expected, `fixture-${stepCount % 40}`);
    await cdp.send('HeapProfiler.collectGarbage');
    const heapAfter = await cdp.send('Runtime.getHeapUsage');
    const after = await page.evaluate(() => ({ ...window.__p1Probe, ...window.p1Metrics, nodes: document.querySelectorAll('*').length }));
    const unmountCheckpoints = [];
    if (lifecycle) {
      for (let cycle = 0; cycle < 10; cycle++) {
        await page.evaluate(() => window.p1Mount(false));
        await page.waitForFunction(() => !document.querySelector('[data-row-id]'));
        await cdp.send('HeapProfiler.collectGarbage');
        unmountCheckpoints.push({ cycle, ...(await cdp.send('Runtime.getHeapUsage')), ...(await cdp.send('Memory.getDOMCounters')) });
        await page.evaluate(() => window.p1Mount(true));
        await page.waitForFunction(() => document.querySelectorAll('[data-card-poster] img').length === 9);
        await page.evaluate(() => window.p1Focus());
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('[data-row-id="p1-row"] .relative.z-10.flex')?.style.transition !== 'none');
        await page.waitForFunction(() => document.querySelector('[data-row-id="p1-row"] .relative.z-10.flex')?.style.transition === 'none');
      }
    }
    results.push({ device, width, height, cpuThrottle: 4, steps, commits: after.commits - before.commits,
      renderMs: after.renderMs - before.renderMs, listenerAddOperations: after.adds - before.adds,
      listenerRemoveOperations: after.removes - before.removes, heapBeforeBytes: heapBefore.usedSize,
      heapAfterBytes: heapAfter.usedSize, nodes: after.nodes, selected: after.selected,
      inputToTwoRafMs: after.inputs, blockedExternalRequests, heapCheckpoints, unmountCheckpoints });
    await context.close();
  }
  if (outputFile) await fs.writeFile(path.resolve(outputFile), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({steps, inputToTwoRafMs, ...result}) => ({...result, steps: steps.length, retainedImages: [...new Set(steps.map(s=>s.retainedImages))]}))));
} finally {
  await browser?.close();
  await server.close();
}
