import assert from 'assert';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { searchService } from '../src/core/search/searchService';
import { deduplicateContentItems, getCanonicalKeysForItem } from '../src/core/catalog/catalogDeduplication';
import { ContentType, ContentItem, AppView } from '../types';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';

console.log('================================================================');
console.log('SUÍTE DE TESTES: DEDUPLICAÇÃO, ISOLAMENTO E NAVEGAÇÃO REPETIDA');
console.log('================================================================\n');

// --------------------------------------------------------------------------
// TESTE 1: Homem-Aranha: Um Novo Dia bloqueado estritamente por não lançamento
// --------------------------------------------------------------------------
console.log('--- TESTE 1: Regras de Lançamento e Disponibilidade (Homem-Aranha) ---');

const spidermanItem = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-spiderman-new-day-2026');
assert.ok(spidermanItem, 'Item Homem-Aranha deve existir para auditoria');
assert.strictEqual(spidermanItem.availabilityStatus, 'unavailable', 'Homem-Aranha não deve estar marcado como verified');
assert.strictEqual(spidermanItem.isFeatured, false, 'Homem-Aranha não deve estar marcado como isFeatured');

const isAllowedTheatrically = theatricalFilterService.isMovieAllowedSync(spidermanItem);
assert.strictEqual(isAllowedTheatrically, false, 'TheatricalFilterService deve rejeitar Homem-Aranha como filme não lançado');

const isPubliclyPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(spidermanItem);
assert.strictEqual(isPubliclyPlayable, false, 'CatalogEligibilityService deve rejeitar Homem-Aranha da exibição pública');

// Teste com variação vinda do IMDb ou TMDB
const spidermanExternal: ContentItem = {
  id: 'tt20221436',
  title: 'Homem-Aranha: Um Novo Dia',
  originalTitle: 'Spider-Man: Brand New Day',
  imdbId: 'tt20221436',
  year: 2026,
  type: ContentType.MOVIE,
  availabilityStatus: 'verified' // simulando falso positivo externo
};
assert.strictEqual(catalogEligibilityService.isItemPubliclyPlayableSync(spidermanExternal), false, 'Mesmo com availabilityStatus verified, padrões não lançados devem ser bloqueados');

console.log('✓ TESTE 1 PASSOU: Homem-Aranha rejeitado categoricamente por regras de lançamento.\n');

// --------------------------------------------------------------------------
// TESTE 2: Top 10 Em Destaque sem Homem-Aranha e sem duplicatas
// --------------------------------------------------------------------------
console.log('--- TESTE 2: Top 10 Em Destaque (Featured Ranking) ---');

const featuredSelection = featuredRankingService.getFeaturedSelectionSync();
assert.ok(featuredSelection.featuredMovies.length > 0, 'Deve conter filmes em destaque');
assert.ok(featuredSelection.featuredMovies.length <= 10, 'Deve conter no máximo 10 filmes');
assert.ok(featuredSelection.featuredSeries.length <= 10, 'Deve conter no máximo 10 séries');

const hasSpidermanInFeatured = featuredSelection.featuredMovies.some(
  m => m.id === 'movie-spiderman-new-day-2026' || m.imdbId === 'tt20221436' || /homem-aranha.*um novo dia/i.test(m.title)
);
assert.strictEqual(hasSpidermanInFeatured, false, 'Homem-Aranha NUNCA deve estar no Top 10 Em Destaque');

// Valida que todos os filmes em featured são exclusivamente do tipo FILME e não animes
for (const m of featuredSelection.featuredMovies) {
  assert.strictEqual(m.type, ContentType.MOVIE, `Item '${m.title}' em Filmes em Destaque deve ser filme`);
  assert.strictEqual(searchService.isAnimeItem(m), false, `Item '${m.title}' não pode ser anime`);
}

