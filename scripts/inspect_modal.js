async function searchModal() {
  const res = await fetch('https://libreflix.org/f/seda-mg-2026');
  const html = await res.text();
  const idx = html.indexOf('id="assistir1"');
  if (idx !== -1) {
    console.log(html.substring(idx - 100, idx + 1000));
  } else {
    console.log('Not found');
  }
}
searchModal();
