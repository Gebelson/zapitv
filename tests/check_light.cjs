const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('aside nav button');
  
  // Click theme toggle to switch to light mode
  const sunBtn = await page.$('header button svg.lucide-sun, header button svg.lucide-moon');
  if (sunBtn) {
    const parent = await sunBtn.evaluateHandle(el => el.closest('button'));
    if (parent) await parent.click();
  }
  await page.waitForTimeout(500);

  const heroTop = await page.evaluate(() => {
    const hero = document.querySelector('div.pb-12 > div > div');
    return hero ? hero.getBoundingClientRect().top : 104;
  });

  await page.evaluate((top) => {
    const line = document.createElement('div');
    line.style.position = 'fixed';
    line.style.top = top + 'px';
    line.style.left = '0';
    line.style.width = '100vw';
    line.style.height = '2px';
    line.style.backgroundColor = '#ff0055';
    line.style.zIndex = '999999';
    line.style.pointerEvents = 'none';
    document.body.appendChild(line);
  }, heroTop);

  await page.screenshot({ path: 'guide_line_light.png' });
  await browser.close();
})();
