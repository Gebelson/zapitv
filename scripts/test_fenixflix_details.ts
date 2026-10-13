
async function testStreams() {
  const titles = [
    { name: 'Doraemon', tmdb: '57911', imdb: 'tt0069576' },
    { name: 'Doraemon 2005', tmdb: '65733', imdb: 'tt4083422' },
    { name: 'Overflow', tmdb: '95897', imdb: 'tt14962432' },
    { name: 'Mori no Kuma-san', tmdb: '204269', imdb: 'tt26598191' },
    { name: 'Modaete yo, Adam-kun', tmdb: '241002', imdb: 'tt30325611' }
  ];

  for (const t of titles) {
    console.log(`\n=== Testing ${t.name} ===`);
    // Test FenixFlix
    for (const id of [`${t.imdb}:1:1`, `${t.tmdb}:1:1`, t.imdb, t.tmdb]) {
      try {
        const url = `https://fenixflix.fenixhub.online/stream/series/${id}.json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data: any = await res.json();
          if (data?.streams?.length > 0) {
            console.log(`FenixFlix (series, ${id}):`);
            for (const s of data.streams) {
              console.log(`  title: "${s.title}" name: "${s.name}" url: ${s.url}`);
            }
          }
        }
      } catch (e: any) {
        // console.log('err:', e.message);
      }
    }

    // Test Magnetflix
    for (const id of [`${t.imdb}:1:1`, `${t.tmdb}:1:1`, t.imdb, t.tmdb]) {
      try {
        const url = `https://magnetflix.flixbr.online/qualities=4k,1080p,720p,sd|audio=dublado,legendado|catalogs=populares_movie,populares_series,recentes_servidor_movie,recentes_servidor_series,emalta_movie,emalta_series/stream/series/${id}.json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data: any = await res.json();
          if (data?.streams?.length > 0) {
            console.log(`Magnetflix (series, ${id}):`);
            for (const s of data.streams) {
              console.log(`  title: "${s.title}" name: "${s.name}" url: ${s.url}`);
            }
          }
        }
      } catch (e: any) {}
    }
  }
}

testStreams().catch(console.error);
