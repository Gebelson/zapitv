async function findAvailableFilms() {
  const exploreRes = await fetch('https://libreflix.org/explore/format/fic');
  const exploreHtml = await exploreRes.text();
  const slugs = [...exploreHtml.matchAll(/\/i\/([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  const uniqueSlugs = Array.from(new Set(slugs)).slice(0, 15);
  console.log('Testing slugs:', uniqueSlugs);

  for (const slug of uniqueSlugs) {
    try {
      const res = await fetch(`https://libreflix.org/assistir/${slug}`);
      const html = await res.text();
      if (!html.includes('Conteúdo Indisponível para Assistir')) {
        console.log(`FOUND AVAILABLE: https://libreflix.org/assistir/${slug}`);
        // look for video url or iframe or embed in html
        const video = html.match(/<iframe[^>]*src="([^"]+)"|<video[^>]*src="([^"]+)"|src="([^"]+\.(mp4|webm|m3u8))"/i);
        console.log('Video element match:', video ? video[0] : 'no direct tag');
        // Let's print snippets with player or iframe
        const iframeMatch = html.match(/<iframe[^>]+>/i);
        if (iframeMatch) console.log('Iframe:', iframeMatch[0]);
        const videoMatch = html.match(/<video[^>]+>/i);
        if (videoMatch) console.log('Video tag:', videoMatch[0]);
        // print any url with .mp4 or youtube or vimeo or peertube
        const streamUrls = html.match(/https?:\/\/[^\s"'`]+(youtube|vimeo|peertube|archive|\.mp4|\.m3u8)[^\s"'`]*/gi);
        console.log('Stream URLs found:', streamUrls);
        break;
      } else {
        console.log(`Unavailable: ${slug}`);
      }
    } catch (e) {
      console.log(`Error checking ${slug}:`, e.message);
    }
  }
}
findAvailableFilms();
