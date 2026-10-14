import { providerRegistry } from '../src/core/providers/providerRegistry.ts';

async function inspectTop10() {
  const streams = await providerRegistry.resolveStreams(
    'anime',
    { imdbId: 'tt0434665', id: 'bleach', title: 'Bleach' },
    { season: 1, episode: 1 }
  );

  console.log('Top 10 streams para Bleach S1E1:');
  streams.slice(0, 10).forEach((s: any, idx: number) => {
    console.log(`\n[#${idx}] Provider: ${s.providerName}`);
    console.log(`     Name: ${s.name}`);
    console.log(`     Title: ${s.title?.replace(/\n/g, ' ')}`);
    console.log(`     URL: ${s.url?.substring(0, 80)}`);
    console.log(`     Score: ${s._smartScore} | Priority: ${s._smartPriority} | AudioTier: ${s._audioTier}`);
    console.log(`     Explanation: ${s._scoreExplanation}`);
  });
}
inspectTop10();