// Valida que todas as séries em featured são exclusivamente do tipo SÉRIE e não animes
for (const s of featuredSelection.featuredSeries) {
  assert.strictEqual(s.type, ContentType.SERIES, `Item '${s.title}' em Séries em Destaque deve ser série`);
  assert.strictEqual(searchService.isAnimeItem(s), false, `Item '${s.title}' não pode ser anime`);
}

console.log(`✓ TESTE 2 PASSOU: Em Destaque contém ${featuredSelection.featuredMovies.length} filmes e ${featuredSelection.featuredSeries.length} séries 100% elegíveis sem Homem-Aranha.\n`);

// --------------------------------------------------------------------------
// TESTE 3: Deduplicação Canônica Estrita
// --------------------------------------------------------------------------
console.log('--- TESTE 3: Deduplicação Canônica ---');

const duplicateCandidates: ContentItem[] = [
  { id: 'movie-matrix-1', title: 'Matrix', imdbId: 'tt0133093', type: ContentType.MOVIE, year: 1999 },
  { id: 'tt0133093', title: 'The Matrix', imdbId: 'tt0133093', type: ContentType.MOVIE, year: 1999 },
  { id: 'tmdb-603', title: 'Matrix', tmdbId: 603, imdbId: 'tt0133093', type: ContentType.MOVIE, year: 1999 },
  { id: 'series-ted-lasso-1', title: 'Ted Lasso', imdbId: 'tt10986410', type: ContentType.SERIES, year: 2020 },
  { id: 'series-ted-lasso-2', title: 'Ted Lasso', imdbId: 'tt10986410', type: ContentType.SERIES, year: 2020 }
];

const dedupedResult = deduplicateContentItems(duplicateCandidates);
assert.strictEqual(dedupedResult.length, 2, 'Deve restar apenas 1 Matrix e 1 Ted Lasso após deduplicação canônica');
assert.strictEqual(dedupedResult[0].imdbId, 'tt0133093');
assert.strictEqual(dedupedResult[1].imdbId, 'tt10986410');

console.log('✓ TESTE 3 PASSOU: Deduplicação canônica eliminou 3 duplicatas perfeitas.\n');

// --------------------------------------------------------------------------
// TESTE 4: Simulação de 25 Alternâncias de Navegação Contínuas
// --------------------------------------------------------------------------
console.log('--- TESTE 4: Simulação de 25 Alternâncias entre Páginas ---');

const viewsToCycle: AppView[] = ['home', 'featured', 'movies', 'series', 'animes'];

// Simulação de estado da aplicação como gerenciado no App.tsx
let contentState: ContentItem[] = deduplicateContentItems([...VERIFIED_OPEN_ITEMS, ...FEATURED_CATALOG_ITEMS]);
let popularMoviesState: ContentItem[] = [
  { id: 'movie-1', title: 'Filme A', type: ContentType.MOVIE, year: 2022, imdbId: 'tt1111111' },
  { id: 'movie-2', title: 'Filme B', type: ContentType.MOVIE, year: 2023, imdbId: 'tt2222222' }
];
let popularSeriesState: ContentItem[] = [
  { id: 'series-1', title: 'Série A', type: ContentType.SERIES, year: 2022, imdbId: 'tt3333333' },
  { id: 'series-2', title: 'Série B', type: ContentType.SERIES, year: 2023, imdbId: 'tt4444444' }
];
let animeItemsState: ContentItem[] = [
  { id: 'anime-1', title: 'Anime A', type: ContentType.ANIME, year: 2022, imdbId: 'tt5555555' },
  { id: 'anime-2', title: 'Anime B', type: ContentType.ANIME, year: 2023, imdbId: 'tt6666666' }
];

const countsByView: Record<string, number[]> = {
  movies: [],
  series: [],
  animes: [],
  featured: []
};

