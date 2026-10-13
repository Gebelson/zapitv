async function testFenix() {
  const ids = [
    'tt0069576:1:1',
    'tt4083422:1:1',
    '57911:1:1',
    '65733:1:1',
    'tt14962432:1:1',
    '95897:1:1',
    'tt26598191:1:1',
    '204269:1:1',
    'tt30325611:1:1',
    '241002:1:1'
  ];

  for (const id of ids) {
    try {
      const res = await fetch(`https://fenixflix.fenixhub.online/stream/series/${id}.json`, {
        headers: { 'User-Agent': 'Stremio/4.4.168' }
      });
      const data: any = await res.json();
      console.log(`[series/${id}] -> ${data?.streams?.length || 0} streams`);
      if (data?.streams?.length > 0) {
        for (const s of data.streams) {
          console.log(`   Title: "${s.title?.replace(/\n/g, ' ')}"`);
        }
      }
    } catch (e: any) {
      console.log(`[series/${id}] Error: ${e.message}`);
    }
  }
}

testFenix();
