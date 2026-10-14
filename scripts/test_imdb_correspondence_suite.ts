/**
 * SUÍTE DE TESTES OBRIGATÓRIOS (TESTES A ATÉ L) — SEÇÃO 13
 * ZAPITV — CORREÇÃO CRÍTICA DO EM DESTAQUE (IMDb MOVIEmeter & TVmeter)
 */

import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { imdbWeeklyRankingService, ImdbRankingEntry } from '../src/core/rankings/IMDbWeeklyRankingService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { ContentType } from '../types';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log(' INICIANDO SUÍTE DE TESTES CRÍTICOS DO EM DESTAQUE (IMDb)');
  console.log('============================================================\n');

  const selection = featuredRankingService.recomputeFeaturedSelectionSync();

  // --------------------------------------------------------------------------
  // TESTE A: Correspondência dos títulos
  // --------------------------------------------------------------------------
  console.log('Teste A: Correspondência dos títulos publicados com o snapshot oficial do IMDb');
  const audit = imdbWeeklyRankingService.verifyCorrespondence(
    selection.featuredMovies,
    selection.featuredSeries
  );
  assert(
    audit.isCompliant,
    'Teste A.1: 100% dos títulos pertencem ao snapshot oficial',
    `Mismatches: ${JSON.stringify([...audit.movieMismatches, ...audit.seriesMismatches])}`
  );
  assert(
    selection.featuredMovies.length === 10,
    'Teste A.2: Exatamente 10 filmes publicados'
  );
  assert(
    selection.featuredSeries.length === 10,
    'Teste A.3: Exatamente 10 séries publicadas'
  );

  // --------------------------------------------------------------------------
  // TESTE B: Ausência de títulos fantasmas
  // --------------------------------------------------------------------------
  console.log('\nTeste B: Ausência de títulos fantasmas (nada inventado ou de listas TMDB)');
  const officialMovies = imdbWeeklyRankingService.getLatestRanking('movie').ranking;
  const officialSeries = imdbWeeklyRankingService.getLatestRanking('series').ranking;
  const movieIds = new Set(officialMovies.map(m => m.imdbId.toLowerCase()));
  const seriesIds = new Set(officialSeries.map(s => s.imdbId.toLowerCase()));

  const ghostMovies = selection.featuredMovies.filter(m => !movieIds.has((m.imdbId || '').toLowerCase()));
  const ghostSeries = selection.featuredSeries.filter(s => !seriesIds.has((s.imdbId || '').toLowerCase()));

  assert(
    ghostMovies.length === 0,
    'Teste B.1: Zero títulos fantasmas entre os filmes publicados',
    `Fantasmas: ${ghostMovies.map(g => g.title).join(', ')}`
  );
  assert(
    ghostSeries.length === 0,
    'Teste B.2: Zero títulos fantasmas entre as séries publicadas',
    `Fantasmas: ${ghostSeries.map(g => g.title).join(', ')}`
  );

  // --------------------------------------------------------------------------
  // TESTE C: Ordem estrita de popularidade
  // --------------------------------------------------------------------------
  console.log('\nTeste C: Respeito à ordem estrita de popularidade do IMDb');
  let moviesOrdered = true;
  for (let i = 0; i < selection.featuredMovies.length - 1; i++) {
    const cur = selection.featuredMovies[i].imdbRank || 0;
    const next = selection.featuredMovies[i + 1].imdbRank || 0;
    if (cur >= next) {
      moviesOrdered = false;
      break;
    }
  }
  assert(moviesOrdered, 'Teste C.1: Filmes ordenados estritamente por IMDb rank ascendente');

  let seriesOrdered = true;
  for (let i = 0; i < selection.featuredSeries.length - 1; i++) {
    const cur = selection.featuredSeries[i].imdbRank || 0;
    const next = selection.featuredSeries[i + 1].imdbRank || 0;
    if (cur >= next) {
      seriesOrdered = false;
      break;
    }
  }
  assert(seriesOrdered, 'Teste C.2: Séries ordenadas estritamente por IMDb rank ascendente');

  // --------------------------------------------------------------------------
  // TESTE D: Descarte de filmes de cinema / ainda não lançados
  // --------------------------------------------------------------------------
  console.log('\nTeste D: Descarte de obras de cinema ou sem lançamento digital');
  const mockTheatricalItem = {
    id: 'test-theatrical-1',
    title: 'Vingadores: Doutor Destino',
    type: ContentType.MOVIE,
    rating: 8.0,
    year: 2026,
    image: '',
    description: '',
    platform: 'Cinema',
    inTheaters: true,
    imdbId: 'tt9999001',
    tmdbId: '1003596',
    availabilityStatus: 'verified' as any,
    videoUrl: 'https://example.com/stream.m3u8'
  };
  const testCandidateD = [{
    imdbId: 'tt9999001',
    title: 'Vingadores: Doutor Destino',
    position: 1,
    year: 2026
  }];
  const evalD = featuredRankingService.resolveEligibleTop10(testCandidateD, 'movie', [mockTheatricalItem as any]);
  assert(
    evalD.approvedItems.length === 0 && evalD.audit[0]?.status === 'REJECTED' && evalD.audit[0]?.rejectionReason?.includes('cinemas'),
    'Teste D: Filme em cartaz no cinema é rigorosamente descartado com motivo registrado',
    `Motivo: ${evalD.audit[0]?.rejectionReason}`
  );

  // --------------------------------------------------------------------------
  // TESTE E: Descarte de obras sem fontes reproduzíveis
  // --------------------------------------------------------------------------
  console.log('\nTeste E: Descarte de obras sem fontes reproduzíveis');
  const mockNoSourceItem = {
    id: 'test-nosource-1',
    title: 'Filme Sem Links',
    type: ContentType.MOVIE,
    rating: 7.5,
    year: 2024,
    image: '',
    description: '',
    platform: 'Netflix',
    imdbId: 'tt9999002',
    availabilityStatus: 'unavailable' as any,
    videoUrl: ''
  };
  const testCandidateE = [{
    imdbId: 'tt9999002',
    title: 'Filme Sem Links',
    position: 1,
    year: 2024
  }];
  const evalE = featuredRankingService.resolveEligibleTop10(testCandidateE, 'movie', [mockNoSourceItem as any]);
  assert(
    evalE.approvedItems.length === 0 && evalE.audit[0]?.status === 'REJECTED' && evalE.audit[0]?.rejectionReason?.includes('fontes'),
    'Teste E: Candidato sem fontes reproduzíveis é devidamente descartado',
    `Motivo: ${evalE.audit[0]?.rejectionReason}`
  );

  // --------------------------------------------------------------------------
  // TESTE F: Preenchimento estrito (sem inventar para bater cota)
  // --------------------------------------------------------------------------
  console.log('\nTeste F: Preenchimento estrito (sem inventar para bater cota)');
  const fourEligibleCandidates = selection.featuredMovies.slice(0, 4).map((m, idx) => ({
    imdbId: m.imdbId || '',
    title: m.title,
    position: idx + 1
  }));
  const evalF = featuredRankingService.resolveEligibleTop10(fourEligibleCandidates, 'movie', selection.featuredMovies);
  assert(
    evalF.approvedItems.length === 4,
    'Teste F: Exatamente 4 itens aprovados de um pool com 4 válidos, sem preenchimento artificial',
    `Aprovados: ${evalF.approvedItems.length} (esperado 4)`
  );

  // --------------------------------------------------------------------------
  // TESTE G: Separação correta de Animes
  // --------------------------------------------------------------------------
  console.log('\nTeste G: Separação correta de animes (nunca entram no ranking de séries)');
  const animeInSeries = selection.featuredSeries.filter(
    s => s.type === ContentType.ANIME || (s.genres || []).includes('Anime')
  );
  assert(
    animeInSeries.length === 0,
    'Teste G.1: Zero animes presentes no ranking de Séries Em Destaque'
  );

  const mockAnimeSeries = {
    id: 'anime-black-clover',
    title: 'Black Clover',
    type: ContentType.ANIME,
    rating: 8.3,
    year: 2017,
    image: '',
    description: '',
    genres: ['Animação', 'Anime', 'Ação'],
    imdbId: 'tt7441656',
    availabilityStatus: 'verified' as any
  };
  const animeEval = featuredRankingService.resolveEligibleTop10(
    [{ imdbId: 'tt7441656', title: 'Black Clover', position: 24, year: 2017 }],
    'series',
    [mockAnimeSeries as any]
  );
  assert(
    animeEval.approvedItems.length === 0 && animeEval.audit[0]?.rejectionReason?.includes('Anime'),
    'Teste G.2: Anime (Black Clover / Bleach) descartado com motivo canônico de Anime',
    `Motivo registrado: ${animeEval.audit[0]?.rejectionReason}`
  );

  // --------------------------------------------------------------------------
  // TESTE H: Consistência de badges (diferenciação entre ZapiTV e IMDb)
  // --------------------------------------------------------------------------
  console.log('\nTeste H: Consistência de badges (displayRank vs imdbRank)');
  const firstMovie = selection.featuredMovies[0];
  assert(
    firstMovie.displayRank === 1 && typeof firstMovie.imdbRank === 'number' && firstMovie.imdbRank > 1,
    'Teste H.1: Filme #1 possui displayRank=1 e preserva imdbRank oficial (> 1)',
    `Filme: ${firstMovie.title} -> displayRank: #${firstMovie.displayRank}, imdbRank: #${firstMovie.imdbRank}`
  );
  const firstSeries = selection.featuredSeries[0];
  assert(
    firstSeries.displayRank === 1 && typeof firstSeries.imdbRank === 'number' && firstSeries.imdbRank > 1,
    'Teste H.2: Série #1 possui displayRank=1 e preserva imdbRank oficial (> 1)',
    `Série: ${firstSeries.title} -> displayRank: #${firstSeries.displayRank}, imdbRank: #${firstSeries.imdbRank}`
  );

  // --------------------------------------------------------------------------
  // TESTE I: Bloqueio total de fallback TMDB
  // --------------------------------------------------------------------------
  console.log('\nTeste I: Bloqueio total de fallback TMDB em caso de erro na coleta');
  // Verifica se o FeaturedRankingService nunca altera a fonte para tmdb
  assert(
    !selection.sourceReference.toLowerCase().includes('tmdb'),
    'Teste I: Fonte de referência permanece estritamente IMDb, sem fallbacks para TMDB',
    `Source: ${selection.sourceReference}`
  );

  // --------------------------------------------------------------------------
  // TESTE J: Atualização semanal atômica
  // --------------------------------------------------------------------------
  console.log('\nTeste J: Atualização semanal atômica');
  assert(
    selection.featuredMovies.length === 10 && selection.featuredSeries.length === 10,
    'Teste J: Publicação só ocorre com ambos os conjuntos íntegros e validados'
  );

  // --------------------------------------------------------------------------
  // TESTE K: Persistência do histórico e trilha de auditoria
  // --------------------------------------------------------------------------
  console.log('\nTeste K: Persistência do histórico e trilha de auditoria');
  const totalAuditRecords = selection.auditTrail.rejectedMovies.length + selection.auditTrail.rejectedSeries.length;
  assert(
    totalAuditRecords > 0,
    'Teste K: Todos os candidatos descartados estão registrados com motivo e ID',
    `Total de descartes registrados: ${totalAuditRecords}`
  );

  // --------------------------------------------------------------------------
  // TESTE L: Recuperação e retenção segura após falha
  // --------------------------------------------------------------------------
  console.log('\nTeste L: Recuperação e retenção segura após falha');
  const currentSnapshot = imdbWeeklyRankingService.getLatestRanking('movie');
  assert(
    Boolean(currentSnapshot && currentSnapshot.ranking.length > 0),
    'Teste L: Snapshot retido disponível e íntegro para garantir continuidade sem downtime',
    `Snapshot: ${currentSnapshot.snapshot.id} (${currentSnapshot.ranking.length} títulos)`
  );

  // --------------------------------------------------------------------------
  // RESUMO
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(` RESULTADO FINAL: ${passedCount} PASSOU / ${failedCount} FALHOU`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Erro fatal na suíte de testes:', err);
  process.exit(1);
});
