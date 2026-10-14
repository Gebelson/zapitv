import { chromium } from 'playwright';

async function testWatch() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('Error') || msg.text().includes('Falha')) {
      errors.push(`[CONSOLE ${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => errors.push(`[PAGEERROR] ${err.message}`));

  await page.goto('https://zapitv-kappa.vercel.app/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Inspeciona os cards dentro das fileiras
  const rowCards = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.flex-none, [class*="group"]')).filter(el => el.querySelector('img'));
    return cards.slice(0, 5).map(c => ({
      title: c.querySelector('h4, p, span')?.innerText || 'sem texto',
      img: c.querySelector('img')?.src
    }));
  });
  console.log('Primeiros cards em fileiras:', JSON.stringify(rowCards, null, 2));

  // Clica no botão "Assistir" do Hero banner
  console.log('Clicando no botão Assistir do Hero...');
  const heroAssistir = page.locator('button:has-text("Assistir")').first();
  if (await heroAssistir.count() > 0) {
    await heroAssistir.click();
    console.log('Botão Assistir clicado!');
    await page.waitForTimeout(4000);

    // Verifica se abriu modal de detalhes ou se abriu o player
    const modalData = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      const video = document.querySelector('video');
      const loader = document.querySelector('.animate-spin');
      const modalText = modal ? (modal as HTMLElement).innerText.slice(0, 300) : 'Nenhum modal aberto';
      return { hasModal: Boolean(modal), hasVideo: Boolean(video), hasLoader: Boolean(loader), modalText };
    });
    console.log('Estado após clicar em Assistir:', JSON.stringify(modalData, null, 2));
    await page.screenshot({ path: 'vercel_after_watch_click.png' });
  }

  console.log('\nErros capturados:', errors.slice(0, 10));
  await browser.close();
}

testWatch().catch(console.error);
