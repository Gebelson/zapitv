/**
 * ZAPITV — SUÍTE DE TESTES RIGOROSOS: REESTRUTURAÇÃO DA PÁGINA EM DESTAQUE COM RANKING IMDb E DISPONIBILIDADE REAL
 */

import assert from 'assert';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { 
  ConsolidatedMonthlyRanking, 
  ConsolidatedMonthlyCandidate,
  ImdbRankItem 
} from '../src/core/rankings/featuredRankingTypes';
import { ContentItem, ContentType } from '../types';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';

console.log('================================================================');
console.log('INICIANDO SUÍTE DE TESTES: RANKING IMDb EM DESTAQUE + DISPONIBILIDADE');
console.log('================================================================\n');

// --------------------------------------------------------------------------
// TESTE 1: CENÁRIO CONTROLADO COM 100 TÍTULOS E SUBSTITUIÇÃO PROGRESSIVA (SEÇÃO 17)
// --------------------------------------------------------------------------
console.log('TESTE 1: Cenário controlado com 100 títulos e substituição progressiva...');

const mockCandidates: ConsolidatedMonthlyCandidate[] = Array.from({ length: 100 }, (_, i) => ({
  imdbId: `tt${1000000 + i}`,
  title: `Candidato ${i + 1}`,
  year: 2024,
  rankType: 'movie' as const,
  cumulativeScore: 1000 - i * 10,
  bestPosition: i + 1,
  appearancesCount: 2,
  originalPositions: [i + 1, i + 1]
}));

// Título 1: Filme em cartaz no cinema (deve ser rejeitado)
// Título 2: Título com ano futuro 2027 (deve ser rejeitado)
// Título 3: Título sem fontes (deve ser rejeitado)
// Título 4: Filme elegível com stream (APROVADO -> #1)
// Título 5: Remake ou anime divergente (deve ser rejeitado)
// Título 6: Filme elegível com stream (APROVADO -> #2)
// ... subsequentes até preencher 10
const mockCatalog: ContentItem[] = [
  // #1 - Em cartaz nos cinemas
  {
    id: 'movie-doomsday-mock',
    title: 'Vingadores: Doutor Destino',
    imdbId: 'tt1000000',
    type: ContentType.MOVIE,
    rating: 8.0,
    year: 2026,
    image: 'http://example.com/img.jpg',
    availabilityStatus: 'declared'
  },
  // #2 - Lançamento futuro (2027)
  {
    id: 'movie-future-mock',
    title: 'Candidato 2',
    imdbId: 'tt1000001',
    type: ContentType.MOVIE,
    rating: 7.5,
    year: 2027,
    image: 'http://example.com/img.jpg',
    availabilityStatus: 'declared'
  },
  // #3 - Sem fontes válidas (UNAVAILABLE_CONFIRMED)
  {
    id: 'movie-nosource-mock',
    title: 'Candidato 3',
    imdbId: 'tt1000002',
    type: ContentType.MOVIE,
    rating: 7.0,
    year: 2024,
    image: 'http://example.com/img.jpg',
    availabilityStatus: 'unavailable'
  },
  // #4 - Elegível disponível (#1 Final)
  {
    id: 'movie-valid-1',
    title: 'Candidato 4',
    imdbId: 'tt1000003',
    type: ContentType.MOVIE,
    rating: 8.5,
    year: 2024,
    image: 'http://example.com/img.jpg',
    availabilityStatus: 'verified',
    verifiedStreams: [{ name: 'Stream 1', url: 'http://example.com/stream.mp4' }]
  },
  // #5 - Divergente (Série na lista de filmes)
  {
    id: 'series-wrong-type',
    title: 'Candidato 5',
    imdbId: 'tt1000004',
    type: ContentType.SERIES,
    rating: 8.0,
    year: 2024,
    image: 'http://example.com/img.jpg',
    availabilityStatus: 'verified'
  },
  // #6 - Elegível disponível (#2 Final)
  {
    id: 'movie-valid-2',
    title: 'Candidato 6',
    imdbId: 'tt1000005',
    type: ContentType.MOVIE,
    rating: 8.1,
    year: 2024,
    image: 'http://example.com/img.jpg',
    availabilityStatus: 'verified',
    verifiedStreams: [{ name: 'Stream 2', url: 'http://example.com/stream.mp4' }]
  }
];

// Adiciona mais 15 filmes elegíveis a partir da posição 10 até 25 para testar o avanço do ranking
for (let i = 6; i < 25; i++) {
  mockCatalog.push({
    id: `movie-valid-${i + 1}`,
    title: `Candidato ${i + 1}`,
    imdbId: `tt${1000000 + i}`,
    type: ContentType.MOVIE,
    rating: 8.0,
    year: 2024,
    image: 'http://example.com/img.jpg',
    availabilityStatus: 'verified',
    verifiedStreams: [{ name: `Stream ${i + 1}`, url: `http://example.com/stream${i + 1}.mp4` }]
  });
}

