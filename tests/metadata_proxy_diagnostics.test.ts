import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createMetadataProxy,getMetadataProxyDiagnostics,metadataProxyDiagnosticsHandler,recordMetadataProxyPreflightFailure} from '../src/server/metadataProxy';
const target='https://v3-cinemeta.strem.io/stream/movie/tt1234567.json?token=secret';
function response(){const r:any=new EventEmitter();r.statusCode=200;r.headers={};r.setHeader=(k:string,v:string)=>r.headers[k]=v;r.status=(s:number)=>(r.statusCode=s,r);r.json=(body:any)=>(r.result=body,r);r.off=r.removeListener;return r;}
const cases=[
 ['ok',200,'SUCCESS'],['vendor',200,'SUCCESS'],['spoofed-html',415,'CONTENT_TYPE_BLOCKED'],['html',415,'CONTENT_TYPE_BLOCKED'],['media',415,'CONTENT_TYPE_BLOCKED'],['redirect',415,'REDIRECT_ENDPOINT_BLOCKED'],
 ['dns',502,'DNS_FAILURE'],['timeout',502,'TIMEOUT'],['refused',502,'CONNECTION_REFUSED'],['invalid',502,'INVALID_JSON'],['upstream502',502,'UPSTREAM_HTTP'],['upstream403html',403,'UPSTREAM_HTTP'],['blocked',502,'DESTINATION_BLOCKED']
] as const;
for(const [mode,status,reason] of cases){
 const get=async()=>{
  if(['dns','timeout','refused','blocked'].includes(mode))throw Object.assign(new Error(mode==='blocked'?'Destino não permitido':'secret URL'),{code:mode==='dns'?'ENOTFOUND':mode==='timeout'?'ETIMEDOUT':mode==='refused'?'ECONNREFUSED':undefined});
  const upstreamStatus=mode==='upstream502'?502:mode==='upstream403html'?403:200;
  return {url:mode==='redirect'?'https://unapproved.test/login?token=secret':target,status:upstreamStatus,ok:upstreamStatus===200,headers:new Headers({'content-type':mode==='spoofed-html'?'text/html; note=application/json':mode==='vendor'?'application/vnd.stremio+json; charset=utf-8':mode==='html'||mode==='upstream403html'?'text/html':mode==='media'?'video/mp4':'application/json'}),text:async()=>mode==='invalid'?'not-json':'{"streams":[]}',body:{destroy(){}}};
 };
 const res=response();await createMetadataProxy(get as any)({query:{url:target},headers:{}} as any,res);
 assert.equal(res.statusCode,status,mode);
 const event=getMetadataProxyDiagnostics().events.at(-1)!;assert.equal(event.reason,reason,mode);
 assert.equal(event.providerId,'stremio-cinemeta');assert.equal(event.resource,'stream');
 assert.doesNotMatch(JSON.stringify(event),/secret|https?:|tt1234567/);
}
for(const role of [undefined,'user','admin']){const res=response();metadataProxyDiagnosticsHandler({user:role?{role}:undefined} as any,res);assert.equal(res.statusCode,role==='admin'?200:403);assert.equal(res.headers['Cache-Control'],'no-store');}
recordMetadataProxyPreflightFailure(target,Object.assign(new Error('secret'),{code:'EAI_AGAIN'}),5);
assert.equal(getMetadataProxyDiagnostics().events.at(-1)?.reason,'DNS_FAILURE');
for(let n=0;n<210;n++)recordMetadataProxyPreflightFailure(target,new Error('Destino não permitido'),1);
assert.equal(getMetadataProxyDiagnostics().events.length,200);
assert.ok(getMetadataProxyDiagnostics().dropped>0);
assert.doesNotMatch(JSON.stringify(getMetadataProxyDiagnostics()),/secret|https?:|tt1234567/);
console.log('Proxy classification, sanitization and administrative access: PASS');
