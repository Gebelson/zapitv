import { StremioClient } from '../src/core/stremio/stremioClient';
import { DEFAULT_PROVIDERS } from '../src/core/providers/providerRegistry';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';

async function diagnose() {
  const verity = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-verity-2026')!;
  const odisseia = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-a-odisseia-2026')!;

  const items = [
    { name: 'Verity', item: verity, imdbId: 'tt15888806' },
    { name: 'A Odisseia', item: odisseia, imdbId: 'tt2788314' }
  ];

  for (const { name, item, imdbId } of items) {
    console.log(`\n========================================`);
    console.log(`DIAGNÓSTICO DETALHADO: ${name} (${imdbId})`);
    console.log(`========================================`);
    const identity = canonicalIdentityService.buildIdentity(item);

    for (const provider of DEFAULT_PROVIDERS) {
      if (!provider.enabled) continue;
      // Resolve url if relative
      const providerUrl = provider.url.startsWith('/') 
        ? `http://localhost:4000${provider.url}`
        : provider.url;

      try {
        const client = new StremioClient(providerUrl);
        const res = await Promise.race([
          client.getStreams('movie', imdbId),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 6000))
        ]);

        const rawStreams = res?.streams || [];
        console.log(`\n[Provider: ${provider.name}] (${provider.id})`);
        console.log(`  -> Retornou ${rawStreams.length} streams brutos`);

        for (let i = 0; i < Math.min(rawStreams.length, 5); i++) {
          const s = rawStreams[i];
          const conf = sourceConfidenceEngine.evaluate(s, identity);
          console.log(`    Stream #${i + 1}:`);
          console.log(`      name: "${s.name}" | title: "${s.title}"`);
          console.log(`      url: "${s.url?.slice(0, 70)}"`);
          console.log(`      confidence: ${conf.confidence} | isMatch: ${conf.isMatch}`);
          if (conf.reasons.length > 0) {
            console.log(`      reasons: ${conf.reasons.join(' | ')}`);
          }
        }
      } catch (err: any) {
        console.log(`\n[Provider: ${provider.name}] (${provider.id}) ERRO: ${err.message}`);
      }
    }
  }
}

diagnose().catch(console.error);
