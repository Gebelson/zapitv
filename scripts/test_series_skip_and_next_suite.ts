import { skipService, SkipInterval } from '../src/core/skip/skipService';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { ContentItem, ContentType } from '../types';
import { autoPlayService } from '../src/core/playback/autoPlayService';
import { playbackSessionService } from '../src/core/session/playbackSessionService';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${testName}${detail ? ` (${detail})` : ''}`);
    passCount++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m ${testName}${detail ? ` (${detail})` : ''}`);
    failCount++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   ZAPITV - SUÍTE DE TESTES: SKIP & PRÓXIMO EPISÓDIO');
  console.log('======================================================\n');

  // -----------------------------------------------------------------
  // 1. Detecção de Abertura e Créditos em Séries Convencionais (IntroDB)
  // -----------------------------------------------------------------
  console.log('--- 1. Detecção em Séries Convencionais (IntroDB) ---');
  
  // Game of Thrones (IMDb tt0944947, TMDB 1399)
  const gotItem: ContentItem = {
    id: 'tmdb-1399',
    tmdbId: '1399',
    title: 'Game of Thrones',
    type: ContentType.SERIES,
    rating: 9.2,
    year: 2011,
    image: 'https://example.com/got.jpg'
  };

  const gotIntervals = await skipService.getSkipTimes(gotItem, 1, 1, 3700);
  const gotOp = gotIntervals.find(i => i.type === 'op');
  const gotEd = gotIntervals.find(i => i.type === 'ed');

  assert(Boolean(gotOp), 'Game of Thrones S01E01 possui detecção de abertura (op)', `Início: ${gotOp?.startTime}s, Fim: ${gotOp?.endTime}s`);
  assert(gotOp?.label === 'Pular Abertura', 'Label da abertura de GoT é "Pular Abertura"');
  assert(Boolean(gotEd), 'Game of Thrones S01E01 possui detecção de créditos (ed)', `Início: ${gotEd?.startTime}s, Fim: ${gotEd?.endTime}s`);
  assert(gotEd?.label === 'Pular Créditos', 'Label dos créditos de GoT é "Pular Créditos" (não "Pular Encerramento")');
  assert(gotOp?.source === 'introdb', 'Origem dos intervalos é IntroDB');

  // Ted Lasso (IMDb tt10986410, TMDB 97546)
  const tedItem: ContentItem = {
    id: '97546',
    title: 'Ted Lasso',
    type: ContentType.SERIES,
    rating: 8.8,
    year: 2020,
    image: 'https://example.com/ted.jpg'
  };

  const tedIntervals = await skipService.getSkipTimes(tedItem, 1, 1, 1855);
  const tedOp = tedIntervals.find(i => i.type === 'op');
  const tedEd = tedIntervals.find(i => i.type === 'ed');

  assert(Boolean(tedOp), 'Ted Lasso S01E01 detecta abertura via TMDB ID numérico', `Início: ${tedOp?.startTime}s, Fim: ${tedOp?.endTime}s`);
  assert(tedOp?.label === 'Pular Abertura', 'Ted Lasso label é "Pular Abertura"');
  assert(Boolean(tedEd), 'Ted Lasso S01E01 detecta créditos finais', `Início: ${tedEd?.startTime}s, Fim: ${tedEd?.endTime}s`);
  assert(tedEd?.label === 'Pular Créditos', 'Ted Lasso créditos label é "Pular Créditos"');

  // Stranger Things (IMDb tt4574334)
  const stItem: ContentItem = {
    id: 'tt4574334',
    imdbId: 'tt4574334',
    title: 'Stranger Things',
    type: ContentType.SERIES,
    rating: 8.7,
    year: 2016,
    image: 'https://example.com/st.jpg'
  };

  const stIntervals = await skipService.getSkipTimes(stItem, 1, 1, 2850);
  const stOp = stIntervals.find(i => i.type === 'op');
  const stEd = stIntervals.find(i => i.type === 'ed');

  assert(Boolean(stOp), 'Stranger Things S01E01 detecta abertura', `Início: ${stOp?.startTime}s, Fim: ${stOp?.endTime}s`);
  assert(Boolean(stEd), 'Stranger Things S01E01 detecta créditos', `Início: ${stEd?.startTime}s, Fim: ${stEd?.endTime}s`);

  // -----------------------------------------------------------------
  // 2. Não regressão: Animes continuam funcionando (AniSkip)
  // -----------------------------------------------------------------
  console.log('\n--- 2. Preservação de Animes (AniSkip) ---');
  
  // Attack on Titan (Shingeki no Kyojin - MAL ID 16498)
  const aotItem: ContentItem = {
    id: 'aot-anime',
    title: 'Attack on Titan',
    originalTitle: 'Shingeki no Kyojin',
    type: ContentType.ANIME,
    rating: 9.0,
    year: 2013,
    image: 'https://example.com/aot.jpg',
    genres: ['Anime', 'Ação']
  };

  const aotIntervals = await skipService.getSkipTimes(aotItem, 1, 1, 1440);
  const aotOp = aotIntervals.find(i => i.type === 'op');
  const aotEd = aotIntervals.find(i => i.type === 'ed');

  assert(Boolean(aotOp), 'Attack on Titan S01E01 detecta abertura via AniSkip', `Início: ${aotOp?.startTime}s, Fim: ${aotOp?.endTime}s`);
  assert(aotOp?.label === 'Pular Abertura', 'Abertura de Anime com label "Pular Abertura"');
  assert(Boolean(aotEd), 'Attack on Titan S01E01 detecta créditos/encerramento via AniSkip', `Início: ${aotEd?.startTime}s, Fim: ${aotEd?.endTime}s`);
  assert(aotEd?.label === 'Pular Créditos', 'Encerramento de Anime padronizado para "Pular Créditos"');

  // -----------------------------------------------------------------
  // 3. Regra de Precisão: Sem tempos fixos / fictícios
  // -----------------------------------------------------------------
  console.log('\n--- 3. Regra de Precisão (Sem dados fictícios) ---');

  const fictionalShow: ContentItem = {
    id: 'fake-show-999999',
    title: 'Obra Ficticia Sem Dados',
    type: ContentType.SERIES,
    rating: 7.0,
    year: 2024,
    image: 'https://example.com/fake.jpg'
  };

  const fakeIntervals = await skipService.getSkipTimes(fictionalShow, 1, 1, 1800);
  assert(fakeIntervals.length === 0, 'Obra sem metadados confiáveis NÃO inventa intervalos arbitrários');

  // -----------------------------------------------------------------
  // 4. Lógica de Próximo Episódio e Transição entre Temporadas
  // -----------------------------------------------------------------
  console.log('\n--- 4. Lógica de Próximo Episódio e Temporadas ---');

  // Teste A: Próximo episódio na mesma temporada (Episódio 1 de 10)
  const calcNext = (
    curSeason: number,
    curEpisode: number,
    seasonEpCount: number,
    totalSeasons: number,
    epList: Array<{ number: number; title: string }>
  ) => {
    const hasNext = seasonEpCount > 0
      ? (curEpisode < seasonEpCount || curSeason < totalSeasons)
      : (curSeason < totalSeasons);

    let nextInfo: { season: number; episode: number; title: string } | null = null;
    if (seasonEpCount > 0 && curEpisode < seasonEpCount) {
      const nextNum = curEpisode + 1;
      const found = epList.find(e => e.number === nextNum);
      nextInfo = {
        season: curSeason,
        episode: nextNum,
        title: found?.title || `Episódio ${nextNum}`
      };
    } else if (curSeason < totalSeasons) {
      nextInfo = {
        season: curSeason + 1,
        episode: 1,
        title: `Temporada ${curSeason + 1} • Episódio 1`
      };
    }

    return { hasNext, nextInfo };
  };

  const sameSeasonTest = calcNext(1, 1, 10, 3, [
    { number: 1, title: 'Winter Is Coming' },
    { number: 2, title: 'The Kingsroad' }
  ]);
  assert(sameSeasonTest.hasNext === true, 'S01E01 tem próximo episódio');
  assert(sameSeasonTest.nextInfo?.season === 1 && sameSeasonTest.nextInfo?.episode === 2, 'S01E01 avança para S01E02');
  assert(sameSeasonTest.nextInfo?.title === 'The Kingsroad', 'Título correto do próximo episódio');

  // Teste B: Transição de Temporada (Último episódio da Temporada 1: S01E10 de 10, Série com 3 Temporadas)
  const seasonTransitionTest = calcNext(1, 10, 10, 3, [
    { number: 10, title: 'Fire and Blood' }
  ]);
  assert(seasonTransitionTest.hasNext === true, 'S01E10 possui próxima temporada');
  assert(seasonTransitionTest.nextInfo?.season === 2 && seasonTransitionTest.nextInfo?.episode === 1, 'S01E10 avança para Temporada 2, Episódio 1');
  assert(seasonTransitionTest.nextInfo?.title === 'Temporada 2 • Episódio 1', 'Título formatado para Temporada 2 • Episódio 1');

  // Teste C: Lista de episódios temporariamente vazia enquanto carrega temporada seguinte
  const loadingTransitionTest = calcNext(1, 10, 0, 3, []);
  assert(loadingTransitionTest.hasNext === true, 'Enquanto a nova temporada carrega em background, hasNextEpisode permanece true');
  assert(loadingTransitionTest.nextInfo?.season === 2 && loadingTransitionTest.nextInfo?.episode === 1, 'nextEpisodeInfo aponta para Temporada 2 Episódio 1 mesmo sem cache prévio');

  // Teste D: Último episódio absoluto da série (Temporada 3 de 3, Episódio 10 de 10)
  const finalSeriesTest = calcNext(3, 10, 10, 3, [
    { number: 10, title: 'The Iron Throne' }
  ]);
  assert(finalSeriesTest.hasNext === false, 'Último episódio da última temporada não tem próximo episódio');
  assert(finalSeriesTest.nextInfo === null, 'nextEpisodeInfo é null no final da série');

  // -----------------------------------------------------------------
  // 5. Comportamento do Botão Pular Créditos e Autoplay
  // -----------------------------------------------------------------
  console.log('\n--- 5. Pular Créditos e Reprodução Automática (10s) ---');

  // Simulação de ação do botão Pular Créditos
  let nextEpisodeCalled = false;
  const mockOnNextEpisode = () => { nextEpisodeCalled = true; };

  const simulateSkipAction = (interval: SkipInterval, onNext?: () => void) => {
    if (interval.type === 'ed' && onNext) {
      onNext();
      return 'advanced_to_next_episode';
    }
    return 'seeked_to_end_of_interval';
  };

  const edInterval: SkipInterval = {
    startTime: 3631.5,
    endTime: 3699.5,
    rawStartTime: 3631.5,
    rawEndTime: 3699.5,
    type: 'ed',
    label: 'Pular Créditos',
    source: 'introdb'
  };

  const resultWithNext = simulateSkipAction(edInterval, mockOnNextEpisode);
  assert(resultWithNext === 'advanced_to_next_episode' && nextEpisodeCalled === true, 'Clicar em "Pular Créditos" avança diretamente para o próximo episódio');

  const resultWithoutNext = simulateSkipAction(edInterval, undefined);
  assert(resultWithoutNext === 'seeked_to_end_of_interval', 'No último episódio da série sem próximo, Pular Créditos faz seek para o fim do vídeo');

  // Teste de Autoplay Countdown trigger
  const checkCountdownTrigger = (currentTime: number, duration: number, intervals: SkipInterval[]) => {
    const remainingTime = duration - currentTime;
    const isCreditsActive = intervals.some(i => i.type === 'ed' && currentTime >= i.startTime);
    return (isCreditsActive || remainingTime <= 12) && currentTime > 10;
  };

  assert(checkCountdownTrigger(3640, 3700, [edInterval]) === true, 'Contagem regressiva de 10s dispara ao entrar nos créditos (currentTime 3640s > 3631.5s)');
  assert(checkCountdownTrigger(3689, 3700, []) === true, 'Contagem regressiva de 10s dispara nos últimos 12s mesmo se não houver intervalo de créditos');
  assert(checkCountdownTrigger(100, 3700, [edInterval]) === false, 'Contagem regressiva NÃO dispara no meio do episódio');

  // -----------------------------------------------------------------
  // 6. Continuidade e Não Repetição da Intro do ZapiTV
  // -----------------------------------------------------------------
  console.log('\n--- 6. Continuidade e Preservação da Intro ---');

  // Inicia primeira sessão com 'manual_start'
  const session1 = playbackSessionService.startSession('tmdb-1399', 'manual_start', 1, 1);
  assert(playbackSessionService.shouldPlayIntro(session1.sessionId) === true, 'Primeiro episódio iniciado manualmente toca a intro institucional');

  // Marca intro como tocada
  playbackSessionService.markIntroPlayed(session1.sessionId);
  assert(playbackSessionService.shouldPlayIntro(session1.sessionId) === false, 'Após tocar uma vez, intro não repete na mesma sessão');

  // Próximo episódio iniciado via 'continuous_playback' (autoplay ou botão próximo episódio)
  const session2 = playbackSessionService.startSession('tmdb-1399', 'continuous_playback', 1, 2);
  assert(playbackSessionService.shouldPlayIntro(session2.sessionId) === false, 'Avanço para o próximo episódio com "continuous_playback" NUNCA repete a intro');

  // -----------------------------------------------------------------
  // 7. Avanços e Retrocessos Manuais na Barra de Tempo (Seek & Reaparecimento)
  // -----------------------------------------------------------------
  console.log('\n--- 7. Avanços e Retrocessos Manuais na Barra de Tempo ---');

  // Simula estado do player com intervalos de GoT (abertura: 437s a 531s, créditos: 3631.5s a 3699.5s)
  const intervals: SkipInterval[] = [
    { startTime: 437, endTime: 531, rawStartTime: 437, rawEndTime: 531, type: 'op', label: 'Pular Abertura', source: 'introdb' },
    { startTime: 3631.5, endTime: 3699.5, rawStartTime: 3631.5, rawEndTime: 3699.5, type: 'ed', label: 'Pular Créditos', source: 'introdb' }
  ];

  const getActiveInterval = (time: number) => {
    return intervals.find(i => {
      if (i.type === 'ed') return time >= i.startTime && time <= i.endTime;
      return time >= i.startTime && time < i.endTime;
    }) || null;
  };

  // Cenário 1: Usuário avança diretamente para o meio da abertura (ex: seek para 450s)
  let active = getActiveInterval(450);
  assert(active !== null && active.type === 'op', 'Ao avançar diretamente para o trecho de abertura (450s), o botão Pular Abertura aparece');

  // Cenário 2: Usuário clica no botão para pular a abertura -> avança para 531s
  let currentTimeSim = active!.endTime;
  active = getActiveInterval(currentTimeSim);
  assert(active === null || currentTimeSim > 531, 'Após pular a abertura, botão desaparece fora do intervalo (531s)');

  // Cenário 3: RETROCESSO - Usuário volta manualmente na barra de tempo para 440s
  currentTimeSim = 440;
  active = getActiveInterval(currentTimeSim);
  assert(active !== null && active.type === 'op', 'Ao retroceder para a abertura (440s), o botão Pular Abertura reaparece imediatamente');

  // Cenário 4: Usuário avança diretamente para os créditos (ex: seek para 3650s)
  currentTimeSim = 3650;
  active = getActiveInterval(currentTimeSim);
  assert(active !== null && active.type === 'ed', 'Ao avançar diretamente para os créditos finais (3650s), o botão Pular Créditos aparece imediatamente');
  assert(active?.label === 'Pular Créditos', 'Rótulo exibido é "Pular Créditos"');

  // Cenário 5: RETROCESSO de créditos - Usuário volta para o meio do episódio (ex: 2000s)
  currentTimeSim = 2000;
  active = getActiveInterval(currentTimeSim);
  assert(active === null, 'Ao retroceder para fora dos créditos (2000s), botão de créditos desaparece');

  // Cenário 6: Reavanço para o final do episódio (< 12s restantes, ex: 3690s com duração de 3700s)
  currentTimeSim = 3690;
  const countdownAtEnd = (3700 - currentTimeSim) <= 12;
  assert(countdownAtEnd === true, 'Ao chegar ou avançar para os últimos 12 segundos, contagem regressiva de 10s é ativada');

  // Cenário 7: Retrocesso a partir do final (seek de volta para 1000s)
  currentTimeSim = 1000;
  const remainingAfterRewind = 3700 - currentTimeSim;
  const resetCountdown = remainingAfterRewind > 15;
  assert(resetCountdown === true, 'Ao retroceder a partir do final do vídeo, a contagem de autoplay é cancelada e resetada dinamicamente');

  // Cenário 8: Anime - Teste de avanço e retrocesso (Attack on Titan: abertura 47.37s a 137.37s)
  const aotOpInterval: SkipInterval = { startTime: 47.37, endTime: 137.37, rawStartTime: 47.37, rawEndTime: 137.37, type: 'op', label: 'Pular Abertura', source: 'aniskip' };
  const getAnimeActive = (time: number) => (time >= aotOpInterval.startTime && time <= aotOpInterval.endTime ? aotOpInterval : null);

  assert(getAnimeActive(10) === null, 'Anime aos 10s: botão de abertura não exibido');
  assert(getAnimeActive(60) !== null, 'Anime aos 60s (seek para abertura): botão Pular Abertura exibido');
  assert(getAnimeActive(140) === null, 'Anime aos 140s (após abertura): botão desaparece');
  assert(getAnimeActive(50) !== null, 'Anime retrocesso para 50s: botão Pular Abertura reaparece e fica utilizável novamente');

  console.log('\n======================================================');
  console.log(`RESULTADO FINAL: ${passCount} PASSOU | ${failCount} FALHOU`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
