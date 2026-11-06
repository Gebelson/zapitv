import assert from 'node:assert/strict';
import {StremioClient} from '../src/core/stremio/stremioClient';
const originalFetch=globalThis.fetch,originalNow=Date.now;
try{
 let clock=originalNow(),calls=0;Date.now=()=>clock;
 globalThis.fetch=async()=>{calls++;clock+=1000;throw new TypeError('network');};
 await assert.rejects(new StremioClient('https://v3-cinemeta.strem.io').getManifest({totalTimeoutMs:500,directTimeoutMs:100}));
 assert.equal(calls,1,'expired total budget must not start an extra proxy attempt');
 Date.now=originalNow;
 let signal:AbortSignal|undefined;
 globalThis.fetch=async(_input,init)=>new Promise((_resolve,reject)=>{signal=init?.signal as AbortSignal;signal.addEventListener('abort',()=>reject(Object.assign(new Error('abort'),{name:'AbortError'})),{once:true});});
 const controller=new AbortController();
 const promise=new StremioClient('https://v3-cinemeta.strem.io').getManifest({signal:controller.signal,totalTimeoutMs:500});
 const rejected=assert.rejects(promise);controller.abort();await rejected;
 assert.equal(signal?.aborted,true,'last public metadata consumer must cancel its network transport');
 let count=0;
 globalThis.fetch=async(input)=>{count++;if(!String(input).includes('/api/proxy'))throw new TypeError('network');return Response.json({streams:[]});};
 await new StremioClient('https://v3-cinemeta.strem.io/fallback-fixture').getManifest({totalTimeoutMs:2000});
 assert.equal(count,2,'one failed direct call followed by exactly one proxy fallback');
 const pending:Array<{signal:AbortSignal,resolve:(r:Response)=>void}>=[];
 globalThis.fetch=async(_input,init)=>new Promise((resolve,reject)=>{
  const signal=init?.signal as AbortSignal;pending.push({signal,resolve});
  signal.addEventListener('abort',()=>reject(Object.assign(new Error('abort'),{name:'AbortError'})),{once:true});
 });
 const a=new AbortController(),b=new AbortController();
 const client=new StremioClient('https://v3-cinemeta.strem.io/shared-fixture');
 const first=client.getManifest({signal:a.signal,totalTimeoutMs:2000});
 const second=client.getManifest({signal:b.signal,totalTimeoutMs:2000});
 const rejects=[assert.rejects(first),assert.rejects(second)];
 assert.equal(pending.length,1);
 a.abort();assert.equal(pending[0].signal.aborted,false);
 b.abort();assert.equal(pending[0].signal.aborted,true);
 const next=client.getManifest({totalTimeoutMs:2000});
 assert.equal(pending.length,2,'retry must not join the cancelled metadata request');
 pending[1].resolve(Response.json({streams:[]}));
 await Promise.all([...rejects,next]);
 console.log('Strict budget, bounded fallback, deduplication and cancellation: PASS');
}finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
