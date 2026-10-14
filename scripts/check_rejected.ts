import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService.ts';

const res = featuredRankingService.getFeaturedSelectionSync();
console.log('=== REJECTED MOVIES AUDIT ===');
res.auditTrail.rejectedMovies.forEach(m => {
  console.log(`Pos ${m.imdbRank || m.rankPosition}: ${m.title} (${m.imdbId}) -> Motivo: ${m.rejectionReason} (status: ${m.availabilityStatus})`);
});
