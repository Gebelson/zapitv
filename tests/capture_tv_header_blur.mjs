import { chromium } from 'playwright';

async function run() {
  console.log('Iniciando captura de evidências visuais do desfoque do header...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: ['--enable-experimental-web-platform-features']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  console.log('Navegando para http://localhost:4173/tv...');
  await page.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const artifactDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d';

  // 1. Evidência inicial: Banner com header flutuante e desfoque suave
  const outHero = `${artifactDir}/tv_evidence_header_blur_hero_top.png`;
  await page.screenshot({ path: outHero });
  console.log('✓ Evidência 1 salva (Header sobre o Hero Banner):', outHero);

  // 2. Descer com ArrowDown para rolar carrosséis por trás do header
  console.log('Pressionando ArrowDown para focar na primeira fileira e descer...');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(800);

  // Posicionar a fileira de conteúdos passando diretamente sob o header
  console.log('Posicionando a primeira fileira no topo sob o header...');
  await page.evaluate(() => {
    const row = document.querySelector('section[id^="row-"]');
    if (row) {
      row.scrollIntoView({ block: 'start' });
    }
  });
  await page.waitForTimeout(1000);

  // 3. Captura 1080p completa com carrosséis passando sob o header com desfoque real
  const outScrolled = `${artifactDir}/tv_evidence_header_blur_scrolled_1080p.png`;
  await page.screenshot({ path: outScrolled });
  console.log('✓ Evidência 2 salva (1080p com capas e textos passando sob header desfocado):', outScrolled);

  // 4. Crop focado do Header com o conteúdo do catálogo desfocado por trás
  const headerElem = await page.$('header');
  if (headerElem) {
    const outHeaderCrop = `${artifactDir}/tv_evidence_header_blur_crop.png`;
    await headerElem.screenshot({ path: outHeaderCrop });
    console.log('✓ Evidência 3 salva (Crop detalhado do Header com desfoque e textos nítidos):', outHeaderCrop);
  }

  // 5. Verificação das propriedades computadas do CSS no DOM
  const blurStyles = await page.evaluate(() => {
    const el = document.querySelector('.tv-header-blur');
    if (!el) return null;
    const computed = window.getComputedStyle(el);
    return {
      backdropFilter: computed.backdropFilter || computed.webkitBackdropFilter,
      maskImage: computed.maskImage || computed.webkitMaskImage,
      opacity: computed.opacity,
      pointerEvents: computed.pointerEvents
    };
  });
  console.log('Propriedades computadas de .tv-header-blur:', blurStyles);

  await browser.close();
  console.log('=== Todas as capturas de evidência foram geradas com sucesso! ===');
}

run().catch(err => {
  console.error('Erro ao gerar capturas:', err);
  process.exit(1);
});
