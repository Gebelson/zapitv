import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_DIR = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/firetv_evidence';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Iniciando servidor Vite para captura de evidências visuais...');
  const viteServer = await createServer({
    server: { port: 5174 }
  });
  await viteServer.listen();
  console.log('✅ Servidor Vite rodando em http://localhost:5174');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const measurements = [];

  try {
    // =========================================================================
    // 1. AMAZON FIRE TV (960x540 CSS px, DPR 2.0, Silk WebView)
    // =========================================================================
    console.log('\n--- 1. Capturando Evidências no Amazon Fire TV (960x540 / DPR 2.0) ---');
    const fireTvContext = await browser.newContext({
      viewport: { width: 960, height: 540 },
      deviceScaleFactor: 2.0,
      userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.128 Mobile Safari/537.36 Silk/108.3.16'
    });
    const fireTvPage = await fireTvContext.newPage();
    await fireTvPage.goto('http://localhost:5174/tv', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await fireTvPage.waitForSelector('[data-testid="tv-header"]', { timeout: 15000 });
    await fireTvPage.waitForTimeout(2000);

    // 1.1 Home View
    const homeScreenshotPath = path.join(OUTPUT_DIR, '01_firetv_960x540_home.png');
    await fireTvPage.screenshot({ path: homeScreenshotPath });
    console.log(`  📸 Screenshot salvo: ${homeScreenshotPath}`);

    // Medições DOM reais no Fire TV
    const domMetrics960 = await fireTvPage.evaluate(() => {
      const header = document.querySelector('[data-testid="tv-header"]');
      const headerRect = header?.getBoundingClientRect();
      const logoText = header?.querySelector('img[src="/zapitv-text.png"]');
      const logoTextRect = logoText?.getBoundingClientRect();
      const logoIcon = header?.querySelector('video, [alt="ZapiTV"]');
      const logoIconRect = logoIcon?.getBoundingClientRect();
      const homeBtn = header?.querySelector('button[data-focus-key="tv-nav-home"]');
      const homeBtnRect = homeBtn?.getBoundingClientRect();
      const searchBtn = header?.querySelector('button[data-focus-key="tv-nav-search"]');
      const searchBtnRect = searchBtn?.getBoundingClientRect();
      const heroTitle = document.querySelector('#tv-hero-banner h1');
      const heroTitleRect = heroTitle?.getBoundingClientRect();
      const heroPlayBtn = document.querySelector('button[data-focus-key="tv-hero-play"]');
      const heroPlayBtnRect = heroPlayBtn?.getBoundingClientRect();
      const heroDots = document.querySelector('#tv-hero-banner .z-30');
      const heroDotsRect = heroDots?.getBoundingClientRect();

      return {
        headerHeight: headerRect ? Math.round(headerRect.height) : 0,
        logoTextVisible: Boolean(logoText && logoTextRect && logoTextRect.width > 0 && logoTextRect.height > 0),
        logoTextHeight: logoTextRect ? Math.round(logoTextRect.height) : 0,
        logoTextWidth: logoTextRect ? Math.round(logoTextRect.width) : 0,
        logoRight: logoTextRect ? Math.round(logoTextRect.right) : 0,
        homeBtnLeft: homeBtnRect ? Math.round(homeBtnRect.left) : 0,
        clearanceLogoToHome: (homeBtnRect && logoTextRect) ? Math.round(homeBtnRect.left - logoTextRect.right) : 0,
        searchBtnSize: searchBtnRect ? Math.round(searchBtnRect.width) : 0,
        heroTitleFontSize: heroTitle ? window.getComputedStyle(heroTitle).fontSize : '0px',
        heroPlayBtnHeight: heroPlayBtnRect ? Math.round(heroPlayBtnRect.height) : 0,
        heroDotsBottom: heroDotsRect ? Math.round(540 - heroDotsRect.bottom) : 0,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    measurements.push({ viewport: '960x540 (Fire TV)', ...domMetrics960 });
    console.log('  📊 Métricas reais DOM em 960x540:', domMetrics960);

    // 1.2 Foco em "Início" e Indicador Azul
    await fireTvPage.evaluate(() => window.__setTvFocus ? window.__setTvFocus('tv-nav-home') : null);
    await fireTvPage.waitForTimeout(600);
    const focusInicioPath = path.join(OUTPUT_DIR, '02_firetv_960x540_focus_inicio.png');
    await fireTvPage.screenshot({ path: focusInicioPath });
    console.log(`  📸 Screenshot salvo: ${focusInicioPath}`);

    const indicatorMetrics = await fireTvPage.evaluate(() => {
      const indicator = document.querySelector('[data-testid="tv-nav-indicator"]');
      const homeBtn = document.querySelector('button[data-focus-key="tv-nav-home"]');
      const indRect = indicator?.getBoundingClientRect();
      const btnRect = homeBtn?.getBoundingClientRect();
      if (!indRect || !btnRect) return null;
      const indCenter = indRect.left + indRect.width / 2;
      const btnCenter = btnRect.left + btnRect.width / 2;
      const horizontalDiff = Math.abs(indCenter - btnCenter);
      const verticalGap = indRect.top - btnRect.bottom;
      return {
        indicatorVisible: window.getComputedStyle(indicator).opacity === '1',
        indicatorWidth: Math.round(indRect.width),
        indicatorHeight: Math.round(indRect.height),
        horizontalAlignmentDiff: Math.round(horizontalDiff * 10) / 10,
        verticalGapToText: Math.round(verticalGap)
      };
    });
    console.log('  🎯 Métrica do Indicador sob "Início":', indicatorMetrics);

    // 1.3 Foco em "Filmes"
    await fireTvPage.evaluate(() => window.__setTvFocus ? window.__setTvFocus('tv-nav-movies') : null);
    await fireTvPage.waitForTimeout(600);
    const focusFilmesPath = path.join(OUTPUT_DIR, '03_firetv_960x540_focus_filmes.png');
    await fireTvPage.screenshot({ path: focusFilmesPath });
    console.log(`  📸 Screenshot salvo: ${focusFilmesPath}`);

    // 1.4 Rolagem até os Carrosséis de Catálogo
    await fireTvPage.evaluate(() => {
      window.scrollTo({ top: 540, behavior: 'instant' });
    });
    await fireTvPage.waitForTimeout(800);
    const carouselsPath = path.join(OUTPUT_DIR, '04_firetv_960x540_carousels.png');
    await fireTvPage.screenshot({ path: carouselsPath });
    console.log(`  📸 Screenshot salvo: ${carouselsPath}`);

    const carouselMetrics = await fireTvPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('section[id^="row-"]'));
      const rowSummaries = rows.map(r => {
        const cards = Array.from(r.querySelectorAll('[data-card-poster="true"]'));
        const title = r.querySelector('h2')?.textContent || '';
        return { id: r.id, title, renderedCards: cards.length };
      });

      // Pega a fileira que tenha mais de 6 conteúdos (modo infinito com 6,5 capas)
      const targetRow = rows.find(r => r.querySelectorAll('[data-card-poster="true"]').length > 6) || rows[0];
      const rowTitle = targetRow?.querySelector('h2');
      const cards = Array.from(targetRow?.querySelectorAll('[data-card-poster="true"]') || []);
      const firstCard = cards[0];
      const cardRect = firstCard?.getBoundingClientRect();

      // Medição dos cards visíveis dentro da largura da janela (960px)
      const visibleCardsInfo = cards.map((c, i) => {
        const r = c.getBoundingClientRect();
        const visibleLeft = Math.max(0, r.left);
        const visibleRight = Math.min(960, r.right);
        const visibleW = Math.max(0, visibleRight - visibleLeft);
        return {
          index: i,
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          visibleWidth: Math.round(visibleW),
          visiblePercent: Math.round((visibleW / r.width) * 100)
        };
      }).filter(c => c.visibleWidth > 0);

      return {
        rowSummaries,
        inspectedRow: targetRow?.id,
        rowTitleFontSize: rowTitle ? window.getComputedStyle(rowTitle).fontSize : '0px',
        cardWidth: cardRect ? Math.round(cardRect.width) : 0,
        cardHeight: cardRect ? Math.round(cardRect.height) : 0,
        aspectRatio: cardRect ? (cardRect.height / cardRect.width).toFixed(2) : '0',
        totalRenderedCards: cards.length,
        visibleCardsCount: visibleCardsInfo.length,
        cardsOnScreen: visibleCardsInfo
      };
    });
    console.log('  🎬 Métrica dos Carrosséis (6,5 capas):', JSON.stringify(carouselMetrics, null, 2));

    // 1.5 Página de Busca
    await fireTvPage.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await fireTvPage.click('button[data-focus-key="tv-nav-search"]');
    await fireTvPage.waitForTimeout(1000);
    const searchPath = path.join(OUTPUT_DIR, '05_firetv_960x540_search.png');
    await fireTvPage.screenshot({ path: searchPath });
    console.log(`  📸 Screenshot salvo: ${searchPath}`);

    const searchMetrics = await fireTvPage.evaluate(() => {
      const sidebar = document.querySelector('.w-full.h-screen > div:first-child');
      const sidebarRect = sidebar?.getBoundingClientRect();
      const keyA = document.querySelector('button[data-focus-key="tv-key-a"]');
      const keyARect = keyA?.getBoundingClientRect();
      const grid = document.querySelector('.w-full.h-screen [data-card-poster="true"]')?.parentElement?.parentElement;
      const gridComputed = grid ? window.getComputedStyle(grid) : null;
      const searchCards = Array.from(document.querySelectorAll('.w-full.h-screen [data-card-poster="true"]'));
      const firstRowCards = searchCards.slice(0, 6).map(c => {
        const r = c.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) };
      });

      return {
        sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : 0,
        keyAHeight: keyARect ? Math.round(keyARect.height) : 0,
        keyAFontSize: keyA ? window.getComputedStyle(keyA).fontSize : '0px',
        gridColumns: gridComputed?.gridTemplateColumns || '',
        cardsInFirstRow: firstRowCards.length,
        firstRowCards
      };
    });
    console.log('  🔍 Métrica da Busca (6 colunas):', JSON.stringify(searchMetrics, null, 2));

    await fireTvContext.close();

    // =========================================================================
    // 2. SMART TV 720p (1280x720, DPR 1.5)
    // =========================================================================
    console.log('\n--- 2. Capturando Evidências em Smart TV 720p (1280x720 / DPR 1.5) ---');
    const tv720Context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1.5,
      userAgent: 'Mozilla/5.0 (SmartTV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/76.0.3809.146 TV Safari/537.36'
    });
    const tv720Page = await tv720Context.newPage();
    await tv720Page.goto('http://localhost:5174/tv', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await tv720Page.waitForSelector('[data-testid="tv-header"]', { timeout: 15000 });
    await tv720Page.waitForTimeout(1500);

    const tv720HomePath = path.join(OUTPUT_DIR, '06_smarttv_1280x720_home.png');
    await tv720Page.screenshot({ path: tv720HomePath });
    console.log(`  📸 Screenshot salvo: ${tv720HomePath}`);

    await tv720Page.click('button[data-focus-key="tv-nav-search"]');
    await tv720Page.waitForTimeout(800);
    const tv720SearchPath = path.join(OUTPUT_DIR, '07_smarttv_1280x720_search.png');
    await tv720Page.screenshot({ path: tv720SearchPath });
    console.log(`  📸 Screenshot salvo: ${tv720SearchPath}`);

    await tv720Context.close();

    // =========================================================================
    // 3. FULL HD 1080p (1920x1080, DPR 1.0)
    // =========================================================================
    console.log('\n--- 3. Capturando Evidências em Full HD (1920x1080 / DPR 1.0) ---');
    const tv1080Context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1.0,
      userAgent: 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.128 Safari/537.36 WebAppManager'
    });
    const tv1080Page = await tv1080Context.newPage();
    await tv1080Page.goto('http://localhost:5174/tv', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await tv1080Page.waitForSelector('[data-testid="tv-header"]', { timeout: 15000 });
    await tv1080Page.waitForTimeout(1500);

    const tv1080HomePath = path.join(OUTPUT_DIR, '08_smarttv_1920x1080_home.png');
    await tv1080Page.screenshot({ path: tv1080HomePath });
    console.log(`  📸 Screenshot salvo: ${tv1080HomePath}`);

    await tv1080Page.click('button[data-focus-key="tv-nav-search"]');
    await tv1080Page.waitForTimeout(800);
    const tv1080SearchPath = path.join(OUTPUT_DIR, '09_smarttv_1920x1080_search.png');
    await tv1080Page.screenshot({ path: tv1080SearchPath });
    console.log(`  📸 Screenshot salvo: ${tv1080SearchPath}`);

    await tv1080Context.close();

    console.log('\n========================================================================');
    console.log('🎉 TODAS AS EVIDÊNCIAS VISUAIS FORAM CAPTURADAS COM SUCESSO!');
    console.log(`Diretório: ${OUTPUT_DIR}`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('❌ Erro durante captura de evidências:', err);
    throw err;
  } finally {
    await browser.close();
    await viteServer.close();
    console.log('🛑 Servidor Vite encerrado.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
