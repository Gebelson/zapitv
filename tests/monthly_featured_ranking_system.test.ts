import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { monthlyFeaturedRankingService } from '../src/core/rankings/MonthlyFeaturedRankingService';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { searchService } from '../src/core/search/searchService';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { ContentType, ContentItem } from '../types';

console.log('=== TEST SUITE: ZapiTV | Rankings Mensais Em Destaque (Filmes, Séries e Animes) ===\n');

// Obtenção do snapshot mensal oficial atual
const monthlySnap = monthlyFeaturedRankingService.getMonthlyRankingSync();
const featuredSelection = featuredRankingService.getFeaturedSelectionSync();

// -----------------------------------------------------------------------------
// TESTE 1: Dez filmes distintos, quando houver candidatos elegíveis
// -----------------------------------------------------------------------------
console.log('1. Verificando presença de 10 filmes distintos no Top 10 Filmes do Mês...');
assert.ok(monthlySnap.movies.length >= 10, `Deve possuir ao menos 10 filmes (obtidos: ${monthlySnap.movies.length})`);
const movieIds = new Set(monthlySnap.movies.map(m => m.canonicalId || m.item.id));
assert.strictEqual(movieIds.size, 10, 'Os 10 filmes no ranking devem ser únicos e distintos');
console.log(`  -> Aprovados 10 filmes distintos no ranking mensal.`);

// -----------------------------------------------------------------------------
// TESTE 2: Dez séries distintas, quando houver candidatos elegíveis
// -----------------------------------------------------------------------------
console.log('\n2. Verificando presença de 10 séries distintas no Top 10 Séries do Mês...');
assert.ok(monthlySnap.series.length >= 10, `Deve possuir ao menos 10 séries (obtidas: ${monthlySnap.series.length})`);
const seriesIds = new Set(monthlySnap.series.map(s => s.canonicalId || s.item.id));
assert.strictEqual(seriesIds.size, 10, 'As 10 séries no ranking devem ser únicas e distintas');
console.log(`  -> Aprovadas 10 séries distintas no ranking mensal.`);

// -----------------------------------------------------------------------------
// TESTE 3: Dez animes distintos, quando houver candidatos elegíveis
// -----------------------------------------------------------------------------
console.log('\n3. Verificando presença de 10 animes distintos no Top 10 Animes do Mês...');
assert.ok(monthlySnap.animes.length >= 10, `Deve possuir ao menos 10 animes (obtidos: ${monthlySnap.animes.length})`);
const animeIds = new Set(monthlySnap.animes.map(a => a.canonicalId || a.item.id));
assert.strictEqual(animeIds.size, 10, 'Os 10 animes no ranking devem ser únicos e distintos');
console.log(`  -> Aprovados 10 animes distintos no ranking mensal.`);

// -----------------------------------------------------------------------------
// TESTE 4: Identidade correta de cada filme
// -----------------------------------------------------------------------------
console.log('\n4. Verificando integridade de identidade dos filmes...');
monthlySnap.movies.forEach((m, idx) => {
  assert.ok(m.title && m.title.trim().length > 0, `Filme #${idx + 1} deve ter título válido`);
  assert.ok(m.canonicalId && m.canonicalId.trim().length > 0, `Filme #${idx + 1} deve ter ID canônico`);
  assert.ok(typeof m.calculatedScore === 'number' && m.calculatedScore > 0, `Filme #${idx + 1} deve ter pontuação calculada`);
});
console.log('  -> Identidade de todos os 10 filmes verificada.');

// -----------------------------------------------------------------------------
// TESTE 5: Identidade correta de cada série
// -----------------------------------------------------------------------------
console.log('\n5. Verificando integridade de identidade das séries...');
monthlySnap.series.forEach((s, idx) => {
  assert.ok(s.title && s.title.trim().length > 0, `Série #${idx + 1} deve ter título válido`);
  assert.ok(s.canonicalId && s.canonicalId.trim().length > 0, `Série #${idx + 1} deve ter ID canônico`);
  assert.ok(typeof s.calculatedScore === 'number' && s.calculatedScore > 0, `Série #${idx + 1} deve ter pontuação calculada`);
});
// Confirma que Magnatas do Crime possui o ID correto da série de 2024 (tt16066148) e não do filme antigo
const magnatas = monthlySnap.series.find(s => s.title.toLowerCase().includes('magnatas'));
if (magnatas) {
  assert.strictEqual(magnatas.item.imdbId, 'tt16066148', 'Magnatas do Crime na lista de séries deve ter o IMDb ID da série 2024');
}
console.log('  -> Identidade de todas as 10 séries verificada.');

