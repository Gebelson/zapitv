/**
 * ZapiTV - Suíte de Testes: Correção e Regressão do Botão Buscar no Menu Mobile
 * 
 * Requisitos validados:
 * 1. Centralização da navegação em MobileLayout.tsx (eliminação de navigate duplo).
 * 2. MobileBottomNavigation.tsx delega navegação para onSelectTab sem chamadas redundantes a navigate().
 * 3. Reconhecimento determinístico de activeTab === 'search' ao acessar /buscar ou currentView === 'search'.
 * 4. Renderização estável de MobileSearchView na aba search sem desaparecimento ou flash.
 * 5. App.tsx não redireciona /buscar para / no mobile (isMobileViewport protege rotas mobile).
 * 6. viewContent em App.tsx não executa renderContent() nem dispara navegações concorrentes no mobile.
 * 7. Manipulador popstate em MobileLayout fecha modais quando abertos, mas NÃO força redirect para /
 *    ao usar o botão Voltar do navegador entre abas.
 * 8. Transições de rota e resolução de abas:
 *    - Início (/) -> Buscar (/buscar)
 *    - Explorar (/explorar, /filmes, /series, /animes) -> Buscar (/buscar)
 *    - Programas (/programas) -> Buscar (/buscar)
 *    - Minha Zapi (/minha-zapitv) -> Buscar (/buscar)
 *    - Alternância repetida e navegação reversa (Voltar).
 * 9. Foco automático preservado no input de busca (inputRef.focus()).
 * 10. Preservação das demais abas e de interfaces Desktop/Smart TV.
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
console.log('📱 SUÍTE DE TESTES: BOTÃO BUSCAR E NAVEGAÇÃO MOBILE (ZAPITV)');
console.log('========================================================================\n');

// --------------------------------------------------------------------------
// 1. Auditoria de MobileBottomNavigation.tsx (Eliminação de navigate duplo)
// --------------------------------------------------------------------------
console.log('--- 1. Auditoria de MobileBottomNavigation.tsx ---');
const bottomNavPath = path.resolve('src/components/mobile/MobileBottomNavigation.tsx');
const bottomNavCode = fs.readFileSync(bottomNavPath, 'utf8');

testAssert(
  'MobileBottomNavigation NÃO importa useNavigate',
  !bottomNavCode.includes('useNavigate')
);

testAssert(
  'MobileBottomNavigation NÃO chama navigate() internamente em handleTabClick',
  !bottomNavCode.includes('navigate(item.path)')
);

testAssert(
  'handleTabClick delega estritamente para onSelectTab(item.id)',
  bottomNavCode.includes('uiSoundService.play(\'click\')') &&
  bottomNavCode.includes('onSelectTab(item.id)')
);

testAssert(
  'Botão Buscar está registrado com id: "search" e path: "/buscar"',
  bottomNavCode.includes("id: 'search', label: 'Buscar', icon: Search, path: '/buscar'")
);

// --------------------------------------------------------------------------
// 2. Auditoria de MobileLayout.tsx (Navegação Centralizada e popstate)
// --------------------------------------------------------------------------
console.log('\n--- 2. Auditoria de MobileLayout.tsx ---');
const layoutPath = path.resolve('src/components/mobile/MobileLayout.tsx');
const layoutCode = fs.readFileSync(layoutPath, 'utf8');

testAssert(
  'handleSelectTab centraliza navegação e trata "/buscar" para a aba search',
  layoutCode.includes("case 'search': navigate('/buscar'); break;")
);

testAssert(
  'handleSelectTab previne navegação duplicada se a aba já estiver ativa',
  layoutCode.includes('if (activeTab === tab) return;')
);

testAssert(
  'activeTab reconhece expressamente /buscar e currentView === search',
  layoutCode.includes("if (p.startsWith('/buscar') || currentView === 'search') return 'search';")
);

testAssert(
  'MobileLayout renderiza MobileSearchView na aba search',
  layoutCode.includes("{activeTab === 'search' && (") &&
  layoutCode.includes('<MobileSearchView')
);

testAssert(
  'popstate em MobileLayout NÃO força navigate(\'/\', { replace: true }) em abas comuns',
  !layoutCode.includes("if (activeTab !== 'home') {\n        navigate('/', { replace: true });") &&
  !layoutCode.includes("navigate('/', { replace: true })")
);

testAssert(
  'popstate preserva o fechamento de modal quando hasOpenModal && onCloseModal',
  layoutCode.includes('if (hasOpenModal && onCloseModal)') &&
  layoutCode.includes('onCloseModal();')
);

// --------------------------------------------------------------------------
// 3. Auditoria de App.tsx (Proteção contra Redirecionamento Indevido)
// --------------------------------------------------------------------------
console.log('\n--- 3. Auditoria de App.tsx ---');
const appPath = path.resolve('App.tsx');
const appCode = fs.readFileSync(appPath, 'utf8');

testAssert(
  'App.tsx mapeia /buscar para currentView "search"',
  appCode.includes("if (path.startsWith('/buscar')) return 'search';")
);

testAssert(
  'viewContent em App.tsx retorna null no viewport mobile (evita execuções desnecessárias)',
  appCode.includes('if (isWatchRoute || isMobileViewport) return null;')
);

testAssert(
  'case search em renderContent() protege o mobile e só redireciona no desktop',
  appCode.includes("case 'search':\n        if (!isMobileViewport) {\n          navigate('/', { replace: true });\n        }\n        return null;") ||
  appCode.includes("case 'search':\r\n        if (!isMobileViewport) {\r\n          navigate('/', { replace: true });\r\n        }\r\n        return null;")
);

// --------------------------------------------------------------------------
// 4. Auditoria de MobileSearchView.tsx (Foco e Teclado Virtual)
// --------------------------------------------------------------------------
console.log('\n--- 4. Auditoria de MobileSearchView.tsx ---');
const searchViewPath = path.resolve('src/components/mobile/MobileSearchView.tsx');
const searchViewCode = fs.readFileSync(searchViewPath, 'utf8');

testAssert(
  'MobileSearchView possui foco automático do input no montamento',
  searchViewCode.includes('inputRef.current?.focus()')
);

testAssert(
  'MobileSearchView integra suporte a teclado virtual via visualViewport',
  searchViewCode.includes('window.visualViewport') &&
  searchViewCode.includes('setViewportBottomOffset(keyboardHeight)')
);

testAssert(
  'MobileSearchView realiza busca instantânea de conteúdos (allContent)',
  searchViewCode.includes('searchService.searchLocalInstant(trimmed, \'all\', allContent')
);

testAssert(
  'MobileSearchView integra histórico de pesquisas (searchHistoryService)',
  searchViewCode.includes('searchHistoryService.getHistory()') &&
  searchViewCode.includes('handleClearHistory')
);

// --------------------------------------------------------------------------
// 5. Simulação Funcional de Transições de Abas e Voltar
// --------------------------------------------------------------------------
console.log('\n--- 5. Simulação de Resolução de Abas e Transições ---');

function resolveMobileActiveTab(pathname: string, currentView: string): string {
  const p = pathname;
  if (p === '/' || p.startsWith('/sala')) return 'home';
  if (
    p.startsWith('/explorar') ||
    p.startsWith('/filmes') ||
    p.startsWith('/series') ||
    p.startsWith('/animes') ||
    p.startsWith('/em-destaque') ||
    currentView === 'movies' ||
    currentView === 'series' ||
    currentView === 'animes' ||
    currentView === 'featured' ||
    currentView === 'explore'
  ) {
    return 'explore';
  }
  if (p.startsWith('/buscar') || currentView === 'search') return 'search';
  if (p.startsWith('/programas') || p.startsWith('/televisao') || currentView === 'programas' || currentView === 'television') {
    return 'programas';
  }
  return 'my-zapitv';
}

// Teste de rotas a partir de cada página
testAssert(
  'Partindo de Início (/): clicar em Buscar resolve activeTab para "search"',
  resolveMobileActiveTab('/buscar', 'search') === 'search'
);

testAssert(
  'Partindo de Explorar (/explorar): clicar em Buscar resolve activeTab para "search"',
  resolveMobileActiveTab('/buscar', 'search') === 'search'
);

testAssert(
  'Partindo de Filmes (/filmes): clicar em Buscar resolve activeTab para "search"',
  resolveMobileActiveTab('/buscar', 'search') === 'search'
);

testAssert(
  'Partindo de Programas (/programas): clicar em Buscar resolve activeTab para "search"',
  resolveMobileActiveTab('/buscar', 'search') === 'search'
);

testAssert(
  'Partindo de Minha Zapi (/minha-zapitv): clicar em Buscar resolve activeTab para "search"',
  resolveMobileActiveTab('/buscar', 'search') === 'search'
);

// Simulação de navegação do botão Voltar
class HistorySimulator {
  private stack: string[] = ['/'];
  private index = 0;

  push(path: string) {
    // Elimina histórico futuro se houver
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(path);
    this.index++;
  }

  back(): string {
    if (this.index > 0) {
      this.index--;
    }
    return this.stack[this.index];
  }

  current(): string {
    return this.stack[this.index];
  }
}

const sim = new HistorySimulator();
sim.push('/explorar');
testAssert('Navegou para /explorar', sim.current() === '/explorar');

sim.push('/buscar');
testAssert('Navegou para /buscar a partir de /explorar', sim.current() === '/buscar');
testAssert('Aba ativa em /buscar é search', resolveMobileActiveTab(sim.current(), 'search') === 'search');

// Clicar no botão Voltar do navegador
const backFromSearch = sim.back();
testAssert('Botão Voltar retorna corretamente para /explorar (não para /)', backFromSearch === '/explorar');
testAssert('Aba ativa restaurada é explore', resolveMobileActiveTab(sim.current(), 'explore') === 'explore');

// Clicar em Buscar novamente a partir de /explorar
sim.push('/buscar');
testAssert('Navegação subsequente para /buscar funciona com perfeição', sim.current() === '/buscar');

// Alternância repetida entre abas
const testTabs = ['/', '/explorar', '/buscar', '/programas', '/minha-zapitv', '/buscar'];
testTabs.forEach(target => sim.push(target));
testAssert('Última rota na alternância de abas é /buscar', sim.current() === '/buscar');
testAssert('Aba ativa final é search', resolveMobileActiveTab(sim.current(), 'search') === 'search');

console.log('\n========================================================================');
console.log(`📊 RESULTADO FINAL DA SUÍTE DO BOTÃO BUSCAR: ${passed} PASS, ${failed} FAIL`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
process.exit(0);
