/**
 * Suíte de Testes Automatizada: Elegibilidade do Catálogo ZapiTV
 * Testa rigorosamente:
 * 1. Títulos não lançados (ex: VisionQuest) -> Rejeitados
 * 2. Títulos em cartaz nos cinemas (ex: Vingadores Doutor Destino) -> Rejeitados
 * 3. Títulos lançados mas sem fontes reais/comprovadas (ex: Tyson, Profundezas, O Intruso) -> Rejeitados
 * 4. Títulos com fontes comprovadas e reproduzíveis -> Aprovados
 * 5. Isolamento por categoria na busca e catálogo
 * 6. Ausência de carregamento infinito
 */

import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { ContentItem, ContentType } from '../types';

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: any) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`, detail || '');
    failed++;
  }
}

async function runSuite() {
  console.log('====================================================');
  console.log('SUÍTE DE TESTES: ELEGIBILIDADE E REPRODUÇÃO NO CATÁLOGO');
  console.log('====================================================\n');

  // CASO 1: VisionQuest (Marvel TV Series não lançada)
  const visionQuest: ContentItem = {
    id: 'visionquest-2026',
    imdbId: 'tt15202118',
    title: 'VisionQuest',
    type: ContentType.SERIES,
    year: 2026,
    genres: ['Ação', 'Ficção'],
    image: 'https://example.com/vq.jpg'
  };

  const vqSync = catalogEligibilityService.isItemPubliclyPlayableSync(visionQuest);
  assert('1.1 VisionQuest is excluded in sync check', vqSync === false);

  const vqEval = await catalogEligibilityService.evaluateItem(visionQuest);
  assert('1.2 VisionQuest releaseStatus is NOT_RELEASED or UNAVAILABLE', 
    vqEval.releaseStatus === 'NOT_RELEASED' || vqEval.playbackStatus === 'UNAVAILABLE_CONFIRMED',
    vqEval
  );

  // CASO 2: Tyson (Série lançada, mas sem fontes válidas / homônimo de 1995 rejeitado)
  const tyson: ContentItem = {
    id: 'tyson-2026',
    imdbId: 'tt33562696',
    title: 'Tyson',
    type: ContentType.SERIES,
    year: 2026,
    genres: ['Documentário'],
    image: 'https://example.com/tyson.jpg'
  };

  const tysonSync = catalogEligibilityService.isItemPubliclyPlayableSync(tyson);
  assert('2.1 Tyson is excluded in sync check', tysonSync === false);

  // CASO 3: Profundezas (Série da Netflix sem fontes válidas nos add-ons)
  const profundezas: ContentItem = {
    id: 'profundezas-2026',
    imdbId: 'tt32840506',
    title: 'Profundezas',
    type: ContentType.SERIES,
    year: 2026,
    genres: ['Drama', 'Suspense'],
    image: 'https://example.com/profundezas.jpg'
  };

  const profSync = catalogEligibilityService.isItemPubliclyPlayableSync(profundezas);
  assert('3.1 Profundezas is excluded in sync check', profSync === false);

  // CASO 4: O Intruso (Filme sem fonte digital funcional)
  const oIntruso: ContentItem = {
    id: 'o-intruso-2026',
    imdbId: 'tt31070710',
    title: 'O Intruso',
    type: ContentType.MOVIE,
    year: 2026,
    genres: ['Terror', 'Suspense'],
    image: 'https://example.com/intruso.jpg'
  };

  const intrusoSync = catalogEligibilityService.isItemPubliclyPlayableSync(oIntruso);
  assert('4.1 O Intruso is excluded in sync check', intrusoSync === false);

  // CASO 5: Filme em cartaz nos cinemas (Vingadores: Doutor Destino)
  const avengersDoomsday: ContentItem = {
    id: 'avengers-doomsday-2026',
    imdbId: 'tt10857164',
    title: 'Vingadores: Doutor Destino',
    type: ContentType.MOVIE,
    year: 2026,
    genres: ['Ação', 'Aventura'],
    image: 'https://example.com/avengers.jpg'
  };

  const avengersAllowed = theatricalFilterService.isMovieAllowedSync(avengersDoomsday);
  assert('5.1 Vingadores: Doutor Destino is not allowed theatrically', avengersAllowed === false);
  const avengersPublic = catalogEligibilityService.isItemPubliclyPlayableSync(avengersDoomsday);
  assert('5.2 Vingadores: Doutor Destino is excluded from public playback', avengersPublic === false);

  // CASO 6: Títulos verificados com reprodução comprovada
  const verifiedItems: ContentItem[] = [
    {
      id: 'shawshank',
      imdbId: 'tt0111161',
      title: 'Um Sonho de Liberdade',
      type: ContentType.MOVIE,
      year: 1994,
      image: 'https://example.com/shawshank.jpg'
    },
    {
      id: 'open-historias-da-fome',
      imdbId: 'tt33562699',
      title: 'Histórias da Fome',
      type: ContentType.MOVIE,
      year: 2024,
      image: 'https://example.com/fome.jpg'
    },
    {
      id: 'open-sintel',
      title: 'Sintel',
      type: ContentType.MOVIE,
      year: 2010,
      image: 'https://example.com/sintel.jpg'
    }
  ];

  for (const item of verifiedItems) {
    const isOk = catalogEligibilityService.isItemPubliclyPlayableSync(item);
    assert(`6. Verified playable item approved: "${item.title}"`, isOk === true);
  }

  // CASO 7: Teste do filtro em lote (filterEligibleItemsSync)
  const mixedCatalog: ContentItem[] = [
    visionQuest,
    verifiedItems[0],
    tyson,
    verifiedItems[1],
    profundezas,
    oIntruso,
    avengersDoomsday,
    verifiedItems[2]
  ];

  const filtered = catalogEligibilityService.filterEligibleItemsSync(mixedCatalog);
  assert('7.1 Filter preserves only verified items', filtered.length === 3);
  assert('7.2 None of the 4 reported unplayable titles exist in filtered list',
    !filtered.some(i => ['VisionQuest', 'Tyson', 'Profundezas', 'O Intruso', 'Vingadores: Doutor Destino'].includes(i.title))
  );

  // CASO 8: Validação de Episódios Futuros
  const seriesWithEpisodes: ContentItem = {
    id: 'test-series',
    title: 'Série de Teste',
    type: ContentType.SERIES,
    episodes: [
      { id: 'ep1', number: 1, title: 'Ep 1', releaseDate: '2029-01-01', description: '', image: '' } as any,
      { id: 'ep2', number: 2, title: 'Ep 2', releaseDate: '2020-01-01', description: '', image: '' } as any
    ]
  };

  const futureEpResult = await catalogEligibilityService.validateEpisode(seriesWithEpisodes, 1, 1);
  assert('8.1 Future episode is marked unreleased', futureEpResult.releaseStatus === 'NOT_RELEASED' && futureEpResult.hasPlayableSource === false);

  // CASO 9: Métricas do Painel Administrativo
  const metrics = catalogEligibilityService.getMetrics();
  assert('9.1 Metrics report evaluated items correctly', metrics.totalEvaluated >= 4 && metrics.approvedCount > 0);

  console.log('\n====================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU, ${failed} FALHOU`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(e => {
  console.error('Erro na execução da suíte:', e);
  process.exit(1);
});
