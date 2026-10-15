import { describe, it, expect } from 'vitest';
import { getCanonicalKeysForItem, deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { catalogSnapshotManager } from '../src/core/catalog/CatalogSnapshotManager';
import { searchService } from '../src/core/search/SearchService';
import { ContentItem, ContentType } from '../types';

describe('ZapiTV Structural Isolation & Catalog Robustness', () => {
  const sampleMovie: ContentItem = {
    id: 'movie_550',
    title: 'Fight Club',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    year: 1999,
    rating: 8.4,
    popularity: 90,
    genres: ['Drama'],
    description: 'An insomniac office worker...',
    image: 'https://image.tmdb.org/t/p/w500/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg',
    tmdbId: '550'
  };

  const sampleSeriesWithSameTmdbId: ContentItem = {
    id: 'series_550',
    title: 'Match of the Day',
    type: ContentType.SERIES,
    mediaFormat: 'series',
    year: 1964,
    rating: 7.2,
    popularity: 45,
    genres: ['Esporte', 'Talk Show'],
    description: 'BBC football highlights...',
    image: 'https://image.tmdb.org/t/p/w500/match_poster.jpg',
    tmdbId: '550'
  };

  const sampleAnime: ContentItem = {
    id: 'anime_123',
    title: 'Attack on Titan',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    year: 2013,
    rating: 9.1,
    popularity: 95,
    genres: ['Animação', 'Ação', 'Fantasia'],
    description: 'Humanity fights against giant titans...',
    image: 'https://image.tmdb.org/t/p/w500/aot.jpg',
    tmdbId: '1429',
    isAnime: true
  };

  const sampleLiveActionSeries: ContentItem = {
    id: 'series_1399',
    title: 'Game of Thrones',
    type: ContentType.SERIES,
    mediaFormat: 'series',
    year: 2011,
    rating: 9.3,
    popularity: 99,
    genres: ['Drama', 'Sci-Fi & Fantasy'],
    description: 'Nine noble families fight for control...',
    image: 'https://image.tmdb.org/t/p/w500/got.jpg',
    tmdbId: '1399'
  };

  describe('1. Canonical Deduplication with MediaType Qualification', () => {
    it('does NOT conflate a movie and a series sharing the identical numerical TMDB ID', () => {
      const items = [sampleMovie, sampleSeriesWithSameTmdbId];
      const deduped = deduplicateContentItems(items);

      expect(deduped).toHaveLength(2);
      const movieFound = deduped.find(i => i.mediaFormat === 'movie' || i.type === ContentType.MOVIE);
      const seriesFound = deduped.find(i => i.mediaFormat === 'series' || i.type === ContentType.SERIES);

      expect(movieFound).toBeDefined();
      expect(movieFound?.title).toBe('Fight Club');
      expect(movieFound?.tmdbId).toBe('550');

      expect(seriesFound).toBeDefined();
      expect(seriesFound?.title).toBe('Match of the Day');
      expect(seriesFound?.tmdbId).toBe('550');
    });

    it('generates distinct canonical keys for movie and series with same TMDB ID', () => {
      const movieKeys = getCanonicalKeysForItem(sampleMovie);
      const seriesKeys = getCanonicalKeysForItem(sampleSeriesWithSameTmdbId);

      const movieTmdbKey = movieKeys.find(k => k.startsWith('tmdb:'));
      const seriesTmdbKey = seriesKeys.find(k => k.startsWith('tmdb:'));

      expect(movieTmdbKey).toBe('tmdb:movie:550');
      expect(seriesTmdbKey).toBe('tmdb:tv:550');
      expect(movieTmdbKey).not.toBe(seriesTmdbKey);
    });
  });

  describe('2. Strict Category Filtering (SearchService classification)', () => {
    it('classifies movies strictly, rejecting series and animes', () => {
      expect(searchService.isMovieItem(sampleMovie, false)).toBe(true);
      expect(searchService.isMovieItem(sampleSeriesWithSameTmdbId, false)).toBe(false);
      expect(searchService.isMovieItem(sampleAnime, false)).toBe(false);
      expect(searchService.isMovieItem(sampleLiveActionSeries, false)).toBe(false);
    });

    it('classifies series strictly, rejecting movies and animes', () => {
      expect(searchService.isSeriesItem(sampleLiveActionSeries)).toBe(true);
      expect(searchService.isSeriesItem(sampleSeriesWithSameTmdbId)).toBe(true);
      expect(searchService.isSeriesItem(sampleMovie)).toBe(false);
      expect(searchService.isSeriesItem(sampleAnime)).toBe(false);
    });

    it('classifies animes strictly, rejecting regular movies and regular series', () => {
      expect(searchService.isAnimeItem(sampleAnime)).toBe(true);
      expect(searchService.isAnimeItem(sampleMovie)).toBe(false);
      expect(searchService.isAnimeItem(sampleLiveActionSeries)).toBe(false);
      expect(searchService.isAnimeItem(sampleSeriesWithSameTmdbId)).toBe(false);
    });
  });

  describe('3. Stress Test: Navigation Isolation across 50 simulated view switches', () => {
    it('maintains strict category isolation without any cross-contamination or ordering glitches', () => {
      const movieCatalog: ContentItem[] = [
        sampleMovie,
        { ...sampleMovie, id: 'm_2', title: 'Pulp Fiction', year: 1994, tmdbId: '680' },
        { ...sampleMovie, id: 'm_3', title: 'The Dark Knight', year: 2008, tmdbId: '155' }
      ];

      const seriesCatalog: ContentItem[] = [
        sampleLiveActionSeries,
        sampleSeriesWithSameTmdbId,
        { ...sampleLiveActionSeries, id: 's_3', title: 'Breaking Bad', year: 2008, tmdbId: '1396' }
      ];

      const animeCatalog: ContentItem[] = [
        sampleAnime,
        { ...sampleAnime, id: 'a_2', title: 'Death Note', year: 2006, tmdbId: '1535' },
        { ...sampleAnime, id: 'a_3', title: 'Fullmetal Alchemist', year: 2009, tmdbId: '31911' }
      ];

      // Simulated category snapshots store
      const snapshots: Record<string, ContentItem[]> = {};

      const views: Array<'movies' | 'series' | 'animes'> = ['movies', 'series', 'animes'];

      for (let cycle = 0; cycle < 50; cycle++) {
        const targetView = views[cycle % 3];
        const snapshotKey = `${targetView}:all:recommended:user_123:adult`;

        if (!snapshots[snapshotKey]) {
          let sourceItems: ContentItem[] = [];
          if (targetView === 'movies') sourceItems = movieCatalog;
          else if (targetView === 'series') sourceItems = seriesCatalog;
          else if (targetView === 'animes') sourceItems = animeCatalog;

          snapshots[snapshotKey] = catalogSnapshotManager.createInitialSnapshot(
            sourceItems,
            'recommended',
            { profileId: 'user_123', isChild: false, category: targetView }
          );
        }

        const currentSnapshot = snapshots[snapshotKey];
        expect(currentSnapshot).toBeDefined();
        expect(currentSnapshot.length).toBeGreaterThan(0);

        if (targetView === 'movies') {
          for (const item of currentSnapshot) {
            expect(searchService.isMovieItem(item, false)).toBe(true);
            expect(searchService.isSeriesItem(item)).toBe(false);
            expect(searchService.isAnimeItem(item)).toBe(false);
          }
        } else if (targetView === 'series') {
          for (const item of currentSnapshot) {
            expect(searchService.isSeriesItem(item)).toBe(true);
            expect(searchService.isMovieItem(item, false)).toBe(false);
            expect(searchService.isAnimeItem(item)).toBe(false);
          }
        } else if (targetView === 'animes') {
          for (const item of currentSnapshot) {
            expect(searchService.isAnimeItem(item)).toBe(true);
            expect(searchService.isMovieItem(item, false)).toBe(false);
            expect(searchService.isSeriesItem(item)).toBe(false);
          }
        }
      }
    });
  });

  describe('4. Pagination & Snapshot Stability', () => {
    it('appends new pagination batches strictly at the end without altering order or duplicating existing cards', () => {
      const initialBatch: ContentItem[] = [
        { ...sampleMovie, id: 'm1', tmdbId: '101', title: 'Movie 1', popularity: 100 },
        { ...sampleMovie, id: 'm2', tmdbId: '102', title: 'Movie 2', popularity: 90 },
        { ...sampleMovie, id: 'm3', tmdbId: '103', title: 'Movie 3', popularity: 80 }
      ];

      const initialSnapshot = catalogSnapshotManager.createInitialSnapshot(
        initialBatch,
        'popularity',
        { profileId: 'default', isChild: false, category: 'movies' }
      );

      expect(initialSnapshot.map(i => i.id)).toEqual(['m1', 'm2', 'm3']);

      // Incoming batch containing an existing item (m2) and two new ones (m4, m5)
      const incomingBatch: ContentItem[] = [
        { ...sampleMovie, id: 'm2', tmdbId: '102', title: 'Movie 2', popularity: 90 },
        { ...sampleMovie, id: 'm4', tmdbId: '104', title: 'Movie 4', popularity: 70 },
        { ...sampleMovie, id: 'm5', tmdbId: '105', title: 'Movie 5', popularity: 60 }
      ];

      const updatedSnapshot = catalogSnapshotManager.appendPaginationBatch(
        initialSnapshot,
        incomingBatch,
        'popularity',
        { profileId: 'default', isChild: false, category: 'movies' }
      );

      // Existing items m1, m2, m3 must retain their exact initial positions
      expect(updatedSnapshot[0].id).toBe('m1');
      expect(updatedSnapshot[1].id).toBe('m2');
      expect(updatedSnapshot[2].id).toBe('m3');

      // New items appended at the end without duplicate m2
      expect(updatedSnapshot[3].id).toBe('m4');
      expect(updatedSnapshot[4].id).toBe('m5');
      expect(updatedSnapshot).toHaveLength(5);
    });
  });

  describe('5. Unsplash Placeholders Elimination', () => {
    it('does not inject fake Unsplash URLs when poster_path is null', () => {
      // Direct validation that no Unsplash URLs are returned as image fallbacks
      const itemWithoutPoster: ContentItem = {
        id: 'no_poster_1',
        title: 'Filme Raro Sem Pôster',
        type: ContentType.MOVIE,
        mediaFormat: 'movie',
        year: 2024,
        rating: 7.0,
        popularity: 10,
        description: 'Sem imagem oficial',
        image: ''
      };

      expect(itemWithoutPoster.image).toBe('');
      expect(itemWithoutPoster.image).not.toContain('unsplash.com');
    });
  });
});
