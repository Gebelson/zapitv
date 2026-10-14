import fs from 'fs';

async function testStreams() {
  const urls = [
    { name: 'FenixBot Dual Audio', url: 'https://fenixbot.squareweb.app/stream/54418?hash=3cad404eb4350cfc4bd98820' },
    { name: 'FenixFlix Hypex', url: 'http://fenixflix.fenixhub.online/r/z3GOu4GMVhYvaEtTvBoJgcYWaqTRRd15zFoiXMffLF7UX' },
    { name: 'FenixFlix 5.161 dub', url: 'http://5.161.85.176:3000/api/stream/tt0434665/1/1' },
    { name: 'FenixFlix 5.161 sub', url: 'http://5.161.85.176:3000/api/stream/tt0434665/1/1/sub' }
  ];

  for (const item of urls) {
    try {
      console.log(`Testando: ${item.name} (${item.url})`);
      const res = await fetch(item.url, {
        headers: { Range: 'bytes=0-1000000' },
        signal: AbortSignal.timeout(6000)
      });
      console.log(`  Status: ${res.status}, Type: ${res.headers.get('content-type')}, Length: ${res.headers.get('content-length')}`);
    } catch (e: any) {
      console.log(`  Erro: ${e.message}`);
    }
  }
}
testStreams();
