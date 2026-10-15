import { describe, it, expect, beforeEach } from 'vitest';
import { hybridRecommendationEngine } from '../src/core/recommendations/hybridRecommendationEngine';
import { recommendationEngine, isAnimationOrKidsContent } from '../src/core/recommendations/recommendationEngine';
import { userPreferenceStore } from '../src/core/recommendations/userPreferenceStore';
import { searchService } from '../src/core/search/searchService';
import { ContentItem, ContentType } from '../types';

describe('ZapiTV - Correção da Ordenação dos Catálogos Filmes e Séries', () => {
  // Catálogo de teste variado com Live-actions, Animações, Desenhos e Animes
  const mockCatalog: ContentItem[] = [
    {
      id: 'movie_oppenheimer',
      title: 'Oppenheimer',
      type: ContentType.MOVIE,
      rating: 8.9,
      year: 2023,
      genres: ['Drama', 'Histórico', 'Biografia'],
      director: 'Christopher Nolan',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_coraline',
      title: 'Coraline e o Mundo Secreto',
      type: ContentType.MOVIE,
      rating: 8.8, // Nota alta proposital
      year: 2009,
      genres: ['Animação', 'Fantasia', 'Infantil / Família'],
      director: 'Henry Selick',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_interstellar',
      title: 'Interestelar',
      type: ContentType.MOVIE,
      rating: 8.7,
      year: 2014,
      genres: ['Ficção Científica', 'Drama', 'Aventura'],
      director: 'Christopher Nolan',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_jack',
      title: 'O Estranho Mundo de Jack',
      type: ContentType.MOVIE,
      rating: 8.5,
      year: 1993,
      genres: ['Animação', 'Fantasia', 'Infantil / Família'],
      director: 'Henry Selick',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_gladiator',
      title: 'Gladiador',
      type: ContentType.MOVIE,
      rating: 8.5,
      year: 2000,
      genres: ['Ação', 'Drama', 'Aventura'],
      director: 'Ridley Scott',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_godfather',
      title: 'O Poderoso Chefão',
      type: ContentType.MOVIE,
      rating: 9.2,
      year: 1972,
      genres: ['Policial', 'Drama'],
      director: 'Francis Ford Coppola',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_dune',
      title: 'Duna: Parte 2',
      type: ContentType.MOVIE,
      rating: 8.6,
      year: 2024,
      genres: ['Ficção Científica', 'Aventura', 'Ação'],
      director: 'Denis Villeneuve',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_toy_story',
      title: 'Toy Story',
      type: ContentType.MOVIE,
      rating: 8.3,
      year: 1995,
      genres: ['Animação', 'Aventura', 'Comédia', 'Infantil / Família'],
      director: 'John Lasseter',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    // Séries Live-Action
    {
      id: 'series_breaking_bad',
      title: 'Breaking Bad',
      type: ContentType.SERIES,
      rating: 9.5,
      year: 2008,
      genres: ['Drama', 'Policial', 'Suspense'],
      director: 'Vince Gilligan',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'series_dexter',
      title: 'Dexter',
      type: ContentType.SERIES,
      rating: 8.7,
      year: 2006,
      genres: ['Policial', 'Drama', 'Mistério'],
      director: 'James Manos Jr.',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'series_mindhunter',
      title: 'Mindhunter',
      type: ContentType.SERIES,
      rating: 8.6,
      year: 2017,
      genres: ['Policial', 'Drama', 'Mistério'],
      director: 'Joe Penhall',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    // Séries de Animação / Desenho
    {
      id: 'series_peppa',
      title: 'Peppa Pig',
      type: ContentType.SERIES,
      rating: 8.0,
      year: 2015,
      genres: ['Animação', 'Infantil / Família', 'Comédia'],
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'series_bob_esponja',
      title: 'Bob Esponja Calça Quadrada',
      type: ContentType.SERIES,
      rating: 8.2,
      year: 2005,
      genres: ['Animação', 'Comédia', 'Infantil / Família'],
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    // Animes
    {
      id: 'anime_shingeki',
      title: 'Attack on Titan',
      type: ContentType.ANIME,
      rating: 9.0,
      year: 2013,
      genres: ['Anime', 'Ação', 'Fantasia'],
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-subtitles'
    },
    {
      id: 'anime_demon_slayer',
      title: 'Demon Slayer',
      type: ContentType.ANIME,
      rating: 8.7,
      year: 2019,
      genres: ['Anime', 'Ação', 'Fantasia'],
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    }
  ];

  beforeEach(() => {
    hybridRecommendationEngine.invalidateCache();
    recommendationEngine.invalidateCache();
  });

  it('1. Deve classificar corretamente obras live-action versus animações e conteúdos infantis', () => {
    const coraline = mockCatalog.find(i => i.id === 'movie_coraline')!;
    const oppenheimer = mockCatalog.find(i => i.id === 'movie_oppenheimer')!;
    const peppa = mockCatalog.find(i => i.id === 'series_peppa')!;
    const breakingBad = mockCatalog.find(i => i.id === 'series_breaking_bad')!;
    const aot = mockCatalog.find(i => i.id === 'anime_shingeki')!;

    expect(isAnimationOrKidsContent(coraline)).toBe(true);
    expect(isAnimationOrKidsContent(peppa)).toBe(true);
    expect(isAnimationOrKidsContent(aot)).toBe(true);

    expect(isAnimationOrKidsContent(oppenheimer)).toBe(false);
    expect(isAnimationOrKidsContent(breakingBad)).toBe(false);
  });

  it('2. Perfil Padrão (Adulto/Geral): Prioriza filmes live-action nas primeiras posições de Filmes', () => {
    const moviesOnly = mockCatalog.filter(i => searchService.isMovieItem(i, false));
    const sorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      moviesOnly,
      'adult_profile',
      undefined,
      false, // isChild = false
      'movies'
    );

    // As primeiras posições devem ser estritamente produções live-action
    const topThree = sorted.slice(0, 3);
    for (const item of topThree) {
      expect(isAnimationOrKidsContent(item)).toBe(false);
    }

    // O primeiro filme deve ser um live-action aclamado
    expect(['Oppenheimer', 'O Poderoso Chefão', 'Interestelar', 'Duna: Parte 2', 'Gladiador']).toContain(topThree[0].title);
  });

  it('3. Perfil Padrão: Prioriza séries live-action nas primeiras posições de Séries', () => {
    const seriesOnly = mockCatalog.filter(i => searchService.isSeriesItem(i));
    const sorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      seriesOnly,
      'adult_profile',
      undefined,
      false, // isChild = false
      'series'
    );

    // As primeiras posições devem ser séries live-action
    const topTwo = sorted.slice(0, 2);
    for (const item of topTwo) {
      expect(isAnimationOrKidsContent(item)).toBe(false);
    }
    expect(topTwo.map(i => i.title)).toContain('Breaking Bad');
  });

  it('4. Perfil Infantil (isChild: true): Prioriza animações e conteúdos infantis no topo', () => {
    const moviesOnly = mockCatalog.filter(i => searchService.isMovieItem(i, false));
    const sortedKids = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      moviesOnly,
      'kids_profile',
      undefined,
      true, // isChild = true
      'movies'
    );

    // No topo do perfil infantil, obras infantis/animações devem ocupar as primeiras posições
    const topTwo = sortedKids.slice(0, 2);
    const hasAnimationOrKids = topTwo.some(i => isAnimationOrKidsContent(i));
    expect(hasAnimationOrKids).toBe(true);
    expect(['Coraline e o Mundo Secreto', 'Toy Story', 'O Estranho Mundo de Jack']).toContain(topTwo[0].title);
  });

  it('5. Animações continuam 100% disponíveis no catálogo geral sem serem excluídas', () => {
    const moviesOnly = mockCatalog.filter(i => searchService.isMovieItem(i, false));
    const sorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      moviesOnly,
      'adult_profile',
      undefined,
      false,
      'movies'
    );

    // Preserva exatamente a mesma quantidade total de itens (paginação contínua preservada)
    expect(sorted.length).toBe(moviesOnly.length);

    // Coraline e Toy Story ainda devem estar presentes no catálogo
    const ids = sorted.map(i => i.id);
    expect(ids).toContain('movie_coraline');
    expect(ids).toContain('movie_toy_story');
    expect(ids).toContain('movie_jack');
  });

  it('6. Respeita filtros explícitos: Quando o usuário seleciona "Animação", animações aparecem no topo', () => {
    const moviesOnly = mockCatalog.filter(i => searchService.isMovieItem(i, false));
    const sortedAnimationFilter = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      moviesOnly,
      'adult_profile',
      'Animação', // Filtro explícito de gênero
      false,
      'movies'
    );

    // Quando o usuário filtra explicitamente por Animação, o topo é de animação
    expect(sortedAnimationFilter.length).toBeGreaterThan(0);
    expect(isAnimationOrKidsContent(sortedAnimationFilter[0])).toBe(true);
  });

  it('7. Preserva a categoria própria de Animes e não mistura com Filmes e Séries', () => {
    // Filmes não devem conter Animes
    const moviesSorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      mockCatalog,
      'adult_profile',
      undefined,
      false,
      'movies'
    );
    expect(moviesSorted.some(i => searchService.isAnimeItem(i))).toBe(false);

    // Séries não devem conter Animes
    const seriesSorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      mockCatalog,
      'adult_profile',
      undefined,
      false,
      'series'
    );
    expect(seriesSorted.some(i => searchService.isAnimeItem(i))).toBe(false);

    // Categoria Animes deve conter somente animes
    const animesSorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      mockCatalog,
      'adult_profile',
      undefined,
      false,
      'animes'
    );
    expect(animesSorted.length).toBeGreaterThan(0);
    expect(animesSorted.every(i => searchService.isAnimeItem(i))).toBe(true);
  });

  it('8. Ordenação determinística e estável: sem duplicações ou variações aleatórias', () => {
    const moviesOnly = mockCatalog.filter(i => searchService.isMovieItem(i, false));
    
    // Executa três vezes com os mesmos parâmetros
    const run1 = hybridRecommendationEngine.sortCatalogByHybridRelevance(moviesOnly, 'user1', undefined, false, 'movies');
    hybridRecommendationEngine.invalidateCache();
    const run2 = hybridRecommendationEngine.sortCatalogByHybridRelevance(moviesOnly, 'user1', undefined, false, 'movies');
    hybridRecommendationEngine.invalidateCache();
    const run3 = hybridRecommendationEngine.sortCatalogByHybridRelevance(moviesOnly, 'user1', undefined, false, 'movies');

    expect(run1.map(i => i.id)).toEqual(run2.map(i => i.id));
    expect(run2.map(i => i.id)).toEqual(run3.map(i => i.id));

    // Sem IDs duplicados
    const uniqueIds = new Set(run1.map(i => i.id));
    expect(uniqueIds.size).toBe(run1.length);
  });
});
