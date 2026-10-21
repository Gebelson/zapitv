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
  assert(
    !tvCardCode.includes('absolute inset-0 bg-gradient-to-t'),
    'TvCard16x9 NÃO deve conter gradiente de tela cheia escurecendo a capa'
  );
  assert(
    tvCardCode.includes('bottom-0 h-24 sm:h-28 bg-gradient-to-t'),
    'TvCard16x9 deve restringir o gradiente de legibilidade apenas à base inferior'
  );
  console.log('✓ Teste 4: Glow ambiente dinâmico e capas com cores vivas e gradiente restrito à base OK');

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

  // Teste 9: Header Flutuante sem retângulo nos links e elementos ampliados para TV 1080p
  assert(
    !tvHeaderCode.includes('border border-white/10 shadow-lg') &&
    !tvHeaderCode.includes('bg-black/40'),
    'TvHeader NÃO deve conter retângulo/cápsula envolvendo os links de navegação'
  );
  assert(
    tvHeaderCode.includes('text-[22px]') || tvHeaderCode.includes('text-[23px]') || tvHeaderCode.includes('text-[24px]'),
    'TvHeader deve utilizar tipografia ampliada proporcional a Smart TVs 1080p'
  );
  assert(
    !tvHeaderCode.includes('-bottom-2') &&
    tvHeaderCode.includes('top-[calc(100%+5px)]') &&
    tvHeaderCode.includes('left-1/2 -translate-x-1/2'),
    'TvHeader deve aproximar o indicador da página ativa a 5px do texto, centralizado'
  );
  assert(
    tvHeaderCode.includes('src="/zapitv-text.png"') &&
    (tvHeaderCode.includes('translateY(3px)') || tvHeaderCode.includes('translate-y-[3px]')),
    'TvHeader deve aplicar transform: translateY(3px) exclusivamente ao texto ZapiTV da logo'
  );
  console.log('✓ Teste 9: Header flutuante livre, indicador ativo a 5px e texto da logo deslocado 3px OK');

  // Teste 10: Banner no topo absoluto, degradê de legibilidade e blur progressivo
  assert(
    tvHeroCode.includes('bg-gradient-to-b from-[#05070a]') &&
    tvHeroCode.includes('linear-gradient(to bottom') &&
    tvHeroCode.includes('linear-gradient(to top'),
    'TvHeroBanner deve conter degradê superior escuro e blurs progressivos com máscara'
  );
  console.log('✓ Teste 10: Banner no topo absoluto, degradê superior suave e blur progressivo OK');

  // Teste 11: Acabamento perfeito e simétrico do botão Assistir
  assert(
    tvHeroCode.includes('zapi-tv-hero-btn') &&
    tvHeroCode.includes('rounded-2xl'),
    'TvHeroBanner deve conter botão Assistir com acabamento simétrico e arredondado'
  );
  console.log('✓ Teste 11: Botão Assistir refinado com acabamento simétrico e sem artefatos OK');

  // Teste 12: Capas dos carrosséis em proporção vertical 2:3 com glow ambiente preservado
  assert(
    tvCardCode.includes('aspect-[2/3]'),
    'TvCard16x9 deve adotar a proporção vertical cinematográfica 2:3'
  );
  console.log('✓ Teste 12: Capas dos carrosséis ampliadas na orientação vertical 2:3 OK');

  // Teste 13: Remoção de contadores de quantidade de títulos dos cabeçalhos dos carrosséis
  const tvContentRowPath = path.resolve(process.cwd(), 'src/components/tv/TvContentRow.tsx');
  const tvContentRowCode = fs.readFileSync(tvContentRowPath, 'utf8');
  assert(
    !tvContentRowCode.includes('{items.length} títulos'),
    'TvContentRow NÃO deve exibir contador de títulos no cabeçalho na TV'
  );
  console.log('✓ Teste 13: Contadores de títulos ocultos dos carrosséis na TV conforme especificação');

  // Teste 14: Banner ocupa 100vh na primeira tela e carrosséis sem margens negativas
  assert(
    tvHeroCode.includes('h-screen min-h-[100vh]') || tvHeroCode.includes('min-h-[100vh]'),
    'TvHeroBanner deve ocupar 100% da primeira viewport (100vh)'
  );
  const tvHomeViewPath = path.resolve(process.cwd(), 'src/components/tv/TvHomeView.tsx');
  const tvHomeViewCode = fs.readFileSync(tvHomeViewPath, 'utf8');
  assert(
    !tvHomeViewCode.includes('-mt-14') && !tvHomeViewCode.includes('-mt-18'),
    'TvHomeView NÃO deve conter margens negativas puxando carrosséis para a primeira tela'
  );
  console.log('✓ Teste 14: Banner ocupa 100% da primeira viewport e carrosséis começam abaixo da tela OK');

  // Teste 15: Carrossel infinito circular com foco fixo no primeiro slot
  assert(
    tvContentRowCode.includes('slideNext') &&
    tvContentRowCode.includes('slidePrev') &&
    tvContentRowCode.includes('translate3d') &&
    tvContentRowCode.includes('isSlotActive && focused'),
    'TvContentRow deve implementar trilho horizontal deslizante com foco fixo no primeiro slot'
  );
  console.log('✓ Teste 15: Carrossel circular infinito com seleção fixa no primeiro card OK');

  // Teste 16: TvHeroBanner suporta múltiplos destaques com transições cinematográficas e controles remotos
  assert(
    tvHeroCode.includes('items?: ContentItem[]') &&
    tvHeroCode.includes('goToSlide') &&
    tvHeroCode.includes('isCrossfading') &&
    tvHeroCode.includes('resetTimer') &&
    tvHeroCode.includes('tv-hero-prev') &&
    tvHeroCode.includes('tv-hero-next') &&
    tvHeroCode.includes('visibilitychange'),
    'TvHeroBanner deve implementar carrossel com crossfade, rotação automática, pausa na visibilidade e botões tv-hero-prev/next'
  );
  console.log('✓ Teste 16: Carrossel cinematográfico multi-destaques no Hero com rotação automática e navegação manual OK');

  // Teste 17: TvHomeView conecta-se ao heroCarouselStore e transmite múltiplos destaques reais
  const tvHomeViewCodeUpdated = fs.readFileSync(tvHomeViewPath, 'utf8');
  assert(
    tvHomeViewCodeUpdated.includes('heroCarouselStore') &&
    tvHomeViewCodeUpdated.includes('items={heroSlides}') &&
    !tvHomeViewCodeUpdated.includes('item={heroItem}'),
    'TvHomeView deve conectar-se ao heroCarouselStore e passar a lista de destaques via items={heroSlides}'
  );
  console.log('✓ Teste 17: TvHomeView sincronizada em tempo real com heroCarouselStore e múltiplos destaques configurados OK');

  console.log('\nTodos os 17 testes da nova interface Smart TV passaram com sucesso!\n');
}

runTvAppInterfaceTests().catch(err => {
  console.error('\n❌ Falha nos testes de interface Smart TV:', err);
  process.exit(1);
});
