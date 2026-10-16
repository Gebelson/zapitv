const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const logoCurrent = await page.$('aside > div[role="button"]');
  await logoCurrent.screenshot({ path: 'logo_current.png' });

  await page.evaluate(() => {
    const logo = document.querySelector('aside > div[role="button"]');
    logo.className = logo.className.replace('pt-4 lg:pt-6 pb-4', 'h-16 sm:h-20');
  });

  const logoNew = await page.$('aside > div[role="button"]');
  await logoNew.screenshot({ path: 'logo_new.png' });

  await browser.close();
})();
