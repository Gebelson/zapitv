async function testAniList(title) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title { romaji english native }
        coverImage { extraLarge large medium color }
        bannerImage
      }
    }
  `;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables: { search: title } })
  }).then(r => r.json());
  console.log('ANILIST FOR', title, res.data?.Media ? {
    title: res.data.Media.title,
    cover: res.data.Media.coverImage?.large,
    banner: res.data.Media.bannerImage
  } : res);
}

testAniList('Bleach');
