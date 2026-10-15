import { filmesData } from '../constants';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { searchService } from '../src/core/search/SearchService';
import { catalogSnapshotManager } from '../src/core/catalog/CatalogSnapshotManager';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { ContentItem } from '../types';

// Simular estado inicial de content no App.tsx
const initialContent = deduplicateContentItems([...VERIFIED_OPEN_ITEMS, ...filmesData]);

console.log('Total initialContent:', initialContent.length);

// Simular popularMovies, popularSeries, animeItems vazios (ou vindos de discover)
const popularMovies: ContentItem[] = [];
const popularSeries: ContentItem[] = [];
const animeItems: ContentItem[] = [];

// Função getEligibleBrowseItems exatamente como no App.tsx
function getEligibleBrowseItems(view: 'movies' | 'series' | 'animes', genre: string, content: ContentItem[]): ContentItem[] {
  let source: ContentItem[] = [];
  if (view === 'movies') {
    const catalogMovies = content.filter(i => searchService.isMovieItem(i, false));
    source = deduplicateContentItems([...popularMovies, ...catalogMovies]).filter(i => searchService.isMovieItem(i, false));
  } else if (view === 'series') {
    const catalogSeries = content.filter(i => searchService.isSeriesItem(i));
    source = deduplicateContentItems([...popularSeries, ...catalogSeries]).filter(i => searchService.isSeriesItem(i));
  } else if (view === 'animes') {
    const catalogAnimes = content.filter(i => searchService.isAnimeItem(i));
    source = deduplicateContentItems([...animeItems, ...catalogAnimes]).filter(i => searchService.isAnimeItem(i));
  }

  const isAdultGenre = genre === 'Adulto';
  let genreFiltered = source;
  if (genre && genre !== 'Todos') {
    genreFiltered = source.filter(i => i.genres?.includes(genre));
  }

  const unique = deduplicateContentItems(genreFiltered);
  return catalogEligibilityService.filterEligibleItemsSync(unique, { allowAdult: isAdultGenre });
}

console.log('Movies eligible:', getEligibleBrowseItems('movies', '', initialContent).length);
console.log('Series eligible:', getEligibleBrowseItems('series', '', initialContent).length);
console.log('Animes eligible:', getEligibleBrowseItems('animes', '', initialContent).length);

// Amostra dos títulos retornados
console.log('Movies sample:', getEligibleBrowseItems('movies', '', initialContent).slice(0, 3).map(i => i.title));
console.log('Series sample:', getEligibleBrowseItems('series', '', initialContent).slice(0, 3).map(i => i.title));
console.log('Animes sample:', getEligibleBrowseItems('animes', '', initialContent).slice(0, 3).map(i => i.title));
