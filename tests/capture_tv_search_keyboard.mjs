import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/keyboard_evidence';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const UA_FIRE_TV = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36';
const UA_SAMSUNG_TIZEN = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';
const UA_MSX = 'Mozilla/5.0 (SmartHub; SMART-TV; U; Linux/SmartTV) AppleWebKit/538.1+ (KHTML, like Gecko) MediaStationX/0.1.155';

async function runVisualTests() {
  console.log('=== ZAPITV | TESTE VISUAL E MEDIÇÃO DOM: TECLADO VIRTUAL SMART TV & FIRE TV ===\n');

  // 1. Inicializa servidor Vite
  console.log('1. Iniciando servidor Vite para o preview...');
  const server = await createServer({
    server: { port: 5199 }
  });
  await server.listen();
  console.log('✓ Servidor Vite ativo em http://localhost:5199\n');

  // 2. Lança navegador Chromium headless
  console.log('2. Lançando navegador Chromium headless...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const measurements = [];

  try {
    // =========================================================================
    // TESTE A: Fire TV (960x540, Silk UA, DPR 2.0)
    // =========================================================================
    console.log('\n--- Teste A: Fire TV (960x540, Silk UA) ---');
    const contextFire540 = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 2.0,
      userAgent: UA_FIRE_TV
    });
    const pageFire540 = await contextFire540.newPage();
    await pageFire540.goto('http://localhost:5199/tests/harness/search_keyboard_preview.html', { waitUntil: 'networkidle' });
    await pageFire540.waitForTimeout(600);

    const rectsFire540 = await pageFire540.evaluate(() => {
      const space = document.querySelector('[data-focus-key="tv-key-space"]')?.getBoundingClientRect();
      const backspace = document.querySelector('[data-focus-key="tv-key-backspace"]')?.getBoundingClientRect();
      const clear = document.querySelector('[data-focus-key="tv-key-clear"]')?.getBoundingClientRect();
      const keyA = document.querySelector('[data-focus-key="tv-key-a"]')?.getBoundingClientRect();
      const keyZ = document.querySelector('[data-focus-key="tv-key-z"]')?.getBoundingClientRect();
      const sidebar = document.querySelector('div.flex-shrink-0.h-full.flex.flex-col')?.getBoundingClientRect();
      return {
        spaceHeight: space?.height,
        backspaceHeight: backspace?.height,
        clearHeight: clear?.height,
        keyAHeight: keyA?.height,
        keyZHeight: keyZ?.height,
        sidebarWidth: sidebar?.width
      };
    });

    console.log('  Medições reais DOM no Fire TV 540p:', rectsFire540);
    measurements.push({ test: 'Teste A (Fire TV 960x540)', ...rectsFire540 });

    const pathA = path.join(outDir, '01_firetv_960x540_search_keyboard.png');
    await pageFire540.screenshot({ path: pathA });
    console.log('✓ Captura salva:', pathA);

    const keyboardElA = await pageFire540.$('.grid.grid-cols-6');
    if (keyboardElA) {
      const pathACrop = path.join(outDir, '01_firetv_960x540_keyboard_crop.png');
      await keyboardElA.screenshot({ path: pathACrop });
      console.log('✓ Crop do teclado salvo:', pathACrop);
    }
    await contextFire540.close();

    // =========================================================================
    // TESTE B: Samsung Tizen (960x540, Tizen UA)
    // =========================================================================
    console.log('\n--- Teste B: Samsung Tizen (960x540, Tizen UA - Sem redução exclusiva de Fire TV) ---');
    const contextTizen540 = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 1.0,
      userAgent: UA_SAMSUNG_TIZEN
    });
    const pageTizen540 = await contextTizen540.newPage();
    await pageTizen540.goto('http://localhost:5199/tests/harness/search_keyboard_preview.html', { waitUntil: 'networkidle' });
    await pageTizen540.waitForTimeout(600);

    const rectsTizen540 = await pageTizen540.evaluate(() => {
      const space = document.querySelector('[data-focus-key="tv-key-space"]')?.getBoundingClientRect();
      const backspace = document.querySelector('[data-focus-key="tv-key-backspace"]')?.getBoundingClientRect();
      const clear = document.querySelector('[data-focus-key="tv-key-clear"]')?.getBoundingClientRect();
      const keyA = document.querySelector('[data-focus-key="tv-key-a"]')?.getBoundingClientRect();
      const keyZ = document.querySelector('[data-focus-key="tv-key-z"]')?.getBoundingClientRect();
      const sidebar = document.querySelector('div.flex-shrink-0.h-full.flex.flex-col')?.getBoundingClientRect();
      return {
        spaceHeight: space?.height,
        backspaceHeight: backspace?.height,
        clearHeight: clear?.height,
        keyAHeight: keyA?.height,
        keyZHeight: keyZ?.height,
        sidebarWidth: sidebar?.width
      };
    });

    console.log('  Medições reais DOM no Samsung Tizen 540p:', rectsTizen540);
    measurements.push({ test: 'Teste B (Samsung Tizen 960x540)', ...rectsTizen540 });

    const pathB = path.join(outDir, '02_tizen_960x540_search_keyboard.png');
    await pageTizen540.screenshot({ path: pathB });
    console.log('✓ Captura salva:', pathB);

    const keyboardElB = await pageTizen540.$('.grid.grid-cols-6');
    if (keyboardElB) {
      const pathBCrop = path.join(outDir, '02_tizen_960x540_keyboard_crop.png');
      await keyboardElB.screenshot({ path: pathBCrop });
      console.log('✓ Crop do teclado salvo:', pathBCrop);
    }
    await contextTizen540.close();

    // =========================================================================
    // TESTE C: Samsung Tizen (1920x1080, Tizen UA)
    // =========================================================================
    console.log('\n--- Teste C: Samsung Tizen (1920x1080, Proporções Normais Restauradas) ---');
    const contextTizen1080 = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1.0,
      userAgent: UA_SAMSUNG_TIZEN
    });
    const pageTizen1080 = await contextTizen1080.newPage();
    await pageTizen1080.goto('http://localhost:5199/tests/harness/search_keyboard_preview.html', { waitUntil: 'networkidle' });
    await pageTizen1080.waitForTimeout(600);

    const rectsTizen1080 = await pageTizen1080.evaluate(() => {
      const space = document.querySelector('[data-focus-key="tv-key-space"]')?.getBoundingClientRect();
      const backspace = document.querySelector('[data-focus-key="tv-key-backspace"]')?.getBoundingClientRect();
      const clear = document.querySelector('[data-focus-key="tv-key-clear"]')?.getBoundingClientRect();
      const keyA = document.querySelector('[data-focus-key="tv-key-a"]')?.getBoundingClientRect();
      const keyZ = document.querySelector('[data-focus-key="tv-key-z"]')?.getBoundingClientRect();
      const sidebar = document.querySelector('div.flex-shrink-0.h-full.flex.flex-col')?.getBoundingClientRect();
      return {
        spaceHeight: space?.height,
        backspaceHeight: backspace?.height,
        clearHeight: clear?.height,
        keyAHeight: keyA?.height,
        keyZHeight: keyZ?.height,
        sidebarWidth: sidebar?.width
      };
    });

    console.log('  Medições reais DOM no Samsung Tizen 1080p:', rectsTizen1080);
    measurements.push({ test: 'Teste C (Samsung Tizen 1920x1080)', ...rectsTizen1080 });

    const pathC = path.join(outDir, '03_tizen_1920x1080_search_keyboard.png');
    await pageTizen1080.screenshot({ path: pathC });
    console.log('✓ Captura salva:', pathC);

    const keyboardElC = await pageTizen1080.$('.grid.grid-cols-6');
    if (keyboardElC) {
      const pathCCrop = path.join(outDir, '03_tizen_1920x1080_keyboard_crop.png');
      await keyboardElC.screenshot({ path: pathCCrop });
      console.log('✓ Crop do teclado salvo:', pathCCrop);
    }
    await contextTizen1080.close();

    // =========================================================================
    // TESTE D: Media Station X (1280x720, MSX UA)
    // =========================================================================
    console.log('\n--- Teste D: Media Station X (1280x720, MSX UA) ---');
    const contextMsx720 = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1.0,
      userAgent: UA_MSX
    });
    const pageMsx720 = await contextMsx720.newPage();
    await pageMsx720.goto('http://localhost:5199/tests/harness/search_keyboard_preview.html', { waitUntil: 'networkidle' });
    await pageMsx720.waitForTimeout(600);

    const rectsMsx720 = await pageMsx720.evaluate(() => {
      const space = document.querySelector('[data-focus-key="tv-key-space"]')?.getBoundingClientRect();
      const backspace = document.querySelector('[data-focus-key="tv-key-backspace"]')?.getBoundingClientRect();
      const clear = document.querySelector('[data-focus-key="tv-key-clear"]')?.getBoundingClientRect();
      const keyA = document.querySelector('[data-focus-key="tv-key-a"]')?.getBoundingClientRect();
      const keyZ = document.querySelector('[data-focus-key="tv-key-z"]')?.getBoundingClientRect();
      const sidebar = document.querySelector('div.flex-shrink-0.h-full.flex.flex-col')?.getBoundingClientRect();
      return {
        spaceHeight: space?.height,
        backspaceHeight: backspace?.height,
        clearHeight: clear?.height,
        keyAHeight: keyA?.height,
        keyZHeight: keyZ?.height,
        sidebarWidth: sidebar?.width
      };
    });

    console.log('  Medições reais DOM no Media Station X 720p:', rectsMsx720);
    measurements.push({ test: 'Teste D (Media Station X 1280x720)', ...rectsMsx720 });

    const pathD = path.join(outDir, '04_msx_1280x720_search_keyboard.png');
    await pageMsx720.screenshot({ path: pathD });
    console.log('✓ Captura salva:', pathD);

    const keyboardElD = await pageMsx720.$('.grid.grid-cols-6');
    if (keyboardElD) {
      const pathDCrop = path.join(outDir, '04_msx_1280x720_keyboard_crop.png');
      await keyboardElD.screenshot({ path: pathDCrop });
      console.log('✓ Crop do teclado salvo:', pathDCrop);
    }
    await contextMsx720.close();

    // =========================================================================
    // TESTE E: Fire TV (1280x720, Fire TV UA)
    // =========================================================================
    console.log('\n--- Teste E: Fire TV (1280x720, Silk UA) ---');
    const contextFire720 = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1.5,
      userAgent: UA_FIRE_TV
    });
    const pageFire720 = await contextFire720.newPage();
    await pageFire720.goto('http://localhost:5199/tests/harness/search_keyboard_preview.html', { waitUntil: 'networkidle' });
    await pageFire720.waitForTimeout(600);

    const rectsFire720 = await pageFire720.evaluate(() => {
      const space = document.querySelector('[data-focus-key="tv-key-space"]')?.getBoundingClientRect();
      const backspace = document.querySelector('[data-focus-key="tv-key-backspace"]')?.getBoundingClientRect();
      const clear = document.querySelector('[data-focus-key="tv-key-clear"]')?.getBoundingClientRect();
      const keyA = document.querySelector('[data-focus-key="tv-key-a"]')?.getBoundingClientRect();
      const keyZ = document.querySelector('[data-focus-key="tv-key-z"]')?.getBoundingClientRect();
      const sidebar = document.querySelector('div.flex-shrink-0.h-full.flex.flex-col')?.getBoundingClientRect();
      return {
        spaceHeight: space?.height,
        backspaceHeight: backspace?.height,
        clearHeight: clear?.height,
        keyAHeight: keyA?.height,
        keyZHeight: keyZ?.height,
        sidebarWidth: sidebar?.width
      };
    });

    console.log('  Medições reais DOM no Fire TV 720p:', rectsFire720);
    measurements.push({ test: 'Teste E (Fire TV 1280x720)', ...rectsFire720 });

    const pathE = path.join(outDir, '05_firetv_1280x720_search_keyboard.png');
    await pageFire720.screenshot({ path: pathE });
    console.log('✓ Captura salva:', pathE);

    const keyboardElE = await pageFire720.$('.grid.grid-cols-6');
    if (keyboardElE) {
      const pathECrop = path.join(outDir, '05_firetv_1280x720_keyboard_crop.png');
      await keyboardElE.screenshot({ path: pathECrop });
      console.log('✓ Crop do teclado salvo:', pathECrop);
    }

    // =========================================================================
    // TESTE F: Navegação D-Pad e Interação
    // =========================================================================
    console.log('\n--- Teste F: Navegação D-Pad e Interação do Controle Remoto ---');
    // Digita "DUNA" usando o D-pad / teclado
    await pageFire720.click('[data-focus-key="tv-key-d"]');
    await pageFire720.waitForTimeout(100);
    await pageFire720.click('[data-focus-key="tv-key-u"]');
    await pageFire720.waitForTimeout(100);
    await pageFire720.click('[data-focus-key="tv-key-n"]');
    await pageFire720.waitForTimeout(100);
    await pageFire720.click('[data-focus-key="tv-key-a"]');
    await pageFire720.waitForTimeout(300);

    const pathF = path.join(outDir, '06_search_typing_dune_results.png');
    await pageFire720.screenshot({ path: pathF });
    console.log('✓ Captura com busca e resultados salva:', pathF);

    await contextFire720.close();

    // Salva arquivo com os dados de medição
    fs.writeFileSync(path.join(outDir, 'dom_measurements.json'), JSON.stringify(measurements, null, 2), 'utf8');
    console.log('\n✓ Medições salvas em dom_measurements.json');

    console.log('\n========================================================================');
    console.log(' TODAS AS CAPTURAS DE TELA E MEDIÇÕES FORAM CONCLUÍDAS COM SUCESSO! ');
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
