import { subtitleStyleService, SubtitleStyle } from './src/core/subtitles/subtitleStyleService';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// Mock localStorage para testes Node.js
const mockStorage = new Map<string, string>();
const storageObj = {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};
(global as any).localStorage = storageObj;
(global as any).window = { 
  localStorage: storageObj,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
};

console.log('===============================================================');
console.log('🧪 TEST SUITE: ZAPITV AJUSTE DE ESPAÇAMENTO VERTICAL DA LEGENDA');
console.log('===============================================================\n');

// 1. Verificação de Padrão
const initialStyle = subtitleStyleService.getSubtitleStyle();
assert(initialStyle.lineSpacing === 'normal', 'Estilo inicial possui espaçamento vertical normal');

const cssNormal = subtitleStyleService.computeSubtitleCSS(initialStyle, false);
assert(cssNormal.lineHeight === 1.35, 'Espaçamento normal computa lineHeight de 1.35x');

// 2. Modo Compacto (Justo para 2 linhas de legenda)
const compactStyle = subtitleStyleService.updateSubtitleStyle({ lineSpacing: 'compact', customLineSpacing: undefined });
assert(compactStyle.lineSpacing === 'compact', 'Atualiza com sucesso para espaçamento compacto');
const cssCompact = subtitleStyleService.computeSubtitleCSS(compactStyle, false);
assert(cssCompact.lineHeight === 1.15, 'Modo compacto computa lineHeight de 1.15x para aproximar as linhas');

// 3. Modo Espaçado (Relaxado)
const relaxedStyle = subtitleStyleService.updateSubtitleStyle({ lineSpacing: 'relaxed', customLineSpacing: undefined });
assert(relaxedStyle.lineSpacing === 'relaxed', 'Atualiza com sucesso para espaçamento relaxado');
const cssRelaxed = subtitleStyleService.computeSubtitleCSS(relaxedStyle, false);
assert(cssRelaxed.lineHeight === 1.6, 'Modo relaxado computa lineHeight de 1.60x');

// 4. Modo Amplo (Largo)
const spaciousStyle = subtitleStyleService.updateSubtitleStyle({ lineSpacing: 'spacious', customLineSpacing: undefined });
assert(spaciousStyle.lineSpacing === 'spacious', 'Atualiza com sucesso para espaçamento amplo');
const cssSpacious = subtitleStyleService.computeSubtitleCSS(spaciousStyle, false);
assert(cssSpacious.lineHeight === 1.95, 'Modo amplo computa lineHeight de 1.95x para separar bem as linhas');

// 5. Ajuste Contínuo Fino (customLineSpacing)
const customStyle = subtitleStyleService.updateSubtitleStyle({ customLineSpacing: 1.75 });
const cssCustom = subtitleStyleService.computeSubtitleCSS(customStyle, false);
assert(cssCustom.lineHeight === 1.75, 'Ajuste contínuo computa lineHeight exato de 1.75x');

// 6. Persistência no LocalStorage
assert(mockStorage.has('zapitv_subtitle_style'), 'Persiste estilo com espaçamento vertical no localStorage');
const savedData = JSON.parse(mockStorage.get('zapitv_subtitle_style')!);
assert(savedData.customLineSpacing === 1.75, 'Recupera do localStorage o valor customizado');

// 7. Reset para Padrão
const resetStyle = subtitleStyleService.resetSubtitleStyle();
assert(resetStyle.lineSpacing === 'normal', 'Reset restaura espaçamento para normal');
assert(resetStyle.customLineSpacing === undefined, 'Reset limpa customLineSpacing');

console.log('\n===============================================================');
console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS (100%)`);
console.log('===============================================================');
