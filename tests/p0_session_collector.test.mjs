import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('scripts/diagnostics/p0-session-collector.js','utf8');
const timers=[];
const originalFetch=async(input)=>{if(String(input).includes("/abort")){const e=new Error("secret-token");e.name="AbortError";throw e;}return new Response(JSON.stringify({providers:[{id:'safe-addon',enabled:true,status:'online',healthState:'STREAM_ENDPOINT_OPERATIONAL',url:'https://private.test/key-secret',configKey:'secret-token',priority:1}],streams:[{url:'https://private.test/file?token=secret-token',title:'Private title'}]}),{headers:{'content-type':'application/json'}});};
const context={location:{origin:'https://zapitv-stream.vercel.app'},URL,Response,TextDecoder,Date,WeakSet,Set,fetch:originalFetch,document:{querySelectorAll:()=>[]},MutationObserver:class{observe(){}disconnect(){}},setTimeout:(f)=>{timers.push(f);return timers.length;},clearTimeout(){},setInterval:()=>1,clearInterval(){}};
context.window=context;
vm.runInNewContext(source,context);
await context.fetch('https://zapitv-stream.vercel.app/api/providers/config');
await new Promise(setImmediate);await new Promise(setImmediate);
context.zapiP0Diag.mark('first');
await context.fetch('https://zapitv-stream.vercel.app/api/proxy?url=https%3A%2F%2Fprivate.test%2Fsecret-token');
await new Promise(setImmediate);await new Promise(setImmediate);
await context.fetch('https://private.test/file?token=secret-token');
await new Promise(setImmediate);await new Promise(setImmediate);
await assert.rejects(context.fetch('https://private.test/abort?token=secret-token'));
const report=context.zapiP0Diag.snapshot();
assert.ok(report.events.some(e=>e.result==='CANCELLED'));
assert.ok(report.providers.length===1);
assert.ok(report.events.some(e=>e.http===200));
assert.ok(report.events.some(e=>e.kind==='metadata-proxy'&&e.received===1));
assert.doesNotMatch(JSON.stringify(report),/secret-token|key-secret|private.test|Private title|cookie|authorization/i);
assert.equal(context.zapiP0Diag.snapshot().limits.maxEvents,300);
for(let n=0;n<310;n++)context.zapiP0Diag.mark('bounded');
assert.equal(context.zapiP0Diag.snapshot().events.length,300);
context.zapiP0Diag.mark('falha');
assert.ok(context.zapiP0Diag.snapshot().events.some(e=>e.kind==='mark'&&e.phase==='falha'),'failure marker must survive a full buffer');
assert.ok(context.zapiP0Diag.snapshot().dropped.critical>0);
assert.equal(context.zapiP0Diag.snapshot().truncated,true);
timers[0]();assert.equal(context.fetch,originalFetch);
context.zapiP0Diag.stop();assert.equal(context.fetch,originalFetch);
console.log('Session collector allowlist, redaction and cleanup: PASS');

let tick; const reads=Array(40).fill(0);
const videos=reads.map((_,i)=>({
 get currentTime(){reads[i]++;return 1;},videoWidth:640,videoHeight:360,paused:false,readyState:4,
 isConnected:true,error:null,listeners:new Map(),
 addEventListener(name,fn){this.listeners.set(name,fn);},
 removeEventListener(name){this.listeners.delete(name);}
}));
const sampled={...context,fetch:originalFetch,document:{querySelectorAll:()=>videos},setInterval:fn=>{tick=fn;return 1;}};
sampled.window=sampled;
vm.runInNewContext(source,sampled);
tick();
assert.equal(reads.filter(n=>n>0).length,32,'sampling must obey the same 32-video limit as listeners');
sampled.zapiP0Diag.mark('falha');
for(let n=0;n<20;n++)tick();
let sampleReport=sampled.zapiP0Diag.snapshot();
assert.ok(sampleReport.events.filter(e=>e.event==='sample').length<=96);
assert.ok(sampleReport.events.some(e=>e.kind==='mark'&&e.phase==='falha'));
assert.equal(sampleReport.dropped.critical,0,'periodic samples must not evict a failure marker');
videos[0].listeners.get('error')();
assert.ok(sampled.zapiP0Diag.snapshot().events.some(e=>e.event==='error'));
assert.ok(sampled.zapiP0Diag.snapshot().dropped.samples>0);
const beforeDetached=reads[0];videos[0].isConnected=false;tick();assert.equal(reads[0],beforeDetached);
sampled.zapiP0Diag.stop();assert.equal(videos[0].listeners.size,0);
console.log('Video sampling cap and priority event retention: PASS');
