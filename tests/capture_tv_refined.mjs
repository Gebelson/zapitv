import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  
  // 1. Captura TV 1920x1080 (Full HD Samsung The Frame)
  const context1080 = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page1080 = await context1080.newPage();
  console.log('Navegando para http://localhost:4173/tv...');
  await page1080.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page1080.waitForTimeout(2000);

  const out1080 = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_1080p_refined.png';
  await page1080.screenshot({ path: out1080 });
  console.log('✓ Captura 1920x1080 salva em:', out1080);

  // 2. Foco no primeiro card para capturar o contorno refinado
  await page1080.keyboard.press('ArrowDown');
  await page1080.waitForTimeout(600);
  const outFocus = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_card_focus.png';
  await page1080.screenshot({ path: outFocus });
  console.log('✓ Captura com card focado salva em:', outFocus);

  // 3. Captura TV 1280x720 (720p 16:9 alternativa)
  const context720 = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1
  });
  const page720 = await context720.newPage();
  await page720.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page720.waitForTimeout(1500);
  const out720 = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_720p_refined.png';
  await page720.screenshot({ path: out720 });
  console.log('✓ Captura 1280x720 salva em:', out720);

  // 4. Captura Desktop normal (para comprovar isolamento)
  const contextDesk = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const pageDesk = await contextDesk.newPage();
  await pageDesk.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await pageDesk.waitForTimeout(1500);
  const outDesk = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/desktop_verified_clean.png';
  await pageDesk.screenshot({ path: outDesk });
  console.log('✓ Captura Desktop salva em:', outDesk);

  await browser.close();
  console.log('TODAS AS CAPTURAS CONCLUÍDAS COM SUCESSO!');
}

capture().catch((err) => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
