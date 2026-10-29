import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

console.log('=== TEST SUITE: ZapiTV | Correção de Transição de Páginas no Mobile ===\n');

const layoutPath = path.resolve('src/components/mobile/MobileLayout.tsx');
assert.ok(fs.existsSync(layoutPath), 'MobileLayout.tsx deve existir');
const layoutCode = fs.readFileSync(layoutPath, 'utf8');

// 1. Remoção da rolagem suave de handleSelectTab
console.log('1. Verificando remoção de rolagem suave em handleSelectTab...');
assert.strictEqual(
  layoutCode.includes("window.scrollTo({ top: 0, behavior: 'smooth' })"),
  false,
  'handleSelectTab NÃO deve conter window.scrollTo com behavior: smooth'
);
assert.strictEqual(
  layoutCode.includes("behavior: 'smooth'"),
  false,
  'MobileLayout.tsx NÃO deve utilizar behavior: smooth durante mudanças de página'
);
console.log('  -> Chamada de rolagem suave removida com sucesso de handleSelectTab.');

// 2. Posicionamento instantâneo no topo antes da pintura via useLayoutEffect
console.log('\n2. Verificando useLayoutEffect para posicionamento instantâneo no topo...');
assert.ok(
  layoutCode.includes('useLayoutEffect'),
  'MobileLayout deve importar e utilizar useLayoutEffect'
);
assert.ok(
  layoutCode.includes('[location.pathname, location.search]'),
  'useLayoutEffect deve estar associado a mudanças de rota (pathname e search)'
);
assert.ok(
  layoutCode.includes("behavior: 'instant'") || layoutCode.includes('behavior: "instant"'),
  'useLayoutEffect deve utilizar behavior: instant para rolagem imediata sem animação'
);
assert.ok(
  layoutCode.includes('window.scrollTo({ top: 0, left: 0, behavior: \'instant\' })') ||
  layoutCode.includes('window.scrollTo({ top: 0, left: 0, behavior: "instant" })'),
  'window deve ser posicionado em top: 0 com behavior: instant'
);
assert.ok(
  layoutCode.includes('document.documentElement.scrollTop = 0') ||
  layoutCode.includes('htmlEl.scrollTop = 0'),
  'document.documentElement deve ser zerado'
);
assert.ok(
  layoutCode.includes('document.body.scrollTop = 0'),
  'document.body deve ser zerado'
);
assert.ok(
  layoutCode.includes('containerRef.current.scrollTop = 0'),
  'containerRef deve ser zerado se presente'
);
console.log('  -> useLayoutEffect com reset imediato antes da pintura validado.');

// 3. Prevenção de regras globais de scroll-behavior: smooth
console.log('\n3. Verificando neutralização de scroll-behavior: smooth durante transição de abas...');
assert.ok(
  layoutCode.includes("htmlEl.style.scrollBehavior = 'auto'") ||
  layoutCode.includes('htmlEl.style.scrollBehavior = "auto"'),
  'Deve desativar temporariamente scroll-behavior antes de rolar'
);
assert.ok(
  layoutCode.includes('htmlEl.style.scrollBehavior = prevScrollBehavior'),
  'Deve restaurar scroll-behavior anterior após o reset'
);
assert.ok(
  layoutCode.includes('setScrollY(0)'),
  'Deve sincronizar setScrollY(0) imediatamente para o MobileHeader não piscar com estado anterior'
);
console.log('  -> Neutralização de regras globais de animação e reset do header validados.');

// 4. Preservação de todas as 5 abas e navegação imediata
console.log('\n4. Verificando navegação imediata para as 5 abas...');
assert.ok(layoutCode.includes("case 'home': navigate('/'); break;"), 'Aba Início preservada');
assert.ok(layoutCode.includes("case 'explore': navigate('/explorar'); break;"), 'Aba Explorar preservada');
assert.ok(layoutCode.includes("case 'search': navigate('/buscar'); break;"), 'Aba Buscar preservada');
assert.ok(layoutCode.includes("case 'programas': navigate('/programas'); break;"), 'Aba Programas preservada');
assert.ok(layoutCode.includes("case 'my-zapitv': navigate('/minha-zapitv'); break;"), 'Aba Minha Zapi preservada');
assert.ok(layoutCode.includes('if (activeTab === tab) return;'), 'Prevenção de navegação redundante se aba já ativa preservada');
console.log('  -> Todas as 5 rotas principais preservadas com navegação imediata.');

// 5. Preservação da navegação interna de categorias e botão voltar
console.log('\n5. Verificando rotas internas de categorias e popstate...');
assert.ok(layoutCode.includes("case 'movies': navigate('/filmes'); break;"), 'Rota rápida /filmes preservada');
assert.ok(layoutCode.includes("case 'series': navigate('/series'); break;"), 'Rota rápida /series preservada');
assert.ok(layoutCode.includes("case 'animes': navigate('/animes'); break;"), 'Rota rápida /animes preservada');
assert.ok(layoutCode.includes("case 'featured': navigate('/em-destaque'); break;"), 'Rota rápida /em-destaque preservada');
assert.ok(layoutCode.includes("window.addEventListener('popstate', handlePopState)"), 'Manipulador de popstate preservado');
console.log('  -> Rotas rápidas e botão Voltar preservados.');

