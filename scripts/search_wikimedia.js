async function searchWikimedia() {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=filetype:video%20\"Night%20of%20the%20Living%20Dead\"&gsrlimit=5&prop=imageinfo&iiprop=url|mime|size|metadata';
  const res = await fetch(url, { headers: { 'User-Agent': 'ZapiTV/1.0 (test)' } });
  const data = await res.json();
  console.log('Wikimedia search results:');
  const pages = data.query?.pages || {};
  for (const k of Object.keys(pages)) {
    const p = pages[k];
    console.log(p.title, p.imageinfo?.[0]?.url, p.imageinfo?.[0]?.mime);
  }
}
searchWikimedia();
