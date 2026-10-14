async function run() {
  try {
    const r1 = await fetch('http://localhost:4000/api/stremio/public-domain/stream/movie/tt31454558.json');
    console.log('public-domain status:', r1.status, await r1.json());
  } catch (e: any) {
    console.log('err r1:', e.message);
  }

  try {
    const r2 = await fetch('http://localhost:4000/api/stremio/blender-open/stream/series/tt10986410:1:1.json');
    console.log('blender-open status:', r2.status, await r2.json());
  } catch (e: any) {
    console.log('err r2:', e.message);
  }
}
run();
