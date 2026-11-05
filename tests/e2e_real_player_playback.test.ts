/**
 * ZAPITV — Teste End-to-End Real de Reprodução e Decodificação de Vídeo em Navegador
 * 
 * Requisito 1 do Incidente P0:
 * - Executa o ZapiPlayer verdadeiro em Chromium real.
 * - Utiliza uma fonte de vídeo autorizada obtida pela rede.
 * - Verifica eventos reais do elemento <video>: loadedmetadata, play, playing, timeupdate.
 * - Confirma avanço real do relógio de decodificação: video.currentTime > 0.5s sem qualquer manipulação artificial.
 * - Confirma dimensões reais decodificadas (videoWidth > 0, videoHeight > 0) e ausência de erro.
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

async function runRealPlayerE2E() {
  console.log('========================================================================');
  console.log('--- ZAPITV | TESTE REAL DE NAVEGADOR: REPRODUÇÃO E DECODIFICAÇÃO E2E ---');
  console.log('========================================================================\n');

  const chromePath = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ].filter(Boolean).find(p => p && fs.existsSync(p));

  console.log('[1/4] Iniciando servidor Vite para o harness do player real...');
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error'
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  ✓ Servidor Vite ativo em: ${baseUrl}`);

  console.log('[2/4] Lançando Chromium real para decodificação de mídia...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required'
    ]
  }).catch(async error => { await server.close(); throw error; });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 }
  });

  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  try {
    console.log('[3/4] Carregando ZapiPlayer com fonte de vídeo autorizada...');
    await page.goto(`${baseUrl}/tests/harness/real_player_preview.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Aguarda o elemento <video> ser montado pelo ZapiPlayer
    const videoLocator = page.locator('video');
    await videoLocator.waitFor({ state: 'attached', timeout: 15000 });
    console.log('  ✓ Elemento <video> montado no DOM pelo ZapiPlayer.');

    console.log('[4/4] Observando eventos de decodificação real no elemento <video>...');
    const playbackResult = await page.evaluate(async () => {
      const video = document.querySelector('video');
      if (!video) throw new Error('Elemento video não encontrado no DOM');

      const events: string[] = [];
      let startTime = -1;

      // Garante áudio mutado no teste para evitar qualquer bloqueio de reprodução do navegador
      video.muted = true;

      if (video.readyState >= 1) {
        events.push(`initial-metadata (${video.videoWidth}x${video.videoHeight})`);
      }

      return new Promise<any>((resolve, reject) => {
        // Se já decodificou além de 0.5s
        if (video.currentTime >= 0.5) {
          resolve({
            success: true,
            events: ['already-decoded', `currentTime:${video.currentTime.toFixed(2)}s`],
            finalCurrentTime: video.currentTime,
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            paused: video.paused,
            error: null
          });
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error(`Timeout de 20s aguardando decodificação real: currentTime=${video.currentTime}, readyState=${video.readyState}, paused=${video.paused}, events=[${events.join(', ')}]`));
        }, 20000);

        video.addEventListener('loadedmetadata', () => {
          events.push(`loadedmetadata (${video.videoWidth}x${video.videoHeight})`);
        });

        video.addEventListener('play', () => {
          events.push('play');
        });

        video.addEventListener('playing', () => {
          events.push('playing');
          if (startTime === -1) startTime = video.currentTime;
        });

        video.addEventListener('timeupdate', () => {
          const current = video.currentTime;
          events.push(`timeupdate:${current.toFixed(2)}s`);
          // Decodificação confirmada quando o tempo avança pela rede/decodificador além de 0.5s
          if (current >= 0.5) {
            clearTimeout(timeout);
            resolve({
              success: true,
              events,
              finalCurrentTime: current,
              duration: video.duration,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              paused: video.paused,
              error: video.error ? { code: video.error.code, message: video.error.message } : null
            });
          }
        });

        video.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error(`Erro no elemento video: ${video.error?.message || 'Código ' + video.error?.code}`));
        });

        // Dispara reprodução caso o navegador requeira ativação explícita
        video.play().catch(e => {
          events.push(`play-catch:${e?.message || e}`);
        });
      });
    });

    // Observe sustained decoder progress; no assignment to currentTime or fake clock.
    const before = await videoLocator.evaluate((video: HTMLVideoElement) => ({
      time: video.currentTime, frames: video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0
    }));
    await page.waitForFunction(start => {
      const video = document.querySelector('video');
      return video && !video.paused && !video.error && video.currentTime >= start + 5;
    }, before.time, { timeout: 15000 });
    const after = await videoLocator.evaluate((video: HTMLVideoElement) => ({
      time: video.currentTime, frames: video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0
    }));
    assert.ok(after.time - before.time >= 5);
    assert.ok(after.frames > before.frames, 'Decoded video frames must advance');
    assert.ok(playbackResult.videoWidth > 0 && playbackResult.videoHeight > 0);
    assert.equal(playbackResult.error, null);
    console.log(JSON.stringify({controlledMedia:true,secondsObserved:after.time-before.time,decodedFrames:after.frames-before.frames,realTitleValidated:false}));
  } finally {
    await browser.close();
    await server.close();
  }
}

runRealPlayerE2E().catch(err => {
  console.error('Real player test failed:', err.message);
  process.exitCode = 1;
});
