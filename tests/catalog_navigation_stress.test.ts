import { describe, it, expect, beforeEach } from 'vitest';

// Polyfill localStorage para ambiente Node no Vitest
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: (index: number) => Object.keys(store)[index] || null,
  get length() { return Object.keys(store).length; }
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

if (typeof window === 'undefined') {
  (global as any).window = { localStorage: mockLocalStorage };
} else {
  (window as any).localStorage = mockLocalStorage;
}

import { searchService } from '../src/core/search/SearchService';
import { catalogSnapshotManager } from '../src/core/catalog/CatalogSnapshotManager';
import { hybridRecommendationEngine } from '../src/core/recommendations/hybridRecommendationEngine';
import { storageService } from '../src/core/storage/storageService';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { ContentItem, ContentType } from '../types';

describe('ZapiTV Catalog Navigation & 30-Cycle Stress Suite', () => {
  const mockMovies: ContentItem[] = [
    { id: 'movie-oppenheimer', title: 'Oppenheimer', type: ContentType.MOVIE, mediaFormat: 'movie', rating: 8.9, year: 2023, image: 'https://image.tmdb.org/t/p/w500/opp.jpg', tmdbId: '872585' },
    { id: 'movie-deadpool', title: 'Deadpool & Wolverine', type: ContentType.MOVIE, mediaFormat: 'movie', rating: 8.0, year: 2024, image: 'https://image.tmdb.org/t/p/w500/dp.jpg', tmdbId: '533535' },
    { id: 'movie-dune2', title: 'Duna: Parte 2', type: ContentType.MOVIE, mediaFormat: 'movie', rating: 8.6, year: 2024, image: 'https://image.tmdb.org/t/p/w500/dune.jpg', tmdbId: '693134' },
    { id: 'movie-verity', title: 'Verity', type: ContentType.MOVIE, mediaFormat: 'movie', rating: 8.1, year: 2026, image: 'https://image.tmdb.org/t/p/w500/6Qf3sylInJeyK0fFTfjprnGIXCF.jpg', tmdbId: '1283515' }
  ];

  const mockSeries: ContentItem[] = [
    { id: 'series-twd', title: 'The Walking Dead', type: ContentType.SERIES, mediaFormat: 'series', rating: 8.2, year: 2010, image: 'https://image.tmdb.org/t/p/w500/twd.jpg', tmdbId: '1402' },
    { id: 'series-lanternas', title: 'Lanternas', type: ContentType.SERIES, mediaFormat: 'series', rating: 8.0, year: 2026, image: 'https://image.tmdb.org/t/p/w500/lanterns.jpg', tmdbId: '26540670' },
    { id: 'series-ted-lasso', title: 'Ted Lasso', type: ContentType.SERIES, mediaFormat: 'series', rating: 8.8, year: 2020, image: 'https://image.tmdb.org/t/p/w500/ted.jpg', tmdbId: '10986410' },
    { id: 'series-widows-bay', title: "O Segredo de Widow's Bay", type: ContentType.SERIES, mediaFormat: 'series', rating: 7.7, year: 2026, image: 'https://image.tmdb.org/t/p/w500/hazWZ75ml5Er3MQsFetIzoeWs99.jpg', tmdbId: '270476' }
  ];

  const mockAnimes: ContentItem[] = [
    { id: 'anime-aot', title: 'Attack on Titan', type: ContentType.ANIME, mediaFormat: 'series', rating: 9.1, year: 2013, image: 'https://image.tmdb.org/t/p/w500/aot.jpg', isAnime: true, tmdbId: '1429' },
    { id: 'anime-naruto', title: 'Naruto', type: ContentType.ANIME, mediaFormat: 'series', rating: 8.4, year: 2002, image: 'https://image.tmdb.org/t/p/w500/naruto.jpg', isAnime: true, tmdbId: '46260' },
    { id: 'anime-your-name', title: 'Your Name', type: ContentType.ANIME, mediaFormat: 'movie', rating: 8.9, year: 2016, image: 'https://image.tmdb.org/t/p/w500/yourname.jpg', isAnime: true, tmdbId: '372058' }
  ];

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('1. TMDB Official Posters Verification', () => {
    it('verifies that Verity, A Odisseia, Dia D, and Widow\'s Bay have valid TMDB image URLs', () => {
      const verity = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-verity-2026');
      const odisseia = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-a-odisseia-2026');
      const diaD = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-dia-d-2026');
      const widowsBay = FEATURED_CATALOG_ITEMS.find(i => i.id === 'series-widows-bay-2026');

      expect(verity).toBeDefined();
      expect(verity?.image).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
      expect(verity?.image).toContain('6Qf3sylInJeyK0fFTfjprnGIXCF.jpg');

      expect(odisseia).toBeDefined();
      expect(odisseia?.image).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
      expect(odisseia?.image).toContain('muMwJAiMtReEHLKpKMWt2rMkYF7.jpg');

      expect(diaD).toBeDefined();
      expect(diaD?.image).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
      expect(diaD?.image).toContain('2EjUTEnnoC0sK5j5FS7dC3vOZcl.jpg');

      expect(widowsBay).toBeDefined();
      expect(widowsBay?.image).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
      expect(widowsBay?.image).toContain('hazWZ75ml5Er3MQsFetIzoeWs99.jpg');
    });
  });

  describe('2. StorageService Category Hygiene & Strict Filtration', () => {
    it('purges and excludes misclassified items upon caching and retrieval', () => {
      // Grava no localStorage propositalmente itens misturados
      const mixedItems = [...mockMovies, ...mockSeries, ...mockAnimes];

      storageService.saveCachedCatalog('movies', mixedItems);
      const cachedMovies = storageService.getCachedCatalog('movies');
      expect(cachedMovies.length).toBeGreaterThan(0);
      for (const m of cachedMovies) {
        expect(searchService.isMovieItem(m, false)).toBe(true);
        expect(searchService.isSeriesItem(m)).toBe(false);
        expect(searchService.isAnimeItem(m)).toBe(false);
      }

      storageService.saveCachedCatalog('series', mixedItems);
      const cachedSeries = storageService.getCachedCatalog('series');
      expect(cachedSeries.length).toBeGreaterThan(0);
      for (const s of cachedSeries) {
        expect(searchService.isSeriesItem(s)).toBe(true);
        expect(searchService.isMovieItem(s, false)).toBe(false);
        expect(searchService.isAnimeItem(s)).toBe(false);
      }

      storageService.saveCachedCatalog('animes', mixedItems);
      const cachedAnimes = storageService.getCachedCatalog('animes');
      expect(cachedAnimes.length).toBeGreaterThan(0);
      for (const a of cachedAnimes) {
        expect(searchService.isAnimeItem(a)).toBe(true);
      }
    });
  });

  describe('3. Recommendation Engine Category Isolation', () => {
    it('hybrid engine strictly respects category and strips non-conforming items', () => {
      const mixed = [...mockMovies, ...mockSeries, ...mockAnimes];

      const movieSorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(mixed, 'default', undefined, false, 'movies');
      for (const item of movieSorted) {
        expect(searchService.isMovieItem(item, false)).toBe(true);
        expect(searchService.isSeriesItem(item)).toBe(false);
        expect(searchService.isAnimeItem(item)).toBe(false);
      }

      const seriesSorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(mixed, 'default', undefined, false, 'series');
      for (const item of seriesSorted) {
        expect(searchService.isSeriesItem(item)).toBe(true);
        expect(searchService.isMovieItem(item, false)).toBe(false);
        expect(searchService.isAnimeItem(item)).toBe(false);
      }

      const animeSorted = hybridRecommendationEngine.sortCatalogByHybridRelevance(mixed, 'default', undefined, false, 'animes');
      for (const item of animeSorted) {
        expect(searchService.isAnimeItem(item)).toBe(true);
      }
    });
  });

  describe('4. 30-Cycle Navigation Stress Test Simulation', () => {
    it('executes 30 continuous switches across movies, series, and animes without cross-contamination', () => {
      const navigationSequence: Array<'movies' | 'series' | 'animes'> = [
        'movies', 'series', 'animes',
        'movies', 'animes', 'series',
        'series', 'movies', 'animes',
        'series', 'animes', 'movies',
        'animes', 'movies', 'series',
        'animes', 'series', 'movies',
        'movies', 'series', 'animes',
        'movies', 'animes', 'series',
        'series', 'movies', 'animes',
        'animes', 'series', 'movies'
      ];

      expect(navigationSequence).toHaveLength(30);

      // Simula estado de snapshots isolados exatamente como no App.tsx
      const snapshots: Record<string, ContentItem[]> = {};

      const getSnapshotKey = (view: 'movies' | 'series' | 'animes') => `${view}:all:recommended:default:adult`;

      const allMixedData = [...mockMovies, ...mockSeries, ...mockAnimes];

      for (let i = 0; i < navigationSequence.length; i++) {
        const view = navigationSequence[i];
        const key = getSnapshotKey(view);

        // Se ainda não houver snapshot para essa view, cria inicial estritamente filtrado
        if (!snapshots[key] || snapshots[key].length === 0) {
          const base = view === 'movies'
            ? allMixedData.filter(item => searchService.isMovieItem(item, false))
            : view === 'series'
            ? allMixedData.filter(item => searchService.isSeriesItem(item))
            : allMixedData.filter(item => searchService.isAnimeItem(item));

          const sorted = catalogSnapshotManager.createInitialSnapshot(base, 'recommended', {
            profileId: 'default',
            isChild: false,
            category: view
          });

          // Filtro estrito de categoria
          snapshots[key] = view === 'movies'
            ? sorted.filter(item => searchService.isMovieItem(item, false))
            : view === 'series'
            ? sorted.filter(item => searchService.isSeriesItem(item))
            : sorted.filter(item => searchService.isAnimeItem(item));
        }

        // Obtém o conteúdo visível para a rota atual
        const visibleItems = snapshots[key];
        expect(visibleItems.length).toBeGreaterThan(0);

        if (view === 'movies') {
          for (const item of visibleItems) {
            expect(searchService.isMovieItem(item, false)).toBe(true);
            expect(searchService.isSeriesItem(item)).toBe(false);
            expect(searchService.isAnimeItem(item)).toBe(false);
            expect(item.title).not.toBe('The Walking Dead');
            expect(item.title).not.toBe('Lanternas');
          }
        } else if (view === 'series') {
          for (const item of visibleItems) {
            expect(searchService.isSeriesItem(item)).toBe(true);
            expect(searchService.isMovieItem(item, false)).toBe(false);
            expect(searchService.isAnimeItem(item)).toBe(false);
            expect(item.title).not.toBe('Oppenheimer');
            expect(item.title).not.toBe('Deadpool & Wolverine');
          }
        } else if (view === 'animes') {
          for (const item of visibleItems) {
            expect(searchService.isAnimeItem(item)).toBe(true);
            expect(item.title).not.toBe('Oppenheimer');
            expect(item.title).not.toBe('Deadpool & Wolverine');
            expect(item.title).not.toBe('The Walking Dead');
          }
        }
      }
    });
  });
});
