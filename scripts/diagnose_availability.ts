async function checkEndpoints() {
  const endpoints = [
    { name: 'FrostStream', url: 'https://froststream.cloutteam.com/manifest.json' },
    { name: 'FenixFlix', url: 'https://fenixflix.fenixhub.online/manifest.json' },
    { name: 'Torrentio', url: 'https://torrentio.strem.fun/manifest.json' },
    { name: 'Torrentio Brazuca', url: 'https://torrentio.strem.fun/brazuca/manifest.json' },
    { name: 'Magnetflix', url: 'https://magnetflix.flixbr.online/manifest.json' }
  ];

  console.log('Testing provider manifest endpoints...');
  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const res = await fetch(ep.url, { signal: AbortSignal.timeout(5000) });
      const duration = Date.now() - start;
      console.log(`[${ep.name}] Status: ${res.status} (${duration}ms)`);
    } catch (err: any) {
      const duration = Date.now() - start;
      console.log(`[${ep.name}] FAILED: ${err.message} (${duration}ms)`);
    }
  }

  // Test stream retrieval for Oppenheimer (tt15398776)
  console.log('\nTesting stream fetching for Oppenheimer (tt15398776)...');
  const streamTests = [
    { name: 'Torrentio Brazuca', url: 'https://torrentio.strem.fun/brazuca/stream/movie/tt15398776.json' },
    { name: 'Torrentio Global', url: 'https://torrentio.strem.fun/stream/movie/tt15398776.json' },
    { name: 'FrostStream', url: 'https://froststream.cloutteam.com/stream/movie/tt15398776.json' },
    { name: 'FenixFlix', url: 'https://fenixflix.fenixhub.online/stream/movie/tt15398776.json' }
  ];

  for (const st of streamTests) {
    const start = Date.now();
    try {
      const res = await fetch(st.url, { signal: AbortSignal.timeout(5000) });
      const duration = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        console.log(`[${st.name}] Streams: ${data?.streams?.length || 0} (${duration}ms)`);
      } else {
        console.log(`[${st.name}] Status ${res.status} (${duration}ms)`);
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      console.log(`[${st.name}] FAILED: ${err.message} (${duration}ms)`);
    }
  }
}

checkEndpoints().catch(console.error);
