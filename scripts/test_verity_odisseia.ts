import { providerRegistry } from '../src/core/providers/providerRegistry';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';

async function testTitles() {
  console.log('=== TESTE 1: RESOLUÇÃO DE VERITY COM IDs REAIS ===');
  const verityData = {
    id: 'movie-verity-2026',
    title: 'Verity',
    originalTitle: 'Verity',
    imdbId: 'tt32261958',
    tmdbId: 1283515,
    year: 2026
  };
  
  const verityIdentity = canonicalIdentityService.buildIdentity(verityData as any);
  console.log('Verity Identity:', verityIdentity);

  const verityStreams = await providerRegistry.resolveStreams('movie', verityData);
  console.log(`Verity streams resolvidos: ${verityStreams.length}`);
  verityStreams.forEach((s, idx) => {
    console.log(`  [${idx}] name="${s.name}" title="${s.title}" url="${s.url?.slice(0, 60)}..." isDubbed=${s.isDubbed} isPtBr=${s.isPtBr}`);
  });

  console.log('\n=== TESTE 2: RESOLUÇÃO DE A ODISSEIA COM IDs REAIS ===');
  const odisseiaData = {
    id: 'movie-a-odisseia-2026',
    title: 'A Odisseia',
    originalTitle: 'The Odyssey',
    imdbId: 'tt33764258',
    tmdbId: 1368337,
    year: 2026
  };

  const odisseiaIdentity = canonicalIdentityService.buildIdentity(odisseiaData as any);
  console.log('A Odisseia Identity:', odisseiaIdentity);

  const odisseiaStreams = await providerRegistry.resolveStreams('movie', odisseiaData);
  console.log(`A Odisseia streams resolvidos: ${odisseiaStreams.length}`);
  odisseiaStreams.forEach((s, idx) => {
    console.log(`  [${idx}] name="${s.name}" title="${s.title}" url="${s.url?.slice(0, 60)}..." isDubbed=${s.isDubbed} isPtBr=${s.isPtBr}`);
  });
}

testTitles().catch(console.error);
