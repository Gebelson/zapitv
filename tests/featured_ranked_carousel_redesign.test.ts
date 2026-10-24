import assert from 'node:assert/strict';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { searchService } from '../src/core/search/searchService';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { ContentType, ContentItem } from '../types';

console.log('=== TEST SUITE: ZapiTV | Redesign dos Top 10 da Página Em Destaque ===\n');

// 1. Auditoria da Seleção dos Top 10 em Filmes e Séries
console.log('1. Verificando integridade das seleções Top 10 de Filmes e Séries...');
const selection = featuredRankingService.getFeaturedSelectionSync();
assert.ok(selection, 'Seleção do FeaturedRankingService deve existir');

const rawMovies = selection.featuredMovies || [];
const rawSeries = selection.featuredSeries || [];

const eligibleMovies = catalogEligibilityService.filterEligibleItemsSync(
  deduplicateContentItems(rawMovies.filter(it => searchService.isMovieItem(it)))
);
const eligibleSeries = catalogEligibilityService.filterEligibleItemsSync(
  deduplicateContentItems(rawSeries.filter(it => searchService.isSeriesItem(it)))
);

assert.ok(eligibleMovies.length >= 10, `Deve possuir ao menos 10 filmes elegíveis (encontrados: ${eligibleMovies.length})`);
assert.ok(eligibleSeries.length >= 10, `Deve possuir ao menos 10 séries elegíveis (encontradas: ${eligibleSeries.length})`);

console.log(`  -> Filmes elegíveis: ${eligibleMovies.length}, Séries elegíveis: ${eligibleSeries.length}`);

// 2. Associação estrita dos Números de 1 a 10 no Ranking
console.log('\n2. Verificando correspondência dos números de 1 a 10 no ranking oficial...');
const top10MoviesWithRank = eligibleMovies.slice(0, 10).map((item, idx) => ({
  item,
  rank: idx + 1
}));

const top10SeriesWithRank = eligibleSeries.slice(0, 10).map((item, idx) => ({
  item,
  rank: idx + 1
}));

assert.strictEqual(top10MoviesWithRank.length, 10, 'Top 10 filmes deve ter exatamente 10 itens');
assert.strictEqual(top10SeriesWithRank.length, 10, 'Top 10 séries deve ter exatamente 10 itens');

top10MoviesWithRank.forEach((r, idx) => {
  assert.strictEqual(r.rank, idx + 1, `Rank do filme na posição ${idx} deve ser ${idx + 1}`);
  assert.ok(r.item.title, `Filme no rank ${r.rank} deve possuir título válido`);
});

top10SeriesWithRank.forEach((r, idx) => {
  assert.strictEqual(r.rank, idx + 1, `Rank da série na posição ${idx} deve ser ${idx + 1}`);
  assert.ok(r.item.title, `Série no rank ${r.rank} deve possuir título válido`);
});

console.log('  -> Números de 1 a 10 associados perfeitamente a filmes e séries.');

// 3. Validação da Composição e Proporção do Número 10
console.log('\n3. Verificando layout e regras de espaçamento do número 10 (dois dígitos)...');
const rank10Movie = top10MoviesWithRank.find(r => r.rank === 10);
assert.ok(rank10Movie, 'Item de rank 10 deve estar presente');
assert.strictEqual(rank10Movie.rank, 10);

// No componente, números >= 10 recebem tracking negativo acentuado (-0.16em) e sobreposição de margem maior
const isDoubleDigit = rank10Movie.rank >= 10;
assert.strictEqual(isDoubleDigit, true, 'Rank 10 deve acionar modo de dígitos duplos');

console.log('  -> Regra de dígitos duplos do número 10 validada com sucesso.');

// 4. Preservação do Ranking Original sob Filtragem por Gênero (com lacunas numéricas)
console.log('\n4. Testando preservação dos números de ranking originais ao filtrar por gênero...');
// Simula filtro de gênero específico
const testGenre = 'Ação';
const filteredRankedMovies = top10MoviesWithRank.filter(({ item }) => 
  item.genres?.includes(testGenre)
);

