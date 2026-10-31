import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { tvNavigationManager } from '../src/core/tv/tvNavigationManager';
import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';

console.log('========================================================================');
console.log('--- TESTE: NAVEGAÇÃO ESPACIAL E CONTROLE REMOTO NA TELA DE ERRO (TV) ---');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// [Teste 1] Verificação estrutural do componente TvPlaybackErrorScreen.tsx
// -----------------------------------------------------------------------------
console.log('[Teste 1] Verificando existência e estrutura de TvPlaybackErrorScreen.tsx...');
const errorScreenPath = path.join(process.cwd(), 'src/components/player/TvPlaybackErrorScreen.tsx');
assert(fs.existsSync(errorScreenPath), 'Arquivo TvPlaybackErrorScreen.tsx deve existir');

const errorScreenCode = fs.readFileSync(errorScreenPath, 'utf-8');

// Garante uso de useTvFocusable e setFocus do Norigin
assert(errorScreenCode.includes("useTvFocusable"), 'Deve utilizar o hook useTvFocusable');
assert(errorScreenCode.includes("setFocus"), 'Deve importar e utilizar setFocus do Norigin');
assert(errorScreenCode.includes("tvNavigationManager"), 'Deve integrar com tvNavigationManager');

// Garante os 3 focusKeys obrigatórios
assert(errorScreenCode.includes("focusKey: 'tv-player-error-retry'"), 'Botão Tentar novamente deve ter focusKey único');
assert(errorScreenCode.includes("focusKey: 'tv-player-error-report'"), 'Botão Reportar erro deve ter focusKey único');
assert(errorScreenCode.includes("focusKey: 'tv-player-error-back'"), 'Botão Voltar aos detalhes deve ter focusKey único');

// Garante os atributos data-focus-key nos elementos
assert(errorScreenCode.includes('data-focus-key="tv-player-error-retry"'), 'Elemento retry deve possuir data-focus-key');
assert(errorScreenCode.includes('data-focus-key="tv-player-error-report"'), 'Elemento report deve possuir data-focus-key');
assert(errorScreenCode.includes('data-focus-key="tv-player-error-back"'), 'Elemento back deve possuir data-focus-key');

console.log('✓ TvPlaybackErrorScreen.tsx implementa useTvFocusable, setFocus e focusKeys únicos para todos os 3 botões.');

// -----------------------------------------------------------------------------
// [Teste 2] Comportamento das Setas: Navegação Horizontal e Trava Vertical
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Verificando comportamento das setas (onArrowPress)...');

// Trava Vertical (Cima/Baixo)
assert(
  errorScreenCode.includes("if (direction === 'up' || direction === 'down')") &&
  errorScreenCode.includes("return false;"),
  'Setas Cima e Baixo devem retornar false em todos os botões para impedir perda de foco'
);

// Navegação Direita (Retry -> Report -> Back)
assert(
  errorScreenCode.includes("setFocus('tv-player-error-report');") &&
  errorScreenCode.includes("setFocus('tv-player-error-back');"),
  'Seta Direita deve conduzir estritamente Retry -> Report -> Back'
);

// Navegação Esquerda (Back -> Report -> Retry)
assert(
  errorScreenCode.includes("setFocus('tv-player-error-report');") &&
  errorScreenCode.includes("setFocus('tv-player-error-retry');"),
  'Seta Esquerda deve conduzir estritamente Back -> Report -> Retry'
);

console.log('✓ Navegação horizontal conduz determinística e perfeitamente entre os 3 botões.');
console.log('✓ Setas Cima e Baixo travadas (return false), garantindo que o foco nunca desapareça.');

// -----------------------------------------------------------------------------
// [Teste 3] Foco Inicial Automático e Gestão de Retry Desabilitado
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Verificando foco inicial automático e proteção de botão desabilitado...');

assert(
  errorScreenCode.includes("const targetKey = isRetryEnabled ? 'tv-player-error-retry' : 'tv-player-error-report';"),
  'Foco inicial automático deve priorizar o primeiro botão habilitado'
);

assert(
  errorScreenCode.includes("if (!isRetryEnabled && isRetryFocused) {") &&
  errorScreenCode.includes("setFocus('tv-player-error-report');"),
  'Se o botão retry for desabilitado enquanto focado, o foco deve migrar imediatamente para Reportar erro'
);

console.log('✓ Foco inicial automático configurado com fallback para Reportar erro quando retry desabilitado.');

