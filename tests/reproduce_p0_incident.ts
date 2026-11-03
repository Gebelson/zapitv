import { sourceVerificationService } from '../src/core/providers/sourceVerificationService';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { ContentItem } from '../types';

async function reproduce() {
  console.log('=== TESTE DE REPRODUÇÃO DO INCIDENTE P0: TODOS OS CONTEÚDOS INDISPONÍVEIS ===\n');

  // Caso 1: Filme com histórico (Sintel / Domínio Público / Acervo Nacional)
  const movie: ContentItem = {
    id: 'sintel-open',
    title: 'Sintel',
    originalTitle: 'Sintel',
    type: 'filme',
    year: 2010,
    category: 'Filmes',
    imdbId: 'tt1727588',
    overview: 'Filme aberto de animação'
  };

  console.log('1. Testando Filme: Sintel (tt1727588)...');
  const movieResult = await sourceVerificationService.verifySources(movie);
  console.log('   Resultado Sintel:', movieResult.state);
  console.log('   Streams encontrados:', movieResult.streams.length);
  console.log('   Diagnostic:', JSON.stringify({
    finalState: movieResult.diagnosticLog.finalState,
    inconclusiveReason: movieResult.diagnosticLog.inconclusiveReason,
    returnedStreamsCount: movieResult.diagnosticLog.returnedStreamsCount,
    approvedStreamsCount: movieResult.diagnosticLog.approvedStreamsCount,
    timeouts: movieResult.diagnosticLog.timeouts,
    networkErrors: movieResult.diagnosticLog.networkErrors
  }, null, 2));

  // Caso 2: Série
  const series: ContentItem = {
    id: 'breaking-bad-series',
    title: 'Breaking Bad',
    originalTitle: 'Breaking Bad',
    type: 'serie',
    year: 2008,
    category: 'Séries',
    imdbId: 'tt0903747',
    overview: 'Série de TV'
  };

  console.log('\n2. Testando Série: Breaking Bad S01E01 (tt0903747:1:1)...');
  const seriesResult = await sourceVerificationService.verifySources(series, { season: 1, episode: 1 });
  console.log('   Resultado Breaking Bad:', seriesResult.state);
  console.log('   Streams encontrados:', seriesResult.streams.length);
  console.log('   Diagnostic:', JSON.stringify({
    finalState: seriesResult.diagnosticLog.finalState,
    inconclusiveReason: seriesResult.diagnosticLog.inconclusiveReason,
    returnedStreamsCount: seriesResult.diagnosticLog.returnedStreamsCount,
    approvedStreamsCount: seriesResult.diagnosticLog.approvedStreamsCount,
    timeouts: seriesResult.diagnosticLog.timeouts,
    networkErrors: seriesResult.diagnosticLog.networkErrors
  }, null, 2));

  // Caso 3: Anime
  const anime: ContentItem = {
    id: 'naruto-anime',
    title: 'Naruto',
    originalTitle: 'Naruto',
    type: 'anime',
    year: 2002,
    category: 'Animes',
    imdbId: 'tt0409591',
    overview: 'Anime clássico'
  };

  console.log('\n3. Testando Anime: Naruto S01E01 (tt0409591:1:1)...');
  const animeResult = await sourceVerificationService.verifySources(anime, { season: 1, episode: 1 });
  console.log('   Resultado Naruto:', animeResult.state);
  console.log('   Streams encontrados:', animeResult.streams.length);
  console.log('   Diagnostic:', JSON.stringify({
    finalState: animeResult.diagnosticLog.finalState,
    inconclusiveReason: animeResult.diagnosticLog.inconclusiveReason,
    returnedStreamsCount: animeResult.diagnosticLog.returnedStreamsCount,
    approvedStreamsCount: animeResult.diagnosticLog.approvedStreamsCount,
    timeouts: animeResult.diagnosticLog.timeouts,
    networkErrors: animeResult.diagnosticLog.networkErrors
  }, null, 2));

  console.log('\n=== ESTADO DOS CIRCUIT BREAKERS APÓS AS CONSULTAS ===');
  const providers = providerRegistry.getProviders();
  const failures = (providerRegistry as any).providerFailures as Map<string, any>;
  for (const p of providers) {
    const f = failures?.get(p.id);
    console.log(` - Provedor: ${p.id} | Falhas: ${f?.count || 0} | CooldownUntil: ${f?.cooldownUntil ? new Date(f.cooldownUntil).toISOString() : 'NENHUM'}`);
  }

  process.exit(0);
}

reproduce().catch(err => {
  console.error('Erro na reprodução:', err);
  process.exit(1);
});
