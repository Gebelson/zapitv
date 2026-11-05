import assert from 'node:assert/strict';
import {providerRegistry} from '../src/core/providers/providerRegistry';
import {canonicalCatalogMaster} from '../src/core/catalog/CanonicalCatalogMaster';
const registry = providerRegistry as any;
const original = registry.resolveStreamsFresh;
const pending: Array<{signal:AbortSignal, finish:()=>void}> = [];
registry.resolveStreamsFresh = (...args:any[]) => new Promise(resolve => {
 pending.push({signal:args[6],finish:()=>resolve([])});
});
try {
 const a=new AbortController();
 const one=providerRegistry.resolveStreams('movie',{id:'cancel-transition'},undefined,{signal:a.signal});
 a.abort();
 assert.equal(pending[0].signal.aborted,true,'last consumer cancellation must abort shared transport');
 const b=new AbortController();
 const two=providerRegistry.resolveStreams('movie',{id:'cancel-transition'},undefined,{signal:b.signal});
 assert.equal(pending.length,2,'new consumer must not join an already aborted transport');
 assert.equal(pending[1].signal.aborted,false);
 pending[0].finish(); await one;
 pending[1].finish(); await two;
 const c=new AbortController(),d=new AbortController();
 const three=providerRegistry.resolveStreams('movie',{id:'shared-transition'},undefined,{signal:c.signal});
 const four=providerRegistry.resolveStreams('movie',{id:'shared-transition'},undefined,{signal:d.signal});
 c.abort(); assert.equal(pending[2].signal.aborted,false,'one cancellation must preserve another consumer');
 d.abort(); assert.equal(pending[2].signal.aborted,true);
 pending[2].finish(); await Promise.all([three,four]);
 const cancelled=new AbortController();cancelled.abort();
 const requestsBefore=pending.length;
 await providerRegistry.resolveStreams('movie',{id:'already-cancelled'},undefined,{signal:cancelled.signal});
 assert.equal(pending.length,requestsBefore,'already aborted consumer must not start transport');
 assert.equal(registry.inFlightControllers.size,0);
 assert.equal(registry.inFlightConsumers.size,0);
 console.log('Cancellation and immediate retry transitions: PASS');
} finally {
 for(const p of pending)p.finish();
 registry.resolveStreamsFresh=original;
 canonicalCatalogMaster.dispose();
}