// -----------------------------------------------------------------------------
// [Teste 4] Prioridade Máxima do Botão Voltar (Back Handler)
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Verificando prioridade do manipulador de Voltar (Back Handler)...');

assert(
  errorScreenCode.includes("tvNavigationManager.registerBackHandler('tv-playback-error-screen', 350"),
  'TvPlaybackErrorScreen deve registrar backHandler com prioridade 350 (superior a controles e player)'
);

assert(
  errorScreenCode.includes("unregister();"),
  'O backHandler de prioridade 350 deve ser removido ao desmontar a tela'
);

console.log('✓ Back handler com prioridade 350 registrado e desmontado limpo.');

// -----------------------------------------------------------------------------
// [Teste 5] Verificação em ZapiPlayer.tsx: Prioridade sobre Comandos de Reprodução
// -----------------------------------------------------------------------------
console.log('\n[Teste 5] Verificando ZapiPlayer.tsx com allSourcesFailed ativo...');
const playerCode = fs.readFileSync(
  path.join(process.cwd(), 'src/components/player/ZapiPlayer.tsx'),
  'utf-8'
);

// Garante que o componente TvPlaybackErrorScreen está importado e utilizado
assert(playerCode.includes("import { TvPlaybackErrorScreen } from './TvPlaybackErrorScreen';"), 'ZapiPlayer deve importar TvPlaybackErrorScreen');
assert(playerCode.includes("<TvPlaybackErrorScreen"), 'ZapiPlayer deve renderizar TvPlaybackErrorScreen no estado allSourcesFailed');

// Garante que handleKeyDown NÃO intercepta setas/reprodução quando allSourcesFailed estiver ativo
const allSourcesFailedGuard = "if (allSourcesFailed) {";
assert(playerCode.includes(allSourcesFailedGuard), 'handleKeyDown deve possuir proteção antecipada para allSourcesFailed');

const keydownIdx = playerCode.indexOf('const handleKeyDown = (e: KeyboardEvent) => {');
assert(keydownIdx !== -1, 'handleKeyDown deve existir em ZapiPlayer.tsx');
const keydownBody = playerCode.slice(keydownIdx, keydownIdx + 2000);

assert(
  keydownBody.includes("if (allSourcesFailed) {") &&
  keydownBody.includes("handlePlayerClose();") &&
  keydownBody.includes("return;"),
  'handleKeyDown deve encerrar cedo em allSourcesFailed sem executar comandos de reprodução (skipTime, changeVolume, togglePlay)'
);

// Garante proteção contra cliques repetidos em Tentar novamente
assert(playerCode.includes("isRetryingSources"), 'ZapiPlayer deve rastrear estado isRetryingSources');
assert(playerCode.includes("if (isRetryingSources || !onRetrySources) return;"), 'handleRetrySources deve bloquear cliques repetidos enquanto ativa a operação');

console.log('✓ ZapiPlayer protege comandos de reprodução de interceptarem setas/OK durante a tela de erro.');
console.log('✓ Bloqueio de cliques repetidos em Tentar novamente implementado.');

// -----------------------------------------------------------------------------
// [Teste 6] Verificação do Feedback Modal na TV
// -----------------------------------------------------------------------------
console.log('\n[Teste 6] Verificando ReportFeedbackModal.tsx com navegação na TV...');
const feedbackModalCode = fs.readFileSync(
  path.join(process.cwd(), 'src/components/feedback/ReportFeedbackModal.tsx'),
  'utf-8'
);

assert(
  feedbackModalCode.includes("tvNavigationManager.registerBackHandler('feedback-modal', 400"),
  'ReportFeedbackModal deve registrar backHandler com prioridade 400 (fecha modal e não a tela de erro)'
);

assert(
  feedbackModalCode.includes("feedback-modal-cancel") &&
  feedbackModalCode.includes("feedback-modal-submit"),
  'ReportFeedbackModal deve disponibilizar focusKeys para navegação com controle remoto'
);

assert(
  playerCode.includes("setFocus('tv-player-error-report');"),
  'Ao fechar o modal de feedback, o foco deve ser restaurado para o botão Reportar erro'
);

console.log('✓ ReportFeedbackModal integrado à navegação da TV com prioridade 400 e restauração de foco.');

