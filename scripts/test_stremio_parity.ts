import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { providerRegistry } from '../src/core/providers/providerRegistry';

async function runParityTests() {
  console.log('=== TESTE DE PARIDADE ZAPITV <-> STREMIO ===\n');

  // Teste 1: Busca por Título (Deadpool)
  console.log('1. Testando busca híbrida por "Deadpool"...');
  const deadpoolResults = await tmdbService.searchMulti('Deadpool');
  console.log(`   -> Total de resultados encontrados: ${deadpoolResults.length}`);
  if (deadpoolResults.length > 0) {
    console.log(`   -> Primeiro resultado: "${deadpoolResults[0].title}" (${deadpoolResults[0].year}) [ID: ${deadpoolResults[0].id}, IMDb: ${deadpoolResults[0].imdbId || 'N/A'}]`);
  }
  if (deadpoolResults.length === 0) throw new Error('Falha: Nenhum resultado para Deadpool');

  // Teste 2: Busca por IMDb ID direto (tt1431045)
  console.log('\n2. Testando busca direta por IMDb ID "tt1431045"...');
  const imdbResults = await tmdbService.searchMulti('tt1431045');
  console.log(`   -> Resultados por IMDb ID: ${imdbResults.length}`);
  if (imdbResults.length > 0) {
    console.log(`   -> Título encontrado: "${imdbResults[0].title}" [IMDb: ${imdbResults[0].imdbId}]`);
  }
  if (imdbResults.length === 0) throw new Error('Falha: Busca por IMDb ID falhou');

  // Teste 3: Catálogo Cinemeta Oficial Stremio
  console.log('\n3. Testando catálogo oficial Stremio Cinemeta (Top Filmes e Séries)...');
  const [topMovies, topSeries] = await Promise.all([
    tmdbService.getCinemetaCatalog('movie'),
    tmdbService.getCinemetaCatalog('series')
  ]);
  console.log(`   -> Filmes no topo do Cinemeta: ${topMovies.length}`);
  console.log(`   -> Séries no topo do Cinemeta: ${topSeries.length}`);
  if (topMovies.length === 0 || topSeries.length === 0) throw new Error('Falha ao obter catálogo Cinemeta');

  // Teste 4: Resolução de Metadados e Episódios por IMDb ID
  console.log('\n4. Testando detalhes e episódios por IMDb ID (tt0903747 - Breaking Bad)...');
  const details = await tmdbService.getDetailsByImdb('tt0903747', 'series' as any);
  console.log(`   -> Detalhes obtidos: "${details.item.title}", Diretor: "${details.director || 'N/A'}", Temporadas: ${details.seasonsCount}`);
  const eps = await tmdbService.getSeasonEpisodesByImdb('tt0903747', 1);
  console.log(`   -> Episódios da Temporada 1: ${eps.length} (Exemplo: ${eps[0]?.title})`);
  if (eps.length === 0) throw new Error('Falha ao obter episódios por IMDb');

  // Teste 5: Resolução de Streams reais via Torrentio / Mico-Leão Dublado
  console.log('\n5. Testando resolução de streams para item Cinemeta/IMDb (The Avengers tt0848228)...');
  const streams = await providerRegistry.resolveStreams('movie', { imdbId: 'tt0848228', id: 'tt0848228' });
  console.log(`   -> Total de streams resolvidos pelos add-ons: ${streams.length}`);
  const ptBrStreams = streams.filter(s => s.isPtBr || s.isDubbed);
  console.log(`   -> Streams em Português / Dublado PT-BR: ${ptBrStreams.length}`);
  if (streams.length > 0) {
    console.log(`   -> Melhor stream selecionado: "${streams[0].title}" [Fonte: ${streams[0].providerName}]`);
  }
  if (streams.length === 0) throw new Error('Falha: Nenhum stream retornado pelos add-ons');

  console.log('\n=== TODOS OS 5 TESTES DE PARIDADE PASSARAM COM SUCESSO! ===');
}

runParityTests().catch(err => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
