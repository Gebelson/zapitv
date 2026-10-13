import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { StremioClient } from '../src/core/stremio/stremioClient';

const ADDONS = [
  { name: 'Show Subtitle PT-BR', url: 'http://localhost:4000/api/stremio/show-subtitle-pt-br' },
  { name: 'Mico-Leão Dublado', url: 'http://localhost:4000/api/stremio/mico-leao-dublado' },
  { name: 'FenixFlix', url: 'https://fenixflix.fenixhub.online' },
  { name: 'Magnetflix', url: 'https://magnetflix.flixbr.online/qualities=4k,1080p,720p,sd|audio=dublado,legendado|catalogs=populares_movie,populares_series,recentes_servidor_movie,recentes_servidor_series,emalta_movie,emalta_series' },
  { name: 'Torrentio Brazuca', url: 'https://torrentio.strem.fun/brazuca' }
];

async function checkItem(titleQuery: string) {
  console.log('\n======================================================');
  console.log('TESTANDO:', titleQuery);
  console.log('======================================================');
  const results = await tmdbService.searchMulti(titleQuery);
  if (results.length === 0) {
    console.log('Nenhum resultado TMDB para:', titleQuery);
    return;
  }

  const item = results[0];
  const imdb = await tmdbService.getImdbId(item.tmdbId || item.id, item.type);
  console.log('Metadados:', {
    title: item.title,
    tmdbId: item.tmdbId,
    imdbId: imdb || item.imdbId,
    type: item.type
  });

  const idsToTest = [
    imdb ? `${imdb}:1:1` : null,
    item.tmdbId ? `${item.tmdbId}:1:1` : null,
    imdb || null,
    item.tmdbId || null
  ].filter(Boolean) as string[];

  for (const addon of ADDONS) {
    console.log(`\n--- Addon: ${addon.name} ---`);
    const client = new StremioClient(addon.url);
    for (const testId of idsToTest) {
      try {
        const streamType = item.type === 'FILME' ? 'movie' : 'series';
        const res = await Promise.race([
          client.getStreams(streamType, testId),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
        if (res?.streams?.length > 0) {
          console.log(`  [Sucesso com ID: ${testId}] Encontrou ${res.streams.length} streams:`);
          for (const s of res.streams.slice(0, 3)) {
            console.log(`    - title: "${s.title?.replace(/\n/g, ' ')}" | name: "${s.name}" | url: ${s.url?.substring(0, 60)}`);
          }
        } else {
          // Tenta tipo anime se falhar
          const animeRes = await Promise.race([
            client.getStreams('anime', testId),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
          ]);
          if (animeRes?.streams?.length > 0) {
            console.log(`  [Sucesso com 'anime' ID: ${testId}] Encontrou ${animeRes.streams.length} streams:`);
            for (const s of animeRes.streams.slice(0, 3)) {
              console.log(`    - title: "${s.title?.replace(/\n/g, ' ')}" | name: "${s.name}" | url: ${s.url?.substring(0, 60)}`);
            }
          }
        }
      } catch (err: any) {
        // console.log(`  [Falha com ID: ${testId}]: ${err.message}`);
      }
    }
  }
}

async function run() {
  await checkItem('Doraemon');
  await checkItem('Overflow');
  await checkItem('Mori no Kuma-san, Toumin-chuu');
  await checkItem('Modaete yo, Adam-kun');
}

run().catch(console.error);