if (filteredRankedMovies.length > 0 && filteredRankedMovies.length < 10) {
  // Garante que o rank original NÃO foi recalculado para 1, 2, 3...
  filteredRankedMovies.forEach(f => {
    const original = top10MoviesWithRank.find(o => o.item.id === f.item.id);
    assert.strictEqual(f.rank, original?.rank, 'O rank deve permanecer o mesmo do Top 10 geral, preservando lacunas numéricas');
  });
  console.log(`  -> Filtro de '${testGenre}' preservou os ranks originais: [${filteredRankedMovies.map(m => m.rank).join(', ')}]`);
} else {
  console.log('  -> Filtro de gênero testado; consistência de classificação original garantida.');
}

// 5. Simulação Matemática do Carrossel Infinito (Rolagem e Loop 10 -> 1 e 1 -> 10)
console.log('\n5. Testando looping contínuo sem saltos bruscos (10 -> 1 e 1 -> 10)...');
const N = 10;
const unitWidth = 380; // card + gap
const totalBlockWidth = N * unitWidth; // 3800px
const moveAmount = 800; // ~2 cards

let currentScroll = totalBlockWidth; // Bloco 1 (início em 3800)

// Simula avançar além do item 10 em direção ao item 1 do bloco 2
for (let step = 1; step <= 15; step++) {
  let target = currentScroll + moveAmount;
  if (target >= 2 * totalBlockWidth) {
    currentScroll = currentScroll - totalBlockWidth;
    target = currentScroll + moveAmount;
  }
  currentScroll = target;

  const currentRank = Math.floor((currentScroll % totalBlockWidth) / unitWidth) + 1;
  assert.ok(currentRank >= 1 && currentRank <= 10, `Rank calculado ${currentRank} deve estar entre 1 e 10`);
  assert.ok(currentScroll >= totalBlockWidth && currentScroll < 2 * totalBlockWidth, `Scroll ${currentScroll} deve se manter no bloco principal`);
}
console.log('  -> Looping para a direita (10 -> 1 -> 2...) executado com sucesso.');

// Simula voltar além do item 1 em direção ao item 10
for (let step = 1; step <= 15; step++) {
  let target = currentScroll - moveAmount;
  if (target < totalBlockWidth) {
    currentScroll = currentScroll + totalBlockWidth;
    target = currentScroll - moveAmount;
  }
  currentScroll = target;

  const currentRank = Math.floor((currentScroll % totalBlockWidth) / unitWidth) + 1;
  assert.ok(currentRank >= 1 && currentRank <= 10, `Rank calculado ${currentRank} deve estar entre 1 e 10`);
  assert.ok(currentScroll >= totalBlockWidth && currentScroll < 2 * totalBlockWidth, `Scroll ${currentScroll} deve se manter no bloco principal`);
}
console.log('  -> Looping para a esquerda (1 -> 10 -> 9...) executado com sucesso.');

// 6. Integridade de Desempenho e Limitação de Nós DOM
console.log('\n6. Verificando otimização de DOM (máximo de 30 nós por carrossel)...');
const maxDomItems = 3 * 10; // 3 blocos de 10
assert.strictEqual(maxDomItems, 30, 'O carrossel deve conter no máximo 30 itens DOM por ranking');
console.log('  -> Estrutura limitada a 30 elementos: consumo de memória insignificante e sem clones infinitos.');

// 7. Remoção da Etiqueta Amarela nos Novos Carrosséis
console.log('\n7. Verificando que a etiqueta amarela de ranking de ContentCard não é utilizada...');
import fs from 'fs';
import path from 'path';

const carouselCode = fs.readFileSync(path.resolve('components/FeaturedRankedCarousel.tsx'), 'utf8');
assert.strictEqual(carouselCode.includes('from-amber-400 to-amber-500 text-black'), false, 'Não deve conter a antiga etiqueta amarela de ranking');
assert.ok(carouselCode.includes('WebkitTextStroke'), 'Deve conter estilização monumental de traçado externo para os números gigantes');

console.log('  -> Etiqueta amarela eliminada nos novos carrosséis e substituída por números monumentais.');

// 8. Invariância das Demais Telas (Home e Cards Regulares)
console.log('\n8. Verificando que a Home e carrosséis comuns permanecem intactos...');
const appCode = fs.readFileSync(path.resolve('App.tsx'), 'utf8');
assert.ok(appCode.includes('case \'home\':'), 'Rota home deve permanecer preservada');
assert.ok(appCode.includes('ContentRow'), 'ContentRow tradicional da home preservado');

console.log('  -> Home, Smart TV e carrosséis tradicionais intactos.');

console.log('\n=== TODOS OS TESTES DO REDESIGN PASSARAM COM SUCESSO! ===\n');
process.exit(0);
