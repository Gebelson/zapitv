import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';

console.log('--- VERIFIED OPEN ITEMS ---');
for (const it of VERIFIED_OPEN_ITEMS) {
  console.log(`${it.type} | id: ${it.id} | imdbId: ${it.imdbId} | title: ${it.title} | year: ${it.year}`);
}
