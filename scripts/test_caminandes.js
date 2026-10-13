async function testCaminandes() {
  const eps = [
    { title: 'Ep 2', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Caminandes_-_Gran_Dillama_-_Blender_Foundation%27s_new_Open_Movie.webm' },
    { title: 'Ep 3', url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Caminandes_3_-_Llamigos_-_Blender_Animated_Short.webm' }
  ];
  for (const ep of eps) {
    const res = await fetch(ep.url, { method: 'GET', headers: { Range: 'bytes=0-1000' } });
    console.log(ep.title, '=> HTTP', res.status, res.headers.get('content-range'), res.headers.get('content-type'));
  }
}
testCaminandes();
