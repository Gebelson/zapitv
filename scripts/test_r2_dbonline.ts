async function testStreamAudioContent() {
  const r2Url = 'https://tomato-sauce.19fc6b4c4bd6173bd6c9d933744fb2a1.r2.cloudflarestorage.com/s';
  const dbonlineUrl = 'http://dbonline.tech-cdn.top:80/series/ke-vin-0928392083/PZjF6XATTZ/59368.mp4';

  console.log('Testando R2...');
  try {
    const res = await fetch(r2Url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    console.log('R2 status:', res.status, res.headers.get('content-type'));
  } catch (e: any) {
    console.log('R2 erro:', e.message);
  }

  console.log('Testando dbonline...');
  try {
    const res = await fetch(dbonlineUrl, { headers: { Range: 'bytes=0-1000' }, signal: AbortSignal.timeout(5000) });
    console.log('dbonline status:', res.status, res.headers.get('content-type'), res.headers.get('content-length'));
  } catch (e: any) {
    console.log('dbonline erro:', e.message);
  }
}
testStreamAudioContent();
