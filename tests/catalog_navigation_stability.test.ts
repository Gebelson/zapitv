import { describe, it, expect } from 'vitest';
import { catalogSnapshotManager, CatalogSortOption } from '../src/core/catalog/CatalogSnapshotManager';
import { ContentItem } from '../types';

const createMockItem = (id: string, title: string, year: number, rating: number, popularity: number, genres: string[] = ['Ação']): ContentItem => ({
  id,
  title,
  type: 'movie',
  year,
  rating,
  duration: '120 min',
  genres,
  description: 'Test movie description',
  coverUrl: `https://example.com/${id}.jpg`,
  popularity,
  releaseDate: `${year}-01-01`
});

describe('Catalog Navigation Stability & Snapshot Manager', () => {
  const mockItems: ContentItem[] = [
    createMockItem('m1', 'Interestelar', 2014, 8.7, 95),
    createMockItem('m2', 'A Origem', 2010, 8.8, 98),
    createMockItem('m3', 'Batman: O Cavaleiro das Trevas', 2008, 9.0, 99),
    createMockItem('m4', 'Duna: Parte 2', 2024, 8.5, 96),
    createMockItem('m5', 'O Poderoso Chefão', 1972, 9.2, 90)
  ];

  it('respects manual sorting by release_date (newest first)', () => {
    const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'release_date');
    expect(sorted[0].id).toBe('m4'); // 2024
    expect(sorted[1].id).toBe('m1'); // 2014
    expect(sorted[2].id).toBe('m2'); // 2010
    expect(sorted[3].id).toBe('m3'); // 2008
    expect(sorted[4].id).toBe('m5'); // 1972
  });

  it('respects manual sorting by rating (highest first)', () => {
    const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'rating');
    expect(sorted[0].id).toBe('m5'); // 9.2
    expect(sorted[1].id).toBe('m3'); // 9.0
    expect(sorted[2].id).toBe('m2'); // 8.8
    expect(sorted[3].id).toBe('m1'); // 8.7
    expect(sorted[4].id).toBe('m4'); // 8.5
  });

  it('respects manual sorting by popularity (highest first)', () => {
    const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'popularity');
    expect(sorted[0].id).toBe('m3'); // 99
    expect(sorted[1].id).toBe('m2'); // 98
    expect(sorted[2].id).toBe('m4'); // 96
    expect(sorted[3].id).toBe('m1'); // 95
    expect(sorted[4].id).toBe('m5'); // 90
  });

  it('respects manual sorting by title_az', () => {
    const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'title_az');
    expect(sorted[0].id).toBe('m2'); // A Origem
    expect(sorted[1].id).toBe('m3'); // Batman: O Cavaleiro das Trevas
    expect(sorted[2].id).toBe('m4'); // Duna: Parte 2
    expect(sorted[3].id).toBe('m1'); // Interestelar
    expect(sorted[4].id).toBe('m5'); // O Poderoso Chefão
  });

  it('appendPaginationBatch preserves exact order of existing items and appends new items strictly at the end', () => {
    const initialBatch = mockItems.slice(0, 3); // m1, m2, m3
    const newBatch = [
      mockItems[1], // Duplicate m2 (should be ignored)
      createMockItem('m6', 'Matrix', 1999, 8.7, 92),
      createMockItem('m7', 'Gladiador', 2000, 8.5, 91)
    ];

    const result = catalogSnapshotManager.appendPaginationBatch(
      initialBatch,
      newBatch,
      'recommended',
      { profileId: 'default', isChild: false, category: 'movies' }
    );

    // Initial items must not move or change positions
    expect(result.length).toBe(5);
    expect(result[0].id).toBe('m1');
    expect(result[1].id).toBe('m2');
    expect(result[2].id).toBe('m3');

    // New items appended at the end without duplicate m2
    expect(result.slice(3).map(i => i.id).sort()).toEqual(['m6', 'm7']);
  });

  it('appendPaginationBatch sorts only the incoming new items according to manual sort and appends them at the end', () => {
    const initialBatch = [mockItems[0], mockItems[1]]; // m1 (2014), m2 (2010)
    const incomingBatch = [
      createMockItem('m-old', 'Old Movie', 1980, 7.0, 50),
      createMockItem('m-new', 'New Movie', 2023, 8.0, 80)
    ];

    // Even if incoming items have newer/older dates, they must NOT jump in front of initialBatch
    const result = catalogSnapshotManager.appendPaginationBatch(
      initialBatch,
      incomingBatch,
      'release_date',
      { profileId: 'default', isChild: false, category: 'movies' }
    );

    expect(result.length).toBe(4);
    expect(result[0].id).toBe('m1');
    expect(result[1].id).toBe('m2');
    // Among new items, m-new (2023) comes before m-old (1980)
    expect(result[2].id).toBe('m-new');
    expect(result[3].id).toBe('m-old');
  });

  it('createInitialSnapshot creates a stable snapshot without mutating external arrays', () => {
    const base = [...mockItems];
    const snapshot = catalogSnapshotManager.createInitialSnapshot(base, 'title_az', {
      profileId: 'default',
      isChild: false,
      category: 'movies'
    });

    expect(snapshot.length).toBe(base.length);
    // Base array unchanged
    expect(base[0].id).toBe('m1');
    // Snapshot is sorted
    expect(snapshot[0].id).toBe('m2');
  });
});
