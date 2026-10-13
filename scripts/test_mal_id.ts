async function testAniSkip() {
  const url = 'https://api.aniskip.com/v2/skip-times/20/1?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=0';
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
  const data = await res.json();
  console.log('AniSkip Naruto Ep 1:', JSON.stringify(data, null, 2));
}

testAniSkip();
