import fs from 'fs';

async function inspectSampleDbonlineAudio() {
  const buf = fs.readFileSync('sample_dbonline.mp4');
  console.log('Tamanho da amostra:', buf.length);

  // Procura por metadados de texto no udta ou moov
  const str = buf.toString('latin1');
  const interestingPatterns = [
    /bleach/i,
    /audio/i,
    /dublado/i,
    /legendado/i,
    /castellano/i,
    /espa[ñn]ol/i,
    /latino/i,
    /portugu[eê]s/i,
    /japanese/i,
    /english/i
  ];

  for (const p of interestingPatterns) {
    const match = str.match(p);
    if (match) {
      console.log('Encontrado padrão:', p, 'em índice:', match.index);
      const start = Math.max(0, (match.index || 0) - 40);
      const end = Math.min(str.length, (match.index || 0) + 60);
      console.log('  Trecho:', str.substring(start, end).replace(/[^\x20-\x7E]/g, '.'));
    }
  }
}

inspectSampleDbonlineAudio();
