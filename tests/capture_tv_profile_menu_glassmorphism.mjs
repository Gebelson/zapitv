import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/header_evidence';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runVisualTests() {
  console.log('=== ZAPITV | TESTE VISUAL: HEADER GLASSMORPHISM & MENU DE PERFIL ===\n');

  // 1. Inicializa servidor Vite programmatic
  console.log('1. Iniciando servidor Vite...');
  const server = await createServer({
    server: { port: 5197 }
  });
  await server.listen();
  console.log('✓ Servidor Vite ativo em http://localhost:5197\n');

  // 2. Lança navegador Chromium headless
  console.log('2. Lançando navegador Chromium headless...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // ==========================================
    // PARTE 1: Desktop TV Mode (1920x1080)
    // ==========================================
    console.log('\n--- Testando Modo TV Desktop / Smart TV Full HD (1920x1080) ---');
    const context1080 = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });
    const page1080 = await context1080.newPage();

    // Cenário 1: Header normal, menu fechado (Banner Escuro)
    console.log('Capturando Cenário 1: Header normal, menu fechado (Banner Escuro)...');
    await page1080.goto('http://localhost:5197/tests/harness/header_profile_preview.html?banner=dark', { waitUntil: 'networkidle' });
    await page1080.waitForTimeout(600);
    const path01 = path.join(outDir, '01_header_normal_menu_closed_1920x1080.png');
    await page1080.screenshot({ path: path01 });
    console.log('✓ Salvo:', path01);

    // Cenário 2: Header com menu aberto (Banner Escuro)
    console.log('Abrindo menu de perfil pelo botão Perfil (Enter/Click)...');
    await page1080.click('[data-focus-key="tv-nav-profile"]');
    await page1080.waitForTimeout(400);
    const path02 = path.join(outDir, '02_header_menu_open_1920x1080.png');
    await page1080.screenshot({ path: path02 });
    console.log('✓ Salvo:', path02);

    // Cenário 3: Menu sendo fechado / fechado pelo botão Voltar (Escape) ou clique fora
    console.log('Fechando o menu de perfil com Escape (botão Voltar)...');
    await page1080.keyboard.press('Escape');
    await page1080.waitForTimeout(400);
    const path03 = path.join(outDir, '03_header_menu_closed_restored_1920x1080.png');
    await page1080.screenshot({ path: path03 });
    console.log('✓ Salvo:', path03);

    // Cenário 4: Header sobre banner claro (Menu Fechado)
    console.log('Capturando Cenário 4: Header sobre banner claro (Menu Fechado)...');
    await page1080.goto('http://localhost:5197/tests/harness/header_profile_preview.html?banner=bright', { waitUntil: 'networkidle' });
    await page1080.waitForTimeout(600);
    const path04 = path.join(outDir, '04_header_bright_banner_closed_1920x1080.png');
    await page1080.screenshot({ path: path04 });
    console.log('✓ Salvo:', path04);

    // Cenário 5: Header sobre banner claro (Menu Aberto)
    console.log('Abrindo menu de perfil sobre banner claro...');
    await page1080.click('[data-focus-key="tv-nav-profile"]');
    await page1080.waitForTimeout(400);
    const path05 = path.join(outDir, '05_header_bright_banner_open_1920x1080.png');
    await page1080.screenshot({ path: path05 });
    console.log('✓ Salvo:', path05);

    // Crop do Header em 1080p para inspeção minuciosa
    const headerEl1080 = await page1080.$('[data-testid="tv-header"]');
    if (headerEl1080) {
      const pathHeaderCrop = path.join(outDir, '06_header_crop_open_bright.png');
      await headerEl1080.screenshot({ path: pathHeaderCrop });
      console.log('✓ Salvo crop do header sobre banner claro:', pathHeaderCrop);
    }
    await context1080.close();

    // ==========================================
    // PARTE 2: Amazon Fire TV Stick Simulado (960x540, Silk Browser, DPR 2.0)
    // ==========================================
    console.log('\n--- Testando Amazon Fire TV Stick Simulado (960x540, Silk Browser) ---');
    const contextFireTv = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 2.0,
      userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36'
    });
    const pageFireTv = await contextFireTv.newPage();

    // Fire TV: Menu fechado
    await pageFireTv.goto('http://localhost:5197/tests/harness/header_profile_preview.html?banner=dark', { waitUntil: 'networkidle' });
    await pageFireTv.waitForTimeout(600);
    const path07 = path.join(outDir, '07_firetv_960x540_header_menu_closed.png');
    await pageFireTv.screenshot({ path: path07 });
    console.log('✓ Salvo Fire TV fechado:', path07);

    // Fire TV: Menu aberto
    await pageFireTv.click('[data-focus-key="tv-nav-profile"]');
    await pageFireTv.waitForTimeout(400);
    const path08 = path.join(outDir, '08_firetv_960x540_header_menu_open.png');
    await pageFireTv.screenshot({ path: path08 });
    console.log('✓ Salvo Fire TV aberto:', path08);
    await contextFireTv.close();

    // ==========================================
    // PARTE 3: Samsung Tizen Simulado (1280x720, Tizen 6.5)
    // ==========================================
    console.log('\n--- Testando Samsung Tizen Simulado (1280x720) ---');
    const contextTizen = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1.0,
      userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36'
    });
    const pageTizen = await contextTizen.newPage();

    // Tizen: Menu fechado
    await pageTizen.goto('http://localhost:5197/tests/harness/header_profile_preview.html?banner=dark', { waitUntil: 'networkidle' });
    await pageTizen.waitForTimeout(600);
    const path09 = path.join(outDir, '09_tizen_1280x720_header_menu_closed.png');
    await pageTizen.screenshot({ path: path09 });
    console.log('✓ Salvo Tizen fechado:', path09);

    // Tizen: Menu aberto
    await pageTizen.click('[data-focus-key="tv-nav-profile"]');
    await pageTizen.waitForTimeout(400);
    const path10 = path.join(outDir, '10_tizen_1280x720_header_menu_open.png');
    await pageTizen.screenshot({ path: path10 });
    console.log('✓ Salvo Tizen aberto:', path10);
    await contextTizen.close();

    console.log('\n========================================================================');
    console.log(' TODAS AS CAPTURAS DE TELA FORAM REALIZADAS COM SUCESSO! ');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
    await server.close();
  }
}

runVisualTests().catch((err) => {
  console.error('\n❌ Erro durante captura de imagens:', err);
  process.exit(1);
});
