const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const failedNetworkImages = [];
  page.on('response', response => {
    const url = response.url();
    if (url.match(/\.(jpg|jpeg|png|webp)/i) || url.includes('/t/p/') || url.includes('metahub.space')) {
      if (response.status() >= 400) {
        failedNetworkImages.push({ url, status: response.status() });
      }
    }
  });

  const routes = ['/', '/filmes', '/series', '/animes', '/em-destaque'];
  const report = {};

  for (const r of routes) {
    console.log('Navigating to', r);
    await page.goto('http://localhost:4000' + r, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Scroll down to trigger lazy loads
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1000);

    const cards = await page.evaluate(() => {
      const allCards = Array.from(document.querySelectorAll('div.group\\/card'));
      return allCards.map(c => {
        const title = c.querySelector('h4, p, span.font-black')?.textContent?.trim() || '';
        const img = c.querySelector('img');
        const placeholder = c.querySelector('div[class*="bg-gradient-to-br"]');
        return {
          title,
          hasImgTag: !!img,
          imgSrc: img ? img.src : null,
          imgNaturalWidth: img ? img.naturalWidth : 0,
          imgComplete: img ? img.complete : false,
          hasPlaceholder: !!placeholder
        };
      });
    });

    const placeholders = cards.filter(c => c.hasPlaceholder || !c.hasImgTag || c.imgNaturalWidth === 0);
    report[r] = {
      totalCards: cards.length,
      loadedCards: cards.length - placeholders.length,
      placeholderCount: placeholders.length,
      placeholderSamples: placeholders.slice(0, 10)
    };
  }

  console.log('FAILED NETWORK REQUESTS:', failedNetworkImages.slice(0, 20));
  console.log('REPORT:', JSON.stringify(report, null, 2));

  await browser.close();
})();
