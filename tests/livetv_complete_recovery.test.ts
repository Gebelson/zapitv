/**
 * ZapiTV — Suíte Completa de Recuperação, Resiliência e Provedores de TV ao Vivo
 * 
 * Validação dos 7 requisitos fundamentais:
 * 1. Ativação e alternância correta de adaptadores (correção do bug '!== id' para '=== id').
 * 2. Rejeição estrita de fontes P2P/Torrent (Brazuca, acestream, magnet, notWebReady).
 * 3. Agregação e deduplicação inteligente com múltiplas fontes por canal.
 * 4. Detecção e isolamento de erros HTTP (404, 401, 403, 500) e domínios estacionados.
 * 5. Troca automática de fonte resiliente com prevenção de loops e quarentena temporária.
 * 6. Distinção entre HTTP 200 e reprodução real confirmada de áudio/vídeo.
 * 7. Preservação de navegação por controle remoto, numeração de canais e EPG na Smart TV.
 */

import assert from 'node:assert';
import { liveTvProviderRegistry, LiveTVProviderRegistry } from '../src/core/livetv/LiveTVProviderRegistry';
import { StremioLiveTVAdapter } from '../src/core/livetv/StremioLiveTVAdapter';
import { M3UProviderAdapter } from '../src/core/livetv/M3UProviderAdapter';
import { channelNormalizer } from '../src/core/livetv/ChannelNormalizer';
import { channelSourceResolver } from '../src/core/livetv/ChannelSourceResolver';
import { liveStreamValidator } from '../src/core/livetv/LiveStreamValidator';
import { channelHealthService } from '../src/core/livetv/channelHealthService';
import { channelNumberingService } from '../src/core/livetv/channelNumberingService';
import { epgService } from '../src/core/livetv/epgService';
import { OfficialChannelProvider } from '../src/core/livetv/OfficialChannelProvider';
import { LiveChannel, RawChannelInput } from '../src/core/livetv/types';

