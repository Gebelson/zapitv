import { DEFAULT_PROVIDERS } from '../src/core/providers/providerRegistry.ts';
import { StremioClient } from '../src/core/stremio/stremioClient.ts';

async function testTorrentioStreams() {
  const p = DEFAULT_PROVIDERS.find(x => x.id === 'torrentio-brazuca');
  if (!p) return;
  const client = new StremioClient(p.url);
  const res = await client.getStreams('series', 'tt0434665:1:1');
  console.log('Streams do Torrentio Brazuca:');
  res.streams.forEach((s: any, idx: number) => {
    console.log(`[${idx}] ${s.name} | ${s.title?.replace(/\n/g, ' ')}`);
  });
}
testTorrentioStreams();
