const routes = [
  '/',
  '/em-destaque',
  '/filmes',
  '/filmes/tt0111161',
  '/series',
  '/series/tt0903747',
  '/series/tt0903747/temporada/1/episodio/1',
  '/animes',
  '/animes/open-anime-1/temporada/2/episodio/8',
  '/programas',
  '/televisao',
  '/downloads',
  '/minha-lista',
  '/historico',
  '/api/featured'
];

async function check() {
  console.log('Verificando respostas HTTP do servidor ZapiTV (porta 4000):');
  let okCount = 0;
  for (const r of routes) {
    try {
      const res = await fetch('http://localhost:4000' + r, { signal: AbortSignal.timeout(3000) });
      const ct = res.headers.get('content-type') || '';
      console.log(`  ${r.padEnd(50)} -> HTTP ${res.status} (${ct.split(';')[0]})`);
      if (res.status === 200) okCount++;
    } catch (e: any) {
      console.error(`  ${r.padEnd(50)} -> FALHA: ${e.message}`);
    }
  }
  console.log(`\nTotal OK: ${okCount}/${routes.length}`);
  if (okCount !== routes.length) process.exit(1);
}

check();
