import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBenchmark(label = 'BASELINE') {
  console.log(`\n========================================================================`);
  console.log(`=== ZAPITV | BENCHMARK DE DESEMPENHO NO AMAZON FIRE TV (${label}) ===`);
  console.log(`========================================================================\n`);

  const server = await createServer({ server: { port: 5205 } });
  await server.listen();

  // Emula CPU reduzida do Fire TV Stick (throttling 4x de CPU) e Silk Browser em 960x540 DPR 2.0
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2.0,
    userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36'
  });

  const page = await context.newPage();
  
  // Emulação de CPU limitada do Fire TV Stick (4x CPU slowdown)
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const results = {
    label,
    timestamp: new Date().toISOString(),
    initialLoadMs: 0,
    domNodesOnMount: 0,
    imageCountOnMount: 0,
    resizeObserverCount: 0,
    keyLatencies: [],
    meanKeyLatencyMs: 0,
    p95KeyLatencyMs: 0,
    searchOpenMs: 0,
    searchTypingLagMs: 0
  };

  try {
    // 1. Medição do Carregamento Inicial da Home
    console.log('1. Carregando Home da TV...');
    const loadStart = performance.now();
    await page.goto('http://localhost:5205/tv?deviceFamily=firetv', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.zapi-tv-root', { state: 'visible', timeout: 15000 });
    results.initialLoadMs = Math.round(performance.now() - loadStart);
    console.log(`✓ Tempo de montagem inicial: ${results.initialLoadMs}ms`);

    await page.waitForTimeout(600);

    // 2. Medição da Carga de DOM e Imagens no Mount
    const mountMetrics = await page.evaluate(() => {
      const allNodes = document.querySelectorAll('*').length;
      const allImages = document.querySelectorAll('img').length;
      const allRows = document.querySelectorAll('[data-row-id]').length;
      const preloaderMetrics = (window).__tvImagePreloaderService?.getMetrics?.() || null;
      return { allNodes, allImages, allRows, preloaderMetrics };
    });
    results.domNodesOnMount = mountMetrics.allNodes;
    results.imageCountOnMount = mountMetrics.allImages;
    results.totalRowsMounted = mountMetrics.allRows;
    console.log(`✓ Total de nós DOM: ${results.domNodesOnMount}`);
    console.log(`✓ Total de tags <img> renderizadas na Home: ${results.imageCountOnMount}`);
    console.log(`✓ Total de fileiras de conteúdo montadas: ${results.totalRowsMounted}`);

    // 3. Medição de Latência de Navegação D-Pad (10 passos contínuos)
    console.log('\n2. Medindo latência de navegação D-Pad com CPU throttling 4x...');
    const latencies = [];

    // Foca na primeira fileira navegável
    await page.evaluate(() => {
      if ((window).__setTvFocus) {
        (window).__setTvFocus('row-continue-watching') || (window).__setTvFocus('row-trending');
      }
    });
    await page.waitForTimeout(200);

    for (let i = 0; i < 10; i++) {
      const dir = i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
      const keyStart = performance.now();
      await page.keyboard.press(dir);
      // Aguarda frame de renderização
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const latency = Math.round(performance.now() - keyStart);
      latencies.push(latency);
    }

    results.keyLatencies = latencies;
    results.meanKeyLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const sorted = [...latencies].sort((a, b) => a - b);
    results.p95KeyLatencyMs = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
    console.log(`✓ Latências individuais: ${latencies.join('ms, ')}ms`);
    console.log(`✓ Latência média de tecla: ${results.meanKeyLatencyMs}ms`);
    console.log(`✓ Latência P95: ${results.p95KeyLatencyMs}ms`);

    // 4. Medição de Descer 5 fileiras verticais
    console.log('\n3. Medindo rolagem vertical por 5 fileiras...');
    const vertStart = performance.now();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(60);
    }
    const verticalDurationMs = Math.round(performance.now() - vertStart);
    results.vertical5RowsDurationMs = verticalDurationMs;
    console.log(`✓ Duração de navegação vertical por 5 fileiras: ${verticalDurationMs}ms`);

    console.log(`\n========================================================================`);
    console.log(` RESULTADOS DO BENCHMARK (${label}):`);
    console.log(`  - Carregamento inicial: ${results.initialLoadMs}ms`);
    console.log(`  - Nós DOM: ${results.domNodesOnMount}`);
    console.log(`  - Imagens <img> montadas: ${results.imageCountOnMount}`);
    console.log(`  - Fileiras montadas: ${results.totalRowsMounted}`);
    console.log(`  - Latência média D-pad: ${results.meanKeyLatencyMs}ms`);
    console.log(`  - Latência P95: ${results.p95KeyLatencyMs}ms`);
    console.log(`========================================================================\n`);

  } finally {
    await browser.close();
    await server.close();
  }

  return results;
}

