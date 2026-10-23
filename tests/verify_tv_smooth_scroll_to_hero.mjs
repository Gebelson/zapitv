import { chromium } from 'playwright';
import { spawn } from 'child_process';
import assert from 'assert';

console.log('--- Iniciando Verificação Visual e Navegação Real: Retorno Suave ao Banner (Smart TV) ---');

// 1. Inicia o servidor de pré-visualização (Vite Preview)
const previewProcess = spawn('npx.cmd', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
  cwd: 'C:/Users/gebel/.gemini/antigravity/scratch/zapitv_app',
  shell: true
});

let serverReady = false;
previewProcess.stdout.on('data', (data) => {
  const str = data.toString();
  if (str.includes('4173') || str.includes('Local:')) {
    serverReady = true;
  }
});

// Aguarda até o servidor responder
for (let i = 0; i < 20; i++) {
  if (serverReady) break;
  await new Promise(r => setTimeout(r, 300));
}

try {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  console.log('2. Navegando para http://localhost:4173/tv...');
  await page.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verifica que o foco inicial está no botão Assistir do Hero e scrollY = 0
  const initialScrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop || 0);
  const initialFocusKey = await page.evaluate(() => document.activeElement?.getAttribute('data-focus-key') || 'none');
  console.log(`Estado Inicial -> scrollY: ${initialScrollY}px, activeFocusKey: ${initialFocusKey}`);
  assert.strictEqual(initialScrollY, 0, 'Scroll vertical inicial deve ser 0');

  // Evidência 1: Banner inicial com botão Assistir em foco
  const outHeroInitial = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_hero_initial_play_focused.png';
  await page.screenshot({ path: outHeroInitial });
  console.log('✓ Evidência 1 salva:', outHeroInitial);

  // 3. Pressiona ArrowDown para descer até a primeira fileira de conteúdos
  console.log('3. Pressionando ArrowDown no controle remoto...');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1200);

  const scrollYAfterDown = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop || 0);
  const focusAfterDown = await page.evaluate(() => document.activeElement?.getAttribute('data-focus-key') || 'none');
  console.log(`Após ArrowDown -> scrollY: ${scrollYAfterDown}px, activeFocusKey: ${focusAfterDown}`);
  assert.ok(scrollYAfterDown > 200, `Deveria ter rolado para baixo para exibir o carrossel (atual: ${scrollYAfterDown}px)`);

  // Evidência 2: Primeira fileira focada
  const outFirstRowFocused = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_first_row_focused.png';
  await page.screenshot({ path: outFirstRowFocused });
  console.log('✓ Evidência 2 salva:', outFirstRowFocused);

  // 4. Instala coletor de amostragem de scroll a cada 20ms no navegador para provar suavidade contínua
  console.log('4. Instalando monitor de rolagem contínua para capturar a curva de desaceleração...');
  await page.evaluate(() => {
    window.__scrollSamples = [];
    window.__sampleActive = true;
    const startTime = performance.now();
    const interval = setInterval(() => {
      if (!window.__sampleActive) {
        clearInterval(interval);
        return;
      }
      const elapsed = Math.round(performance.now() - startTime);
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      window.__scrollSamples.push({ elapsed, y });
    }, 20);
  });

  // 5. Pressiona ArrowUp na primeira fileira para retornar suavemente ao Banner
  console.log('5. Pressionando ArrowUp na primeira fileira para retornar ao Banner...');
  await page.keyboard.press('ArrowUp');

  // Aguarda 150ms para capturar a tela durante o movimento suave
  await page.waitForTimeout(150);
  const outMidScroll = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_mid_scroll_returning.png';
  await page.screenshot({ path: outMidScroll });
  console.log('✓ Evidência 3 salva (Durante a rolagem suave em andamento):', outMidScroll);

  // Aguarda a conclusão da transição suave (~450ms total)
  await page.waitForTimeout(450);

  // Finaliza amostragem
  const samples = await page.evaluate(() => {
    window.__sampleActive = false;
    return window.__scrollSamples;
  });

  console.log('\n--- Amostras de Trajetória da Rolagem Vertical (Tempo x ScrollY) ---');
  for (const s of samples.filter((_, idx) => idx % 2 === 0)) {
    console.log(`  +${s.elapsed}ms: scrollY = ${s.y}px`);
  }

  // Validações da rolagem suave:
  // 1. Nos primeiros 60ms, o scrollY NÃO deve ser 0 (se fosse um salto instantâneo, seria 0 imediatamente)
  const earlySample = samples.find(s => s.elapsed >= 40 && s.elapsed <= 80);
  if (earlySample) {
    assert.ok(earlySample.y > 50, `Nos primeiros ${earlySample.elapsed}ms o scrollY deve ser > 50px (atual: ${earlySample.y}px), comprovando que NÃO houve salto instantâneo.`);
    console.log(`✓ Verificado: Não houve salto instantâneo no início (+${earlySample.elapsed}ms: ${earlySample.y}px)`);
  }

  // 2. Houve amostragem intermediária com valores decrescentes graduais
  const distinctYValues = new Set(samples.map(s => Math.round(s.y / 20) * 20));
  assert.ok(distinctYValues.size >= 4, `Deve haver múltiplos estágios intermediários na desaceleração (encontrados ${distinctYValues.size} estágios)`);
  console.log(`✓ Verificado: Movimento contínuo e progressivo detectado (${distinctYValues.size} níveis de altura amostrados)`);

  // 3. Ao final da transição, scrollY = 0 exato
  const finalScrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop || 0);
  console.log(`\nEstado Final -> scrollY: ${finalScrollY}px`);
  assert.strictEqual(finalScrollY, 0, 'Scroll vertical final deve ser exatamente 0 (banner perfeitamente enquadrado)');

  // 4. Botão Assistir ('tv-hero-play') está com o foco
  const finalFocusKey = await page.evaluate(() => document.activeElement?.getAttribute('data-focus-key') || 'none');
  console.log(`Estado Final -> activeFocusKey: ${finalFocusKey}`);
  assert.strictEqual(finalFocusKey, 'tv-hero-play', 'O foco deve estar perfeitamente posicionado em tv-hero-play');

  // Evidência 4: Banner perfeitamente enquadrado com o botão Assistir selecionado
  const outHeroRestored = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_evidence_hero_play_restored_smooth.png';
  await page.screenshot({ path: outHeroRestored });
  console.log('✓ Evidência 4 salva (Banner perfeitamente enquadrado com foco em Assistir):', outHeroRestored);

  await browser.close();
  console.log('\n✓ Validação E2E em navegador Edge/Chromium concluída com 100% de sucesso!');
} finally {
  previewProcess.kill();
}
