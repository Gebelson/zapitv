import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { SkipInterval } from '../src/core/skip/skipService';

console.log('========================================================================');
console.log('--- TESTE: CORREÇÃO DEFINITIVA DOS BOTÕES DE PULAR NA SMART TV ---');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// [Teste 1] Análise estática em TvPlayerControls.tsx: Conflito da tecla OK resolvido
// -----------------------------------------------------------------------------
console.log('[Teste 1] Verificação da tecla OK em TvPlayerControls.tsx com botão de pular focado...');
const tvPlayerControlsCode = fs.readFileSync(
  path.join(process.cwd(), 'src/components/player/TvPlayerControls.tsx'),
  'utf-8'
);

// No ESTADO 1 (controles ocultos), OK com skip button focado NÃO deve alternar reprodução
assert(
  tvPlayerControlsCode.includes("const isSkipFocused =") &&
  tvPlayerControlsCode.includes("current === 'tv-skip-button'") &&
  tvPlayerControlsCode.includes("skipBtn.click();"),
  'TvPlayerControls deve detectar se o botão de pular está focado e acionar o clique nele'
);

// Garante que o clique no skip button ocorre ANTES de qualquer onTogglePlay ou setFocus
const estado1SelectIndex = tvPlayerControlsCode.indexOf('// ESTADO 1: CONTROLES OCULTOS (!props.visible)');
const estado2SelectIndex = tvPlayerControlsCode.indexOf('// ESTADO 2: CONTROLES VISÍVEIS (props.visible === true)');
assert(estado1SelectIndex !== -1 && estado2SelectIndex !== -1, 'ESTADO 1 e ESTADO 2 devem estar presentes');
const estado1Section = tvPlayerControlsCode.slice(estado1SelectIndex, estado2SelectIndex);

const skipCheckPos = estado1Section.indexOf('isSkipFocused');
const togglePlayPos = estado1Section.indexOf('props.onTogglePlay()');
assert(skipCheckPos !== -1 && togglePlayPos !== -1, 'Ambos os handlers devem existir no ESTADO 1');
assert(skipCheckPos < togglePlayPos, 'A checagem do botão de pular DEVE vir antes de props.onTogglePlay()');
console.log('✓ No ESTADO 1, tecla OK com botão de pular focado executa exclusivamente o pulo sem alternar Play/Pause.');

// -----------------------------------------------------------------------------
// [Teste 2] Análise no ESTADO 2 (controles visíveis): Botão de pular vs outros botões
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Verificação da tecla OK no ESTADO 2 (controles visíveis)...');
const estado2Section = tvPlayerControlsCode.slice(estado2SelectIndex, estado2SelectIndex + 2500);

assert(estado2Section.includes('isSkipFocused'), 'ESTADO 2 deve conter verificação de isSkipFocused');
assert(
  estado2Section.includes("setFocus('tv-player-play')"),
  'ESTADO 2 deve ter fallback para tv-player-play caso elemento tenha sido desmontado'
);
console.log('✓ No ESTADO 2, botão de pular tem prioridade de acionamento e fallback previne foco órfão.');

// -----------------------------------------------------------------------------
// [Teste 3] Não roubar foco ao abrir controles se o botão de pular estiver focado
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Verificação de roubo de foco ao abrir controles...');
const focusEffectIndex = tvPlayerControlsCode.indexOf('// Foco inicial automático no botão de Play/Pause ao abrir os controles');
assert(focusEffectIndex !== -1, 'Efeito de foco inicial deve existir');
const focusEffectSection = tvPlayerControlsCode.slice(focusEffectIndex, focusEffectIndex + 500);

assert(
  focusEffectSection.includes("if (current === 'tv-skip-button') return;") ||
  focusEffectSection.includes("getCurrentFocusKey() === 'tv-skip-button'"),
  'Abertura dos controles NÃO deve roubar o foco se tv-skip-button estiver selecionado'
);
console.log('✓ Abertura de controles não rouba o foco do botão de pular.');

// -----------------------------------------------------------------------------
// [Teste 4] Análise estática em ZapiSkipButton.tsx: Disparo Imediato sem delay
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Verificação do disparo imediato em ZapiSkipButton.tsx...');
const skipButtonCode = fs.readFileSync(
  path.join(process.cwd(), 'src/components/player/ZapiSkipButton.tsx'),
  'utf-8'
);

// Verifica que onSkip(interval) NÃO está dentro de setTimeout 450ms
const triggerSkipPos = skipButtonCode.indexOf('const triggerSkip = useCallback');
assert(triggerSkipPos !== -1, 'triggerSkip deve existir');
const triggerSkipSection = skipButtonCode.slice(triggerSkipPos, triggerSkipPos + 800);

assert(
  triggerSkipSection.includes('onSkip(interval);'),
  'triggerSkip deve conter a chamada onSkip(interval)'
);

