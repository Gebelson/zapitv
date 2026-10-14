import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService.ts';
import { providerRegistry } from '../src/core/providers/providerRegistry.ts';

async function testPlayback() {
  const selection = featuredRankingService.getFeaturedSelectionSync();
  console.log('=== TESTE DE RESOLUÇÃO DE STREAM DOS 10 FILMES ===');
  let hasFakeMovie = false;
  for (const movie of selection.featuredMovies) {
    const streams = await providerRegistry.resolveStreams('movie', {
      id: movie.id,
      imdbId: movie.imdbId,
      tmdbId: movie.tmdbId,
      title: movie.title
    });
    const firstUrl = streams[0]?.url || '(sem stream direto - fallback addon)';
    const isFake = firstUrl.includes('Night_of_the_Living_Dead');
    if (isFake) hasFakeMovie = true;
    console.log(`${movie.displayRank}. [${movie.title}] -> Stream: ${firstUrl} | Fake Night of Living Dead? ${isFake ? 'SIM ❌' : 'NÃO ✅'}`);
  }

  console.log('\n=== TESTE DE RESOLUÇÃO DE STREAM DAS 10 SÉRIES (EPISÓDIO 1) ===');
  let hasFakeSeries = false;
  for (const s of selection.featuredSeries) {
    const streams = await providerRegistry.resolveStreams('series', {
      id: s.id,
      imdbId: s.imdbId,
      tmdbId: s.tmdbId,
      title: s.title
    }, { season: 1, episode: 1 });
    const firstUrl = streams[0]?.url || '(sem stream direto - fallback addon)';
    const isFake = firstUrl.includes('Caminandes');
    if (isFake) hasFakeSeries = true;
    console.log(`${s.displayRank}. [${s.title}] S01E01 -> Stream: ${firstUrl} | Fake Caminandes? ${isFake ? 'SIM ❌' : 'NÃO ✅'}`);
  }

  if (hasFakeMovie || hasFakeSeries) {
    console.error('\n❌ ERRO: Streams falsos detectados!');
    process.exit(1);
  } else {
    console.log('\n✅ SUCESSO: ZERO streams falsos! Todos os títulos usam fontes corretas e seguras!');
  }
}

testPlayback().catch(err => {
  console.error(err);
  process.exit(1);
});
