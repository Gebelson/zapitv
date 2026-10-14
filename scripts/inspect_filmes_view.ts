import { chromium } from 'playwright';

async function inspectFilmesView() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1280, height: 800 } });

  page.on('console', msg => console.log('[CONSOLE]', msg.type(), msg.text()));

  await page.goto('https://zapitv-kappa.vercel.app/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Navegando para Filmes...');
  await page.getByText('Filmes', { exact: true }).click();
  await page.waitForTimeout(4000);

  const viewData = await page.evaluate(() => {
    const title = document.querySelector('h2')?.innerText;
    const count = document.querySelector('h2 + span')?.innerText;
    const cards = Array.from(document.querySelectorAll('.grid > div')).map(el => {
      const t = el.querySelector('p, h3, span')?.innerText;
      return t;
    }).slice(0, 10);
    const hasLoader = Boolean(document.querySelector('.animate-spin'));
    return { title, count, hasLoader, cardsCount: cards.length, sampleCards: cards };
  });

  console.log('Dados da View Filmes:', JSON.stringify(viewData, null, 2));

  // Agora testa a BUSCA
  console.log('Testando busca por "Batman"...');
  const searchInput = page.getByPlaceholder('Buscar');
  if (await searchInput.count() > 0) {
    await searchInput.fill('Batman');
    await page.waitForTimeout(3000);
    const searchData = await page.evaluate(() => {
      const resultsText = document.querySelector('h2')?.innerText;
      const count = document.querySelector('h2 + span')?.innerText;
      const cards = document.querySelectorAll('.grid > div').length;
      return { resultsText, count, cards };
    });
    console.log('Dados da Busca:', JSON.stringify(searchData, null, 2));
  } else {
    console.log('Input de busca não encontrado');
  }

  await browser.close();
}

inspectFilmesView().catch(console.error);
