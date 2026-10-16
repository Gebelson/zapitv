const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4000/atores/2037', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const cardData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div.group\\/card'));
    return cards.map(c => {
      const img = c.querySelector('img');
      const placeholder = c.querySelector('div[class*="bg-gradient-to-br"]');
      const text = c.innerText.replace(/\s+/g, ' ').trim();
      return {
        text,
        imgSrc: img ? img.src : null,
        hasPlaceholder: !!placeholder
      };
    }).filter(c => c.text.includes('Quando') || c.text.includes('Peaky') || c.text.includes('Blood'));
  });

  console.log('ACTOR PAGE CARDS:', JSON.stringify(cardData, null, 2));
  await page.screenshot({ path: 'actor_2037_cards.png' });
  await browser.close();
})();
