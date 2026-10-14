import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService.ts';

const res = featuredRankingService.getFeaturedSelectionSync();
console.log('=== APPROVED MOVIES ===');
res.featuredMovies.forEach((m, idx) => {
  console.log((idx + 1) + '. ' + m.title + ' | IMDb: ' + m.imdbId + ' | ID: ' + m.id + ' | streams: ' + JSON.stringify((m.verifiedStreams || []).map(s => s.url)));
});

console.log('\n=== APPROVED SERIES ===');
res.featuredSeries.forEach((s, idx) => {
  console.log((idx + 1) + '. ' + s.title + ' | IMDb: ' + s.imdbId + ' | ID: ' + s.id + ' | ep1: ' + s.episodes?.[0]?.videoUrl);
});
