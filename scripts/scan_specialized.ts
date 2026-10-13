import fs from 'fs';

async function scanMore() {
  const res = await fetch('https://iptv-org.github.io/iptv/countries/br.m3u');
  const text = await res.text();
  const lines = text.split('\n');
  const list: any[] = [];
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

  // Look for Kids, Movies, Animation, Sports, Culture
  const specific = list.filter(c =>
    c.url.includes('jmp2.uk') || c.url.includes('pluto.tv') || c.url.includes('tvcultura') ||
    c.url.includes('ebc.com.br') || c.url.includes('cloudfront') || c.name.toLowerCase().includes('cine') ||
    c.name.toLowerCase().includes('kids') || c.name.toLowerCase().includes('monica') ||
    c.name.toLowerCase().includes('filme') || c.name.toLowerCase().includes('sport') ||
    c.name.toLowerCase().includes('anime')
  );

  const working: any[] = [];
  for (const ch of specific) {
    try {
      const probe = await fetch(ch.url, { 
        method: 'GET', 
        headers: { 'Range': 'bytes=0-1000' },
        signal: AbortSignal.timeout(3000) 
      });
      if (probe.ok) {
        const ctype = (probe.headers.get('content-type') || '').toLowerCase();
        if (ctype.includes('mpegurl') || ctype.includes('octet-stream') || ctype.includes('video') || ch.url.includes('.m3u8')) {
          console.log(`[ONLINE] ${ch.name} -> ${ch.url}`);
          working.push({ name: ch.name, tvgId: ch.tvgId, group: ch.group, logo: ch.logo, url: ch.url });
        }
      }
    } catch {}
  }
  console.log('Working specialized channels:', working.length);
  fs.writeFileSync('scripts/working_specialized.json', JSON.stringify(working, null, 2));
}
scanMore();
