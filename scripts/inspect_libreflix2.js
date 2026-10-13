async function inspectMain() {
  const htmlRes = await fetch('https://libreflix.org/');
  const html = await htmlRes.text();
  const links = [...html.matchAll(/href="([^"#]+)"/g)].map(m => m[1]);
  console.log('Sample links from homepage:', Array.from(new Set(links)).slice(0, 20));

  const jsRes = await fetch('https://libreflix.org/js/main.js');
  const js = await jsRes.text();
  console.log('js/main.js length:', js.length);
  const endpoints = js.match(/https?:\/\/[^\s"'`]+/g);
  console.log('Endpoints in main.js:', endpoints ? endpoints.slice(0, 10) : 'none');
}
inspectMain();