const mockRanking: ConsolidatedMonthlyRanking = {
  monthKey: '2026-10',
  monthLabel: 'Outubro de 2026',
  rankType: 'movie',
  isProvisionalWeekly: false,
  snapshotsIncluded: ['snapshot-test'],
  candidates: mockCandidates
};

const result1 = featuredRankingService.resolveEligibleTop10(mockRanking, mockCatalog);

assert.strictEqual(result1.approvedItems.length, 10, 'O algoritmo deve preencher exatamente 10 vagas aprovadas');
assert.strictEqual(result1.approvedItems[0].title, 'Candidato 4', 'Primeiro aprovado deve ser o Candidato 4 (posições 1, 2 e 3 foram descartadas)');
assert.strictEqual(result1.approvedItems[1].title, 'Candidato 6', 'Segundo aprovado deve ser o Candidato 6 (posição 5 descartada)');

// Verifica que os descartados contêm os motivos corretos
const rejectedMap = new Map(result1.audit.filter(a => a.status === 'REJECTED').map(a => [a.imdbId, a.rejectionReason]));
assert.ok(rejectedMap.get('tt1000000')?.includes('cinemas'), 'Candidato 1 deve ser rejeitado por exibição cinematográfica');
assert.ok(rejectedMap.get('tt1000001')?.includes('futura'), 'Candidato 2 deve ser rejeitado por estreia futura');
assert.ok(rejectedMap.get('tt1000002')?.includes('Sem fontes'), 'Candidato 3 deve ser rejeitado por falta de fontes');
assert.ok(rejectedMap.get('tt1000004')?.includes('longa-metragem'), 'Candidato 5 deve ser rejeitado por tipo divergente');

console.log('✓ TESTE 1 PASSOU: Substituição progressiva, descarte com justificativa e preenchimento de 10 vagas validado com sucesso.\n');

// --------------------------------------------------------------------------
// TESTE 2: DESCARTE ESTRITO DE ANIMES NA CATEGORIA DE SÉRIES
// --------------------------------------------------------------------------
console.log('TESTE 2: Descarte de Animes na seção de Séries...');

const mockSeriesRanking: ConsolidatedMonthlyRanking = {
  monthKey: '2026-10',
  monthLabel: 'Outubro de 2026',
  rankType: 'series',
  isProvisionalWeekly: false,
  snapshotsIncluded: ['snapshot-series-test'],
  candidates: [
    { imdbId: 'tt0434665', title: 'Bleach', year: 2004, rankType: 'series', cumulativeScore: 100, bestPosition: 1, appearancesCount: 1, originalPositions: [1] },
    { imdbId: 'tt1063870', title: 'Fallout', year: 2024, rankType: 'series', cumulativeScore: 90, bestPosition: 2, appearancesCount: 1, originalPositions: [2] }
  ]
};

const mockSeriesCatalog: ContentItem[] = [
  {
    id: 'anime-bleach',
    title: 'Bleach',
    imdbId: 'tt0434665',
    type: ContentType.ANIME,
    rating: 8.7,
    year: 2004,
    image: 'http://example.com/bleach.jpg',
    availabilityStatus: 'verified',
    episodes: [{ id: 'ep1', number: 1, title: 'Episódio 1', description: '', image: '', videoUrl: 'http://example.com/ep1.mp4' }]
  },
  {
    id: 'series-fallout',
    title: 'Fallout',
    imdbId: 'tt1063870',
    type: ContentType.SERIES,
    rating: 8.5,
    year: 2024,
    image: 'http://example.com/fallout.jpg',
    availabilityStatus: 'verified',
    episodes: [{ id: 'ep1', number: 1, title: 'The End', description: '', image: '', videoUrl: 'http://example.com/fallout1.mp4' }]
  }
];

const result2 = featuredRankingService.resolveEligibleTop10(mockSeriesRanking, mockSeriesCatalog);
assert.strictEqual(result2.approvedItems.length, 1, 'Apenas 1 série convencional deve ser aprovada');
assert.strictEqual(result2.approvedItems[0].title, 'Fallout', 'Fallout deve ser a primeira série aprovada');

const bleachAudit = result2.audit.find(a => a.imdbId === 'tt0434665');
assert.strictEqual(bleachAudit?.status, 'REJECTED', 'Bleach deve ser rejeitado na categoria Séries');
assert.ok(bleachAudit?.rejectionReason?.includes('Anime excluído'), 'Motivo deve citar que o anime pertence à categoria Animes');

console.log('✓ TESTE 2 PASSOU: Animes são rigorosamente descartados da seção de séries convencionais.\n');

// --------------------------------------------------------------------------
// TESTE 3: CONSOLIDAÇÃO MENSAL PONDERADA DE SNAPSHOTS SEMANAIS
// --------------------------------------------------------------------------
console.log('TESTE 3: Consolidação mensal ponderada (Semana 40 + Semana 41)...');

