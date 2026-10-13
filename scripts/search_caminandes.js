async function searchCaminandes() {
  const eps = [
    'Caminandes Llama Drama',
    'Caminandes Gran Dillama',
    'Caminandes Llamigos'
  ];
  for (const ep of eps) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=filetype:video%20\"${encodeURIComponent(ep)}\"&gsrlimit=3&prop=imageinfo&iiprop=url|mime|size`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ZapiTV/1.0' } });
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {});
    for (const p of pages) {
      console.log(`[${ep}] => ${p.title} (${p.imageinfo?.[0]?.mime})`);
      console.log(`  URL: ${p.imageinfo?.[0]?.url}`);
    }
  }
}
searchCaminandes();
