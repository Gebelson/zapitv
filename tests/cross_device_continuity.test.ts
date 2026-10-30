import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContentType, type ContentItem } from '../types';
import { resolveContinueWatchingItems, type WatchProgress } from '../src/core/storage/watchState';
const item = (id: string, title: string, type = ContentType.SERIES): ContentItem => ({ id, title, type, mediaFormat: type === ContentType.MOVIE ? 'movie' : 'series', year: 2020, rating: 0, image: 'https://image.tmdb.org/t/p/w500/fixture.jpg' });
export const continuityFixtures = [item('tt0388629','One Piece'), item('tt5753856','Dark'), item('tmdb-121','tmdb-121'), item('tt2531336','Lupin'), item('anilist-999001','Anime fixture')];
const progress = (it: ContentItem, index = 0): WatchProgress => ({ contentId: it.id, item: it, season: 1, episode: index + 1, currentTime: 120 + index, duration: 1200, percentage: 10, updatedAt: new Date(1700000000000 + index).toISOString() });
test('five persisted records survive partial and empty catalogs on every surface', () => {
  for (const catalog of [[], continuityFixtures.slice(0, 2)]) {
    const result = resolveContinueWatchingItems(continuityFixtures.map(progress), catalog);
    assert.equal(result.length, 5);
    assert.deepEqual(result.map(i => i.id), [...continuityFixtures].reverse().map(i=>i.id));
  }
});
test('incomplete catalog metadata never replaces a complete persisted title or poster', () => {
  const good = item('tmdb-121','Doctor Who'); good.year = 1963;
  const bad = { ...good, title: 'tmdb-121', year: 0, image: '' };
  const result = resolveContinueWatchingItems([progress(good)], [bad])[0];
  assert.equal(result.title, 'Doctor Who'); assert.equal(result.image, good.image); assert.equal(result.year, 1963);
});
test('equivalent aliases deduplicate but movie and TV numeric IDs remain distinct', () => {
  const tv = { ...item('tmdb-121','Doctor Who'), tmdbId: '121', imdbId: 'tt0056751' };
  const alias = { ...tv, id: 'tt0056751' };
  const film = item('tmdb-121','Movie fixture', ContentType.MOVIE);
  assert.equal(resolveContinueWatchingItems([progress(tv), progress(alias,1), progress(film)], []).length, 2);
});

import { ProfileContinuityService } from '../src/core/storage/ProfileContinuityService';
import { contentPoster } from '../src/core/storage/continuityMetadata';
test('exact typed Doctor Who recovery preserves episode, position, and remote revision', async () => {
  const raw = { ...continuityFixtures[2], year: 0, image: '' };
  let requests = 0;
  const service = new ProfileContinuityService(async requested => {
    requests++; assert.equal(requested.id, 'tmdb-121'); assert.equal(requested.type, ContentType.SERIES);
    assert.equal(requested.mediaFormat,'series');
    return { ...requested, title: 'Doctor Who', year: 1963, image: 'https://image.tmdb.org/t/p/w500/doctor-who.jpg' };
  });
  const snapshot = service.select([{...progress(raw),season:2,episode:4,remoteVersion:9}], []);
  const [resolved] = await Promise.all([service.enrich(snapshot),service.enrich(snapshot)]);
  assert.equal(requests,1); assert.equal(resolved.continueWatching[0].title,'Doctor Who'); assert.equal(resolved.continueWatching[0].year,1963);
  const { item: _resolvedItem, ...after } = resolved.progress[0];
  const { item: _originalItem, ...before } = snapshot.progress[0];
  assert.deepEqual(after, before);
  assert.equal(resolved.progress[0].episode,4);
});
test('metadata failures keep membership, negative cache expires, stale scope never publishes', async () => {
  let requests = 0;
  const service = new ProfileContinuityService(async () => { requests++; throw new Error('offline'); });
  const snapshot = service.select([progress({...continuityFixtures[2],image:''})],[]);
  const first = await service.enrich(snapshot);
  assert.equal(first.continueWatching.length,1); assert.equal(first.progress[0].currentTime,120);
  await service.enrich(snapshot); assert.equal(requests,1);
  let callback = 0;
  await service.enrich(snapshot,()=>false,()=>callback++); assert.equal(callback,0);
  const original = Date.now;
  try { Date.now = () => original() + 61000; await service.enrich(snapshot); assert.equal(requests,2); } finally { Date.now=original; }
});
test('history and lists survive missing catalog, completed records stay in history', () => {
  const service = new ProfileContinuityService();
  const records = continuityFixtures.map(progress); records[0] = {...records[0],currentTime:1200,percentage:100};
  const snapshot = service.select(records,[],[continuityFixtures[1].id],[continuityFixtures[3].id]);
  assert.equal(snapshot.history.length,5); assert.equal(snapshot.continueWatching.length,4);
  assert.equal(snapshot.myList[0].title,'Dark'); assert.equal(snapshot.favorites[0].title,'Lupin');
});
test('image fallback rejects invalid and known corrupt posters without erasing a valid image',()=> {
  assert.equal(contentPoster({poster:'not-a-url',image:'https://image.tmdb.org/t/p/w500/good.jpg'}),'https://image.tmdb.org/t/p/w500/good.jpg');
  assert.equal(contentPoster({poster:'https://example.test/iigTJJskR1PcjjXqxdyJwVB3BoU.jpg',image:'/good.jpg'}),'/good.jpg');
});
test('typed canonical aliases match legacy IDs without merging unrelated types',()=> {
  const legacy = item('tmdb-121','Doctor Who');
  const typed = {...legacy,id:'series:tmdb:121',canonicalId:'series:tmdb:121'};
  const movie = {...typed,type:ContentType.MOVIE,mediaFormat:'movie' as const};
  assert.equal(resolveContinueWatchingItems([progress(legacy),progress(typed),progress(movie)],[]).length,2);
});

