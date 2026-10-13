async function searchPtBrWiki() {
  const query = 'filetype:video Brasil documentario';
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=imageinfo&iiprop=url|mime|size`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ZapiTV/1.0' } });
  const data = await res.json();
  const pages = Object.values(data.query?.pages || {});
  for (const p of pages) {
    console.log(p.title, p.imageinfo?.[0]?.url);
  }
}
searchPtBrWiki();
