import { providerRegistry } from '../src/core/providers/providerRegistry';
import { offlineSourceInspector } from '../src/core/offline/offlineSourceInspector';

async function check() {
  const streams = await providerRegistry.resolveStreams('movie', {
    id: '14836',
    tmdbId: '14836',
    imdbId: 'tt0327597',
    title: 'Coraline e o Mundo Secreto',
    originalTitle: 'Coraline',
    year: 2009
  });
  console.log('Total streams:', streams.length);
  const diag = await offlineSourceInspector.inspectDownloadOptionsDetailed(streams, 'pt-BR', 100);
  console.log('Options:', JSON.stringify(diag.options, null, 2));

  for (const opt of diag.options) {
    console.log('Testing opt url:', opt.sourceUrl);
    try {
      const res = await fetch(opt.sourceUrl.startsWith('/') ? `http://localhost:4000${opt.sourceUrl}` : opt.sourceUrl, {
        headers: { Range: 'bytes=0-1024' }
      });
      console.log('Status:', res.status, 'Content-Range:', res.headers.get('content-range'), 'Content-Type:', res.headers.get('content-type'));
    } catch (e: any) {
      console.error('Fetch error:', e.message);
    }
  }
}

check().catch(console.error);
