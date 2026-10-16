import { chromium } from 'playwright';

async function testWithFenixFlix() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  await page.goto('http://localhost:4000/filmes', { waitUntil: 'networkidle' });

  const result = await page.evaluate(async () => {
    const modReg = await import('/src/core/providers/providerRegistry.ts');
    const modInsp = await import('/src/core/offline/offlineSourceInspector.ts');

    // Força resolução esperando todos os add-ons responderem
    const streams = await modReg.providerRegistry.resolveStreams('movie', {
      id: '14836',
      tmdbId: '14836',
      imdbId: 'tt0327597',
      title: 'Coraline e o Mundo Secreto',
      originalTitle: 'Coraline',
      year: 2009
    });

    const diag = await modInsp.offlineSourceInspector.inspectDownloadOptionsDetailed(streams, 'pt-BR');

    return {
      totalStreams: streams.length,
      diagOptionsCount: diag.options.length,
      diagOptions: diag.options,
      diagReason: diag.reason
    };
  });

  console.log('Resultado completo com networkidle:', JSON.stringify(result, null, 2));
  await browser.close();
}

testWithFenixFlix().catch(console.error);
