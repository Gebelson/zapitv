async function testPopularAnimes() {
  const animes = [
    { title: 'Naruto', imdb: 'tt0409591' },
    { title: 'Attack on Titan', imdb: 'tt2560140' },
    { title: 'One Piece', imdb: 'tt0388629' },
    { title: 'Demon Slayer', imdb: 'tt9335498' },
    { title: 'Jujutsu Kaisen', imdb: 'tt12343534' },
    { title: 'Bleach', imdb: 'tt0434665' },
    { title: 'Death Note', imdb: 'tt0877057' }
  ];

  for (const a of animes) {
    try {
      const res = await fetch(`https://fenixflix.fenixhub.online/stream/series/${a.imdb}:1:1.json`);
      const data: any = await res.json();
      console.log(`[${a.title} ${a.imdb}] -> ${data?.streams?.length || 0} streams`);
      if (data?.streams?.length > 0) {
        console.log(`  Stream #1 title: "${data.streams[0].title?.replace(/\n/g, ' ')}" URL: ${data.streams[0].url?.substring(0, 70)}`);
      }
    } catch (e: any) {
      console.log(`[${a.title}] err:`, e.message);
    }
  }
}

testPopularAnimes();
