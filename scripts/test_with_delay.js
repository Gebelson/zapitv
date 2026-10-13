async function testWithDelay() {
  const list = [
    { name: 'Historias Fome BR', url: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Document%C3%A1rio-_Hist%C3%B3rias_da_Fome_no_Brasil.webm' },
    { name: 'Caminandes Ep2', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Caminandes_-_Gran_Dillama_-_Blender_Foundation%27s_new_Open_Movie.webm' },
    { name: 'Steamboat Willie', url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Steamboat_Willie_%281928%29_by_Walt_Disney.webm' }
  ];

  for (const item of list) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res = await fetch(item.url, {
        headers: { Range: 'bytes=0-1000', 'User-Agent': 'ZapiTV-Player/1.0 (gebel.streaming@zapitv.local)' },
        signal: AbortSignal.timeout(6000)
      });
      console.log(`[${res.status === 200 || res.status === 206 ? 'OK' : 'FAIL'}] ${item.name}: Status ${res.status}`);
    } catch (e) {
      console.log(`[FAIL] ${item.name}: ${e.message}`);
    }
  }
}
testWithDelay();
