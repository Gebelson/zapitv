async function inspectFilmPage() {
  const res = await fetch('https://libreflix.org/f/seda-mg-2026');
  const html = await res.text();
  console.log('Film page length:', html.length);
  // look for video, iframe, source tags
  const videos = html.match(/<video[^>]*>([\s\S]*?)<\/video>/gi);
  const iframes = html.match(/<iframe[^>]*src="([^"]+)"/gi);
  const sources = html.match(/<source[^>]*src="([^"]+)"/gi);
  console.log('Videos:', videos);
  console.log('Iframes:', iframes);
  console.log('Sources:', sources);

  // Look for any streaming url
  const urls = html.match(/https?:\/\/[^\s"'`]+\.(mp4|m3u8|webm)/gi);
  console.log('Direct video urls:', urls);
}
inspectFilmPage();
