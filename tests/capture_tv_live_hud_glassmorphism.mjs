import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/hud_evidence';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runVisualTests() {
  console.log('=== ZAPITV | TESTE VISUAL E CAPTURA DE SCREENSHOTS DO HUD AO VIVO ===\n');

  // 1. Inicializa servidor Vite
  console.log('1. Iniciando servidor Vite para o preview...');
  const server = await createServer({
    server: { port: 5196 }
  });
  await server.listen();
  console.log('✓ Servidor Vite ativo em http://localhost:5196\n');

  // 2. Lança navegador Chromium
  console.log('2. Lançando navegador Chromium headless...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080, dpr: 1 },
    { name: '1280x720', width: 1280, height: 720, dpr: 1 },
    { name: '960x540', width: 960, height: 540, dpr: 2.0, ua: 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36' }
  ];

  const scenes = [
    { key: 'dark', label: 'Vídeo Escuro' },
    { key: 'bright', label: 'Vídeo Claro' },
    { key: 'colorful', label: 'Cena com Muitas Cores' },
    { key: 'motion', label: 'Cena Dinâmica em Movimento' }
  ];

  let captureIndex = 1;

  for (const vp of viewports) {
    console.log(`\n--- Testando Viewport ${vp.name} (${vp.width}x${vp.height}) ---`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr || 1,
      userAgent: vp.ua || undefined
    });
    const page = await context.newPage();

    for (const sc of scenes) {
      const url = `http://localhost:5196/tests/harness/hud_preview.html?scene=${sc.key}&channel=cultura`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      const filename = `${String(captureIndex).padStart(2, '0')}_hud_${sc.key}_${vp.name.replace('x', '_')}.png`;
      const fullPath = path.join(outDir, filename);

      await page.screenshot({ path: fullPath });
      console.log(`  ✓ [${captureIndex}] ${sc.label} (${vp.name}) -> ${filename}`);

      // Validação programática de layout no DOM
      const overlayBox = await page.locator('[data-testid="tv-live-glass-surface"]').boundingBox();
      if (overlayBox) {
        console.log(`     Medidas HUD: ${Math.round(overlayBox.width)}px × ${Math.round(overlayBox.height)}px`);
        if (vp.width === 960) {
          if (overlayBox.height > 115) {
            console.warn(`     ⚠️ Alerta: Altura em 960x540 (${overlayBox.height}px) um pouco elevada`);
          }
        }
      }

      captureIndex++;
    }

    // Captura adicional da referência "+MaisUm TV"
    if (vp.width === 960) {
      const urlMaisUm = `http://localhost:5196/tests/harness/hud_preview.html?scene=dark&channel=maisum`;
      await page.goto(urlMaisUm, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      const filenameMaisUm = `${String(captureIndex).padStart(2, '0')}_hud_maisum_reference_firetv.png`;
      const fullPathMaisUm = path.join(outDir, filenameMaisUm);
      await page.screenshot({ path: fullPathMaisUm });
      console.log(`  ✓ [${captureIndex}] Referência +MaisUm TV (Fire TV 960x540) -> ${filenameMaisUm}`);
      captureIndex++;
    }

    await context.close();
  }

  await browser.close();
  await server.close();

  console.log('\n========================================================================');
  console.log(` TODOS OS ${captureIndex - 1} SCREENSHOTS FORAM CAPTURADOS COM SUCESSO! `);
  console.log(` Diretório: ${outDir} `);
  console.log('========================================================================\n');
}

runVisualTests().catch((err) => {
  console.error('Erro na execução dos testes visuais:', err);
  process.exit(1);
});
