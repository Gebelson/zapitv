import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { Readable } from 'node:stream';
import { createMetadataProxy, isAddonMetadataUrl, MAX_METADATA_BYTES } from '../src/server/metadataProxy';
import { directMediaUrl } from '../src/core/playback/directMediaUrl';
import { StremioClient } from '../src/core/stremio/stremioClient';
import { liveStreamValidator } from '../src/core/livetv/LiveStreamValidator';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';

test('legacy media URLs become direct without changing signed query, episode or Range origin',()=>{
  const original='https://media.example/season/2/episode/4.mp4?signature=fixture&expires=123';
  assert.equal(directMediaUrl(`/api/proxy?url=${encodeURIComponent(original)}`,'https:'),original);
  assert.equal(directMediaUrl(`/api/proxy?url=${encodeURIComponent('/api/proxy?url='+encodeURIComponent(original))}`),original);
  assert.equal(directMediaUrl('http://media.example/movie.mp4','https:'),null);
  assert.equal(directMediaUrl('http://127.0.0.1:11470/movie','http:'),'http://127.0.0.1:11470/movie');
  assert.equal(directMediaUrl('https://user:password@media.example/video'),null);
  assert.equal(directMediaUrl('/api/proxy?referer=https://required.example&url='+encodeURIComponent(original)),null);
  assert.equal(directMediaUrl('https://unknown.example/api/proxy?url='+encodeURIComponent(original)),null);
  assert.equal(directMediaUrl('/api/private-media'),null);
  assert.equal(directMediaUrl('/intro.mp4'),'/intro.mp4');
});

test('only approved addon JSON routes are accepted, not arbitrary URLs or media extensions',()=>{
  assert.ok(isAddonMetadataUrl('https://v3-cinemeta.strem.io/catalog/movie/top/skip=100.json'));
  assert.ok(isAddonMetadataUrl('https://torrentio.strem.fun/brazuca/manifest.json'));
  for(const url of ['https://unknown.example/catalog/movie/top.json','https://v3-cinemeta.strem.io.evil.example/manifest.json','https://v3-cinemeta.strem.io/file.mp4','http://v3-cinemeta.strem.io/manifest.json','https://user:pw@v3-cinemeta.strem.io/manifest.json']) assert.equal(isAddonMetadataUrl(url),false);
});

test('open catalog retains its direct sources without duplicate relay alternatives',()=>{
  assert.ok(VERIFIED_OPEN_ITEMS.length>=3);
  for(const item of VERIFIED_OPEN_ITEMS.slice(0,3)) {
    const urls=item.verifiedStreams!.map(source=>source.url);
    assert.equal(new Set(urls).size,urls.length,'the same origin cannot be exposed twice as proxy/direct');
    assert.ok(urls.every(url=>url?.startsWith('https://')));
  }
});

test('JSON gateway relays zero media bytes and bounds headers, redirects, MIME, size and lifecycle',{timeout:10000},async()=>{
  let calls=0, textCalls=0, mode='json';
  const bodies:Readable[]=[];
  const get=async(url:string)=>{
    calls++;
    const body=Readable.from(['not consumed']);bodies.push(body);
    return {url:mode==='redirect'?'https://media.example/movie.mp4':url,status:200,ok:true,body,
      headers:new Headers({'content-type':mode==='media'?'video/mp4':'application/json',...(mode==='large'?{'content-length':String(MAX_METADATA_BYTES+1)}:{})}),
      text:async(limit?:number)=>{textCalls++;assert.equal(limit,MAX_METADATA_BYTES);if(mode==='chunked-large')throw Error('size limit');return '{"metas":[{"id":"fixture"}]}';},arrayBuffer:async()=>Buffer.alloc(0)};
  };
  const app=express();app.get('/api/proxy',createMetadataProxy(get as any));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const request=(target:string,headers?:Record<string,string>)=>fetch(`${base}/api/proxy?url=${encodeURIComponent(target)}`,{headers,signal:AbortSignal.timeout(3000)});
  try {
    let errorBytes=0;
    for(const suffix of ['master.m3u8','video.mp4','part.ts','init.m4s','audio.aac','captions.vtt']) {
      const response=await request(`https://v3-cinemeta.strem.io/${suffix}`);
      assert.equal(response.status,410);assert.equal(response.headers.get('location'),null);
      errorBytes+=(await response.arrayBuffer()).byteLength;
    }
    assert.equal(calls,0,'denied media requests cannot open an upstream connection');
    assert.ok(errorBytes<2048);
    const target='https://v3-cinemeta.strem.io/catalog/movie/top.json';
    assert.equal((await request(target,{Range:'bytes=0-999999'})).status,410);
    const allowed=await request(target);
    assert.deepEqual(await allowed.json(),{metas:[{id:'fixture'}]});
    assert.equal(allowed.headers.get('cache-control'),'no-store');
    assert.equal(allowed.headers.get('accept-ranges'),null);
    for(const [next,status] of [['media',415],['large',413],['redirect',415],['chunked-large',502]] as const) {
      mode=next;const response=await request(target);assert.equal(response.status,status);await response.body?.cancel();
    }
    assert.equal(textCalls,2,'invalid media/large/redirect headers cannot trigger a body read');
    assert.ok(bodies.every(body=>body.destroyed));
    console.log(JSON.stringify({controlledMediaRequests:6,upstreamMediaFetches:0,mediaBytesRelayed:0,errorResponseBytes:errorBytes}));
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('simultaneous identical addon requests share one fetch without keeping stale content',async()=>{
  const previous=globalThis.fetch;let calls=0;let release!:()=>void;
  const waiting=new Promise<void>(resolve=>{release=resolve;});
  globalThis.fetch=async()=>{calls++;await waiting;return Response.json({metas:[]});};
  try {
    const a=new StremioClient('https://v3-cinemeta.strem.io'),b=new StremioClient('https://v3-cinemeta.strem.io');
    const one=a.getCatalog('movie','top'),two=b.getCatalog('movie','top');
    release();await Promise.all([one,two]);assert.equal(calls,1);
    await a.getCatalog('movie','top');assert.equal(calls,2,'completed metadata is not a stale persistent cache');
    await Promise.all([new StremioClient('/api/stremio/live').getCatalog('tv','live'),new StremioClient('/api/stremio/live').getCatalog('tv','live')]);
    assert.equal(calls,4,'private same-origin requests cannot share a promise across session changes');
  } finally {globalThis.fetch=previous;}
});

test('an origin ignoring Range does not make live preflight download an entire MP4',async()=>{
  const previous=globalThis.fetch;let cancelled=false;
  globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(32));},cancel(){cancelled=true;}}),{headers:{'content-type':'video/mp4'}});
  try {
    const status=await Promise.race([liveStreamValidator.validateStreamUrl('https://media.example/range-ignored.mp4'),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('preflight read the media body')),1500).unref())]);
    assert.equal(status,'INCONCLUSIVE');assert.equal(cancelled,true);
  } finally {globalThis.fetch=previous;}
});

test('CORS fallback metadata is requested separately for the current session',async()=>{
  const previous=globalThis.fetch;let proxyCalls=0;
  globalThis.fetch=async(input)=>String(input).includes('/api/proxy')?Response.json({id:++proxyCalls}):new Response(null,{status:403});
  try {
    const results=await Promise.all([new StremioClient('https://v3-cinemeta.strem.io').getManifest(),new StremioClient('https://v3-cinemeta.strem.io').getManifest()]);
    assert.equal(proxyCalls,2,'authenticated gateway results cannot be shared');
    assert.notEqual(results[0].id,results[1].id);
  } finally {globalThis.fetch=previous;}
});
