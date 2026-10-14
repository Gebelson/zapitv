import { DEFAULT_PROVIDERS } from '../src/core/providers/providerRegistry.ts';
import { StremioClient } from '../src/core/stremio/stremioClient.ts';

async function testEachProvider() {
  const targetId = 'tt0434665:1:1';
  console.log('Testando cada provedor individualmente para Bleach:', targetId);

  for (const p of DEFAULT_PROVIDERS) {
    if (p.type !== 'stremio-addon') continue;
    try {
      const client = new StremioClient(p.url);
      const res = await Promise.race([
        client.getStreams('series', targetId),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
      ]) as any;

      const streams = res?.streams || [];
      console.log(`\nProvedor: [${p.name}] (${p.url}) -> ${streams.length} streams`);
      streams.slice(0, 5).forEach((s: any, idx: number) => {
        console.log(`  #${idx}: name: ${s.name} | title: ${s.title?.replace(/\n/g, ' ')} | url: ${s.url?.substring(0, 80)}`);
      });
    } catch (e: any) {
      console.log(`\nProvedor: [${p.name}] -> ERRO: ${e.message}`);
    }
  }
}
testEachProvider();
