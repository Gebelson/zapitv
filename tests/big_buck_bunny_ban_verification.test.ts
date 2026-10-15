import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage para ambiente Node no Vitest
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

import { bannedContentRegistry } from '../src/core/catalog/BannedContentRegistry';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { mediaAvailabilityIndex } from '../src/core/catalog/MediaAvailabilityIndex';
import { searchService } from '../src/core/search/searchService';
import { recommendationEngine } from '../src/core/recommendations/recommendationEngine';
import { similarTitlesService } from '../src/core/recommendations/similarTitlesService';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { storageService } from '../src/core/storage/storageService';
import { ContentType, ContentItem } from '../types';

describe('Big Buck Bunny - Remoção Definitiva e Registro Centralizado de Exclusão', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const bbbVariations: Partial<ContentItem>[] = [
    { id: 'open-big-buck-bunny', title: 'Big Buck Bunny (1080p FHD)', type: ContentType.MOVIE },
    { id: 'tt1285241', title: 'Big Buck Bunny', type: ContentType.MOVIE },
    { id: 'movie-bbb-1', title: 'big_buck_bunny', type: ContentType.MOVIE },
    { id: 'sample-bunny', title: 'Buck Bunny 4K', type: ContentType.MOVIE },
    { id: 'test-stream-1', title: 'Filme Qualquer', videoUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
  ];

  it('1. BannedContentRegistry identifica todas as variações de Big Buck Bunny e Caminandes', () => {
    for (const item of bbbVariations) {
      expect(bannedContentRegistry.isBanned(item as ContentItem)).toBe(true);
    }

    expect(bannedContentRegistry.isBannedKeyOrId('open-big-buck-bunny')).toBe(true);
    expect(bannedContentRegistry.isBannedKeyOrId('tt1285241')).toBe(true);
    expect(bannedContentRegistry.isBannedTitle('Big Buck Bunny (1080p FHD)')).toBe(true);
    expect(bannedContentRegistry.isBannedTitle('big buck bunny')).toBe(true);
    expect(bannedContentRegistry.isBannedTitle('Caminandes')).toBe(true);

    // Obras legítimas não devem ser banidas
    expect(bannedContentRegistry.isBannedTitle('Sintel')).toBe(false);
    expect(bannedContentRegistry.isBannedTitle('Tears of Steel')).toBe(false);
    expect(bannedContentRegistry.isBannedTitle('Interestelar')).toBe(false);
  });

  it('2. VERIFIED_OPEN_ITEMS não contém Big Buck Bunny nem Caminandes', () => {
    const hasBBB = VERIFIED_OPEN_ITEMS.some(it => bannedContentRegistry.isBanned(it));
    expect(hasBBB).toBe(false);

    const bbbItem = VERIFIED_OPEN_ITEMS.find(it => /bunny/i.test(it.title) || it.id === 'open-big-buck-bunny');
    expect(bbbItem).toBeUndefined();
  });

  it('3. CatalogEligibilityService bloqueia sincronamente Big Buck Bunny de exibição pública', () => {
    for (const item of bbbVariations) {
      const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(item as ContentItem);
      expect(isPlayable).toBe(false);
    }

    const testList = [
      { id: 'open-big-buck-bunny', title: 'Big Buck Bunny (1080p FHD)', type: ContentType.MOVIE, year: 2008 },
      { id: 'open-sintel', title: 'Sintel', type: ContentType.MOVIE, year: 2010, availabilityStatus: 'verified' }
    ] as ContentItem[];

    const filtered = catalogEligibilityService.filterEligibleItemsSync(testList);
    expect(filtered.some(i => i.id === 'open-big-buck-bunny')).toBe(false);
    expect(filtered.some(i => i.id === 'open-sintel')).toBe(true);
  });

  it('4. MediaAvailabilityIndex considera Big Buck Bunny inelegível para catálogo público', () => {
    expect(mediaAvailabilityIndex.isPubliclyPlayable('open-big-buck-bunny')).toBe(false);
    expect(mediaAvailabilityIndex.isPubliclyPlayable('tt1285241')).toBe(false);
    expect(mediaAvailabilityIndex.isPubliclyPlayable('big-buck-bunny')).toBe(false);
    expect(mediaAvailabilityIndex.isPubliclyPlayable('open-sintel')).toBe(true);
  });

  it('5. SearchService descarta buscas por Big Buck Bunny e exclui dos resultados locais', async () => {
    const searchResults = await searchService.search('Big Buck Bunny', 'all');
    expect(searchResults).toEqual([]);

    const localCatalog = [
      { id: 'open-big-buck-bunny', title: 'Big Buck Bunny', type: ContentType.MOVIE },
      { id: 'open-sintel', title: 'Sintel', type: ContentType.MOVIE }
    ] as ContentItem[];

    const filtered = searchService.filterLocalCatalog('bunny', 'all', localCatalog);
    expect(filtered).toHaveLength(0);

    const filteredSintel = searchService.filterLocalCatalog('sintel', 'all', localCatalog);
    expect(filteredSintel).toHaveLength(1);
    expect(filteredSintel[0].title).toBe('Sintel');
  });

  it('6. RecommendationEngine não recomenda Big Buck Bunny nem como candidato', () => {
    const mixedCatalog = [
      { id: 'open-big-buck-bunny', title: 'Big Buck Bunny', type: ContentType.MOVIE, year: 2008, rating: 8.5 },
      { id: 'open-sintel', title: 'Sintel', type: ContentType.MOVIE, year: 2010, rating: 8.0, availabilityStatus: 'verified', genres: ['Animação'] }
    ] as ContentItem[];

    const candidates = recommendationEngine.generateCandidates(mixedCatalog, {
      category: 'all',
      historyItems: []
    });

    expect(candidates.some(c => c.id === 'open-big-buck-bunny')).toBe(false);
  });

  it('7. SimilarTitlesService bloqueia Big Buck Bunny como fonte ou recomendação similar', async () => {
    const bbb = { id: 'open-big-buck-bunny', title: 'Big Buck Bunny', type: ContentType.MOVIE } as ContentItem;
    const sintel = { id: 'open-sintel', title: 'Sintel', type: ContentType.MOVIE, genres: ['Animação'], availabilityStatus: 'verified' } as ContentItem;

    const fromBbb = await similarTitlesService.getSimilarTitles(bbb, [sintel]);
    expect(fromBbb).toEqual([]);

    const fromSintel = await similarTitlesService.getSimilarTitles(sintel, [bbb]);
    expect(fromSintel.some(it => it.id === 'open-big-buck-bunny')).toBe(false);
  });

  it('8. ProviderRegistry bloqueia resolução de streams para Big Buck Bunny e streams de teste banidos', async () => {
    const streams = await providerRegistry.resolveStreamsFresh('movie', {
      id: 'open-big-buck-bunny',
      title: 'Big Buck Bunny',
      imdbId: 'tt1285241'
    });
    expect(streams).toEqual([]);

    // Streams com URL ou títulos banidos são bloqueados por isBannedStream
    expect(bannedContentRegistry.isBannedStream({ url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' })).toBe(true);
    expect(bannedContentRegistry.isBannedStream({ title: 'Big Buck Bunny 1080p' })).toBe(true);
  });

  it('9. StorageService purga Big Buck Bunny de favoritos, caches e histórico', () => {
    localStorage.setItem('zapitv_local_favorites', JSON.stringify(['open-big-buck-bunny', 'open-sintel']));
    localStorage.setItem('zapitv_catalog_movies', JSON.stringify([
      { id: 'open-big-buck-bunny', title: 'Big Buck Bunny' },
      { id: 'open-sintel', title: 'Sintel' }
    ]));
    localStorage.setItem('open-big-buck-bunny', 'cached_data');

    storageService.purgeBannedItemsFromStorage();

    const cleanFavorites = JSON.parse(localStorage.getItem('zapitv_local_favorites') || '[]');
    expect(cleanFavorites).toEqual(['open-sintel']);

    const cleanMovies = storageService.getCachedCatalog('movies');
    expect(cleanMovies.some(i => i.id === 'open-big-buck-bunny')).toBe(false);

    expect(localStorage.getItem('open-big-buck-bunny')).toBeNull();
  });
});
