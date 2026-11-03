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
  });

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
          reject(new Error(`Timeout de 20s aguardando decodificação real: currentTime=${video.currentTime}, readyState=${video.readyState}, paused=${video.paused}, src=${video.currentSrc || video.src}, events=[${events.join(', ')}]`));
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

    console.log(`\n  --- Resultado da Decodificação Real ---`);
    console.log(`  Eventos capturados: ${playbackResult.events.slice(0, 8).join(' -> ')}`);
    console.log(`  Tempo real decodificado: ${playbackResult.finalCurrentTime.toFixed(2)}s (> 0.5s)`);
    console.log(`  Resolução do vídeo decodificado: ${playbackResult.videoWidth}x${playbackResult.videoHeight}`);
    console.log(`  Duração total da mídia: ${playbackResult.duration.toFixed(1)}s`);
    console.log(`  Status de erro: ${playbackResult.error ? JSON.stringify(playbackResult.error) : 'Nenhum erro'}`);

    assert.strictEqual(playbackResult.success, true, 'Reprodução real deve ter sucesso');
    assert.ok(playbackResult.finalCurrentTime >= 0.5, 'Tempo decodificado real deve ultrapassar 0.5s');
    assert.ok(playbackResult.videoWidth > 0, 'Largura do vídeo deve ser maior que 0');
    assert.ok(playbackResult.videoHeight > 0, 'Altura do vídeo deve ser maior que 0');
    assert.strictEqual(playbackResult.error, null, 'Elemento de vídeo não deve apresentar erro');

    console.log('\n========================================================================');
    console.log('✓ TESTE REAL DE NAVEGADOR CONCLUÍDO COM SUCESSO: REPRODUÇÃO REAL CONFIRMADA');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
    await server.close();
  }
}

runRealPlayerE2E().catch(err => {
  console.error('\n✗ Falha no teste real de navegador:', err);
  process.exit(1);
});
