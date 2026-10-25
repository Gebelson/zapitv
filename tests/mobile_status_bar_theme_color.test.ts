/**
 * ZapiTV - Suíte de Testes: Cor da Barra Superior / Status Bar no Mobile
 * 
 * Requisitos validados:
 * 1. Remoção completa do fundo azul (#007df7) da barra de status superior.
 * 2. Utilização estrita das variáveis/valores oficiais do background (#05070a para dark, #F8F9FC para light).
 * 3. Continuidade visual entre a barra de status e o fundo do site.
 * 4. Suporte a Dynamic Island, notch e safe areas (viewport-fit=cover e env(safe-area-inset-top)).
 * 5. Configuração correta no PWA (public/manifest.json com theme_color: #05070a).
 * 6. Sincronização dinâmica no React (App.tsx) da meta tag theme-color e apple-mobile-web-app-status-bar-style.
 * 7. Preservação de elementos azuis da UI (logo ZapiTV, badges, botões).
 * 8. Zero impacto no layout, altura do header (h-14 mantido) ou posicionamento.
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function testAssert(desc: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${desc}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

console.log('========================================================================');
console.log('📱 SUÍTE DE TESTES: COR DA BARRA DE STATUS SUPERIOR NO MOBILE');
console.log('========================================================================\n');

// --------------------------------------------------------------------------
// 1. Auditoria de index.html
// --------------------------------------------------------------------------
console.log('--- 1. Auditoria de index.html ---');
const indexHtmlPath = path.resolve('index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

testAssert(
  'index.html NÃO possui theme-color com azul #007df7',
  !indexHtml.includes('name="theme-color" content="#007df7"')
);

testAssert(
  'index.html define theme-color para modo escuro com #05070a',
  indexHtml.includes('name="theme-color" content="#05070a"')
);

testAssert(
  'index.html define theme-color para modo claro com #F8F9FC',
  indexHtml.includes('name="theme-color" content="#F8F9FC"')
);

testAssert(
  'index.html contém viewport-fit=cover para suporte a notch/Dynamic Island',
  indexHtml.includes('viewport-fit=cover')
);

testAssert(
  'index.html contém apple-mobile-web-app-capable e status-bar-style black-translucent',
  indexHtml.includes('name="apple-mobile-web-app-capable" content="yes"') &&
  indexHtml.includes('name="apple-mobile-web-app-status-bar-style" content="black-translucent"')
);

// --------------------------------------------------------------------------
// 2. Auditoria de public/manifest.json (PWA)
// --------------------------------------------------------------------------
console.log('\n--- 2. Auditoria de public/manifest.json (PWA) ---');
const manifestPath = path.resolve('public/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

testAssert(
  'manifest.json define theme_color como #05070a (não azul)',
  manifest.theme_color === '#05070a'
);

testAssert(
  'manifest.json define background_color como #05070a',
  manifest.background_color === '#05070a'
);

// --------------------------------------------------------------------------
// 3. Auditoria de App.tsx (Sincronização Dinâmica do Tema)
// --------------------------------------------------------------------------
console.log('\n--- 3. Auditoria de App.tsx (Sincronização Dinâmica) ---');
const appPath = path.resolve('App.tsx');
const appCode = fs.readFileSync(appPath, 'utf8');

testAssert(
  'App.tsx sincroniza dinamicamente as meta tags theme-color com o tema ativo',
  appCode.includes("document.querySelectorAll<HTMLMetaElement>('meta[name=\"theme-color\"]')") &&
  appCode.includes('meta.setAttribute(\'content\', bgColor)')
);

testAssert(
  'App.tsx atualiza apple-mobile-web-app-status-bar-style dinamicamente (black-translucent vs default)',
  appCode.includes("metaAppleStatus.setAttribute('content', isDarkMode ? 'black-translucent' : 'default')")
);

// --------------------------------------------------------------------------
// 4. Auditoria de MobileHeader.tsx e MobileLayout.tsx
// --------------------------------------------------------------------------
console.log('\n--- 4. Auditoria dos Componentes Mobile (Header e Layout) ---');
const headerPath = path.resolve('src/components/mobile/MobileHeader.tsx');
const headerCode = fs.readFileSync(headerPath, 'utf8');

testAssert(
  'MobileHeader utiliza pt-[env(safe-area-inset-top,0px)] para respeitar a safe area/notch',
  headerCode.includes('pt-[env(safe-area-inset-top,0px)]')
);

testAssert(
  'MobileHeader usa fundo #05070a / rgba(5, 7, 10) no tema escuro ao rolar',
  headerCode.includes('bg-[#05070a]') || headerCode.includes('rgba(5, 7, 10')
);

testAssert(
  'MobileHeader usa degradê cinematográfico contínuo partindo de #05070a / rgba(5, 7, 10)',
  headerCode.includes('from-[#05070a]') || headerCode.includes('rgba(5, 7, 10')
);

testAssert(
  'MobileHeader preserva a altura útil padrão h-14 da barra',
  headerCode.includes('h-14 px-4 flex items-center justify-between')
);

testAssert(
  'MobileHeader preserva os elementos azuis legítimos da interface (ex: texto ZapiTV e badges)',
  headerCode.includes('text-[#007df7]') && headerCode.includes('bg-[#007df7]')
);

const layoutPath = path.resolve('src/components/mobile/MobileLayout.tsx');
const layoutCode = fs.readFileSync(layoutPath, 'utf8');

testAssert(
  'MobileLayout utiliza a cor oficial de fundo #05070a sincronizada com o tema',
  layoutCode.includes('isDarkMode ? \'bg-[#05070a] text-slate-100\' : \'bg-[#F8F9FC] text-gray-900\'')
);

console.log('\n========================================================================');
console.log(`📊 RESULTADO DA SUÍTE DE STATUS BAR MOBILE: ${passed} PASS, ${failed} FAIL`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
process.exit(0);
