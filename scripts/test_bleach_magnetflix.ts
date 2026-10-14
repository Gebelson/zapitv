async function testMagnetflix() {
  const urls = [
    'https://cnn.radiogaucha.fun/bleach/PDIKn8-ib9BhYRIvFRBnU_17aM_2jI-P3ZbBbqbzwE3Td',
    'http://dbonline.tech-cdn.top:80/series/ke-vin-0928392083/PZjF6XATTZ/59368.mp4'
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { Range: 'bytes=0-1000' }, signal: AbortSignal.timeout(5000) });
      console.log(u, 'status:', res.status, 'Content-Type:', res.headers.get('content-type'));
    } catch (e: any) {
      console.log(u, 'err:', e.message);
    }
  }
}
testMagnetflix();
