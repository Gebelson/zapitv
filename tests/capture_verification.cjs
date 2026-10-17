const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  
  // 1. Desktop Dark Mode
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

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
    line.style.height = '1px';
    line.style.backgroundColor = '#00ff66';
    line.style.boxShadow = '0 0 4px #00ff66';
    line.style.zIndex = '999999';
    line.style.pointerEvents = 'none';
    document.body.appendChild(line);
  }, heroTop);

  await page.screenshot({ path: 'verification_dark_home.png' });

  // 2. Desktop Light Mode
  const sunBtn = await page.$('header button svg.lucide-sun, header button svg.lucide-moon');
  if (sunBtn) {
    const parent = await sunBtn.evaluateHandle(el => el.closest('button'));
    if (parent) await parent.click();
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verification_light_home.png' });

  // 3. Browse View (Filmes)
  await page.goto('http://localhost:4000/filmes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification_filmes.png' });

  // 4. Minha Lista View
  await page.goto('http://localhost:4000/minha-lista', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'verification_minha_lista.png' });

  // 5. Mobile
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);
  
  // Open mobile menu
  const menuBtn = await mobilePage.$('header button svg.lucide-menu');
  if (menuBtn) {
    const p = await menuBtn.evaluateHandle(el => el.closest('button'));
    if (p) await p.click();
    await mobilePage.waitForTimeout(400);
  }
  await mobilePage.screenshot({ path: 'verification_mobile_menu.png' });

  await browser.close();
  console.log('ALL SCREENSHOTS CAPTURED');
})();
