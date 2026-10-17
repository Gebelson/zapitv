async function testServerHeaders() {
  const url = 'https://froststream.cloutteam.com/stream/movie/tt33764258.json';
  
  const headerSets = [
    {
      name: 'Standard Chrome on Windows',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    },
    {
      name: 'Stremio Official App Headers',
      headers: {
        'User-Agent': 'Stremio/4.4.168 (desktop; windows; x64)',
        'Accept': '*/*'
      }
    },
    {
      name: 'ZapiTV Current UA in server.ts',
      headers: {
        'User-Agent': 'ZapiTV-Stremio/1.0.0 (gebel.streaming@zapitv.local)',
        'Accept': '*/*'
      }
    }
  ];

  for (const s of headerSets) {
    try {
      const res = await fetch(url, { headers: s.headers });
      const text = await res.text();
      console.log(s.name, '-> Status:', res.status, 'Body starts with:', text.slice(0, 50));
    } catch (e: any) {
      console.log(s.name, '-> ERROR:', e.message);
    }
  }
}
testServerHeaders().catch(console.error);
