import assert from 'node:assert/strict';
import { test } from 'node:test';

test('real API keeps media private, rejects SSRF and conditionally serves public metadata',{timeout:15000},async()=>{
  process.env.VERCEL='1';process.env.MANDATORY_AUTH='true';
  delete process.env.TURSO_DATABASE_URL;delete process.env.TURSO_AUTH_TOKEN;
  process.env.ALLOW_LOCAL_DB='false';
  const {default:app}=await import('../server');
  const {canonicalCatalogMaster}=await import('../src/core/catalog/CanonicalCatalogMaster');
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try {
    const privateResponse=await fetch(`${base}/api/auth/me`);
    assert.equal(privateResponse.headers.get('cache-control'),'no-store');
    assert.equal((await privateResponse.json()).authenticated,false);
    const media=await fetch(`${base}/api/proxy?url=${encodeURIComponent('https://8.8.8.8/movie.mp4')}`);
    assert.equal(media.status,401);await media.body?.cancel();
    const ssrf=await fetch(`${base}/api/proxy?url=${encodeURIComponent('http://127.0.0.1/media')}`);
    assert.equal(ssrf.status,502);await ssrf.body?.cancel();
    const featured=await fetch(`${base}/api/featured`);
    assert.equal(featured.status,200);assert.ok(featured.headers.get('cache-control')?.includes('s-maxage=30'));
    const etag=featured.headers.get('etag');assert.ok(etag);await featured.body?.cancel();
    const unchanged=await fetch(`${base}/api/featured`,{headers:{'If-None-Match':etag!,'Cache-Control':'max-age=0'}});
    assert.equal(unchanged.status,304);assert.equal((await unchanged.arrayBuffer()).byteLength,0);
    const catalog=await fetch(`${base}/api/stremio/mico-leao-dublado/catalog/movie/BrazilianCatalog.json`);
    assert.equal(catalog.status,200);assert.ok(Array.isArray((await catalog.json()).metas));
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));canonicalCatalogMaster.dispose();}
});
