import { chromium } from 'playwright';

async function diagnose() {
  console.log('--- INICIANDO DIAGNÓSTICO BROWSER NA VERCEL ---');
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge' // Usa Edge já instalado no Windows se chromium não tiver baixado
  }).catch(async () => {
    // Fallback para chromium padrão
    return await chromium.launch({ headless: true });
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const consoleLogs: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: { url: string; method: string; failure: string }[] = [];
  const httpErrors: { url: string; status: number; statusText: string }[] = [];
  const allRequests: { url: string; status?: number; duration?: number }[] = [];

  page.on('console', msg => {
    const text = `[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(text);
  });

  page.on('pageerror', err => {
    const text = `[PAGE ERROR] ${err.message}\nStack: ${err.stack}`;
    pageErrors.push(text);
    console.error(text);
  });

  page.on('requestfailed', req => {
    const fail = {
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'Unknown error'
    };
    failedRequests.push(fail);
    console.warn(`[REQUEST FAILED] ${fail.method} ${fail.url} -> ${fail.failure}`);
  });

  page.on('response', res => {
    const status = res.status();
    allRequests.push({ url: res.url(), status });
    if (status >= 400) {
      const err = { url: res.url(), status, statusText: res.statusText() };
      httpErrors.push(err);
      console.warn(`[HTTP ERROR ${status}] ${res.url()}`);
    }
  });

  console.log('Navegando para https://zapitv-kappa.vercel.app/ ...');
  try {
    await page.goto('https://zapitv-kappa.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e: any) {
    console.log('Aviso no goto (timeout networkidle provável):', e.message);
  }

  // Aguarda mais 5 segundos para observar reações assíncronas do catálogo
  await page.waitForTimeout(5000);

  // Inspeciona elementos na página
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText);
  const errorOverlay = await page.evaluate(() => {
    const el = document.getElementById('error-overlay');
    return el ? { visible: el.style.display !== 'none', text: el.innerText } : null;
  });

  // Salva screenshot
  await page.screenshot({ path: 'vercel_screenshot.png', fullPage: true });

  console.log('\n--- RESUMO DO DIAGNÓSTICO ---');
  console.log('Título da página:', title);
  console.log('Error Overlay:', JSON.stringify(errorOverlay));
  console.log('Total de requisições capturadas:', allRequests.length);
  console.log('Requisições com falha (Network error):', failedRequests.length);
  console.log('Respostas HTTP 4xx/5xx:', httpErrors.length);
  console.log('Erros de console:', consoleLogs.filter(c => c.includes('ERROR')).length);
  console.log('Page Errors (Exceções uncaught):', pageErrors.length);
  console.log('Texto visível (primeiros 500 chars):\n', bodyText.slice(0, 500));

  console.log('\n--- DETALHES DE ERROS HTTP / NETWORK ---');
  for (const f of failedRequests) {
    console.log(`FALHA DE REDE: ${f.method} ${f.url} -> ${f.failure}`);
  }
  for (const h of httpErrors) {
    console.log(`HTTP ${h.status}: ${h.url}`);
  }

  await browser.close();
}

diagnose().catch(err => {
  console.error('Falha geral no script de diagnóstico:', err);
});