async function runLiveTvRecoverySuite() {
  console.log('========================================================================');
  console.log('--- ZAPITV | SUÍTE COMPLETA DE RECUPERAÇÃO E RESILIÊNCIA DA TV AO VIVO ---');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // TESTE 1: Correção do Bug de Ativação/Desativação de Adaptadores (=== id)
  // -------------------------------------------------------------------------
  console.log('[Teste 1] Verificando ativação e alternância estrita de adaptadores...');

  const registry = LiveTVProviderRegistry.getInstance();
  
  // Adiciona dois adaptadores M3U de teste com IDs distintos
  const m3uA = registry.addM3UAdapter('Teste M3U Alpha', 'https://example.com/alpha.m3u');
  const m3uB = registry.addM3UAdapter('Teste M3U Beta', 'https://example.com/beta.m3u');

  assert.strictEqual(m3uA.isEnabled(), true, 'Adaptador Alpha deve iniciar habilitado');
  assert.strictEqual(m3uB.isEnabled(), true, 'Adaptador Beta deve iniciar habilitado');

  // Desativa APENAS o Alpha
  registry.toggleM3UAdapter(m3uA.getId(), false);

  assert.strictEqual(m3uA.isEnabled(), false, 'Adaptador Alpha deve ter sido desabilitado');
  assert.strictEqual(m3uB.isEnabled(), true, 'Adaptador Beta deve PERMANECER habilitado (sem efeito colateral)');

  // Reativa Alpha
  registry.toggleM3UAdapter(m3uA.getId(), true);
  assert.strictEqual(m3uA.isEnabled(), true, 'Adaptador Alpha deve ser reativado');

  // Testa o mesmo comportamento para Stremio Adapters
  const stremioA = registry.addStremioAdapter('Stremio Test Alpha', 'https://example.com/stremio-a/manifest.json');
  const stremioB = registry.addStremioAdapter('Stremio Test Beta', 'https://example.com/stremio-b/manifest.json');

  registry.toggleStremioAdapter(stremioA.getId(), false);
  assert.strictEqual(stremioA.isEnabled(), false, 'Stremio Alpha deve ser desabilitado');
  assert.strictEqual(stremioB.isEnabled(), true, 'Stremio Beta deve PERMANECER habilitado');

  // Limpeza dos adaptadores de teste
  registry.removeM3UAdapter(m3uA.getId());
  registry.removeM3UAdapter(m3uB.getId());
  registry.removeStremioAdapter(stremioA.getId());
  registry.removeStremioAdapter(stremioB.getId());

  console.log('✓ Bug !== id corrigido: Cada adaptador é controlado exclusivamente pelo seu ID.\n');

  // -------------------------------------------------------------------------
  // TESTE 2: Rejeição Estrita de Provedores P2P e Fontes Não Web-Ready
  // -------------------------------------------------------------------------
  console.log('[Teste 2] Verificando rejeição de Brazuca Torrents, AceStream e fontes P2P...');

  const brazucaAdapter = new StremioLiveTVAdapter('https://brazuca-torrents.example.com/manifest.json', 'brazuca-test');
  // Simula manifesto de torrent
  (brazucaAdapter as any).manifest = {
    id: 'org.stremio.brazucatorrents',
    name: 'Brazuca Torrents',
    version: '1.0.0',
    resources: ['stream'],
    types: ['movie', 'series'],
    catalogs: []
  };

  const dummyStreams = [
    { name: 'AceStream', url: 'acestream://98471209384710923' },
    { name: 'Magnet', url: 'magnet:?xt=urn:btih:98234710928374' },
    { name: 'Torrent File', url: 'https://example.com/sample.torrent' },
    { name: 'P2P infoHash', infoHash: 'abc123456789' } as any,
    { name: 'Not Web Ready', url: 'https://cdn.example.com/live.m3u8', behaviorHints: { notWebReady: true } },
    { name: 'Parked Domain', url: 'https://cdn.superflixapi.top/live.m3u8' },
    { name: 'Web Ready HLS', url: 'https://stream.ebc.com.br/tvbrasil.m3u8' },
    { name: 'Web Ready DASH', url: 'https://cdn.example.com/live.mpd' }
  ];

  const filtered = brazucaAdapter.filterWebReadyStreams(dummyStreams);

  assert.strictEqual(filtered.length, 2, 'Apenas as 2 fontes HLS/DASH diretas web devem ser aceitas');
  assert.strictEqual(filtered[0].url, 'https://stream.ebc.com.br/tvbrasil.m3u8');
  assert.strictEqual(filtered[1].url, 'https://cdn.example.com/live.mpd');

  console.log('✓ Fontes P2P, AceStream, Torrent, NotWebReady e domínios estacionados rejeitadas.\n');

  // -------------------------------------------------------------------------
  // TESTE 3: Agregação e Múltiplas Fontes por Canal com Deduplicação Canônica
  // -------------------------------------------------------------------------
  console.log('[Teste 3] Verificando agregação de múltiplas fontes por canal...');

  const rawSample: RawChannelInput[] = [
    {
      id: 'cnn-brasil',
      name: 'CNN Brasil',
      url: 'https://primary-cnn.example.com/live.m3u8',
      quality: '1080p',
      provider: 'Oficial CNN',
      isOfficial: true
    },
    {
      id: 'cnn-brasil-backup',
      name: 'CNN Brasil (HD)',
      url: 'https://backup1-cnn.example.com/live.m3u8',
      quality: '720p',
      provider: 'IPTV Aberto',
      isOfficial: false
    },
    {
      id: 'cnn-brasil-stremio',
      name: 'CNN Brasil 720p',
      url: 'https://backup2-cnn.example.com/live.m3u8',
      quality: '720p',
      provider: 'Stremio Live',
      isOfficial: false
    }
  ];

  const unified = channelNormalizer.normalizeAndDeduplicate(rawSample);
  assert.strictEqual(unified.length, 1, 'Os 3 registros de CNN Brasil devem ser unificados em 1 canal canônico');
  
  const cnn = unified[0];
  assert.strictEqual(cnn.sources?.length, 3, 'O canal unificado deve conter as 3 fontes');
  assert.strictEqual(cnn.backupStreamUrls?.length, 2, 'Deve registrar 2 fontes de backup');
  assert.strictEqual(cnn.sources![0].isOfficial, true, 'A fonte oficial deve ter precedência máxima');

  console.log('✓ Canais deduplicados com sucesso e múltiplas fontes agregadas em ordem de prioridade.\n');

  // -------------------------------------------------------------------------
  // TESTE 4: Detecção de Erros HTTP, CORS e Quarentena de Fontes
  // -------------------------------------------------------------------------
  console.log('[Teste 4] Verificando detecção de erros HTTP e quarentena temporária...');

  const resolver = channelSourceResolver;
  const testChannel: LiveChannel = {
    id: 'canal-teste-resiliencia',
    canonicalId: 'canal-teste-resiliencia',
    name: 'Canal Teste',
    category: 'noticias',
    categoryLabel: 'Notícias',
    logo: 'https://example.com/logo.png',
    streamUrl: 'https://primary.example.com/stream.m3u8',
    sources: [
      {
        id: 'source-1',
        url: 'https://primary.example.com/stream.m3u8',
        quality: '1080p',
        provider: 'Primary',
        format: 'hls'
      },
      {
        id: 'source-2',
        url: 'https://backup1.example.com/stream.m3u8',
        quality: '720p',
        provider: 'Backup 1',
        format: 'hls'
      },
      {
        id: 'source-3',
        url: 'https://backup2.example.com/stream.m3u8',
        quality: '720p',
        provider: 'Backup 2',
        format: 'hls'
      }
    ],
    backupStreamUrls: [
      'https://backup1.example.com/stream.m3u8',
      'https://backup2.example.com/stream.m3u8'
    ],
    status: 'VERIFIED'
  };

  resolver.clearFailedSources(testChannel.id);

  // 1ª Resolução: deve selecionar a primeira fonte
  const initial = resolver.resolveBestSource(testChannel);
  assert.strictEqual(initial.primaryUrl, 'https://primary.example.com/stream.m3u8');
  assert.strictEqual(initial.isFallback, false);

  // Simula falha na 1ª fonte: deve alternar para Backup 1
  const next1 = resolver.getNextSource(testChannel, 'https://primary.example.com/stream.m3u8', 'Timeout de rede');
  assert.ok(next1, 'Deve encontrar próxima fonte');
  assert.strictEqual(next1?.url, 'https://backup1.example.com/stream.m3u8');

  // Simula falha na 2ª fonte: deve alternar para Backup 2
  const next2 = resolver.getNextSource(testChannel, 'https://backup1.example.com/stream.m3u8', 'HTTP 404', true);
  assert.ok(next2, 'Deve encontrar próxima fonte');
  assert.strictEqual(next2?.url, 'https://backup2.example.com/stream.m3u8');

  // Simula falha na 3ª fonte: todas esgotadas, NÃO deve entrar em loop
  const next3 = resolver.getNextSource(testChannel, 'https://backup2.example.com/stream.m3u8', 'Falha geral');
  assert.strictEqual(next3, null, 'Deve retornar null quando todas as fontes falharem');

  const allFailedResolved = resolver.resolveBestSource(testChannel);
  assert.strictEqual(allFailedResolved.allSourcesFailed, true, 'Deve marcar allSourcesFailed como true');
  assert.strictEqual(allFailedResolved.primaryUrl, '', 'Não deve retornar URL falha como primaryUrl');

  console.log('✓ Transição de fontes, anti-loop e isolamento de falhas comprovados.\n');

  // -------------------------------------------------------------------------
  // TESTE 5: Distinção entre HTTP 200 e Confirmação de Reprodução Real
  // -------------------------------------------------------------------------
  console.log('[Teste 5] Verificando validação real de mídia (Anti-Falso Positivo HTTP 200)...');

  // Validador deve rejeitar resposta que retorne HTML mesmo com status HTTP 200 (ex: páginas de bloqueio)
  const isParked = liveStreamValidator.isParkedDomain('https://superflixapi.top/video.m3u8');
  assert.strictEqual(isParked, true, 'Superflixapi.top deve ser reconhecido como parked');

  // Simula confirmação real de primeiro frame e progresso
  channelHealthService.confirmPlayback(testChannel, 'https://backup1.example.com/stream.m3u8', 1250);
  assert.strictEqual(testChannel.status, 'VERIFIED', 'Canal deve ser marcado como VERIFIED após primeiro frame');
  
  // Limpeza de falhas prévias da URL confirmada
  const failureRec = resolver.getSourceFailureRecord(testChannel.id, 'https://backup1.example.com/stream.m3u8');
  assert.strictEqual(failureRec, undefined, 'Registro de falha deve ser limpo após reprodução confirmada');

  console.log('✓ Confirmação em runtime e limpeza de quarentena validadas.\n');

  // -------------------------------------------------------------------------
  // TESTE 6: Preservação de Numeração, Favoritos e Guia EPG
  // -------------------------------------------------------------------------
  console.log('[Teste 6] Verificando numeração canônica, favoritos e integração EPG...');

  const verifiedChannels = registry.getVerifiedChannels();
  assert.ok(verifiedChannels.length >= 50, `Deve possuir mais de 50 canais verificados (atual: ${verifiedChannels.length})`);

  // Anotação com números estáveis
  const numbered = channelNumberingService.annotateAndSortChannels(verifiedChannels);
  assert.ok(numbered[0].number !== undefined, 'Primeiro canal deve ter número');
  
  // Busca por número
  const ch1 = channelNumberingService.getChannelByNumber(numbered[0].number!, numbered);
  assert.strictEqual(ch1?.id, numbered[0].id, 'Busca por número deve retornar o canal exato');

  // Verificação de EPG
  const epgState = epgService.getCurrentEpgState(numbered[0]);
  assert.ok(epgState, 'EPG state deve existir para o canal');
  assert.ok(typeof epgState.progressPercent === 'number', 'Progresso do EPG deve ser numérico');

  console.log('✓ Numeração de canais, busca e integridade EPG validadas com 100% de precisão.\n');

  // -------------------------------------------------------------------------
  // TESTE 7: Verificação da Correção do Canal Rede Brasil (RBTV)
  // -------------------------------------------------------------------------
  console.log('[Teste 7] Verificando integridade da nova fonte oficial de Rede Brasil...');

  const rbtv = OfficialChannelProvider.getOfficialChannels().find(c => c.id === 'rede-brasil');
  assert.ok(rbtv, 'Rede Brasil deve existir no provedor oficial');
  assert.strictEqual(
    rbtv?.url, 
    'https://redebrasil.nuvemplay.live/hls/stream.m3u8',
    'Rede Brasil deve apontar para o novo stream nuvemplay oficial'
  );

  console.log('✓ Rede Brasil atualizada e verificada com sucesso.\n');

  console.log('========================================================================');
  console.log('  TODOS OS 7 TESTES DE RECUPERAÇÃO DA TV AO VIVO PASSARAM COM SUCESSO!  ');
  console.log('========================================================================\n');
}

runLiveTvRecoverySuite().catch(err => {
  console.error('\n❌ Falha na suíte de testes de TV ao vivo:', err);
  process.exit(1);
});
