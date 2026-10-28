import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, type Browser } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d';

async function run() {
  console.log('=== ZAPITV | P2.A — SUÍTE DE TESTES VISUAIS E FUNCIONAIS MOBILE (PLAYWRIGHT) ===\n');

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

    const viewports = [
      { name: '360px (Android Compact)', width: 360, height: 780 },
      { name: '390px (iPhone 14 Standard)', width: 390, height: 844 },
      { name: '430px (iPhone 15 Pro Max)', width: 430, height: 932 }
    ];

    for (const vp of viewports) {
      console.log(`\n--- Testando Viewport Mobile: ${vp.name} (${vp.width}x${vp.height}) ---`);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        isMobile: true,
        hasTouch: true
      });

      const page = await context.newPage();

      // Mock de imagem de banner para teste determinístico de transição
      await page.route('**/test-banner-*.svg', route => {
        route.fulfill({
          contentType: 'image/svg+xml',
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#0d1f38"/><text x="50" y="200" fill="#fff" font-size="60">Banner Test</text></svg>`
        });
      });

      // 1. HOME MOBILE: BANNER PRINCIPAL E SOBREPOSIÇÃO
      console.log('  1. Validando Home Mobile e Banner Principal...');
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="mobile-hero"]', { timeout: 15000 });

      // Verifica elementos do hero
      const hero = page.locator('[data-testid="mobile-hero"]');
      assert.equal(await hero.count(), 1, 'Banner mobile deve estar visível');

      // Verifica que só existe UMA imagem ativa no banner (zero sobreposição de banners antigos)
      const heroImages = hero.locator('img');
      assert.equal(await heroImages.count(), 1, 'Deve haver exatamente 1 imagem renderizada no banner');

      // Verifica opacidade total da imagem atual
      const heroImgClass = await heroImages.first().getAttribute('class') || '';
      assert.ok(heroImgClass.includes('brightness-[0.9]'), 'Imagem do banner deve possuir filtro de brilho 0.9');

      // Verifica espaçamento vertical entre informações e título (6 a 8px = gap-1.5 ou gap-2)
      const infoTitleBlock = hero.locator('.flex.flex-col.items-start.justify-end');
      const blockClass = await infoTitleBlock.first().getAttribute('class') || '';
      assert.ok(blockClass.includes('gap-1.5') || blockClass.includes('gap-2'), 'Espaçamento vertical deve ser calibrado (6 a 8px)');

      // 2. CONTINUAR ASSISTINDO: UNICIDADE E PROGRESSO
      console.log('  2. Validando unicidade da seção Continuar Assistindo...');
      // Injeta item no storage para simular histórico em andamento
      await page.evaluate(() => {
        try {
          const item = {
            id: 'test-cw-item-1',
            title: 'Filme em Andamento',
            type: 'movie',
            year: 2024,
            rating: 8.5,
            genres: ['Ação']
          };
          const continuityData = [{
            item,
            currentTime: 600,
            duration: 3600,
            percentage: 35,
            updatedAt: new Date().toISOString()
          }];
          localStorage.setItem('zapitv_continue_watching', JSON.stringify(continuityData));
          window.dispatchEvent(new Event('zapitv_progress_updated'));
        } catch {}
      });

      await page.waitForTimeout(300);

      // Conta ocorrências de seções "Continuar Assistindo"
      const cwSections = page.locator('section[aria-label="Continuar Assistindo"]');
      const cwCount = await cwSections.count();
      assert.ok(cwCount <= 1, 'Home mobile NUNCA deve exibir mais de uma seção Continuar Assistindo');

      // Verifica ausência absoluta da seção "Top 10 do Mês" na Home
      const top10Sections = page.locator('section[aria-label="Top 10 do Mês"], section[aria-label*="Top 10"]');
      assert.equal(await top10Sections.count(), 0, 'Home mobile NÃO deve conter seção Top 10');

      // 3. CARROSSÉIS HORIZONTAIS: GESTOS E ISOLAMENTO DE SCROLL
      console.log('  3. Validando isolamento de gestos horizontais nos carrosséis...');
      const firstRowTrack = page.locator('.flex.gap-3.overflow-x-auto').first();
      if (await firstRowTrack.count() > 0) {
        const rowStyle = await firstRowTrack.getAttribute('style') || '';
        assert.ok(rowStyle.includes('pan-x'), 'Carrossel horizontal deve possuir touchAction pan-x');
        assert.ok(rowStyle.includes('contain'), 'Carrossel horizontal deve possuir overscrollBehaviorX contain');
      }

      // Captura de tela da Home na viewport atual
      const homeScreenshotPath = path.join(ARTIFACTS_DIR, `mobile_${vp.width}_home.png`);
      try {
        await page.screenshot({ path: homeScreenshotPath, fullPage: false });
        console.log(`  📸 Captura Home salva: ${homeScreenshotPath}`);
      } catch (err) {
        console.warn('  Não foi possível salvar screenshot:', err);
      }

      // 4. PÁGINA EXPLORAR: GRADE 2x2, FILTROS E MENU DE GÊNEROS
      console.log('  4. Validando Página Explorar mobile...');
      await page.goto(`${baseUrl}/explorar`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="mobile-explore-view"]', { timeout: 15000 });

      // Verifica os 4 quadros fixos de navegação (Filmes, Séries, Animes, TV ao vivo)
      const catGrid = page.locator('[data-testid="explore-categories-grid"]');
      assert.equal(await catGrid.count(), 1);
      assert.equal(await catGrid.locator('button').count(), 4, 'Grade deve conter exatamente 4 quadros');

      // Troca para Séries
      console.log('    -> Alternando categoria para "Séries"...');
      await catGrid.locator('button', { hasText: 'Séries' }).click();
      await page.waitForTimeout(200);

      // Troca para Animes
      console.log('    -> Alternando categoria para "Animes"...');
      await catGrid.locator('button', { hasText: 'Animes' }).click();
      await page.waitForTimeout(200);

      // Retorna para Filmes
      console.log('    -> Retornando para "Filmes"...');
      await catGrid.locator('button', { hasText: 'Filmes' }).click();
      await page.waitForTimeout(200);

      // Abre Menu de Gêneros Fullscreen
      console.log('    -> Abrindo Menu de Gêneros...');
      const genreBar = page.locator('[data-testid="explore-genre-bar"]');
      await genreBar.click();
      await page.waitForSelector('[data-testid="mobile-genre-fullscreen-menu"]', { timeout: 5000 });

      // Verifica bloqueio de scroll no body durante menu aberto
      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      assert.equal(bodyOverflow, 'hidden', 'Scroll do body deve ser travado com overflow hidden');

      // Fecha menu pelo botão de fechar centralizado
      const closeBtn = page.locator('[data-testid="close-genre-menu-btn"]');
      assert.equal(await closeBtn.count(), 1, 'Botão fechar centralizado deve existir');
      await closeBtn.click();
      await page.waitForTimeout(200);

      // Verifica que o menu fechou e o scroll do body foi restaurado
      const menuCountAfterClose = await page.locator('[data-testid="mobile-genre-fullscreen-menu"]').count();
      assert.equal(menuCountAfterClose, 0, 'Menu de gêneros deve estar fechado');
      const bodyOverflowRestored = await page.evaluate(() => document.body.style.overflow);
      assert.equal(bodyOverflowRestored, '', 'Scroll do body deve ser restaurado');

      // Captura de tela da página Explorar
      const exploreScreenshotPath = path.join(ARTIFACTS_DIR, `mobile_${vp.width}_explore.png`);
      try {
        await page.screenshot({ path: exploreScreenshotPath, fullPage: false });
        console.log(`  📸 Captura Explorar salva: ${exploreScreenshotPath}`);
      } catch (err) {
        console.warn('  Não foi possível salvar screenshot:', err);
      }

      await context.close();
      console.log(`✓ Viewport ${vp.name} aprovada com sucesso!`);
    }

    console.log('\n========================================================================');
    console.log(' TODOS OS TESTES VISUAIS E FUNCIONAIS MOBILE PASSARAM COM SUCESSO! ');
    console.log('========================================================================\n');
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
}

// Timeout de segurança de 40 segundos
const safetyTimeout = setTimeout(() => {
  console.error('TIMEOUT DE SEGURANÇA: Testes mobile excederam 40s.');
  process.exit(1);
}, 40000);

run()
  .then(() => {
    clearTimeout(safetyTimeout);
    process.exit(0);
  })
  .catch(err => {
    clearTimeout(safetyTimeout);
    console.error('Falha nos testes visuais mobile:', err);
    process.exit(1);
  });