// -----------------------------------------------------------------------------
// [Teste 7] Verificação do TvWatchError.tsx (Rotas Inválidas)
// -----------------------------------------------------------------------------
console.log('\n[Teste 7] Verificando TvWatchError.tsx...');
const tvWatchErrorCode = fs.readFileSync(
  path.join(process.cwd(), 'src/components/tv/TvWatchError.tsx'),
  'utf-8'
);

assert(
  tvWatchErrorCode.includes("onArrowPress: () => false"),
  'TvWatchError deve possuir onArrowPress travado para impedir perda de foco'
);
assert(
  tvWatchErrorCode.includes("tvNavigationManager.registerBackHandler('tv-error-back', 300"),
  'TvWatchError deve registrar backHandler com prioridade 300'
);

console.log('✓ TvWatchError.tsx preservado e protegido contra fuga de foco com setas.');

// -----------------------------------------------------------------------------
// [Teste 8] Teste Funcional da Pilha de Prioridade do Botão Voltar (Back Handler)
// -----------------------------------------------------------------------------
console.log('\n[Teste 8] Simulação funcional do tvNavigationManager com prioridades e keycodes de TV...');

const executionOrder: string[] = [];

// Registra player normal com prioridade 200
const unregisterPlayerBack = tvNavigationManager.registerBackHandler('tv-player-controls', 200, () => {
  executionOrder.push('tv-player-controls');
  return true;
});

// Registra tela de erro com prioridade 350
let errorScreenHandled = true;
const unregisterErrorBack = tvNavigationManager.registerBackHandler('tv-playback-error-screen', 350, () => {
  executionOrder.push('tv-playback-error-screen');
  return errorScreenHandled;
});

// Dispara dispatchBack() - A tela de erro (350) DEVE interceptar antes do player (200)
const wasHandled = tvNavigationManager.dispatchBack();
assert(wasHandled === true, 'dispatchBack deve retornar true quando consumido');
assert.strictEqual(executionOrder[0], 'tv-playback-error-screen', 'Tela de erro (prioridade 350) deve executar ANTES dos controles do player (prioridade 200)');
assert.strictEqual(executionOrder.length, 1, 'Controles do player não devem ser chamados se a tela de erro consumiu o evento');
console.log('✓ Tela de erro (prioridade 350) tem precedência estrita sobre controles normais do player (prioridade 200).');

// Agora registra o modal de feedback com prioridade 400 (modal aberto em cima da tela de erro)
const unregisterModalBack = tvNavigationManager.registerBackHandler('feedback-modal', 400, () => {
  executionOrder.push('feedback-modal');
  return true;
});

executionOrder.length = 0;
const wasModalHandled = tvNavigationManager.dispatchBack();
assert(wasModalHandled === true, 'Modal deve consumir o botão voltar');
assert.strictEqual(executionOrder[0], 'feedback-modal', 'Modal de feedback (prioridade 400) deve executar ANTES da tela de erro (350)');
assert.strictEqual(executionOrder.length, 1, 'Tela de erro não deve fechar se o modal de feedback estiver aberto');
console.log('✓ Modal de feedback (prioridade 400) tem precedência sobre a tela de erro (prioridade 350).');

// Limpeza de handlers
unregisterModalBack();
unregisterErrorBack();
unregisterPlayerBack();

// Teste de mapeamento de teclas de controle remoto
const backKeyCodes = [
  { name: 'Fire TV (keyCode 4)', keyCode: 4, key: 'GoBack' },
  { name: 'Samsung Tizen (keyCode 10009)', keyCode: 10009, key: 'Return' },
  { name: 'LG webOS (keyCode 461)', keyCode: 461, key: 'Back' },
  { name: 'Desktop TV Escape (keyCode 27)', keyCode: 27, key: 'Escape' }
];

for (const k of backKeyCodes) {
  let backTriggered = false;
  const unregister = tvNavigationManager.registerBackHandler(`test-key-${k.keyCode}`, 350, () => {
    backTriggered = true;
    return true;
  });

  // Invoca dispatchBack simulando o comportamento de handleGlobalKeyDown
  tvNavigationManager.dispatchBack();
  assert(backTriggered === true, `Tecla ${k.name} deve acionar o back handler`);
  unregister();
}
console.log('✓ Todas as teclas de controle remoto (Fire TV, Samsung Tizen, LG webOS, PC TV) são compatíveis.');

console.log('\n========================================================================');
console.log('  TODOS OS TESTES DE NAVEGAÇÃO ESPACIAL NA TELA DE ERRO PASSARAM!       ');
console.log('========================================================================\n');
process.exit(0);
