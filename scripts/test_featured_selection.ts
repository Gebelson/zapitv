import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';

const res = featuredRankingService.getFeaturedSelectionSync();
console.log('FEATURED MOVIES COUNT:', res.featuredMovies.length);
res.featuredMovies.forEach((m, idx) => console.log(`Movie #${idx+1}: [${m.imdbId}] ${m.title} (ID: ${m.id}) - streams: ${m.verifiedStreams?.length || 0}`));

console.log('FEATURED SERIES COUNT:', res.featuredSeries.length);
res.featuredSeries.forEach((s, idx) => console.log(`Series #${idx+1}: [${s.imdbId}] ${s.title} (ID: ${s.id}) - eps: ${s.episodes?.length || 0}`));