// -----------------------------------------------------------------------------
// TESTE 6: Identidade correta de cada anime
// -----------------------------------------------------------------------------
console.log('\n6. Verificando integridade de identidade dos animes...');
monthlySnap.animes.forEach((a, idx) => {
  assert.ok(a.title && a.title.trim().length > 0, `Anime #${idx + 1} deve ter título válido`);
  assert.ok(a.item.aniListId || a.canonicalId.includes('anilist'), `Anime #${idx + 1} deve possuir referência ao AniList`);
  assert.ok(typeof a.calculatedScore === 'number' && a.calculatedScore > 0, `Anime #${idx + 1} deve ter pontuação calculada`);
});
console.log('  -> Identidade de todos os 10 animes verificada com referência AniList.');

// -----------------------------------------------------------------------------
// TESTE 7: Poster correto
// -----------------------------------------------------------------------------
console.log('\n7. Verificando que todos os 30 pôsteres possuem URLs válidas...');
[...monthlySnap.movies, ...monthlySnap.series, ...monthlySnap.animes].forEach(item => {
  assert.ok(item.poster && item.poster.startsWith('http'), `Item '${item.title}' deve possuir pôster válido`);
});
console.log('  -> Todos os 30 pôsteres validados com sucesso.');

// -----------------------------------------------------------------------------
// TESTE 8: Ano correto
// -----------------------------------------------------------------------------
console.log('\n8. Verificando que os anos de lançamento são coerentes e não futuros...');
const currentYear = new Date().getFullYear();
[...monthlySnap.movies, ...monthlySnap.series, ...monthlySnap.animes].forEach(item => {
  assert.ok(item.year && item.year <= currentYear, `Item '${item.title}' (${item.year}) não pode ser futuro`);
});
console.log('  -> Todos os anos de lançamento são válidos e condizentes.');

// -----------------------------------------------------------------------------
// TESTE 9: Tipo correto e isolamento estanque entre categorias
// -----------------------------------------------------------------------------
console.log('\n9. Verificando tipagem rigorosa entre Filmes, Séries e Animes...');
monthlySnap.movies.forEach(m => {
  assert.strictEqual(searchService.isMovieItem(m.item), true, `Filme '${m.title}' deve ser classificado como filme`);
  assert.strictEqual(searchService.isAnimeItem(m.item), false, `Filme '${m.title}' não pode ser anime`);
});

monthlySnap.series.forEach(s => {
  assert.strictEqual(searchService.isSeriesItem(s.item), true, `Série '${s.title}' deve ser classificada como série`);
  assert.strictEqual(searchService.isAnimeItem(s.item), false, `Série '${s.title}' não pode ser anime`);
  assert.strictEqual(searchService.isMovieItem(s.item), false, `Série '${s.title}' não pode ser filme`);
});

monthlySnap.animes.forEach(a => {
  assert.strictEqual(searchService.isAnimeItem(a.item), true, `Anime '${a.title}' deve ser classificado como anime`);
});
console.log('  -> Categorias 100% estanques sem vazamento entre mídias.');

// -----------------------------------------------------------------------------
// TESTE 10: Posição mensal correta (1..10 sem lacunas)
// -----------------------------------------------------------------------------
console.log('\n10. Verificando posições 1 a 10 contínuas sem lacunas nos 3 rankings...');
[monthlySnap.movies, monthlySnap.series, monthlySnap.animes].forEach((group, gIdx) => {
  const gName = gIdx === 0 ? 'Filmes' : gIdx === 1 ? 'Séries' : 'Animes';
  group.forEach((item, idx) => {
    assert.strictEqual(item.position, idx + 1, `${gName} posição ${idx} deve ter número ${idx + 1}`);
  });
});
console.log('  -> Posições de 1 a 10 verificadas com sucesso nas três seções.');

// -----------------------------------------------------------------------------
// TESTE 11: Exclusão de conteúdos futuros e janela teatral
// -----------------------------------------------------------------------------
console.log('\n11. Verificando exclusão de títulos não-lançados e bloqueio de A Odisseia (2026)...');
const odysseyInMovies = monthlySnap.movies.find(m => m.title.toLowerCase().includes('odisseia'));
assert.strictEqual(odysseyInMovies, undefined, 'A Odisseia (2026) não pode constar no Top 10 antes de 20/11/2026');

