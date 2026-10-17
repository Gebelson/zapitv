import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { streamValidator } from '../src/core/providers/streamValidator';
import { CamBlockerEngine } from '../src/core/catalog/CamBlockerEngine';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';

async function diagnose() {
  console.log('=== TESTE DE DIAGNÓSTICO: FONTES E VALIDAÇÃO ===\n');

  const verityCurrent = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-verity-2026')!;
  const odisseiaCurrent = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-a-odisseia-2026')!;

  console.log('1. ESTADO ATUAL NO CATÁLOGO:');
  console.log('Verity:', { id: verityCurrent.id, tmdbId: verityCurrent.tmdbId, imdbId: verityCurrent.imdbId });
  console.log('A Odisseia:', { id: odisseiaCurrent.id, tmdbId: odisseiaCurrent.tmdbId, imdbId: odisseiaCurrent.imdbId });

  // Test current resolution
  const verityStreamsCurrent = await providerRegistry.resolveStreams('movie', verityCurrent);
  console.log(`\nVerity com IDs atuais -> ${verityStreamsCurrent.length} streams resolvidos`);

  const odisseiaStreamsCurrent = await providerRegistry.resolveStreams('movie', odisseiaCurrent);
  console.log(`A Odisseia com IDs atuais -> ${odisseiaStreamsCurrent.length} streams resolvidos`);

  // Test corrected IDs
  console.log('\n2. RESOLUÇÃO COM IDENTIDADE CORRIGIDA (TMDB + IMDB OFICIAIS):');
  const verityFixed = {
    ...verityCurrent,
    tmdbId: 1283515,
    imdbId: 'tt32261958'
  };
  const odisseiaFixed = {
    ...odisseiaCurrent,
    tmdbId: 1368337,
    imdbId: 'tt33764258'
  };

  const verityStreamsFixed = await providerRegistry.resolveStreams('movie', verityFixed);
  console.log(`Verity corrigido -> ${verityStreamsFixed.length} streams resolvidos`);
  verityStreamsFixed.slice(0, 5).forEach((s, i) => {
    console.log(`  [${i}] ${s.name} | ${s.title?.slice(0, 60)} | url: ${s.url?.slice(0, 60)}`);
  });

  const odisseiaStreamsFixed = await providerRegistry.resolveStreams('movie', odisseiaFixed);
  console.log(`\nA Odisseia corrigido -> ${odisseiaStreamsFixed.length} streams resolvidos`);
  odisseiaStreamsFixed.slice(0, 5).forEach((s, i) => {
    console.log(`  [${i}] ${s.name} | ${s.title?.slice(0, 60)} | url: ${s.url?.slice(0, 60)}`);
  });

  console.log('\n3. VERIFICAÇÃO DE CAM E THEATRICAL FILTER:');
  const verityIdentity = canonicalIdentityService.buildIdentity(verityFixed);
  console.log('Verity isTheatricalUnreleased:', verityIdentity.isTheatricalUnreleased);
  console.log('Verity isMovieAllowedSync:', theatricalFilterService.isMovieAllowedSync(verityFixed));

  const odisseiaIdentity = canonicalIdentityService.buildIdentity(odisseiaFixed);
  console.log('A Odisseia isTheatricalUnreleased:', odisseiaIdentity.isTheatricalUnreleased);
  console.log('A Odisseia isMovieAllowedSync:', theatricalFilterService.isMovieAllowedSync(odisseiaFixed));

  if (verityStreamsFixed.length > 0) {
    const s = verityStreamsFixed[0];
    const isCam = CamBlockerEngine.isCamStream(s, verityFixed);
    const conf = sourceConfidenceEngine.evaluate(s, verityIdentity);
    console.log('\nVerity stream[0] CAM eval:', isCam, 'Confidence:', conf.confidence, 'Reasons:', conf.reasons);
  }

  if (odisseiaStreamsFixed.length > 0) {
    const s = odisseiaStreamsFixed[0];
    const isCam = CamBlockerEngine.isCamStream(s, odisseiaFixed);
    const conf = sourceConfidenceEngine.evaluate(s, odisseiaIdentity);
    console.log('\nA Odisseia stream[0] CAM eval:', isCam, 'Confidence:', conf.confidence, 'Reasons:', conf.reasons);
  }
}

diagnose().catch(console.error);
