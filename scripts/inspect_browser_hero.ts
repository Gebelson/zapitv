import { chromium } from 'playwright';

async function inspectHero() {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:4000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const heroData = await page.evaluate(() => {
    // Check localStorage keys
    const lsKeys = Object.keys(localStorage);
    const lsTrending = localStorage.getItem('zapitv_cached_trending');
    const heroTitles = Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 20).map(h => h.innerText);
    
    // Look for scroll container in Hero
    const scrollContainer = document.querySelector('.overflow-x-auto, [class*="scrollRef"]');
    const heroSection = document.querySelector('[class*="group/hero"], [style*="height"]');
    const allImages = Array.from(document.querySelectorAll('img')).slice(0, 10).map(img => ({ alt: img.alt, src: img.src }));

    return {
      lsKeys,
      lsTrendingLength: lsTrending ? lsTrending.length : 0,
      lsTrendingParsed: lsTrending ? JSON.parse(lsTrending).slice(0, 10).map((i: any) => ({ id: i.id, title: i.title })) : null,
      heroTitles,
      allImages
    };
  });

  console.log('Hero Data from browser:');
  console.log(JSON.stringify(heroData, null, 2));

  await browser.close();
}

inspectHero().catch(console.error);