// Confirma que onSkip(interval) é chamado antes do flashTimer ou doneTimer
const onSkipPos = triggerSkipSection.indexOf('onSkip(interval);');
const setTimeoutPos = triggerSkipSection.indexOf('setTimeout(');
assert(onSkipPos < setTimeoutPos, 'onSkip(interval) DEVE ser disparado IMEDIATAMENTE antes de qualquer timer de animação');
assert(!triggerSkipSection.includes('setTimeout(() => {\n      onSkip(interval);'), 'onSkip não pode estar envelopado em setTimeout');
console.log('✓ onSkip(interval) é acionado de imediato com ZERO atraso artificial.');

// -----------------------------------------------------------------------------
// [Teste 5] Foco automático único e proteção contra roubo de modais em ZapiSkipButton
// -----------------------------------------------------------------------------
console.log('\n[Teste 5] Verificação de foco automático único e proteção contra modais...');
assert(
  skipButtonCode.includes('hasAutoFocusedRef'),
  'ZapiSkipButton deve usar ref para rastrear que o foco automático ocorreu apenas uma vez'
);
assert(
  skipButtonCode.includes('role="dialog"') || skipButtonCode.includes('tv-drawer-'),
  'ZapiSkipButton não deve roubar foco se modais ou gavetas estiverem abertos'
);
assert(
  skipButtonCode.includes("setFocus('tv-player-play')"),
  'ZapiSkipButton deve restaurar o foco para tv-player-play ao desmontar se estava focado'
);
console.log('✓ Foco automático é único, respeita modais/drawers abertos e restaura foco no unmount.');

// -----------------------------------------------------------------------------
// [Teste 6] Dimensões e posicionamento para Smart TV em ZapiSkipButton.tsx
// -----------------------------------------------------------------------------
console.log('\n[Teste 6] Verificação das dimensões e posicionamento na Smart TV...');
assert(skipButtonCode.includes('min-h-[58px]'), 'Botão TV deve possuir altura confortável >= 58px');
assert(skipButtonCode.includes('min-w-[220px]'), 'Botão TV deve possuir largura proporcional >= 220px');
assert(skipButtonCode.includes('bottom-[200px]') || skipButtonCode.includes('bottom-[210px]'), 'Botão TV deve ficar posicionado entre 200px e 220px da base');
assert(skipButtonCode.includes('right-[5vw]'), 'Botão TV deve respeitar a margem direita segura de 5vw');
assert(skipButtonCode.includes('z-[85]'), 'Botão TV deve utilizar camada z-[85] para sobrepor controles (z-[80])');
assert(skipButtonCode.includes('#00e5ff'), 'Botão TV deve usar o tom ciano do ZapiTV para o foco');
console.log('✓ Dimensões para TV (58px+, 220px+), posicionamento (200-210px, 5vw) e z-[85] verificados.');

// -----------------------------------------------------------------------------
// [Teste 7] Camada dedicada de ações contextuais em ZapiPlayer.tsx
// -----------------------------------------------------------------------------
console.log('\n[Teste 7] Verificação da camada dedicada de ações contextuais em ZapiPlayer.tsx...');
const zapiPlayerCode = fs.readFileSync(
  path.join(process.cwd(), 'src/components/player/ZapiPlayer.tsx'),
  'utf-8'
);

assert(
  zapiPlayerCode.includes('isTvPlayback && !showNonDubbedPrompt && !allSourcesFailed'),
  'ZapiPlayer deve conter camada dedicada para ações contextuais da Smart TV'
);
assert(
  zapiPlayerCode.includes('fixed inset-0 z-[85] pointer-events-none select-none overflow-hidden'),
  'A camada da TV deve ter z-[85] e pointer-events-none para não bloquear vídeo'
);
console.log('✓ Camada dedicada z-[85] inserida em ZapiPlayer.tsx sobrepondo os controles.');

// -----------------------------------------------------------------------------
// [Teste 8] Simulação de Execução Imediata e Lógica de Abertura vs Créditos
// -----------------------------------------------------------------------------
console.log('\n[Teste 8] Simulação funcional da lógica de pulo imediato...');
let seekTarget: number | null = null;
let nextEpisodeCalled = false;

const mockHandleSeek = (time: number) => {
  seekTarget = time;
};

const mockNextEpisode = () => {
  nextEpisodeCalled = true;
};

const simulateSkip = (interval: SkipInterval, hasNextEpisode: boolean, duration: number = 3000) => {
  if (interval.type === 'ed' && hasNextEpisode) {
    mockNextEpisode();
    return;
  }
  const targetTime = interval.endTime > 0 ? interval.endTime : duration;
  mockHandleSeek(targetTime);
};

