import { chromium } from 'playwright';

async function testDiag() {
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

  const debugInfo = await page.evaluate(async () => {
    const modReg = await import('/src/core/providers/providerRegistry.ts');

    const streams = await modReg.providerRegistry.resolveStreams('movie', {
      id: '14836',
      tmdbId: '14836',
      imdbId: 'tt0327597',
      title: 'Coraline e o Mundo Secreto',
      originalTitle: 'Coraline',
      year: 2009
    });

    let isLocalEngineOnline = false;
    try {
      const probe = await fetch('http://127.0.0.1:11470/stats.json', { signal: AbortSignal.timeout(400) });
      isLocalEngineOnline = probe.ok;
    } catch {
      isLocalEngineOnline = false;
    }

    const filtered = streams.filter(s => {
      if (!s || !s.url) return false;
      const url = s.url.trim().toLowerCase();
      if (url.startsWith('widevine:') || url.startsWith('playready:') || url.startsWith('fairplay:')) return false;
      if (url.includes('127.0.0.1:11470') && !isLocalEngineOnline) return false;
      return true;
    });

    return {
      totalStreams: streams.length,
      isLocalEngineOnline,
      filteredCount: filtered.length,
      filteredFirst3: filtered.slice(0, 3)
    };
  });

  console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
  await browser.close();
}

testDiag().catch(console.error);
