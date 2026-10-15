import { providerRegistry } from '../src/core/providers/providerRegistry.ts';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService.ts';
import { playbackSessionService } from '../src/core/session/playbackSessionService.ts';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog.ts';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  results.push({
    name,
    passed: condition,
    details: condition ? 'OK' : (details || 'Assertion failed')
  });
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${name}`);
  if (!condition && details) {
    console.error(`       Error: ${details}`);
  }
}

async function runTests() {
  console.log('=== ZAPITV — SUÍTE DE TESTES: MODAIS, NAVEGAÇÃO E PLAYBACK ===\n');

  // Teste 1: Sessão de Playback e ciclo de vida da intro
  try {
    const session1 = playbackSessionService.startSession('item-1', 'manual_start');
    assert(session1.introPlayed === false, '1. Nova sessão inicia com introPlayed = false');
    assert(playbackSessionService.shouldPlayIntro(session1.sessionId) === true, '2. shouldPlayIntro retorna true na primeira reprodução');

    playbackSessionService.markIntroPlayed(session1.sessionId);
    assert(playbackSessionService.shouldPlayIntro(session1.sessionId) === false, '3. shouldPlayIntro retorna false após marcar introPlayed');

    const sessionContinuous = playbackSessionService.startSession('item-1', 'continuous_playback', 1, 2);
    assert(sessionContinuous.introPlayed === true, '4. Reprodução contínua (próximo episódio) não toca intro novamente');

    playbackSessionService.endSession(session1.sessionId);
    assert(playbackSessionService.getCurrentSession() === null, '5. Encerramento de sessão limpa a sessão ativa com segurança');
  } catch (err: any) {
    assert(false, 'Ciclo de vida da sessão de playback', err.message);
  }

  // Teste 2: Resolução de Stream para Itens do Catálogo e Em Destaque
  try {
    console.log('\n--- Testando resolução de fontes verificadas ---');
    
    // Teste 2.1: A Noite dos Mortos-Vivos (Filme)
    const deadStreams = await providerRegistry.resolveStreams('movie', {
      id: 'open-night-living-dead-1968',
      title: 'A Noite dos Mortos-Vivos (Night of the Living Dead)',
      imdbId: 'tt0063350'
    });
    assert(deadStreams.length > 0, '6. Resolução de Filme Verificado (A Noite dos Mortos-Vivos)', `Encontrados ${deadStreams.length} streams com URL reproduzível`);

    // Teste 2.2: Bleach (Anime)
    let bleachStreams = await providerRegistry.resolveStreams('anime', {
      id: 'anime-bleach-tvmeter',
      title: 'Bleach: Thousand-Year Blood War',
      imdbId: 'tt11980728'
    }, { season: 1, episode: 1 });
    if (bleachStreams.length === 0) {
      await new Promise(r => setTimeout(r, 600));
      bleachStreams = await providerRegistry.resolveStreams('anime', {
        id: 'anime-bleach-tvmeter',
        title: 'Bleach: Thousand-Year Blood War',
        imdbId: 'tt11980728'
      }, { season: 1, episode: 1 });
    }
    assert(bleachStreams.length > 0, '7. Resolução de Anime Verificado (Bleach)', `Encontrados ${bleachStreams.length} streams`);

    // Teste 2.3: Ted Lasso (Série)
    const tedStreams = await providerRegistry.resolveStreams('series', {
      id: 'series-ted-lasso',
      title: 'Ted Lasso',
      imdbId: 'tt10986410'
    }, { season: 1, episode: 1 });
    assert(tedStreams.length > 0, '8. Resolução de Série Verificada (Ted Lasso)', `Encontrados ${tedStreams.length} streams`);

    // Teste 2.4: Caminandes deve ser bloqueado definitivamente (0 streams)
    const caminandesStreams = await providerRegistry.resolveStreams('series', {
      id: 'open-caminandes-s1',
      title: 'Caminandes',
      imdbId: 'tt31454558'
    }, { season: 1, episode: 1 });
    assert(caminandesStreams.length === 0, '9. Bloqueio Completo de Caminandes', `Streams bloqueados com sucesso (0 streams)`);
  } catch (err: any) {
    assert(false, 'Resolução de streams de catálogo', err.message);
  }

  // Teste 3: Ranking do Em Destaque
  try {
    console.log('\n--- Testando Ranking Em Destaque ---');
    const featured = featuredRankingService.getFeaturedSelectionSync();
    assert(featured.featuredMovies.length === 10, '10. Em Destaque possui exatamente 10 filmes verificados', `Contagem: ${featured.featuredMovies.length}`);
    assert(featured.featuredSeries.length === 10, '11. Em Destaque possui exatamente 10 séries verificadas', `Contagem: ${featured.featuredSeries.length}`);

    // Garante que todos os 10 filmes possuem ID único e título
    const movieTitles = new Set(featured.featuredMovies.map(m => m.title));
    assert(movieTitles.size === 10, '12. 10 Filmes em Destaque são distintos', `Distintos: ${movieTitles.size}`);

    // Garante que todas as 10 séries possuem ID único e título
    const seriesTitles = new Set(featured.featuredSeries.map(s => s.title));
    assert(seriesTitles.size === 10, '13. 10 Séries em Destaque são distintas', `Distintas: ${seriesTitles.size}`);
  } catch (err: any) {
    assert(false, 'Ranking Em Destaque', err.message);
  }

  // Resumo
  console.log('\n=================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`TOTAL DE TESTES: ${results.length} | PASSARAM: ${passed} | FALHARAM: ${failed}`);
  console.log('=================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
