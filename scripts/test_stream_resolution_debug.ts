import { providerRegistry } from '../src/core/providers/providerRegistry.ts';

async function main() {
  console.log('--- Test 1: Anime Bleach ---');
  const r1 = await providerRegistry.resolveStreams('anime', { id: 'anime-bleach-tvmeter', imdbId: 'tt0434665', title: 'Bleach: Thousand-Year Blood War' }, { season: 1, episode: 1 });
  console.log('r1 streams count:', r1.length);
  if (r1.length > 0) console.log('r1 first stream:', r1[0].title, r1[0].url);

  console.log('--- Test 2: Series Ted Lasso ---');
  const r2 = await providerRegistry.resolveStreams('series', { id: 'series-ted-lasso', imdbId: 'tt10986410', title: 'Ted Lasso' }, { season: 1, episode: 1 });
  console.log('r2 streams count:', r2.length);
  if (r2.length > 0) console.log('r2 first stream:', r2[0].title, r2[0].url);

  console.log('--- Test 3: Movie Night of Living Dead (Open) ---');
  const r3 = await providerRegistry.resolveStreams('movie', { id: 'open-night-living-dead-1968', imdbId: 'tt0063350', title: 'A Noite dos Mortos-Vivos (1968)' });
  console.log('r3 streams count:', r3.length);
  if (r3.length > 0) console.log('r3 first stream:', r3[0].title, r3[0].url);

  console.log('--- Test 4: Anime Overflow ---');
  const r4 = await providerRegistry.resolveStreams('anime', { id: 'tmdb-95897', title: 'Overflow' }, { season: 1, episode: 1 });
  console.log('r4 streams count:', r4.length);
  if (r4.length > 0) console.log('r4 first stream:', r4[0].title, r4[0].url);

  console.log('--- Test 5: Open Series Caminandes ---');
  const r5 = await providerRegistry.resolveStreams('series', { id: 'open-caminandes-s1', title: 'Caminandes' }, { season: 1, episode: 1 });
  console.log('r5 streams count:', r5.length);
  if (r5.length > 0) console.log('r5 first stream:', r5[0].title, r5[0].url);
}

main().catch(console.error);
