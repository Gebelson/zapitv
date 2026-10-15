import { searchService } from '../src/core/search/SearchService';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { filmesData } from '../constants';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { ContentType } from '../types';

async function run() {
  console.log('--- DIAGNOSTIC SCRIPT ---');
  
  // 1. Procurar Lanterns, Walking Dead, Oppenheimer, Deadpool em filmesData e FEATURED_CATALOG_ITEMS
  const allStatic = [...filmesData, ...FEATURED_CATALOG_ITEMS];
  const foundLanterns = allStatic.filter(i => i.title?.toLowerCase().includes('lantern') || i.originalTitle?.toLowerCase().includes('lantern'));
  console.log('Static Lanterns:', foundLanterns.map(i => ({ id: i.id, title: i.title, type: i.type, mediaFormat: i.mediaFormat, isMovie: searchService.isMovieItem(i), isSeries: searchService.isSeriesItem(i) })));

  const foundWalkingDead = allStatic.filter(i => i.title?.toLowerCase().includes('walking dead'));
  console.log('Static Walking Dead:', foundWalkingDead.map(i => ({ id: i.id, title: i.title, type: i.type, mediaFormat: i.mediaFormat, isMovie: searchService.isMovieItem(i), isSeries: searchService.isSeriesItem(i) })));

  // 2. Testar imagens de Verity, Dia D, A Odisseia, Widow's Bay
  const testTitles = ['Verity', 'Dia D', 'A Odisseia', "Widow's Bay"];
  for (const t of testTitles) {
    const match = allStatic.find(i => i.title?.toLowerCase().includes(t.toLowerCase()) || i.originalTitle?.toLowerCase().includes(t.toLowerCase()));
    if (match) {
      console.log(`Image for ${match.title}:`, { image: match.image, backdrop: match.backdrop, imdbId: match.imdbId, tmdbId: match.tmdbId });
    }
  }

  // 3. Testar busca no TMDB para The Walking Dead
  try {
    const twdSearch = await tmdbService.searchMulti('The Walking Dead');
    console.log('TMDB Search for The Walking Dead first 2 items:', twdSearch.slice(0, 2).map(r => ({ id: r.id, title: r.title, type: r.type, mediaFormat: r.mediaFormat, isMovie: searchService.isMovieItem(r), isSeries: searchService.isSeriesItem(r) })));
  } catch (e) {
    console.log('Error searching TMDB:', e);
  }
}

run();
