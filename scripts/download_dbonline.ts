import fs from 'fs';
import path from 'path';

async function downloadDbonline() {
  const url = 'http://dbonline.tech-cdn.top:80/series/ke-vin-0928392083/PZjF6XATTZ/59368.mp4';
  const target = path.resolve('sample_dbonline.mp4');
  console.log('Baixando 3MB de dbonline...');
  const res = await fetch(url, { headers: { Range: 'bytes=0-3000000' } });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, buf);
  console.log('Salvo em', target, 'bytes:', buf.length);
}
downloadDbonline();
