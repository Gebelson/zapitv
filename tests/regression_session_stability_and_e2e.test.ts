/**
 * ZAPITV — Teste End-to-End de Estabilidade de Sessão e Ciclo Completo de Reprodução
 * 
 * Requisito 6 do Incidente P0:
 * 1. Primeira reprodução (sucesso).
 * 2. Navegação pela interface / pré-busca de múltiplos conteúdos.
 * 3. Cancelamentos durante a navegação.
 * 4. Sincronização de provedores em segundo plano.
 * 5. Segunda reprodução do mesmo conteúdo (testando cache e revalidação).
 * 6. Reprodução de outro conteúdo subsequente (testando estabilidade contínua).
 * - Executa em Playwright Chromium real, verificando decodificação de vídeo real.
 * - Valida modos Desktop e Smart TV.
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

async function runSessionStabilityE2E() {
  console.log('========================================================================');
  console.log('--- ZAPITV | TESTE E2E: ESTABILIDADE DE SESSÃO E CICLO DE REPRODUÇÃO ---');
  console.log('========================================================================\n');

  const chromePath = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ].filter(Boolean).find(p => p && fs.existsSync(p));

  console.log('[Setup] Iniciando servidor Vite com suporte a sincronização e streaming local...');
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
    plugins: [
      {
        name: 'mock-provider-backend-sync',
        configureServer(s) {
          s.middlewares.use('/api/providers/config', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              providers: [
                {
                  id: 'zapitv-show-subtitle-pt-br',
                  name: 'Show Subtitle PT-BR (Stremio Oficial)',
                  url: '/api/stremio/show-subtitle-pt-br',
                  enabled: true,
                  type: 'stremio-addon',
                  priority: 1,
                  status: 'online',
                  healthState: 'STREAM_ENDPOINT_OPERATIONAL',
                  deliveryCapacity: 'DIRECT_HTTP_AVAILABLE'
                },
                {
                  id: 'zapitv-mico-leao-dublado',
                  name: 'Mico-Leão Dublado (Stremio Addon)',
                  url: '/api/stremio/mico-leao-dublado',
                  enabled: true,
                  type: 'stremio-addon',
                  priority: 2,
                  status: 'online',
                  healthState: 'STREAM_ENDPOINT_OPERATIONAL',
                  deliveryCapacity: 'DIRECT_HTTP_AVAILABLE'
                },
                {
                  id: 'froststream-http',
                  name: 'FrostStream (HTTP Streams PT-BR)',
                  url: 'https://froststream.cloutteam.com',
                  enabled: true,
                  type: 'stremio-addon',
                  priority: 3,
                  status: 'online',
                  healthState: 'STREAM_ENDPOINT_OPERATIONAL',
                  deliveryCapacity: 'DIRECT_HTTP_AVAILABLE'
                },
                {
                  id: 'fenixflix-animes',
                  name: 'FenixFlix (Animes Dublados PT-BR & Zeus)',
                  url: 'https://fenixflix.fenixhub.online',
                  enabled: true,
                  type: 'stremio-addon',
                  priority: 4,
                  status: 'online',
                  healthState: 'STREAM_ENDPOINT_OPERATIONAL',
                  deliveryCapacity: 'DIRECT_HTTP_AVAILABLE'
                }
              ],
              syncedAt: new Date().toISOString()
            }));
          });
        }
      }
    ]
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  ✓ Servidor Vite ativo em: ${baseUrl}`);

  console.log('[Setup] Lançando Chromium real para auditoria de decodificação de vídeo...');
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

  try {
    console.log('[Setup] Abrindo harness de teste de estabilidade de sessão...');
    await page.goto(`${baseUrl}/tests/harness/session_stability_preview.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.locator('#harness-ready').waitFor({ state: 'visible', timeout: 15000 });
    console.log('  ✓ Harness carregado e pronto para ciclo de vida de sessão.\n');

    // ------------------------------------------------------------------------
    // ETAPA 1: Estado inicial dos provedores
    // ------------------------------------------------------------------------
    console.log('[ETAPA 1] Verificando estado inicial dos provedores antes de qualquer sincronização...');
    const initialSnapshot = await page.evaluate(() => (window as any).__sessionLifecycle.getDiagnosticSnapshot());
    console.log(`  Provedores ativos: ${initialSnapshot.enabledProviders}/${initialSnapshot.totalProviders} (elegíveis: ${initialSnapshot.eligibleCount})`);
    assert.ok(initialSnapshot.enabledProviders > 0, 'Deve possuir provedores ativos inicialmente');
    console.log('  ✓ Provedores de fábrica devidamente ativos.\n');

    // ------------------------------------------------------------------------
    // ETAPA 2: Primeira reprodução (sucesso) no modo Desktop
    // ------------------------------------------------------------------------
    console.log('[ETAPA 2] Iniciando 1ª reprodução no modo Desktop (Item A)...');
    await page.evaluate(() => {
      const itemA = {
        id: 'test-item-a-anime',
        title: 'Anime Sample 480p',
        originalTitle: 'Anime Sample',
        type: 'anime',
        year: 2024,
        category: 'Animes'
      };
      (window as any).__sessionLifecycle.startPlayback(itemA, false);
    });

    const videoLocator = page.locator('video');
    await videoLocator.waitFor({ state: 'attached', timeout: 15000 });
    console.log('  ✓ Elemento <video> montado no DOM.');

    console.log('  Aguardando decodificação real (> 0.5s de avanço do tempo)...');
    const play1Result = await page.evaluate(() => (window as any).__sessionLifecycle.getVideoDecodingMetrics());
    console.log(`  Decodificação confirmada: ${play1Result.currentTime.toFixed(2)}s | Resolução: ${play1Result.videoWidth}x${play1Result.videoHeight}`);
    assert.strictEqual(play1Result.success, true);
    assert.ok(play1Result.currentTime >= 0.5);
    assert.ok(play1Result.videoWidth > 0);
    console.log('  ✓ 1ª reprodução concluída com sucesso.\n');

    // Fecha o player para retornar à interface
    await page.evaluate(() => (window as any).__sessionLifecycle.closePlayer());
    await videoLocator.waitFor({ state: 'detached', timeout: 5000 });
    console.log('  ✓ Player fechado para navegação na interface.\n');

    // ------------------------------------------------------------------------
    // ETAPA 3: Navegação pela interface / pré-buscas rápidas com cancelamentos
    // ------------------------------------------------------------------------
    console.log('[ETAPA 3] Simulando navegação rápida com pré-buscas e cancelamentos abortados...');
    const browseResult = await page.evaluate(() => (window as any).__sessionLifecycle.simulateBrowsingAndPrefetches());
    console.log(`  Navegação concluída: ${browseResult.browseCount} pré-buscas disparadas e abortadas com sucesso.`);
    assert.strictEqual(browseResult.browseCount, 4);
    console.log('  ✓ Cancelamento de pré-buscas isolado sem bloquear o sistema.\n');

    // ------------------------------------------------------------------------
    // ETAPA 4: Sincronização de provedores em segundo plano
    // ------------------------------------------------------------------------
    console.log('[ETAPA 4] Executando sincronização de provedores em segundo plano (/api/providers/config)...');
    const syncResult = await page.evaluate(() => (window as any).__sessionLifecycle.syncProviders());
    console.log(`  Após sincronização: ${syncResult.enabledProviders}/${syncResult.totalProviders} provedores habilitados.`);
    assert.ok(syncResult.enabledProviders >= 4, 'Provedores operacionais devem permanecer ativos após sincronização');
    console.log('  ✓ Sincronização preservou os provedores operacionais sem desativação silenciosa.\n');

    // ------------------------------------------------------------------------
    // ETAPA 5: Segunda reprodução do mesmo conteúdo (Item A) — Testa cache e revalidação
    // ------------------------------------------------------------------------
    console.log('[ETAPA 5] Executando 2ª reprodução do mesmo conteúdo (Item A)...');
    await page.evaluate(() => {
      const itemA = {
        id: 'test-item-a-anime',
        title: 'Anime Sample 480p',
        originalTitle: 'Anime Sample',
        type: 'anime',
        year: 2024,
        category: 'Animes'
      };
      (window as any).__sessionLifecycle.startPlayback(itemA, false);
    });

    await videoLocator.waitFor({ state: 'attached', timeout: 15000 });
    console.log('  ✓ Elemento <video> montado no DOM para 2ª reprodução.');

    console.log('  Aguardando decodificação real na 2ª reprodução...');
    const play2Result = await page.evaluate(() => (window as any).__sessionLifecycle.getVideoDecodingMetrics());
    console.log(`  Decodificação confirmada: ${play2Result.currentTime.toFixed(2)}s | Resolução: ${play2Result.videoWidth}x${play2Result.videoHeight}`);
    assert.strictEqual(play2Result.success, true);
    assert.ok(play2Result.currentTime >= 0.5);
    console.log('  ✓ 2ª reprodução concluída com sucesso (sem contaminação de cache negativo nem bloqueio).\n');

    await page.evaluate(() => (window as any).__sessionLifecycle.closePlayer());
    await videoLocator.waitFor({ state: 'detached', timeout: 5000 });

    // ------------------------------------------------------------------------
    // ETAPA 6: Reprodução subsequente de outro conteúdo (Item F) no modo TV
    // ------------------------------------------------------------------------
    console.log('[ETAPA 6] Executando reprodução de conteúdo subsequente (Item F) no modo TV...');
    await page.evaluate(() => {
      const itemF = {
        id: 'test-item-f-intro',
        title: 'Intro Showcase 360p',
        originalTitle: 'Intro Showcase',
        type: 'movie',
        year: 2024,
        category: 'Filmes'
      };
      (window as any).__sessionLifecycle.startPlayback(itemF, true);
    });

    await videoLocator.waitFor({ state: 'attached', timeout: 15000 });
    console.log('  ✓ Elemento <video> montado no DOM para o modo TV.');

    console.log('  Aguardando decodificação real no modo TV...');
    const playTvResult = await page.evaluate(() => (window as any).__sessionLifecycle.getVideoDecodingMetrics());
    console.log(`  Decodificação confirmada no modo TV: ${playTvResult.currentTime.toFixed(2)}s | Resolução: ${playTvResult.videoWidth}x${playTvResult.videoHeight}`);
    assert.strictEqual(playTvResult.success, true);
    assert.ok(playTvResult.currentTime >= 0.5);
    console.log('  ✓ Reprodução subsequente no modo TV concluída com sucesso.\n');

    console.log('========================================================================');
    console.log('✓ CICLO COMPLETO DE ESTABILIDADE DE SESSÃO E REPRODUÇÃO VALIDADO COM SUCESSO');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
    await server.close();
  }
}

runSessionStabilityE2E().catch(err => {
  console.error('\n✗ Falha no teste de estabilidade de sessão:', err);
  process.exit(1);
});
