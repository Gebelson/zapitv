import { chromium } from 'playwright';

async function testCoralineDownload() {
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

  const testOutput = await page.evaluate(async () => {
    const modInsp = await import('/src/core/offline/offlineSourceInspector.ts');
    const modReg = await import('/src/core/providers/providerRegistry.ts');
    const modDl = await import('/src/core/offline/offlineDownloadManager.ts');
    const modDb = await import('/src/core/offline/offlineDb.ts');

    const streams = await modReg.providerRegistry.resolveStreams('movie', {
      id: '14836',
      tmdbId: '14836',
      imdbId: 'tt0327597',
      title: 'Coraline e o Mundo Secreto',
      originalTitle: 'Coraline',
      year: 2009
    });

    const diag = await modInsp.offlineSourceInspector.inspectDownloadOptionsDetailed(streams, 'pt-BR');
    
    // Tenta testar o primeiro stream real (FenixFlix / proxy)
    const validOption = diag.options.find(o => !o.sourceUrl.includes('127.0.0.1:11470'));
    let downloadTestResult = null;

    if (validOption) {
      console.log('Testando fetch dos primeiros 64KB do stream:', validOption.sourceUrl);
      try {
        const res = await fetch(validOption.sourceUrl, {
          headers: { Range: 'bytes=0-65535' }
        });
        const blob = await res.blob();
        downloadTestResult = {
          ok: res.ok,
          status: res.status,
          blobSize: blob.size,
          contentType: res.headers.get('content-type')
        };
      } catch (e: any) {
        downloadTestResult = { error: e.message };
      }
    }

    return {
      optionsCount: diag.options.length,
      options: diag.options,
      reason: diag.reason,
      downloadTestResult
    };
  });

  console.log('Resultado do teste no navegador:');
  console.log(JSON.stringify(testOutput, null, 2));

  await browser.close();
}

testCoralineDownload().catch(console.error);
