import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  console.log('1. Navegando para http://localhost:4173/tv...');
  await page.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Evidência C: Header transparente sobreposto ao banner com gradiente e blur progressivo
  const outHeaderHero = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_c_header_hero.png';
  await page.screenshot({ path: outHeaderHero });
  console.log('✓ Evidência C salva (Header integrado sobre o banner):', outHeaderHero);

  // Crop do Header
  const headerElem = await page.$('header');
  if (headerElem) {
    const outHeaderCrop = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_c_header_crop.png';
    await headerElem.screenshot({ path: outHeaderCrop });
    console.log('✓ Evidência C (Crop do Header) salva:', outHeaderCrop);
  }

  // 2. Navegação vertical para baixo (ArrowDown): do Hero para a primeira fileira
  console.log('2. Pressionando ArrowDown para descer até a primeira fileira de conteúdos...');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1000);

  // Evidência A & B: Capa selecionada na primeira fileira com contorno externo e cores naturais
  const outRowDown = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_ab_first_row_focused.png';
  await page.screenshot({ path: outRowDown });
  console.log('✓ Evidência A & B salva (Primeira fileira com foco no card):', outRowDown);

  // Crop da primeira capa focada e seu contorno externo
  const rowElem = await page.$('section[id^="row-"]');
  if (rowElem) {
    const outRowCrop = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_a_card_external_focus_crop.png';
    await rowElem.screenshot({ path: outRowCrop });
    console.log('✓ Evidência A (Crop do foco externo e cores da capa) salva:', outRowCrop);
  }

  const scrollYAfterDown = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
  console.log(`Posição de scroll vertical após ArrowDown: ${scrollYAfterDown}px`);

  // 3. Navegação vertical para cima (ArrowUp): da primeira fileira de volta ao Banner Principal
  console.log('3. Pressionando ArrowUp na primeira fileira para retornar ao Banner Principal...');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(1200);

  const scrollYAfterUp = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
  console.log(`Posição de scroll vertical após ArrowUp: ${scrollYAfterUp}px`);

  const activeFocusKey = await page.evaluate(() => {
    const active = document.activeElement;
    return active ? active.getAttribute('data-focus-key') : 'none';
  });
  console.log(`Elemento com foco após ArrowUp: ${activeFocusKey}`);

  // Evidência B2: Viewport retornou 100% ao topo com o banner principal visível e botão Assistir focado
  const outHeroRestored = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_b_hero_restored_1080p.png';
  await page.screenshot({ path: outHeroRestored });
  console.log('✓ Evidência B2 salva (Banner restaurado após ArrowUp):', outHeroRestored);

  // 4. Testar novamente ArrowDown para confirmar retorno à primeira fileira
  console.log('4. Pressionando ArrowDown novamente...');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1000);

  const scrollYAfterSecondDown = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
  console.log(`Posição de scroll vertical após segundo ArrowDown: ${scrollYAfterSecondDown}px`);

  await browser.close();
  console.log('=== Verificação concluída com sucesso! ===');
}

verify().catch(err => {
  console.error('Erro na verificação:', err);
  process.exit(1);
});
