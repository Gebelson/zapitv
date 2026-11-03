import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  console.log('--- REPRODUÇÃO EM PRODUCTION PLAYWRIGHT: ZAPITV ---');
  const chromePath = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ].find(fs.existsSync);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  const networkLogs: string[] = [];
  const consoleLogs: string[] = [];

  page.on('console', msg => {
    const text = `[Console ${msg.type()}]: ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error' || text.includes('SourceVerification') || text.includes('ProviderRegistry')) {
      console.log(text);
    }
  });

  page.on('request', req => {
    const url = req.url();
    if (url.includes('stremio') || url.includes('provider') || url.includes('proxy') || url.includes('torrentio') || url.includes('fenixflix') || url.includes('froststream')) {
      networkLogs.push(`REQ: ${req.method()} ${url}`);
      console.log(`REQ: ${req.method()} ${url}`);
    }
  });

  page.on('response', res => {
    const url = res.url();
    if (url.includes('stremio') || url.includes('provider') || url.includes('proxy') || url.includes('torrentio') || url.includes('fenixflix') || url.includes('froststream')) {
      networkLogs.push(`RES: ${res.status()} ${url}`);
      console.log(`RES: ${res.status()} ${url}`);
    }
  });

  page.on('requestfailed', req => {
    networkLogs.push(`FAILED: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    console.log(`FAILED: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  try {
    console.log('\nNavegando para Pursuit of Jade em produção...');
    await page.goto('https://zapitv-stream.vercel.app/assistir/serie/tt35316225/t/1/e/1', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Aguarda 10 segundos para verificação e tentativas de reprodução concluírem
    await page.waitForTimeout(10000);

    const bodyText = await page.innerText('body');
    console.log('\n--- TEXTO NA TELA ---');
    console.log(bodyText.substring(0, 1000));

    const isErrorVisible = bodyText.includes('Não foi possível verificar a disponibilidade') ||
      bodyText.includes('Conteúdo indisponível no momento') ||
      bodyText.includes('Erro de reprodução');

    console.log('\nErro visível na tela:', isErrorVisible);

    await page.screenshot({ path: 'production_reproduce.png' });
    console.log('Screenshot salva em production_reproduce.png');
  } catch (err: any) {
    console.error('Erro na execução do Playwright:', err.message);
  } finally {
    await browser.close();
  }
}

main();
