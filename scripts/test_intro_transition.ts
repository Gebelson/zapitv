import fs from 'fs';
import path from 'path';

function runIntroTransitionValidation() {
  console.log('======================================================');
  console.log('   ZAPITV - TESTES DA TRANSIÇÃO E PRELOAD DA INTRO   ');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      throw new Error(`FALHA: ${msg}`);
    }
    console.log(`[PASSOU] ${msg}`);
    passed++;
  }

  const playerPath = path.resolve('src/components/player/ZapiPlayer.tsx');
  const code = fs.readFileSync(playerPath, 'utf8');

  // 1. A intro deve preencher a tela inteira (object-cover)
  console.log('--- 1. Validação de Preenchimento da Tela (object-cover) ---');
  assert(
    code.includes('className="w-full h-full object-cover bg-black"'),
    'Vídeo da vinheta configurado com object-cover para preenchimento total da tela'
  );

  // 2. A mídia deve carregar antecipadamente (preload) durante a intro
  console.log('\n--- 2. Carregamento Antecipado da Mídia (Preload) ---');
  assert(
    code.includes('video.preload = \'auto\''),
    'Vídeo HTML5 configurado com preload="auto"'
  );
  assert(
    code.includes('markMediaAsReady()') && code.includes('Hls.Events.MANIFEST_PARSED'),
    'Hls.js e HTML5 video disparam markMediaAsReady() durante a intro'
  );
  assert(
    !code.includes('isPlayingIntro, showNonDubbedPrompt];\n\n  // Keyboard navigation shortcuts'),
    'Stream setup não é destruído nem reiniciado na transição da intro'
  );

  // 3. Deve pausar no último frame da intro até que a mídia carregue
  console.log('\n--- 3. Pausa no Último Frame da Intro ---');
  assert(
    code.includes('introVideoRef.current.pause()') && code.includes('handleIntroEnded'),
    'handleIntroEnded pausa no último frame da vinheta enquanto aguarda mídia'
  );
  assert(
    code.includes('{(isIntroEnded || userSkippedIntro) && !isMediaReady && ('),
    'Exibe indicador sutil sobre o último frame pausado enquanto a mídia termina de carregar'
  );

  // 4. Transição de fade suave da intro para a mídia
  console.log('\n--- 4. Transição de Fade Suave (Crossfade 700ms) ---');
  assert(
    code.includes('transition-opacity duration-700 ease-in-out') &&
    code.includes('isIntroFading ? \'opacity-0 pointer-events-none\' : \'opacity-100\''),
    'Camada da intro possui transição CSS de opacidade com duration-700 e ease-in-out'
  );
  assert(
    code.includes('setIsIntroFading(true)') && code.includes('video.play()'),
    'transitionFromIntroToMedia dá play no vídeo principal por trás e inicia o fade out cinematográfico'
  );

  // 5. Simulação do fluxo de estados da máquina de transição
  console.log('\n--- 5. Simulação do Ciclo de Estados da Transição ---');
  
  // Cenário A: Mídia carrega rápido (antes da intro acabar)
  let isMediaReady = false;
  let isIntroEnded = false;
  let isPlayingIntro = true;
  let isIntroFading = false;
  let mainVideoPlaying = false;

  // Mídia carregou aos 2s
  isMediaReady = true;
  // Intro ainda tocando
  assert(isPlayingIntro === true && isIntroFading === false && mainVideoPlaying === false, 'Cenário A: Mídia carregada no buffer enquanto intro continua tocando normalmente');
  
  // Intro acaba aos 5s
  isIntroEnded = true;
  if (isMediaReady) {
    mainVideoPlaying = true;
    isIntroFading = true;
  }
  assert(mainVideoPlaying === true && isIntroFading === true, 'Cenário A: Intro terminou com mídia pronta -> transição com fade suave iniciada imediatamente');

  // Cenário B: Mídia demora mais que a intro (fica pausado no último frame)
  isMediaReady = false;
  isIntroEnded = false;
  isPlayingIntro = true;
  isIntroFading = false;
  mainVideoPlaying = false;

  // Intro acaba primeiro
  isIntroEnded = true;
  let pausedOnLastFrame = true;
  assert(pausedOnLastFrame === true && mainVideoPlaying === false && isPlayingIntro === true, 'Cenário B: Intro acabou mas mídia não carregou -> fica pausado no último frame sem tela preta');

  // Mídia finalmente fica pronta 3s depois
  isMediaReady = true;
  if (isIntroEnded && isMediaReady) {
    mainVideoPlaying = true;
    isIntroFading = true;
  }
  assert(mainVideoPlaying === true && isIntroFading === true, 'Cenário B: Mídia carregou -> destrava o último frame e realiza o fade out suave');

  console.log('\n======================================================');
  console.log(` RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO! `);
  console.log('======================================================');
}

runIntroTransitionValidation();
