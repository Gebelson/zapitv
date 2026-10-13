import { providerRegistry } from '../src/core/providers/providerRegistry';

async function test() {
  const streams = await providerRegistry.resolveStreams('movie', { tmdbId: 24428, imdbId: 'tt0848228' });
  console.log('Total streams returned for Avengers (tt0848228):', streams.length);
  streams.slice(0, 5).forEach((s, i) => {
    console.log(`[${i + 1}] Provider: ${s.providerName} | Name: ${s.name} | URL: ${s.url} | isPtBr: ${s.isPtBr} | isDubbed: ${s.isDubbed}`);
  });
}
test();
