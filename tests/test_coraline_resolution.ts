import { chromium } from 'playwright';

async function testProviderRegistryInBrowser() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  await page.goto('http://localhost:4000/filmes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const streams = await page.evaluate(async () => {
    // Importa dinamicamente providerRegistry via ESM no navegador
    const mod = await import('/src/core/providers/providerRegistry.ts');
    const reg = mod.providerRegistry;
    return await reg.resolveStreams('movie', {
      id: '14836',
      tmdbId: '14836',
      imdbId: 'tt0327597',
      title: 'Coraline e o Mundo Secreto',
      originalTitle: 'Coraline',
      year: 2009
    });
  });

  console.log(`providerRegistry.resolveStreams retornou ${streams.length} streams para Coraline!`);
  if (streams.length > 0) {
    console.log('Primeiras 5 fontes:');
    streams.slice(0, 5).forEach((s: any, i: number) => {
      console.log(`[${i + 1}] Nome: ${s.name} | Qualidade: ${s.quality} | Dublado: ${s.isDubbed} | Tipo: ${s.sourceType} | URL: ${s.url?.slice(0, 60)}`);
    });
  }

  // Agora vamos testar o que offlineSourceInspector.inspectDownloadOptions(streams) faz com esses streams!
  const downloadOptions = await page.evaluate(async (strms) => {
    const mod = await import('/src/core/offline/offlineSourceInspector.ts');
    const insp = mod.offlineSourceInspector;
    return await insp.inspectDownloadOptions(strms);
  }, streams);

  console.log('\nofflineSourceInspector.inspectDownloadOptions retornou:', downloadOptions.length, 'opções:');
  console.log(JSON.stringify(downloadOptions, null, 2));

  await browser.close();
}

testProviderRegistryInBrowser().catch(console.error);
