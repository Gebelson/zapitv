import { tmdbService } from '../src/core/tmdb/tmdbClient';

async function test() {
  const queries = ['Breaking Bad', 'Naruto', 'Toy Story', 'One Piece', 'Simpsons', 'Chihiro'];
  for (const q of queries) {
    console.log(`\n=== QUERY: ${q} ===`);
    try {
      const res = await tmdbService.searchMulti(q);
      console.log(`Total searchMulti: ${res.length}`);
      res.slice(0, 3).forEach(r => {
        console.log(` - [${r.type}] ${r.title} (${r.year}) | genres: ${r.genres?.join(', ')} | imdb: ${r.imdbId || r.id}`);
      });
    } catch (e: any) {
      console.error('Error:', e.message);
    }
  }
}
test();
