import { tmdbService } from '../src/core/tmdb/tmdbClient';

async function main() {
  const animes1 = await tmdbService.getAnimes(1);
  const animes2 = await tmdbService.getAnimes(2);
  const all = [...animes1, ...animes2];

  console.log(`Total animes returned: ${all.length}`);
  for (const a of all) {
    if (
      a.title.toLowerCase().includes('doraemon') ||
      a.title.toLowerCase().includes('overflow') ||
      a.title.toLowerCase().includes('mori no kuma') ||
      a.title.toLowerCase().includes('adam-kun') ||
      a.title.toLowerCase().includes('sparks') ||
      a.title.toLowerCase().includes('black clover') ||
      a.title.toLowerCase().includes('murai') ||
      a.title.toLowerCase().includes('saving 80')
    ) {
      const imdb = await tmdbService.getImdbId(a.tmdbId || a.id, a.type);
      console.log('ANIME MATCH:', {
        id: a.id,
        tmdbId: a.tmdbId,
        imdbId: imdb,
        title: a.title,
        year: a.year
      });
    }
  }
}

main().catch(console.error);
