import { chromium } from 'playwright';

async function testCleanSession() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  // Contexto 100% limpo, sem cache, sem cookies, sem localStorage
  const context = await browser.newContext();
  const page = await context.newPage();

  const events: string[] = [];
  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('Erro') || t.includes('Catalog') || t.includes('TMDB') || t.includes('Loading')) {
      events.push(`[CONSOLE] ${t}`);
    }
  });

  console.log('Abrindo https://zapitv-kappa.vercel.app/ com storage limpo...');
  const t0 = Date.now();
  await page.goto('https://zapitv-kappa.vercel.app/', { waitUntil: 'domcontentloaded' });
  
  // Monitora a cada 1 segundo por 15 segundos
  for (let i = 1; i <= 15; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
      const loader = document.querySelector('.animate-spin') || document.querySelector('[class*="Loader"]');
      const cards = document.querySelectorAll('img[alt]').length;
      const text = document.body.innerText.slice(0, 200);
      return { hasLoader: Boolean(loader), cardCount: cards, textSnippet: text };
    });
    console.log(`[T+${i}s] Loader visível: ${state.hasLoader} | Imagens/Cards renderizados: ${state.cardCount}`);
  }

  await browser.close();
}

testCleanSession().catch(console.error);
