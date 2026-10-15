import { describe, it, expect, beforeEach } from 'vitest';
import { catalogSnapshotManager } from '../src/core/catalog/CatalogSnapshotManager';
import { searchService } from '../src/core/search/SearchService';
import { ContentItem, ContentType } from '../types';

describe('Navigation Switching Simulation Test', () => {
  const mockMovies: ContentItem[] = [
    { id: 'm1', title: 'Oppenheimer', type: ContentType.MOVIE, mediaFormat: 'movie', rating: 8.9, year: 2023, image: 'opp.jpg', tmdbId: '872585' },
    { id: 'm2', title: 'Deadpool & Wolverine', type: ContentType.MOVIE, mediaFormat: 'movie', rating: 8.0, year: 2024, image: 'dp.jpg', tmdbId: '533535' },
    { id: 'm3', title: 'Duna 2', type: ContentType.MOVIE, mediaFormat: 'movie', rating: 8.6, year: 2024, image: 'dune.jpg', tmdbId: '693134' }
  ];

  const mockSeries: ContentItem[] = [
    { id: 's1', title: 'The Walking Dead', type: ContentType.SERIES, mediaFormat: 'series', rating: 8.2, year: 2010, image: 'twd.jpg', tmdbId: '1402' },
    { id: 's2', title: 'Lanternas', type: ContentType.SERIES, mediaFormat: 'series', rating: 8.0, year: 2026, image: 'lanterns.jpg', tmdbId: '26540670' },
    { id: 's3', title: 'Breaking Bad', type: ContentType.SERIES, mediaFormat: 'series', rating: 9.5, year: 2008, image: 'bb.jpg', tmdbId: '1396' }
  ];

  const mockAnimes: ContentItem[] = [
    { id: 'a1', title: 'Attack on Titan', type: ContentType.ANIME, mediaFormat: 'series', rating: 9.1, year: 2013, image: 'aot.jpg', isAnime: true, tmdbId: '1429' },
    { id: 'a2', title: 'Naruto', type: ContentType.ANIME, mediaFormat: 'series', rating: 8.4, year: 2002, image: 'naruto.jpg', isAnime: true, tmdbId: '46260' },
    { id: 'a3', title: 'Your Name', type: ContentType.ANIME, mediaFormat: 'movie', rating: 8.9, year: 2016, image: 'yourname.jpg', isAnime: true, tmdbId: '372058' }
  ];

  it('verifies that each category strictly resolves only its own items', () => {
    // 1. Filmes
    const movieOnly = mockMovies.filter(i => searchService.isMovieItem(i, false));
    expect(movieOnly).toHaveLength(3);
    for (const m of movieOnly) {
      expect(searchService.isSeriesItem(m)).toBe(false);
      expect(searchService.isAnimeItem(m)).toBe(false);
    }

    // 2. Séries
    const seriesOnly = mockSeries.filter(i => searchService.isSeriesItem(i));
    expect(seriesOnly).toHaveLength(3);
    for (const s of seriesOnly) {
      expect(searchService.isMovieItem(s, false)).toBe(false);
      expect(searchService.isAnimeItem(s)).toBe(false);
    }

    // 3. Animes
    const animeOnly = mockAnimes.filter(i => searchService.isAnimeItem(i));
    expect(animeOnly).toHaveLength(3);
    for (const a of animeOnly) {
      expect(searchService.isAnimeItem(a)).toBe(true);
      expect(searchService.isSeriesItem(a)).toBe(false);
    }
  });
});
