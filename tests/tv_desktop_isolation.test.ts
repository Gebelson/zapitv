import fs from 'fs';
import path from 'path';
import { tvModeService } from '../src/core/tv/tvModeService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runDesktopIsolationTests() {
  console.log('\n--- Auditoria de Isolamento Rigoroso entre Modo TV e Desktop/Mobile ---');

  // Teste 1: ContentCard.tsx é 100% desktop/mobile (sem useTvFocusable nem contorno ciano)
  const contentCardPath = path.resolve(process.cwd(), 'components/ContentCard.tsx');
  assert(fs.existsSync(contentCardPath), 'ContentCard.tsx deve existir');
  const contentCardCode = fs.readFileSync(contentCardPath, 'utf8');

  assert(
    !contentCardCode.includes('useTvFocusable'),
    'ContentCard.tsx NÃO pode importar ou usar useTvFocusable'
  );
  assert(
    !contentCardCode.includes('border-cyan-400'),
    'ContentCard.tsx NÃO pode conter classes de contorno ciano da TV'
  );
  assert(
    !contentCardCode.includes('tv-focused'),
    'ContentCard.tsx NÃO pode conter a classe tv-focused'
  );
  assert(
    !contentCardCode.includes('data-tv-focused'),
    'ContentCard.tsx NÃO pode conter o atributo data-tv-focused'
  );
  assert(
    contentCardCode.includes('group-hover/card:opacity-100') && contentCardCode.includes('hover:scale-105'),
    'ContentCard.tsx deve preservar integralmente os efeitos de hover originais do desktop'
  );
  console.log('✓ Teste 1: ContentCard desktop/mobile completamente limpo de artefatos da TV');

  // Teste 2: Hero.tsx e Sidebar.tsx não usam spatial navigation na versão desktop
  const heroPath = path.resolve(process.cwd(), 'components/Hero.tsx');
  const heroCode = fs.readFileSync(heroPath, 'utf8');
  assert(
    !heroCode.includes('useTvFocusable') && !heroCode.includes('HeroActionButton'),
    'Hero.tsx desktop não deve conter useTvFocusable nem HeroActionButton'
  );

  const sidebarPath = path.resolve(process.cwd(), 'components/Sidebar.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  assert(
    !sidebarCode.includes('useTvFocusable') && !sidebarCode.includes('SidebarMenuItem'),
    'Sidebar.tsx desktop não deve conter useTvFocusable nem SidebarMenuItem'
  );
  console.log('✓ Teste 2: Hero e Sidebar desktop preservados sem registro de foco espacial');

  // Teste 3: Encapsulamento estrito do CSS de TV em index.css
  const indexCssPath = path.resolve(process.cwd(), 'index.css');
  const cssCode = fs.readFileSync(indexCssPath, 'utf8');
  
  assert(
    !cssCode.match(/^\.tv-focused\b/m),
    'index.css NÃO pode ter seletor global solto .tv-focused no início de linha'
  );
  assert(
    cssCode.includes('.zapi-tv-root .tv-focused') || cssCode.includes('.zapi-tv-root [data-tv-focused="true"]'),
    'index.css deve encapsular as regras de foco de TV exclusivamente dentro de .zapi-tv-root'
  );
  console.log('✓ Teste 3: Estilos de foco da TV estritamente isolados sob o seletor .zapi-tv-root');

  // Teste 4: tvModeService.isTvMode() é estritamente falso fora de rotas /tv ou ?tv=1
  // Simula ambiente sem /tv
  (global as any).window = {
    location: {
      pathname: '/',
      search: ''
    }
  };
  assert(
    tvModeService.isTvMode() === false,
    'tvModeService.isTvMode() deve ser false na rota raiz /'
  );

  (global as any).window.location.pathname = '/filmes';
  assert(
    tvModeService.isTvMode() === false,
    'tvModeService.isTvMode() deve ser false na rota /filmes'
  );

  // Simula rota /tv
  (global as any).window.location.pathname = '/tv';
  assert(
    tvModeService.isTvMode() === true,
    'tvModeService.isTvMode() deve ser true na rota /tv'
  );
  console.log('✓ Teste 4: tvModeService ativado exclusivamente na rota /tv ou com parâmetro explícito');

  // Teste 5: App.tsx não inicializa spatial navigation na rota desktop
  const appPath = path.resolve(process.cwd(), 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf8');
  assert(
    !appCode.includes('tvNavigationManager.init()'),
    'App.tsx desktop não deve chamar tvNavigationManager.init()'
  );
  assert(
    appCode.includes("document.body.classList.remove('tv-mode')"),
    'App.tsx deve garantir a remoção de tv-mode ao navegar fora de /tv'
  );
  console.log('✓ Teste 5: App.tsx desktop protegido contra inicialização indesejada da navegação de TV');

  // Teste 6: TvApp.tsx possui a classe raiz .zapi-tv-root e faz cleanup
  const tvAppPath = path.resolve(process.cwd(), 'src/pages/tv/TvApp.tsx');
  const tvAppCode = fs.readFileSync(tvAppPath, 'utf8');
  assert(
    tvAppCode.includes('zapi-tv-root'),
    'TvApp.tsx deve declarar a classe raiz zapi-tv-root no seu elemento principal'
  );
  assert(
    tvAppCode.includes("document.body.classList.remove('tv-mode')"),
    'TvApp.tsx deve remover a classe tv-mode do body ao desmontar'
  );
  assert(
    tvAppCode.includes('tvNavigationManager.pause()'),
    'TvApp.tsx deve pausar a navegação de TV ao desmontar'
  );
  console.log('✓ Teste 6: TvApp devidamente isolado com container .zapi-tv-root e cleanup completo');

  console.log('\nTodos os 6 testes de isolamento TV vs Desktop passaram com 100% de sucesso!\n');
}

runDesktopIsolationTests().catch(err => {
  console.error('\n❌ Falha nos testes de isolamento TV vs Desktop:', err);
  process.exit(1);
});
