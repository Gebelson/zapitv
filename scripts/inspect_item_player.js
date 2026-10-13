async function searchPlayer() {
  const res = await fetch('https://libreflix.org/i/a-luta-das-auras-2024');
  const html = await res.text();
  const lines = html.split('\n');
  const matching = lines.filter(l => /player|video|source|play|vdn|hls|m3u8|mp4|webtorrent|stream/i.test(l));
  console.log('Matching lines in item page:', matching.slice(0, 20));
}
searchPlayer();
