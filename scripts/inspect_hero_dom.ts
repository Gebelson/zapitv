import { chromium } from 'playwright';

async function inspectHeroDOM() {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:4000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const heroDetails = await page.evaluate(() => {
    // Find the Hero root container
    const heroEl = document.querySelector('.snap-x')?.parentElement;
    if (!heroEl) return { error: 'Hero element not found' };

    const slides = Array.from(heroEl.querySelectorAll('.snap-start')).map((slide: any, idx) => {
      const title = slide.querySelector('h2')?.innerText;
      const desc = slide.querySelector('p')?.innerText;
      const img = slide.querySelector('img')?.src;
      return { idx, title, desc, img };
    });

    const dots = heroEl.querySelectorAll('button[aria-label^="Ir para slide"]').length;
    const scrollContainer = heroEl.querySelector('.snap-x');

    return {
      totalSlidesRendered: slides.length,
      dotsCount: dots,
      slides,
      scrollLeft: scrollContainer?.scrollLeft,
      scrollWidth: scrollContainer?.scrollWidth,
      clientWidth: scrollContainer?.clientWidth
    };
  });

  console.log('Hero DOM Details:');
  console.log(JSON.stringify(heroDetails, null, 2));

  await browser.close();
}

inspectHeroDOM().catch(console.error);
