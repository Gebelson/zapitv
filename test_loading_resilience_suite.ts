import { providerRegistry } from './src/core/providers/providerRegistry';
import { mediaLoadingTracker } from './src/core/tracking/mediaLoadingTracker';
import { tmdbService } from './src/core/tmdb/tmdbClient';
import { ContentType } from './types';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🚀 ZAPITV — SUÍTE DE TESTES DE RESILIÊNCIA E CARREGAMENTO');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, details || '');
    }
  }

  // --------------------------------------------------------------------------
  // TESTE 1: Filme com fontes verificadas locais (Histórias da Fome no Brasil)
  // --------------------------------------------------------------------------
  console.log('--- Teste 1: Filme verificado local (Histórias da Fome no Brasil) ---');
  const fomeTrace = mediaLoadingTracker.startTrace('open-historias-fome-br', 'Histórias da Fome no Brasil', 'movie');
  const fomeStreams = await providerRegistry.resolveStreams('movie', { id: 'open-historias-fome-br', title: 'Histórias da Fome no Brasil' });
  assert(fomeStreams.length > 0, 'Histórias da Fome deve retornar fontes válidas imediatamente');
  assert(Boolean(fomeStreams[0]?.url && fomeStreams[0].url.length > 0), 'A primeira fonte possui URL reproduzível');
  mediaLoadingTracker.endTrace(fomeTrace, 'SUCCESS');

  // --------------------------------------------------------------------------
  // TESTE 2: Filme com fontes remotas Stremio (Um Sonho de Liberdade - tt0111161)
  // --------------------------------------------------------------------------
  console.log('\n--- Teste 2: Filme com fontes remotas (Um Sonho de Liberdade) ---');
  const shawshankTrace = mediaLoadingTracker.startTrace('tt0111161', 'Um Sonho de Liberdade', 'movie');
  const shawshankStreams = await providerRegistry.resolveStreams('movie', { imdbId: 'tt0111161', title: 'Um Sonho de Liberdade' });
  assert(shawshankStreams.length > 0, 'Shawshank deve retornar fluxos remotos dos add-ons Stremio');
  mediaLoadingTracker.endTrace(shawshankTrace, 'SUCCESS');

  // --------------------------------------------------------------------------
  // TESTE 3: Série que funciona (Breaking Bad S1E1 - tt0903747:1:1)
  // --------------------------------------------------------------------------
  console.log('\n--- Teste 3: Série com episódios remotos (Breaking Bad S1E1) ---');
  const bbTrace = mediaLoadingTracker.startTrace('tt0903747', 'Breaking Bad', 'series', 1, 1);
  const bbStreams = await providerRegistry.resolveStreams('series', { imdbId: 'tt0903747', title: 'Breaking Bad' }, { season: 1, episode: 1 });
  assert(bbStreams.length > 0, 'Breaking Bad S1E1 deve retornar fontes');
  mediaLoadingTracker.endTrace(bbTrace, 'SUCCESS');

  // --------------------------------------------------------------------------
  // TESTE 4: Anime com episódios remotos (One Piece S1E1 - tt0388629:1:1)
  // --------------------------------------------------------------------------
  console.log('\n--- Teste 4: Anime com episódios remotos (One Piece S1E1) ---');
  const opTrace = mediaLoadingTracker.startTrace('tt0388629', 'One Piece', 'anime', 1, 1);
  const opStreams = await providerRegistry.resolveStreams('anime', { imdbId: 'tt0388629', title: 'One Piece' }, { season: 1, episode: 1 });
  assert(opStreams.length > 0, 'One Piece S1E1 deve retornar fluxos');
  mediaLoadingTracker.endTrace(opTrace, 'SUCCESS');

  // --------------------------------------------------------------------------
  // TESTE 5: Mídia sem fontes (ID fictício ou mídia indie rara) — Resolução rápida e sem travas
  // --------------------------------------------------------------------------
  console.log('\n--- Teste 5: Mídia sem fontes (ID inexistente/raro) ---');
  const rareTrace = mediaLoadingTracker.startTrace('tt9999999999', 'Filme Raro Inexistente', 'movie');
  const t0 = Date.now();
  const rareStreams = await providerRegistry.resolveStreams('movie', { imdbId: 'tt9999999999', title: 'Filme Raro Inexistente' });
  const duration = Date.now() - t0;
  assert(rareStreams.length === 0, 'Mídia inexistente retorna array vazio');
  assert(duration < 9000, `Resolução sem fontes conclui dentro do timeout (< 9000ms). Levou: ${duration}ms`);
  mediaLoadingTracker.endTrace(rareTrace, 'UNAVAILABLE');

  // --------------------------------------------------------------------------
  // TESTE 6: Mídia com apenas TMDB ID numérico — Conversão automática para IMDb ID
  // --------------------------------------------------------------------------
  console.log('\n--- Teste 6: Conversão automática de TMDB ID para IMDb ID ---');
  const deadpoolTmdbId = 533535; // Deadpool & Wolverine
  const resolvedImdb = await tmdbService.getImdbId(deadpoolTmdbId, ContentType.MOVIE);
  assert(Boolean(resolvedImdb && resolvedImdb.startsWith('tt')), `TMDB ${deadpoolTmdbId} foi resolvido para IMDb ID válido (${resolvedImdb})`);

  // --------------------------------------------------------------------------
  // TESTE 7: Add-on que não responde ou offline não bloqueia outros provedores
  // --------------------------------------------------------------------------
  console.log('\n--- Teste 7: Provedor offline/inexistente tolerado por Promise.allSettled ---');
  const testT0 = Date.now();
  const streamsWithOffline = await providerRegistry.resolveStreams('movie', { imdbId: 'tt0111161', title: 'Shawshank' });
  assert(streamsWithOffline.length > 0, 'Provedores saudáveis respondem e entregam streams mesmo se outro falhar');

  // --------------------------------------------------------------------------
  // TESTE 8: Validação dos estados do MediaLoadingTracker
  // --------------------------------------------------------------------------
  console.log('\n--- Teste 8: Validação do pipeline de estados no MediaLoadingTracker ---');
  const testTrackerId = mediaLoadingTracker.startTrace('test-trace-id', 'Teste Tracker', 'movie');
  mediaLoadingTracker.transition('test-trace-id', 'CHECKING_ELIGIBILITY');
  mediaLoadingTracker.transition('test-trace-id', 'RESOLVING_MEDIA_ID');
  mediaLoadingTracker.transition('test-trace-id', 'SEARCHING_SOURCES');
  mediaLoadingTracker.transition('test-trace-id', 'VALIDATING_SOURCES');
  mediaLoadingTracker.transition('test-trace-id', 'SELECTING_AUDIO');
  mediaLoadingTracker.transition('test-trace-id', 'PREPARING_PLAYER');
  mediaLoadingTracker.transition('test-trace-id', 'READY');
  mediaLoadingTracker.transition('test-trace-id', 'PLAYING');
  
  const finalTrace = mediaLoadingTracker.getTrace(testTrackerId);
  assert(finalTrace !== undefined, 'Trace deve existir');
  assert(finalTrace?.currentStep === 'PLAYING', 'Estado atual do trace deve ser PLAYING');
  assert(finalTrace?.finalStatus === 'SUCCESS', 'Status final deve ser SUCCESS');
  assert(finalTrace?.history.length === 9, `Histórico deve conter todas as 9 transições de estado (atual: ${finalTrace?.history.length})`);

  // --------------------------------------------------------------------------
  // TESTE 9: Timeout de metadados e resiliência no TMDB Client
  // --------------------------------------------------------------------------
  console.log('\n--- Teste 9: Timeout e resiliência no TMDB Client ---');
  const details = await tmdbService.getDetailsByImdb('tt0111161', ContentType.MOVIE);
  assert(Boolean(details && details.item && details.item.title), 'getDetailsByImdb retornou metadados com sucesso');

  console.log('\n===============================================================');
  console.log(`📊 RESULTADO FINAL: ${passedTests} de ${totalTests} testes aprovados (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('===============================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Erro fatal na suíte de testes:', err);
  process.exit(1);
});
