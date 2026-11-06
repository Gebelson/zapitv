import {canonicalCatalogMaster} from '../src/core/catalog/CanonicalCatalogMaster';
import assert from 'node:assert/strict';
import {catalogSnapshotManager} from '../src/core/catalog/CatalogSnapshotManager';
import {ContentType, type ContentItem} from '../types';
const items = [
 {id:'sort-b',title:'Zulu',type:ContentType.MOVIE,year:2020,rating:7,image:''},
 {id:'sort-a',title:'Alpha',type:ContentType.MOVIE,year:2021,rating:8,image:''}
] as ContentItem[];
for(const [option,expected] of [['title_az','sort-a'],['title_za','sort-b']] as const){
 const sorted=catalogSnapshotManager.sortItemsByOption(items,option);
 assert.equal(sorted[0].id,expected);
 assert.notEqual(sorted,items);
 assert.equal(items[0].id,'sort-b');
}
console.log('Catalog sorting preserves order semantics and input immutability');

canonicalCatalogMaster.dispose();
