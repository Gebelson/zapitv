import { chromium } from 'playwright';

async function logStreams() {
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

  const streamsInfo = await page.evaluate(async () => {
    const modReg = await import('/src/core/providers/providerRegistry.ts');
    const streams = await modReg.providerRegistry.resolveStreams('movie', {
      id: '14836',
      tmdbId: '14836',
      imdbId: 'tt0327597',
      title: 'Coraline e o Mundo Secreto',
      originalTitle: 'Coraline',
      year: 2009
    });

    return streams.map(s => ({
      provider: s.providerId || s.providerName || s.name,
      name: s.name,
      title: s.title,
      url: s.url
    }));
  });

  console.log('Total de streams retornados para Coraline:', streamsInfo.length);
  // Agrupa por provedor ou tipo de URL
  const byType: Record<string, number> = {};
  streamsInfo.forEach(s => {
    const type = s.url?.includes('127.0.0.1') ? 'local_engine_11470' : (s.url?.startsWith('/api/proxy') ? 'api_proxy' : (s.url?.startsWith('http') ? 'external_http' : 'other'));
    byType[type] = (byType[type] || 0) + 1;
  });
  console.log('Contagem por tipo de URL:', byType);

  const nonEngine = streamsInfo.filter(s => !s.url?.includes('127.0.0.1'));
  console.log('Streams que NÃO são do engine local (total:', nonEngine.length, '):');
  console.log(JSON.stringify(nonEngine.slice(0, 5), null, 2));

  await browser.close();
}

logStreams().catch(console.error);
