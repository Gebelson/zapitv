import { TMDB_API_KEY, TMDB_BASE_URL } from '../src/core/tmdb/tmdbClient';

async function test() {
  const url = `${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=pt-BR`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('TMDB Trending count:', data.results?.length);
  for (const item of (data.results || []).slice(0, 15)) {
    console.log(`- ${item.id} | ${item.title || item.name} | ${item.media_type} | ${item.release_date || item.first_air_date}`);
  }
}
test();
