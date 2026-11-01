import assert from 'node:assert/strict';
import { ContentItem, ContentType } from '../types';
import {
  getWatchRoute,
  parseWatchRoute,
  isContentItemMatchingRoute,
  isMediaTypeCompatible
} from '../src/core/routes/navigationRoutes';
import { canonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';

console.log('========================================================================');
console.log('--- ZAPITV | SUÍTE DE RESOLUÇÃO E REPRODUÇÃO NO MODO TV (P0) ---');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// [Cenário 1] Validação de Identidade e Normalização de Rotas (isContentItemMatchingRoute)
// -----------------------------------------------------------------------------
console.log('[Cenário 1] Testando correspondência de identidade e normalização de IDs...');

const movieTmdbNumeric = {
  id: '550',
  tmdbId: 550 as any, // ID numérico vindo do JSON do TMDB
  title: 'Clube da Luta',
  type: ContentType.MOVIE
} as ContentItem;

assert.equal(isContentItemMatchingRoute(movieTmdbNumeric, '550'), true, 'ID numérico TMDB deve bater com rota string "550"');
assert.equal(isContentItemMatchingRoute(movieTmdbNumeric, 'tmdb-550'), true, 'ID numérico TMDB deve bater com rota prefixada "tmdb-550"');

const movieTmdbPrefixed = {
  id: 'tmdb-550',
  tmdbId: '550',
  title: 'Clube da Luta',
  type: ContentType.MOVIE
} as ContentItem;

assert.equal(isContentItemMatchingRoute(movieTmdbPrefixed, '550'), true, 'Item com id "tmdb-550" deve bater com rota "550"');
assert.equal(isContentItemMatchingRoute(movieTmdbPrefixed, 'tmdb-550'), true, 'Item com id "tmdb-550" deve bater com rota "tmdb-550"');

const movieImdb = {
  id: 'movie-matrix',
  imdbId: 'tt0133093',
  title: 'Matrix',
  type: ContentType.MOVIE
} as ContentItem;

assert.equal(isContentItemMatchingRoute(movieImdb, 'tt0133093'), true, 'IMDb ID direto');
assert.equal(isContentItemMatchingRoute(movieImdb, 'TT0133093'), true, 'IMDb ID em caixa alta');
assert.equal(isContentItemMatchingRoute(movieImdb, '0133093'), true, 'IMDb ID sem o prefixo tt');
assert.equal(isContentItemMatchingRoute(movieImdb, 'movie-matrix'), true, 'ID customizado do item');

const openCatalogItem = VERIFIED_OPEN_ITEMS[0];
assert.ok(openCatalogItem, 'Item de acervo público verificado deve existir');
assert.equal(isContentItemMatchingRoute(openCatalogItem, openCatalogItem.id), true, 'Item do acervo aberto deve bater com seu ID');

console.log('✓ Normalização e correspondência de IDs validadas com sucesso.\n');

// -----------------------------------------------------------------------------
// [Cenário 2] Compatibilidade de Mídias e Tipos de Rota (isMediaTypeCompatible)
// -----------------------------------------------------------------------------
console.log('[Cenário 2] Testando compatibilidade de tipos de mídia...');

const standardMovie = { id: 'm1', type: ContentType.MOVIE } as ContentItem;
const standardSeries = { id: 's1', type: ContentType.SERIES, seasonsCount: 3 } as ContentItem;
const animeSeries = { id: 'a1', type: ContentType.ANIME, genres: ['Anime'], seasonsCount: 2 } as ContentItem;
const animeMovie = { id: 'a2', type: ContentType.ANIME, mediaFormat: 'movie' } as ContentItem;
const seriesWithAnimeTag = { id: 's2', type: ContentType.SERIES, genres: ['Anime', 'Ação'], seasonsCount: 1 } as ContentItem;

assert.equal(isMediaTypeCompatible(standardMovie, 'movie'), true, 'Filme padrão compatível com rota filme');
assert.equal(isMediaTypeCompatible(standardMovie, 'series'), false, 'Filme padrão NÃO é compatível com rota série');

assert.equal(isMediaTypeCompatible(standardSeries, 'series'), true, 'Série padrão compatível com rota série');
assert.equal(isMediaTypeCompatible(standardSeries, 'movie'), false, 'Série padrão NÃO é compatível com rota filme');

assert.equal(isMediaTypeCompatible(animeSeries, 'anime'), true, 'Anime seriado compatível com rota anime');
assert.equal(isMediaTypeCompatible(animeSeries, 'series'), true, 'Anime seriado compatível com rota série (conteúdo episódico)');

assert.equal(isMediaTypeCompatible(animeMovie, 'movie'), true, 'Anime longa-metragem compatível com rota filme');

assert.equal(isMediaTypeCompatible(seriesWithAnimeTag, 'series'), true, 'Série com tag de Anime compatível com rota série');
assert.equal(isMediaTypeCompatible(seriesWithAnimeTag, 'anime'), true, 'Série com tag de Anime compatível com rota anime');

console.log('✓ Compatibilidade de categorias e mídias validada com sucesso.\n');

// -----------------------------------------------------------------------------
// [Cenário 3] Simulação do Fluxo do TvApp (handleStartPlay & Resolução Imediata)
// -----------------------------------------------------------------------------
console.log('[Cenário 3] Simulando fluxo de reprodução e eliminação da tela de erro...');

interface MockTvAppState {
  playingItem: { item: ContentItem; season?: number; episode?: number } | null;
  selectedDetailItem: ContentItem | null;
  tvWatchNotFound: boolean;
  locationPathname: string;
}

function createTvAppSession() {
  const state: MockTvAppState = {
    playingItem: null,
    selectedDetailItem: null,
    tvWatchNotFound: false,
    locationPathname: '/tv'
  };

  const handleStartPlay = (item: ContentItem, season?: number, episode?: number) => {
    state.tvWatchNotFound = false;
    const resolvedSeason = season ?? 1;
    const resolvedEpisode = episode ?? 1;
    const watchRoute = getWatchRoute(item, resolvedSeason, resolvedEpisode, true);

    state.selectedDetailItem = item;
    state.playingItem = { item, season: resolvedSeason, episode: resolvedEpisode };
    state.locationPathname = watchRoute;
  };

  const evaluateWatchRouteSync = () => {
    const parsed = parseWatchRoute(state.locationPathname);
    if (!parsed.isWatch || !parsed.isTv || !parsed.id) return;

    // Fast-path 1: playingItem já existente
    if (
      state.playingItem &&
      isContentItemMatchingRoute(state.playingItem.item, parsed.id) &&
      isMediaTypeCompatible(state.playingItem.item, parsed.mediaType)
    ) {
      state.tvWatchNotFound = false;
      return;
    }

    // Fast-path 2: selectedDetailItem em memória
    if (
      state.selectedDetailItem &&
      isContentItemMatchingRoute(state.selectedDetailItem, parsed.id) &&
      isMediaTypeCompatible(state.selectedDetailItem, parsed.mediaType)
    ) {
      state.tvWatchNotFound = false;
      state.playingItem = {
        item: state.selectedDetailItem,
        season: parsed.season ?? 1,
        episode: parsed.episode ?? 1
      };
      return;
    }

    // Fallback de catálogo (CanonicalCatalogMaster + acervo aberto)
    const masterItems = canonicalCatalogMaster.getAllItemsSync();
    const found = masterItems.find(i =>
      isContentItemMatchingRoute(i, parsed.id) &&
      isMediaTypeCompatible(i, parsed.mediaType)
    ) || VERIFIED_OPEN_ITEMS.find(i =>
      isContentItemMatchingRoute(i, parsed.id) &&
      isMediaTypeCompatible(i, parsed.mediaType)
    );

    if (found) {
      state.selectedDetailItem = found;
      state.playingItem = {
        item: found,
        season: parsed.season ?? 1,
        episode: parsed.episode ?? 1
      };
      state.tvWatchNotFound = false;
    } else {
      state.tvWatchNotFound = true;
    }
  };

  const isPlayerMounted = () => {
    const currentWatchRoute = parseWatchRoute(state.locationPathname);
    const isTvWatchRoute = currentWatchRoute.isWatch && currentWatchRoute.isTv;
    const playingMatchesRoute = !isTvWatchRoute ||
      (state.playingItem !== null &&
        isContentItemMatchingRoute(state.playingItem.item, currentWatchRoute.id) &&
        isMediaTypeCompatible(state.playingItem.item, currentWatchRoute.mediaType));
    
    return Boolean(state.playingItem && playingMatchesRoute && !state.tvWatchNotFound);
  };

  return { state, handleStartPlay, evaluateWatchRouteSync, isPlayerMounted };
}

// Subteste 3.1: Reprodução de Filme pela interface da TV
const session1 = createTvAppSession();
const testMovie: ContentItem = {
  id: 'movie-digger-2026',
  title: 'Digger',
  type: ContentType.MOVIE,
  year: 2026
};

session1.handleStartPlay(testMovie);
session1.evaluateWatchRouteSync();
assert.equal(session1.state.tvWatchNotFound, false, 'tvWatchNotFound deve permanecer false para filme');
assert.equal(session1.isPlayerMounted(), true, 'Player deve estar montado para o filme');
assert.equal(session1.state.playingItem?.item.id, testMovie.id);

// Subteste 3.2: Reprodução de Série com Temporada e Episódio específicos
const session2 = createTvAppSession();
const testSeries: ContentItem = {
  id: 'series-ted-lasso',
  title: 'Ted Lasso',
  type: ContentType.SERIES,
  seasonsCount: 3
};

session2.handleStartPlay(testSeries, 2, 4);
session2.evaluateWatchRouteSync();
assert.equal(session2.state.tvWatchNotFound, false, 'tvWatchNotFound deve permanecer false para série');
assert.equal(session2.isPlayerMounted(), true, 'Player deve estar montado para a série');
assert.equal(session2.state.playingItem?.season, 2, 'Temporada deve ser 2');
assert.equal(session2.state.playingItem?.episode, 4, 'Episódio deve ser 4');
assert.equal(session2.state.locationPathname, '/tv/assistir/serie/series-ted-lasso/t/2/e/4');

// Subteste 3.3: Reprodução de Anime pelo carrossel
const session3 = createTvAppSession();
const testAnime: ContentItem = {
  id: 'anime-solo-leveling',
  title: 'Solo Leveling',
  type: ContentType.ANIME,
  genres: ['Anime'],
  seasonsCount: 1
};

session3.handleStartPlay(testAnime, 1, 1);
session3.evaluateWatchRouteSync();
assert.equal(session3.state.tvWatchNotFound, false, 'tvWatchNotFound deve permanecer false para anime');
assert.equal(session3.isPlayerMounted(), true, 'Player deve estar montado para o anime');
assert.equal(session3.state.locationPathname, '/tv/assistir/anime/anime-solo-leveling/t/1/e/1');

// Subteste 3.4: Rota direta (Deep Link / Reload) de item do acervo verificado
const session4 = createTvAppSession();
session4.state.locationPathname = `/tv/assistir/filme/${openCatalogItem.id}`;
session4.evaluateWatchRouteSync();
assert.equal(session4.state.tvWatchNotFound, false, 'Item de catálogo aberto deve ser resolvido sem erro');
assert.equal(session4.isPlayerMounted(), true, 'Player deve montar a partir de deep link');
assert.equal(session4.state.playingItem?.item.id, openCatalogItem.id);

// Subteste 3.5: Rota com ID inexistente deve acionar tvWatchNotFound
const session5 = createTvAppSession();
session5.state.locationPathname = '/tv/assistir/filme/conteudo-inexistente-123456789';
session5.evaluateWatchRouteSync();
assert.equal(session5.state.tvWatchNotFound, true, 'Conteúdo completamente inexistente deve acionar erro');
assert.equal(session5.isPlayerMounted(), false, 'Player não deve montar para ID inexistente');

console.log('✓ Fluxos de reprodução do TvApp validados sem regressões.\n');

console.log('========================================================================');
console.log('--- TODOS OS TESTES DA SUÍTE P0 DE RESOLUÇÃO DA TV PASSARAM COM SUCESSO! ---');
console.log('========================================================================');

canonicalCatalogMaster.dispose();
process.exit(0);
