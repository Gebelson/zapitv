import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, type Browser } from 'playwright';

const UA_FIRE_TV_STICK = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36';
const UA_SAMSUNG_TIZEN = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';

async function run() {
  console.log('=== ZAPITV | P2.C — SUÍTE DE TESTES E HOMOLOGAÇÃO DO MODO TV (PLAYWRIGHT) ===\n');

  const server = await createServer({
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'error'
  });

  let browser: Browser | undefined;

  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    console.log(`Servidor Vite de teste iniciado em: ${baseUrl}`);

    browser = await chromium.launch({ headless: true });

    // =========================================================================
    // CENÁRIO 1: AMAZON FIRE TV (Silk Browser - 960x540 DPR 2.0)
    // =========================================================================
    console.log(`\n========================================================================`);
    console.log(`--- [1] Testando Modo TV no Amazon Fire TV (Silk Browser) ---`);
    console.log(`========================================================================`);

    const fireTvContext = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 2.0,
      userAgent: UA_FIRE_TV_STICK,
      isMobile: false,
      hasTouch: false
    });

    const fireTvPage = await fireTvContext.newPage();

    // 1.1 Header e Menu de Perfil no Fire TV
    console.log('\n[1.1] Validando Header e Menu de Perfil no Fire TV (960x540 DPR 2.0)...');
    await fireTvPage.goto(`${baseUrl}/tv`, { waitUntil: 'domcontentloaded' });
    await fireTvPage.waitForSelector('[data-testid="tv-header"]', { timeout: 15000 });

    const fireHeaderMetrics = await fireTvPage.evaluate(() => {
      const header = document.querySelector('[data-testid="tv-header"]')?.getBoundingClientRect();
      const logoIcon = document.querySelector('[data-testid="tv-header"] .group\\/logo > div')?.getBoundingClientRect();
      const logoText = document.querySelector('[data-testid="tv-header"] .group\\/logo > img')?.getBoundingClientRect();
      const searchBtn = document.querySelector('[data-focus-key="tv-nav-search"]')?.getBoundingClientRect();
      const profileBtn = document.querySelector('[data-focus-key="tv-nav-profile"]')?.getBoundingClientRect();
      const navLinks = Array.from(document.querySelectorAll('[data-focus-key^="tv-nav-"]')).map(el => ({
        key: el.getAttribute('data-focus-key'),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height)
      }));

      return {
        headerHeight: header ? Math.round(header.height) : null,
        logoIconWidth: logoIcon ? Math.round(logoIcon.width) : null,
        logoIconHeight: logoIcon ? Math.round(logoIcon.height) : null,
        logoTextHeight: logoText ? Math.round(logoText.height) : null,
        searchBtnWidth: searchBtn ? Math.round(searchBtn.width) : null,
        profileBtnWidth: profileBtn ? Math.round(profileBtn.width) : null,
        navLinks
      };
    });

    console.log('  Métricas do Header no Fire TV:', fireHeaderMetrics);
    assert.ok(fireHeaderMetrics.headerHeight && fireHeaderMetrics.headerHeight <= 60, 'Header do Fire TV em 960x540 deve ser compacto (<= 60px)');
    assert.ok(fireHeaderMetrics.logoIconWidth && fireHeaderMetrics.logoIconWidth > 0, 'Logo ícone deve estar visível sem cortes');
    assert.ok(fireHeaderMetrics.logoTextHeight && fireHeaderMetrics.logoTextHeight > 0, 'Logo texto deve estar visível sem cortes');

    // 1.2 Navegação D-pad no Header e limites horizontais
    console.log('\n[1.2] Testando limites horizontais e indicador deslizante no Header...');
    await fireTvPage.click('[data-focus-key="tv-nav-home"]');
    await fireTvPage.waitForTimeout(200);

    const isHomeFocused = await fireTvPage.evaluate(() => {
      return document.querySelector('[data-focus-key="tv-nav-home"]')?.getAttribute('data-tv-focused') === 'true';
    });
    assert.ok(isHomeFocused, 'tv-nav-home deve receber foco ao ser clicado');

    // Tenta navegar para a esquerda do link Início (não deve ultrapassar os limites)
    await fireTvPage.keyboard.press('ArrowLeft');
    await fireTvPage.waitForTimeout(100);
    const stillHomeFocused = await fireTvPage.evaluate(() => {
      return document.querySelector('[data-focus-key="tv-nav-home"]')?.getAttribute('data-tv-focused') === 'true';
    });
    assert.ok(stillHomeFocused, 'Limite esquerdo do Header respeitado: não deve sair de tv-nav-home para a esquerda');

    // Navega para a direita até o Perfil
    await fireTvPage.keyboard.press('ArrowRight'); // movies
    await fireTvPage.keyboard.press('ArrowRight'); // series
    await fireTvPage.keyboard.press('ArrowRight'); // animes
    await fireTvPage.keyboard.press('ArrowRight'); // featured
    await fireTvPage.keyboard.press('ArrowRight'); // search
    await fireTvPage.keyboard.press('ArrowRight'); // profile
    await fireTvPage.waitForTimeout(150);

    const isProfileFocused = await fireTvPage.evaluate(() => {
      return document.querySelector('[data-focus-key="tv-nav-profile"]')?.getAttribute('data-tv-focused') === 'true';
    });
    assert.ok(isProfileFocused, 'Foco deve alcançar o botão de perfil');

    // Tenta navegar para a direita de Perfil (não deve ultrapassar os limites)
    await fireTvPage.keyboard.press('ArrowRight');
    await fireTvPage.waitForTimeout(100);
    const stillProfileFocused = await fireTvPage.evaluate(() => {
      return document.querySelector('[data-focus-key="tv-nav-profile"]')?.getAttribute('data-tv-focused') === 'true';
    });
    assert.ok(stillProfileFocused, 'Limite direito do Header respeitado: não deve sair de tv-nav-profile para a direita');

    // 1.3 Menu de Perfil Compacto no Fire TV
    console.log('\n[1.3] Abrindo Menu de Perfil no Fire TV...');
    await fireTvPage.keyboard.press('Enter');
    await fireTvPage.waitForSelector('[data-testid="tv-profile-menu-dropdown"]', { timeout: 5000 });

    const fireProfileMenuMetrics = await fireTvPage.evaluate(() => {
      const dropdown = document.querySelector('[data-testid="tv-profile-menu-dropdown"]')?.getBoundingClientRect();
      const isFireTvAttr = document.querySelector('[data-testid="tv-profile-menu-dropdown"]')?.getAttribute('data-firetv-compact');
      const firstItem = document.querySelector('[data-focus-key="tv-menu-mylist"]')?.getBoundingClientRect();
      return {
        width: dropdown ? Math.round(dropdown.width) : 0,
        height: dropdown ? Math.round(dropdown.height) : 0,
        itemHeight: firstItem ? Math.round(firstItem.height) : 0,
        isFireTvAttr
      };
    });

    console.log('  Menu de Perfil Fire TV:', fireProfileMenuMetrics);
    assert.equal(fireProfileMenuMetrics.isFireTvAttr, 'true', 'Menu de perfil deve conter flag data-firetv-compact="true" no Fire TV');
    assert.ok(fireProfileMenuMetrics.width <= 235, `Menu de perfil no Fire TV deve ser compacto (<= 235px), obtido: ${fireProfileMenuMetrics.width}px`);

    // Fecha o menu com tecla Escape / Back e valida restauração de foco em tv-nav-profile
    await fireTvPage.keyboard.press('Escape');
    await fireTvPage.waitForTimeout(300);

    const isMenuClosed = await fireTvPage.evaluate(() => {
      return document.querySelector('[data-testid="tv-profile-menu-dropdown"]') === null;
    });
    assert.ok(isMenuClosed, 'Menu de perfil deve fechar com a tecla Back / Escape');

    const focusRestoredToProfile = await fireTvPage.evaluate(() => {
      return document.querySelector('[data-focus-key="tv-nav-profile"]')?.getAttribute('data-tv-focused') === 'true';
    });
    assert.ok(focusRestoredToProfile, 'Ao fechar o menu de perfil, o foco deve retornar para tv-nav-profile');

    // 1.4 Busca no Modo TV com Teclado Virtual Proporcional
    console.log('\n[1.4] Testando Busca no Modo TV e Teclado Virtual no Fire TV...');
    await fireTvPage.click('[data-focus-key="tv-nav-search"]');
    await fireTvPage.waitForSelector('[data-focus-key="tv-key-a"]', { timeout: 5000 });

    const keyboardMetrics = await fireTvPage.evaluate(() => {
      const sidebar = document.querySelector('div.flex-shrink-0.h-full.flex.flex-col')?.getBoundingClientRect();
      const keyA = document.querySelector('[data-focus-key="tv-key-a"]')?.getBoundingClientRect();
      const spaceKey = document.querySelector('[data-focus-key="tv-key-space"]');
      const backspaceKey = document.querySelector('[data-focus-key="tv-key-backspace"]');
      const clearKey = document.querySelector('[data-focus-key="tv-key-clear"]');
      const resultsGrid = document.querySelector('div[style*="grid-template-columns"]') || document.querySelector('div[style*="repeat(6"]');
      const gridColumns = resultsGrid ? window.getComputedStyle(resultsGrid).gridTemplateColumns.split(' ').length : 0;

      return {
        sidebarWidth: sidebar ? Math.round(sidebar.width) : 0,
        keyAHeight: keyA ? Math.round(keyA.height) : 0,
        spaceColSpan: spaceKey?.className.includes('col-span-3'),
        spaceLabel: spaceKey?.textContent?.trim(),
        backspaceColSpan: backspaceKey?.className.includes('col-span-2'),
        backspaceLabel: backspaceKey?.textContent?.trim(),
        clearHasTrashIcon: Boolean(clearKey?.querySelector('svg')),
        clearAriaLabel: clearKey?.getAttribute('aria-label'),
        gridColumns
      };
    });

    console.log('  Métricas do Teclado e Busca:', keyboardMetrics);
    assert.ok(keyboardMetrics.spaceColSpan, 'Tecla ESPAÇO deve ter col-span-3');
    assert.equal(keyboardMetrics.spaceLabel, 'ESPAÇO', 'Tecla ESPAÇO deve exibir o texto "ESPAÇO"');
    assert.ok(keyboardMetrics.backspaceColSpan, 'Tecla APAGAR deve ter col-span-2');
    assert.equal(keyboardMetrics.backspaceLabel, 'APAGAR', 'Tecla APAGAR deve exibir o texto "APAGAR"');
    assert.ok(keyboardMetrics.clearHasTrashIcon, 'Tecla LIMPAR deve renderizar o ícone de lixeira SVG');
    assert.equal(keyboardMetrics.clearAriaLabel, 'Limpar pesquisa', 'Tecla LIMPAR deve ter aria-label acessível');
    assert.equal(keyboardMetrics.gridColumns, 6, 'Grade de resultados de busca deve apresentar exatamente 6 colunas');

    // Sai da busca usando o botão Voltar
    await fireTvPage.click('[data-focus-key="tv-search-back"]');
    await fireTvPage.waitForTimeout(400);

    const outOfSearch = await fireTvPage.evaluate(() => {
      return document.querySelector('[data-focus-key="tv-key-a"]') === null;
    });
    assert.ok(outOfSearch, 'Botão Voltar da busca deve fechar a tela de busca e retornar');

    // 1.5 Carrosséis e Hero Banner
    console.log('\n[1.5] Testando Carrosséis e Hero Banner no Fire TV...');
    await fireTvPage.waitForSelector('[data-focus-key="tv-hero-play"]', { timeout: 5000 });

    const heroDetails = await fireTvPage.evaluate(() => {
      const heroPlay = document.querySelector('[data-focus-key="tv-hero-play"]')?.getBoundingClientRect();
      const heroDetails = document.querySelector('[data-focus-key="tv-hero-details"]')?.getBoundingClientRect();
      const arrowButtons = Array.from(document.querySelectorAll('.zapi-tv-hero button svg.lucide-chevron-left, .zapi-tv-hero button svg.lucide-chevron-right'));
      return {
        hasHeroPlay: Boolean(heroPlay),
        hasHeroDetails: Boolean(heroDetails),
        arrowCount: arrowButtons.length
      };
    });

    assert.ok(heroDetails.hasHeroPlay, 'Hero Play button deve existir');
    assert.ok(heroDetails.hasHeroDetails, 'Hero Details button deve existir');
    assert.equal(heroDetails.arrowCount, 0, 'Hero Banner NÃO deve possuir setas manuais de navegação');

    // 1.6 Ao Vivo (Live TV HUD) no Fire TV
    console.log('\n[1.6] Testando HUD Ao Vivo no Fire TV...');
    await fireTvPage.click('[data-focus-key="tv-nav-featured"]');
    await fireTvPage.waitForSelector('[data-testid="tv-live-glass-surface"]', { timeout: 10000 });

    const fireLiveMetrics = await fireTvPage.evaluate(() => {
      const hud = document.querySelector('[data-testid="tv-live-glass-surface"]')?.getBoundingClientRect();
      const numberPill = document.querySelector('[data-testid="tv-channel-number-pill"]')?.getBoundingClientRect();
      const liveIndicator = document.querySelector('[data-testid="tv-live-indicator"]')?.getBoundingClientRect();
      const style = window.getComputedStyle(document.querySelector('[data-testid="tv-live-glass-surface"]')!);

      return {
        hudWidth: hud ? Math.round(hud.width) : 0,
        hudHeight: hud ? Math.round(hud.height) : 0,
        numberPillHeight: numberPill ? Math.round(numberPill.height) : 0,
        liveIndicatorHeight: liveIndicator ? Math.round(liveIndicator.height) : 0,
        borderRadius: style.borderRadius,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter
      };
    });

    console.log('  HUD Ao Vivo no Fire TV:', fireLiveMetrics);
    assert.ok(fireLiveMetrics.hudWidth <= 640, `HUD no Fire TV 960x540 deve ser proporcional (<= 640px), obtido: ${fireLiveMetrics.hudWidth}px`);
    assert.ok(fireLiveMetrics.numberPillHeight > 0, 'Pílula de número do canal deve estar visível');
    assert.ok(fireLiveMetrics.liveIndicatorHeight > 0, 'Indicador AO VIVO deve estar visível');

    await fireTvContext.close();
    console.log('✓ Fire TV validado com sucesso!');

    // =========================================================================
    // CENÁRIO 2: SAMSUNG TIZEN (1920x1080 - Proporção Plena Não-Reduzida)
    // =========================================================================
    console.log(`\n========================================================================`);
    console.log(`--- [2] Testando Modo TV no Samsung Tizen (1920x1080) ---`);
    console.log(`========================================================================`);

    const tizenContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1.0,
      userAgent: UA_SAMSUNG_TIZEN,
      isMobile: false,
      hasTouch: false
    });

    const tizenPage = await tizenContext.newPage();

    console.log('\n[2.1] Validando Header e Menu de Perfil no Samsung Tizen...');
    await tizenPage.goto(`${baseUrl}/tv`, { waitUntil: 'domcontentloaded' });
    await tizenPage.waitForSelector('[data-testid="tv-header"]', { timeout: 15000 });

    const tizenHeaderMetrics = await tizenPage.evaluate(() => {
      const header = document.querySelector('[data-testid="tv-header"]')?.getBoundingClientRect();
      const logoIcon = document.querySelector('[data-testid="tv-header"] .group\\/logo > div')?.getBoundingClientRect();
      return {
        headerHeight: header ? Math.round(header.height) : 0,
        logoIconWidth: logoIcon ? Math.round(logoIcon.width) : 0
      };
    });

    console.log('  Métricas do Header no Samsung Tizen:', tizenHeaderMetrics);
    assert.equal(tizenHeaderMetrics.headerHeight, 92, 'Header no Samsung Tizen 1080p deve ter a altura padrão de 92px');
    assert.equal(tizenHeaderMetrics.logoIconWidth, 48, 'Logo no Samsung Tizen 1080p deve ter tamanho padrão de 48px');

    // Abre Menu de Perfil no Samsung Tizen
    await tizenPage.click('[data-focus-key="tv-nav-profile"]');
    await tizenPage.waitForSelector('[data-testid="tv-profile-menu-dropdown"]', { timeout: 5000 });

    const tizenProfileMetrics = await tizenPage.evaluate(() => {
      const dropdown = document.querySelector('[data-testid="tv-profile-menu-dropdown"]')?.getBoundingClientRect();
      const isFireTvAttr = document.querySelector('[data-testid="tv-profile-menu-dropdown"]')?.getAttribute('data-firetv-compact');
      return {
        width: dropdown ? Math.round(dropdown.width) : 0,
        isFireTvAttr
      };
    });

    console.log('  Menu de Perfil Samsung Tizen:', tizenProfileMetrics);
    assert.equal(tizenProfileMetrics.isFireTvAttr, null, 'Menu no Samsung Tizen NÃO deve possuir data-firetv-compact');
    assert.equal(tizenProfileMetrics.width, 320, 'Menu de perfil no Samsung Tizen deve manter a largura padrão integral de 320px');

    await tizenPage.keyboard.press('Escape');
    await tizenPage.waitForTimeout(300);

    // 2.2 HUD Ao Vivo no Samsung Tizen
    console.log('\n[2.2] Testando HUD Ao Vivo no Samsung Tizen...');
    await tizenPage.click('[data-focus-key="tv-nav-featured"]');
    await tizenPage.waitForSelector('[data-testid="tv-live-glass-surface"]', { timeout: 10000 });

    const tizenLiveMetrics = await tizenPage.evaluate(() => {
      const hud = document.querySelector('[data-testid="tv-live-glass-surface"]')?.getBoundingClientRect();
      return {
        hudWidth: hud ? Math.round(hud.width) : 0,
        hudHeight: hud ? Math.round(hud.height) : 0
      };
    });

    console.log('  HUD Ao Vivo Samsung Tizen:', tizenLiveMetrics);
    assert.ok(tizenLiveMetrics.hudWidth >= 800, `HUD na Samsung 1080p deve manter largura plena (>= 800px), obtido: ${tizenLiveMetrics.hudWidth}px`);

    await tizenContext.close();
    console.log('✓ Samsung Tizen validado com sucesso!');

    // =========================================================================
    // CENÁRIO 3: FLUXO REAL DO USUÁRIO — SELEÇÃO DE CARD, DETALHES, PLAYER E VOLTAR
    // =========================================================================
    console.log(`\n========================================================================`);
    console.log(`--- [3] Testando Fluxo Real de Reprodução e Navegação na Smart TV ---`);
    console.log(`========================================================================`);

    const realTvContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1.5,
      userAgent: UA_FIRE_TV_STICK,
      isMobile: false,
      hasTouch: false
    });

    const realTvPage = await realTvContext.newPage();

    console.log('\n[3.1] Carregando interface principal da TV (/tv)...');
    await realTvPage.goto(`${baseUrl}/tv`, { waitUntil: 'domcontentloaded' });
    await realTvPage.waitForSelector('[data-focus-key="tv-hero-details"]', { timeout: 15000 });
    console.log('✓ Home da TV carregada');

    // 3.2 Abre Detalhes da obra selecionada
    console.log('\n[3.2] Abrindo Detalhes do título pelo Hero ("Mais detalhes")...');
    await realTvPage.click('[data-focus-key="tv-hero-details"]');
    await realTvPage.waitForSelector('[data-focus-key="tv-details-play"]', { timeout: 10000 });
    console.log('✓ Modal de Detalhes aberto com foco disponível');

    const detailsState = await realTvPage.evaluate(() => {
      const playBtn = document.querySelector('[data-focus-key="tv-details-play"]');
      const backBtn = document.querySelector('[data-focus-key="tv-details-back"]');
      return {
        hasPlayBtn: Boolean(playBtn),
        playLabel: playBtn?.textContent?.trim(),
        hasBackBtn: Boolean(backBtn)
      };
    });
    assert.ok(detailsState.hasPlayBtn, 'Botão de reprodução deve estar visível no modal de detalhes');
    assert.ok(detailsState.hasBackBtn, 'Botão voltar deve estar visível no modal de detalhes');

    // 3.3 Inicia a reprodução a partir dos detalhes
    console.log('\n[3.3] Acionando reprodução do conteúdo...');
    await realTvPage.click('[data-focus-key="tv-details-play"]');
    await realTvPage.waitForTimeout(2000);

    const tvPlayerState = await realTvPage.evaluate(() => {
      const isPlayerFixed = Boolean(document.querySelector('.fixed.inset-0.z-\\[5000\\]'));
      const headerHidden = !document.querySelector('[data-testid="tv-header"]');
      const hasCloseBtn = Boolean(document.querySelector('button[data-focus-key="tv-player-back"], button[aria-label="Voltar"], .fixed.inset-0.z-\\[5000\\] button:has(svg.lucide-arrow-left)'));
      return { isPlayerFixed, headerHidden, hasCloseBtn, url: window.location.href };
    });

    console.log('  Estado do Player:', tvPlayerState);
    assert.ok(tvPlayerState.isPlayerFixed, 'Player deve estar renderizado em tela cheia z-[5000]');
    assert.ok(tvPlayerState.headerHidden, 'Header da TV deve estar completamente oculto durante reprodução');

    // 3.4 Fecha o Player usando o controle do player
    console.log('\n[3.4] Fechando o Player para verificar retorno aos Detalhes...');
    const playerCloseBtn = await realTvPage.$('button[data-focus-key="tv-player-back"], button[aria-label="Voltar"], .fixed.inset-0.z-\\[5000\\] button:has(svg.lucide-arrow-left)');
    if (playerCloseBtn) {
      await playerCloseBtn.click();
    } else {
      await realTvPage.keyboard.press('Escape');
      await realTvPage.waitForTimeout(400);
      await realTvPage.keyboard.press('Escape');
    }

    await realTvPage.waitForTimeout(1000);

    const postPlayerState = await realTvPage.evaluate(() => {
      const isPlayerGone = !document.querySelector('.fixed.inset-0.z-\\[5000\\]');
      const detailsModalOpen = Boolean(document.querySelector('[data-focus-key="tv-details-play"]'));
      return { isPlayerGone, detailsModalOpen };
    });

    console.log('  Estado após sair do player:', postPlayerState);
    assert.ok(postPlayerState.isPlayerGone, 'Player deve ser desmontado ao fechar');
    assert.ok(postPlayerState.detailsModalOpen, 'Modal de Detalhes deve permanecer aberto após encerrar o player');

    // 3.5 Fecha o Modal de Detalhes e retorna à Home da TV
    console.log('\n[3.5] Fechando o Modal de Detalhes para retornar à Home...');
    await realTvPage.keyboard.press('Escape');
    await realTvPage.waitForTimeout(800);

    const homeRestoredState = await realTvPage.evaluate(() => {
      const detailsClosed = !document.querySelector('[data-focus-key="tv-details-play"]');
      const headerVisible = Boolean(document.querySelector('[data-testid="tv-header"]'));
      const heroPlayVisible = Boolean(document.querySelector('[data-focus-key="tv-hero-play"]'));
      return { detailsClosed, headerVisible, heroPlayVisible };
    });

    console.log('  Estado na Home da TV:', homeRestoredState);
    assert.ok(homeRestoredState.detailsClosed, 'Modal de detalhes deve fechar');
    assert.ok(homeRestoredState.headerVisible, 'Header deve reaparecer na Home da TV');
    assert.ok(homeRestoredState.heroPlayVisible, 'Hero Play deve estar acessível na Home');

    await realTvContext.close();
    console.log('✓ Fluxo real de reprodução e retorno no Modo TV aprovado!');

    console.log('\n========================================================================');
    console.log('✓ TODOS OS TESTES DE INTERFACE E NAVEGAÇÃO NO MODO TV P2.C FORAM APROVADOS!');
    console.log('========================================================================\n');

  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

run().catch((err) => {
  console.error('\n❌ Falha na execução dos testes do Modo TV P2.C:');
  console.error(err);
  process.exit(1);
});
