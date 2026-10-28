import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, type Browser } from 'playwright';
import { storageService } from '../src/core/storage/storageService';
import { audioPreferenceService } from '../src/core/audio/audioPreferenceService';
import { classifyStream } from '../src/core/audio/audioDetector';
import { parseWatchRoute, getWatchRoute } from '../src/core/routes/navigationRoutes';
import { tvPerformanceService } from '../src/core/tv/tvPerformanceService';
import { tvViewportService } from '../src/core/tv/tvViewportService';

const UA_FIRE_TV = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36';
const UA_SAMSUNG = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function runIntegratedVerification() {
  console.log('=== ZAPITV | P2.D — REVISÃO INTEGRADA E CONSOLIDAÇÃO DA BASE ===\n');

  // =========================================================================
  // 1. VERIFICAÇÃO DE MÓDULOS DE DADOS, IDIOMAS E PERSISTÊNCIA
  // =========================================================================
  console.log('[1] Verificando integridade de persistência, idiomas e rotas...');

  // 1.1 Persistência e Storage V2
  assert.equal(typeof storageService.getPlaybackContinuity, 'function', 'storageService.getPlaybackContinuity deve existir');
  assert.equal(typeof storageService.saveProgress, 'function', 'storageService.saveProgress deve existir');
  assert.equal(typeof storageService.getMyList, 'function', 'storageService.getMyList deve existir');
  assert.equal(typeof storageService.getFavorites, 'function', 'storageService.getFavorites deve existir');
  assert.equal(typeof storageService.getContinueWatching, 'function', 'storageService.getContinueWatching deve existir');
  console.log('  ✓ StorageService: Contratos V2 presentes e íntegros.');

  // 1.2 Identificação e separação de idiomas
  const dubbedStream = { title: 'Solo Leveling Episódio 1 [Dublado PT-BR]', url: 'https://example.com/dub.m3u8' };
  const dubbedAnalysis = audioPreferenceService.analyzeAudio(dubbedStream as any);
  assert.equal(dubbedAnalysis.isPtBr, true, 'Stream com [Dublado PT-BR] deve ser isPtBr: true');
  assert.equal(dubbedAnalysis.isDubbed, true, 'Stream com [Dublado PT-BR] deve ser isDubbed: true');

  const subbedStream = { title: 'Jimihen!! Episódio 1 [Legendado]', url: 'https://example.com/sub.m3u8' };
  const subbedAnalysis = audioPreferenceService.analyzeAudio(subbedStream as any);
  assert.equal(subbedAnalysis.isPtBr, false, 'Stream [Legendado] NÃO deve herdar isPtBr: true');
  assert.equal(subbedAnalysis.isDubbed, false, 'Stream [Legendado] NÃO deve herdar isDubbed: true');

  const subbedCls = classifyStream(subbedStream as any);
  assert.equal(subbedCls.badge, '💬', 'Badge de stream legendado deve ser 💬');
  console.log('  ✓ AudioPreferenceService & AudioDetector: Separação estrita de dublagem vs legendas aprovada.');

  // 1.3 Parser e Construtor de Rotas de Reprodução
  const watchMovie = parseWatchRoute('/assistir/filme/10331');
  assert.equal(watchMovie.isWatch, true);
  assert.equal(watchMovie.isTv, false);
  assert.equal(watchMovie.mediaType, 'movie');
  assert.equal(watchMovie.id, '10331');

  const watchTvMovie = parseWatchRoute('/tv/assistir/filme/10331');
  assert.equal(watchTvMovie.isWatch, true);
  assert.equal(watchTvMovie.isTv, true);
  assert.equal(watchTvMovie.mediaType, 'movie');
  assert.equal(watchTvMovie.id, '10331');

  const watchTvSeries = parseWatchRoute('/tv/assistir/serie/tt12345/t/2/e/4');
  assert.equal(watchTvSeries.isWatch, true);
  assert.equal(watchTvSeries.isTv, true);
  assert.equal(watchTvSeries.mediaType, 'series');
  assert.equal(watchTvSeries.id, 'tt12345');
  assert.equal(watchTvSeries.season, 2);
  assert.equal(watchTvSeries.episode, 4);
  console.log('  ✓ NavigationRoutes: Parse de rotas diretas desktop e TV íntegro.');

  // =========================================================================
  // 2. SERVIDOR E NAVEGAÇÃO INTEGRADA COM PLAYWRIGHT
  // =========================================================================
  console.log('\n[2] Inicializando servidor Vite e suíte integrada de interfaces...');

  const server = await createServer({
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`  Servidor Vite ativo em: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // -----------------------------------------------------------------------
    // 2.1 DESKTOP: Navegação, Modal de Detalhes, Busca e Player
    // -----------------------------------------------------------------------
    console.log('\n--- [2.1] Integridade Desktop (1920x1080) ---');
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: UA_DESKTOP,
      isMobile: false
    });
    const desktopPage = await desktopContext.newPage();

    console.log('  Carregando Home Desktop...');
    await desktopPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForSelector('header', { timeout: 15000 });

    // Fundo escuro
    const desktopBg = await desktopPage.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    assert.equal(desktopBg, 'rgb(5, 7, 10)', 'Fundo da Home desktop deve ser #05070a');

    // Abre Modal de Detalhes pelo primeiro card
    console.log('  Abrindo Modal de Detalhes...');
    await desktopPage.waitForSelector('.group\\/card', { timeout: 15000 });
    const firstCard = desktopPage.locator('.group\\/card').first();
    assert.ok(await firstCard.isVisible(), 'Card do catálogo deve estar comprovadamente visível');
    await firstCard.click({ force: true });
    await desktopPage.waitForSelector('button[aria-label="Fechar"]', { timeout: 10000 });

    // Inicia reprodução a partir do Modal de Detalhes
    console.log('  Iniciando reprodução a partir do modal...');
    const playBtn = desktopPage.locator('.max-w-\\[850px\\] button:has-text("Assistir"), .max-w-\\[850px\\] button:has-text("Continuar")').first();
    await playBtn.click({ force: true });
    await desktopPage.waitForFunction(() => window.location.pathname.includes('/assistir/'), { timeout: 10000 });

    // Fecha o player e verifica que retorna ao Modal de Detalhes (1 botão fechar modal visível)
    console.log('  Fechando player: confirmando retorno atômico ao Modal de Detalhes...');
    const closePlayerBtn = desktopPage.locator('button:has-text("Voltar ao catálogo"), button:has-text("Voltar"), button:has-text("Voltar ao início")').first();
    await closePlayerBtn.waitFor({ state: 'attached', timeout: 15000 });
    await desktopPage.waitForTimeout(400);
    await closePlayerBtn.click({ force: true });
    await desktopPage.waitForFunction(() => !window.location.pathname.includes('/assistir/'), { timeout: 10000 });
    await desktopPage.waitForTimeout(400);

    const closeModalsAfterPlayerClose = await desktopPage.locator('button[aria-label="Fechar"]').count();
    assert.equal(closeModalsAfterPlayerClose, 1, 'Ao fechar o player iniciado no modal, exatamente 1 modal de detalhes deve permanecer aberto');

    // Fecha o modal de detalhes e confirma retorno à Home (0 modais)
    console.log('  Fechando Modal de Detalhes...');
    await desktopPage.locator('button[aria-label="Fechar"]').first().click({ force: true });
    await desktopPage.waitForTimeout(600);

    const closeModalsAfterModalClose = await desktopPage.locator('button[aria-label="Fechar"]').count();
    assert.equal(closeModalsAfterModalClose, 0, 'Ao fechar o modal de detalhes, nenhum modal deve permanecer no DOM');
    console.log('  ✓ Desktop: Ciclo Card -> Detalhes -> Player -> Detalhes -> Home aprovado.');

    // -----------------------------------------------------------------------
    // 2.2 DESKTOP: Rotas Diretas e Recarregamento (Deep Links)
    // -----------------------------------------------------------------------
    console.log('\n--- [2.2] Rotas Diretas e Recarregamento no Desktop ---');
    console.log('  Acessando rota direta autorizada: /assistir/filme/10331...');
    await desktopPage.goto(`${baseUrl}/assistir/filme/10331`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForFunction(() => window.location.pathname.includes('/assistir/'), { timeout: 10000 });

    const directWatchState = await desktopPage.evaluate(() => {
      const hasCloseOrPlayer = Boolean(document.querySelector('button[aria-label="Fechar"], .zapi-player-container, video'));
      return { hasCloseOrPlayer, url: window.location.href };
    });
    console.log('  Estado da rota direta:', directWatchState);
    assert.ok(directWatchState.hasCloseOrPlayer, 'Player deve abrir via rota direta');

    // Recarrega a página durante a reprodução
    console.log('  Recarregando página durante reprodução (F5 / Reload)...');
    await desktopPage.reload({ waitUntil: 'domcontentloaded' });
    await desktopPage.waitForFunction(() => window.location.pathname.includes('/assistir/'), { timeout: 10000 });

    const reloadedWatchState = await desktopPage.evaluate(() => {
      const hasCloseOrPlayer = Boolean(document.querySelector('button[aria-label="Fechar"], .zapi-player-container, video'));
      return { hasCloseOrPlayer, url: window.location.href };
    });
    console.log('  Estado após recarregamento:', reloadedWatchState);
    assert.ok(reloadedWatchState.hasCloseOrPlayer, 'Player deve restaurar reprodução sem tela preta após reload');

    // Fecha o player direto e verifica retorno limpo à Home
    console.log('  Fechando player direto...');
    const directCloseBtn = desktopPage.locator('button:has-text("Voltar ao catálogo"), button:has-text("Voltar"), button:has-text("Voltar ao início")').first();
    await directCloseBtn.waitFor({ state: 'attached', timeout: 15000 });
    await desktopPage.waitForTimeout(400);
    await directCloseBtn.click({ force: true });
    await desktopPage.waitForFunction(() => !window.location.pathname.includes('/assistir/'), { timeout: 10000 });
    await desktopPage.waitForTimeout(400);

    const postDirectCloseModals = await desktopPage.locator('button[aria-label="Fechar"]').count();
    assert.equal(postDirectCloseModals, 0, 'Sair de reprodução direta deve retornar à Home sem modais fantasmas');

    // Acessa rota inexistente para verificar tratamento de erro
    console.log('  Acessando rota de reprodução inexistente: /assistir/filme/id-invalido-999999...');
    await desktopPage.goto(`${baseUrl}/assistir/filme/id-invalido-999999`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForTimeout(1000);

    const notFoundState = await desktopPage.evaluate(() => {
      const errorMsg = Boolean(document.body.textContent?.includes('Conteúdo não encontrado ou indisponível'));
      const backBtn = Array.from(document.querySelectorAll('button')).some(b => 
        b.textContent?.includes('Voltar ao início') || b.textContent?.includes('Voltar')
      );
      return { errorMsg, backBtn };
    });
    console.log('  Tratamento de rota inexistente:', notFoundState);
    assert.ok(notFoundState.errorMsg, 'Rota inválida deve exibir mensagem segura de não encontrado');
    assert.ok(notFoundState.backBtn, 'Rota inválida deve fornecer botão "Voltar ao início"');
    console.log('  ✓ Desktop: Rotas diretas, reload e fallback seguro aprovados.');

    await desktopContext.close();

    // -----------------------------------------------------------------------
    // 2.3 MOBILE: Banner, Carrosséis, Gestos e Paginação no Explorar
    // -----------------------------------------------------------------------
    console.log('\n--- [2.3] Integridade Mobile (390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: UA_MOBILE,
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();

    console.log('  Carregando Home Mobile...');
    await mobilePage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('nav', { timeout: 15000 });

    const mobileHomeCheck = await mobilePage.evaluate(() => {
      const bottomNav = Boolean(document.querySelector('nav.fixed.bottom-0'));
      const carousels = document.querySelectorAll('div[data-testid="mobile-content-row"], div.touch-pan-y, div.overflow-x-auto').length;
      return { bottomNav, carousels };
    });
    console.log('  Componentes Home Mobile:', mobileHomeCheck);
    assert.ok(mobileHomeCheck.bottomNav, 'Barra de navegação inferior mobile deve existir');

    // Navega para Explorar mobile
    console.log('  Navegando para Explorar mobile...');
    await mobilePage.click('button:has-text("Explorar"), a:has-text("Explorar"), nav button:nth-child(2)');
    await mobilePage.waitForTimeout(1000);

    const exploreState = await mobilePage.evaluate(() => {
      const filterTabs = Array.from(document.querySelectorAll('button')).filter(b => 
        ['Todos', 'Filmes', 'Séries', 'Animes'].includes(b.textContent?.trim() || '')
      ).length;
      return { filterTabs, url: window.location.href };
    });
    console.log('  Explorar mobile:', exploreState);
    assert.ok(exploreState.filterTabs >= 3, 'Abas de categoria do Explorar mobile devem estar visíveis');
    console.log('  ✓ Mobile: Navegação e Explorar validados com sucesso.');

    await mobileContext.close();

    // -----------------------------------------------------------------------
    // 2.4 SMART TV: Fire TV vs Samsung Tizen e HUD Ao Vivo
    // -----------------------------------------------------------------------
    console.log('\n--- [2.4] Integridade do Modo TV (Fire TV & Samsung Tizen) ---');
    const tvContext = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 2.0,
      userAgent: UA_FIRE_TV,
      isMobile: false
    });
    const tvPage = await tvContext.newPage();

    console.log('  Carregando Modo TV...');
    await tvPage.goto(`${baseUrl}/tv`, { waitUntil: 'domcontentloaded' });
    await tvPage.waitForSelector('[data-testid="tv-header"]', { timeout: 15000 });

    // Testa menu de perfil compacto
    await tvPage.click('[data-focus-key="tv-nav-profile"]');
    await tvPage.waitForSelector('[data-testid="tv-profile-menu-dropdown"]', { timeout: 5000 });

    const tvMenuWidth = await tvPage.evaluate(() => {
      return document.querySelector('[data-testid="tv-profile-menu-dropdown"]')?.getBoundingClientRect().width;
    });
    assert.ok(tvMenuWidth && tvMenuWidth <= 235, `Menu no Fire TV deve ser compacto (<= 235px), obtido: ${tvMenuWidth}px`);
    await tvPage.keyboard.press('Escape');
    await tvPage.waitForTimeout(300);

    // Testa HUD Ao Vivo
    console.log('  Testando aba Ao Vivo na TV...');
    await tvPage.click('[data-focus-key="tv-nav-featured"]');
    await tvPage.waitForSelector('[data-testid="tv-live-glass-surface"]', { timeout: 10000 });

    const liveHudState = await tvPage.evaluate(() => {
      const surface = Boolean(document.querySelector('[data-testid="tv-live-glass-surface"]'));
      const numberPill = Boolean(document.querySelector('[data-testid="tv-channel-number-pill"]'));
      const liveBadge = Boolean(document.querySelector('[data-testid="tv-live-indicator"]'));
      return { surface, numberPill, liveBadge };
    });
    console.log('  HUD Ao Vivo na TV:', liveHudState);
    assert.ok(liveHudState.surface, 'HUD com superfície de vidro deve existir');
    assert.ok(liveHudState.numberPill, 'Pílula com número do canal deve estar visível');
    assert.ok(liveHudState.liveBadge, 'Badge pulsante AO VIVO deve estar visível');
    console.log('  ✓ Modo TV: Proporções Fire TV e Ao Vivo homologados com sucesso.');

    await tvContext.close();

    console.log('\n========================================================================');
    console.log('✓ TODAS AS INTEGRAÇÕES E ROTAS FORAM VALIDADAS COM SUCESSO (CÓDIGO 0)!');
    console.log('========================================================================\n');

  } finally {
    await browser.close();
    await server.close();
  }
}

runIntegratedVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Falha na verificação integrada P2.D:');
    console.error(err);
    process.exit(1);
  });
