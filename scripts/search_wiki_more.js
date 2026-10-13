async function searchMoreWiki() {
  const titles = [
    'A Trip to the Moon',
    'Nosferatu',
    'The General',
    'Steamboat Willie',
    'Charade',
    'Metropolis',
    'Caminandes',
    'Sintel',
    'Big Buck Bunny',
    'Tears of Steel'
  ];

  for (const t of titles) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=filetype:video%20\"${encodeURIComponent(t)}\"&gsrlimit=2&prop=imageinfo&iiprop=url|mime|size`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'ZapiTV/1.0' } });
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      const videoPage = pages.find(p => p.imageinfo?.[0]?.url);
      if (videoPage) {
        console.log(`[${t}] => ${videoPage.title} (${videoPage.imageinfo[0].mime})`);
        console.log(`  URL: ${videoPage.imageinfo[0].url}`);
      } else {
        console.log(`[${t}] => No direct video found`);
      }
    } catch (e) {
      console.log(`[${t}] => Error: ${e.message}`);
    }
  }
}
searchMoreWiki();
