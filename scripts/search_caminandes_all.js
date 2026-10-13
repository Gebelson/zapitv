async function searchAllCaminandes() {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&list=allimages&aifrom=Caminandes&ailimit=10&prop=imageinfo&iiprop=url|mime';
  const res = await fetch(url, { headers: { 'User-Agent': 'ZapiTV/1.0' } });
  const data = await res.json();
  console.log('Caminandes files:', data.query?.allimages);
}
searchAllCaminandes();
