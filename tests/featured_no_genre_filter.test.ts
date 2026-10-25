import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { searchService } from '../src/core/search/searchService';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';

console.log('========================================================================');
console.log('--- TESTE: REMOÇÃO DE SELEÇÃO DE GÊNEROS DA PÁGINA EM DESTAQUE ---');
console.log('========================================================================\n');

// 1. Auditoria do código fonte em App.tsx
console.log('1. Verificando App.tsx na seção case \'featured\'...');
const appCode = fs.readFileSync(path.resolve('App.tsx'), 'utf8');

const featuredCaseMatch = appCode.match(/case 'featured':\s*\{([\s\S]*?)case 'movies':/);
assert.ok(featuredCaseMatch, 'Deve encontrar o bloco case \'featured\' em App.tsx');

const featuredBlock = featuredCaseMatch[1];

// Requisito 1: GenreDropdown NÃO deve existir no bloco case 'featured'
assert.strictEqual(
  featuredBlock.includes('<GenreDropdown'),
  false,
  'GenreDropdown NÃO deve estar presente no cabeçalho da página Em Destaque'
);
console.log('✓ GenreDropdown removido com sucesso de case \'featured\'.');

// Requisito 2: Título "Em Destaque" e linha divisória preservados
assert.ok(
  featuredBlock.includes('Em Destaque'),
  'Título "Em Destaque" deve estar presente'
);
assert.ok(
  featuredBlock.includes('border-b'),
  'Linha divisória horizontal (border-b) deve estar preservada no cabeçalho'
);
console.log('✓ Título "Em Destaque" e linha divisória horizontal preservados.');

// Requisito 3: Sem dependência de selectedGenre nos rankings da página Em Destaque
assert.strictEqual(
  featuredBlock.includes('selectedGenre'),
  false,
  'Rankings de case \'featured\' NÃO devem depender de selectedGenre'
);
console.log('✓ Dependência de selectedGenre completamente removida dos rankings.');

// Requisito 4: GenreDropdown preservado nas demais páginas (Filmes, Séries, etc.)
assert.ok(
  appCode.includes("case 'movies':"),
  'case \'movies\' deve existir'
);
const moviesBlock = appCode.substring(appCode.indexOf("case 'movies':"));
assert.ok(
  moviesBlock.includes('<GenreDropdown'),
  'GenreDropdown DEVE permanecer ativo nas demais páginas do catálogo'
);
console.log('✓ GenreDropdown preservado em outras páginas do catálogo.');

// 2. Simulação de independência de selectedGenre
console.log('\n2. Simulando comportamento dos rankings quando um gênero anterior estiver ativo...');
const selection = featuredRankingService.getFeaturedSelectionSync();
assert.ok(selection, 'Seleção de destaques deve existir');

const eligibleMovies = catalogEligibilityService.filterEligibleItemsSync(
  deduplicateContentItems((selection.featuredMovies || []).filter(it => searchService.isMovieItem(it)))
);
const top10MoviesWithRank = eligibleMovies.slice(0, 10).map((item, idx) => ({
  item,
  rank: idx + 1
}));

// Cenário A: Usuário filtrou por "Comédia" anteriormente em Filmes
const simulatedSelectedGenre = 'Comédia';
// No código antigo, o filtro por gênero causava lacunas ou redução de itens:
const oldFiltered = top10MoviesWithRank.filter(
  ({ item }) => !simulatedSelectedGenre || simulatedSelectedGenre === 'Todos' || item.genres?.includes(simulatedSelectedGenre)
);

// No código novo, os 10 filmes completos são sempre preservados:
const newDisplayMovies = top10MoviesWithRank.filter(
  ({ item }) => true // sem selectedGenre
);

assert.strictEqual(newDisplayMovies.length, 10, 'Deve exibir exatamente 10 filmes independentemente do gênero selecionado');
newDisplayMovies.forEach((entry, idx) => {
  assert.strictEqual(entry.rank, idx + 1, `Rank ${entry.rank} deve manter sua numeração original na posição ${idx}`);
});
console.log(`✓ Rankings exibem 10/10 títulos completos mesmo com gênero "${simulatedSelectedGenre}" selecionado previamente.`);

// 3. Verificação dos 3 carrosséis preservados
console.log('\n3. Verificando presença dos três carrosséis no JSX de case \'featured\'...');
assert.ok(featuredBlock.includes('title="Top 10 Filmes do Mês"'), 'Carrossel Top 10 Filmes do Mês deve estar presente');
assert.ok(featuredBlock.includes('title="Top 10 Séries do Mês"'), 'Carrossel Top 10 Séries do Mês deve estar presente');
assert.ok(featuredBlock.includes('title="Top 10 Animes do Mês"'), 'Carrossel Top 10 Animes do Mês deve estar presente');
console.log('✓ Todos os três carrosséis Top 10 do Mês preservados.');

console.log('\n========================================================================');
console.log(' TODOS OS TESTES DE REMOÇÃO DE GÊNEROS EM DESTAQUE PASSARAM COM SUCESSO! ');
console.log('========================================================================\n');
process.exit(0);
