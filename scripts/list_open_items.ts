import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog.ts';

console.log('=== ALL ITEMS IN VERIFIED_OPEN_ITEMS ===');
VERIFIED_OPEN_ITEMS.forEach((it, idx) => {
  console.log(`${idx + 1}. [${it.type}] ${it.title} (${it.id}, imdb: ${it.imdbId}) - streams: ${it.verifiedStreams?.length || 0}, eps: ${it.episodes?.length || 0}`);
});