// Executa 25 trocas de páginas alternando entre todas as visualizações
for (let cycle = 1; cycle <= 25; cycle++) {
  const currentView = viewsToCycle[(cycle - 1) % viewsToCycle.length];

  // Simula o cálculo de filteredContent de App.tsx
  let baseFiltered = contentState;

  if (currentView === 'movies') {
    const source = popularMoviesState.length > 0 ? popularMoviesState : baseFiltered;
    baseFiltered = source.filter(i => searchService.isMovieItem(i));
  } else if (currentView === 'series') {
    const source = popularSeriesState.length > 0 ? popularSeriesState : baseFiltered;
    baseFiltered = source.filter(i => searchService.isSeriesItem(i));
  } else if (currentView === 'animes') {
    const source = animeItemsState.length > 0 ? animeItemsState : baseFiltered;
    baseFiltered = source.filter(i => searchService.isAnimeItem(i));
  } else if (currentView === 'featured') {
    const source = baseFiltered;
    baseFiltered = source.filter(i => i.isFeatured);
  }

  const renderedItems = catalogEligibilityService.filterEligibleItemsSync(
    deduplicateContentItems(baseFiltered)
  );

  // Verificação de vazamento de categorias
  if (currentView === 'movies') {
    countsByView.movies.push(renderedItems.length);
    for (const item of renderedItems) {
      assert.strictEqual(item.type, ContentType.MOVIE, `Item '${item.title}' não é filme mas apareceu em Movies`);
      assert.strictEqual(searchService.isAnimeItem(item), false, `Anime '${item.title}' vazou para Filmes`);
    }
  } else if (currentView === 'series') {
    countsByView.series.push(renderedItems.length);
    for (const item of renderedItems) {
      assert.strictEqual(item.type, ContentType.SERIES, `Filme/Outro '${item.title}' vazou para Séries`);
      assert.strictEqual(searchService.isAnimeItem(item), false, `Anime '${item.title}' vazou para Séries`);
    }
  } else if (currentView === 'animes') {
    countsByView.animes.push(renderedItems.length);
    for (const item of renderedItems) {
      const isAnime = item.type === ContentType.ANIME || searchService.isAnimeItem(item);
      assert.ok(isAnime, `Item não-anime '${item.title}' vazou para Animes`);
    }
  }

  // Verifica que Homem-Aranha NUNCA aparece na lista renderizada
  const hasSpiderman = renderedItems.some(
    i => i.id === 'movie-spiderman-new-day-2026' || i.imdbId === 'tt20221436' || /homem-aranha.*um novo dia/i.test(i.title)
  );
  assert.strictEqual(hasSpiderman, false, `Homem-Aranha vazou para a página '${currentView}' no ciclo ${cycle}!`);
}

// Verifica estabilidade da contagem de cards: não deve crescer a cada troca de rota
const firstMovieCount = countsByView.movies[0];
for (const count of countsByView.movies) {
  assert.strictEqual(count, firstMovieCount, `A contagem de cards em Filmes oscilou ou multiplicou: ${countsByView.movies.join(', ')}`);
}

const firstSeriesCount = countsByView.series[0];
for (const count of countsByView.series) {
  assert.strictEqual(count, firstSeriesCount, `A contagem de cards em Séries oscilou ou multiplicou: ${countsByView.series.join(', ')}`);
}

const firstAnimeCount = countsByView.animes[0];
for (const count of countsByView.animes) {
  assert.strictEqual(count, firstAnimeCount, `A contagem de cards em Animes oscilou ou multiplicou: ${countsByView.animes.join(', ')}`);
}

console.log(`✓ TESTE 4 PASSOU: 25 alternâncias de página executadas.`);
console.log(`  - Filmes estáveis em: ${firstMovieCount} cards`);
console.log(`  - Séries estáveis em: ${firstSeriesCount} cards`);
console.log(`  - Animes estáveis em: ${firstAnimeCount} cards`);
console.log(`  - Zero multiplicações, zero vazamentos de categorias e zero Homem-Aranha em todas as 25 navegações!\n`);

console.log('================================================================');
console.log('TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
console.log('================================================================');
