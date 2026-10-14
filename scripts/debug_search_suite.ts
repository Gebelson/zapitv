import { searchService } from '../src/core/search/searchService';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';

async function debug() {
  console.log('=== TEST 8 DEBUG: Naruto on series ===');
  const narutoSeriesRaw = await tmdbService.searchSeries('Naruto');
  console.log('tmdbService.searchSeries("Naruto"):', narutoSeriesRaw.map(i => ({ title: i.title, type: i.type, genres: i.genres })));

  console.log('\n=== TEST 5 DEBUG: One piece on series ===');
  const opSeriesRaw = await tmdbService.searchSeries('One Piece');
  console.log('tmdbService.searchSeries("One Piece"):', opSeriesRaw.map(i => ({ title: i.title, type: i.type, genres: i.genres, year: i.year })));
  const opEligible = catalogEligibilityService.filterEligibleItemsSync(opSeriesRaw);
  console.log('Eligible One Piece on series:', opEligible.map(i => ({ title: i.title, year: i.year })));
}
debug();
