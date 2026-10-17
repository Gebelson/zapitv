import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const urls = process.env.ZAPITV_PERF_URL
  ? [process.env.ZAPITV_PERF_URL]
  : ['http://localhost:4000/', 'https://zapitv-stream.vercel.app/'];
const visibleCardState = async page => page.evaluate(() => {
  const visible = [...document.querySelectorAll('[data-ui-sound-card]')].filter(card => {
    const rect = card.getBoundingClientRect();
    const rail = card.closest('.overflow-x-auto')?.getBoundingClientRect();
    return rail && rect.right > rail.left && rect.left < rail.right &&
      rect.bottom > 0 && rect.top < innerHeight && rail.bottom > 0 && rail.top < innerHeight;
  });
  return { visible: visible.length, placeholders: visible.filter(card => !card.querySelector('button')).length };
});
for (const url of urls) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 768 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message.slice(0, 180)));
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__longTasks.push(Math.round(entry.duration));
    }).observe({ entryTypes: ['longtask'] });
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5000);
    const initial = await page.evaluate(() => ({
      domNodes: document.querySelectorAll('*').length,
      cards: document.querySelectorAll('[data-ui-sound-card]').length,
      images: document.images.length,
      longTasks: window.__longTasks,
      resources: performance.getEntriesByType('resource').length,
      transferredBytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry.transferSize || 0), 0)
    }));
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    const initialVisible = isLocal ? await visibleCardState(page) : undefined;
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1000);
    const afterScroll = await page.evaluate(() => ({
      domNodes: document.querySelectorAll('*').length,
      cards: document.querySelectorAll('[data-ui-sound-card]').length,
      longTasks: window.__longTasks,
      resources: performance.getEntriesByType('resource').length
    }));
    const afterVisible = isLocal ? await visibleCardState(page) : undefined;
    if (afterVisible?.visible && afterVisible.placeholders) throw new Error('Card visível ainda está em modo leve');
    let afterHorizontalScroll;
    if (isLocal && afterVisible?.visible) {
      await page.evaluate(() => {
        const card = [...document.querySelectorAll('[data-ui-sound-card]')].find(element => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < innerHeight;
        });
        const rail = card?.closest('.overflow-x-auto');
        if (rail) rail.scrollLeft += rail.clientWidth * 0.8;
      });
      await page.waitForTimeout(600);
      afterHorizontalScroll = await visibleCardState(page);
      if (afterHorizontalScroll.placeholders) throw new Error('Card visível após navegação horizontal ainda está em modo leve');
    }
    console.log(JSON.stringify({ url, initial, initialVisible, afterScroll, afterVisible, afterHorizontalScroll, errors }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ url, error: error.message, errors }));
  }
  await context.close();
}
await browser.close();