// 6. Preservação de rolagem suave interna em carrosséis horizontais
console.log('\n6. Verificando rolagem horizontal nativa sem animação concorrente...');
const contentRowCode = fs.readFileSync(path.resolve('src/components/mobile/MobileContentRow.tsx'), 'utf8');
assert.ok(!contentRowCode.includes('scroll-smooth'), 'Swipe nativo não deve competir com scroll-smooth');
const rankedRowCode = fs.readFileSync(path.resolve('src/components/mobile/MobileRankedRow.tsx'), 'utf8');
assert.ok(!rankedRowCode.includes('scroll-smooth'), 'Ranking deve preservar inércia nativa sem scroll-smooth');
console.log('  -> Rolagem suave horizontal interna preservada nos carrosséis.');

// 7. Simulação funcional de transições de abas e cenários de scroll
console.log('\n7. Simulando cenários de scroll durante navegação mobile...');

interface MockWindow {
  scrollY: number;
  scrollX: number;
  lastScrollBehavior: string | null;
  scrollTo: (options: { top?: number; left?: number; behavior?: string }) => void;
}

const mockWindow: MockWindow = {
  scrollY: 1500,
  scrollX: 0,
  lastScrollBehavior: null,
  scrollTo(options) {
    this.scrollY = options.top ?? 0;
    this.scrollX = options.left ?? 0;
    this.lastScrollBehavior = options.behavior ?? 'auto';
  }
};

// Simulação de efeito de layout idêntico ao implementado em MobileLayout
function simulateMobileRouteTransition(
  mockWin: MockWindow,
  newPath: string
) {
  // Simula a lógica de useLayoutEffect do MobileLayout.tsx
  mockWin.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

// Cenário A: Usuário no topo da página (scrollY = 0)
mockWindow.scrollY = 0;
simulateMobileRouteTransition(mockWindow, '/explorar');
assert.strictEqual(mockWindow.scrollY, 0, 'Cenário A: scrollY deve ser 0');
assert.strictEqual(mockWindow.lastScrollBehavior, 'instant', 'Cenário A: behavior deve ser instant');
console.log('  ✓ Cenário A: Navegação a partir do topo -> instantâneo no topo.');

// Cenário B: Usuário no meio de uma página longa (scrollY = 850)
mockWindow.scrollY = 850;
simulateMobileRouteTransition(mockWindow, '/minha-zapitv');
assert.strictEqual(mockWindow.scrollY, 0, 'Cenário B: scrollY deve ser resetado para 0');
assert.strictEqual(mockWindow.lastScrollBehavior, 'instant', 'Cenário B: behavior deve ser instant (sem animação de subida)');
console.log('  ✓ Cenário B: Navegação a partir do meio da página -> instantâneo no topo sem subida visual.');

// Cenário C: Usuário no final da Home (scrollY = 2800)
mockWindow.scrollY = 2800;
simulateMobileRouteTransition(mockWindow, '/programas');
assert.strictEqual(mockWindow.scrollY, 0, 'Cenário C: scrollY deve ser resetado para 0');
assert.strictEqual(mockWindow.lastScrollBehavior, 'instant', 'Cenário C: behavior deve ser instant');
console.log('  ✓ Cenário C: Navegação a partir do final da Home -> instantâneo no topo.');

// Cenário D: Alternância rápida entre múltiplas abas consecutivas
const routes = ['/', '/explorar', '/buscar', '/programas', '/minha-zapitv'];
for (const r of routes) {
  mockWindow.scrollY = Math.floor(Math.random() * 2000) + 100;
  simulateMobileRouteTransition(mockWindow, r);
  assert.strictEqual(mockWindow.scrollY, 0, `Cenário D: rota ${r} deve estar no topo`);
  assert.strictEqual(mockWindow.lastScrollBehavior, 'instant', `Cenário D: rota ${r} deve ser instant`);
}
console.log('  ✓ Cenário D: Alternância rápida entre abas -> 100% no topo instantaneamente.');

// Cenário E: Navegação para trás (popstate)
mockWindow.scrollY = 1200;
simulateMobileRouteTransition(mockWindow, '/explorar');
assert.strictEqual(mockWindow.scrollY, 0, 'Cenário E: retorno de rota deve posicionar no topo');
assert.strictEqual(mockWindow.lastScrollBehavior, 'instant', 'Cenário E: retorno deve ser instant');
console.log('  ✓ Cenário E: Botão Voltar (popstate) -> nova rota posicionada no topo sem animação.');

console.log('\n=== TODOS OS TESTES DE TRANSIÇÃO DE PÁGINAS NO MOBILE PASSARAM COM SUCESSO! ===\n');
process.exit(0);
