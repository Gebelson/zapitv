async function probeMori() {
  const candidates = [
    'https://animeflix.blog/Animes/Letra-M/Mori%20no%20Kuma-san/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Mori%20no%20Kuma-san%2C%20Toumin-chuu/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Mori%20no%20Kumasan/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Mori%20no%20Kuma-san%20Toumin-chuu/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Mori-no-Kuma-san/01.mp4',
    'https://animeflix.blog/Animes/Letra-C/Caressing%20My%20Hibernating%20Bear/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Mori%20no%20Kuma-san%2C%20Toumin-chuu./01.mp4'
  ];

  for (const c of candidates) {
    try {
      const res = await fetch(c, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      console.log(`[${res.status}] ${c}`);
    } catch (e: any) {
      console.log(`[ERR] ${c} -> ${e.message}`);
    }
  }
}

probeMori();
