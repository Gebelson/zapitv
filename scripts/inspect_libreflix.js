async function check() {
  const res = await fetch('https://libreflix.org/');
  const html = await res.text();
  // Find script tags or API endpoints
  const scriptTags = html.match(/<script[^>]*src="([^"]+)"/g);
  console.log('Scripts:', scriptTags);
  // Look for any links or json
  const jsonMatches = html.match(/\/api\/[a-zA-Z0-9\/_-]+/g);
  console.log('API paths:', jsonMatches);
}
check();
