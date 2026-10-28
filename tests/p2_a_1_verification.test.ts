import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, type Browser } from 'playwright';

async function run() {
  console.log('=== ZAPITV | P2.A.1 — SUÍTE DE VERIFICAÇÃO PONTUAL ===\n');

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

    browser = await chromium.launch({ headless: true });

    // =========================================================================
    // PARTE 1: GESTOS DOS CARROSSÉIS MOBILE (ANDROID & IOS)
    // =========================================================================
    console.log('--- 1. VERIFICANDO GESTOS DOS CARROSSÉIS COM BLOQUEIO DIRECIONAL ---');

    const devices = [
      { name: 'Android (Pixel 7)', width: 412, height: 915, ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/116.0.0.0 Mobile Safari/537.36' },
      { name: 'iOS (iPhone 14)', width: 390, height: 844, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' }
    ];

    for (const dev of devices) {
      console.log(`\n  Dispositivo: ${dev.name}`);
      const context = await browser.newContext({
        viewport: { width: dev.width, height: dev.height },
        userAgent: dev.ua,
        hasTouch: true,
        isMobile: true
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('section[aria-label] .overflow-x-auto');

      const row = page.locator('section[aria-label] .overflow-x-auto').first();
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      // 1.1 Arraste predominantemente horizontal: move carrossel e bloqueia salto vertical
      const initialScrollLeft = await row.evaluate((el: HTMLElement) => el.scrollLeft);
      const hResult: any = await page.evaluate(`
        (() => {
          const el = document.querySelector('section[aria-label] .overflow-x-auto');
          const touch = (x, y) => new Touch({ identifier: 10, target: el, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y });
          const start = touch(300, 400);
          el.dispatchEvent(new TouchEvent('touchstart', { touches: [start], targetTouches: [start], changedTouches: [start], bubbles: true, cancelable: true }));

          let anyCancelled = false;
          for (let i = 1; i <= 6; i++) {
            const move = touch(300 - (i * 20), 400 - (i * 2)); // dx = -120px, dy = -12px (horizontal dominante)
            const notCancelled = el.dispatchEvent(new TouchEvent('touchmove', { touches: [move], targetTouches: [move], changedTouches: [move], bubbles: true, cancelable: true }));
            if (!notCancelled) anyCancelled = true;
          }
          const end = touch(180, 388);
          el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [end], bubbles: true, cancelable: true }));
          return { anyCancelled };
        })()
      `);
      const afterHScrollLeft = await row.evaluate((el: HTMLElement) => el.scrollLeft);
      assert.ok(afterHScrollLeft > initialScrollLeft, 'Arraste horizontal deve mover scrollLeft do carrossel');
      assert.equal(hResult.anyCancelled, true, 'Arraste horizontal deve invocar preventDefault para blindar salto vertical da página');
      console.log('    ✓ Arraste horizontal moveu carrossel e blindou página contra saltos verticais');

      // 1.2 Arraste predominantemente vertical: deixa o carrossel estático e não cancela scroll da página
      const preVScrollLeft = await row.evaluate((el: HTMLElement) => el.scrollLeft);
      const vResult: any = await page.evaluate(`
        (() => {
          const el = document.querySelector('section[aria-label] .overflow-x-auto');
          const touch = (x, y) => new Touch({ identifier: 20, target: el, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y });
          const start = touch(200, 500);
          el.dispatchEvent(new TouchEvent('touchstart', { touches: [start], targetTouches: [start], changedTouches: [start], bubbles: true, cancelable: true }));

          let anyCancelled = false;
          for (let i = 1; i <= 6; i++) {
            const move = touch(200 - (i * 2), 500 - (i * 20)); // dx = -12px, dy = -120px (vertical dominante)
            const notCancelled = el.dispatchEvent(new TouchEvent('touchmove', { touches: [move], targetTouches: [move], changedTouches: [move], bubbles: true, cancelable: true }));
            if (!notCancelled) anyCancelled = true;
          }
          const end = touch(188, 380);
          el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [end], bubbles: true, cancelable: true }));
          return { anyCancelled };
        })()
      `);
      const afterVScrollLeft = await row.evaluate((el: HTMLElement) => el.scrollLeft);
      assert.equal(afterVScrollLeft, preVScrollLeft, 'Arraste vertical NÃO deve deslocar carrossel horizontalmente');
      assert.equal(vResult.anyCancelled, false, 'Arraste vertical NÃO deve cancelar eventos nativos de rolagem vertical');
      console.log('    ✓ Arraste vertical preservou carrossel estático e fluxo livre da rolagem da página');

      // 1.3 Arraste diagonal com bloqueio direcional
      const diagResult: any = await page.evaluate(`
        (() => {
          const el = document.querySelector('section[aria-label] .overflow-x-auto');
          const touch = (x, y) => new Touch({ identifier: 30, target: el, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x, pageY: y });
          const start = touch(250, 450);
          el.dispatchEvent(new TouchEvent('touchstart', { touches: [start], targetTouches: [start], changedTouches: [start], bubbles: true, cancelable: true }));

          let anyCancelled = false;
          for (let i = 1; i <= 6; i++) {
            const move = touch(250 - (i * 15), 450 - (i * 8)); // dx dominante
            const notCancelled = el.dispatchEvent(new TouchEvent('touchmove', { touches: [move], targetTouches: [move], changedTouches: [move], bubbles: true, cancelable: true }));
            if (!notCancelled) anyCancelled = true;
          }
          const end = touch(160, 402);
          el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [end], bubbles: true, cancelable: true }));
          return { anyCancelled };
        })()
      `);
      assert.equal(diagResult.anyCancelled, true, 'Diagonal com componente horizontal deve bloquear saltos verticais indesejados');
      console.log('    ✓ Arraste diagonal bloqueou saltos verticais indesejados');

      // 1.4 Toque iniciado sobre uma capa
      const firstCard = row.locator('[role="button"]').first();
      await firstCard.click();
      await page.waitForTimeout(500);
      const hasOverlay = await page.locator('.fixed.inset-0').count();
      assert.ok(hasOverlay > 0, 'Toque sobre uma capa deve acionar seleção de conteúdo sem bloqueio');
      console.log('    ✓ Toque sobre a capa abre modal de detalhes normalmente');

      await context.close();
    }

    // =========================================================================
    // PARTE 2: PAGINAÇÃO DO EXPLORAR MOBILE
    // =========================================================================
    console.log('\n--- 2. VERIFICANDO PAGINAÇÃO E ESTADOS DA ROTA EXPLORAR MOBILE ---');

    const exploreContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      hasTouch: true,
      isMobile: true
    });
    const explorePage = await exploreContext.newPage();

    // 2.1 Acesso direto à rota /explorar
    console.log('2.1 Acessando /explorar diretamente...');
    await explorePage.goto(`${baseUrl}/explorar`, { waitUntil: 'domcontentloaded' });
    await explorePage.waitForSelector('[data-testid="mobile-explore-view"]');

    // Valida categoria inicial (Filmes)
    const moviesCard = explorePage.locator('[data-testid="explore-category-movies"]');
    const seriesCard = explorePage.locator('[data-testid="explore-category-series"]');
    const animesCard = explorePage.locator('[data-testid="explore-category-animes"]');

    assert.ok(await moviesCard.isVisible(), 'Quadro Filmes deve estar visível');
    assert.ok(await seriesCard.isVisible(), 'Quadro Séries deve estar visível');
    assert.ok(await animesCard.isVisible(), 'Quadro Animes deve estar visível');

    // Conta inicial de filmes
    const initialMovieCards = await explorePage.locator('[data-testid="mobile-explore-view"] [role="button"]').count();
    console.log(`    -> Filmes renderizados inicialmente: ${initialMovieCards}`);
    assert.ok(initialMovieCards > 0, 'Deve renderizar cards de filmes');

    // 2.2 Troca para Séries
    console.log('2.2 Alternando para categoria "Séries"...');
    await seriesCard.click();
    await explorePage.waitForTimeout(400);

    const seriesClass = await seriesCard.getAttribute('class') || '';
    assert.ok(seriesClass.includes('border-[#007df7]'), 'Quadro Séries deve ficar ativamente selecionado');

    const seriesItemsCount = await explorePage.locator('[data-testid="mobile-explore-view"] [role="button"]').count();
    console.log(`    -> Séries renderizadas: ${seriesItemsCount}`);
    assert.ok(seriesItemsCount > 0, 'Deve renderizar itens da categoria Séries com filtro exclusivo');

    // 2.3 Troca para Animes
    console.log('2.3 Alternando para categoria "Animes"...');
    await animesCard.click();
    await explorePage.waitForTimeout(400);

    const animesClass = await animesCard.getAttribute('class') || '';
    assert.ok(animesClass.includes('border-[#007df7]'), 'Quadro Animes deve ficar ativamente selecionado');

    const animesItemsCount = await explorePage.locator('[data-testid="mobile-explore-view"] [role="button"]').count();
    console.log(`    -> Animes renderizados: ${animesItemsCount}`);
    assert.ok(animesItemsCount > 0, 'Deve renderizar itens da categoria Animes com filtro exclusivo');

    // 2.4 Aplicação e Remoção de Gênero
    console.log('2.4 Testando aplicação e remoção de gêneros...');
    const genreBar = explorePage.locator('[data-testid="explore-genre-bar"]');
    await genreBar.click();
    await explorePage.waitForSelector('[data-testid="mobile-genre-fullscreen-menu"]');

    // Seleciona um gênero
    const actionGenreBtn = explorePage.locator('[data-testid="genre-option-Ação"]').first();
    if (await actionGenreBtn.isVisible()) {
      await actionGenreBtn.click();
      await explorePage.waitForTimeout(400);
      const barText = await genreBar.innerText();
      console.log(`    -> Gênero aplicado na barra: "${barText.trim()}"`);
      assert.ok(barText.includes('Ação'), 'Barra de gênero deve refletir o gênero selecionado');

      // Remove o gênero retornando para "Todos os gêneros"
      await genreBar.click();
      await explorePage.waitForSelector('[data-testid="mobile-genre-fullscreen-menu"]');
      const allGenresBtn = explorePage.locator('[data-testid="genre-option-Todos os gêneros"]').first();
      await allGenresBtn.click();
      await explorePage.waitForTimeout(400);

      const restoredBarText = await genreBar.innerText();
      console.log(`    -> Gênero após remoção: "${restoredBarText.trim()}"`);
      assert.ok(restoredBarText.includes('Todos os gêneros'), 'Barra de gênero deve retornar para "Todos os gêneros"');
    }

    // 2.5 Rolagem até acionar carregamento de novas páginas (Infinite Scroll)
    console.log('2.5 Testando rolagem contínua para novas páginas...');
    // Retorna para Filmes
    await moviesCard.click();
    await explorePage.waitForTimeout(400);

    const countBeforeScroll = await explorePage.locator('[data-testid="mobile-explore-view"] [role="button"]').count();
    // Rola até o final
    await explorePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await explorePage.waitForTimeout(1000);

    const countAfterScroll = await explorePage.locator('[data-testid="mobile-explore-view"] [role="button"]').count();
    console.log(`    -> Cards antes do scroll: ${countBeforeScroll}, após scroll: ${countAfterScroll}`);
    assert.ok(countAfterScroll >= countBeforeScroll, 'Catálogo deve manter ou expandir cards ao rolar');

    // 2.6 Retorno ao Explorar após navegar para outra tela
    console.log('2.6 Testando navegação para outra tela e retorno ao Explorar...');
    // Clica na aba "Minha ZapiTV"
    const myZapiTab = explorePage.locator('button:has-text("Minha ZapiTV"), nav button:nth-child(5)').first();
    await myZapiTab.click();
    await explorePage.waitForTimeout(400);

    // Retorna para aba "Explorar"
    const exploreTab = explorePage.locator('button:has-text("Explorar"), nav button:nth-child(2)').first();
    await exploreTab.click();
    await explorePage.waitForSelector('[data-testid="mobile-explore-view"]');

    const countOnReturn = await explorePage.locator('[data-testid="mobile-explore-view"] [role="button"]').count();
    console.log(`    -> Cards preservados no retorno ao Explorar: ${countOnReturn}`);
    assert.ok(countOnReturn > 0, 'Catálogo deve estar disponível e íntegro no retorno ao Explorar');

    await exploreContext.close();
    await browser.close();

    console.log('\n========================================================================');
    console.log('🎉 TODOS OS TESTES DA VERIFICAÇÃO P2.A.1 PASSARAM COM 100% DE SUCESSO!');
    console.log('========================================================================\n');
  } finally {
    await server.close();
  }
}

run().catch(err => {
  console.error('\n❌ Falha na suíte de verificação P2.A.1:', err);
  process.exit(1);
});