// Salva em disco para comparação
const benchmarkFile = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/firetv_benchmark.json';

const mode = process.argv[2] || 'OPTIMIZED';

runBenchmark(mode)
  .then((data) => {
    let existing = {};
    if (fs.existsSync(benchmarkFile)) {
      try { existing = JSON.parse(fs.readFileSync(benchmarkFile, 'utf8')); } catch {}
    }
    if (mode === 'BASELINE') {
      existing.baseline = data;
    } else {
      existing.optimized = data;
    }
    fs.writeFileSync(benchmarkFile, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`✓ Resultados salvos em ${benchmarkFile}`);

    if (existing.baseline && existing.optimized) {
      console.log('\n========================================================================');
      console.log('--- COMPARAÇÃO ANTES (BASELINE) vs DEPOIS (OTIMIZADO) NO FIRE TV ---');
      console.log('========================================================================');
      console.table({
        'Carregamento Inicial (ms)': {
          'Antes (Baseline)': `${existing.baseline.initialLoadMs}ms`,
          'Depois (Otimizado)': `${existing.optimized.initialLoadMs}ms`,
          'Melhoria': `${Math.round((1 - existing.optimized.initialLoadMs / existing.baseline.initialLoadMs) * 100)}% mais rápido`
        },
        'Nós DOM na Home': {
          'Antes (Baseline)': existing.baseline.domNodesOnMount,
          'Depois (Otimizado)': existing.optimized.domNodesOnMount,
          'Melhoria': `-${Math.round((1 - existing.optimized.domNodesOnMount / existing.baseline.domNodesOnMount) * 100)}% de nós`
        },
        'Imagens <img> montadas': {
          'Antes (Baseline)': existing.baseline.imageCountOnMount,
          'Depois (Otimizado)': existing.optimized.imageCountOnMount,
          'Melhoria': `-${Math.round((1 - existing.optimized.imageCountOnMount / existing.baseline.imageCountOnMount) * 100)}% de imagens`
        },
        'Latência Média D-Pad (ms)': {
          'Antes (Baseline)': `${existing.baseline.meanKeyLatencyMs}ms`,
          'Depois (Otimizado)': `${existing.optimized.meanKeyLatencyMs}ms`,
          'Melhoria': `${Math.round((1 - existing.optimized.meanKeyLatencyMs / existing.baseline.meanKeyLatencyMs) * 100)}% mais ágil`
        },
        'Latência P95 D-Pad (ms)': {
          'Antes (Baseline)': `${existing.baseline.p95KeyLatencyMs}ms`,
          'Depois (Otimizado)': `${existing.optimized.p95KeyLatencyMs}ms`,
          'Melhoria': `${Math.round((1 - existing.optimized.p95KeyLatencyMs / existing.baseline.p95KeyLatencyMs) * 100)}% de redução`
        }
      });
      console.log('========================================================================\n');
    }

    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro durante benchmark:', err);
    process.exit(1);
  });
