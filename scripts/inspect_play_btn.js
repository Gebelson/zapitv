async function searchBannerPlay() {
  const res = await fetch('https://libreflix.org/i/a-luta-das-auras-2024');
  const html = await res.text();
  const idx = html.indexOf('banner-play');
  if (idx !== -1) {
    console.log(html.substring(idx - 200, idx + 800));
  }
}
searchBannerPlay();
