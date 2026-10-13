import { catalogDiscoveryService } from './src/core/catalog/CatalogDiscoveryService';
import { mediaAvailabilityIndex } from './src/core/catalog/MediaAvailabilityIndex';
import { catalogAvailabilityQueue } from './src/core/catalog/CatalogAvailabilityQueue';
import { diagnosticService } from './src/core/catalog/DiagnosticService';
import { sourceSelectionService } from './src/core/selection/sourceSelectionService';
import { ContentType } from './types';

async function runCatalogVarietyTestSuite() {
  console.log('================================================================');
  console.log('🧪 TESTE COMPLETO: DESCOBERTA, DISPONIBILIDADE E CATÁLOGO ZAPITV');
  console.log('================================================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      testsFailed++;
    }
  }

  // -------------------------------------------------------------
  // TESTE 1: Descoberta de Filmes Multi-Páginas (TMDB + Cinemeta)
  // -------------------------------------------------------------
  console.log('--- TESTE 1: Descoberta de Filmes ---');
  try {
    const moviesP1 = await catalogDiscoveryService.discoverMovies(1);
    const moviesP2 = await catalogDiscoveryService.discoverMovies(2);
    const totalMovies = moviesP1.items.length + moviesP2.items.length;

    assert(moviesP1.items.length > 0, 'Filmes página 1 descobertos com sucesso', `Total: ${moviesP1.items.length}`);
    assert(moviesP2.items.length > 0, 'Filmes página 2 descobertos com sucesso', `Total: ${moviesP2.items.length}`);
    assert(totalMovies >= 30, 'Variedade substancial de filmes recuperada', `Total combinado: ${totalMovies}`);

    // Verifica que filmes não possuem campos obrigatórios nulos
    const sampleMovie = moviesP1.items[0];
    assert(Boolean(sampleMovie && sampleMovie.id && sampleMovie.title), 'Estrutura do item de filme válida', sampleMovie?.title);
  } catch (err: any) {
    assert(false, 'Descoberta de filmes falhou com erro', err?.message);
  }

  // -------------------------------------------------------------
  // TESTE 2: Descoberta de Séries Multi-Páginas (TMDB + Cinemeta)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 2: Descoberta de Séries ---');
  try {
    const seriesP1 = await catalogDiscoveryService.discoverSeries(1);
    const seriesP2 = await catalogDiscoveryService.discoverSeries(2);
    const totalSeries = seriesP1.items.length + seriesP2.items.length;

    assert(seriesP1.items.length > 0, 'Séries página 1 descobertas com sucesso', `Total: ${seriesP1.items.length}`);
    assert(seriesP2.items.length > 0, 'Séries página 2 descobertas com sucesso', `Total: ${seriesP2.items.length}`);
    assert(totalSeries >= 30, 'Variedade substancial de séries recuperada', `Total combinado: ${totalSeries}`);
  } catch (err: any) {
    assert(false, 'Descoberta de séries falhou com erro', err?.message);
  }

  // -------------------------------------------------------------
  // TESTE 3: Descoberta de Animes (Séries TV E Filmes de Anime)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 3: Descoberta de Animes (Séries + Longas) ---');
  try {
    const animes = await catalogDiscoveryService.discoverAnimes(1);
    assert(animes.items.length > 0, 'Animes descobertos com sucesso', `Total: ${animes.items.length}`);

    // Verifica se há pelo menos um item classificado como Anime
    const hasAnimeTag = animes.items.some(it => it.type === ContentType.ANIME || it.genres?.includes('Anime') || it.genres?.includes('Animação'));
    assert(hasAnimeTag, 'Itens contêm tag ou tipo Anime', `Exemplo: ${animes.items[0]?.title}`);
  } catch (err: any) {
    assert(false, 'Descoberta de animes falhou com erro', err?.message);
  }

  // -------------------------------------------------------------
  // TESTE 4: Descoberta Dinâmica por Gênero (TMDB /discover)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 4: Descoberta Dinâmica por Gênero ---');
  try {
    const terrorMovies = await catalogDiscoveryService.discoverMovies(1, 'Terror');
    assert(terrorMovies.items.length > 0, 'Busca dinâmica por gênero "Terror" retornou títulos', `Total: ${terrorMovies.items.length}`);

    const hasTerrorGenre = terrorMovies.items.some(it => it.genres?.includes('Terror') || it.genres?.includes('Suspense'));
    assert(hasTerrorGenre, 'Filmes retornados contêm gênero Terror/Suspense', `Exemplo: ${terrorMovies.items[0]?.title}`);
  } catch (err: any) {
    assert(false, 'Busca dinâmica por gênero falhou', err?.message);
  }

  // -------------------------------------------------------------
  // TESTE 5: Camada B - Regra "Timeout NÃO é igual a Sem Fonte"
  // -------------------------------------------------------------
  console.log('\n--- TESTE 5: Estados de Disponibilidade & Timeout ---');
  const testTimeoutId = 'tt_test_timeout_9999999';
  mediaAvailabilityIndex.markTemporaryError(testTimeoutId, 'movie', 'Timeout do provedor de teste');

  const timeoutStatus = mediaAvailabilityIndex.getStatus(testTimeoutId);
  const timeoutPlayable = mediaAvailabilityIndex.isPubliclyPlayable(testTimeoutId);

  assert(timeoutStatus === 'TEMPORARY_ERROR', 'Timeout classificado como TEMPORARY_ERROR (e NÃO como UNAVAILABLE_CONFIRMED)');
  assert(timeoutPlayable === true, 'Item com TEMPORARY_ERROR permanece visível no catálogo (não ocultado prematuramente)');

  // -------------------------------------------------------------
  // TESTE 6: Camada B - Ocultar apenas UNAVAILABLE_CONFIRMED
  // -------------------------------------------------------------
  console.log('\n--- TESTE 6: Ocultação estrita de itens comprovadamente sem fonte ---');
  const testDeadId = 'tt_test_dead_0000000';
  mediaAvailabilityIndex.markUnavailableConfirmed(testDeadId, 'movie', ['ProviderA', 'ProviderB']);

  const deadStatus = mediaAvailabilityIndex.getStatus(testDeadId);
  const deadPlayable = mediaAvailabilityIndex.isPubliclyPlayable(testDeadId);

  assert(deadStatus === 'UNAVAILABLE_CONFIRMED', 'Item sem fontes confirmado como UNAVAILABLE_CONFIRMED');
  assert(deadPlayable === false, 'Item UNAVAILABLE_CONFIRMED é estritamente ocultado do catálogo público');

  // -------------------------------------------------------------
  // TESTE 7: Camada B - Áudio Original Permanece Disponível
  // -------------------------------------------------------------
  console.log('\n--- TESTE 7: Preservação de Obras com Áudio Original ---');
  const testOriginalId = 'tt_test_original_1234567';
  mediaAvailabilityIndex.markAvailable(testOriginalId, 'movie', {
    title: 'Obra Estrangeira Sem Dublagem',
    sourceCount: 3,
    providersChecked: ['Torrentio Global'],
    hasPtBrAudio: false, // Sem dublagem PT-BR
    hasPtSubtitles: true, // Com legenda PT
    bestQuality: '1080p'
  });

  const origStatus = mediaAvailabilityIndex.getStatus(testOriginalId);
  const origPlayable = mediaAvailabilityIndex.isPubliclyPlayable(testOriginalId);

  assert(origStatus === 'AVAILABLE', 'Obra com áudio original classificada como AVAILABLE');
  assert(origPlayable === true, 'Obra com áudio original permanece acessível no catálogo');

  // -------------------------------------------------------------
  // TESTE 8: Camada C - Prioridade PT-BR na Reprodução
  // -------------------------------------------------------------
  console.log('\n--- TESTE 8: Prioridade de Reprodução PT-BR (Camada C) ---');
  const mockStreams: any[] = [
    {
      title: 'Movie 1080p [EN] English Audio',
      name: 'Stream EN',
      url: 'https://cdn.example.com/en.mp4',
      isPtBr: false,
      isDubbed: false,
      quality: '1080p'
    },
    {
      title: 'Movie 1080p [PT-BR] Dublado Brasileiro Oficial',
      name: 'Stream PT-BR',
      url: 'https://cdn.example.com/ptbr.mp4',
      isPtBr: true,
      isDubbed: true,
      quality: '1080p'
    }
  ];

  const ranked = sourceSelectionService.rankStreams(mockStreams, { hasExternalPtSub: true, preferDubbed: true });
  assert(ranked.length === 2, 'Ranking preserva todas as fontes válidas');
  assert(ranked[0].isPtBr === true, 'Stream dublado PT-BR posicionado em 1º lugar (Prioridade Máxima)');

  // -------------------------------------------------------------
  // TESTE 9: Diagnóstico e Relatório Completo
  // -------------------------------------------------------------
  console.log('\n--- TESTE 9: Painel de Diagnóstico & Estatísticas ---');
  const report = diagnosticService.getFullReport();

  assert(report.discovery.totalDiscovered > 0, 'Relatório contém contagem de itens descobertos', `${report.discovery.totalDiscovered} itens`);
  assert(report.availability.totalIndexed > 0, 'Relatório contém índice de disponibilidade', `${report.availability.totalIndexed} indexados`);
  assert(report.providers.length > 0, 'Relatório monitora provedores configurados', `${report.providers.length} provedores`);

  // -------------------------------------------------------------
  // TESTE 10: Tracer Canônico (traceItem)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 10: Rastreamento Canônico (Trace Item) ---');
  const traceAvailable = diagnosticService.traceItem(testOriginalId);
  assert(traceAvailable.isPlayable === true, 'Tracer identifica corretamente item disponível');
  assert(Boolean(traceAvailable.explanation), 'Tracer fornece explicação diagnóstica legível', traceAvailable.explanation);

  const traceDead = diagnosticService.traceItem(testDeadId);
  assert(traceDead.isPlayable === false, 'Tracer identifica corretamente item indisponível');
  assert(traceDead.status === 'UNAVAILABLE_CONFIRMED', 'Tracer reporta status UNAVAILABLE_CONFIRMED');

  // -------------------------------------------------------------
  // TESTE 11: Limpeza Segura de Caches Negativos Antigos
  // -------------------------------------------------------------
  console.log('\n--- TESTE 11: Limpeza Segura de Caches Negativos ---');
  const cleaned = mediaAvailabilityIndex.cleanOldNegativeCaches();
  assert(typeof cleaned === 'number', 'cleanOldNegativeCaches executa com sucesso', `Limpos/Resetados: ${cleaned}`);

  // Resumo Final
  console.log('\n================================================================');
  console.log(`🏁 RESULTADO DO TESTE DE VARIEDADE DO CATÁLOGO:`);
  console.log(`   Total de Testes: ${testsPassed + testsFailed}`);
  console.log(`   Sucessos: ${testsPassed}`);
  console.log(`   Falhas: ${testsFailed}`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runCatalogVarietyTestSuite().catch(e => {
  console.error('Erro na suíte de testes:', e);
  process.exit(1);
});
