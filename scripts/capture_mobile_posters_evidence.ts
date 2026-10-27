import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const brainDir = path.join('C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d', 'mobile_posters_evidence');

if (!fs.existsSync(brainDir)) {
  fs.mkdirSync(brainDir, { recursive: true });
}

const chromePath = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') 
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : (fs.existsSync('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' : undefined);

async function run() {
  console.log('=== CAPTURANDO EVIDÊNCIAS VISUAIS DAS CAPAS OFICIAIS MOBILE ===\n');

  const testPort = '4012';
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

  console.log(`Servidor ativo na porta ${testPort}. Conectando Chromium emulado Mobile (iPhone 14 - 390x844)...`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();

    // 1. Acessa Home
    await page.goto(`http://localhost:${testPort}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Screenshot do Topo da Home e Hero
    const shotHero = path.join(brainDir, '01_mobile_home_hero.png');
    await page.screenshot({ path: shotHero });
    console.log(`[Screenshot 1/5] Salva: ${shotHero}`);

    // Rola para a fileira de Em Alta e Top 10
    await page.evaluate(() => window.scrollTo({ top: 480, behavior: 'instant' }));
    await page.waitForTimeout(1500);
    const shotTop10 = path.join(brainDir, '02_mobile_home_top10_and_trending.png');
    await page.screenshot({ path: shotTop10 });
    console.log(`[Screenshot 2/5] Salva: ${shotTop10}`);

    // Rola para os primeiros carrosséis de plataformas (Disney+, Prime Video, HBO Max)
    await page.evaluate(() => window.scrollTo({ top: 980, behavior: 'instant' }));
    await page.waitForTimeout(2000);
    const shotPlatforms1 = path.join(brainDir, '03_mobile_home_platforms_disney_prime_hbo.png');
    await page.screenshot({ path: shotPlatforms1 });
    console.log(`[Screenshot 3/5] Salva: ${shotPlatforms1}`);

    // Rola para mais carrosséis de plataformas (Apple TV+, Globoplay, Paramount+)
    await page.evaluate(() => window.scrollTo({ top: 1550, behavior: 'instant' }));
    await page.waitForTimeout(2000);
    const shotPlatforms2 = path.join(brainDir, '04_mobile_home_platforms_apple_globoplay_paramount.png');
    await page.screenshot({ path: shotPlatforms2 });
    console.log(`[Screenshot 4/5] Salva: ${shotPlatforms2}`);

    // Rola para carrosséis de Animes e séries adicionais
    await page.evaluate(() => window.scrollTo({ top: 2150, behavior: 'instant' }));
    await page.waitForTimeout(2000);
    const shotPlatforms3 = path.join(brainDir, '05_mobile_home_animes_and_more.png');
    await page.screenshot({ path: shotPlatforms3 });
    console.log(`[Screenshot 5/5] Salva: ${shotPlatforms3}`);

    // Verificação DOM: Verificar se alguma imagem renderizada na página contém '489599849927'
    const unsplashFound = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => (img.src || '').includes('489599849927')).map(img => ({
        src: img.src,
        alt: img.alt
      }));
    });

    console.log(`\nVerificação DOM de imagens Unsplash na Home: ${unsplashFound.length} encontradas (Esperado: 0)`);
    if (unsplashFound.length > 0) {
      console.error('AVISO: Imagens Unsplash ainda renderizadas:', unsplashFound);
    } else {
      console.log('✅ ZERO imagens de sala de cinema do Unsplash na tela!');
    }

    // Salvar auditoria JSON
    fs.writeFileSync(
      path.join(brainDir, 'visual_audit_evidence.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        viewport: { width: 390, height: 844 },
        unsplashFoundCount: unsplashFound.length,
        screenshots: [
          '01_mobile_home_hero.png',
          '02_mobile_home_top10_and_trending.png',
          '03_mobile_home_platforms_disney_prime_hbo.png',
          '04_mobile_home_platforms_apple_globoplay_paramount.png',
          '05_mobile_home_animes_and_more.png'
        ]
      }, null, 2),
      'utf8'
    );

  } finally {
    await browser.close();
    server.kill();
  }
}

run().then(() => {
  console.log('Captura de evidências visuais concluída com sucesso!');
  process.exit(0);
}).catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
