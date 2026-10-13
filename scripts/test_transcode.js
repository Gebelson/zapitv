async function testTranscode() {
  const url = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d0/Caminandes-_Llama_Drama_-_Short_Movie.ogv/Caminandes-_Llama_Drama_-_Short_Movie.ogv.720p.vp9.webm';
  const res = await fetch(url, { headers: { Range: 'bytes=0-1000' } });
  console.log('Transcoded Ep 1 => HTTP', res.status, res.headers.get('content-type'));
}
testTranscode();
