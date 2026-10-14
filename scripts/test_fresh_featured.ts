import fs from 'fs';
import path from 'path';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { imdbWeeklyRankingService } from '../src/core/rankings/IMDbWeeklyRankingService';

// Remove old cache file
const cachePath = path.resolve(process.cwd(), 'data', 'featured_weekly_selection.json');
if (fs.existsSync(cachePath)) {
  fs.unlinkSync(cachePath);
  console.log('Old cache removed.');
}

const selection = featuredRankingService.recomputeFeaturedSelectionSync();
console.log('=== APPROVED MOVIES ===');
selection.featuredMovies.forEach((m, idx) => {
  console.log(`#${idx + 1} (IMDb #${m.imdbRank}) | ${m.title} | ${m.imdbId} | type: ${m.type}`);
});

console.log('\n=== APPROVED SERIES ===');
selection.featuredSeries.forEach((s, idx) => {
  console.log(`#${idx + 1} (IMDb #${s.imdbRank}) | ${s.title} | ${s.imdbId} | type: ${s.type}`);
});

console.log('\n=== CORRESPONDENCE AUDIT ===');
const audit = imdbWeeklyRankingService.verifyCorrespondence(selection.featuredMovies, selection.featuredSeries);
console.log('Is Compliant:', audit.isCompliant);
console.log('Movie Mismatches:', audit.movieMismatches);
console.log('Series Mismatches:', audit.seriesMismatches);
console.log('\n=== REJECTED MOVIES ===');
selection.auditTrail.rejectedMovies.forEach(r => console.log(`IMDb #${r.imdbRank || r.rankPosition} | ${r.title} (${r.imdbId}) -> ${r.rejectionReason}`));
