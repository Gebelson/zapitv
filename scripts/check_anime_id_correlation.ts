async function checkTmdbIds() {
  const titles = [
    'Doraemon',
    'Sparks of Tomorrow',
    'Overflow',
    'Black Clover',
    'Mori no Kuma-san',
    'Murai in Love',
    'Modaete yo, Adam-kun',
    'Saving 80,000 Gold'
  ];

  for (const t of titles) {
    try {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(t)}&api_key=468925ac3759d7adeb05b540cfd71cb8`);
      const tmdbData: any = await tmdbRes.json();
      const firstTv = tmdbData.results?.[0];
      console.log(`[${t}] TMDB TV: id=${firstTv?.id}, name="${firstTv?.name}", original="${firstTv?.original_name}"`);
    } catch (e: any) {
      console.log(`[${t}] Error:`, e.message);
    }
  }
}

checkTmdbIds().catch(console.error);
