async function testAll() {
  const list = [
    { name: 'Night of Living Dead', url: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Night_of_the_Living_Dead_%281968%29.webm' },
    { name: 'Charade 1963', url: 'https://upload.wikimedia.org/wikipedia/commons/d/dc/Charade_%281963%29.webm' },
    { name: 'Nosferatu 1922', url: 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Nosferatu_le_vampire-Film_Murnau_1922.webm' },
    { name: 'Historias Fome BR', url: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Document%C3%A1rio-_Hist%C3%B3rias_da_Fome_no_Brasil.webm' },
    { name: 'Brasil Hoje Salvador', url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Brasil_Hoje_n._56_%281974%29_-_Document%C3%A1rio_da_Ag%C3%AAncia_Nacional_sobre_a_cidade_de_Salvador%2C_Bahia.webm' },
    { name: 'Big Buck Bunny HLS', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
    { name: 'Tears of Steel HLS', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8' },
    { name: 'Caminandes Ep1', url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d0/Caminandes-_Llama_Drama_-_Short_Movie.ogv/Caminandes-_Llama_Drama_-_Short_Movie.ogv.720p.vp9.webm' },
    { name: 'Caminandes Ep2', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Caminandes_-_Gran_Dillama_-_Blender_Foundation%27s_new_Open_Movie.webm' },
    { name: 'Caminandes Ep3', url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Caminandes_3_-_Llamigos_-_Blender_Animated_Short.webm' },
    { name: 'Steamboat Willie', url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Steamboat_Willie_%281928%29_by_Walt_Disney.webm' }
  ];

  console.log('Testing all verified catalog URLs:');
  for (const item of list) {
    try {
      const res = await fetch(item.url, {
        headers: { Range: 'bytes=0-1000', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6000)
      });
      const ok = res.status === 200 || res.status === 206;
      console.log(`[${ok ? 'OK' : 'FAIL'}] ${item.name}: Status ${res.status} (${res.headers.get('content-type')})`);
    } catch (e) {
      console.log(`[FAIL] ${item.name}: ${e.message}`);
    }
  }
}
testAll();
