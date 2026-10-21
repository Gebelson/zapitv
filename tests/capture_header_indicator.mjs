import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  console.log('Navegando para http://localhost:4173/tv...');
  await page.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Visão Geral 1080p do Header com Início ativo
  const outFull = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_header_indicator_refined.png';
  await page.screenshot({ path: outFull });
  console.log('✓ Captura 1080p com indicador refinado salva:', outFull);

  // 2. Zoom / Crop na barra de navegação superior (Header)
  const headerElem = await page.$('header');
  if (headerElem) {
    const outHeader = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_header_nav_crop.png';
    await headerElem.screenshot({ path: outHeader });
    console.log('✓ Crop do Header salvo:', outHeader);
  }

  // 3. Foco na navegação superior via controle remoto (Seta para cima)
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(400);

  // Foco inicial do header vai para Início ou navega para Filmes -> Séries
  await page.keyboard.press('ArrowRight'); // Filmes
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight'); // Séries
  await page.waitForTimeout(400);

  const outFocusSeries = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_header_nav_focus_series.png';
  await page.screenshot({ path: outFocusSeries });
  console.log('✓ Navegação do controle remoto no Header (Séries focado) salva:', outFocusSeries);

  await browser.close();
  console.log('=== Capturas do Header concluídas! ===');
}

capture().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
