import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TEST SUITE: ZAPITV | PREVENÇÃO DE FLASH BRANCO E RECOMPOSIÇÃO DE JANELA ===\n');

const ROOT_DIR = process.cwd();
const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
const indexCssPath = path.join(ROOT_DIR, 'index.css');
const appTsxPath = path.join(ROOT_DIR, 'App.tsx');
const animatedBgPath = path.join(ROOT_DIR, 'components', 'AnimatedBackground.tsx');

// -----------------------------------------------------------------------------
// TESTE 1: Auditoria Estrutural do index.html
// -----------------------------------------------------------------------------
console.log('[Teste 1] Verificando index.html...');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

// 1.1 Não deve conter bg-gray-50 no body
assert.strictEqual(
  indexHtml.includes('bg-gray-50'), 
  false, 
  'index.html não pode conter bg-gray-50 no body'
);

// 1.2 html, body e #root devem possuir background-color: #05070a
assert.ok(
  indexHtml.includes('html, body, #root') && indexHtml.includes('#05070a'),
  'index.html deve conter estilo permanente #05070a para html, body e #root'
);

// 1.3 Suporte ao tema claro (#F8F9FC)
assert.ok(
  indexHtml.includes('#F8F9FC'),
  'index.html deve conter regra de cor para tema claro (#F8F9FC)'
);

// 1.4 Body deve iniciar com cor opaca
assert.ok(
  indexHtml.includes('<body') && indexHtml.includes('#05070a'),
  'body deve iniciar com cor de fundo inline opaca #05070a'
);
console.log('✓ Teste 1 aprovado: index.html estruturado com camadas permanentes opacas e sem bg-gray-50.');

// -----------------------------------------------------------------------------
// TESTE 2: Auditoria Estrutural do index.css
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Verificando index.css...');
const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

assert.ok(
  indexCss.includes('html,') && indexCss.includes('body,') && indexCss.includes('#root'),
  'index.css deve declarar html, body e #root conjuntamente'
);
assert.ok(
  indexCss.includes('#05070a'),
  'index.css deve definir cor dark sólida #05070a'
);
assert.ok(
  indexCss.includes('#F8F9FC'),
  'index.css deve definir cor light sólida #F8F9FC'
);
console.log('✓ Teste 2 aprovado: index.css garante camadas base estruturais opacas em CSS.');

// -----------------------------------------------------------------------------
// TESTE 3: Auditoria do App.tsx (Preservação de Classes e Fundo Sólido)
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Verificando App.tsx...');
const appTsx = fs.readFileSync(appTsxPath, 'utf-8');

// 3.1 Não pode sobrescrever document.body.className indiscriminadamente
assert.strictEqual(
  appTsx.includes("document.body.className = isDarkMode ?"),
  false,
  'App.tsx não deve substituir todo o className do body indiscriminadamente'
);

// 3.2 Deve sincronizar backgroundColor nas camadas estruturais
assert.ok(
  appTsx.includes('htmlEl.style.backgroundColor = bgColor') &&
  appTsx.includes('bodyEl.style.backgroundColor = bgColor'),
  'App.tsx deve definir backgroundColor via inline style no html e body'
);

// 3.3 Deve preservar classes existentes usando classList
assert.ok(
  appTsx.includes('bodyEl.classList.add') && appTsx.includes('bodyEl.classList.remove'),
  'App.tsx deve utilizar classList.add e remove para não destruir tv-mode ou classes adicionais'
);

// 3.4 Wrapper raiz deve ter cor opaca condizente
assert.ok(
  appTsx.includes("isDarkMode ? 'bg-[#05070a]' : 'bg-[#F8F9FC]'"),
  'Container principal em App.tsx deve ter cor opaca de fundo'
);
console.log('✓ Teste 3 aprovado: App.tsx gerencia classes cirurgicamente e assegura fundo sólido.');

// -----------------------------------------------------------------------------
// TESTE 4: Auditoria do AnimatedBackground.tsx
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Verificando components/AnimatedBackground.tsx...');
const animatedBg = fs.readFileSync(animatedBgPath, 'utf-8');

// 4.1 NÃO deve desmontar a árvore quando !isVisible
assert.strictEqual(
  animatedBg.includes('if (isTv || !isVisible)'),
  false,
  'AnimatedBackground NÃO deve desmontar os elementos visuais quando !isVisible'
);

// 4.2 Deve utilizar pausa por animation-play-state
assert.ok(
  animatedBg.includes('animated-bg-paused') && animatedBg.includes('animation-play-state: paused !important'),
  'AnimatedBackground deve utilizar animation-play-state: paused quando em background'
);

// 4.3 Camada base permanente com backgroundColor explícito
assert.ok(
  animatedBg.includes('style={{ backgroundColor: bgColor }}'),
  'AnimatedBackground deve aplicar style backgroundColor com cor sólida no container e na base'
);

// 4.4 Cores exatas Dark (#05070a) e Light (#F8F9FC)
assert.ok(
  animatedBg.includes('#05070a') && animatedBg.includes('#F8F9FC'),
  'AnimatedBackground deve utilizar as cores canônicas #05070a e #F8F9FC'
);

// 4.5 Efeitos visuais originais preservados (blobs, mix-blend, blur)
assert.ok(
  animatedBg.includes('blur-[80px]') && animatedBg.includes('animate-blob-1') && animatedBg.includes('mix-blend-multiply'),
  'AnimatedBackground deve preservar os efeitos visuais, gradientes radiais e blend modes'
);
console.log('✓ Teste 4 aprovado: AnimatedBackground mantém camada sólida permanente e pausa suave via CSS.');

console.log('\n========================================================================');
console.log(' TODOS OS 4 TESTES ESTRUTURAIS DE PREVENÇÃO DE FLASH BRANCO PASSARAM! ');
console.log('========================================================================');
