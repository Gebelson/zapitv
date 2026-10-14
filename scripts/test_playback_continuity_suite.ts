import { storageService, formatPlaybackTime } from '../src/core/storage/storageService';
import { ContentType, ContentItem } from '../types';

async function runContinuitySuite() {
  console.log('=== INICIANDO SUÍTE DE TESTES: RETOMADA AUTOMÁTICA E CONTINUIDADE ZAPITV ===\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extra?: any) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`, extra ? extra : '');
      failed++;
    }
  }

  // 1. Teste de formatação de tempo
  console.log('--- TESTE 1: Formatação de tempo ---');
  assert('0s formata para 00:00', formatPlaybackTime(0) === '00:00');
  assert('875s (14m35s) formata para 14:35', formatPlaybackTime(875) === '14:35');
  assert('3665s (1h01m05s) formata para 1:01:05', formatPlaybackTime(3665) === '1:01:05');

  // 2. Teste de item nunca assistido
  console.log('\n--- TESTE 2: Série/Anime nunca assistido ---');
  const newItem: ContentItem = {
    id: 'frieren-beyond-journeys-end',
    title: 'Frieren: Beyond Journey\'s End',
    type: ContentType.ANIME,
    image: 'http://example.com/frieren.jpg',
    rating: 9.3,
    year: 2023,
    seasonsCount: 1
  };

  const newContinuity = storageService.getPlaybackContinuity(newItem);
  assert('Item nunca assistido tem hasStarted = false', newContinuity.hasStarted === false);
  assert('Item nunca assistido aponta para Temporada 1', newContinuity.season === 1);
  assert('Item nunca assistido aponta para Episódio 1', newContinuity.episode === 1);
  assert('Item nunca assistido tem currentTime = 0', newContinuity.currentTime === 0);
  assert('Item nunca assistido tem actionText = "Assistir"', newContinuity.actionText === 'Assistir');

  // 3. Teste do caso clássico: Mushoku Tensei assistido até T2:E8 a 14:35 (875s de 1420s)
  console.log('\n--- TESTE 3: Mushoku Tensei em andamento (T2:E8 a 14:35) ---');
  const mushokuItem: ContentItem = {
    id: 'mushoku-tensei-jobless-reincarnation',
    imdbId: 'tt13292904',
    tmdbId: 99516,
    title: 'Mushoku Tensei: Jobless Reincarnation',
    type: ContentType.ANIME,
    image: 'http://example.com/mushoku.jpg',
    rating: 8.8,
    year: 2021,
    seasonsCount: 2
  };

  await storageService.saveProgress({
    contentId: mushokuItem.id,
    item: mushokuItem,
    season: 2,
    episode: 8,
    currentTime: 875, // 14 minutos e 35 segundos
    duration: 1420,  // ~23 minutos e 40 segundos
    percentage: Math.round((875 / 1420) * 100), // ~62%
    updatedAt: new Date().toISOString()
  });

  const mushokuCont = storageService.getPlaybackContinuity(mushokuItem, 2, 12);
  assert('Mushoku Tensei tem hasStarted = true', mushokuCont.hasStarted === true);
  assert('Mushoku Tensei não está completado', mushokuCont.isCompleted === false);
  assert('Retoma na Temporada 2', mushokuCont.season === 2);
  assert('Retoma no Episódio 8', mushokuCont.episode === 8);
  assert('Retoma exatamente no segundo 875 (14:35)', mushokuCont.currentTime === 875);
  assert('Posição formatada é 14:35', mushokuCont.formattedPosition === '14:35');
  assert('Label é "T2 • E8"', mushokuCont.label === 'T2 • E8');
  assert('actionText é "Continuar assistindo"', mushokuCont.actionText === 'Continuar assistindo');
  assert('isNextEpisode é false', mushokuCont.isNextEpisode === false);

  // 4. Teste de resolução canônica com ID alternativo (IMDb vs ID interno)
  console.log('\n--- TESTE 4: Identificação Canônica Multi-ID ---');
  // Consulta passando apenas o objeto com IMDb ID
  const itemConsultedByImdb: ContentItem = {
    id: 'tt13292904',
    imdbId: 'tt13292904',
    title: 'Mushoku Tensei',
    type: ContentType.ANIME,
    image: '',
    rating: 8.8,
    year: 2021
  };
  const imdbCont = storageService.getPlaybackContinuity(itemConsultedByImdb, 2, 12);
  assert('Consulta por IMDb ID encontra o progresso salvo sob id interno', imdbCont.hasStarted === true && imdbCont.season === 2 && imdbCont.episode === 8);
  assert('Tempo recuperado por IMDb ID é 875s', imdbCont.currentTime === 875);

  // 5. Teste de avanço automático: Episódio Concluído (>= 92%)
  console.log('\n--- TESTE 5: Episódio Concluído (>= 92%) avança para próximo episódio ---');
  // Usuário concluiu o T2:E8 (assistiu 1380s de 1420s = 97%)
  await storageService.saveProgress({
    contentId: mushokuItem.id,
    item: mushokuItem,
    season: 2,
    episode: 8,
    currentTime: 1380,
    duration: 1420,
    percentage: 100, // normalized >= 92%
    updatedAt: new Date().toISOString()
  });

  const nextEpCont = storageService.getPlaybackContinuity(mushokuItem, 2, 12);
  assert('Após concluir T2:E8, avança para Episódio 9', nextEpCont.episode === 9);
  assert('Permanece na Temporada 2', nextEpCont.season === 2);
  assert('Tempo do novo episódio inicia no 0', nextEpCont.currentTime === 0);
  assert('isNextEpisode é true', nextEpCont.isNextEpisode === true);
  assert('Label atualizado para T2 • E9', nextEpCont.label === 'T2 • E9');

  // 6. Teste de virada de temporada: Último episódio da temporada concluído
  console.log('\n--- TESTE 6: Fim de Temporada avança para próxima temporada EP 1 ---');
  const soloLeveling: ContentItem = {
    id: 'solo-leveling',
    title: 'Solo Leveling',
    type: ContentType.ANIME,
    image: 'http://example.com/solo.jpg',
    rating: 8.9,
    year: 2024,
    seasonsCount: 2
  };

  // Concluiu T1:E12 (12 de 12)
  await storageService.saveProgress({
    contentId: soloLeveling.id,
    item: soloLeveling,
    season: 1,
    episode: 12,
    currentTime: 1400,
    duration: 1420,
    percentage: 100,
    updatedAt: new Date().toISOString()
  });

  const nextSeasonCont = storageService.getPlaybackContinuity(soloLeveling, 2, 12);
  assert('Após concluir último EP da T1 (12/12), avança para Temporada 2', nextSeasonCont.season === 2);
  assert('Avança para o Episódio 1 da Temporada 2', nextSeasonCont.episode === 1);
  assert('Tempo inicial é 0', nextSeasonCont.currentTime === 0);
  assert('Label é T2 • E1', nextSeasonCont.label === 'T2 • E1');

  // 7. Teste de série concluída por completo (último EP da última temporada)
  console.log('\n--- TESTE 7: Série Concluída Integralmente ---');
  // Concluiu T2:E12 (último episódio da última temporada)
  await storageService.saveProgress({
    contentId: soloLeveling.id,
    item: soloLeveling,
    season: 2,
    episode: 12,
    currentTime: 1400,
    duration: 1420,
    percentage: 100,
    updatedAt: new Date().toISOString()
  });

  const seriesCompletedCont = storageService.getPlaybackContinuity(soloLeveling, 2, 12);
  assert('Série concluída tem isCompleted = true', seriesCompletedCont.isCompleted === true);
  assert('Não retrocede para T1:E1 do zero', seriesCompletedCont.season === 2 && seriesCompletedCont.episode === 12);
  assert('actionText é "Assistir"', seriesCompletedCont.actionText === 'Assistir');

  // 8. Teste de Filme
  console.log('\n--- TESTE 8: Filme (Em andamento vs Concluído) ---');
  const movieItem: ContentItem = {
    id: 'oppenheimer-2023',
    title: 'Oppenheimer',
    type: ContentType.MOVIE,
    image: 'http://example.com/oppenheimer.jpg',
    rating: 8.9,
    year: 2023
  };

  // Filme em 45 minutos (2700s de 10800s = 25%)
  await storageService.saveProgress({
    contentId: movieItem.id,
    item: movieItem,
    currentTime: 2700,
    duration: 10800,
    percentage: 25,
    updatedAt: new Date().toISOString()
  });

  const movieInProgress = storageService.getPlaybackContinuity(movieItem);
  assert('Filme em andamento tem hasStarted = true', movieInProgress.hasStarted === true);
  assert('Filme em andamento retoma aos 2700s (45:00)', movieInProgress.currentTime === 2700 && movieInProgress.formattedPosition === '45:00');
  assert('actionText é "Continuar assistindo"', movieInProgress.actionText === 'Continuar assistindo');

  // Filme concluído (95%)
  await storageService.saveProgress({
    contentId: movieItem.id,
    item: movieItem,
    currentTime: 10300,
    duration: 10800,
    percentage: 100,
    updatedAt: new Date().toISOString()
  });

  const movieCompleted = storageService.getPlaybackContinuity(movieItem);
  assert('Filme concluído tem isCompleted = true', movieCompleted.isCompleted === true);
  assert('Filme concluído reinicia em 0', movieCompleted.currentTime === 0);

  console.log(`\n======================================================`);
  console.log(`RESULTADO DA SUÍTE: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runContinuitySuite().catch(err => {
  console.error('Erro na suíte de testes:', err);
  process.exit(1);
});
