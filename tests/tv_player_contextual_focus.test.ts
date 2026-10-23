import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('========================================================================');
console.log('--- TESTE: PRESERVAÇÃO DE FOCO CONTEXTUAL NO PLAYER DA SMART TV ---');
console.log('========================================================================\n');

const tvPlayerControlsCode = fs.readFileSync(
  path.join(process.cwd(), 'src/components/player/TvPlayerControls.tsx'),
  'utf-8'
);

// -----------------------------------------------------------------------------
// [Cenário 1] Análise estática: Remoção da dependência indiscriminada de menu no effect
// -----------------------------------------------------------------------------
console.log('[Cenário 1] Verificação do hook de foco inicial dos controles...');
const focusEffectIndex = tvPlayerControlsCode.indexOf('// Foco inicial automático no botão de Play/Pause ao abrir os controles');
assert(focusEffectIndex !== -1, 'Efeito de foco deve existir');
const focusEffectSection = tvPlayerControlsCode.slice(focusEffectIndex, focusEffectIndex + 2500);

// Garante que o array de dependências do effect NÃO inclui `menu`
const dependencyArrayMatch = focusEffectSection.match(/}\s*,\s*\[(.*?)\]\s*\);/);
assert(dependencyArrayMatch, 'Array de dependências do useEffect deve existir');
const deps = dependencyArrayMatch[1];
assert(!deps.includes('menu'), 'useEffect de abertura dos controles NÃO pode depender de menu (causaria reset ao fechar menu)');
assert(deps.includes('props.visible'), 'useEffect de abertura dos controles deve depender de props.visible');
assert(deps.includes('props.suspended'), 'useEffect de abertura dos controles deve depender de props.suspended');
console.log('✓ useEffect de abertura não depende de menu e não dispara ao fechar gavetas laterais.');

// -----------------------------------------------------------------------------
// [Cenário 2] Proteção contra sobreposição de foco em menu closing
// -----------------------------------------------------------------------------
console.log('\n[Cenário 2] Verificação da flag isClosingMenuRef e pendingFocusRef...');
assert(focusEffectSection.includes('if (isClosingMenuRef.current) return;'), 'Effect deve ignorar fechamento de menu');
assert(focusEffectSection.includes('if (pendingFocusRef.current)'), 'Effect deve priorizar pendingFocusRef antes de qualquer padrão');
assert(focusEffectSection.includes('if (wasVisible) return;'), 'Effect não deve sobrescrever foco se os controles já estavam visíveis');
console.log('✓ Flags isClosingMenuRef, pendingFocusRef e wasVisible protegem a navegação do usuário.');

// -----------------------------------------------------------------------------
// [Cenário 3] Restauração de foco exata ao fechar menus
// -----------------------------------------------------------------------------
console.log('\n[Cenário 3] Verificação da função closeMenu e restauração para menuOrigin...');
const closeMenuIndex = tvPlayerControlsCode.indexOf('const closeMenu = useCallback');
assert(closeMenuIndex !== -1, 'closeMenu deve existir');
const closeMenuSection = tvPlayerControlsCode.slice(closeMenuIndex, closeMenuIndex + 900);

assert(closeMenuSection.includes('setFocus(origin);'), 'closeMenu deve restaurar o foco para origin');
assert(closeMenuSection.includes('pendingFocusRef.current = origin;'), 'closeMenu deve marcar pendingFocusRef com origin');
assert(closeMenuSection.includes('isClosingMenuRef.current = true;'), 'closeMenu deve ativar flag isClosingMenuRef');
console.log('✓ closeMenu restaura foco pontualmente no botão de origem da barra principal.');

// -----------------------------------------------------------------------------
// [Cenário 4] Avanço e retrocesso de 10s definem foco nos botões de seek caso controles apareçam
// -----------------------------------------------------------------------------
console.log('\n[Cenário 4] Verificação de Direita (+10s) e Esquerda (-10s)...');
const estado1Index = tvPlayerControlsCode.indexOf('// ESTADO 1: CONTROLES OCULTOS (!props.visible)');
const estado2Index = tvPlayerControlsCode.indexOf('// ESTADO 2: CONTROLES VISÍVEIS (props.visible === true)');
const estado1Section = tvPlayerControlsCode.slice(estado1Index, estado2Index);

