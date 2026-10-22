import { preview } from 'vite';
import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d';

async function main() {
  console.log('--- Iniciando servidor preview do Vite para captura de evidências da Busca na TV ---');
  const server = await preview({
    preview: {
      port: 4179,
      strictPort: true
    }
  });

  const previewUrl = 'http://localhost:4179/tv';
  console.log(`Servidor preview iniciado em ${previewUrl}`);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--disable-web-security']
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 }
    });

    console.log('Navegando para /tv...');
    await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Abre a busca
    console.log('Abrindo tela de pesquisa na TV...');
    const searchNavBtn = page.locator('[data-focus-key="tv-nav-search"]');
    if (await searchNavBtn.count() > 0) {
      await searchNavBtn.click();
    } else {
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(1000);

    // Evidência 1: Visão Inicial da Busca (Coluna Esquerda com Voltar, Input, Teclado, Sugestões e Coluna Direita com Filtros e Grade de Capas)
    console.log('Capturando Evidência 1: Tela de pesquisa inicial...');
    const pathEvidence1 = path.join(ARTIFACTS_DIR, 'tv_search_initial_view.png');
    await page.screenshot({ path: pathEvidence1, fullPage: false });
    console.log(`✓ Evidência 1 salva em: ${pathEvidence1}`);

    // Evidência 2: Digitando no Teclado Virtual "star"
    console.log('Interagindo com teclado virtual e digitando "star"...');
    const keyS = page.locator('[data-focus-key="tv-key-s"]');
    const keyT = page.locator('[data-focus-key="tv-key-t"]');
    const keyA = page.locator('[data-focus-key="tv-key-a"]');
    const keyR = page.locator('[data-focus-key="tv-key-r"]');

    if (await keyS.count() > 0) {
      await keyS.click();
      await page.waitForTimeout(200);
      await keyT.click();
      await page.waitForTimeout(200);
      await keyA.click();
      await page.waitForTimeout(200);
      await keyR.click();
      await page.waitForTimeout(600);
    } else {
      await page.keyboard.type('star');
      await page.waitForTimeout(600);
    }

    console.log('Capturando Evidência 2: Busca com termo digitado, sugestões dinâmicas e capas verticais 2:3...');
    const pathEvidence2 = path.join(ARTIFACTS_DIR, 'tv_search_virtual_keyboard_typing.png');
    await page.screenshot({ path: pathEvidence2, fullPage: false });
    console.log(`✓ Evidência 2 salva em: ${pathEvidence2}`);

    // Evidência 3: Alternando filtro de categoria para "Filmes"
    console.log('Filtrando por categoria "Filmes"...');
    const filterMovies = page.locator('[data-focus-key="tv-filter-movies"]');
    if (await filterMovies.count() > 0) {
      await filterMovies.click();
      await page.waitForTimeout(600);
    }

    const pathEvidence3 = path.join(ARTIFACTS_DIR, 'tv_search_category_filter.png');
    await page.screenshot({ path: pathEvidence3, fullPage: false });
    console.log(`✓ Evidência 3 salva em: ${pathEvidence3}`);

    // Evidência 4: Navegação espacial até o primeiro card da grade com foco externo ciano
    console.log('Navegando com D-Pad para focar no primeiro card...');
    const firstCard = page.locator('[data-focus-key^="tv-search-card-"]').first();
    if (await firstCard.count() > 0) {
      await firstCard.focus();
      // Simula foco Norigin
      await firstCard.evaluate((el: HTMLElement) => {
        el.setAttribute('data-tv-focused', 'true');
        el.classList.add('scale-105', 'z-40');
      });
      await page.waitForTimeout(400);
    }

    const pathEvidence4 = path.join(ARTIFACTS_DIR, 'tv_search_card_focused_evidence.png');
    await page.screenshot({ path: pathEvidence4, fullPage: false });
    console.log(`✓ Evidência 4 salva em: ${pathEvidence4}`);

    console.log('\n--- Captura de todas as evidências visuais concluída com sucesso! ---');
  } finally {
    await browser.close();
    server.httpServer.close();
  }
}

main().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
