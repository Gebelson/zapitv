import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromePath = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') 
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : (fs.existsSync('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' : undefined);

async function runDiagnostic() {
  console.log('--- INICIANDO DIAGNÓSTICO DO CATÁLOGO ANTES DAS MODIFICAÇÕES ---');
  
  const rootDir = path.resolve(__dirname, '..');
  // Inicia o servidor em modo produção na porta 4000
  const server = spawn('npx.cmd', ['tsx', 'server.ts'], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: '4000' },
    stdio: 'pipe',
    shell: true
  });

  server.stdout.on('data', (d) => {
    console.log('[server]', d.toString().trim());
  });
  server.stderr.on('data', (d) => {
    console.error('[server error]', d.toString().trim());
  });

  // Aguarda servidor subir
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:4000');
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  if (!ready) {
    console.error('Falha ao iniciar servidor de teste.');
    server.kill();
    process.exit(1);
  }

  console.log('Servidor rodando em http://localhost:4000');

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--js-flags=--expose-gc']
  });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', msg => console.log('[browser]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[page error]', err));

  // Contadores de requisições de rede
  let requestCount = 0;
  const requestsList: string[] = [];
  page.on('request', req => {
    requestCount++;
    requestsList.push(req.url());
  });

  console.log('\n--- CENÁRIO A: CATÁLOGO EM REPOUSO (IDLE) ---');
  await page.goto('http://localhost:4000/filmes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  const initialMetrics = await page.evaluate(() => {
    return {
      domNodes: document.getElementsByTagName('*').length,
      contentCards: document.querySelectorAll('[class*="group relative rounded-2xl"], [class*="group relative aspect-"]').length,
      imagesCount: document.getElementsByTagName('img').length,
      jsHeapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
    };
  });

  console.log('Métricas Iniciais ao carregar /filmes:');
  console.log(JSON.stringify(initialMetrics, null, 2));

  // Instala rastreador de re-renderizações e timers
  await page.evaluate(() => {
    (window as any).__renderCount = 0;
    (window as any).__longTasks = 0;
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const po = new PerformanceObserver((list) => {
          (window as any).__longTasks += list.getEntries().length;
        });
        po.observe({ entryTypes: ['longtask'] });
      } catch {}
    }
  });

  // Aguarda 10 segundos em repouso absoluto
  console.log('\nAguardando em repouso absoluto...');
  await page.waitForTimeout(10000);

  const idle10sMetrics = await page.evaluate(() => {
    return {
      domNodes: document.getElementsByTagName('*').length,
      imagesCount: document.getElementsByTagName('img').length,
      jsHeapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null,
      longTasks: (window as any).__longTasks || 0
    };
  });
  console.log('Métricas após 10s em repouso:', JSON.stringify(idle10sMetrics, null, 2));
  console.log('Requisições de rede acumuladas durante repouso:', requestCount);

  console.log('\n--- CENÁRIO B: NAVEGAÇÃO PROLONGADA (ROLAGEM INFINITA & CARREGAMENTO DE LOTES) ---');

  // Mede o crescimento do DOM conforme desce no catálogo
  const scrollSteps = [1, 2, 3, 4, 5, 6, 7, 8];
  const scrollMetrics: any[] = [];

  for (const step of scrollSteps) {
    // Rola para o fim da página
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(1500); // aguarda sentinela disparar

    const stepData = await page.evaluate((s) => {
      return {
        step: s,
        domNodes: document.getElementsByTagName('*').length,
        contentCards: document.querySelectorAll('[class*="group relative rounded-2xl"]').length,
        imagesCount: document.getElementsByTagName('img').length,
        jsHeapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
      };
    }, step);

    scrollMetrics.push(stepData);
    console.log(`Lote ${step}: DOM Nodes: ${stepData.domNodes} | Cards Montados: ${stepData.contentCards} | Imagens: ${stepData.imagesCount} | Heap: ${stepData.jsHeapMB} MB`);
  }

  // Rola de volta ao topo para ver se elementos desmontam ou memória estabiliza
  console.log('\nRolando de volta ao topo da página...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(3000);

  const backAtTopMetrics = await page.evaluate(() => {
    return {
      domNodes: document.getElementsByTagName('*').length,
      contentCards: document.querySelectorAll('[class*="group relative rounded-2xl"]').length,
      imagesCount: document.getElementsByTagName('img').length,
      jsHeapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : null
    };
  });

  console.log('Métricas ao voltar ao TOPO:');
  console.log(JSON.stringify(backAtTopMetrics, null, 2));

  console.log('\nDiagnóstico conclusivo:');
  if (backAtTopMetrics.domNodes >= initialMetrics.domNodes * 3) {
    console.log(`🚨 CRESCIMENTO ILIMITADO CONFIRMADO: DOM saltou de ${initialMetrics.domNodes} para ${backAtTopMetrics.domNodes} nós (+${backAtTopMetrics.domNodes - initialMetrics.domNodes} nós)!`);
    console.log(`🚨 Todos os ${backAtTopMetrics.contentCards} cards anteriores permanecem montados no DOM mesmo fora da tela.`);
  }

  await browser.close();
  server.kill();
  console.log('\nDiagnóstico inicial finalizado.');
}

runDiagnostic().catch(err => {
  console.error('Erro no diagnóstico:', err);
  process.exit(1);
});
