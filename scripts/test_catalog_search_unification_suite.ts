/**
 * Suíte de Testes Automatizada: Unificação da Busca e Catálogos de Filmes, Séries e Animes do ZapiTV
 * 
 * Valida:
 * 1. Classificação Canônica Rigorosa (Filmes, Séries, Filmes de Anime, Séries de Anime)
 * 2. Unificação Busca x Catálogo (Itens buscados na Home estão presentes nas categorias)
 * 3. Isolamento Estrito de Categorias (Sem vazamento de filmes em séries ou séries em filmes)
 * 4. Contadores Estáveis de Títulos Disponíveis (Independentes de paginação e scroll)
 * 5. Proteção de Disponibilidade (Obras sem confirmação/não lançadas continuam barradas)
 * 6. Deduplicação Canônica (Eliminação de duplicatas sem perda de metadados)
 */

import { searchService } from '../src/core/search/searchService';
import { catalogDiscoveryService } from '../src/core/catalog/CatalogDiscoveryService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { ContentItem, ContentType } from '../types';
import { filmesData } from '../constants';

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
  console.log('======================================================================');
  console.log('SUÍTE DE TESTES: UNIFICAÇÃO BUSCA X CATÁLOGOS (FILMES, SÉRIES, ANIMES)');
  console.log('======================================================================\n');

  // -------------------------------------------------------------
  // GRUPO 1: Classificação Canônica das Mídias
  // -------------------------------------------------------------
  console.log('--- GRUPO 1: Classificação Canônica das Mídias ---');
  
  const movieCoraline: ContentItem = {
    id: 'coraline-2009',
    imdbId: 'tt0327597',
    title: 'Coraline e o Mundo Secreto',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    year: 2009,
    genres: ['Animação', 'Fantasia']
  };

  const seriesDexter: ContentItem = {
    id: 'dexter-series',
    imdbId: 'tt0773262',
    title: 'Dexter',
    type: ContentType.SERIES,
    mediaFormat: 'series',
    year: 2006,
    genres: ['Drama', 'Policial', 'Mistério']
  };

  const animeSeriesAOT: ContentItem = {
    id: 'aot-anime',
    imdbId: 'tt2560140',
    title: 'Attack on Titan',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    year: 2013,
    genres: ['Animação', 'Ação', 'Fantasia', 'Anime']
  };

  const animeMovieChihiro: ContentItem = {
    id: 'spirited-away',
    imdbId: 'tt0245429',
    title: 'A Viagem de Chihiro',
    type: ContentType.ANIME,
    mediaFormat: 'movie',
    year: 2001,
    genres: ['Animação', 'Fantasia', 'Anime']
  };

  assert('1.1 Coraline é classificado como Filme', searchService.isMovieItem(movieCoraline) === true);
  assert('1.2 Coraline NÃO é classificado como Série', searchService.isSeriesItem(movieCoraline) === false);
  assert('1.3 Coraline NÃO é classificado como Anime', searchService.isAnimeItem(movieCoraline) === false);

  assert('1.4 Dexter é classificado como Série', searchService.isSeriesItem(seriesDexter) === true);
  assert('1.5 Dexter NÃO é classificado como Filme', searchService.isMovieItem(seriesDexter) === false);
  assert('1.6 Dexter NÃO é classificado como Anime', searchService.isAnimeItem(seriesDexter) === false);

  assert('1.7 Attack on Titan é Anime Seriado', searchService.isAnimeSeriesItem(animeSeriesAOT) === true);
  assert('1.8 Attack on Titan é Anime', searchService.isAnimeItem(animeSeriesAOT) === true);
  assert('1.9 Attack on Titan NÃO é Série convencional', searchService.isSeriesItem(animeSeriesAOT) === false);
  assert('1.10 Attack on Titan NÃO é Filme', searchService.isMovieItem(animeSeriesAOT) === false);

  assert('1.11 A Viagem de Chihiro é Filme de Anime', searchService.isAnimeMovieItem(animeMovieChihiro) === true);
  assert('1.12 A Viagem de Chihiro é aceito em Filmes (formato longa-metragem)', searchService.isMovieItem(animeMovieChihiro, true) === true);
  assert('1.13 A Viagem de Chihiro pertence a Animes', searchService.isAnimeItem(animeMovieChihiro) === true);
  assert('1.14 A Viagem de Chihiro NÃO é Série convencional nem Anime Seriado', searchService.isSeriesItem(animeMovieChihiro) === false && searchService.isAnimeSeriesItem(animeMovieChihiro) === false);

  // -------------------------------------------------------------
  // GRUPO 2: Unificação Busca Home x Listagem de Categorias
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 2: Unificação Busca Home x Listagem de Categorias ---');

  // Simulação do estado central do App.tsx
  let centralContent: ContentItem[] = deduplicateContentItems([...filmesData]);
  let popularMovies: ContentItem[] = [];
  let popularSeries: ContentItem[] = [];
  let animeItems: ContentItem[] = [];

  // Título encontrado via busca da Home (ex: Dexter ou Coraline vindo da busca unificada)
  const homeSearchResults: ContentItem[] = [movieCoraline, seriesDexter, animeMovieChihiro, animeSeriesAOT];

  // Regra de sincronização de runSearch no App.tsx
  const eligibleSearchResults = catalogEligibilityService.filterEligibleItemsSync(homeSearchResults);
  
  // Sincroniza com catálogo central
  centralContent = deduplicateContentItems([...centralContent, ...eligibleSearchResults]);

  // Sincroniza com listas de categoria
  const newMovies = eligibleSearchResults.filter(it => searchService.isMovieItem(it));
  const newSeries = eligibleSearchResults.filter(it => searchService.isSeriesItem(it));
  const newAnimes = eligibleSearchResults.filter(it => searchService.isAnimeItem(it));

  popularMovies = deduplicateContentItems([...popularMovies, ...newMovies]);
  popularSeries = deduplicateContentItems([...popularSeries, ...newSeries]);
  animeItems = deduplicateContentItems([...animeItems, ...newAnimes]);

  // Função simulada de filteredContent do App.tsx para cada view
  const getFilteredContent = (view: 'movies' | 'series' | 'animes') => {
    switch (view) {
      case 'movies': {
        const catalogMovies = centralContent.filter(it => searchService.isMovieItem(it));
        return deduplicateContentItems([...popularMovies, ...catalogMovies]);
      }
      case 'series': {
        const catalogSeries = centralContent.filter(it => searchService.isSeriesItem(it));
        return deduplicateContentItems([...popularSeries, ...catalogSeries]);
      }
      case 'animes': {
        const catalogAnimes = centralContent.filter(it => searchService.isAnimeItem(it));
        return deduplicateContentItems([...animeItems, ...catalogAnimes]);
      }
    }
  };

  const moviesViewContent = getFilteredContent('movies');
  const seriesViewContent = getFilteredContent('series');
  const animesViewContent = getFilteredContent('animes');

  // Validação: Título de filme pesquisado na Home DEVE estar na página de Filmes
  const coralineInMovies = moviesViewContent.some(it => it.imdbId === 'tt0327597' || it.title.includes('Coraline'));
  assert('2.1 Coraline pesquisado na Home está presente na listagem de Filmes', coralineInMovies);

  // Validação: Título de série pesquisado na Home DEVE estar na página de Séries
  const dexterInSeries = seriesViewContent.some(it => it.imdbId === 'tt0773262' || it.title.includes('Dexter'));
  assert('2.2 Dexter pesquisado na Home está presente na listagem de Séries', dexterInSeries);

  // Validação: Título de anime pesquisado na Home DEVE estar na página de Animes
  const aotInAnimes = animesViewContent.some(it => it.imdbId === 'tt2560140' || it.title.includes('Attack on Titan'));
  assert('2.3 Attack on Titan pesquisado na Home está presente na listagem de Animes', aotInAnimes);

  const chihiroInAnimes = animesViewContent.some(it => it.imdbId === 'tt0245429' || it.title.includes('Chihiro'));
  assert('2.4 A Viagem de Chihiro pesquisado na Home está presente na listagem de Animes', chihiroInAnimes);

  // -------------------------------------------------------------
  // GRUPO 3: Isolamento Estrito de Categorias (Sem Contaminação)
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 3: Isolamento Estrito de Categorias ---');

  const seriesInMovies = moviesViewContent.some(it => it.imdbId === 'tt0773262' || searchService.isSeriesItem(it));
  assert('3.1 Nenhuma série convencional vaza para a listagem de Filmes', !seriesInMovies);

  const moviesInSeries = seriesViewContent.some(it => it.imdbId === 'tt0327597' || it.type === ContentType.MOVIE);
  assert('3.2 Nenhum filme convencional vaza para a listagem de Séries', !moviesInSeries);

  const animeSeriesInSeries = seriesViewContent.some(it => searchService.isAnimeSeriesItem(it));
  assert('3.3 Nenhum anime seriado contamina a listagem de Séries de TV convencionais', !animeSeriesInSeries);

  // -------------------------------------------------------------
  // GRUPO 4: Contadores Estáveis de Títulos Disponíveis
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 4: Contadores Estáveis de Títulos Disponíveis ---');

  const moviesTotal = catalogDiscoveryService.getTotalAvailable('movies', 'Todos');
  const seriesTotal = catalogDiscoveryService.getTotalAvailable('series', 'Todos');
  const animesTotal = catalogDiscoveryService.getTotalAvailable('animes', 'Todos');
  const moviesActionTotal = catalogDiscoveryService.getTotalAvailable('movies', 'Ação');
  const seriesDramaTotal = catalogDiscoveryService.getTotalAvailable('series', 'Drama');

  assert('4.1 Contador total de Filmes é exatamente 20.000', moviesTotal === 20000);
  assert('4.2 Contador total de Séries é exatamente 20.000', seriesTotal === 20000);
  assert('4.3 Contador total de Animes é exatamente 11.494', animesTotal === 11494);
  assert('4.4 Contador por gênero de Filmes (Ação) é estável', moviesActionTotal === 20000);
  assert('4.5 Contador por gênero de Séries (Drama) é estável', seriesDramaTotal === 20000);

  // -------------------------------------------------------------
  // GRUPO 5: Bloqueio de Obras Não Lançadas e Sem Disponibilidade
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 5: Bloqueio de Obras Sem Disponibilidade Confirmada ---');

  const unreleasedSpiderMan: ContentItem = {
    id: 'spiderman-brand-new-day',
    imdbId: 'tt9999999',
    title: 'Spider-Man: Brand New Day',
    type: ContentType.MOVIE,
    year: 2026,
    genres: ['Ação', 'Aventura']
  };

  const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(unreleasedSpiderMan);
  assert('5.1 Obras não lançadas / sem disponibilidade confirmada NÃO são elegíveis', isPlayable === false);

  const filteredUnreleased = catalogEligibilityService.filterEligibleItemsSync([unreleasedSpiderMan]);
  assert('5.2 Obras sem disponibilidade são barradas na filtragem síncrona', filteredUnreleased.length === 0);

  // -------------------------------------------------------------
  // GRUPO 6: Deduplicação Canônica e Unicidade
  // -------------------------------------------------------------
  console.log('\n--- GRUPO 6: Deduplicação Canônica ---');

  const duplicateCoraline: ContentItem = {
    id: 'coraline-dup',
    imdbId: 'tt0327597',
    title: 'Coraline (Cópia da Busca)',
    type: ContentType.MOVIE,
    year: 2009
  };

  const dedupedList = deduplicateContentItems([movieCoraline, duplicateCoraline, movieCoraline]);
  assert('6.1 Itens duplicados com mesmo imdbId são colapsados em um único card', dedupedList.length === 1);
  assert('6.2 Card preserva metadados canônicos', dedupedList[0].imdbId === 'tt0327597');

  console.log('\n======================================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Erro fatal executando suíte:', err);
  process.exit(1);
});
