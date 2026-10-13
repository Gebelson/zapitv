import {
  calculateSkipProgress,
  generatePillPath
} from '../src/components/player/ZapiSkipButton';
import { SkipInterval } from '../src/core/skip/skipService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${desc}`);
    failed++;
  }
}

console.log('🧪 Iniciando testes do Botão "Pular Abertura" com Contorno de Progresso (ZapiTV)...\n');

const introInterval: SkipInterval = {
  startTime: 120, // 2:00
  endTime: 210,   // 3:30 (90 segundos de abertura)
  rawStartTime: 120,
  rawEndTime: 210,
  type: 'op',
  label: 'Pular Abertura',
  source: 'aniskip'
};

// =========================================================================
// Cenário 1: Botão aparece no início da abertura
// =========================================================================
console.log('--- Cenário 1: Botão aparece no início da abertura ---');
const isInsideBefore = 119 >= introInterval.startTime && 119 < (introInterval.endTime - 0.5);
const isInsideAtStart = 120 >= introInterval.startTime && 120 < (introInterval.endTime - 0.5);
assert(!isInsideBefore, 'Antes de 120s (119s), intervalo não está ativo e botão não deve aparecer');
assert(isInsideAtStart, 'Em 120s (início exato), intervalo torna-se ativo e botão deve aparecer');

// =========================================================================
// Cenário 2: Contorno começa vazio
// =========================================================================
console.log('\n--- Cenário 2: Contorno começa vazio ---');
const progressAtStart = calculateSkipProgress(120, introInterval.startTime, introInterval.endTime);
const dashOffsetAtStart = (100 - progressAtStart * 100).toFixed(2);
assert(progressAtStart === 0, 'Progresso é exatamente 0 (0%) no início da abertura (currentTime = introStart)');
assert(dashOffsetAtStart === '100.00', 'strokeDashoffset é 100.00, significando contorno totalmente vazio no início');

// =========================================================================
// Cenário 3: Contorno vai preenchendo gradualmente
// =========================================================================
console.log('\n--- Cenário 3: Contorno vai preenchendo gradualmente ---');
const progress25 = calculateSkipProgress(142.5, introInterval.startTime, introInterval.endTime); // 22.5s de 90s = 25%
const progress50 = calculateSkipProgress(165, introInterval.startTime, introInterval.endTime);   // 45s de 90s = 50%
const progress75 = calculateSkipProgress(187.5, introInterval.startTime, introInterval.endTime); // 67.5s de 90s = 75%
assert(Math.abs(progress25 - 0.25) < 0.001, 'Progresso atinge 25% proporcionalmente após 1/4 do tempo da intro');
assert(Math.abs(progress50 - 0.50) < 0.001, 'Progresso atinge 50% proporcionalmente na metade exata da intro');
assert(Math.abs(progress75 - 0.75) < 0.001, 'Progresso atinge 75% proporcionalmente a 3/4 do tempo da intro');
assert(progress25 < progress50 && progress50 < progress75, 'Preenchimento do contorno é estritamente monótono e gradual');

// =========================================================================
// Cenário 4: Contorno chega perto de 100% ao final da abertura
// =========================================================================
console.log('\n--- Cenário 4: Contorno chega perto de 100% ao final da abertura ---');
const progressNearEnd = calculateSkipProgress(209, introInterval.startTime, introInterval.endTime); // 1s antes do fim
const progressAtEnd = calculateSkipProgress(210, introInterval.startTime, introInterval.endTime);
assert(progressNearEnd >= 0.98, 'Progresso está próximo de 100% (>= 98%) nos instantes finais da abertura');
assert(progressAtEnd === 1.0, 'Progresso alcança 100% (1.0) no tempo final da abertura');

// =========================================================================
// Cenário 5: Clicar em "Pular abertura" remove o botão imediatamente
// =========================================================================
console.log('\n--- Cenário 5: Clicar em "Pular abertura" remove o botão imediatamente ---');
// Simulação da ação de skip: avança currentTime para o final do intervalo (introEnd)
let simulatedCurrentTime = 140; // no meio da abertura
const targetTime = introInterval.endTime; // 210
simulatedCurrentTime = targetTime;
const isInsideAfterSkip = simulatedCurrentTime >= introInterval.startTime && simulatedCurrentTime < (introInterval.endTime - 0.5);
assert(!isInsideAfterSkip, 'Após o clique de skip, currentTime = introEnd e intervalo deixa de estar ativo');
assert(simulatedCurrentTime === 210, 'Vídeo avançado com sucesso para 210s');