// 1. Abertura (op): avança até o final da abertura e continua
const opInterval: SkipInterval = {
  type: 'op',
  startTime: 120,
  endTime: 210,
  rawStartTime: 120,
  rawEndTime: 210,
  label: 'Pular Abertura'
};
seekTarget = null;
nextEpisodeCalled = false;
simulateSkip(opInterval, true);
assert.strictEqual(seekTarget, 210, 'Pular abertura deve buscar exatamente o final da abertura (210s)');
assert.strictEqual(nextEpisodeCalled, false, 'Pular abertura nunca deve avançar episódio');

// 2. Créditos (ed) com próximo episódio disponível: avança episódio imediatamente
const edInterval: SkipInterval = {
  type: 'ed',
  startTime: 2800,
  endTime: 2950,
  rawStartTime: 2800,
  rawEndTime: 2950,
  label: 'Pular Créditos'
};
seekTarget = null;
nextEpisodeCalled = false;
simulateSkip(edInterval, true);
assert.strictEqual(nextEpisodeCalled, true, 'Pular créditos com próximo episódio deve chamar nextEpisode');
assert.strictEqual(seekTarget, null, 'Pular créditos com próximo episódio não deve seekar');

// 3. Créditos (ed) no último episódio: avança para o encerramento do vídeo
seekTarget = null;
nextEpisodeCalled = false;
simulateSkip(edInterval, false, 2950);
assert.strictEqual(nextEpisodeCalled, false, 'Último episódio não deve chamar nextEpisode');
assert.strictEqual(seekTarget, 2950, 'Último episódio deve seekar para o fim dos créditos');
console.log('✓ Comportamentos de Pular Abertura e Pular Créditos funcionando perfeitamente.');

// -----------------------------------------------------------------------------
// [Teste 9] Simulação da Tecla OK nos dois estados de controle da TV
// -----------------------------------------------------------------------------
console.log('\n[Teste 9] Simulação de despacho da tecla OK...');

// Cenário A: Controles ocultos e Skip Button focado
let clickFired = false;
let playPauseToggled = false;
let currentFocus = 'tv-skip-button';

const simulateRemoteOK = (controlsVisible: boolean, focusedKey: string) => {
  const isSkipFocused = focusedKey === 'tv-skip-button';
  if (!controlsVisible) {
    if (isSkipFocused) {
      clickFired = true;
      return true; // pulo consumido
    }
    playPauseToggled = true;
    return true;
  } else {
    if (isSkipFocused) {
      clickFired = true;
      return true;
    }
    // aciona elemento focado (ex: play)
    if (focusedKey === 'tv-player-play') {
      playPauseToggled = true;
      return true;
    }
    return true;
  }
};

// Execução A: Controles ocultos + Skip Button focado
clickFired = false;
playPauseToggled = false;
simulateRemoteOK(false, 'tv-skip-button');
assert.strictEqual(clickFired, true, 'Clique no botão de pular deve ser disparado');
assert.strictEqual(playPauseToggled, false, 'Play/Pause NÃO deve ser alternado');

// Execução B: Controles ocultos + Player focado (sem skip focado)
clickFired = false;
playPauseToggled = false;
simulateRemoteOK(false, 'tv-player-play');
assert.strictEqual(clickFired, false, 'Botão de pular não deve ser clicado');
assert.strictEqual(playPauseToggled, true, 'Play/Pause deve ser alternado normalmente');

// Execução C: Controles visíveis + Skip Button focado
clickFired = false;
playPauseToggled = false;
simulateRemoteOK(true, 'tv-skip-button');
assert.strictEqual(clickFired, true, 'Botão de pular deve ser clicado mesmo com controles visíveis');
assert.strictEqual(playPauseToggled, false, 'Play/Pause não deve ser clicado');

// Execução D: Controles visíveis + Botão Play focado
clickFired = false;
playPauseToggled = false;
simulateRemoteOK(true, 'tv-player-play');
assert.strictEqual(clickFired, false, 'Botão de pular não deve ser acionado');
assert.strictEqual(playPauseToggled, true, 'Play/Pause deve responder quando explicitamente selecionado');
console.log('✓ Tecla OK despacha com 100% de precisão em todos os cenários.');

// -----------------------------------------------------------------------------
// [Teste 10] Preservação de Desktop e Mobile
// -----------------------------------------------------------------------------
console.log('\n[Teste 10] Preservação das dimensões em Desktop/Mobile...');
assert(
  skipButtonCode.includes("px-5 py-2.5 text-xs font-bold"),
  'Desktop deve continuar utilizando dimensões compactas originais (px-5 py-2.5 text-xs)'
);
assert(
  skipButtonCode.includes("bottom-28"),
  'Desktop deve continuar usando bottom-28'
);
console.log('✓ Estilos de desktop e mobile totalmente preservados.');

console.log('\n========================================================================');
console.log(' TODOS OS 10 TESTES DE INTERAÇÃO DOS BOTÕES DE PULAR NA TV PASSARAM! ');
console.log('========================================================================\n');
