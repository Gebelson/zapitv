const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const beforeCollapse = await page.evaluate(() => {
    const logo = document.querySelector('aside > div[role="button"]');
    const firstBtn = document.querySelector('aside nav button');
    return { 
      logoHeight: logo.offsetHeight, 
      logoBottom: logo.getBoundingClientRect().bottom,
      btnTop: firstBtn.getBoundingClientRect().top
    };
  });

  const toggleBtn = await page.$('aside button[class*="absolute top-1/2"]');
  if (toggleBtn) await toggleBtn.click();
  await page.waitForTimeout(500);

  const afterCollapse = await page.evaluate(() => {
    const logo = document.querySelector('aside > div[role="button"]');
    const firstBtn = document.querySelector('aside nav button');
    return {
      logoHeight: logo.offsetHeight,
      logoBottom: logo.getBoundingClientRect().bottom,
      btnTop: firstBtn.getBoundingClientRect().top
    };
  });

  console.log('MEASURED:', { beforeCollapse, afterCollapse });
  await browser.close();
})();