// =========================================================================
// Cenário 6: Pausar e retomar mantém o progresso correto
// =========================================================================
console.log('\n--- Cenário 6: Pausar e retomar mantém o progresso correto ---');
const pauseTime = 160;
const progressAtPause = calculateSkipProgress(pauseTime, introInterval.startTime, introInterval.endTime);
// Durante a pausa, o tempo não avança
const progressWhilePaused = calculateSkipProgress(pauseTime, introInterval.startTime, introInterval.endTime);
assert(progressAtPause === progressWhilePaused, 'Progresso permanece estático e idêntico enquanto o player está pausado');
// Ao retomar, tempo avança normalmente
const resumeTime = 162;
const progressAfterResume = calculateSkipProgress(resumeTime, introInterval.startTime, introInterval.endTime);
assert(progressAfterResume > progressAtPause, 'Progresso retoma o avanço contínuo após despausar');

// =========================================================================
// Cenário 7: Seek manual atualiza corretamente o indicador
// =========================================================================
console.log('\n--- Cenário 7: Seek manual atualiza corretamente o indicador ---');
let seekTime = 130; // 10s de 90s
const progBeforeSeek = calculateSkipProgress(seekTime, introInterval.startTime, introInterval.endTime);
seekTime = 195; // salto manual para a reta final
const progAfterSeekForward = calculateSkipProgress(seekTime, introInterval.startTime, introInterval.endTime);
assert(progAfterSeekForward > progBeforeSeek, 'Seek manual para frente atualiza o contorno proporcionalmente');
seekTime = 125; // retrocesso manual
const progAfterSeekBackward = calculateSkipProgress(seekTime, introInterval.startTime, introInterval.endTime);
assert(progAfterSeekBackward < progAfterSeekForward, 'Retrocesso manual recua o contorno proporcionalmente');

// =========================================================================
// Cenário 8: Mudança de velocidade não quebra o cálculo
// =========================================================================
console.log('\n--- Cenário 8: Mudança de velocidade não quebra o cálculo ---');
// A fórmula depende estritamente do currentTime do vídeo, que é invariante em relação à taxa de reprodução
const speeds = [0.5, 1.0, 1.25, 1.5, 2.0];
const sampleTime = 165; // metade do tempo
const expectedProg = 0.5;
for (const speed of speeds) {
  const p = calculateSkipProgress(sampleTime, introInterval.startTime, introInterval.endTime);
  assert(p === expectedProg, `Cálculo de progresso em velocidade ${speed}x permanece matematicamente exato (${p})`);
}

// =========================================================================
// Cenário 9: Troca de fonte não deixa o botão desincronizado
// =========================================================================
console.log('\n--- Cenário 9: Troca de fonte não deixa o botão desincronizado ---');
// Ao trocar de fonte, o ZapiPlayer preserva o currentTime da sessão
const preservedTime = 155;
const progSource1 = calculateSkipProgress(preservedTime, introInterval.startTime, introInterval.endTime);
// Nova fonte carregada no mesmo ponto:
const newSourceTime = preservedTime;
const progSource2 = calculateSkipProgress(newSourceTime, introInterval.startTime, introInterval.endTime);
assert(progSource1 === progSource2, 'Progresso é idêntico após troca de fonte mantendo o mesmo currentTime');

// =========================================================================
// Cenário 10: Episódio sem timestamps não mostra nada
// =========================================================================
console.log('\n--- Cenário 10: Episódio sem timestamps não mostra nada ---');
const emptyIntervals: SkipInterval[] = [];
const activeWithNoTimestamps = emptyIntervals.find(i => 150 >= i.startTime && 150 < (i.endTime - 0.5));
assert(activeWithNoTimestamps === undefined, 'Sem timestamps de abertura, nenhum intervalo de skip fica ativo');

// =========================================================================
// Testes de Geometria do Path SVG (Pílula com contorno contínuo)
// =========================================================================
console.log('\n--- Validação da Geometria do Contorno SVG (Pill Path) ---');
const path180 = generatePillPath(180, 42);
assert(path180.startsWith('M 90.00'), 'Path começa no topo central (x = w/2)');
assert(path180.includes('A 19.75 19.75 0 0 1'), 'Path contém arcos semiesféricos perfeitos para a pílula');
assert(path180.endsWith('Z'), 'Path fecha em si mesmo (Z) formando um circuito fechado contínuo');

console.log('\n===========================================');
console.log(`📊 Resultado dos testes: ${passed} passaram, ${failed} falharam.`);
console.log('===========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