const monthlyMovies = featuredRankingService.computeMonthlyConsolidatedRanking('2026-10', 'movie');
assert.ok(monthlyMovies.candidates.length > 0, 'Deve gerar lista de candidatos consolidados');
assert.strictEqual(monthlyMovies.monthKey, '2026-10', 'Chave do mês deve ser 2026-10');
assert.strictEqual(monthlyMovies.snapshotsIncluded.length, 2, 'Deve consolidar os 2 snapshots de outubro');

// Verifica que o primeiro candidato acumulado tem pontuação decrescente
for (let i = 0; i < monthlyMovies.candidates.length - 1; i++) {
  assert.ok(
    monthlyMovies.candidates[i].cumulativeScore >= monthlyMovies.candidates[i + 1].cumulativeScore,
    `Candidato na posição ${i} deve ter pontuação acumulada maior ou igual ao da posição ${i + 1}`
  );
}

console.log('✓ TESTE 3 PASSOU: Consolidação mensal ponderada acumula pontuações e ordena corretamente.\n');

// --------------------------------------------------------------------------
// TESTE 4: SELEÇÃO GERAL DE DESTAQUE COM O ACERVO DO ZAPITV
// --------------------------------------------------------------------------
console.log('TESTE 4: Seleção global de Em Destaque (getFeaturedSelectionSync)...');

const featuredGlobal = featuredRankingService.getFeaturedSelectionSync();
assert.ok(featuredGlobal.featuredMovies.length > 0, 'Deve conter filmes em destaque aprovados');
assert.ok(featuredGlobal.featuredMovies.length <= 10, 'Deve conter no máximo 10 filmes');
assert.ok(featuredGlobal.featuredSeries.length > 0, 'Deve conter séries em destaque aprovadas');
assert.ok(featuredGlobal.featuredSeries.length <= 10, 'Deve conter no máximo 10 séries');

// Verifica que nenhum filme aprovado é futuro ou em cartaz
for (const m of featuredGlobal.featuredMovies) {
  assert.strictEqual(m.type, ContentType.MOVIE, `Item ${m.title} deve ser um filme`);
  assert.ok(theatricalFilterService.isMovieAllowedSync(m), `Filme ${m.title} não pode estar em cartaz no cinema`);
  assert.ok(m.year <= 2026, `Filme ${m.title} não pode ter ano futuro`);
}

// Verifica que nenhuma série aprovada é anime
for (const s of featuredGlobal.featuredSeries) {
  assert.notStrictEqual(s.type, ContentType.ANIME, `Série ${s.title} não pode ser anime`);
}

console.log(`✓ TESTE 4 PASSOU: Selecionados ${featuredGlobal.featuredMovies.length} filmes e ${featuredGlobal.featuredSeries.length} séries em conformidade total.\n`);

// --------------------------------------------------------------------------
// TESTE 5: NÃO EXIGÊNCIA DE DUBLAGEM PT-BR PARA ELEGIBILIDADE
// --------------------------------------------------------------------------
console.log('TESTE 5: Aceitação de obras legendadas com áudio original...');

const subOnlyCandidate: ConsolidatedMonthlyRanking = {
  monthKey: '2026-10',
  monthLabel: 'Outubro de 2026',
  rankType: 'movie',
  isProvisionalWeekly: false,
  snapshotsIncluded: ['snap-sub'],
  candidates: [
    { imdbId: 'tt0063350', title: 'Night of the Living Dead', year: 1968, rankType: 'movie', cumulativeScore: 100, bestPosition: 1, appearancesCount: 1, originalPositions: [1] }
  ]
};

const subOnlyCatalog: ContentItem[] = [
  {
    id: 'open-night-living-dead-1968',
    title: 'A Noite dos Mortos-Vivos (1968)',
    imdbId: 'tt0063350',
    type: ContentType.MOVIE,
    rating: 7.9,
    year: 1968,
    image: 'http://example.com/img.jpg',
    availabilityStatus: 'verified',
    audioStatus: 'other', // Áudio original inglês (legendado)
    verifiedStreams: [{ name: 'Original', url: 'http://example.com/notld.webm' }]
  }
];

const result5 = featuredRankingService.resolveEligibleTop10(subOnlyCandidate, subOnlyCatalog);
assert.strictEqual(result5.approvedItems.length, 1, 'Obra com áudio original/legendado deve ser aprovada');
assert.strictEqual(result5.audit[0].status, 'APPROVED', 'Status da auditoria deve ser APPROVED');

console.log('✓ TESTE 5 PASSOU: Obras com áudio original/legendadas são aceitas quando têm fonte reproduzível.\n');

console.log('================================================================');
console.log('TODOS OS 5 TESTES DE RANKINGS EM DESTAQUE PASSARAM COM SUCESSO!');
console.log('================================================================');
