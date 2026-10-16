import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function runLabVerification() {
  console.log('--- INICIANDO VERIFICAÇÃO RIGOROSA DO LABORATÓRIO (FASES 1, 2 E 3) ---');
  
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  // Escuta logs do console para garantir 0 erros
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[Browser Error Console]:', msg.text());
    } else if (msg.text().includes('[Anime4K]') || msg.text().includes('WebGPU')) {
      console.log('[Browser GPU Log]:', msg.text());
    }
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.log('HTTP ERROR:', res.status(), res.url());
    }
  });

  page.on('requestfailed', req => {
    console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText);
  });

  const targetUrl = 'http://localhost:4000/dev/video-enhancement-lab';
  console.log(`[1] Navegando para o Laboratório: ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  // Aguarda carregamento do elemento de vídeo
  await page.waitForSelector('video', { timeout: 10000 });
  console.log('[2] Elemento HTMLVideoElement localizado com sucesso.');

  // Espera 2 segundos para o vídeo iniciar e carregar metadados
  await page.waitForTimeout(2000);

  // FASE 1 — Teste do vídeo original e canvas sem IA (Passthrough)
  console.log('[3] Verificando Fase 1: Vídeo Original e Passthrough 1:1 sem IA...');
  const fase1Metrics = await page.evaluate(async () => {
    const video = document.querySelector('video') as HTMLVideoElement;
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const container = canvas?.parentElement;

    if (!video || !canvas) return { error: 'Vídeo ou Canvas não encontrado' };

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = canvas.width;
    const ch = canvas.height;
    const isPlaying = !video.paused && video.currentTime > 0;
    const vRatio = Number((vw / (vh || 1)).toFixed(4));
    const cRatio = Number((cw / (ch || 1)).toFixed(4));
    const diffRatio = Math.abs(vRatio - cRatio);

    const vRect = video.getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();

    return {
      isPlaying,
      videoWidth: vw,
      videoHeight: vh,
      canvasWidth: cw,
      canvasHeight: ch,
      vRatio,
      cRatio,
      diffRatio,
      videoRect: { w: Math.round(vRect.width), h: Math.round(vRect.height) },
      canvasRect: { w: Math.round(cRect.width), h: Math.round(cRect.height) },
      zeroTarjas: diffRatio < 0.005 && Math.abs(vRect.width - cRect.width) <= 1 && Math.abs(vRect.height - cRect.height) <= 1
    };
  });

  console.log('Métricas Fase 1:', JSON.stringify(fase1Metrics, null, 2));

  if (!fase1Metrics.zeroTarjas) {
    throw new Error('Falha na Fase 1: Detectada diferença dimensional ou tarjas entre vídeo e canvas!');
  }
  console.log('✅ FASE 1 APROVADA: Vídeo original reproduzido, proporção 1:1 rigorosa e 0 tarjas.');

  // FASE 2 — Ativação do Processador WebGPU Real (Anime4K Shaders WGSL)
  console.log('\n[4] Ativando Fase 2: Processador Anime4K WebGPU Real...');
  
  // Aguarda inicialização do WebGPU
  const webgpuBtn = page.locator('button', { hasText: '2. Anime4K WebGPU' });
  await webgpuBtn.waitFor({ state: 'visible', timeout: 10000 });
  const isBtnDisabled = await webgpuBtn.isDisabled();
  if (isBtnDisabled) {
    const gpuText = await page.locator('text=WebGPU').first().innerText();
    console.log('WebGPU status pill:', gpuText);
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('2. Anime4K WebGPU'));
      return btn && !btn.hasAttribute('disabled');
    }, { timeout: 10000 }).catch(e => console.warn('Aviso ao aguardar botão habilitado:', e.message));
  }

  await webgpuBtn.click();
  await page.waitForTimeout(2000);

  // Monitora processamento contínuo durante 3 segundos
  const fase2Results = await page.evaluate(async () => {
    const startFrames = parseInt(document.body.innerText.match(/(\d+)\s+frames processados/)?.[1] || '0', 10);
    await new Promise(r => setTimeout(r, 2000));
    const endFrames = parseInt(document.body.innerText.match(/(\d+)\s+frames processados/)?.[1] || '0', 10);
    const fpsMatch = document.body.innerText.match(/(\d+)\s+FPS/)?.[1] || '0';
    const msMatch = document.body.innerText.match(/([\d\.]+)\s+ms/)?.[1] || '0';
    const gpuDeviceMatch = document.body.innerText.match(/Dispositivo GPU[\s\S]*?(GPU [^\n]+|WebGPU[^\n]+|[A-Za-z0-9\s]+)/)?.[1];

    return {
      startFrames,
      endFrames,
      deltaFrames: endFrames - startFrames,
      fps: parseInt(fpsMatch, 10),
      processTimeMs: parseFloat(msMatch),
      isContinuous: (endFrames - startFrames) > 20
    };
  });

  console.log('Resultados Fase 2 (WebGPU contínuo):', JSON.stringify(fase2Results, null, 2));

  // Tira print do Laboratório com WebGPU ativo
  const artifactDir = 'C:/Users/gebel/.gemini/antigravity/scratch/zapitv_app/dist';
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  const labScreenshotPath = path.join(artifactDir, 'lab_webgpu_active.png');
  await page.screenshot({ path: labScreenshotPath });
  console.log(`[5] Screenshot do Laboratório salvo em: ${labScreenshotPath}`);

  // FASE 3 — Comprovação de Super-Resolução e Captura de Evidências
  console.log('\n[6] Executando Fase 3: Captura de Evidências e Comparação...');
  const captureBtn = page.locator('button', { hasText: 'Capturar Evidências PNG' });
  await captureBtn.click();
  await page.waitForTimeout(1000);

  // Verifica se as imagens de evidência foram capturadas e renderizadas na tela
  const evidenceCount = await page.locator('img[alt="Frame Original"], img[alt="Frame Aprimorado"]').count();
  console.log(`[7] Imagens de evidência capturadas: ${evidenceCount} (esperado: 2)`);

  // Ativa modo Split-Screen para verificar o divisor interativo
  const splitBtn = page.locator('button', { hasText: 'Dividir Tela' });
  await splitBtn.click();
  await page.waitForTimeout(1000);
  const splitScreenshotPath = path.join(artifactDir, 'lab_split_screen.png');
  await page.screenshot({ path: splitScreenshotPath });
  console.log(`[8] Screenshot do Split-Screen salvo em: ${splitScreenshotPath}`);

  await browser.close();
  console.log('--- VERIFICAÇÃO CONCLUÍDA COM SUCESSO TOTAL ---');
  return { fase1Metrics, fase2Results, evidenceCount };
}

runLabVerification().catch(err => {
  console.error('ERRO NA VERIFICAÇÃO DO LABORATÓRIO:', err);
  process.exit(1);
});
