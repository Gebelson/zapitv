import { tmdbService } from '../src/core/tmdb/tmdbClient';

async function checkTmdbPosters() {
  const titles = [
    { query: 'Verity', imdbId: 'tt15888806' },
    { query: 'The Odyssey', imdbId: 'tt2788314' },
    { query: 'D-Day', imdbId: 'tt11576182' },
    { query: "Widow's Bay", imdbId: 'tt31854290' }
  ];

  for (const item of titles) {
    console.log(`\n--- Searching TMDB for ${item.query} (${item.imdbId}) ---`);
    try {
      const byImdb = await tmdbService.findByImdb(item.imdbId);
      if (byImdb) {
        console.log(`Found by IMDb:`, {
          title: byImdb.title,
          image: byImdb.image,
          backdrop: byImdb.backdrop,
          tmdbId: byImdb.tmdbId
        });
      } else {
        const searchRes = await tmdbService.searchMulti(item.query);
        console.log(`Search results for ${item.query}:`, searchRes.slice(0, 2).map(r => ({
          title: r.title,
          image: r.image,
          tmdbId: r.tmdbId
        })));
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

checkTmdbPosters();
