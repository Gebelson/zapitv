import { chromium } from 'playwright';

async function diagnoseCoralineInBrowser() {
  console.log('--- DIAGNÓSTICO EM PROFUNDIDADE: CORALINE E FONTES DE STREAMING ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('Coraline') || msg.text().includes('stream') || msg.text().includes('Download')) {
      console.log(`[Browser Console ${msg.type()}]:`, msg.text());
    }
  });

  console.log('Navegando para http://localhost:4000/filmes...');
  await page.goto('http://localhost:4000/filmes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Executa teste direto do providerRegistry e offlineSourceInspector dentro do contexto do navegador
  const testResult = await page.evaluate(async () => {
    // Procura o módulo providerRegistry ou testa via fetch nos addons registrados
    // Vamos verificar o que o app tem carregado
    const anyWin = window as any;
    console.log('Testando busca de Coraline no catálogo ou TMDB...');
    
    // Testa fetch direto nas rotas do Stremio para Coraline (IMDb: tt0327597, TMDB: 14836)
    const coralineImdb = 'tt0327597';
    const coralineTmdb = '14836';

    const results: Record<string, any> = {};

    // 1. Torrentio Brazuca
    try {
      const r1 = await fetch(`https://torrentio.strem.fun/brazuca/stream/movie/${coralineImdb}.json`);
      results['torrentio-brazuca'] = { ok: r1.ok, status: r1.status, data: await r1.json().catch(() => null) };
    } catch (e: any) {
      results['torrentio-brazuca'] = { error: e.message };
    }

    // 2. Torrentio Oficial
    try {
      const r2 = await fetch(`https://torrentio.strem.fun/stream/movie/${coralineImdb}.json`);
      results['torrentio-oficial'] = { ok: r2.ok, status: r2.status, data: await r2.json().catch(() => null) };
    } catch (e: any) {
      results['torrentio-oficial'] = { error: e.message };
    }

    // 3. FenixFlix
    try {
      const r3 = await fetch(`https://fenixflix.fenixhub.online/stream/movie/${coralineImdb}.json`);
      results['fenixflix'] = { ok: r3.ok, status: r3.status, data: await r3.json().catch(() => null) };
    } catch (e: any) {
      results['fenixflix'] = { error: e.message };
    }

    return results;
  });

  console.log('Resultado dos testes de fetch nos provedores do navegador:');
  for (const [provider, res] of Object.entries(testResult)) {
    console.log(`\nProvedor: ${provider}`);
    console.log(`OK: ${(res as any).ok}, Status: ${(res as any).status}, Error: ${(res as any).error}`);
    const streams = (res as any).data?.streams;
    if (streams && Array.isArray(streams)) {
      console.log(`Encontrou ${streams.length} streams! Primeiros 2:`);
      console.log(streams.slice(0, 2).map((s: any) => ({ name: s.name, title: s.title, url: s.url?.slice(0, 60) })));
    }
  }

  await browser.close();
}

diagnoseCoralineInBrowser().catch(console.error);