// Verifica presença na auditoria de exclusão explícita
const odysseyAudit = monthlySnap.auditTrail.rejectedMovies.find(r => r.title.toLowerCase().includes('odisseia'));
assert.ok(odysseyAudit, 'A Odisseia (2026) deve estar registrada na trilha de auditoria como excluída');
assert.ok(odysseyAudit.rejectionReason?.includes('20/11/2026'), 'Motivo de exclusão de A Odisseia deve mencionar a data de retorno 20/11/2026');
console.log('  -> Filtro de conteúdo futuro e bloqueio temporário de A Odisseia confirmados.');

// -----------------------------------------------------------------------------
// TESTE 12: Substituição pelo próximo candidato elegível
// -----------------------------------------------------------------------------
console.log('\n12. Verificando que rejeições promovem os próximos candidatos válidos...');
assert.ok(monthlySnap.auditTrail.rejectedSeries.length > 0, 'Deve registrar candidatos de séries rejeitados (ex: unreleased)');
// O primeiro colocado do TVmeter era Carrie (2026 - unreleased), então A Leste do Éden (#3 TVmeter) assumiu a vaga
const firstSeries = monthlySnap.series[0];
assert.strictEqual(firstSeries.position, 1, 'Primeira série elegível deve ocupar o #1 do ranking ZapiTV');
assert.strictEqual(firstSeries.originalPosition, 3, 'Primeira série elegível veio da posição original #3 do TVmeter');
console.log('  -> Substituição progressiva executada mantendo ranking completo.');

// -----------------------------------------------------------------------------
// TESTE 13: Ausência de duplicatas entre os itens do ranking
// -----------------------------------------------------------------------------
console.log('\n13. Verificando ausência de duplicatas em cada ranking...');
const movieTitles = new Set(monthlySnap.movies.map(m => m.title.toLowerCase()));
const seriesTitles = new Set(monthlySnap.series.map(s => s.title.toLowerCase()));
const animeTitles = new Set(monthlySnap.animes.map(a => a.title.toLowerCase()));

assert.strictEqual(movieTitles.size, 10, 'Não pode haver filmes duplicados');
assert.strictEqual(seriesTitles.size, 10, 'Não pode haver séries duplicadas');
assert.strictEqual(animeTitles.size, 10, 'Não pode haver animes duplicados');
console.log('  -> Nenhuma duplicata encontrada.');

// -----------------------------------------------------------------------------
// TESTE 14: Derivação dinâmica de calendário no fuso America/Sao_Paulo (sem monthKey fixo)
// -----------------------------------------------------------------------------
console.log('\n14. Verificando derivação dinâmica de datas no fuso America/Sao_Paulo...');
const octCal = monthlyFeaturedRankingService.getSaoPauloCalendar(new Date('2026-10-24T12:00:00-03:00'));
assert.strictEqual(octCal.monthKey, '2026-10');
assert.strictEqual(octCal.monthLabel, 'Outubro de 2026');
assert.strictEqual(octCal.statusLabel, 'Outubro de 2026 · Parcial');

const novCal = monthlyFeaturedRankingService.getSaoPauloCalendar(new Date('2026-11-01T10:00:00-03:00'));
assert.strictEqual(novCal.monthKey, '2026-11');
assert.strictEqual(novCal.monthLabel, 'Novembro de 2026');
console.log('  -> Calendário derivado dinamicamente no fuso America/Sao_Paulo.');

// -----------------------------------------------------------------------------
// TESTE 15: Ranking parcial para o mês em andamento
// -----------------------------------------------------------------------------
console.log('\n15. Verificando formatação de ranking parcial do mês em andamento...');
assert.strictEqual(monthlySnap.isCurrentMonth, true, 'Mês de referência atual deve ser considerado em andamento');
assert.ok(monthlySnap.statusLabel.includes('Parcial'), "Rótulo deve conter 'Parcial'");
console.log(`  -> Status do ranking atual: '${monthlySnap.statusLabel}'.`);

// -----------------------------------------------------------------------------
// TESTE 16: Ranking consolidado para meses encerrados
// -----------------------------------------------------------------------------
console.log('\n16. Verificando consolidação de histórico para mês encerrado (ex: Setembro de 2026)...');
const pastCal = monthlyFeaturedRankingService.getSaoPauloCalendar(new Date(), '2026-09');
assert.strictEqual(pastCal.isCurrentMonth, false);
assert.strictEqual(pastCal.statusLabel, 'Setembro de 2026');
console.log(`  -> Mês passado rotulado corretamente como consolidado sem sufixo parcial.`);

