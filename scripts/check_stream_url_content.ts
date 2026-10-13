async function checkStreamContent() {
  const res1 = await fetch('https://fenixflix.fenixhub.online/stream/series/tt0069576:1:1.json');
  const d1: any = await res1.json();
  console.log('--- Doraemon tt0069576 ---');
  for (const s of d1.streams) {
    console.log('Stream:', s.title, 'URL:', s.url);
    try {
      const vRes = await fetch(s.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
      const txt = await vRes.text();
      console.log('M3U8 preview:', txt.substring(0, 150));
    } catch (e: any) {
      console.log('Fetch error:', e.message);
    }
  }

  const res2 = await fetch('https://fenixflix.fenixhub.online/stream/series/tt14962432:1:1.json');
  const d2: any = await res2.json();
  console.log('--- Overflow tt14962432 ---');
  for (const s of d2.streams) {
    console.log('Stream:', s.title, 'URL:', s.url);
    try {
      const vRes = await fetch(s.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
      const txt = await vRes.text();
      console.log('M3U8 preview:', txt.substring(0, 150));
    } catch (e: any) {
      console.log('Fetch error:', e.message);
    }
  }
}

checkStreamContent().catch(console.error);
