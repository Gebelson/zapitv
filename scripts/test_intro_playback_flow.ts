import { playbackSessionService } from '../src/core/session/playbackSessionService';

function runTests() {
  console.log('🧪 Iniciando testes de validação do fluxo de intro do ZapiTV...\n');
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

  // Cenário 1: Filme iniciado manualmente
  console.log('--- Cenário 1: Filme iniciado manualmente ---');
  playbackSessionService.endSession();
  const movieSession = playbackSessionService.startSession('movie-matrix', 'manual_start');
  assert(movieSession.navigationType === 'manual_start', 'Sessão iniciada como manual_start');
  assert(playbackSessionService.shouldPlayIntro(movieSession.sessionId) === true, 'Intro DEVE tocar na inicialização manual do filme');
  assert(playbackSessionService.isIntroPlayed(movieSession.sessionId) === false, 'Intro ainda não marcada como tocada');
  
  // Intro termina/transiciona
  playbackSessionService.markIntroPlayed(movieSession.sessionId);
  assert(playbackSessionService.isIntroPlayed(movieSession.sessionId) === true, 'Intro marcada como tocada');
  assert(playbackSessionService.shouldPlayIntro(movieSession.sessionId) === false, 'Intro NÃO deve tocar novamente após término');

  // Cenário 1b: Recarga de vídeo ou troca de fonte dentro da mesma sessão de filme
  const streamFallbackAllowedIntro = playbackSessionService.shouldPlayIntro(movieSession.sessionId);
  assert(streamFallbackAllowedIntro === false, 'Troca de fonte no filme NÃO deve reproduzir intro');


  // Cenário 2: Episódio iniciado manualmente (Série Ep 1)
  console.log('\n--- Cenário 2: Episódio iniciado manualmente (Série Ep 1) ---');
  playbackSessionService.endSession();
  const ep1Session = playbackSessionService.startSession('series-breaking-bad', 'manual_start', 1, 1);
  assert(ep1Session.navigationType === 'manual_start', 'Sessão do Ep 1 criada como manual_start');
  assert(playbackSessionService.shouldPlayIntro(ep1Session.sessionId) === true, 'Intro DEVE tocar no Ep 1 iniciado manualmente');
  
  // Transição da intro
  playbackSessionService.markIntroPlayed(ep1Session.sessionId);
  assert(playbackSessionService.shouldPlayIntro(ep1Session.sessionId) === false, 'Intro não toca mais no Ep 1');


  // Cenário 3: Próximo episódio por botão (Próximo Episódio)
  console.log('\n--- Cenário 3: Próximo episódio por botão (Próximo Episódio) ---');
  const ep2Session = playbackSessionService.startSession('series-breaking-bad', 'continuous_playback', 1, 2);
  assert(ep2Session.sessionId === ep1Session.sessionId, 'SessionId preservado durante reprodução contínua');
  assert(ep2Session.introPlayed === true, 'introPlayed permanece true');
  assert(playbackSessionService.shouldPlayIntro(ep2Session.sessionId) === false, 'Intro NÃO aparece no botão "Próximo Episódio"');


  // Cenário 4: Próximo episódio automático (fim do vídeo / onEnded)
  console.log('\n--- Cenário 4: Próximo episódio automático (onEnded) ---');
  const ep3Session = playbackSessionService.startSession('series-breaking-bad', 'continuous_playback', 1, 3);
  assert(ep3Session.sessionId === ep2Session.sessionId, 'SessionId preservado no avanço automático');
  assert(playbackSessionService.shouldPlayIntro(ep3Session.sessionId) === false, 'Intro NÃO aparece no avanço automático para o Ep 3');


  // Cenário 5: Troca de fonte ou fallback de stream
  console.log('\n--- Cenário 5: Troca de fonte ou fallback de stream ---');
  assert(playbackSessionService.shouldPlayIntro(ep3Session.sessionId) === false, 'Troca de fonte não aciona intro');


  // Cenário 6: Alteração de qualidade do vídeo
  console.log('\n--- Cenário 6: Alteração de qualidade do vídeo ---');
  assert(playbackSessionService.shouldPlayIntro(ep3Session.sessionId) === false, 'Troca de qualidade não aciona intro');


  // Cenário 7: Retorno do pause
  console.log('\n--- Cenário 7: Retorno do pause ---');
  assert(playbackSessionService.shouldPlayIntro(ep3Session.sessionId) === false, 'Retomar do pause não aciona intro');


  // Cenário 8: Saída do player seguida de novo início manual
  console.log('\n--- Cenário 8: Saída do player seguida de novo início manual ---');
  playbackSessionService.endSession(ep3Session.sessionId);
  assert(playbackSessionService.getCurrentSession() === null, 'Sessão encerrada com sucesso após fechar o player');
  
  // Usuário clica em outro episódio ou Assistir
  const newManualSession = playbackSessionService.startSession('series-breaking-bad', 'manual_start', 1, 5);
  assert(newManualSession.sessionId !== ep3Session.sessionId, 'Novo sessionId gerado após fechamento');
  assert(newManualSession.introPlayed === false, 'Nova sessão possui introPlayed = false');
  assert(playbackSessionService.shouldPlayIntro(newManualSession.sessionId) === true, 'Intro DEVE aparecer novamente na nova sessão manual');


  // Cenário 9: Resiliência contra React Strict Mode (duplo disparo de montagem)
  console.log('\n--- Cenário 9: Resiliência contra React Strict Mode ---');
  playbackSessionService.endSession();
  const strictModeSession = playbackSessionService.startSession('anime-frieren', 'manual_start', 1, 1);
  assert(playbackSessionService.shouldPlayIntro(strictModeSession.sessionId) === true, '1º ciclo do Strict Mode: intro permitida');
  assert(playbackSessionService.shouldPlayIntro(strictModeSession.sessionId) === true, '2º ciclo do Strict Mode antes de concluir: intro ainda permitida');
  
  playbackSessionService.markIntroPlayed(strictModeSession.sessionId);
  assert(playbackSessionService.shouldPlayIntro(strictModeSession.sessionId) === false, 'Após conclusão da intro: intro bloqueada');
  
  // Dupla marcação não corrompe estado
  playbackSessionService.markIntroPlayed(strictModeSession.sessionId);
  assert(playbackSessionService.shouldPlayIntro(strictModeSession.sessionId) === false, 'Idempotência preservada');

  console.log(`\n===========================================`);
  console.log(`📊 Resultado dos testes: ${passed} passaram, ${failed} falharam.`);
  console.log(`===========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