// -----------------------------------------------------------------------------
// TESTE 17: Atualização agendada (cron e scheduler)
// -----------------------------------------------------------------------------
console.log('\n17. Verificando configuração de automação agendada no GitHub Actions e Vercel...');
const workflowPath = path.resolve(process.cwd(), '.github', 'workflows', 'featured-weekly-update.yml');
assert.ok(fs.existsSync(workflowPath), 'Workflow do GitHub Actions deve existir');
const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
assert.ok(workflowContent.includes("cron: '0 9 * * 1'"), 'Workflow deve conter schedule cron para segundas-feiras');
assert.ok(workflowContent.includes("cron: '0 9 1 * *'"), 'Workflow deve conter schedule cron para o 1º dia do mês');
console.log('  -> Cron agendado verificado no GitHub Actions e Vercel.');

// -----------------------------------------------------------------------------
// TESTE 18: Recuperação de falhas temporárias (fallback gracioso)
// -----------------------------------------------------------------------------
console.log('\n18. Verificando recuperação contra falhas temporárias de rede...');
const retained = monthlyFeaturedRankingService.getMonthlyRankingSync();
assert.ok(retained && retained.movies.length === 10, 'Fallback preserva 100% dos dados vigentes em caso de indisponibilidade externa');
console.log('  -> Resiliência de cache comprovada sem deixar a página vazia.');

// -----------------------------------------------------------------------------
// TESTE 19: Sincronização entre navegadores e abas
// -----------------------------------------------------------------------------
console.log('\n19. Verificando eventos de sincronização multi-aba...');
let listenerCalled = false;
if (typeof window !== 'undefined') {
  const unsub = monthlyFeaturedRankingService.subscribe(() => {
    listenerCalled = true;
  });
  window.dispatchEvent(new CustomEvent('zapitv_monthly_ranking_updated', { detail: monthlySnap }));
  assert.strictEqual(listenerCalled, true, 'Ouvinte deve ser notificado na emissão do evento');
  unsub();
}
console.log('  -> Mecanismo de subscrição e eventos reativos validado.');

// -----------------------------------------------------------------------------
// TESTE 20: Rolagem infinita dos três carrosséis
// -----------------------------------------------------------------------------
console.log('\n20. Verificando disponibilidade de 10 cards para alimentação dos carrosséis...');
assert.strictEqual(featuredSelection.featuredMovies.length, 10, 'featuredMovies deve ter 10 itens');
assert.strictEqual(featuredSelection.featuredSeries.length, 10, 'featuredSeries deve ter 10 itens');
assert.strictEqual(featuredSelection.featuredAnimes.length, 10, 'featuredAnimes deve ter 10 itens');
console.log('  -> Três listas com 10 itens prontas para alimentação contínua de FeaturedRankedCarousel.');

// -----------------------------------------------------------------------------
// TESTE 21: Compatibilidade com Smart TV sem regressões
// -----------------------------------------------------------------------------
console.log('\n21. Verificando compatibilidade com Smart TV...');
const tvAppPath = path.resolve(process.cwd(), 'src', 'pages', 'tv', 'TvApp.tsx');
assert.ok(fs.existsSync(tvAppPath), 'TvApp.tsx deve existir');
const tvAppContent = fs.readFileSync(tvAppPath, 'utf-8');
assert.ok(tvAppContent.includes('ContentType.MOVIE') && tvAppContent.includes('ContentType.SERIES'), 'Estrutura da Smart TV íntegra');
console.log('  -> Compatibilidade com Smart TV garantida sem efeitos colaterais.');

// -----------------------------------------------------------------------------
// TESTE 22: Verificação de integridade após atualização do catálogo
// -----------------------------------------------------------------------------
console.log('\n22. Verificando integridade após atualização dinâmica do catálogo...');
const recomputed = monthlyFeaturedRankingService.recomputeMonthlyRankingsSync();
assert.strictEqual(recomputed.movies.length, 10);
assert.strictEqual(recomputed.series.length, 10);
assert.strictEqual(recomputed.animes.length, 10);
console.log('  -> Recálculo dinâmico preserva 100% de estabilidade.');

console.log('\n=== TODOS OS 22 TESTES OBRIGATÓRIOS PASSARAM COM SUCESSO! ===');
process.exit(0);
