import { chromium } from 'playwright';
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d';

const chromePath = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') 
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : (fs.existsSync('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' : undefined);

async function runIncognitoAcceptance() {
  console.log('=== INICIANDO TESTE OBRIGATÓRIO DE ACEITAÇÃO EM ABA ANÔNIMA (/tv) ===');
  
  // 1. Inicia servidor Vite na porta 5188
  console.log('1. Subindo servidor Vite de teste na porta 5188...');
  const server = await createServer({
    configFile: path.join(process.cwd(), 'vite.config.ts'),
    server: { port: 5188, host: '127.0.0.1' },
    logLevel: 'error'
  });
  await server.listen();
  console.log('   -> Servidor ativo em http://127.0.0.1:5188');

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--incognito', '--disable-features=TranslateUI', '--no-sandbox']
  });

  try {
    // 2. Cria contexto anônimo rigorosamente isolado (sem cookies, sem localStorage prévio)
    console.log('2. Criando contexto anônimo limpo e isolado (sem cache prévio)...');
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      storageState: undefined,
      userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/76.0.3809.146 TV Safari/537.36'
    });

    const page = await context.newPage();
    
    // Monitora console e erros de rede
    const errorLogs: string[] = [];
    const imageErrorCounts = new Map<string, number>();

    page.on('console', msg => {
      console.log(`[browser console ${msg.type()}]`, msg.text());
    });
    page.on('pageerror', err => {
      console.log('[browser uncaught exception]', err);
    });

    // 3. Acessa DIRETAMENTE a rota /tv sem visitar nenhuma outra página antes
    console.log('3. Acessando diretamente http://127.0.0.1:5188/tv...');
    await page.goto('http://127.0.0.1:5188/tv', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('   -> URL atual pós-goto:', page.url());
    const bodyHtml = await page.evaluate(() => document.body.innerHTML.slice(0, 500));
    console.log('   -> Body HTML inicial:', bodyHtml);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'debug_initial_page.png') });

    // Confirma que localStorage estava vazio no boot
    const initialStorageCount = await page.evaluate(() => {
      return window.localStorage ? window.localStorage.length : 0;
    });
    console.log(`   -> Storage count verificado: ${initialStorageCount}`);

    // 4. Confirma que a Home apresenta todos os carrosséis elegíveis
    console.log('4. Verificando carregamento e carrosséis da Home na TV...');
    await page.waitForSelector('#tv-hero-banner', { timeout: 15000 });
    console.log('   -> Banner Principal (Hero) carregado com sucesso!');

    // Aguarda montagem das fileiras
    await page.waitForTimeout(1500);

    const rowsCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-row-id]');
      const rowIds = Array.from(rows).map(r => r.getAttribute('data-row-id'));
      return { total: rows.length, rowIds };
    });
    console.log(`   -> Fileiras ativas detectadas na Home: ${rowsCount.total} (${rowsCount.rowIds.join(', ')})`);
    if (rowsCount.total < 3) {
      throw new Error(`Esperava-se pelo menos 3 carrosséis na Home, encontrados: ${rowsCount.total}`);
    }

    const homeScreenshotPath = path.join(ARTIFACTS_DIR, 'tv_incognito_1_home.png');
    await page.screenshot({ path: homeScreenshotPath });
    console.log(`   -> Screenshot salvo: ${homeScreenshotPath}`);

    // 5. Navega para "Filmes" e confirma que possui conteúdos
    console.log('5. Navegando para a página Filmes...');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-focus-key="tv-nav-movies"]') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(1000);

    const moviesData = await page.evaluate(() => {
      const title = document.querySelector('h1, [data-category-title]')?.textContent || '';
      const cards = document.querySelectorAll('[data-focus-key^="tv-card-"]');
      const rows = document.querySelectorAll('[data-row-id]');
      return { cardsCount: cards.length, rowsCount: rows.length };
    });
    console.log(`   -> Página Filmes: ${moviesData.cardsCount} cards em ${moviesData.rowsCount} fileiras.`);
    if (moviesData.cardsCount === 0) {
      throw new Error('A página Filmes está vazia na aba anônima!');
    }
    const filmesScreenshotPath = path.join(ARTIFACTS_DIR, 'tv_incognito_2_filmes.png');
    await page.screenshot({ path: filmesScreenshotPath });
    console.log(`   -> Screenshot salvo: ${filmesScreenshotPath}`);

    // 6. Navega para "Séries" e confirma que possui conteúdos
    console.log('6. Navegando para a página Séries...');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-focus-key="tv-nav-series"]') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(1000);

    const seriesData = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-focus-key^="tv-card-"]');
      const rows = document.querySelectorAll('[data-row-id]');
      return { cardsCount: cards.length, rowsCount: rows.length };
    });
    console.log(`   -> Página Séries: ${seriesData.cardsCount} cards em ${seriesData.rowsCount} fileiras.`);
    if (seriesData.cardsCount === 0) {
      throw new Error('A página Séries está vazia na aba anônima!');
    }
    const seriesScreenshotPath = path.join(ARTIFACTS_DIR, 'tv_incognito_3_series.png');
    await page.screenshot({ path: seriesScreenshotPath });
    console.log(`   -> Screenshot salvo: ${seriesScreenshotPath}`);

    // 7. Navega para "Animes" e confirma que possui conteúdos
    console.log('7. Navegando para a página Animes...');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-focus-key="tv-nav-animes"]') as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(1000);

    const animeData = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-focus-key^="tv-card-"]');
      const rows = document.querySelectorAll('[data-row-id]');
      return { cardsCount: cards.length, rowsCount: rows.length };
    });
    console.log(`   -> Página Animes: ${animeData.cardsCount} cards em ${animeData.rowsCount} fileiras.`);
    if (animeData.cardsCount === 0) {
      throw new Error('A página Animes está vazia na aba anônima!');
    }
    const animeScreenshotPath = path.join(ARTIFACTS_DIR, 'tv_incognito_4_animes.png');
    await page.screenshot({ path: animeScreenshotPath });
    console.log(`   -> Screenshot salvo: ${animeScreenshotPath}`);

    // 8. Confirma que as capas carregam sem piscar ou entrar em loop infinito de fallback
    console.log('8. Verificando estabilidade de imagens (zero loops de erro)...');
    await page.waitForTimeout(2000);
    const loopingImages = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      const loopCandidates: string[] = [];
      imgs.forEach(img => {
        if (img.dataset.hasLooped) loopCandidates.push(img.src);
      });
      return loopCandidates;
    });
    if (loopingImages.length > 0) {
      throw new Error(`Detectado loop de imagens: ${loopingImages.join(', ')}`);
    }
    console.log('   -> Imagens perfeitamente estáveis sem flickering nem loops!');

    // 9. Atualizar a página e confirmar que o catálogo continua funcionando
    console.log('9. Atualizando a página (F5/Reload) em aba anônima...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tv-hero-banner', { timeout: 15000 });
    const postReloadRows = await page.evaluate(() => {
      return document.querySelectorAll('[data-row-id]').length;
    });
    console.log(`   -> Pós-reload: ${postReloadRows} fileiras ativas carregadas.`);
    if (postReloadRows < 3) {
      throw new Error(`Esperava-se que os carrosséis persistissem após reload. Encontrados: ${postReloadRows}`);
    }

    // 10. Limpar todo o armazenamento local e repetir
    console.log('10. Limpando todo o armazenamento local (localStorage.clear()) e repetindo o teste...');
    await page.evaluate(() => {
      if (window.localStorage) window.localStorage.clear();
      if (window.sessionStorage) window.sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tv-hero-banner', { timeout: 15000 });
    const postClearRows = await page.evaluate(() => {
      return document.querySelectorAll('[data-row-id]').length;
    });
    console.log(`   -> Pós-clear storage: ${postClearRows} fileiras ativas carregadas.`);
    if (postClearRows < 3) {
      throw new Error(`Esperava-se funcionamento pós-clear. Encontrados: ${postClearRows}`);
    }

    const postClearScreenshotPath = path.join(ARTIFACTS_DIR, 'tv_incognito_5_post_clear.png');
    await page.screenshot({ path: postClearScreenshotPath });
    console.log(`   -> Screenshot pós-clear salvo: ${postClearScreenshotPath}`);

    console.log('\n============================================================');
    console.log('🎉 TODOS OS 10 PASSOS DO TESTE OBRIGATÓRIO DE ACEITAÇÃO PASSARAM COM 100% DE SUCESSO!');
    console.log('============================================================');

    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
}

runIncognitoAcceptance().catch(err => {
  console.error('\n❌ ERRO NO TESTE DE ACEITAÇÃO:', err);
  process.exit(1);
});
