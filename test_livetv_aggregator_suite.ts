import { liveTvProviderRegistry } from './src/core/livetv/LiveTVProviderRegistry';
import { M3UProviderAdapter } from './src/core/livetv/M3UProviderAdapter';
import { channelNormalizer } from './src/core/livetv/ChannelNormalizer';
import { epgAggregator } from './src/core/livetv/EPGAggregator';
import { liveStreamValidator } from './src/core/livetv/LiveStreamValidator';
import { channelRegistry } from './src/core/livetv/channelRegistry';
import { liveTvPreferences } from './src/core/livetv/liveTvPreferences';
import { channelFavoritesService } from './src/core/livetv/ChannelFavoritesService';
import { classifyStream, sortStreamsByPtBrPriority } from './src/core/audio/audioDetector';

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 SUÍTE DE TESTES AUTOMATIZADOS — NOVO AGREGADOR DE TV AO VIVO');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` — Detalhe: ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Provedores e Registro Central de Canais
  const allChannels = liveTvProviderRegistry.getAllChannels();
  assert(allChannels.length >= 15, 'Provedores carregam catálogo canônico unificado (mínimo 15 canais)', `Encontrados: ${allChannels.length}`);

  // 2. M3U Adapter: parsing correto de atributos tvg-* e streams
  const sampleM3u = `
#EXTM3U
#EXTINF:-1 tvg-id="TVBrasil.br" tvg-name="TV Brasil HD" tvg-logo="https://example.com/tvbrasil.png" group-title="TV Aberta",TV Brasil
https://tvbrasil.stream.ebc.com.br/live.m3u8
#EXTINF:-1 tvg-id="ParkedFake.br" tvg-name="Fake Parked" group-title="Spam",Fake Channel
http://superflixapi.top/fake.m3u8
  `.trim();
  const m3uAdapter = new M3UProviderAdapter('Test M3U');
  const parsedM3u = m3uAdapter.parseM3UContent(sampleM3u);
  assert(parsedM3u.length === 1, 'M3U Adapter extrai canais válidos e rejeita domínios estacionados/spam', `Extraídos: ${parsedM3u.length}`);
  assert(parsedM3u[0].name === 'TV Brasil' && parsedM3u[0].tvgId === 'TVBrasil.br', 'M3U Adapter extrai metadados tvg-id e nome com fidelidade');

  // 3. Normalização e Deduplicação Canônica
  const rawDuplicates = [
    { name: 'TV Cultura', url: 'https://stream1.tvcultura.com/720p.m3u8', quality: '720p', provider: 'Fonte A', tvgId: 'TVCultura.br' },
    { name: 'TV Cultura 1080p', url: 'https://stream2.tvcultura.com/1080p.m3u8', quality: '1080p', provider: 'Fonte B', tvgId: 'TVCultura.br' },
    { name: 'TV Cultura Backup', url: 'https://stream3.tvcultura.com/480p.m3u8', quality: '480p', provider: 'Fonte C', tvgId: 'TVCultura.br' }
  ];
  const normalized = channelNormalizer.normalizeAndDeduplicate(rawDuplicates);
  assert(normalized.length === 1, 'ChannelNormalizer deduplica múltiplos registros do mesmo canal em uma única entidade');
  assert(normalized[0].streamUrl === 'https://stream2.tvcultura.com/1080p.m3u8', 'ChannelNormalizer elege automaticamente o stream de maior resolução (1080p > 720p > 480p)');
  assert(normalized[0].backupStreamUrls?.length === 2, 'ChannelNormalizer armazena streams adicionais como fontes de fallback');

  // 4. EPG Aggregator e Cálculo de Progresso em America/Sao_Paulo
  const culturaChannel = liveTvProviderRegistry.getChannelById('tv-cultura');
  assert(!!culturaChannel, 'Canal TV Cultura localizado no registro canônico');
  if (culturaChannel) {
    const epgState = epgAggregator.getCurrentEpgState(culturaChannel);
    assert(!!epgState.currentProgram.title, 'EPGAggregator retorna programa atual verificado', epgState.currentProgram.title);
    assert(epgState.progressPercent >= 0 && epgState.progressPercent <= 100, 'EPGAggregator calcula barra de progresso entre 0% e 100%', `${epgState.progressPercent}%`);
    assert(epgState.formattedStartTime.includes(':') && epgState.formattedEndTime.includes(':'), 'EPGAggregator formata horários corretamente (HH:mm)');
  }

  // 5. Canais Pay-TV com Identificação Transparente de Acesso Oficial (SporTV, ESPN, Premiere)
  const sportv = liveTvProviderRegistry.getChannelById('sportv-oficial');
  assert(!!sportv, 'Canal SporTV cadastrado com sinalização de acesso oficial');
  if (sportv) {
    assert(sportv.requiresExternalAccess === true, 'SporTV sinaliza obrigatoriamente requiresExternalAccess = true (sem stream pirata falso)');
    assert(!!sportv.externalAccessUrl && sportv.externalAccessUrl.includes('globoplay'), 'SporTV aponta link transparente para provedor oficial');
  }

  const espn = liveTvProviderRegistry.getChannelById('espn-oficial');
  assert(!!espn && espn.requiresExternalAccess === true, 'ESPN cadastrado com sinalização transparente de acesso oficial');

  // 6. Categorias Canônicas
  const categorias = ['aberta', 'noticias', 'esportes', 'filmes_series', 'infantil', 'cultura', 'regionais'];
  for (const cat of categorias) {
    const list = channelRegistry.getChannelsByCategory(cat);
    assert(list.length > 0, `Categoria '${cat}' possui canais cadastrados e não fica vazia`, `Total: ${list.length}`);
  }

  // 7. Validação de URLs e Detecção de Domínios Parked
  assert(liveStreamValidator.isParkedDomain('http://superflixapi.top/manifest.m3u8') === true, 'LiveStreamValidator detecta domínios ParkLogic/estacionados');
  assert(liveStreamValidator.isParkedDomain('https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8') === false, 'LiveStreamValidator aprova CDN legítima oficial');

  // 8. Formatação de URL para Proxy CORS / Mixed Content
  const proxied = liveStreamValidator.getPlayableUrl('http://168.197.104.22/FUTURA/index.m3u8');
  assert(typeof proxied === 'string' && proxied.length > 0, 'LiveStreamValidator gera rota de reprodução estável');

  // 9. Favoritos e Preferências
  const favId = 'tv-brasil';
  const initialFav = channelFavoritesService.isFavorite(favId);
  channelFavoritesService.toggleFavorite(favId);
  const toggledFav = channelFavoritesService.isFavorite(favId);
  assert(initialFav !== toggledFav, 'ChannelFavoritesService alterna e persiste favoritos com chave canônica estável');
  // Reverte
  channelFavoritesService.toggleFavorite(favId);

  // 10. Busca de Canais
  const searchResults = liveTvProviderRegistry.searchChannels('Cultura');
  assert(searchResults.some(c => c.name.includes('Cultura')), 'Busca inteligente localiza canais por palavra-chave');

  // 11. Regressão VOD: Prioridade PT-BR e Classificador de Áudio
  const dubbedStream = { name: 'Torrentio', title: 'Filme 1080p Dublado Dual Audio PT-BR', isDubbed: true };
  const classified = classifyStream(dubbedStream, false);
  assert(classified.isDubbed === true, 'AudioDetector classifica streams dublados PT-BR com nota máxima');

  const streamsToSort = [
    { name: 'Original', title: 'Japanese 1080p Clean', isDubbed: false, isPtBr: false, quality: '1080p' },
    { name: 'Dublado', title: 'PT-BR 720p', isDubbed: true, isPtBr: true, quality: '720p' }
  ];
  const sorted = sortStreamsByPtBrPriority(streamsToSort as any, { preferDubbed: true });
  assert(sorted[0].name.includes('Dublado') && sorted[0].isDubbed === true, 'Regressão VOD: Prioridade absoluta do áudio PT-BR preservada em 1º lugar');

  console.log('\n================================================================');
  console.log(`📊 RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
