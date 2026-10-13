import { providerRegistry } from '../src/core/providers/providerRegistry';

async function main() {
  const items = [
    { title: 'Doraemon (1979)', tmdbId: '57911', imdbId: 'tt0069576', id: 'tmdb-57911' },
    { title: 'Doraemon: O Gato do Futuro (2005)', tmdbId: '65733', imdbId: 'tt4083422', id: 'tmdb-65733' },
    { title: 'Overflow: Transbordando', tmdbId: '95897', imdbId: 'tt14962432', id: 'tmdb-95897' },
    { title: 'Mori no Kuma-san, Toumin-chuu.', tmdbId: '204269', imdbId: 'tt26598191', id: 'tmdb-204269' },
    { title: 'Modaete yo, Adam-kun', tmdbId: '241002', imdbId: 'tt30325611', id: 'tmdb-241002' }
  ];

  for (const item of items) {
    console.log('\n======================================================');
    console.log(`RESOLVENDO STREAMS PARA: ${item.title}`);
    console.log('======================================================');
    const streams = await providerRegistry.resolveStreams(
      'series',
      { tmdbId: item.tmdbId, imdbId: item.imdbId, id: item.id },
      { season: 1, episode: 1 }
    );
    console.log(`Total streams: ${streams.length}`);
    for (let i = 0; i < Math.min(5, streams.length); i++) {
      const s = streams[i];
      console.log(`Stream #${i + 1}: [${s.providerName}] "${s.title?.replace(/\n/g, ' ')}" -> URL: ${s.url}`);
    }
  }
}

main().catch(console.error);
