async function testBrasilVideos() {
  const vids = [
    { name: 'Histórias da Fome no Brasil', url: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Document%C3%A1rio-_Hist%C3%B3rias_da_Fome_no_Brasil.webm' },
    { name: 'Brasil Hoje - Salvador', url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Brasil_Hoje_n._56_%281974%29_-_Document%C3%A1rio_da_Ag%C3%AAncia_Nacional_sobre_a_cidade_de_Salvador%2C_Bahia.webm' }
  ];
  for (const v of vids) {
    const res = await fetch(v.url, { headers: { Range: 'bytes=0-1000' } });
    console.log(v.name, '=> HTTP', res.status, res.headers.get('content-range'), res.headers.get('content-type'));
  }
}
testBrasilVideos();
