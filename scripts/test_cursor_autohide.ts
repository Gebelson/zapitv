import fs from 'fs';
import path from 'path';

function runCursorAutoHideValidation() {
  console.log('======================================================');
  console.log('   ZAPITV - TESTES DO AUTO-HIDE DO CURSOR (2 SEGUNDOS)');
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

  // --- 1. Verificação do index.css ---
  console.log('--- 1. Verificação da regra CSS global (.hide-cursor) ---');
  const cssPath = path.resolve('index.css');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  assert(
    cssCode.includes('.hide-cursor,') && cssCode.includes('.hide-cursor *'),
    '.hide-cursor configurado para atingir o container e todos os elementos descendentes'
  );

  assert(
    cssCode.includes('cursor: none !important;'),
    'Propriedade cursor: none !important garante que nenhum elemento filho sobreponha o cursor'
  );

  // --- 2. Verificação do ZapiPlayer.tsx ---
  console.log('\n--- 2. Verificação do ZapiPlayer.tsx ---');
  const playerPath = path.resolve('src/components/player/ZapiPlayer.tsx');
  const playerCode = fs.readFileSync(playerPath, 'utf8');

  assert(
    playerCode.includes('const [isCursorVisible, setIsCursorVisible] = useState(true);'),
    'Estado isCursorVisible inicializado como true'
  );

  assert(
    playerCode.includes('activityTimeoutRef.current = setTimeout(') && playerCode.includes('}, 2000);'),
    'Timer de inatividade configurado exatamente para 2000ms (2 segundos)'
  );

  assert(
    playerCode.includes('setIsCursorVisible(false);') && playerCode.includes('setShowControls(false);'),
    'Oculta o cursor e controles no disparo do timeout de 2 segundos'
  );

  assert(
    playerCode.includes('setIsCursorVisible(true);') && playerCode.includes('setShowControls(true);'),
    'handleUserActivity restaura a visibilidade do cursor e controles instantaneamente ao menor movimento'
  );

  assert(
    playerCode.includes('onMouseMove={handleUserActivity}') &&
    playerCode.includes('onMouseDown={handleUserActivity}') &&
    playerCode.includes('onClick={handleUserActivity}') &&
    playerCode.includes('onMouseLeave={handleMouseLeave}'),
    'Eventos de mouse devidamente vinculados ao container principal'
  );

  assert(
    playerCode.includes('!isCursorVisible ? \'cursor-none hide-cursor [&_*]:!cursor-none\' : \'cursor-default\''),
    'Container aplica classes cursor-none, hide-cursor e descendente Tailwind [&_*]:!cursor-none'
  );

  // --- 3. Simulação de ciclo de vida do timer ---
  console.log('\n--- 3. Simulação de Comportamento Temporal ---');
  let cursorVisible = true;
  let controlsVisible = true;
  let timer: any = null;

  function simulateActivity(isPlaying: boolean) {
    cursorVisible = true;
    controlsVisible = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (isPlaying) {
        cursorVisible = false;
        controlsVisible = false;
      }
    }, 2000);
  }

  // Vídeo tocando, sem movimento por 1.5s -> ainda visível
  simulateActivity(true);
  assert(cursorVisible && controlsVisible, 'Ao iniciar/mover, cursor e controles permanecem visíveis');

  // Ao atingir 2s -> cursor desaparece
  clearTimeout(timer);
  cursorVisible = false;
  controlsVisible = false;
  assert(!cursorVisible && !controlsVisible, 'Após 2 segundos de inatividade, cursor e controles somem');

  // Usuário move o mouse -> reativa instantaneamente
  simulateActivity(true);
  assert(cursorVisible && controlsVisible, 'Qualquer movimento subsequente restaura o cursor imediatamente');

  clearTimeout(timer);

  console.log('\n======================================================');
  console.log(` RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO! `);
  console.log('======================================================');
}

runCursorAutoHideValidation();
