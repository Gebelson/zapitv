import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const brainDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d';

const chromePath = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') 
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : (fs.existsSync('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' : undefined);

async function captureMobileScreenshots() {
  console.log('=== CAPTURANDO SCREENSHOTS E VALIDANDO REDESIGN MOBILE ===\n');

  const testPort = '4011';
  const server = spawn('npx.cmd', ['tsx', 'server.ts'], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: testPort },
    stdio: 'pipe',
    shell: true
  });

  server.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg.includes('running on') || msg.includes('Error')) console.log('[server]', msg);
  });

  // Aguarda servidor responder
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${testPort}`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 400));
  }

  if (!ready) {
    console.error('Falha ao subir servidor de teste.');
    server.kill();
    process.exit(1);
  }

  console.log(`Servidor ativo na porta ${testPort}. Conectando Chromium...`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const resolutions = [
    { name: '320x568_iPhoneSE', width: 320, height: 568 },
    { name: '360x800_AndroidStandard', width: 360, height: 800 },
    { name: '375x812_iPhoneMini', width: 375, height: 812 },
    { name: '390x844_iPhone13_14', width: 390, height: 844 },
    { name: '430x932_iPhoneProMax', width: 430, height: 932 }
  ];

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();

    // 1. Testa resolução padrão (390x844) para todas as abas
    console.log('Capturando abas no viewport 390x844 (iPhone 13/14)...');
    await page.setViewportSize({ width: 390, height: 844 });

    // Home
    await page.goto(`http://localhost:${testPort}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const homeShot = path.join(brainDir, 'mobile_390_home.png');
    await page.screenshot({ path: homeShot, fullPage: false });
    console.log(`  -> Home capturada: ${homeShot}`);

    // Explorar
    await page.goto(`http://localhost:${testPort}/explorar`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const exploreShot = path.join(brainDir, 'mobile_390_explore.png');
    await page.screenshot({ path: exploreShot, fullPage: false });
    console.log(`  -> Explorar capturada: ${exploreShot}`);

    // Buscar
    await page.goto(`http://localhost:${testPort}/buscar`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const searchShot = path.join(brainDir, 'mobile_390_search.png');
    await page.screenshot({ path: searchShot, fullPage: false });
    console.log(`  -> Buscar capturada: ${searchShot}`);

    // Minha ZapiTV
    await page.goto(`http://localhost:${testPort}/minha-zapitv`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const myZapiShot = path.join(brainDir, 'mobile_390_myzapi.png');
    await page.screenshot({ path: myZapiShot, fullPage: false });
    console.log(`  -> Minha ZapiTV capturada: ${myZapiShot}`);

    // 2. Testa resoluções extremas (320px compacta e 430px grande)
    console.log('\nCapturando resoluções extremas...');
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`http://localhost:${testPort}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const compactShot = path.join(brainDir, 'mobile_320_home.png');
    await page.screenshot({ path: compactShot, fullPage: false });
    console.log(`  -> 320x568 Compact Home capturada: ${compactShot}`);

    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto(`http://localhost:${testPort}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const largeShot = path.join(brainDir, 'mobile_430_home.png');
    await page.screenshot({ path: largeShot, fullPage: false });
    console.log(`  -> 430x932 Large Home capturada: ${largeShot}`);

    // 3. Validação do Desktop (>= 768px) para comprovar ZERO REGRESSÃO
    console.log('\nValidando Desktop (1280x800) para comprovar isolamento estrito...');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${testPort}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const desktopShot = path.join(brainDir, 'desktop_1280_preservation.png');
    await page.screenshot({ path: desktopShot, fullPage: false });
    console.log(`  -> Desktop preservado capturado: ${desktopShot}`);

    console.log('\n=== TODAS AS SCREENSHOTS FORAM CAPTURADAS COM SUCESSO! ===');
  } finally {
    await browser.close();
    server.kill();
  }
}

captureMobileScreenshots().catch(err => {
  console.error('Erro na captura de screenshots:', err);
  process.exit(1);
});
