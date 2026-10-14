import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';

const res = featuredRankingService.getFeaturedSelectionSync();
console.log('APPROVED SERIES:', res.featuredSeries.map(s => `${s.title} (${s.imdbId})`));
console.log('\nREJECTED SERIES:');
res.auditTrail.rejectedSeries.forEach(r => {
  console.log(` - [${r.imdbRank}] ${r.title} (${r.imdbId}): ${r.rejectionReason} | status: ${r.availabilityStatus}`);
});