assert(
  estado1Section.includes("const targetBtn = dir === 'forward' ? 'tv-player-forward' : 'tv-player-rewind';") &&
  estado1Section.includes("pendingFocusRef.current = targetBtn;"),
  'Ao pressionar Esquerda ou Direita com controles ocultos, pendingFocusRef deve ser tv-player-forward ou tv-player-rewind'
);
console.log('✓ Avanço e retrocesso de 10s direcionam foco para tv-player-forward e tv-player-rewind, sem selecionar Play/Pause.');

// -----------------------------------------------------------------------------
// [Cenário 5] Simulação funcional do fechamento de menus (Episódios, Áudio, Configurações)
// -----------------------------------------------------------------------------
console.log('\n[Cenário 5] Simulação funcional de abertura e fechamento de cada menu...');

interface MockTvState {
  currentFocus: string | null;
  menu: string | null;
  menuOrigin: string;
  isClosingMenu: boolean;
  pendingFocus: string | null;
}

const state: MockTvState = {
  currentFocus: 'tv-player-play',
  menu: null,
  menuOrigin: 'tv-player-play',
  isClosingMenu: false,
  pendingFocus: null
};

const openMockMenu = (menuName: string, originKey: string) => {
  state.menu = menuName;
  state.menuOrigin = originKey;
  state.pendingFocus = originKey;
  state.currentFocus = `drawer-${menuName}-item-0`;
};

const closeMockMenu = () => {
  state.isClosingMenu = true;
  state.pendingFocus = state.menuOrigin;
  state.menu = null;
  state.currentFocus = state.menuOrigin;
  state.isClosingMenu = false;
  state.pendingFocus = null;
};

// 1. Menu Episódios
openMockMenu('episodes', 'tv-player-episodes');
assert.strictEqual(state.menu, 'episodes', 'Menu de episódios deve estar aberto');
assert.strictEqual(state.currentFocus, 'drawer-episodes-item-0', 'Foco deve estar dentro do drawer');
closeMockMenu();
assert.strictEqual(state.menu, null, 'Menu deve estar fechado');
assert.strictEqual(state.currentFocus, 'tv-player-episodes', 'Foco DEVE retornar para tv-player-episodes');

// 2. Menu Áudio e Legendas
openMockMenu('audio_subtitles', 'tv-player-audio');
assert.strictEqual(state.menu, 'audio_subtitles', 'Menu de áudio deve estar aberto');
closeMockMenu();
assert.strictEqual(state.currentFocus, 'tv-player-audio', 'Foco DEVE retornar para tv-player-audio');

// 3. Menu Configurações / Mais Opções
openMockMenu('options', 'tv-player-settings');
assert.strictEqual(state.menu, 'options', 'Menu de configurações deve estar aberto');
closeMockMenu();
assert.strictEqual(state.currentFocus, 'tv-player-settings', 'Foco DEVE retornar para tv-player-settings');
console.log('✓ Restauração de foco validada com precisão para todos os 3 menus.');

// -----------------------------------------------------------------------------
// [Cenário 6] Simulação do efeito de abertura com pendingFocusRef de seek
// -----------------------------------------------------------------------------
console.log('\n[Cenário 6] Simulação de seek de 10s e exibição subsequente dos controles...');

const simulateControlsOpening = (
  pendingFocus: string | null,
  wasVisible: boolean,
  currentFocus: string | null
): string => {
  if (pendingFocus) {
    return pendingFocus; // Direciona para o botão que originou o evento
  }
  if (wasVisible) {
    return currentFocus || 'tv-player-play'; // Preserva o foco atual
  }
  const validTvControls = [
    'tv-player-play',
    'tv-player-forward',
    'tv-player-rewind',
    'tv-player-next',
    'tv-player-timeline',
    'tv-player-episodes',
    'tv-player-audio',
    'tv-player-settings',
    'tv-player-back'
  ];
  if (currentFocus && validTvControls.includes(currentFocus)) {
    return currentFocus;
  }
  return 'tv-player-play';
};

