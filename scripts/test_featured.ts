import { filmesData } from '../constants.js';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog.js';

const featuredFilmes = filmesData.filter(i => i.isFeatured);
const featuredOpen = VERIFIED_OPEN_ITEMS.filter(i => i.isFeatured);

console.log('filmesData isFeatured count:', featuredFilmes.length);
featuredFilmes.forEach(i => console.log('filmesData:', i.id, i.title));

console.log('VERIFIED_OPEN_ITEMS isFeatured count:', featuredOpen.length);
featuredOpen.forEach(i => console.log('VERIFIED_OPEN_ITEMS:', i.id, i.title));
