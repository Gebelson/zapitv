import { providerRegistry } from '../src/core/providers/providerRegistry.ts';

async function testBleach() {
  console.log('Resolvendo streams para Bleach (tt0434665:1:1)...');
  const streams = await providerRegistry.resolveStreams(
    'anime',
    { imdbId: 'tt0434665', id: 'bleach', title: 'Bleach' },
    { season: 1, episode: 1 }
  );
  console.log('Total de streams retornados:', streams.length);
  for (let i = 0; i < streams.length; i++) {
    const s = streams[i];
    console.log(`--- Stream #${i} ---`);
    console.log('Provider:', s.providerName || s.providerId);
    console.log('Name:', s.name);
    console.log('Title:', s.title?.replace(/\n/g, ' '));
    console.log('URL:', s.url?.substring(0, 100));
    console.log('IsDubbed:', s.isDubbed, 'IsPtBr:', s.isPtBr);
    console.log('SourceType:', s.sourceType);
    console.log('SmartPriority:', (s as any)._smartPriority);
    console.log('ScoreExplanation:', (s as any)._scoreExplanation);
  }
}
testBleach();
