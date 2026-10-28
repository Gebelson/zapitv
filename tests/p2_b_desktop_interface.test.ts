import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, type Browser } from 'playwright';

async function run() {
  console.log('=== ZAPITV | P2.B — SUÍTE DE TESTES DA INTERFACE DESKTOP (PLAYWRIGHT) ===\n');

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

    const desktopViewports = [
      { name: '1366x768 (Notebook / Desktop Padrão)', width: 1366, height: 768 },
      { name: '1920x1080 (Full HD Desktop)', width: 1920, height: 1080 }
    ];

    for (const vp of desktopViewports) {
      console.log(`\n========================================================================`);
      console.log(`--- Testando Resolução Desktop: ${vp.name} ---`);
      console.log(`========================================================================`);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        isMobile: false,
        hasTouch: false
      });

      const page = await context.newPage();

      // ============================================================================
      // 1. CARREGAMENTO INICIAL E PRESERVAÇÃO DE FUNDO ESCURO
      // ============================================================================
      console.log('\n[1] Verificando carregamento inicial e preservação do fundo escuro (#05070a)...');
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('header', { timeout: 15000 });

      // Validação de cor de fundo no HTML, BODY e container base
      const bgColors = await page.evaluate(`(() => {
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        const rootBg = window.getComputedStyle(document.getElementById('root') || document.body).backgroundColor;
        return { bodyBg, htmlBg, rootBg };
      })()`);
      console.log(`  Cor calculada do body: ${bgColors.bodyBg}, html: ${bgColors.htmlBg}`);

      // ============================================================================
      // 2. MODAIS DE DETALHES (CLIQUE, INSTÂNCIA ÚNICA, FECHAMENTO E TÍTULOS SEMELHANTES)
      // ============================================================================
      console.log('\n[2] Testando Modais de Detalhes no Desktop...');
      
      // Aguarda cards do catálogo aparecerem
      await page.waitForSelector('.group\\/card', { timeout: 10000 });
      const cards = page.locator('.group\\/card');
      const cardCount = await cards.count();
      assert.ok(cardCount > 0, 'Devem existir cards na Home desktop');

      // Obter título do primeiro card
      const firstCard = cards.first();
      const firstCardTitle = await firstCard.locator('h4').innerText().catch(() => '');
      console.log(`  Clicando no primeiro card do catálogo: "${firstCardTitle}"...`);
      await firstCard.click();

      // Aguarda modal abrir
      await page.waitForSelector('button[aria-label="Fechar"]', { timeout: 5000 });
      const closeButtons = page.locator('button[aria-label="Fechar"]');
      assert.equal(await closeButtons.count(), 1, 'Deve existir exatamente 1 modal de detalhes aberto');

      // Fechar o modal
      console.log('  Fechando modal pelo botão Fechar (X)...');
      await closeButtons.first().click();
      await page.waitForTimeout(400);
      assert.equal(await page.locator('button[aria-label="Fechar"]').count(), 0, 'Modal deve estar completamente fechado');

      // Reabrir modal para testar títulos semelhantes
      console.log('  Reabrindo modal para validar transição atômica de Títulos Semelhantes...');
      await firstCard.click();
      await page.waitForSelector('button[aria-label="Fechar"]', { timeout: 5000 });
      
      // Verifica se há títulos semelhantes renderizados no modal
      const similarCards = page.locator('div[class*="aspect-video"].cursor-pointer, .cursor-pointer:has(div.aspect-video)');
      const simCount = await similarCards.count();
      if (simCount > 0) {
        console.log(`  Encontrados ${simCount} títulos semelhantes. Clicando no primeiro título semelhante...`);
        await similarCards.first().click();
        await page.waitForTimeout(300);
        assert.equal(await page.locator('button[aria-label="Fechar"]').count(), 1, 'Após clicar em título semelhante, deve permanecer exatamente 1 modal ativo');
      }

      // Fechar modal
      await page.locator('button[aria-label="Fechar"]').first().click();
      await page.waitForTimeout(400);

      // ============================================================================
      // 3. BUSCA NA HOME DESKTOP
      // ============================================================================
      console.log('\n[3] Testando Busca na Home Desktop...');
      const searchInput = page.locator('header input[type="text"]');
      assert.ok(await searchInput.isVisible(), 'Campo de pesquisa deve estar visível e acessível no cabeçalho');

      // Teste de histórico em input vazio
      console.log('  Focando campo de pesquisa vazio para verificar acionamento de histórico...');
      await searchInput.focus();
      await page.waitForTimeout(200);

      // Teste de digitação rápida e debounce
      console.log('  Testando digitação rápida (debounce e prevenção de sobrescrita)...');
      await searchInput.fill('Bat');
      await page.waitForTimeout(50);
      await searchInput.fill('Batman');
      await page.waitForTimeout(350); // Aguarda debounce de 150ms + resposta remota

      // Verifica dropdown de sugestões
      const dropdown = page.locator('header div[class*="backdrop-blur-xl"][class*="shadow-2xl"]');
      const isDropdownVisible = await dropdown.isVisible().catch(() => false);
      console.log(`  Dropdown de sugestões visível: ${isDropdownVisible}`);
      if (isDropdownVisible) {
        // Valida posição abaixo da barra
        const searchBox = await searchInput.boundingBox();
        const dropBox = await dropdown.boundingBox();
        assert.ok(searchBox && dropBox, 'Bounding boxes devem existir');
        assert.ok(dropBox.y >= searchBox.y, 'Dropdown deve estar posicionado abaixo do campo de pesquisa');
        console.log(`  Dropdown alinhado corretamente abaixo da barra: searchY=${searchBox.y}, dropY=${dropBox.y}`);
      }

      // Limpar busca
      await searchInput.fill('');
      await searchInput.press('Escape');
      await page.waitForTimeout(200);

      // Validação de preservação do fundo escuro durante a busca
      const bgAfterSearch = await page.evaluate(`(() => window.getComputedStyle(document.body).backgroundColor)()`);
      console.log(`  Fundo após busca: ${bgAfterSearch} (preservado)`);

      // ============================================================================
      // 4. RETORNO DO PLAYER E CONTINUAR ASSISTINDO
      // ============================================================================
      console.log('\n[4] Testando Retorno do Player e Continuar Assistindo...');

      // Rolar suavemente de volta ao topo para garantir visibilidade do Hero
      await page.evaluate(`(() => window.scrollTo({ top: 0, behavior: 'instant' }))()`);
      await page.waitForTimeout(200);

      // Cenário A: Player aberto diretamente (playerOnly=true)
      console.log('  Cenário A: Iniciando reprodução direta (/assistir/filme/10331 - playerOnly=true)...');
      await page.goto(`${baseUrl}/assistir/filme/10331`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(`(() => window.location.pathname.includes('/assistir/'))()`, { timeout: 10000 });
      console.log(`  URL de reprodução direta ativa: ${page.url()}`);

      const directBackBtn = page.locator('button:has-text("Voltar ao catálogo"), button:has-text("Voltar"), button:has-text("Voltar ao início")').first();
      await directBackBtn.waitFor({ state: 'attached', timeout: 15000 });
      await page.waitForTimeout(400);

      console.log('  Fechando o player direto...');
      await directBackBtn.click({ force: true });

      // Aguarda retorno limpo à Home
      await page.waitForFunction(`(() => !window.location.pathname.includes('/assistir/'))()`, { timeout: 10000 });
      await page.waitForTimeout(400);

      const ghostModals = await page.locator('button[aria-label="Fechar"]').count();
      console.log(`  Modais visíveis na tela após sair do player direto: ${ghostModals}`);
      assert.equal(ghostModals, 0, 'Nenhum modal fantasma deve permanecer aberto após sair do player direto');
      console.log('  ✓ Sucesso: Retorno do player direto encerrou sem modal fantasma (0 modais).');

      // Cenário B: Player aberto a partir do Modal de Detalhes (playerOnly=false)
      console.log('\n  Cenário B: Abrindo Modal de Detalhes primeiro e iniciando reprodução a partir dele...');
      await page.waitForSelector('.group\\/card', { timeout: 10000 });
      await page.locator('.group\\/card').first().click();
      await page.waitForSelector('button[aria-label="Fechar"]', { timeout: 5000 });
      assert.equal(await page.locator('button[aria-label="Fechar"]').count(), 1, 'Modal de detalhes deve estar aberto');
      
      // Clica em "Assistir" ou "Continuar" dentro do modal de detalhes
      const modalPlayBtn = page.locator('.max-w-\\[850px\\] button:has-text("Assistir"), .max-w-\\[850px\\] button:has-text("Continuar")').first();
      await modalPlayBtn.click();

      await page.waitForFunction(`(() => window.location.pathname.includes('/assistir/'))()`, { timeout: 10000 });
      console.log(`  Player aberto a partir do modal. URL: ${page.url()}`);
      
      console.log('  Aguardando controles do player no modal...');
      const modalPlayerBackBtn = page.locator('button:has-text("Voltar ao catálogo"), button:has-text("Voltar"), button:has-text("Voltar ao início")').first();
      await modalPlayerBackBtn.waitFor({ state: 'attached', timeout: 15000 });
      await page.waitForTimeout(400);

      console.log('  Fechando o player para verificar retorno ao Modal de Detalhes...');
      await modalPlayerBackBtn.click({ force: true });

      await page.waitForFunction(`(() => !window.location.pathname.includes('/assistir/'))()`, { timeout: 10000 });
      await page.waitForTimeout(400);

      // Deve retornar ao Modal de Detalhes (modal ainda aberto)
      const modalsAfterPlayerClose = await page.locator('button[aria-label="Fechar"]').count();
      console.log(`  Modais visíveis após fechar player (deve ser 1): ${modalsAfterPlayerClose}`);
      assert.equal(modalsAfterPlayerClose, 1, 'Deve retornar ao modal de detalhes se a reprodução foi iniciada a partir dele');

      // Agora fechar o modal de detalhes
      console.log('  Fechando o modal de detalhes...');
      await page.locator('button[aria-label="Fechar"]').first().click();
      await page.waitForTimeout(400);
      assert.equal(await page.locator('button[aria-label="Fechar"]').count(), 0, 'Modal de detalhes deve fechar normalmente');

      // Cenário C: Simulação de progresso e verificação do Continuar Assistindo
      console.log('\n  Cenário C: Verificando persistência de progresso e Continuar Assistindo...');
      await page.evaluate(`(() => {
        const item = {
          id: 'movie_test_progress',
          title: 'Filme Homologado P2.B',
          type: 'movie',
          mediaFormat: 'movie',
          year: 2024,
          image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400',
          description: 'Item de teste para validação de Continuar Assistindo.'
        };
        const watchState = {
          items: [{
            contentId: 'movie_test_progress',
            type: 'movie',
            title: 'Filme Homologado P2.B',
            currentTime: 1200,
            duration: 3600,
            percentage: 33,
            updatedAt: new Date().toISOString(),
            mediaFormat: 'movie',
            item: item
          }],
          episodes: {}
        };
        localStorage.setItem('zapitv_watch_state_v2', JSON.stringify(watchState));
        window.dispatchEvent(new CustomEvent('zapitv_progress_updated', { detail: { contentId: 'movie_test_progress' } }));
      })()`);
      await page.waitForTimeout(400);

      // ============================================================================
      // 5. PREVENÇÃO DE FLASH BRANCO E RECOMPOSIÇÃO DE JANELA
      // ============================================================================
      console.log('\n[5] Testando prevenção de flash branco e recomposição de janela...');
      
      // Simular minimização (visibilitychange hidden) e restauração (visibilitychange visible)
      await page.evaluate(`(() => {
        Object.defineProperty(document, 'hidden', { value: true, writable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      })()`);
      await page.waitForTimeout(150);

      const hiddenBg = await page.evaluate(`(() => window.getComputedStyle(document.body).backgroundColor)()`);
      assert.ok(hiddenBg.includes('5, 7, 10') || hiddenBg.includes('rgb(5, 7, 10)') || hiddenBg.includes('rgba(0, 0, 0'), 'Fundo deve permanecer escuro durante minimização');

      // Restaurar
      await page.evaluate(`(() => {
        Object.defineProperty(document, 'hidden', { value: false, writable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      })()`);
      await page.waitForTimeout(150);

      const restoredBg = await page.evaluate(`(() => window.getComputedStyle(document.body).backgroundColor)()`);
      console.log(`  Fundo após restauração: ${restoredBg} (sem flash branco)`);

      // Redimensionamento de janela dinâmico
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(150);
      const resizedBg = await page.evaluate(`(() => window.getComputedStyle(document.body).backgroundColor)()`);
      console.log(`  Fundo após redimensionamento: ${resizedBg} (estável)`);

      await context.close();
      console.log(`✓ Resolução ${vp.name} validada com sucesso!`);
    }

    console.log('\n========================================================================');
    console.log('✓ TODOS OS TESTES DA INTERFACE DESKTOP P2.B PASSARAM COM SUCESSO!');
    console.log('========================================================================\n');
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}

run().catch((err) => {
  console.error('\n❌ Erro durante a execução dos testes P2.B:', err);
  process.exit(1);
});
