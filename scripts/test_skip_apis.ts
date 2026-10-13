// using global fetch

async function testApis() {
  console.log('Testing AniList...');
  const anilistRes = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query ($search: String) { Media(search: $search, type: ANIME) { id idMal title { romaji english native } episodes } }`,
      variables: { search: 'Attack on Titan' }
    })
  });
  const anilistData = await anilistRes.json() as any;
  console.log('AniList Result:', anilistData?.data?.Media);

  const malId = anilistData?.data?.Media?.idMal;
  console.log(`MAL ID for Attack on Titan: ${malId}`);

  console.log('\nTesting AniSkip for Attack on Titan Ep 1...');
  const aniskipRes = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/1?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=0`);
  const aniskipData = await aniskipRes.json() as any;
  console.log('AniSkip Result:', JSON.stringify(aniskipData, null, 2));

  console.log('\nTesting IntroDB for Breaking Bad (tt0903747) Season 1 Episode 1...');
  const introdbRes = await fetch('https://api.introdb.app/segments?imdb_id=tt0903747&season=1&episode=1');
  const introdbData = await introdbRes.json() as any;
  console.log('IntroDB Result:', JSON.stringify(introdbData, null, 2));
}

async function testAniListSeason(title: string, season?: number) {
  const query = `query ($search: String) { Page(page: 1, perPage: 3) { media(search: $search, type: ANIME) { id idMal title { romaji english } episodes } } }`;
  const searchTerm = season && season > 1 ? `${title} Season ${season}` : title;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { search: searchTerm } })
  });
  const data = await res.json() as any;
  console.log(searchTerm, '=>', data?.data?.Page?.media?.map((m: any) => ({ idMal: m.idMal, title: m.title?.romaji || m.title?.english, episodes: m.episodes })));
}

async function run() {
  await testApis();
  console.log('\n--- Season Search Tests ---');
  await testAniListSeason('Jujutsu Kaisen', 1);
  await testAniListSeason('Jujutsu Kaisen', 2);
  await testAniListSeason('Attack on Titan', 2);
}

run().catch(console.error);