test('recovery bounds concurrency and rejects a different work or obsolete scope', async()=> {
  let active=0, peak=0;
  const service=new ProfileContinuityService(async requested=>{active++;peak=Math.max(active,peak);await new Promise(resolve=>setTimeout(resolve,5));active--;return {...requested,title:'Recovered title',image:'/poster.jpg'};});
  const records=Array.from({length:12},(_,i)=>progress({...item(`tmdb-${1000+i}`,`tmdb-${1000+i}`),image:''},i));
  const result=await service.enrich(service.select(records,[]));
  assert.equal(result.history.length,12);assert.ok(peak<=3);
  const wrong=new ProfileContinuityService(async()=>item('tmdb-9999','Wrong work'));
  const failed=await wrong.enrich(wrong.select([records[0]],[]));
  assert.notEqual(failed.history[0].title,'Wrong work'); assert.equal(failed.history[0].id,records[0].item.id);
  let release!:()=>void; let current=true, published=0;
  const late=new ProfileContinuityService(async requested=>{await new Promise<void>(resolve=>{release=resolve});return {...requested,title:'Recovered',image:'/poster.jpg'};});
  const enriching=late.enrich(late.select([records[0]],[]),()=>current,()=>published++);
  current=false;release();await enriching;assert.equal(published,0);
});

test('a newer empty alias record keeps older trustworthy metadata without rewinding progress',()=> {
  const good={...item('tmdb-121','Doctor Who'),year:1963,imdbId:'tt0056751'};
  const empty={...good,id:'tt0056751',title:'tt0056751',year:0,image:''};
  const selected=resolveContinueWatchingItems([progress(good),progress(empty,1)],[]);
  assert.equal(selected.length,1);assert.equal(selected[0].title,'Doctor Who');assert.equal(selected[0].year,1963);assert.equal(selected[0].image,good.image);
});

test('a provider placeholder uses short retry TTL instead of caching missing metadata for six hours',async()=> {
  let requests=0;
  const service=new ProfileContinuityService(async requested=>{requests++;return {...requested};});
  const snapshot=service.select([progress({...item('tmdb-121','tmdb-121'),image:''})],[]);
  await service.enrich(snapshot);const original=Date.now;
  try{Date.now=()=>original()+61000;await service.enrich(snapshot);assert.equal(requests,2);}finally{Date.now=original;}
});
