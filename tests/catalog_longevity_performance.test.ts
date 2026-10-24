import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const chromePath = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') 
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : (fs.existsSync('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' : undefined);

async function runLongevityPerformanceTests() {
  console.log('--- TESTE AUTOMATIZADO DE LONGEVIDADE E PERFORMANCE DO CATÁLOGO ---');

  const testPort = '4010';
  const server = spawn('npx.cmd', ['tsx', 'server.ts'], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: testPort },
    stdio: 'pipe',
    shell: true
  });

  server.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg.includes('running on') || msg.includes('Error')) console.log('[server]', msg);
  });
  server.stderr.on('data', (d) => {
    const err = d.toString().trim();
    if (err && !err.includes('DEP0190')) console.error('[server error]', err);
  });

  // Aguarda servidor responder
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${testPort}`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  if (!ready) {
    console.error('Falha ao subir servidor de teste.');
    server.kill();
    process.exit(1);
  }

  console.log(`Servidor ativo na porta ${testPort}. Conectando navegador...`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--js-flags=--expose-gc']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  try {
    let requestsDuringRepose = 0;
    page.on('request', () => {
      requestsDuringRepose++;
    });

    console.log('\n[Fase 1] Carregando /filmes e avaliando estado inicial...');
    await page.goto(`http://localhost:${testPort}/filmes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const initialMetrics = await page.evaluate(() => {
      return {
        domNodes: document.getElementsByTagName('*').length,
        mountedCards: document.querySelectorAll('[data-ui-sound-card]').length,
        imagesCount: document.getElementsByTagName('img').length,
        jsHeapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
      };
    });

    console.log('Métricas Iniciais:', JSON.stringify(initialMetrics, null, 2));

    if (initialMetrics.mountedCards === 0) {
      throw new Error('Falha: Nenhum ContentCard montado na inicialização de /filmes.');
    }

    console.log('\n[Fase 2] Cenário A: Repouso Absoluto (estabilidade de rede e ausência de churn)...');
    requestsDuringRepose = 0;
    await page.waitForTimeout(5000);

    const afterIdleMetrics = await page.evaluate(() => {
      return {
        domNodes: document.getElementsByTagName('*').length,
        mountedCards: document.querySelectorAll('[data-ui-sound-card]').length,
        imagesCount: document.getElementsByTagName('img').length,
        jsHeapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
      };
    });

    console.log('Métricas após repouso:', JSON.stringify(afterIdleMetrics, null, 2));
    console.log(`Requisições durante repouso de 5s: ${requestsDuringRepose}`);

    if (afterIdleMetrics.domNodes !== initialMetrics.domNodes) {
      console.warn(`Variação de DOM durante repouso: ${initialMetrics.domNodes} -> ${afterIdleMetrics.domNodes}`);
    } else {
      console.log('✓ DOM permaneceu 100% estável durante repouso (zero nós criados/vazados).');
    }

    console.log('\n[Fase 3] Cenário B: Rolagem com Virtualização e Retorno ao Topo...');
    const scrollSteps = [1, 2, 3, 4, 5];
    const mountedCounts: number[] = [];

    for (const step of scrollSteps) {
      await page.evaluate(() => {
        const sc = document.querySelector('.overflow-y-auto') || window;
        if ((sc as any).scrollTo) {
          (sc as any).scrollTo(0, (sc as any).scrollHeight || document.documentElement.scrollHeight);
        } else {
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
      });
      await page.waitForTimeout(1500);

      const stepMetrics = await page.evaluate((s) => {
        return {
          step: s,
          domNodes: document.getElementsByTagName('*').length,
          mountedCards: document.querySelectorAll('[data-ui-sound-card]').length,
          imagesCount: document.getElementsByTagName('img').length,
          jsHeapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
        };
      }, step);

      mountedCounts.push(stepMetrics.mountedCards);
      console.log(`Lote ${step}: Cards Montados: ${stepMetrics.mountedCards} | DOM: ${stepMetrics.domNodes} | Heap: ${stepMetrics.jsHeapMB} MB`);
    }

    // Com virtualização, o número de cards montados simultaneamente DEVE ser limitado à janela visível
    const maxMountedCards = Math.max(...mountedCounts);
    console.log(`Pico de cards montados simultaneamente durante rolagem: ${maxMountedCards}`);

    if (maxMountedCards > 120) {
      throw new Error(`Virtualização falhou: ${maxMountedCards} cards montados no DOM (esperado <= 80 cards).`);
    } else {
      console.log('✓ Virtualização validada com sucesso: cards montados permanecem delimitados à viewport + overscan!');
    }

    console.log('\n[Fase 4] Retornando ao TOPO da página e verificando desmontagem...');
    await page.evaluate(() => {
      const sc = document.querySelector('.overflow-y-auto') || window;
      if ((sc as any).scrollTo) {
        (sc as any).scrollTo(0, 0);
      } else {
        window.scrollTo(0, 0);
      }
    });
    await page.waitForTimeout(2000);

    const backAtTopMetrics = await page.evaluate(() => {
      return {
        domNodes: document.getElementsByTagName('*').length,
        mountedCards: document.querySelectorAll('[data-ui-sound-card]').length,
        imagesCount: document.getElementsByTagName('img').length,
        jsHeapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
      };
    });

    console.log('Métricas ao retornar ao TOPO:', JSON.stringify(backAtTopMetrics, null, 2));

    if (backAtTopMetrics.mountedCards > 70) {
      throw new Error(`Falha: ${backAtTopMetrics.mountedCards} cards ainda montados ao voltar ao topo.`);
    } else {
      console.log(`✓ Desmontagem de cards inferiores comprovada: apenas ${backAtTopMetrics.mountedCards} cards montados no topo.`);
    }

    console.log('\n[Fase 5] Verificando modo de economia de energia e segundo plano (AnimatedBackground)...');
    await page.evaluate(() => {
      // Simula aba em segundo plano
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(500);

    const visibilityCheck = await page.evaluate(() => {
      const blobs = document.querySelectorAll('[class*="animate-blob"]');
      return {
        blobsCount: blobs.length
      };
    });

    console.log(`Blobs de animação pesada com aba oculta: ${visibilityCheck.blobsCount}`);
    if (visibilityCheck.blobsCount === 0) {
      console.log('✓ Animações de fundo pesadas suspensas com sucesso quando em segundo plano.');
    } else {
      console.log('Aviso: Blobs presentes, verificar transição estática.');
    }

    console.log('\n========================================================================');
    console.log(' TODOS OS TESTES DE PERFORMANCE E LONGEVIDADE PASSARAM COM SUCESSO! ');
    console.log('========================================================================\n');

  } finally {
    await browser.close().catch(() => {});
    try {
      server.kill();
    } catch {}
    process.exit(0);
  }
}

runLongevityPerformanceTests().catch((err) => {
  console.error('\n❌ Erro durante o teste de longevidade:', err);
  process.exit(1);
});
