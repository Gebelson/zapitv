import {
  subtitleStyleService,
  DEFAULT_SUBTITLE_STYLE,
  STORAGE_KEY_SUBTITLE_STYLE,
  EVENT_SUBTITLE_STYLE_CHANGED,
  SubtitleStyle
} from '../src/core/subtitles/subtitleStyleService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${desc}`);
    failed++;
  }
}

console.log('--- Iniciando Testes de Estilo de Legenda (Contorno e Sombra) ---');

// Test 1: Padrões de fábrica contêm contorno e sombra
const defaults = subtitleStyleService.getSubtitleStyle();
assert(defaults.outline === 'thin', 'Padrão de contorno deve ser "thin" (Fino)');
assert(defaults.shadow === 'soft', 'Padrão de sombra deve ser "soft" (Suave)');
assert(defaults.fontSize === 'md', 'Padrão de tamanho deve ser "md"');
assert(defaults.color === '#FFFFFF', 'Padrão de cor deve ser branco "#FFFFFF"');
assert(defaults.bgColor === 'semi', 'Padrão de fundo deve ser "semi"');

// Test 2: CSS gerado para os padrões
const defaultCSS = subtitleStyleService.computeSubtitleCSS(defaults, false);
assert(defaultCSS.WebkitTextStroke === '1.2px #000000', 'CSS do contorno fino é "1.2px #000000"');
assert(defaultCSS.paintOrder === 'stroke fill', 'CSS paintOrder deve ser "stroke fill" para preservar glifos');
assert(typeof defaultCSS.textShadow === 'string' && (defaultCSS.textShadow as string).includes('rgba(0, 0, 0, 0.85)'), 'CSS da sombra suave aplicado');

// Test 3: Atualização de contorno (none, thin, medium, thick)
const outlines = ['none', 'thin', 'medium', 'thick'] as const;
for (const o of outlines) {
  const updated = subtitleStyleService.updateSubtitleStyle({ outline: o });
  assert(updated.outline === o, `Atualização de contorno para "${o}" efetuada`);
  const css = subtitleStyleService.computeSubtitleCSS(updated, false);
  if (o === 'none') {
    assert(css.WebkitTextStroke === '0px transparent', 'Contorno "none" gera "0px transparent"');
  } else if (o === 'medium') {
    assert(css.WebkitTextStroke === '2.2px #000000', 'Contorno "medium" gera "2.2px #000000"');
  } else if (o === 'thick') {
    assert(css.WebkitTextStroke === '3.5px #000000', 'Contorno "thick" gera "3.5px #000000"');
  }
}

// Test 4: Atualização de sombra (none, soft, strong, drop)
const shadows = ['none', 'soft', 'strong', 'drop'] as const;
for (const s of shadows) {
  const updated = subtitleStyleService.updateSubtitleStyle({ shadow: s });
  assert(updated.shadow === s, `Atualização de sombra para "${s}" efetuada`);
  const css = subtitleStyleService.computeSubtitleCSS(updated, false);
  if (s === 'none') {
    assert(css.textShadow === 'none', 'Sombra "none" gera "none"');
  } else if (s === 'strong') {
    assert(typeof css.textShadow === 'string' && (css.textShadow as string).includes('0 0 12px #000000'), 'Sombra "strong" gera múltiplos halos pretos');
  } else if (s === 'drop') {
    assert(typeof css.textShadow === 'string' && (css.textShadow as string).includes('2px 2px 0px #000000'), 'Sombra "drop" gera sombra projetada 3D');
  }
}

// Test 5: Mini Preview CSS
const miniCSS = subtitleStyleService.computeSubtitleCSS(
  { ...DEFAULT_SUBTITLE_STYLE, outline: 'thick', shadow: 'strong' },
  true
);
assert(miniCSS.fontSize === '15px', 'Mini preview escala a fonte para proporção do preview card (15px para md)');
assert(miniCSS.WebkitTextStroke === '2.5px #000000', 'Mini preview escala a espessura do contorno');

// Test 6: Reset para os padrões de fábrica
const reset = subtitleStyleService.resetSubtitleStyle();
assert(reset.outline === 'thin', 'Reset restaura contorno para "thin"');
assert(reset.shadow === 'soft', 'Reset restaura sombra para "soft"');
assert(reset.fontSize === 'md', 'Reset restaura tamanho para "md"');
assert(reset.color === '#FFFFFF', 'Reset restaura cor para branco');

console.log(`\n========================================`);
console.log(`Total de testes: ${passed + failed}`);
console.log(`Passaram: ${passed}`);
console.log(`Falharam: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
