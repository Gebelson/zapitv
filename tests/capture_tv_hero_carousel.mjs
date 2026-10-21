import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  
  const context1080 = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page1080 = await context1080.newPage();
  console.log('Navegando para http://localhost:4173/tv...');
  await page1080.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page1080.waitForTimeout(2000);

  // 1. Slide 1 inicial (Verdade Oculta) com botões e primeiro indicador ativo
  const outSlide1 = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_hero_slide1_verdade_oculta.png';
  await page1080.screenshot({ path: outSlide1 });
  console.log('✓ Slide 1 inicial capturado:', outSlide1);

  // 2. Foco no botão Próximo Destaque (tv-hero-next) e clique para avançar para o Slide 2
  // Pressiona ArrowRight a partir de tv-hero-play: play -> details -> prev -> next
  await page1080.keyboard.press('ArrowRight'); // vai para details
  await page1080.waitForTimeout(200);
  await page1080.keyboard.press('ArrowRight'); // vai para prev
  await page1080.waitForTimeout(200);
  await page1080.keyboard.press('ArrowRight'); // vai para next
  await page1080.waitForTimeout(300);

  const outFocusNext = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_hero_focus_next_btn.png';
  await page1080.screenshot({ path: outFocusNext });
  console.log('✓ Botão Próximo Destaque focado capturado:', outFocusNext);

  // Aciona Enter no botão Próximo
  await page1080.keyboard.press('Enter');
  // Aguarda 1 segundo para a transição cinematográfica completar (250ms texto + 700ms imagem)
  await page1080.waitForTimeout(1000);

  // 3. Slide 2 ativo (Digger) com backdrop atualizado, título, sinopse e segundo indicador ativo
  const outSlide2 = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_hero_slide2_digger.png';
  await page1080.screenshot({ path: outSlide2 });
  console.log('✓ Slide 2 (Digger) com transição capturado:', outSlide2);

  // 4. Avança mais uma vez para o Slide 3 (Outra Mamãe)
  await page1080.keyboard.press('Enter');
  await page1080.waitForTimeout(1000);

  const outSlide3 = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_hero_slide3_outra_mamae.png';
  await page1080.screenshot({ path: outSlide3 });
  console.log('✓ Slide 3 (Outra Mamãe) capturado:', outSlide3);

  await browser.close();
  console.log('=== Capturas visuais concluídas com sucesso! ===');
}

capture().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
