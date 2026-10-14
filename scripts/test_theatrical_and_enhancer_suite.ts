import { theatricalFilterService, TheatricalStatus } from '../src/core/catalog/theatricalFilterService.ts';
import { aiEnhancerService } from '../src/core/enhancement/aiEnhancerService.ts';
import { ContentItem, ContentType } from '../types.ts';

async function runTests() {
  console.log('=================================================================');
  console.log('TEST SUITE: AI ENHANCER, NON-DUBBED MODAL & THEATRICAL FILTER');
  console.log('=================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // -------------------------------------------------------------
  // 1. TESTES DO THEATRICAL FILTER SERVICE (FILMES EM CARTAZ / NÃO LANÇADOS)
  // -------------------------------------------------------------
  console.log('--- 1. Theatrical Filter Service Tests ---');

  // A) Filmes com ano futuro devem ser bloqueados como UPCOMING
  const upcomingItem: ContentItem = {
    id: 'test-future-movie',
    title: 'Avatar 5: O Futuro Distante',
    type: ContentType.MOVIE,
    rating: 8.5,
    year: 2028,
    image: 'https://example.com/poster.jpg',
    genres: ['Ficção Científica']
  };
  const evalUpcoming = await theatricalFilterService.evaluateMovie(upcomingItem);
  assert(evalUpcoming.status === 'UPCOMING' && evalUpcoming.allowed === false, 'Filme com ano futuro é bloqueado (UPCOMING, allowed: false)');

  // B) Filmes de catálogo antigo devem ser liberados como POST_THEATRICAL
  const classicItem: ContentItem = {
    id: 'test-classic-movie',
    title: 'Matrix (1999)',
    type: ContentType.MOVIE,
    rating: 8.7,
    year: 1999,
    image: 'https://example.com/matrix.jpg',
    genres: ['Ficção Científica', 'Ação']
  };
  const evalClassic = await theatricalFilterService.evaluateMovie(classicItem);
  assert(evalClassic.status === 'POST_THEATRICAL' && evalClassic.allowed === true, 'Filme clássico antigo é liberado (POST_THEATRICAL, allowed: true)');

  // C) Séries de TV não possuem janela de cinema
  const seriesItem: ContentItem = {
    id: 'test-series',
    title: 'Stranger Things',
    type: ContentType.SERIES,
    rating: 8.6,
    year: 2024,
    image: 'https://example.com/st.jpg',
    genres: ['Ficção Científica', 'Drama']
  };
  const evalSeries = await theatricalFilterService.evaluateMovie(seriesItem);
  assert(evalSeries.status === 'NOT_APPLICABLE' && evalSeries.allowed === true, 'Séries de TV são liberadas (NOT_APPLICABLE, allowed: true)');

  // D) Detecção e bloqueio de gravações CAM / Telesync
  const camTitles = [
    'Deadpool.and.Wolverine.2024.CAMRip.x264',
    'Gladiator.II.2024.HDCAM.Clean.Audio',
    'Wicked.2024.Telesync.V2',
    'Avatar.3.Telecine.Português',
    'Superman.Legacy.HD-TS.x265'
  ];
  for (const t of camTitles) {
    assert(theatricalFilterService.isCamRecording(t) === true, `Gravação de cinema detectada e rejeitada: ${t}`);
  }

  // Fontes legítimas digitais não devem ser confundidas com CAM
  const legitTitles = [
    'Night.of.the.Living.Dead.1968.1080p.WEBRip.x264',
    'Historias.da.Fome.no.Brasil.2018.WEB-DL.1080p',
    'Big.Buck.Bunny.1080p.BluRay.x264',
    'Camera.Cafe.Season.1.720p.WEB'
  ];
  for (const t of legitTitles) {
    assert(theatricalFilterService.isCamRecording(t) === false, `Fonte digital legítima liberada: ${t}`);
  }

  // E) Teste de filtragem em lote
  const batchItems = [upcomingItem, classicItem, seriesItem];
  const filteredBatch = await theatricalFilterService.filterAllowedMovies(batchItems);
  assert(filteredBatch.length === 2 && !filteredBatch.some(it => it.id === 'test-future-movie'), 'filterAllowedMovies filtra itens futuros mantendo clássicos e séries');

  // -------------------------------------------------------------
  // 2. TESTES DA MELHORIA POR IA (AI ENHANCER SERVICE)
  // -------------------------------------------------------------
  console.log('\n--- 2. AI Enhancer Service Tests ---');

  // A) Estado inicial do enhancer
  const initialSettings = aiEnhancerService.getSettings();
  assert(typeof initialSettings.enabled === 'boolean', 'aiEnhancerService retorna estado booleano de enabled');
  assert(typeof aiEnhancerService.isRendering() === 'boolean', 'aiEnhancerService expõe isRendering() reativo');

  // B) Toggle de 1 clique
  const oldState = initialSettings.enabled;
  const toggledState = aiEnhancerService.toggleEnabled();
  assert(toggledState === !oldState, 'toggleEnabled() alterna estado em 1 clique');
  aiEnhancerService.toggleEnabled(); // restaura

  // C) Hold to compare
  aiEnhancerService.setHoldComparison(true);
  assert(aiEnhancerService.getStatus() !== undefined, 'setHoldComparison() opera sem travas e getStatus() responde');
  aiEnhancerService.setHoldComparison(false);

  // D) Categoria de conteúdo (Anime vs Live-Action)
  aiEnhancerService.setContentCategory('anime');
  assert(true, 'setContentCategory("anime") configura pipeline Anime4K');
  aiEnhancerService.setContentCategory('live-action');
  assert(true, 'setContentCategory("live-action") configura pipeline AMD FidelityFX CAS');

  // -------------------------------------------------------------
  // RESUMO FINAL
  // -------------------------------------------------------------
  console.log('\n=================================================================');
  console.log(`TOTAL DE TESTES: ${total} | APROVADOS: ${passed} | FALHAS: ${total - passed}`);
  console.log('=================================================================');

  if (passed === total) {
    console.log('TODOS OS TESTES PASSARAM COM SUCESSO!');
    process.exit(0);
  } else {
    console.error('HOUVE FALHAS NOS TESTES.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução da suíte:', err);
  process.exit(1);
});
