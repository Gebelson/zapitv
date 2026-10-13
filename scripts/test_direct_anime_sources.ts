async function testSources() {
  const urls = [
    'https://animeflix.blog/Animes/Letra-O/Overflow/Dub/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Mori%20no%20Kuma-san%2C%20Toumin-chuu/01.mp4',
    'https://animeflix.blog/Animes/Letra-M/Mori%20no%20Kuma-san/01.mp4',
    'https://animeflix.blog/Animes/Letra-D/Doraemon/01.mp4',
    'https://mario.hachost.cloud/6869/35125/1080p.m3u8'
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      console.log(`[${res.status}] ${u}`);
    } catch (e: any) {
      console.log(`[ERR] ${u} -> ${e.message}`);
    }
  }
}

testSources();
