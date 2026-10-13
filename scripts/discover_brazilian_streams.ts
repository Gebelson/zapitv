import fs from 'fs';

async function scan() {
  console.log('Baixando lista de canais do Brasil...');
  const res = await fetch('https://iptv-org.github.io/iptv/countries/br.m3u');
  const text = await res.text();
  const lines = text.split('\n');
  const list: Array<{ name: string; url: string; group: string; logo: string; tvgId: string }> = [];
  
  let current: any = null;
  for (let l of lines) {
    l = l.trim();
    if (l.startsWith('#EXTINF:')) {
      const nameMatch = l.match(/,(.*)$/);
      const logoMatch = l.match(/tvg-logo="([^"]*)"/);
      const groupMatch = l.match(/group-title="([^"]*)"/);
      const tvgIdMatch = l.match(/tvg-id="([^"]*)"/);
      current = {
        name: nameMatch ? nameMatch[1].trim() : 'Canal',
        logo: logoMatch ? logoMatch[1] : '',
        group: groupMatch ? groupMatch[1] : '',
        tvgId: tvgIdMatch ? tvgIdMatch[1] : ''
      };
    } else if (l.startsWith('http') && current) {
      current.url = l;
      list.push(current);
      current = null;
    }
  }

  console.log(`Total de canais BR no iptv-org: ${list.length}`);

  const candidates = list.filter(c => 
    !c.url.includes('superflix') && !c.url.includes('parklogic') && !c.url.includes('embedplay') &&
    !c.url.includes('udp://') && !c.url.includes('.mpd') &&
    (
      c.name.toLowerCase().includes('tv') ||
      c.name.toLowerCase().includes('rede') ||
      c.name.toLowerCase().includes('sbt') ||
      c.name.toLowerCase().includes('record') ||
      c.name.toLowerCase().includes('cultura') ||
      c.name.toLowerCase().includes('pluto') ||
      c.name.toLowerCase().includes('brasil') ||
      c.name.toLowerCase().includes('camara') ||
      c.name.toLowerCase().includes('senado') ||
      c.name.toLowerCase().includes('news') ||
      c.name.toLowerCase().includes('radio')
    )
  );

  console.log(`Candidatos filtrados: ${candidates.length}`);

  const working: any[] = [];
  const limit = Math.min(candidates.length, 60);

  for (let i = 0; i < limit; i++) {
    const ch = candidates[i];
    try {
      const probe = await fetch(ch.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Range': 'bytes=0-1000'
        },
        signal: AbortSignal.timeout(3500)
      });
      if (probe.ok) {
        const ctype = (probe.headers.get('content-type') || '').toLowerCase();
        if (ctype.includes('mpegurl') || ctype.includes('octet-stream') || ctype.includes('video') || ch.url.includes('.m3u8')) {
          console.log(`[ONLINE] ${ch.name} -> ${ch.url}`);
          working.push({
            name: ch.name,
            tvgId: ch.tvgId,
            group: ch.group,
            logo: ch.logo,
            url: ch.url
          });
        }
      }
    } catch {}
  }

  console.log(`Total de transmissões ativas verificadas: ${working.length}`);
  fs.writeFileSync('scripts/verified_brazilian_streams.json', JSON.stringify(working, null, 2));
}

scan().catch(console.error);
