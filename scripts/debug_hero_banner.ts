import { tmdbService } from '../src/core/tmdb/tmdbClient.js';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService.js';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService.js';
import { filmesData } from '../constants.js';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog.js';

async function test() {
  console.log('Fetching trending...');
  const trending = await tmdbService.getTrending();
  console.log('Raw trending items count:', trending.length);
  trending.forEach(t => console.log('Trending item:', t.id, t.title, 'type:', t.type, 'year:', t.year));

  const eligibleTrending = catalogEligibilityService.filterEligibleItemsSync(trending);
  console.log('\nEligible trending count:', eligibleTrending.length);
  eligibleTrending.forEach(t => console.log('Eligible trending:', t.id, t.title));

  const sanitizedTrending = theatricalFilterService.filterAllowedMoviesSync(eligibleTrending);
  console.log('\nSanitized trending in Hero count:', sanitizedTrending.length);
  sanitizedTrending.forEach(t => console.log('Sanitized trending:', t.id, t.title));

  console.log('\nNow checking content.filter(i => i.isFeatured)...');
  const content = [...VERIFIED_OPEN_ITEMS, ...filmesData];
  const featuredContent = content.filter(i => i.isFeatured);
  console.log('Featured content count:', featuredContent.length);

  const eligibleFeatured = catalogEligibilityService.filterEligibleItemsSync(featuredContent);
  console.log('Eligible featured content count:', eligibleFeatured.length);
  eligibleFeatured.forEach(t => console.log('Eligible featured:', t.id, t.title));

  const sanitizedFeatured = theatricalFilterService.filterAllowedMoviesSync(eligibleFeatured);
  console.log('Sanitized featured in Hero count:', sanitizedFeatured.length);
  sanitizedFeatured.forEach(t => console.log('Sanitized featured:', t.id, t.title));
}

test();
