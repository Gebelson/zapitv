import { filmesData } from '../constants.tsx';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog.ts';

const types: Record<string, number> = {};
filmesData.forEach(item => { types[item.type] = (types[item.type] || 0) + 1; });
console.log('filmesData count:', filmesData.length);
console.log('filmesData types:', types);

const openTypes: Record<string, number> = {};
VERIFIED_OPEN_ITEMS.forEach(item => { openTypes[item.type] = (openTypes[item.type] || 0) + 1; });
console.log('VERIFIED_OPEN_ITEMS count:', VERIFIED_OPEN_ITEMS.length);
console.log('VERIFIED_OPEN_ITEMS types:', openTypes);
