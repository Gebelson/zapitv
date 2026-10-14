async function inspectDbonline() {
  const url = 'http://dbonline.tech-cdn.top:80/series/ke-vin-0928392083/PZjF6XATTZ/59368.mp4';
  const res = await fetch(url, { headers: { Range: 'bytes=0-2000000' } });
  const buf = Buffer.from(await res.arrayBuffer());
  const str = buf.toString('binary');
  console.log('Tamanho cabeçalho dbonline:', buf.length);

  let idx = 0;
  while ((idx = str.indexOf('hdlr', idx)) !== -1) {
    const handlerType = str.substring(idx + 8, idx + 12);
    console.log('hdlr em', idx, 'tipo:', handlerType);
    idx += 4;
  }

  let mdhdIdx = 0;
  while ((mdhdIdx = str.indexOf('mdhd', mdhdIdx)) !== -1) {
    const version = buf.readUInt8(mdhdIdx + 4);
    const langOffset = version === 1 ? mdhdIdx + 4 + 28 : mdhdIdx + 4 + 16;
    if (langOffset + 2 <= buf.length) {
      const langCode = buf.readUInt16BE(langOffset);
      const c1 = String.fromCharCode(((langCode >> 10) & 0x1f) + 0x60);
      const c2 = String.fromCharCode(((langCode >> 5) & 0x1f) + 0x60);
      const c3 = String.fromCharCode((langCode & 0x1f) + 0x60);
      console.log('mdhd language code:', c1 + c2 + c3, 'raw:', langCode);
    }
    mdhdIdx += 4;
  }
}
inspectDbonline();
