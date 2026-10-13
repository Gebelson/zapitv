async function probeAnimeflix() {
  const list = [
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/01.mp4',
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/02.mp4',
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/03.mp4',
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/04.mp4',
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/05.mp4',
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/06.mp4',
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/07.mp4',
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/08.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/02.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/03.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/04.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/05.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/06.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/07.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/08.mp4'
  ];

  for (const u of list) {
    try {
      const res = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      console.log(`[${res.status}] ${u}`);
    } catch (e: any) {
      console.log(`[ERR] ${u} -> ${e.message}`);
    }
  }
}

probeAnimeflix();
