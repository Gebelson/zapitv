import { chromium } from 'playwright';

async function testViews() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  page.on('console', msg => console.log('[CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

  console.log('Navegando para Home...');
  await page.goto('https://zapitv-kappa.vercel.app/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Inspeciona Home
  const homeCards = await page.locator('[data-testid="content-card"], .grid > div, img').count();
  console.log('Elementos visíveis na Home (imagens / cards):', homeCards);

  // Clica em "Filmes"
  console.log('Clicando em Filmes...');
  const filmesBtn = page.getByText('Filmes', { exact: true });
  await filmesBtn.click();
  await page.waitForTimeout(4000);

  let filmesText = await page.evaluate(() => document.body.innerText);
  console.log('Texto na aba Filmes:\n', filmesText.slice(0, 400));
  await page.screenshot({ path: 'vercel_filmes.png' });

  // Clica em "Séries"
  console.log('Clicando em Séries...');
  const seriesBtn = page.getByText('Séries', { exact: true });
  await seriesBtn.click();
  await page.waitForTimeout(4000);
  let seriesText = await page.evaluate(() => document.body.innerText);
  console.log('Texto na aba Séries:\n', seriesText.slice(0, 400));
  await page.screenshot({ path: 'vercel_series.png' });

  // Clica em "Animes"
  console.log('Clicando em Animes...');
  const animesBtn = page.getByText('Animes', { exact: true });
  await animesBtn.click();
  await page.waitForTimeout(4000);
  let animesText = await page.evaluate(() => document.body.innerText);
  console.log('Texto na aba Animes:\n', animesText.slice(0, 400));
  await page.screenshot({ path: 'vercel_animes.png' });

  await browser.close();
}

testViews().catch(console.error);
