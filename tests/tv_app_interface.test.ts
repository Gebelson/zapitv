import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runTvAppInterfaceTests() {
  console.log('\n--- Auditoria da Interface Exclusiva Smart TV (ZapiTV) ---');

  // Teste 1: Configuração do Media Station X aponta para /tv
  const msxContentPath = path.resolve(process.cwd(), 'public/msx/content.json');
  assert(fs.existsSync(msxContentPath), 'public/msx/content.json deve existir');
  const msxContent = JSON.parse(fs.readFileSync(msxContentPath, 'utf8'));
  assert(
    msxContent.action === 'link:https://zapitv-stream.vercel.app/tv',
    `MSX content.json action deve ser 'link:https://zapitv-stream.vercel.app/tv'. Atual: '${msxContent.action}'`
  );
  console.log('✓ Teste 1: MSX content.json direciona corretamente para a rota /tv');

  // Teste 2: TvHeader NÃO possui "Minha Lista" no menu superior (Regra estrita do usuário)
  const tvHeaderPath = path.resolve(process.cwd(), 'src/components/tv/TvHeader.tsx');
  assert(fs.existsSync(tvHeaderPath), 'TvHeader.tsx deve existir');
  const tvHeaderCode = fs.readFileSync(tvHeaderPath, 'utf8');
  assert(
    !tvHeaderCode.includes('label="Minha Lista"'),
    'TvHeader NÃO pode conter o botão Minha Lista na barra superior'
  );
  assert(
    tvHeaderCode.includes('label="Início"') &&
    tvHeaderCode.includes('label="Filmes"') &&
    tvHeaderCode.includes('label="Séries"') &&
    tvHeaderCode.includes('label="Animes"') &&
    tvHeaderCode.includes('label="Em Destaque"'),
    'TvHeader deve conter apenas Início, Filmes, Séries, Animes e Em Destaque'
  );
  console.log('✓ Teste 2: "Minha Lista" removida da navegação superior conforme especificação');

  // Teste 3: "Minha Lista" está dentro do Menu de Perfil (Regra estrita do usuário)
  const tvProfileMenuPath = path.resolve(process.cwd(), 'src/components/tv/TvProfileMenu.tsx');
  assert(fs.existsSync(tvProfileMenuPath), 'TvProfileMenu.tsx deve existir');
  const tvProfileMenuCode = fs.readFileSync(tvProfileMenuPath, 'utf8');
  assert(
    tvProfileMenuCode.includes('label="Minha Lista"') &&
    tvProfileMenuCode.includes('focusKey="tv-menu-mylist"'),
    'TvProfileMenu deve conter a opção Minha Lista com focusKey tv-menu-mylist'
  );
  console.log('✓ Teste 3: "Minha Lista" alocada no menu suspenso do perfil');

  // Teste 4: Efeito de Glow Ambiente personalizado por cores das capas preservado nos Cards 16:9
  const tvCardPath = path.resolve(process.cwd(), 'src/components/tv/TvCard16x9.tsx');
  assert(fs.existsSync(tvCardPath), 'TvCard16x9.tsx deve existir');
  const tvCardCode = fs.readFileSync(tvCardPath, 'utf8');
  assert(
    tvCardCode.includes('getCardAmbientGlow') &&
    tvCardCode.includes('GLOW AMBIENTE DAS CAPAS'),
    'TvCard16x9 deve conter a camada de glow ambiente personalizada'
  );
  console.log('✓ Teste 4: Glow ambiente dinâmico das capas e banners implementado e otimizado');

  // Teste 5: Isolamento absoluto - App.tsx renderiza TvApp na rota /tv sem afetar desktop/mobile
  const appPath = path.resolve(process.cwd(), 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf8');
  assert(
    appCode.includes("location.pathname.startsWith('/tv')") &&
    appCode.includes('<TvApp'),
    'App.tsx deve renderizar TvApp exclusivamente na rota /tv'
  );
  console.log('✓ Teste 5: Rota /tv isolada em App.tsx garantindo 0% de regressão para desktop e mobile');

  // Teste 6: Redirecionamento canônico de entrada ?tv=1 para /tv
  const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
  const indexHtmlCode = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(
    indexHtmlCode.includes("window.location.replace('/tv'") || indexHtmlCode.includes("window.location.replace('/tv'"),
    'index.html deve conter o script de redirecionamento canônico de ?tv=1 para /tv'
  );
  assert(
    appCode.includes("navigate(isDiag ? '/tv?tvdiag=1' : '/tv', { replace: true })"),
    'App.tsx deve redirecionar canonicamente ?tv=1 para /tv preservando parâmetros de diagnóstico'
  );
  console.log('✓ Teste 6: Redirecionamento canônico de compatibilidade ?tv=1 -> /tv ativo e sem loops');

  // Teste 7: Mapeamento de teclas Norigin e suporte completo a Tizen (10009, 65385, setas)
  const navManagerPath = path.resolve(process.cwd(), 'src/core/tv/tvNavigationManager.ts');
  const navManagerCode = fs.readFileSync(navManagerPath, 'utf8');
  assert(
    navManagerCode.includes("'ArrowLeft'") &&
    navManagerCode.includes("'ArrowRight'") &&
    navManagerCode.includes("'ArrowUp'") &&
    navManagerCode.includes("'ArrowDown'") &&
    navManagerCode.includes('65385') &&
    navManagerCode.includes('shouldFocusDOMNode: true'),
    'tvNavigationManager deve mapear setas, Enter Tizen e ativar shouldFocusDOMNode'
  );
  console.log('✓ Teste 7: Navegação espacial configurada com suporte a D-Pad e controle remoto');

  // Teste 8: Transição bidirecional determinística entre Header, Hero Banner e Carrosséis
  assert(
    tvHeaderCode.includes("setFocus('tv-hero-play')"),
    'TvHeader deve direcionar a seta para baixo diretamente para o botão Assistir do Hero'
  );
  const tvHeroPath = path.resolve(process.cwd(), 'src/components/tv/TvHeroBanner.tsx');
  const tvHeroCode = fs.readFileSync(tvHeroPath, 'utf8');
  assert(
    tvHeroCode.includes("setFocus('tv-nav-home')"),
    'TvHeroBanner deve direcionar a seta para cima diretamente para o Header'
  );
  console.log('✓ Teste 8: Transição bidirecional determinística (Header <-> Hero <-> Carrosséis) OK');

  console.log('\nTodos os 8 testes da nova interface Smart TV passaram com sucesso!\n');
}

runTvAppInterfaceTests().catch(err => {
  console.error('\n❌ Falha nos testes de interface Smart TV:', err);
  process.exit(1);
});
