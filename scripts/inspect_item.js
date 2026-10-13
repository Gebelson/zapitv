async function inspectItemPage() {
  const res = await fetch('https://libreflix.org/i/a-luta-das-auras-2024');
  const html = await res.text();
  console.log('Item page status:', res.status, 'length:', html.length);
  const videoMatches = html.match(/<video[^>]*>([\s\S]*?)<\/video>/gi);
  const iframes = html.match(/<iframe[^>]*src="([^"]+)"/gi);
  console.log('Video tags:', videoMatches);
  console.log('Iframes:', iframes);
  const mediaUrls = html.match(/https?:\/\/[^\s"'`]+\.(mp4|m3u8|webm)/gi);
  console.log('Media URLs:', mediaUrls);
  // Also look for vdn.libreflix.org or archive.org or peer
  const vdn = html.match(/https?:\/\/[^\s"'`]+libreflix[^\s"'`]+/gi);
  console.log('Libreflix domains in page:', vdn ? Array.from(new Set(vdn)).slice(0, 10) : 'none');
}
inspectItemPage();
