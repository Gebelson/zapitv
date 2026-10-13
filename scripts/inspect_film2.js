async function searchKeywords() {
  const res = await fetch('https://libreflix.org/f/seda-mg-2026');
  const html = await res.text();
  const lines = html.split('\n');
  const matching = lines.filter(l => /player|embed|stream|video|assistir|src=/i.test(l));
  console.log('Matching lines:', matching.slice(0, 15));
}
searchKeywords();
