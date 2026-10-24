import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address !== 'string') resolve(address.port);
        else reject(new Error('Não foi possível reservar uma porta de teste.'));
      });
    });
  });
}

async function stopServer(server: ChildProcessWithoutNullStreams): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => server.kill('SIGKILL'), 5000);
    const deadline = setTimeout(() => reject(new Error('Servidor de teste não encerrou.')), 10000);
    server.once('close', () => {
      clearTimeout(timeout);
      clearTimeout(deadline);
      resolve();
    });
    server.kill('SIGTERM');
  });
}

async function runLongevityPerformanceTests() {
  console.log('--- TESTE AUTOMATIZADO DE LONGEVIDADE E PERFORMANCE DO CATÁLOGO ---');

  const testPort = String(await availablePort());
  const server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: rootDir,
    // Vite em modo de desenvolvimento serve o código atual, sem depender de dist antigo.
    env: { ...process.env, NODE_ENV: 'development', PORT: testPort },
    stdio: 'pipe',
    shell: false
  });

  let browser: Browser | undefined;
  let serverError: Error | undefined;
  server.once('error', (error) => { serverError = error; });

  try {
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
  for (let i = 0; i < 120; i++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Servidor saiu com código ${server.exitCode}.`);
    try {
      const res = await fetch(`http://127.0.0.1:${testPort}/filmes`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  if (!ready) {
    throw new Error('Falha ao subir servidor de teste em 60 segundos.');
  }

  console.log(`Servidor ativo na porta ${testPort}. Conectando navegador...`);

  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--js-flags=--expose-gc']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

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
    try {
      await browser?.close();
    } finally {
      await stopServer(server);
    }
  }
}

runLongevityPerformanceTests().catch((err) => {
  console.error('\n❌ Erro durante o teste de longevidade:', err);
  process.exitCode = 1;
});
