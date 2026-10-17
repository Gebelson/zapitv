import { providerRegistry } from '../src/core/providers/providerRegistry';

async function testResolution(label: string, isHttps: boolean) {
  console.log(`\n======================================================`);
  console.log(`TESTANDO RESOLUÇÃO: ${label} (isHttps = ${isHttps})`);
  console.log(`======================================================`);

  if (isHttps) {
    (global as any).window = {
      location: {
        protocol: 'https:',
        origin: 'https://zapitv-kappa.vercel.app'
      }
    };
  } else {
    (global as any).window = {
      location: {
        protocol: 'http:',
        origin: 'http://localhost:4000'
      }
    };
  }

  const titles = [
    { title: 'Forrest Gump', id: 'tt0109830', imdbId: 'tt0109830', type: 'movie' },
    { title: 'Oppenheimer', id: 'tt15398776', imdbId: 'tt15398776', type: 'movie' },
    { title: 'Attack on Titan', id: 'tt2560140', imdbId: 'tt2560140', type: 'series', episode: { season: 1, episode: 1 } },
    { title: 'A Odisseia', id: 'tt14336044', imdbId: 'tt14336044', type: 'movie' },
    { title: 'Verity', id: 'tt13207038', imdbId: 'tt13207038', type: 'movie' },
    { title: 'Sintonia', id: 'tt10665304', imdbId: 'tt10665304', type: 'series', episode: { season: 1, episode: 1 } }
  ];

  for (const t of titles) {
    providerRegistry.clearCache();
    console.log(`\n--- Testando: ${t.title} (${t.id}) ---`);
    const start = Date.now();
    try {
      const streams = await providerRegistry.resolveStreams(
        t.type as any,
        {
          id: t.id,
          imdbId: t.imdbId,
          title: t.title,
          year: 2023
        },
        (t as any).episode
      );
      const duration = Date.now() - start;
      console.log(`Tempo: ${duration}ms | Fontes encontradas: ${streams.length}`);
      if (streams.length === 0) {
        console.log(`❌ NENHUMA FONTE ENCONTRADA!`);
      } else {
        streams.slice(0, 4).forEach((s, i) => {
          console.log(`  [${i + 1}] name: "${s.name}" | provider: "${s.providerName}" | isPtBr: ${s.isPtBr} | isDubbed: ${s.isDubbed} | isTorrent: ${s.isTorrent} | url: "${s.url?.slice(0, 60)}"`);
        });
      }
    } catch (err: any) {
      console.error(`ERRO ao resolver ${t.title}:`, err.message);
    }
  }
}

async function main() {
  await testResolution('AMBIENTE LOCAL (HTTP / LOCALHOST)', false);
  await testResolution('AMBIENTE VERCEL SIMULADO (HTTPS / VERCEL)', true);
}

main().catch(console.error);
