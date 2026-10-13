async function inspectScripts() {
  const res = await fetch('https://libreflix.org/assistir/a-luta-das-auras-2024');
  const html = await res.text();
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim()).filter(s => s.length > 0);
  console.log('Inline scripts count:', scripts.length);
  for (let i = 0; i < scripts.length; i++) {
    console.log(`Script ${i}:`, scripts[i].slice(0, 400));
  }
}
inspectScripts();
