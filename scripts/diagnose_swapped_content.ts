import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { providerRegistry } from '../src/core/providers/providerRegistry';

async function main() {
  const titles = [
    'Doraemon',
    'Overflow',
    'Mori no Kuma-san, Toumin-chuu',
    'Modaete yo, Adam-kun'
  ];

  for (const t of titles) {
    console.log('\n=============================================');
    console.log('BUSCA:', t);
    console.log('=============================================');
    const searchRes = await tmdbService.searchMulti(t);
    console.log('Resultados encontrados:', searchRes.length);
    if (searchRes.length > 0) {
      for (const item of searchRes.slice(0, 3)) {
        console.log('Item:', {
          id: item.id,
          tmdbId: item.tmdbId,
          imdbId: item.imdbId,
          title: item.title,
          type: item.type
        });
        const imdb = await tmdbService.getImdbId(item.tmdbId || item.id, item.type);
        console.log('IMDb ID resolvido:', imdb);

        const streams = await providerRegistry.resolveStreams(
          item.type === 'FILME' ? 'movie' : 'series',
          { tmdbId: item.tmdbId, imdbId: imdb || item.imdbId, id: item.id },
          { season: 1, episode: 1 }
        );
        console.log('Streams encontrados:', streams.length);
        for (let i = 0; i < Math.min(3, streams.length); i++) {
          const s = streams[i];
          console.log(`Stream #${i + 1}:`, {
            name: s.name,
            title: s.title,
            url: s.url?.substring(0, 100),
            providerName: s.providerName
          });
        }
      }
    }
  }
}

main().catch(console.error);
