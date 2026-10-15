import { filmesData } from '../constants';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { searchService } from '../src/core/search/SearchService';
import { ContentType } from '../types';

console.log('=== TEST CATALOG MIX DEBUG ===');
console.log('Total filmesData:', filmesData.length);
console.log('Total VERIFIED_OPEN_ITEMS:', VERIFIED_OPEN_ITEMS.length);
console.log('Total FEATURED_CATALOG_ITEMS:', FEATURED_CATALOG_ITEMS.length);

// 1. Verificar filmesData
const filmesDataMovies = filmesData.filter(i => searchService.isMovieItem(i, false));
const filmesDataSeries = filmesData.filter(i => searchService.isSeriesItem(i));
const filmesDataAnimes = filmesData.filter(i => searchService.isAnimeItem(i));
const filmesDataUnknown = filmesData.filter(i => !searchService.isMovieItem(i, false) && !searchService.isSeriesItem(i) && !searchService.isAnimeItem(i));

console.log('filmesData classification:', {
  movies: filmesDataMovies.length,
  series: filmesDataSeries.length,
  animes: filmesDataAnimes.length,
  unknown: filmesDataUnknown.length
});

if (filmesDataSeries.length > 0) {
  console.log('Series in filmesData (first 5):', filmesDataSeries.slice(0, 5).map(s => ({ id: s.id, title: s.title, type: s.type, mediaFormat: s.mediaFormat })));
}

if (filmesDataUnknown.length > 0) {
  console.log('Unknown in filmesData (first 5):', filmesDataUnknown.slice(0, 5).map(u => ({ id: u.id, title: u.title, type: u.type, mediaFormat: u.mediaFormat })));
}

// 2. Verificar se algum filme é classificado como série ou anime
for (const f of filmesData) {
  const isM = searchService.isMovieItem(f, false);
  const isS = searchService.isSeriesItem(f);
  const isA = searchService.isAnimeItem(f);
  if ((isM && isS) || (isM && isA) || (isS && isA)) {
    console.log('ITEM CLASSIFIED AS MULTIPLE CATEGORIES:', f.title, { isM, isS, isA, type: f.type, mediaFormat: f.mediaFormat });
  }
}
