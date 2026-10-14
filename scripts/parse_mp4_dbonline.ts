import fs from 'fs';

function parseMp4Boxes(buffer: Buffer) {
  let offset = 0;
  console.log('Tamanho total:', buffer.length);

  while (offset < buffer.length - 8) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    console.log(`Box: ${type} em ${offset}, tamanho: ${size}`);

    if (type === 'moov') {
      parseMoov(buffer.slice(offset + 8, offset + size));
    }

    if (size <= 0) break;
    offset += size;
  }
}

function parseMoov(moovBuf: Buffer) {
  let offset = 0;
  while (offset < moovBuf.length - 8) {
    const size = moovBuf.readUInt32BE(offset);
    const type = moovBuf.toString('ascii', offset + 4, offset + 8);
    console.log(`  moov child: ${type} (size: ${size})`);

    if (type === 'trak') {
      parseTrak(moovBuf.slice(offset + 8, offset + size));
    }
    if (size <= 0) break;
    offset += size;
  }
}

function parseTrak(trakBuf: Buffer) {
  const str = trakBuf.toString('binary');
  let hdlrIdx = str.indexOf('hdlr');
  let type = 'unknown';
  let name = '';
  if (hdlrIdx !== -1) {
    type = trakBuf.toString('ascii', hdlrIdx + 8, hdlrIdx + 12);
    // hdlr name starts around offset + 24
    name = trakBuf.toString('utf8', hdlrIdx + 24, Math.min(trakBuf.length, hdlrIdx + 50)).replace(/\0/g, '').trim();
  }

  let mdhdIdx = str.indexOf('mdhd');
  let lang = 'und';
  if (mdhdIdx !== -1) {
    const version = trakBuf.readUInt8(mdhdIdx + 4);
    const langOffset = version === 1 ? mdhdIdx + 4 + 28 : mdhdIdx + 4 + 16;
    if (langOffset + 2 <= trakBuf.length) {
      const code = trakBuf.readUInt16BE(langOffset);
      const c1 = String.fromCharCode(((code >> 10) & 0x1f) + 0x60);
      const c2 = String.fromCharCode(((code >> 5) & 0x1f) + 0x60);
      const c3 = String.fromCharCode((code & 0x1f) + 0x60);
      lang = c1 + c2 + c3;
    }
  }

  console.log(`    -> Track: type=${type}, lang=${lang}, name="${name}"`);
}

const buf = fs.readFileSync('sample_dbonline.mp4');
parseMp4Boxes(buf);
