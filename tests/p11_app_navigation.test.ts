import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

// Real app/network, isolated browser contexts. Never clicks a VOD play button.
async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const [device, width, height, userAgent] of [
      ['desktop', 1440, 900, undefined], ['mobile', 390, 844, undefined],
      ['FireTV', 960, 540, 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Silk/119.3.2 Safari/537.36'],
      ['Samsung', 960, 540, 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 TV Safari/537.36']
    ] as const) {
      if (process.env.P11_TV_ONLY === '1' && device !== 'FireTV' && device !== 'Samsung') continue;
      const context = await browser.newContext({ viewport: { width, height }, userAgent,
        isMobile: device === 'mobile', hasTouch: device === 'mobile' });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message.replace(/https?:\/\/\S+/g, '[redacted-url]').slice(0, 160)));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Performance.enable');
        if (device === 'FireTV' || device === 'Samsung') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const pages = [];
        for (const category of ['filmes', 'series', 'animes']) {
          const route = `${device === 'FireTV' || device === 'Samsung' ? '/tv' : ''}/${category}`;
          const started = Date.now();
          await page.goto(`${process.env.P11_ORIGIN || 'http://localhost:4000'}${route}`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(5000);
          const initial = await page.evaluate(() => ({ dom: document.querySelectorAll('*').length,
            images: document.images.length, bodyCharacters: document.body.innerText.length, route: location.pathname }));
          const latencies = [];
          const focusSequence = [];
          if (device === 'FireTV' || device === 'Samsung') {
            for (const key of ['ArrowDown', ...Array(12).fill('ArrowRight'), 'ArrowUp', 'ArrowDown']) {
              const before = Date.now();
              await page.keyboard.press(key);
              latencies.push(Date.now() - before);
              await page.waitForTimeout(350);
              focusSequence.push({ key, focus: await page.locator('[data-tv-focused="true"]').first().getAttribute('data-focus-key').catch(() => null) });
            }
          } else {
            for (let n = 0; n < 8; n++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(450); }
          }
          const final = await page.evaluate(() => ({ dom: document.querySelectorAll('*').length,
            images: document.images.length, focused: document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key') ?? null }));
          const metrics = (await cdp.send('Performance.getMetrics')).metrics;
          pages.push({ route, elapsedMs: Date.now() - started, initial, final,
            keyDispatchRoundTripMs: latencies, focusSequence, heapBytes: metrics.find(m => m.name === 'JSHeapUsedSize')?.value ?? null });
          console.log(device, route, initial.images, final.images, errors.length);
        }
        results.push({ device, simulated: device !== 'desktop', pages, pageErrors: errors });
      } finally { await context.close(); }
    }
  } finally {
    const previous = process.env.P11_TV_ONLY === '1'
      ? JSON.parse(readFileSync('docs/p11-navigation-evidence.json', 'utf8')).results.filter((r: any) => r.device === 'desktop' || r.device === 'mobile') : [];
    writeFileSync('docs/p11-navigation-evidence.json', JSON.stringify({ testedAt: new Date().toISOString(), results: [...previous, ...results] }, null, 2));
    await browser.close();
  }
}
run().catch(error => { console.error(error.name); process.exitCode = 1; });
