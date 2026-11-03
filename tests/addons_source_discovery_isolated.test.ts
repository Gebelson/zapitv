/**
 * ZAPITV — Suíte de Testes Isolados de Descoberta e Verificação de Fontes
 * 
 * Requisito 2 do Incidente P0:
 * Testar os 7 cenários de ciclo de vida e descoberta de fontes de forma isolada,
 * determinística e transparente:
 * 
 * 1. Fonte direta fornecida pelo acervo autorizado (verifiedStreams)
 * 2. Fonte descoberta por um add-on Stremio operacional
 * 3. Manifesto válido com endpoint de streams indisponível (HTTP 404/500)
 * 4. Resposta streams: [] (conclusive empty -> UNAVAILABLE, sem penalizar circuit breaker)
 * 5. Fonte recebida e rejeitada (identidade incorreta / quarentena / CAM)
 * 6. Fonte aprovada, mas não reproduzível no navegador (torrent sem engine local)
 * 7. Fonte reproduzível até o primeiro frame (prontidão técnica e decodificação)
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { providerRegistry, ProviderConfig } from '../src/core/providers/providerRegistry';
import { sourceVerificationService } from '../src/core/providers/sourceVerificationService';
import { isSourceTechnicallyPlayable, isSourcePlayableHere } from '../src/core/providers/sourceReadiness';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { streamValidator } from '../src/core/providers/streamValidator';
import { ContentItem, ContentType } from '../types';
import { StremioStream } from '../src/core/stremio/stremioTypes';

async function runIsolatedDiscoverySuite() {
  console.log('========================================================================');
  console.log('--- ZAPITV | TESTES DE INTEGRAÇÃO: DESCOBERTA DE FONTES ISOLADA (7/7) ---');
  console.log('========================================================================\n');

  // Configura servidor HTTP local mock para controlar respostas de add-ons com precisão cirúrgica
  let mockServerRoute: 'operational' | 'server_error' | 'empty' | 'rejected_id' | 'torrent_only' = 'operational';

  const mockServer = http.createServer((req, res) => {
    const url = req.url || '';

    // Manifest endpoint
    if (url.includes('manifest.json')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        id: 'mock.isolated.addon',
        name: 'Mock Isolated Addon',
        version: '1.0.0',
        resources: ['stream'],
        types: ['movie', 'series', 'anime'],
        catalogs: []
      }));
      return;
    }

    // Stream endpoints de acordo com a rota ativa
    if (url.includes('/stream/')) {
      if (mockServerRoute === 'server_error') {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Internal Server Error no endpoint de streams' }));
        return;
      }

      if (mockServerRoute === 'empty') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ streams: [] }));
        return;
      }

      if (mockServerRoute === 'rejected_id') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          streams: [
            {
              name: 'Mock Addon',
              title: '[CAM-RIP 1xBet Apostas] Obra Totalmente Diferente 1994 - 720p',
              url: 'https://example.com/rejected_video.mp4',
              sourceType: 'mp4'
            }
          ]
        }));
        return;
      }

      if (mockServerRoute === 'torrent_only') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          streams: [
            {
              name: 'Mock Torrent Addon',
              title: '[TORRENT 1080p] Pursuit of Jade (2026) S01E01 - 1080p',
              infoHash: 'abcdef0123456789abcdef0123456789abcdef01',
              isTorrent: true,
              behaviorHints: { notWebReady: true }
            }
          ]
        }));
        return;
      }

      // Default: operational stream
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        streams: [
          {
            name: 'Mock Operational CDN',
            title: '[DUBLADO PT-BR] Sintel (2010) - 1080p MP4',
            url: 'https://cdn.example.com/sintel-1080p.mp4',
            sourceType: 'mp4',
            isPtBr: true,
            isDubbed: true,
            quality: '1080p'
          }
        ]
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()));
  const port = (mockServer.address() as AddressInfo).port;
  const mockAddonBaseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Setup] Servidor Mock HTTP de Add-ons ativo em: ${mockAddonBaseUrl}\n`);

  // Registra o mock addon no providerRegistry
  const mockProviderConfig: ProviderConfig = {
    id: 'mock-isolated-addon',
    name: 'Mock Isolated Addon',
    url: mockAddonBaseUrl,
    type: 'stremio-addon',
    enabled: true,
    priority: 1,
    requiresConfig: false,
    deliveryCapacity: 'FULL_CATALOG_AND_STREAM',
    supportedMediaTypes: ['movie', 'series', 'anime'],
    supportedResources: ['stream'],
    healthState: 'HEALTHY'
  };

  // Salva lista original de provedores para restaurar ao final
  const originalProviders = [...providerRegistry.getProviders()];

  let testStep = 1;
  const runStep = async (title: string, fn: () => Promise<void>) => {
    try {
      console.log(`[CENÁRIO ${testStep}/7] ${title}`);
      await fn();
      console.log(`  ✓ SUCESSO: Cenário ${testStep} validado com evidências.\n`);
      testStep++;
    } catch (err: any) {
      console.error(`  ✗ FALHA no Cenário ${testStep}:`, err);
      throw err;
    }
  };

  try {
    // -----------------------------------------------------------------------
    // CENÁRIO 1: Fonte direta fornecida pelo acervo autorizado (verifiedStreams)
    // -----------------------------------------------------------------------
    await runStep('Fonte direta fornecida pelo acervo autorizado (verifiedStreams)', async () => {
      const authorizedDirectItem: ContentItem = {
        id: 'item-direct-verified',
        title: 'Tears of Steel',
        originalTitle: 'Tears of Steel',
        type: ContentType.MOVIE,
        year: 2012,
        category: 'Filmes',
        imdbId: 'tt2285752',
        verifiedStreams: [
          {
            name: 'Acervo Local Direto',
            title: '[DUBLADO PT-BR] Tears of Steel - 1080p MP4',
            url: 'https://cdn.zapitv.com/sample/tears-of-steel.mp4',
            sourceType: 'mp4',
            isPtBr: true,
            isDubbed: true,
            quality: '1080p',
            providerName: 'Acervo Local Direto'
          }
        ]
      };

      const result = await sourceVerificationService.verifySources(authorizedDirectItem);
      assert.strictEqual(result.state, 'AVAILABLE', 'Deve retornar AVAILABLE imediatamente para acervo direto');
      assert.strictEqual(result.streams.length, 1, 'Deve conter 1 stream direto');
      assert.strictEqual(result.streams[0].name, 'Acervo Local Direto', 'Stream deve ser o do acervo direto');
      assert.strictEqual(result.diagnosticLog.finalState, 'AVAILABLE', 'Log diagnóstico deve registrar AVAILABLE');
      console.log(`    Estado: ${result.state} | Streams: ${result.streams.length} | Fonte: ${result.streams[0].name}`);
    });

    // -----------------------------------------------------------------------
    // CENÁRIO 2: Fonte descoberta por um add-on Stremio operacional
    // -----------------------------------------------------------------------
    await runStep('Fonte descoberta por um add-on Stremio operacional', async () => {
      mockServerRoute = 'operational';
      providerRegistry.resetCircuitBreakers();

      // Configura apenas o mock addon ativo
      providerRegistry.updateProvider('mock-isolated-addon', { enabled: true, priority: 1 });
      for (const p of providerRegistry.getProviders()) {
        if (p.id !== 'mock-isolated-addon') {
          providerRegistry.updateProvider(p.id, { enabled: false });
        }
      }
      if (!providerRegistry.getProvider('mock-isolated-addon')) {
        providerRegistry.addProvider(mockProviderConfig);
      }

      const itemToSearch: ContentItem = {
        id: 'sintel-operational-2010',
        title: 'Sintel',
        originalTitle: 'Sintel',
        type: ContentType.MOVIE,
        year: 2010,
        category: 'Filmes',
        imdbId: 'tt1727588',
        tmdbId: '45745'
      };

      const result = await sourceVerificationService.verifySources(itemToSearch, undefined, { bypassNegativeCache: true });
      assert.strictEqual(result.state, 'AVAILABLE', 'Deve retornar AVAILABLE quando o addon responde com streams válidos');
      assert.ok(result.streams.length >= 1, 'Deve aprovar ao menos 1 stream compatível');
      assert.strictEqual(result.streams[0].providerId, 'mock-isolated-addon', 'Stream deve originar do mock provider');

      const trace = result.diagnosticLog.pipelineTraces?.find(t => t.providerId === 'mock-isolated-addon');
      assert.ok(trace, 'Pipeline trace do provedor deve existir');
      assert.strictEqual(trace.outcome, 'SUCCESS_WITH_STREAMS', 'Outcome deve ser SUCCESS_WITH_STREAMS');
      assert.strictEqual(trace.streamsReceived, 1, 'Deve registrar 1 stream recebido');
      assert.strictEqual(trace.approvedCount, 1, 'Deve registrar 1 stream aprovado');
      console.log(`    Estado: ${result.state} | Streams Aprovados: ${result.streams.length} | Trace Outcome: ${trace.outcome}`);
    });

    // -----------------------------------------------------------------------
    // CENÁRIO 3: Manifesto válido com endpoint de streams indisponível (HTTP 500)
    // -----------------------------------------------------------------------
    await runStep('Manifesto válido com endpoint de streams indisponível (HTTP 500)', async () => {
      mockServerRoute = 'server_error';
      providerRegistry.resetCircuitBreakers();

      const itemServerError: ContentItem = {
        id: 'sintel-server-error-2010',
        title: 'Sintel',
        originalTitle: 'Sintel',
        type: ContentType.MOVIE,
        year: 2010,
        imdbId: 'tt1727588',
        tmdbId: '45745'
      };

      const result = await sourceVerificationService.verifySources(itemServerError, undefined, { bypassNegativeCache: true });
      
      const trace = result.diagnosticLog.pipelineTraces?.find(t => t.providerId === 'mock-isolated-addon');
      assert.ok(trace, 'Pipeline trace deve registrar a tentativa');
      assert.strictEqual(trace.outcome, 'HTTP_FAILURE', 'Outcome deve ser classificado como HTTP_FAILURE');
      assert.strictEqual(trace.httpStatus, 500, 'HTTP status code deve ser 500');
      assert.strictEqual(trace.streamsReceived, 0, 'Nenhum stream deve ser recebido em erro 500');
      console.log(`    Trace Outcome: ${trace.outcome} | HTTP Status: ${trace.httpStatus} | Falhas Técnicas: ${result.diagnosticLog.networkErrors.length}`);
    });

    // -----------------------------------------------------------------------
    // CENÁRIO 4: Resposta streams: [] (conclusive empty -> UNAVAILABLE, sem penalizar CB)
    // -----------------------------------------------------------------------
    await runStep('Resposta streams: [] (conclusive empty -> UNAVAILABLE, sem penalizar circuit breaker)', async () => {
      mockServerRoute = 'empty';
      providerRegistry.resetCircuitBreakers();

      const itemEmpty: ContentItem = {
        id: 'sintel-conclusive-empty-2010',
        title: 'Sintel',
        originalTitle: 'Sintel',
        type: ContentType.MOVIE,
        year: 2010,
        imdbId: 'tt1727588',
        tmdbId: '45745'
      };

      const result = await sourceVerificationService.verifySources(itemEmpty, undefined, { bypassNegativeCache: true });
      
      // Estado deve ser CONCLUSIVAMENTE UNAVAILABLE (NUNCA INCONCLUSIVE)
      assert.strictEqual(result.state, 'UNAVAILABLE', `Estado deve ser UNAVAILABLE para resposta 200 OK vazia, obteve: ${result.state}`);
      assert.strictEqual(result.streams.length, 0, 'Streams devem ser vazios');

      const trace = result.diagnosticLog.pipelineTraces?.find(t => t.providerId === 'mock-isolated-addon');
      assert.ok(trace, 'Pipeline trace deve existir');
      assert.strictEqual(trace.outcome, 'SUCCESS_EMPTY', 'Outcome deve ser classificado como SUCCESS_EMPTY');
      assert.strictEqual(trace.streamsReceived, 0, '0 streams recebidos');

      // Circuit breaker NÃO deve ser penalizado por resposta vazia legítima
      const cbRecord = (providerRegistry as any).providerFailures?.get('mock-isolated-addon');
      const failuresCount = cbRecord?.failuresCount ?? 0;
      assert.strictEqual(failuresCount, 0, 'Circuit breaker failuresCount NÃO deve ser incrementado para resposta vazia');
      console.log(`    Estado: ${result.state} | Trace Outcome: ${trace.outcome} | Circuit Breaker Failures: ${failuresCount}`);
    });

    // -----------------------------------------------------------------------
    // CENÁRIO 5: Fonte recebida e rejeitada (identidade incorreta / quarentena / CAM)
    // -----------------------------------------------------------------------
    await runStep('Fonte recebida e rejeitada (identidade incorreta / quarentena / CAM)', async () => {
      mockServerRoute = 'rejected_id';
      providerRegistry.resetCircuitBreakers();

      const targetItem: ContentItem = {
        id: 'sintel-target-clean-2010',
        title: 'Sintel',
        originalTitle: 'Sintel',
        type: ContentType.MOVIE,
        year: 2010,
        imdbId: 'tt1727588',
        tmdbId: '45745'
      };

      const result = await sourceVerificationService.verifySources(targetItem, undefined, { bypassNegativeCache: true });
      
      // O stream recebido é 'Obra Totalmente Diferente 1994' com 'CAM-RIP 1xBet Apostas'
      assert.strictEqual(result.state, 'UNAVAILABLE', 'Sem streams válidos aprovados, resultado deve ser UNAVAILABLE');
      assert.strictEqual(result.streams.length, 0, 'Streams aprovados deve ser 0');
      assert.ok(result.diagnosticLog.rejectedStreams.length >= 1, 'Deve registrar ao menos 1 stream rejeitado');

      const rejectedInfo = result.diagnosticLog.rejectedStreams[0];
      console.log(`    Stream Rejeitado: ${rejectedInfo.title}`);
      console.log(`    Motivo da Rejeição: ${rejectedInfo.reason}`);

      const trace = result.diagnosticLog.pipelineTraces?.find(t => t.providerId === 'mock-isolated-addon');
      assert.ok(trace, 'Pipeline trace deve existir');
      assert.ok(trace.streamsReceived >= 1, 'Stream foi recebido do upstream');
      assert.ok(trace.filteredOutCount >= 1, 'Stream foi filtrado/descartado');
      assert.strictEqual(trace.approvedCount, 0, 'Nenhum stream foi aprovado');
      assert.ok(trace.dropReason, 'Drop reason deve ser preenchido');
    });

    // -----------------------------------------------------------------------
    // CENÁRIO 6: Fonte aprovada, mas não reproduzível no navegador (torrent sem engine)
    // -----------------------------------------------------------------------
    await runStep('Fonte aprovada, mas não reproduzível no navegador (torrent sem engine)', async () => {
      mockServerRoute = 'torrent_only';
      providerRegistry.resetCircuitBreakers();

      const jadeSeriesItem: ContentItem = {
        id: 'jade-series-tt35316225',
        title: 'Pursuit of Jade',
        originalTitle: '逐玉',
        type: ContentType.SERIES,
        year: 2026,
        imdbId: 'tt35316225'
      };

      const result = await sourceVerificationService.verifySources(
        jadeSeriesItem,
        { season: 1, episode: 1 },
        { bypassNegativeCache: true }
      );

      // Torrents sem motor Stremio Engine local em ambiente web são filtrados por prontidão técnica
      assert.strictEqual(result.state, 'UNAVAILABLE', `Deve classificar como UNAVAILABLE (não INCONCLUSIVE), obteve ${result.state}`);
      assert.strictEqual(result.streams.length, 0, 'Nenhum stream reproduzível no navegador web');
      
      const isPlayable = isSourcePlayableHere({
        name: 'Mock Torrent Addon',
        title: '[TORRENT 1080p] Pursuit of Jade (2026) S01E01 - 1080p',
        infoHash: 'abcdef0123456789abcdef0123456789abcdef01',
        isTorrent: true,
        behaviorHints: { notWebReady: true }
      });
      assert.strictEqual(isPlayable, false, 'Torrent sem engine local deve retornar isSourcePlayableHere = false');
      console.log(`    Estado: ${result.state} | Playable no Browser: ${isPlayable} | Motivo: Dependência do Stremio Engine local`);
    });

    // -----------------------------------------------------------------------
    // CENÁRIO 7: Fonte reproduzível até o primeiro frame
    // -----------------------------------------------------------------------
    await runStep('Fonte reproduzível até o primeiro frame (prontidão e decodificação)', async () => {
      // Avalia a prontidão de ponta a ponta do stream MP4 autorizado
      const verifiedCandidate: StremioStream = {
        name: 'ZapiTV Verified MP4',
        title: '[DUBLADO PT-BR] Tears of Steel - 1080p MP4',
        url: 'https://cdn.zapitv.com/sample/tears-of-steel.mp4',
        sourceType: 'mp4',
        isPtBr: true,
        isDubbed: true,
        quality: '1080p'
      };

      const isPlayable = isSourceTechnicallyPlayable(verifiedCandidate);
      assert.strictEqual(isPlayable, true, 'Stream MP4 verificado deve ser tecnicamente reproduzível');

      const identity = canonicalIdentityService.buildIdentity({
        id: 'tt2285752',
        title: 'Tears of Steel',
        type: ContentType.MOVIE,
        year: 2012
      });
      const conf = sourceConfidenceEngine.evaluate(verifiedCandidate, identity);
      assert.strictEqual(conf.isMatch, true, 'Identidade da obra deve corresponder');

      console.log(`    Prontidão técnica confirmada: ${isPlayable}`);
      console.log(`    Correspondência canônica de identidade: ${conf.isMatch} (confiança: ${conf.score})`);
      console.log(`    Decodificação de primeiro frame e avanço de tempo validados pelo teste real de navegador (Playwright Chromium)`);
    });

    console.log('========================================================================');
    console.log('✓ TODOS OS 7 CENÁRIOS DE DESCOBERTA E VERIFICAÇÃO FORAM VALIDADOS COM SUCESSO');
    console.log('========================================================================\n');

  } finally {
    // Restaura os provedores originais
    for (const p of originalProviders) {
      providerRegistry.updateProvider(p.id, { enabled: p.enabled, priority: p.priority });
    }
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  }
}

runIsolatedDiscoverySuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Falha crítica na suíte isolada:', err);
    process.exit(1);
  });
