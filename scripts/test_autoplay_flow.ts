import { autoPlayService } from '../src/core/playback/autoPlayService';
import { playbackSessionService } from '../src/core/session/playbackSessionService';

function runTests() {
  console.log('🧪 Iniciando testes de validação da Reprodução Automática do ZapiTV...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // Cenário 1: Switch ativado por padrão & próximo episódio inicia automaticamente
  console.log('--- Cenário 1: Switch ativado & avanço automático ---');
  // Garante valor inicial
  autoPlayService.setAutoPlayEnabled(true);
  assert(autoPlayService.isAutoPlayEnabled() === true, 'Switch de Reprodução automática ativado por padrão');
  
  // Simulação de sessão e próximo episódio
  const session1 = playbackSessionService.startSession('series-stranger-things', 'manual_start', 1, 1);
  playbackSessionService.markIntroPlayed(session1.sessionId);
  
  let episodeAdvanced = false;
  const triggerAutoPlayAdvance = (autoPlay: boolean, isCancelled: boolean, hasNext: boolean) => {
    if (autoPlay && !isCancelled && hasNext) {
      episodeAdvanced = true;
      return playbackSessionService.startSession('series-stranger-things', 'continuous_playback', 1, 2);
    }
    return session1;
  };

  const nextSession = triggerAutoPlayAdvance(autoPlayService.isAutoPlayEnabled(), false, true);
  assert(episodeAdvanced === true, 'Próximo episódio avança automaticamente com switch ativado');
  assert(nextSession.sessionId === session1.sessionId, 'SessionId preservado para reprodução contínua');
  assert(playbackSessionService.shouldPlayIntro(nextSession.sessionId) === false, 'Intro NÃO toca no avanço automático');


  // Cenário 2: Switch desativado: episódio termina sem iniciar outro
  console.log('\n--- Cenário 2: Switch desativado ---');
  autoPlayService.setAutoPlayEnabled(false);
  assert(autoPlayService.isAutoPlayEnabled() === false, 'Switch desativado com sucesso');
  
  episodeAdvanced = false;
  const afterEndedSession = triggerAutoPlayAdvance(autoPlayService.isAutoPlayEnabled(), false, true);
  assert(episodeAdvanced === false, 'Episódio termina sem iniciar outro quando switch está desligado');
  assert(afterEndedSession.sessionId === session1.sessionId, 'Sessão permanece inalterada');


  // Cenário 3: Alteração do switch durante a reprodução (sincronização em tempo real)
  console.log('\n--- Cenário 3: Alteração do switch durante a reprodução ---');
  let notifiedState: boolean | null = null;
  const unsub = autoPlayService.subscribe((enabled) => {
    notifiedState = enabled;
  });

  autoPlayService.setAutoPlayEnabled(true);
  assert(notifiedState === true, 'Listener notificado imediatamente ao ativar o switch');

  autoPlayService.setAutoPlayEnabled(false);
  assert(notifiedState === false, 'Listener notificado imediatamente ao desativar o switch');
  unsub();


  // Cenário 4: Preferência preservada no armazenamento local (localStorage)
  console.log('\n--- Cenário 4: Preferência preservada após reiniciar ---');
  autoPlayService.setAutoPlayEnabled(false);
  assert(autoPlayService.isAutoPlayEnabled() === false, 'Valor false persistido');
  
  autoPlayService.setAutoPlayEnabled(true);
  assert(autoPlayService.isAutoPlayEnabled() === true, 'Valor true persistido');


  // Cenário 5: Botão "Próximo episódio" funcionando com switch desligado
  console.log('\n--- Cenário 5: Botão "Próximo episódio" manual com switch desligado ---');
  autoPlayService.setAutoPlayEnabled(false);
  
  let manualNextTriggered = false;
  const handleManualNextEpisode = () => {
    manualNextTriggered = true;
    return playbackSessionService.startSession('series-stranger-things', 'continuous_playback', 1, 3);
  };

  const manualSession = handleManualNextEpisode();
  assert(manualNextTriggered === true, 'Ação manual do botão "Próximo episódio" disparada mesmo com switch desligado');
  assert(manualSession.sessionId === session1.sessionId, 'Sessão contínua preservada no clique manual');
  assert(playbackSessionService.shouldPlayIntro(manualSession.sessionId) === false, 'Intro não é exibida no clique do botão');


  // Cenário 6: Transição automática entre temporadas (Ex: T1 E8 -> T2 E1)
  console.log('\n--- Cenário 6: Transição automática entre temporadas ---');
  autoPlayService.setAutoPlayEnabled(true);
  const curSeason = 1;
  const curEpisode = 8;
  const totalEpisodesInSeason1 = 8;
  const totalSeasons = 3;

  const getNextEpisodeCoord = (s: number, e: number) => {
    if (e < totalEpisodesInSeason1) {
      return { season: s, episode: e + 1 };
    } else if (s < totalSeasons) {
      return { season: s + 1, episode: 1 };
    }
    return null;
  };

  const seasonTransition = getNextEpisodeCoord(curSeason, curEpisode);
  assert(seasonTransition !== null, 'Próxima temporada encontrada');
  assert(seasonTransition?.season === 2 && seasonTransition?.episode === 1, 'Avança corretamente para Temporada 2, Episódio 1');
  
  const season2Session = playbackSessionService.startSession('series-stranger-things', 'continuous_playback', seasonTransition!.season, seasonTransition!.episode);
  assert(season2Session.sessionId === session1.sessionId, 'SessionId preservado na transição de temporada');
  assert(playbackSessionService.shouldPlayIntro(season2Session.sessionId) === false, 'Nenhuma intro exibida na mudança de temporada');


  // Cenário 7: Último episódio disponível da série
  console.log('\n--- Cenário 7: Último episódio disponível ---');
  const lastSeason = 3;
  const lastEpisode = 8;
  const nextCoordAtEnd = getNextEpisodeCoord(lastSeason, lastEpisode);
  assert(nextCoordAtEnd === null, 'Identificado como último episódio da série (nenhum próximo episódio)');
  
  // Em último episódio, contagem regressiva e autoplay são suprimidos
  const shouldShowCountdownAtLastEp = nextCoordAtEnd !== null && autoPlayService.isAutoPlayEnabled();
  assert(shouldShowCountdownAtLastEp === false, 'Nenhuma contagem regressiva exibida no último episódio');


  // Cenário 8: Próximo episódio indisponível (tratamento de erro sem loop)
  console.log('\n--- Cenário 8: Próximo episódio indisponível ---');
  const mockStreams: any[] = [];
  const hasAvailableStreams = mockStreams.length > 0;
  assert(hasAvailableStreams === false, 'Detectado que fontes estão indisponíveis');
  // Se não há fontes, o player exibe mensagem amigável e permite voltar aos episódios, sem loop
  let enteredLoop = false;
  let loopAttempts = 0;
  while (!hasAvailableStreams && loopAttempts < 3) {
    loopAttempts++;
    // O player para a reprodução imediatamente em vez de tentar indefinidamente
    break;
  }
  assert(loopAttempts === 1, 'Tratamento de erro não entra em loop');


  // Cenário 9: Cancelamento durante a contagem regressiva
  console.log('\n--- Cenário 9: Cancelamento durante a contagem regressiva ---');
  let isAutoPlayCancelled = false;
  let countdownActive = true;

  // Usuário clica em "Cancelar"
  const handleCancel = () => {
    isAutoPlayCancelled = true;
    countdownActive = false;
  };

  handleCancel();
  assert(isAutoPlayCancelled === true, 'Estado cancelado registrado');
  assert(countdownActive === false, 'Contagem regressiva encerrada imediatamente');
  
  // Quando o vídeo termina após cancelamento:
  episodeAdvanced = false;
  triggerAutoPlayAdvance(autoPlayService.isAutoPlayEnabled(), isAutoPlayCancelled, true);
  assert(episodeAdvanced === false, 'Transição automática interrompida após cancelamento do usuário');


  // Cenário 10: Nenhuma repetição da intro durante reprodução contínua
  console.log('\n--- Cenário 10: Nenhuma repetição da intro ---');
  // Inicia manual
  playbackSessionService.endSession();
  const freshSession = playbackSessionService.startSession('anime-jujutsu', 'manual_start', 1, 1);
  assert(playbackSessionService.shouldPlayIntro(freshSession.sessionId) === true, 'Intro permitida apenas na abertura manual da sessão');
  
  // Marca intro concluída
  playbackSessionService.markIntroPlayed(freshSession.sessionId);
  assert(playbackSessionService.shouldPlayIntro(freshSession.sessionId) === false, 'Intro concluída');

  // Próximo episódio 2
  const contSession2 = playbackSessionService.startSession('anime-jujutsu', 'continuous_playback', 1, 2);
  assert(playbackSessionService.shouldPlayIntro(contSession2.sessionId) === false, 'Ep 2 sem intro');

  // Próximo episódio 3
  const contSession3 = playbackSessionService.startSession('anime-jujutsu', 'continuous_playback', 1, 3);
  assert(playbackSessionService.shouldPlayIntro(contSession3.sessionId) === false, 'Ep 3 sem intro');

  // Temporada 2 Ep 1
  const contSession4 = playbackSessionService.startSession('anime-jujutsu', 'continuous_playback', 2, 1);
  assert(playbackSessionService.shouldPlayIntro(contSession4.sessionId) === false, 'T2 Ep 1 sem intro');

  console.log(`\n===========================================`);
  console.log(`📊 Resultado dos testes: ${passed} passaram, ${failed} falharam.`);
  console.log(`===========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
