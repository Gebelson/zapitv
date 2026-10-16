const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Apply proposed changes in DOM
  await page.evaluate(() => {
    const logo = document.querySelector('aside > div[role="button"]');
    if (logo) {
      logo.className = logo.className.replace('pt-4 lg:pt-6 pb-4', 'h-16 sm:h-20 shrink-0');
    }
    const nav = document.querySelector('aside nav');
    if (nav) {
      nav.className = nav.className.replace('mt-1 lg:mt-4', 'mt-4 sm:mt-6');
    }
  });

  const measurementsExpanded = await page.evaluate(() => {
    const header = document.querySelector('header');
    const hero = document.querySelector('div.pb-12 > div > div');
    const logo = document.querySelector('aside > div[role="button"]');
    const nav = document.querySelector('aside nav');
    const firstBtn = nav.querySelector('button');
    const footer = document.querySelector('aside > div:last-child');

    return {
      headerHeight: header ? header.offsetHeight : null,
      heroTop: hero ? hero.getBoundingClientRect().top : null,
      logoHeight: logo ? logo.offsetHeight : null,
      logoBottom: logo ? logo.getBoundingClientRect().bottom : null,
      btnTop: firstBtn ? firstBtn.getBoundingClientRect().top : null,
      diff: (firstBtn ? firstBtn.getBoundingClientRect().top : 0) - (hero ? hero.getBoundingClientRect().top : 0),
      footerBottom: footer ? footer.getBoundingClientRect().bottom : null
    };
  });

  console.log('EXPANDED:', measurementsExpanded);

  // Toggle collapse
  const toggleBtn = await page.$('aside button[class*="absolute top-1/2"]');
  if (toggleBtn) await toggleBtn.click();
  await page.waitForTimeout(400);

  const measurementsCollapsed = await page.evaluate(() => {
    const hero = document.querySelector('div.pb-12 > div > div');
    const logo = document.querySelector('aside > div[role="button"]');
    const nav = document.querySelector('aside nav');
    const firstBtn = nav.querySelector('button');

    return {
      heroTop: hero ? hero.getBoundingClientRect().top : null,
      logoHeight: logo ? logo.offsetHeight : null,
      btnTop: firstBtn ? firstBtn.getBoundingClientRect().top : null,
      diff: (firstBtn ? firstBtn.getBoundingClientRect().top : 0) - (hero ? hero.getBoundingClientRect().top : 0)
    };
  });

  console.log('COLLAPSED:', measurementsCollapsed);

  await page.screenshot({ path: 'test_proposed_alignment.png' });
  await browser.close();
})();
