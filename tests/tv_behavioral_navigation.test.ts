import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium, type Browser } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UA_FIRE_TV_SILK = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/NS6273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/95.3.3 like Chrome/95.0.4638.74 Safari/537.36';
const UA_SMART_TV_1080P = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';

const mockUser = {
  id: 'tv-user-behave-test',
  name: 'Usuário Teste TV',
  email: 'tv-test@zapitv.test',
  role: 'user',
  status: 'Ativo',
  plan: 'Premium'
};

const mockProfile = {
  id: 'tv-profile-behave-test',
  userId: 'tv-user-behave-test',
  name: 'Principal',
  avatar: 'avatar_1',
  isChild: false,
  isDefault: true
};

async function run() {
  console.log('=== TEST SUITE: ZapiTV | TV Behavioral Spatial Navigation (Playwright) ===\n');

  let simulatedSessionActive = false;

  const repoRoot = path.resolve(__dirname, '..');
  // Inicia servidor Vite com API simulada exclusivamente no servidor de testes
  const server = await createServer({
    root: repoRoot,
    configFile: path.resolve(repoRoot, 'vite.config.ts'),
    appType: 'spa',
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error',
    plugins: [
      {
        name: 'test-mock-api-middleware',
        configureServer(viteDev) {
          viteDev.middlewares.use((req, res, next) => {
            const rawUrl = req.originalUrl || req.url || '';
            const pathname = new URL(rawUrl, 'http://127.0.0.1').pathname;
            if (!pathname.startsWith('/api/')) {
              return next();
            }

            res.setHeader('Content-Type', 'application/json');

            // 1. Rota de política global
            if (pathname.startsWith('/api/auth/policy')) {
              res.statusCode = 200;
              return res.end(JSON.stringify({ mandatoryAuth: true, policyVersion: 1 }));
            }

            // 2. Rota de checagem de sessão
            if (pathname.startsWith('/api/auth/me')) {
              const cookieHeader = req.headers.cookie || '';
              const hasCookie = cookieHeader.includes('zapitv_session=mock-tv-token');
              if (simulatedSessionActive || hasCookie) {
                res.statusCode = 200;
                return res.end(JSON.stringify({
                  authenticated: true,
                  user: mockUser,
                  activeProfile: mockProfile,
                  mandatoryAuth: true,
                  policyVersion: 1
                }));
              } else {
                res.statusCode = 401;
                return res.end(JSON.stringify({
                  authenticated: false,
                  user: null,
                  activeProfile: null,
                  mandatoryAuth: true,
                  policyVersion: 1
                }));
              }
            }

            // 3. Rota de login
            if (pathname.startsWith('/api/auth/login')) {
              simulatedSessionActive = true;
              res.setHeader('Set-Cookie', 'zapitv_session=mock-tv-token; Path=/; HttpOnly; SameSite=Lax');
              res.statusCode = 200;
              return res.end(JSON.stringify({
                authenticated: true,
                user: mockUser,
                activeProfile: mockProfile
              }));
            }

            // 4. Rota de listagem de perfis
            if (pathname.startsWith('/api/profiles')) {
              res.statusCode = 200;
              return res.end(JSON.stringify({
                profiles: [mockProfile],
                activeProfileId: mockProfile.id
              }));
            }

            // 5. Rota de device-auth para tela de ativação da TV
            if (pathname.startsWith('/api/device-auth/challenge')) {
              res.statusCode = 200;
              return res.end(JSON.stringify({
                deviceCode: 'mock-device-code-1234',
                userCode: 'ABCD-1234',
                verificationUri: 'http://127.0.0.1/tv/ativar',
                expiresIn: 300,
                interval: 5
              }));
            }
            if (pathname.startsWith('/api/device-auth/poll')) {
              res.statusCode = 200;
              return res.end(JSON.stringify({
                status: simulatedSessionActive ? 'approved' : 'pending',
                user: simulatedSessionActive ? mockUser : null
              }));
            }

            // 6. Configuração de provedores e memória de fontes
            if (pathname.startsWith('/api/providers/config')) {
              res.statusCode = 200;
              return res.end(JSON.stringify({ providers: [] }));
            }
            if (pathname.startsWith('/api/db/source-memory')) {
              res.statusCode = 200;
              return res.end(JSON.stringify({ sources: [] }));
            }

            // Fallback defensivo para outras rotas /api/db/
            if (pathname.startsWith('/api/db/')) {
              res.statusCode = 200;
              return res.end(JSON.stringify({ value: null }));
            }

            res.statusCode = 200;
            res.end(JSON.stringify({}));
          });
        }
      }
    ]
  });

  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`✓ Servidor Vite de testes com API integrada ativo em: ${baseUrl}\n`);

  // Lança o Chromium estritamente sem flags que mascaram segurança
  const browser: Browser = await chromium.launch({
    headless: true
  });

  try {
    // =========================================================================
    // PARTE 1: VIEWPORT 960x540 (Fire TV Stick / Silk Browser)
    // =========================================================================
    console.log('--- [1] Testando Viewport 960x540 DPR 2.0 (Silk Browser / Fire TV Stick) ---');
    const fireContext = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 2.0,
      userAgent: UA_FIRE_TV_SILK,
      isMobile: false,
      hasTouch: false
    });

    const firePage = await fireContext.newPage();

    // 1.1 Login e carregamento assíncrono do perfil
    console.log('1.1 Testando login e carregamento assíncrono de perfil na tela de ativação da TV...');
    await firePage.goto(`${baseUrl}/tv`, { waitUntil: 'domcontentloaded' });
    
    // Aguarda a resolução assíncrona da checagem de sessão e montagem da tela de ativação
    await firePage.waitForSelector('[role="dialog"][aria-label*="Ativação"], [data-focus-key="TV_ACTIVATION_SCREEN_ROOT"]', { timeout: 15000 });
    const isActivationScreenMounted = await firePage.locator('[role="dialog"][aria-label*="Ativação"], [data-focus-key="TV_ACTIVATION_SCREEN_ROOT"]').count() > 0;
    assert.ok(isActivationScreenMounted, 'Tela de ativação deve ser exibida para usuário sem sessão');

    // Executa autenticação simulada chamando login
    await firePage.evaluate(async () => {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'tv-test@zapitv.test', password: 'senha' })
      });
    });

    // Recarrega /tv com sessão ativa estabelecida
    await firePage.goto(`${baseUrl}/tv`, { waitUntil: 'domcontentloaded' });
    await firePage.waitForTimeout(1500);

    // 1.2 Estabelecimento do foco inicial sem cliques manuais
    console.log('1.2 Validando estabelecimento determinístico do foco inicial...');
    const initialFocusKey = await firePage.evaluate(() => {
      const el = document.querySelector('[data-tv-focused="true"]');
      return el ? el.getAttribute('data-focus-key') : null;
    });
    console.log(`  -> Foco inicial detectado: "${initialFocusKey}"`);
    assert.equal(initialFocusKey, 'tv-hero-play', 'Foco inicial automático deve ser tv-hero-play');

    // 1.3 Ausência de foco preso em elementos invisíveis
    const isHeroPlayVisible = await firePage.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-focus-key="tv-hero-play"]');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
    assert.ok(isHeroPlayVisible, 'tv-hero-play deve estar plenamente visível e navegável');

    // 1.4 Navegação direcional com ArrowRight, ArrowLeft, ArrowUp e ArrowDown
    console.log('1.4 Testando navegação direcional D-pad (Right, Left, Up, Down)...');
    
    // ArrowRight: de tv-hero-play para tv-hero-details
    await firePage.keyboard.press('ArrowRight');
    await firePage.waitForTimeout(200);
    const focusedAfterRight = await firePage.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Após ArrowRight: "${focusedAfterRight}"`);
    assert.equal(focusedAfterRight, 'tv-hero-details', 'ArrowRight deve mover o foco para tv-hero-details');

    // ArrowLeft: volta para tv-hero-play
    await firePage.keyboard.press('ArrowLeft');
    await firePage.waitForTimeout(200);
    const focusedAfterLeft = await firePage.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Após ArrowLeft: "${focusedAfterLeft}"`);
    assert.equal(focusedAfterLeft, 'tv-hero-play', 'ArrowLeft deve mover o foco de volta para tv-hero-play');

    // ArrowUp: sobe para o cabeçalho (tv-nav-home)
    await firePage.keyboard.press('ArrowUp');
    await firePage.waitForTimeout(200);
    const focusedAfterUp = await firePage.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Após ArrowUp: "${focusedAfterUp}"`);
    assert.equal(focusedAfterUp, 'tv-nav-home', 'ArrowUp deve mover o foco para tv-nav-home no cabeçalho');

    // ArrowDown: desce de volta para tv-hero-play
    await firePage.keyboard.press('ArrowDown');
    await firePage.waitForTimeout(200);
    const focusedAfterDownToHero = await firePage.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Após ArrowDown: "${focusedAfterDownToHero}"`);
    assert.equal(focusedAfterDownToHero, 'tv-hero-play', 'ArrowDown deve retornar o foco para tv-hero-play');

    // ArrowDown novamente: desce para o primeiro carrossel de conteúdo
    await firePage.keyboard.press('ArrowDown');
    await firePage.waitForTimeout(300);
    const focusedInCarousel = await firePage.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Após segundo ArrowDown (carrossel): "${focusedInCarousel}"`);
    assert.ok(
      focusedInCarousel && (focusedInCarousel.startsWith('tv-card-') || focusedInCarousel.includes('card') || focusedInCarousel.startsWith('row-')),
      `Segundo ArrowDown deve mover o foco para um carrossel ou card, obtido: "${focusedInCarousel}"`
    );

    // =========================================================================
    // PARTE 2: VIEWPORT 1920x1080 (Smart TV Full HD), Detalhes e Botão Voltar
    // =========================================================================
    console.log('\n--- [2] Testando Viewport 1920x1080 (Smart TV Full HD) ---');
    const tv1080Context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: UA_SMART_TV_1080P,
      isMobile: false,
      hasTouch: false
    });

    // Injeta o cookie de sessão para acesso direto
    await tv1080Context.addCookies([{
      name: 'zapitv_session',
      value: 'mock-tv-token',
      domain: '127.0.0.1',
      path: '/'
    }]);

    const tv1080Page = await tv1080Context.newPage();
    await tv1080Page.goto(`${baseUrl}/tv`, { waitUntil: 'domcontentloaded' });
    await tv1080Page.waitForTimeout(1500);

    // 2.1 Confirma foco inicial em 1080p
    const focus1080 = await tv1080Page.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Foco inicial em 1080p: "${focus1080}"`);
    assert.equal(focus1080, 'tv-hero-play', 'Foco inicial em 1080p deve ser tv-hero-play');

    // Move para tv-hero-details
    await tv1080Page.keyboard.press('ArrowRight');
    await tv1080Page.waitForTimeout(200);

    // 2.2 Abertura de detalhes com Enter
    console.log('2.2 Testando abertura do modal de detalhes cinematográfico com Enter...');
    await tv1080Page.keyboard.press('Enter');
    await tv1080Page.waitForTimeout(500);

    const isModalOpen = await tv1080Page.evaluate(() => {
      return document.querySelector('[data-testid="tv-details-modal"]') !== null ||
        document.querySelector('[data-focus-key="tv-details-play"]') !== null;
    });
    console.log(`  -> Modal de detalhes aberto: ${isModalOpen}`);
    assert.ok(isModalOpen, 'Pressionar Enter em tv-hero-details deve abrir o modal de detalhes');

    const focusInsideModal = await tv1080Page.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Foco interno no modal: "${focusInsideModal}"`);
    assert.ok(
      focusInsideModal && (focusInsideModal === 'tv-details-play' || focusInsideModal === 'tv-details-list'),
      'O foco deve estar no botão de ação do modal de detalhes'
    );

    // 2.3 Fechamento do modal com Escape/Back e restauração de foco
    console.log('2.3 Testando fechamento do modal com Escape (Back) e restauração do foco anterior...');
    await tv1080Page.keyboard.press('Escape');
    await tv1080Page.waitForTimeout(300);

    const isModalDismissed = await tv1080Page.evaluate(() => {
      return document.querySelector('[data-focus-key="tv-details-play"]') === null;
    });
    assert.ok(isModalDismissed, 'Pressionar Escape deve fechar o modal de detalhes');

    const focusAfterModalClose = await tv1080Page.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Foco restaurado após fechamento do modal: "${focusAfterModalClose}"`);
    assert.equal(focusAfterModalClose, 'tv-hero-details', 'Foco deve ser restaurado para o elemento pré-modal (tv-hero-details)');

    // 2.4 Navegação entre páginas sem perda de foco
    console.log('2.4 Testando transição entre abas (Início -> Filmes) sem perda de foco...');
    // Sobe para o cabeçalho
    await tv1080Page.keyboard.press('ArrowUp');
    await tv1080Page.waitForTimeout(200);

    const focusedInHeader = await tv1080Page.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    assert.equal(focusedInHeader, 'tv-nav-home', 'Deve focar no link Início do cabeçalho');

    // Navega para a aba Filmes com ArrowRight
    await tv1080Page.keyboard.press('ArrowRight');
    await tv1080Page.waitForTimeout(200);

    const focusedMoviesTab = await tv1080Page.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    assert.equal(focusedMoviesTab, 'tv-nav-movies', 'ArrowRight deve selecionar a aba Filmes');

    // Desce para o catálogo de Filmes com ArrowDown
    await tv1080Page.keyboard.press('ArrowDown');
    await tv1080Page.waitForTimeout(300);

    const focusedInMoviesCatalog = await tv1080Page.evaluate(() => {
      return document.querySelector('[data-tv-focused="true"]')?.getAttribute('data-focus-key');
    });
    console.log(`  -> Foco no catálogo de Filmes: "${focusedInMoviesCatalog}"`);
    assert.ok(
      focusedInMoviesCatalog && focusedInMoviesCatalog !== 'BODY' && focusedInMoviesCatalog !== 'null',
      'Foco deve se manter ativo no catálogo da nova aba sem se perder no BODY'
    );

    console.log('\n========================================================================');
    console.log('✓ TODOS OS 9 CENÁRIOS COMPORTAMENTAIS DE TV FORAM APROVADOS COM SUCESSO!');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
    await server.close();
  }
}

run().catch(err => {
  console.error('❌ ERRO NO TESTE COMPORTAMENTAL DE TV:', err);
  process.exit(1);
});
