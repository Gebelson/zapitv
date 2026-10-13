async function testEpisodeLength() {
  const malId = 16498; // Attack on Titan
  const ep = 1;

  // With episodeLength = 0
  const r0 = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${ep}?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=0`);
  const d0 = await r0.json() as any;
  console.log('episodeLength=0 => found:', d0.found, 'count:', d0.results?.length);

  // With episodeLength = 1500
  const r1500 = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${ep}?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=1500`);
  const d1500 = await r1500.json() as any;
  console.log('episodeLength=1500 => found:', d1500.found, 'count:', d1500.results?.length);
}

testEpisodeLength();
