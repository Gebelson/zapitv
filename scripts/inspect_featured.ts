import { chromium } from 'playwright';

async function inspectFeaturedSelection() {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:4000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const featured = await page.evaluate(() => {
    const raw = localStorage.getItem('zapitv_featured_ranking_selection_v3');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      updatedAt: parsed.updatedAt,
      referenceWeek: parsed.referenceWeek,
      featuredMoviesCount: parsed.featuredMovies?.length,
      featuredMovies: parsed.featuredMovies?.map((m: any) => ({ id: m.id, title: m.title, available: m.availabilityStatus })),
      featuredSeriesCount: parsed.featuredSeries?.length,
      featuredSeries: parsed.featuredSeries?.map((s: any) => ({ id: s.id, title: s.title, available: s.availabilityStatus }))
    };
  });

  console.log('featured_ranking_selection_v3:');
  console.log(JSON.stringify(featured, null, 2));

  await browser.close();
}

inspectFeaturedSelection().catch(console.error);
