import { providerRegistry } from '../src/core/providers/providerRegistry';
import { offlineSourceInspector } from '../src/core/offline/offlineSourceInspector';

async function testSeriesAnime() {
  console.log('=== TESTE DE INSPEÇÃO DE QUALIDADES EM SÉRIES E ANIMES ===');

  // Teste 1: Série / Anime com episódio específico
  console.log('\n--- 1. Testando Anime: Shingeki no Kyojin / Attack on Titan (S01E01) ---');
  try {
    const streams = await providerRegistry.resolveStreams('series', {
      id: '1429',
      tmdbId: '1429',
      imdbId: 'tt2560140',
      title: 'Attack on Titan',
      originalTitle: 'Shingeki no Kyojin',
      year: 2013
    }, { season: 1, episode: 1 });

    console.log(`Streams encontrados para T01E01: ${streams.length}`);
    const diag = await offlineSourceInspector.inspectDownloadOptionsDetailed(streams, 'pt-BR', 24);
    console.log(`Opções de qualidade identificadas: ${diag.options.length}`);
    diag.options.forEach(o => {
      console.log(`  - [${o.quality}] ${(o.estimatedBytes / (1024*1024)).toFixed(0)} MB | Dublado: ${o.isDubbed} | Tipo: ${o.sourceType} | URL: ${o.sourceUrl.slice(0, 70)}...`);
    });
    if (diag.options.length === 0) {
      console.log(`  Motivo indisponível: ${diag.reason}`);
    }
  } catch (err: any) {
    console.error('Erro ao inspecionar anime:', err.message);
  }

  // Teste 2: Filme sem fontes diretas (caso para testar motivo de indisponibilidade)
  console.log('\n--- 2. Testando título sem fontes compatíveis (ex: DRM ou sem streams) ---');
  const dummyDiag = await offlineSourceInspector.inspectDownloadOptionsDetailed([], 'pt-BR', 90);
  console.log('Total opções:', dummyDiag.options.length);
  console.log('Motivo exibido ao usuário:', dummyDiag.reason);

  console.log('\n=== TESTES DE SÉRIE E ANIME CONCLUÍDOS ===');
}

testSeriesAnime().catch(console.error);
