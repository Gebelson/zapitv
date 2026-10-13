async function testMoriAddons() {
  const addons = [
    'https://torrentio.strem.fun',
    'https://torrentio.strem.fun/brazuca',
    'https://animekitsu.strem.fun',
    'https://opensubtitles-v3.strem.io'
  ];

  for (const a of addons) {
    try {
      const res = await fetch(`${a}/stream/series/tt26598191:1:1.json`);
      if (res.ok) {
        const d: any = await res.json();
        console.log(`[${a}] streams: ${d?.streams?.length || 0}`);
        if (d?.streams?.length > 0) {
          console.log(d.streams.slice(0, 3));
        }
      }
    } catch (e: any) {
      console.log(`[${a}] err: ${e.message}`);
    }
  }
}

testMoriAddons();
