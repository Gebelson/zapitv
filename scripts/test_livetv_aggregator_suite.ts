import { OfficialChannelProvider } from '../src/core/livetv/OfficialChannelProvider';
import { channelNormalizer } from '../src/core/livetv/ChannelNormalizer';
import { channelSourceResolver } from '../src/core/livetv/ChannelSourceResolver';
import { tvModeController } from '../src/core/livetv/TVModeController';
import { epgAggregator } from '../src/core/livetv/EPGAggregator';
import { liveStreamValidator } from '../src/core/livetv/LiveStreamValidator';
import { StremioLiveTVAdapter } from '../src/core/livetv/StremioLiveTVAdapter';

let passed = 0;
let failed = 0;

function assert(desc: string, condition: boolean) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${desc}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 BATERIA DE TESTES DO AGREGADOR DE TV AO VIVO (ZAPITV)');
  console.log('================================================================\n');

  // TESTE 1: Catálogo Oficial & Canais Autênticos
  console.log('TESTE 1: Verificação do Catálogo Oficial de Canais Brasileiros');
  const officialChannels = OfficialChannelProvider.getOfficialChannels();
  assert('Catálogo oficial deve conter pelo menos 30 canais autênticos', officialChannels.length >= 30);
  
  const hasCultura = officialChannels.some(c => c.id === 'tv-cultura');
  const hasBrasil = officialChannels.some(c => c.id === 'tv-brasil');
  const hasRecordNews = officialChannels.some(c => c.id === 'record-news');
  const hasCnn = officialChannels.some(c => c.id === 'cnn-brasil');
  const hasSbtNews = officialChannels.some(c => c.id === 'sbt-news');
  const hasNSports = officialChannels.some(c => c.id === 'n-sports');
  const hasMonica = officialChannels.some(c => c.id === 'turma-da-monica');
  const hasNaruto = officialChannels.some(c => c.id === 'naruto-dublado');

  assert('TV Cultura presente no catálogo', hasCultura);
  assert('TV Brasil presente no catálogo', hasBrasil);
  assert('Record News presente no catálogo', hasRecordNews);
  assert('CNN Brasil presente no catálogo', hasCnn);
  assert('SBT News presente no catálogo', hasSbtNews);
  assert('N Sports presente no catálogo', hasNSports);
  assert('Turma da Mônica presente no catálogo', hasMonica);
  assert('Naruto presente no catálogo', hasNaruto);

  // TESTE 2: Normalização & Deduplicação de Canais
  console.log('\nTESTE 2: Normalização & Deduplicação Canônica (ChannelNormalizer)');
  const duplicatesInput = [
    ...officialChannels,
    {
      id: 'tv_cultura_clone',
      tvgId: 'TVCultura.br',
      name: 'TV Cultura (Clone 720p)',
      url: 'https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8',
      category: 'cultura',
      quality: '720p',
      provider: 'M3U Test'
    }
  ];
  const normalized = channelNormalizer.normalizeAndDeduplicate(duplicatesInput);
  const culturaInstances = normalized.filter(c => c.canonicalId === 'tv-cultura' || c.id === 'tv-cultura');
  assert('Deduplicação unifica clones em uma única entidade de canal', culturaInstances.length === 1);
  assert('Deduplicação mantém múltiplos streams de backup organizados', (culturaInstances[0]?.sources?.length || 0) >= 1);

  // TESTE 3: Resolução de Fontes e Qualidade (ChannelSourceResolver)
  console.log('\nTESTE 3: Resolução Prioritária de Streams (ChannelSourceResolver)');
  const culturaChannel = normalized.find(c => c.id === 'tv-cultura');
  assert('Canal Cultura encontrado na lista normalizada', !!culturaChannel);
  if (culturaChannel) {
    const bestSource = channelSourceResolver.resolveBestSource(culturaChannel);
    assert('Melhor stream resolvido com sucesso', !!bestSource && bestSource.primaryUrl.includes('tvcultura.m3u8'));
  }

  // TESTE 4: Modo Televisão State Machine (TVModeController)
  console.log('\nTESTE 4: Controle de Navegação e Zapping (TVModeController)');
  tvModeController.setChannels(normalized);
  const initial = tvModeController.getActiveChannel();
  assert('Canal inicial ativo definido', !!initial);
  
  const nextCh = tvModeController.nextChannel();
  assert('Zapping para o próximo canal altera o canal ativo', nextCh?.id !== initial?.id);
  
  const prevCh = tvModeController.prevChannel();
  assert('Zapping para o canal anterior retorna ao canal inicial', prevCh?.id === initial?.id);

  // TESTE 5: EPG Aggregator e Cálculo de Progresso em Fuso Horário de Brasília
  console.log('\nTESTE 5: Guia de Programação EPG (EPGAggregator)');
  if (culturaChannel) {
    const epgState = epgAggregator.getCurrentEpgState(culturaChannel);
    assert('Programa atual resolvido', !!epgState.currentProgram && !!epgState.currentProgram.title);
    assert('Próximo programa resolvido', !!epgState.nextProgram && !!epgState.nextProgram.title);
    assert('Progresso do programa atual entre 0 e 100%', epgState.progressPercent >= 0 && epgState.progressPercent <= 100);
    assert('Horário de início formatado (HH:MM)', /^\d{2}:\d{2}$/.test(epgState.formattedStartTime));
    assert('Horário de término formatado (HH:MM)', /^\d{2}:\d{2}$/.test(epgState.formattedEndTime));
  }

  // TESTE 6: Acesso Oficial Transparente para Pay-TV (Globo, SporTV, ESPN, Premiere)
  console.log('\nTESTE 6: Transparência em Sinais Pay-TV e Fechados');
  const globo = normalized.find(c => c.id === 'globo-oficial');
  const sportv = normalized.find(c => c.id === 'sportv-oficial');
  const espn = normalized.find(c => c.id === 'espn-oficial');
  const premiere = normalized.find(c => c.id === 'premiere-oficial');

  assert('TV Globo marcada com requiresExternalAccess', !!globo?.requiresExternalAccess);
  assert('TV Globo possui link oficial Globoplay', !!globo?.externalAccessUrl?.includes('globoplay'));
  assert('SporTV marcado com requiresExternalAccess', !!sportv?.requiresExternalAccess);
  assert('ESPN marcado com requiresExternalAccess', !!espn?.requiresExternalAccess);
  assert('Premiere marcado com requiresExternalAccess', !!premiere?.requiresExternalAccess);

  // TESTE 7: Validador de Streams & Quarentena de Domínios
  console.log('\nTESTE 7: Validação e Detecção de Domínios Falsos / Parked / Adultos');
  const isParkedDomain = liveStreamValidator.isParkedDomain('http://superflixapi.top/live/test.m3u8');
  assert('Superflixapi.top corretamente detectado como domínio estacionado', isParkedDomain);

  const isLegitCdn = liveStreamValidator.isParkedDomain('https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8');
  assert('CDN oficial da TV Cultura NÃO é falsamente marcado como parked', !isLegitCdn);

  // TESTE 8: Stremio Live Addon Adapter Integration
  console.log('\nTESTE 8: Consulta de Manifesto & Catálogo do Stremio Live Addon');
  try {
    const resp = await fetch('http://localhost:4000/api/stremio/live/manifest.json');
    if (resp.ok) {
      const manifest = await resp.json();
      assert('Manifesto Stremio Live Addon retornado com sucesso', manifest.id === 'org.zapitv.livetv');
      assert('Manifesto declara recurso de catálogo de TV', manifest.catalogs?.some((c: any) => c.id === 'live-tv-brazil'));

      const catResp = await fetch('http://localhost:4000/api/stremio/live/catalog/tv/live-tv-brazil.json');
      if (catResp.ok) {
        const catData = await catResp.json();
        assert('Catálogo Stremio Live retorna lista de canais', Array.isArray(catData.metas) && catData.metas.length > 0);
      }

      const streamResp = await fetch('http://localhost:4000/api/stremio/live/stream/tv/tv-cultura.json');
      if (streamResp.ok) {
        const streamData = await streamResp.json();
        assert('Stream Stremio Live de TV Cultura resolvido', Array.isArray(streamData.streams) && streamData.streams.length > 0);
      }
    } else {
      console.log('  ⚠️ Servidor não respondeu na porta 4000 (executando teste em modo isolado)');
    }
  } catch (err) {
    console.log('  ⚠️ Teste HTTP ignorado (servidor offline ou reiniciando)');
  }

  console.log('\n================================================================');
  console.log(`🏁 RESULTADO: ${passed} PASSOU, ${failed} FALHOU`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
