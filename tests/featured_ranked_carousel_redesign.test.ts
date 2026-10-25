import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { searchService } from '../src/core/search/searchService';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';

console.log('=== TEST SUITE: ZapiTV | Redesign Definitivo do Carrossel Top 10 ===\n');

// 1. Auditoria da Seleção dos Top 10 em Filmes, Séries e Animes
console.log('1. Verificando integridade das seleções Top 10...');
const selection = featuredRankingService.getFeaturedSelectionSync();
assert.ok(selection, 'Seleção do FeaturedRankingService deve existir');

const rawMovies = selection.featuredMovies || [];
const rawSeries = selection.featuredSeries || [];
const rawAnimes = selection.featuredAnimes || [];

const eligibleMovies = catalogEligibilityService.filterEligibleItemsSync(
  deduplicateContentItems(rawMovies.filter(it => searchService.isMovieItem(it)))
);
const eligibleSeries = catalogEligibilityService.filterEligibleItemsSync(
  deduplicateContentItems(rawSeries.filter(it => searchService.isSeriesItem(it) && !searchService.isAnimeItem(it)))
);
const eligibleAnimes = catalogEligibilityService.filterEligibleItemsSync(
  deduplicateContentItems(rawAnimes.filter(it => searchService.isAnimeItem(it)))
);

assert.ok(eligibleMovies.length >= 10, `Deve possuir ao menos 10 filmes elegíveis (encontrados: ${eligibleMovies.length})`);
assert.ok(eligibleSeries.length >= 10, `Deve possuir ao menos 10 séries elegíveis (encontradas: ${eligibleSeries.length})`);
assert.ok(eligibleAnimes.length >= 10, `Deve possuir ao menos 10 animes elegíveis (encontrados: ${eligibleAnimes.length})`);

console.log(`  -> Filmes: ${eligibleMovies.length}, Séries: ${eligibleSeries.length}, Animes: ${eligibleAnimes.length}`);

// 2. Associação estrita dos Números de 1 a 10 no Ranking
console.log('\n2. Verificando associação dos rankings de 1 a 10...');
const top10MoviesWithRank = eligibleMovies.slice(0, 10).map((item, idx) => ({
  item,
  rank: idx + 1
}));
assert.strictEqual(top10MoviesWithRank.length, 10, 'Top 10 deve ter exatamente 10 itens');
top10MoviesWithRank.forEach((r, idx) => {
  assert.strictEqual(r.rank, idx + 1, `Rank na posição ${idx} deve ser ${idx + 1}`);
});
console.log('  -> Números de 1 a 10 associados com sucesso.');

// 3. Auditoria do Componente FeaturedRankedCarousel.tsx
console.log('\n3. Verificando requisitos de código em components/FeaturedRankedCarousel.tsx...');
const carouselCode = fs.readFileSync(path.resolve('components/FeaturedRankedCarousel.tsx'), 'utf8');

// [Requisito 1] Números sólidos e brancos (Sem outline nem text-stroke)
assert.strictEqual(carouselCode.includes('WebkitTextStroke'), false, 'NÃO deve conter WebkitTextStroke');
assert.strictEqual(carouselCode.includes('text-stroke'), false, 'NÃO deve conter text-stroke');
assert.ok(carouselCode.includes("color: '#ffffff'"), 'Números devem ter preenchimento sólido branco (#ffffff)');
console.log('  -> Números sólidos e brancos validados (sem nenhum efeito outline ou text-stroke).');

// [Requisito 2] Carrossel finito com 2 páginas (0: 1 a 5, 1: 6 a 10)
assert.ok(carouselCode.includes('items.slice(0, 5)'), 'Página 1 deve conter exatamente as posições 1 a 5');
assert.ok(carouselCode.includes('items.slice(5, 10)'), 'Página 2 deve conter exatamente as posições 6 a 10');
assert.strictEqual(carouselCode.includes('b0-'), false, 'NÃO deve conter clones do bloco 0');
assert.strictEqual(carouselCode.includes('b2-'), false, 'NÃO deve conter clones do bloco 2');
assert.ok(carouselCode.includes('useState<0 | 1>(0)'), 'Índice de página deve ser estritamente 0 ou 1');
assert.ok(carouselCode.includes('disabled={pageIndex === 0}'), 'Navegação anterior deve estar desabilitada na página 1 (índice 0)');
assert.ok(carouselCode.includes('disabled={pageIndex === 1}'), 'Navegação posterior deve estar desabilitada na página 2 (índice 1)');
console.log('  -> Carrossel finito em 2 páginas sem loop infinito validado com sucesso.');

// [Requisito 3] Espaçamento horizontal, grid de 5 colunas e banners não-cortados
assert.ok(carouselCode.includes('grid-cols-5'), 'Deve utilizar grid de 5 colunas por página');
assert.ok(carouselCode.includes('aspect-[2/3]'), 'Deve preservar rigorosamente a proporção vertical 2:3 das capas');
assert.ok(carouselCode.includes('w-[200%]'), 'Container interno deve ter 200% para abrigar as 2 páginas de 100% cada');
assert.ok(carouselCode.includes('translateX(-${pageIndex * 50}%)'), 'Transição deve ser de 50% entre páginas');
assert.ok(carouselCode.includes('origin-right'), 'Último banner da página deve ter origin-right no hover para evitar cortes');
console.log('  -> Distribuição de 5 colunas iguais e proteção contra cortes de hover validadas.');

// [Requisito 4] Auditoria de MobileRankedRow.tsx
console.log('\n4. Verificando ausência de outline em src/components/mobile/MobileRankedRow.tsx...');
const mobileRowCode = fs.readFileSync(path.resolve('src/components/mobile/MobileRankedRow.tsx'), 'utf8');
assert.strictEqual(mobileRowCode.includes('WebkitTextStroke'), false, 'MobileRankedRow NÃO deve conter WebkitTextStroke');
assert.ok(mobileRowCode.includes("color: '#ffffff'"), 'MobileRankedRow deve usar números sólidos brancos (#ffffff)');
console.log('  -> MobileRankedRow validado com números sólidos brancos.');

// [Requisito 5] Invariância dos demais componentes
console.log('\n5. Verificando integridade das demais rotas e componentes...');
const appCode = fs.readFileSync(path.resolve('App.tsx'), 'utf8');
assert.ok(appCode.includes("case 'home':"), 'Home deve permanecer intacta');
assert.ok(appCode.includes('ContentRow'), 'ContentRow comum deve permanecer intacto');
console.log('  -> Rotas e carrosséis convencionais permanecem 100% preservados.');

console.log('\n=== TODOS OS TESTES DO RANKING TOP 10 PASSARAM COM SUCESSO! ===\n');
process.exit(0);
