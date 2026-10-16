const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('aside nav button', { timeout: 10000 });
  await page.waitForTimeout(1000);

  const measurements = await page.evaluate(() => {
    const header = document.querySelector('header');
    const heroCard = document.querySelector('div.pb-12 div.rounded-2xl, div.pb-12 div.md\\:rounded-3xl') || document.querySelector('div.pb-12 > div > div');
    const sidebarLogo = document.querySelector('aside > div[role="button"]');
    const sidebarNav = document.querySelector('aside nav');
    const firstNavBtn = document.querySelector('aside nav button');

    return {
      header: header ? { top: header.getBoundingClientRect().top, bottom: header.getBoundingClientRect().bottom, height: header.getBoundingClientRect().height } : null,
      heroCard: heroCard ? { top: heroCard.getBoundingClientRect().top, bottom: heroCard.getBoundingClientRect().bottom, height: heroCard.getBoundingClientRect().height } : null,
      sidebarLogo: sidebarLogo ? { top: sidebarLogo.getBoundingClientRect().top, bottom: sidebarLogo.getBoundingClientRect().bottom, height: sidebarLogo.getBoundingClientRect().height } : null,
      sidebarNav: sidebarNav ? { top: sidebarNav.getBoundingClientRect().top, bottom: sidebarNav.getBoundingClientRect().bottom, height: sidebarNav.getBoundingClientRect().height } : null,
      firstNavBtn: firstNavBtn ? { top: firstNavBtn.getBoundingClientRect().top, bottom: firstNavBtn.getBoundingClientRect().bottom, height: firstNavBtn.getBoundingClientRect().height } : null,
    };
  });

  console.log('MEASUREMENTS:', JSON.stringify(measurements, null, 2));
  await page.screenshot({ path: 'sidebar_alignment_before.png', fullPage: false });
  await browser.close();
})();
