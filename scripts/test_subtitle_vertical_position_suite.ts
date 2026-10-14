import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  subtitleStyleService,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_VERTICAL_POSITION,
  normalizeVerticalPosition,
  STORAGE_KEY_SUBTITLE_STYLE,
  EVENT_SUBTITLE_STYLE_CHANGED
} from '../src/core/subtitles/subtitleStyleService';

console.log('=== INICIANDO SUÍTE DE TESTES: AJUSTE DE POSIÇÃO VERTICAL DAS LEGENDAS ===\n');

// Mock simples de localStorage e window para execução isolada em Node
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

let lastDispatchedEvent: any = null;
(global as any).window = {
  dispatchEvent: (event: any) => { lastDispatchedEvent = event; },
  addEventListener: () => {},
  removeEventListener: () => {}
};
(global as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, params: any = {}) {
    this.type = type;
    this.detail = params.detail;
  }
};

// TESTE 1: Posição vertical padrão
console.log('TESTE 1: Verificando posição padrão...');
assert.strictEqual(DEFAULT_VERTICAL_POSITION, 10, 'DEFAULT_VERTICAL_POSITION deve ser 10%');
const initialStyle = subtitleStyleService.getSubtitleStyle();
assert.strictEqual(normalizeVerticalPosition(initialStyle.verticalPosition), 10, 'Estilo padrão deve ter 10%');
console.log('✓ TESTE 1 PASSOU: Padrão é 10%.');

// TESTE 2: Limites seguros de altura (4% a 35%)
console.log('TESTE 2: Verificando limites seguros de movimentação vertical (4% a 35%)...');
assert.strictEqual(normalizeVerticalPosition(0), 4, 'Valores abaixo do mínimo devem ser travados em 4%');
assert.strictEqual(normalizeVerticalPosition(3), 4, '3% deve ser normalizado para 4%');
assert.strictEqual(normalizeVerticalPosition(4), 4, '4% deve ser aceito');
assert.strictEqual(normalizeVerticalPosition(20), 20, '20% deve ser aceito');
assert.strictEqual(normalizeVerticalPosition(35), 35, '35% deve ser aceito');
assert.strictEqual(normalizeVerticalPosition(36), 5, '36px legado deve ser convertido para ~5%');
assert.strictEqual(normalizeVerticalPosition(80), 10, '80px legado deve ser convertido exatamente para 10%');
assert.strictEqual(normalizeVerticalPosition(NaN), 10, 'NaN deve retornar o padrão 10%');
assert.strictEqual(normalizeVerticalPosition(null), 10, 'null deve retornar o padrão 10%');
console.log('✓ TESTE 2 PASSOU: Limites e conversão de valores legados funcionando.');

// TESTE 3: Atualização e Persistência em Tempo Real
console.log('TESTE 3: Testando atualização e persistência no localStorage...');
subtitleStyleService.updateSubtitleStyle({ verticalPosition: 25.5 });
const savedRaw = mockStorage[STORAGE_KEY_SUBTITLE_STYLE];
assert.ok(savedRaw, 'Estilo deve estar salvo no localStorage');
const savedObj = JSON.parse(savedRaw);
assert.strictEqual(savedObj.verticalPosition, 25.5, 'Posição salva deve ser 25.5%');
assert.ok(lastDispatchedEvent, 'Evento de atualização deve ter sido disparado');
assert.strictEqual(lastDispatchedEvent.type, EVENT_SUBTITLE_STYLE_CHANGED, 'Tipo de evento correto');
assert.strictEqual(lastDispatchedEvent.detail.verticalPosition, 25.5, 'Detalhe do evento deve conter 25.5%');
console.log('✓ TESTE 3 PASSOU: Persistência imediata e disparo de eventos confirmados.');

// TESTE 4: Restauração da Posição Padrão (resetVerticalPosition)
console.log('TESTE 4: Testando botão/função de restaurar posição padrão...');
subtitleStyleService.resetVerticalPosition();
const restoredStyle = subtitleStyleService.getSubtitleStyle();
assert.strictEqual(restoredStyle.verticalPosition, 10, 'resetVerticalPosition deve retornar a 10%');
console.log('✓ TESTE 4 PASSOU: Restauração da altura padrão para 10% confirmada.');

// TESTE 5: Verificação estática do código fonte no ZapiPlayer.tsx
console.log('TESTE 5: Verificando implementação da UI e container no ZapiPlayer.tsx...');
const zapiPlayerPath = path.resolve('src/components/player/ZapiPlayer.tsx');
const zapiPlayerCode = fs.readFileSync(zapiPlayerPath, 'utf8');

// A. Nome exato da opção
assert.ok(
  zapiPlayerCode.includes('Posição vertical'),
  'ZapiPlayer.tsx deve conter o rótulo exato "Posição vertical"'
);

// B. Slider horizontal (input range com min 4 e max 35)
assert.ok(
  zapiPlayerCode.includes('type="range"') &&
  zapiPlayerCode.includes('min="4"') &&
  zapiPlayerCode.includes('max="35"'),
  'ZapiPlayer.tsx deve conter slider horizontal com min="4" e max="35"'
);

// C. Botão Restaurar
assert.ok(
  zapiPlayerCode.includes('Restaurar') &&
  zapiPlayerCode.includes('updateSubtitleStyle({ verticalPosition: DEFAULT_VERTICAL_POSITION })'),
  'ZapiPlayer.tsx deve conter botão de Restaurar a posição padrão'
);

// D. Posicionamento Proporcional e Responsivo na camada de overlay com safe-area
assert.ok(
  zapiPlayerCode.includes('normalizeVerticalPosition(subtitleStyle.verticalPosition)}% + env(safe-area-inset-bottom, 0px)'),
  'ZapiPlayer.tsx deve usar calc(...% + env(safe-area-inset-bottom, 0px)) para posicionamento proporcional e responsivo'
);

// E. Centralização horizontal rigorosa
assert.ok(
  zapiPlayerCode.includes('absolute inset-x-0 flex justify-center pointer-events-none z-30'),
  'Camada de legendas deve manter inset-x-0 e flex justify-center para centralização perfeita'
);

console.log('✓ TESTE 5 PASSOU: Todos os elementos de interface e container estão perfeitamente implementados no ZapiPlayer.tsx.');

console.log('\n================================================================');
console.log('TODOS OS 5 TESTES DE POSIÇÃO VERTICAL DE LEGENDAS PASSARAM COM SUCESSO!');
console.log('================================================================');
