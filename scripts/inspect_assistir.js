async function inspectAssistir() {
  const res = await fetch('https://libreflix.org/assistir/a-luta-das-auras-2024');
  const html = await res.text();
  console.log('Assistir page status:', res.status, 'length:', html.length);
  const videoMatches = html.match(/<video[^>]*>([\s\S]*?)<\/video>/gi);
  const iframes = html.match(/<iframe[^>]*src="([^"]+)"/gi);
  console.log('Video tags:', videoMatches);
  console.log('Iframes:', iframes);
  const sources = html.match(/<source[^>]*src="([^"]+)"/gi);
  console.log('Sources:', sources);
  const scripts = html.match(/<script[\s\S]*?<\/script>/gi);
  if (scripts) {
    for (const s of scripts) {
      if (s.includes('.mp4') || s.includes('.m3u8') || s.includes('player') || s.includes('video')) {
        console.log('Player script:', s.slice(0, 300));
      }
    }
  }
}
inspectAssistir();