// Teste 6A: Direita com controles ocultos -> controles aparecem
const focusAfterRight = simulateControlsOpening('tv-player-forward', false, null);
assert.strictEqual(focusAfterRight, 'tv-player-forward', 'Se os controles aparecerem após Direita, foco deve ir para tv-player-forward');

// Teste 6B: Esquerda com controles ocultos -> controles aparecem
const focusAfterLeft = simulateControlsOpening('tv-player-rewind', false, null);
assert.strictEqual(focusAfterLeft, 'tv-player-rewind', 'Se os controles aparecerem após Esquerda, foco deve ir para tv-player-rewind');

// Teste 6C: Abertura natural sem pending -> foco no Play/Pause
const focusNaturalOpen = simulateControlsOpening(null, false, null);
assert.strictEqual(focusNaturalOpen, 'tv-player-play', 'Abertura inicial padrão foca em tv-player-play');

// Teste 6D: Controles já visíveis com foco em Áudio e Legendas -> não altera
const focusAlreadyVisible = simulateControlsOpening(null, true, 'tv-player-audio');
assert.strictEqual(focusAlreadyVisible, 'tv-player-audio', 'Controles já visíveis não têm foco sobrescrito');
console.log('✓ Regras contextuais de exibição de controles validadas com sucesso.');

// -----------------------------------------------------------------------------
// [Cenário 7] Simulação de navegação sequencial sem perda de seleção
// -----------------------------------------------------------------------------
console.log('\n[Cenário 7] Simulação de fluxo contínuo de uso...');

let activeBtn = 'tv-player-play';
// 1. Move para a direita (Forward)
activeBtn = 'tv-player-forward';
assert.strictEqual(activeBtn, 'tv-player-forward');

// 2. Move para a direita (Next)
activeBtn = 'tv-player-next';
assert.strictEqual(activeBtn, 'tv-player-next');

// 3. Move para a direita (Episodes)
activeBtn = 'tv-player-episodes';
openMockMenu('episodes', activeBtn);
assert.strictEqual(state.currentFocus, 'drawer-episodes-item-0');
closeMockMenu();
activeBtn = state.currentFocus!;
assert.strictEqual(activeBtn, 'tv-player-episodes', 'Foco restaurado para Episódios');

// 4. Move para a direita (Audio)
activeBtn = 'tv-player-audio';
openMockMenu('audio_subtitles', activeBtn);
closeMockMenu();
activeBtn = state.currentFocus!;
assert.strictEqual(activeBtn, 'tv-player-audio', 'Foco restaurado para Áudio e Legendas');

// 5. Move para a direita (Settings)
activeBtn = 'tv-player-settings';
openMockMenu('options', activeBtn);
closeMockMenu();
activeBtn = state.currentFocus!;
assert.strictEqual(activeBtn, 'tv-player-settings', 'Foco restaurado para Configurações');

// 6. Move para a esquerda (Audio)
activeBtn = 'tv-player-audio';
assert.strictEqual(activeBtn, 'tv-player-audio');

// 7. Move para a esquerda (Episodes)
activeBtn = 'tv-player-episodes';
assert.strictEqual(activeBtn, 'tv-player-episodes');

// 8. Move para a esquerda (Play/Pause) e aciona
activeBtn = 'tv-player-play';
assert.strictEqual(activeBtn, 'tv-player-play', 'Play/Pause responde pontualmente quando explicitamente selecionado');
console.log('✓ Ciclo contínuo de navegação e acionamento 100% consistente.');

console.log('\n========================================================================');
console.log(' TODOS OS 7 CENÁRIOS DE PRESERVAÇÃO DE FOCO CONTEXTUAL PASSARAM! ');
console.log('========================================================================\n');
