async function check() {
  try {
    const res = await fetch('https://libreflix.org/', { signal: AbortSignal.timeout(5000) });
    console.log('Libreflix status:', res.status);
    const html = await res.text();
    console.log('Libreflix HTML snippet:', html.slice(0, 500));
  } catch (e) {
    console.log('Libreflix error:', e.message);
  }
}
check();
