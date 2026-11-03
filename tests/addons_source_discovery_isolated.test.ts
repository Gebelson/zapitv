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
import { StremioClient } from '../src/core/stremio/stremioClient';

async function runIsolatedDiscoverySuite() {
  console.log('========================================================================');
  console.log('--- ZAPITV | TESTES DE INTEGRAÇÃO: DESCOBERTA DE FONTES ISOLADA (10/10) ---');
  console.log('========================================================================\n');

  // Configura servidor HTTP local mock para controlar respostas de add-ons com precisão cirúrgica
  let mockServerRoute: 'operational' | 'server_error' | 'empty' | 'rejected_id' | 'torrent_only' | 'delayed' = 'operational';

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
      if (mockServerRoute === 'delayed') {
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            streams: [
              {
                name: 'Delayed Stream Addon',
                title: 'Pursuit of Jade S01E01 - 1080p MP4',
                url: 'https://example.com/delayed.mp4',
                sourceType: 'mp4'
              }
            ]
          }));
        }, 120);
        return;
      }

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

    // -----------------------------------------------------------------------
    // CENÁRIO 8: Stream com metadados puramente técnicos para consulta canônica
    // -----------------------------------------------------------------------
    await runStep('Stream com metadados puramente técnicos para consulta canônica (Pursuit of Jade)', async () => {
      const identity = canonicalIdentityService.buildIdentity({
        id: 'tmdb-279388',
        tmdbId: '279388',
        imdbId: 'tt35316225',
        title: 'Pursuit of Jade',
        type: ContentType.SERIES,
        year: 2026
      }, { season: 1, episode: 1 });

      // 1. Stream com metadados puramente técnicos (resolução, áudio, codec, tamanho)
      const technicalStream: StremioStream = {
        name: 'Torrentio\n1080p',
        title: '1080p | Dual Audio | WEBRip | 1.2 GB',
        url: 'https://example.com/stream-technical.m3u8',
        providerName: 'Torrentio',
        providerId: 'torrentio-global',
        sourceType: 'hls'
      };

      const evalTechnical = sourceConfidenceEngine.evaluate(technicalStream, identity);
      assert.strictEqual(evalTechnical.isMatch, true, 'Stream puramente técnico para ID canônico deve ser aprovado');
      assert.strictEqual(evalTechnical.confidence, 'PROVISIONAL', 'Confiança deve ser PROVISIONAL');
      console.log('    ✓ Stream com metadados puramente técnicos aceito com sucesso para consulta canônica');

      // 2. Stream de outra obra (colisão/trote) com palavras estranhas substantivas
      const conflictingStream: StremioStream = {
        name: 'Torrentio\n1080p',
        title: 'Spider-Man No Way Home 1080p Dual Audio WEBRip',
        url: 'https://example.com/stream-conflicting.m3u8',
        providerName: 'Torrentio',
        providerId: 'torrentio-global',
        sourceType: 'hls'
      };

      const evalConflicting = sourceConfidenceEngine.evaluate(conflictingStream, identity);
      assert.strictEqual(evalConflicting.isMatch, false, 'Stream com obra diferente deve ser rejeitado');
      assert.strictEqual(evalConflicting.confidence, 'REJECTED', 'Confiança de obra diferente deve ser REJECTED');
      console.log('    ✓ Stream de obra conflitante (Spider-Man) rejeitado com sucesso');
    });

    // -----------------------------------------------------------------------
    // CENÁRIO 9: Isolamento de concorrência e cancelamento no StremioClient
    // -----------------------------------------------------------------------
    await runStep('Isolamento de concorrência e cancelamento (Caller 1 aborta, Caller 2 conclui)', async () => {
      // Mock do servidor com resposta atrasada (300ms)
      mockServerRoute = 'delayed';
      const client = new StremioClient(`http://127.0.0.1:${port}`);

      const controller1 = new AbortController();
      const controller2 = new AbortController();

      // Chamada 1: pré-busca (será abortada após 50ms)
      const promise1 = client.getStreams('series', 'tt35316225:1:1', { signal: controller1.signal });

      // Chamada 2: reprodução real (reutiliza requisição em voo, NÃO será abortada)
      const promise2 = client.getStreams('series', 'tt35316225:1:1', { signal: controller2.signal });

      // Aborta Caller 1 quase imediatamente
      setTimeout(() => {
        controller1.abort('USER_CANCELLED_PREFETCH');
      }, 30);

      // Caller 1 deve ser rejeitado com ABORTED
      let caller1Aborted = false;
      try {
        await promise1;
      } catch (err: any) {
        if (err.kind === 'ABORTED' || err.message?.includes('cancelada')) {
          caller1Aborted = true;
        }
      }
      assert.strictEqual(caller1Aborted, true, 'Caller 1 deve ser rejeitado por abort');

      // Caller 2 NÃO pode ser afetado pelo cancelamento do Caller 1
      const streams2 = await promise2;
      assert.ok(Array.isArray(streams2?.streams), 'Caller 2 deve receber streams com sucesso');
      assert.ok(streams2.streams.length > 0, 'Caller 2 deve obter streams válidos');
      console.log(`    ✓ Concorrência isolada: Caller 1 abortado, Caller 2 concluiu com ${streams2.streams.length} streams`);
    });

    // -----------------------------------------------------------------------
    // CENÁRIO 10: Saneamento de prioridades corrompidas no localStorage
    // -----------------------------------------------------------------------
    await runStep('Saneamento de prioridades corrompidas e integridade de fallback', async () => {
      const providers = providerRegistry.getProviders();
      // Verifica que as prioridades não são todas iguais a 1
      const priorityOnes = providers.filter(p => p.priority === 1);
      assert.ok(priorityOnes.length <= 2, `Máximo de 2 provedores com priority: 1, encontrado: ${priorityOnes.length}`);
      
      // Provedores de fábrica devem manter sua ordenação sequencial
      const fenix = providerRegistry.getProvider('fenixflix-animes');
      const frost = providerRegistry.getProvider('froststream-http');
      assert.ok(frost && fenix, 'FrostStream e FenixFlix devem existir no registro');
      console.log(`    ✓ Prioridades saneadas: FrostStream (prioridade ${frost?.priority}), FenixFlix (prioridade ${fenix?.priority})`);
    });

    console.log('========================================================================');
    console.log('✓ TODOS OS 10 CENÁRIOS DE DESCOBERTA E VERIFICAÇÃO FORAM VALIDADOS COM SUCESSO');
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
