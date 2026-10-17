import { sourceVerificationService } from '../src/core/providers/sourceVerificationService';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import { filmesData } from '../constants';
import { ContentType } from '../types';

async function testAll() {
  const titlesToTest = [
    // 1. Featured items
    FEATURED_CATALOG_ITEMS.find(i => i.id.includes('odisseia')),
    FEATURED_CATALOG_ITEMS.find(i => i.id.includes('verity')),
    FEATURED_CATALOG_ITEMS.find(i => i.id.includes('dia-d')),
    // 2. Verified open items
    VERIFIED_OPEN_ITEMS.find(i => i.id.includes('bleach')),
    VERIFIED_OPEN_ITEMS.find(i => i.id.includes('doraemon')),
    // 3. Regular movie from filmesData
    filmesData[0],
    filmesData[1],
    // 4. TMDB items without local streams
    {
      id: 'tt0109830',
      imdbId: 'tt0109830',
      title: 'Forrest Gump',
      type: ContentType.MOVIE,
      year: 1994
    },
    // 5. Series
    {
      id: 'tt0903747',
      imdbId: 'tt0903747',
      title: 'Breaking Bad',
      type: ContentType.SERIES,
      year: 2008
    }
  ].filter(Boolean);

  for (const item of titlesToTest) {
    console.log(`\n========================================`);
    console.log(`TESTING: ${item.title} (${item.id}) [type: ${item.type}]`);
    const ep = item.type === ContentType.SERIES ? { season: 1, episode: 1 } : undefined;
    const start = Date.now();
    try {
      const res = await sourceVerificationService.verifySources(item as any, ep);
      const dur = Date.now() - start;
      console.log(`-> State: ${res.state} | Streams: ${res.streams.length} | Duration: ${dur}ms`);
      if (res.state === 'INCONCLUSIVE') {
        console.log(`   INCONCLUSIVE REASON: ${res.diagnosticLog.inconclusiveReason}`);
        console.log(`   Timeouts:`, res.diagnosticLog.timeouts);
        console.log(`   NetworkErrors:`, res.diagnosticLog.networkErrors);
      }
      if (res.streams.length > 0) {
        console.log(`   Top Stream: [${res.streams[0].providerName}] ${res.streams[0].title}`);
      }
    } catch (err: any) {
      console.log(`-> THREW ERROR: ${err.message}`);
    }
  }
}

testAll().catch(console.error);
