async function testOdysseyProviders() {
  const providers = [
    { name: 'FenixFlix', url: 'https://fenixflix.fenixhub.online/stream/movie/tt33764258.json' },
    { name: 'Magnetflix', url: 'https://magnetflix.flixbr.online/qualities=4k,1080p,720p,sd|audio=dublado,legendado|catalogs=populares_movie,populares_series,recentes_servidor_movie,recentes_servidor_series,emalta_movie,emalta_series/stream/movie/tt33764258.json' }
  ];

  for (const p of providers) {
    try {
      const res = await fetch(p.url);
      console.log(p.name, 'Status:', res.status);
      const data = await res.json();
      console.log(p.name, 'streams count:', data.streams?.length);
      if (data.streams?.length > 0) {
        data.streams.forEach((s: any, idx: number) => {
          console.log(`  [${idx}] name="${s.name}" title="${s.title}" url="${s.url?.slice(0, 60)}"`);
        });
      }
    } catch (e: any) {
      console.log(p.name, 'Error:', e.message);
    }
  }
}
testOdysseyProviders();
