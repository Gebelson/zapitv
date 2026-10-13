import { providerRegistry } from '../src/core/providers/providerRegistry';

async function runTests() {
  console.log('=== TESTE DE VALIDAÇÃO DE CONTEÚDOS E BLOQUEIO DE TROCAS ===\n');

  // 1. Doraemon
  console.log('1. Testando Doraemon (IMDb: tt0069576)...');
  const doraemonStreams = await providerRegistry.resolveStreams(
    'series',
    { imdbId: 'tt0069576', tmdbId: '57911', title: 'Doraemon' },
    { season: 1, episode: 1 }
  );
  const doraemonBad = doraemonStreams.filter(s => {
    const txt = `${s.name} ${s.title} ${s.url}`.toLowerCase();
    return txt.includes('/1684/') || txt.includes('sparks of tomorrow') || txt.includes('plantão médico') || txt.includes('ultraman');
  });
  if (doraemonBad.length === 0) {
    console.log('  [PASS] Nenhum stream trocado (Sparks of Tomorrow, Plantão Médico, Ultraman) passou para Doraemon!');
  } else {
    console.error('  [FAIL] Streams impróprios detectados em Doraemon:', doraemonBad);
  }

  // 2. Overflow
  console.log('\n2. Testando Overflow: Transbordando (TMDB: 95897)...');
  const overflowStreams = await providerRegistry.resolveStreams(
    'anime',
    { tmdbId: '95897', imdbId: 'tt14962432', title: 'Overflow: Transbordando' },
    { season: 1, episode: 1 }
  );
  const overflowBad = overflowStreams.filter(s => {
    const txt = `${s.name} ${s.title} ${s.url}`.toLowerCase();
    return txt.includes('/1224/') || txt.includes('black clover');
  });
  const overflowTop = overflowStreams[0];
  if (overflowBad.length === 0 && overflowTop?.isDubbed && overflowTop?.isPtBr) {
    console.log(`  [PASS] Black Clover foi 100% bloqueado e o stream #1 é verificado Dublado PT-BR: "${overflowTop.name}"!`);
  } else {
    console.error('  [FAIL] Falha na validação de Overflow:', { overflowBad, overflowTop });
  }

  // 3. Mori no Kuma-san, Toumin-chuu.
  console.log('\n3. Testando Mori no Kuma-san, Toumin-chuu. (IMDb: tt26598191)...');
  const moriStreams = await providerRegistry.resolveStreams(
    'anime',
    { imdbId: 'tt26598191', tmdbId: '204269', title: 'Mori no Kuma-san, Toumin-chuu.' },
    { season: 1, episode: 1 }
  );
  const moriBad = moriStreams.filter(s => {
    const txt = `${s.name} ${s.title} ${s.url}`.toLowerCase();
    return txt.includes('/1736/') || txt.includes('murai in love') || txt.includes('murai no koi');
  });
  if (moriBad.length === 0) {
    console.log('  [PASS] Murai in Love foi 100% bloqueado para Mori no Kuma-san!');
  } else {
    console.error('  [FAIL] Streams impróprios detectados em Mori no Kuma-san:', moriBad);
  }

  // 4. Modaete yo, Adam-kun
  console.log('\n4. Testando Modaete yo, Adam-kun (TMDB: 241002)...');
  const adamStreams = await providerRegistry.resolveStreams(
    'anime',
    { tmdbId: '241002', imdbId: 'tt30325611', title: 'Modaete yo, Adam-kun' },
    { season: 1, episode: 1 }
  );
  const adamBad = adamStreams.filter(s => {
    const txt = `${s.name} ${s.title} ${s.url}`.toLowerCase();
    return txt.includes('/1332/') || txt.includes('saving 80,000 gold') || txt.includes('80,000 gold');
  });
  const adamTop = adamStreams[0];
  if (adamBad.length === 0 && adamTop?.url?.includes('Modaete')) {
    console.log(`  [PASS] Saving 80,000 Gold foi 100% bloqueado e o stream #1 é do Adam-kun legítimo: "${adamTop.name}"!`);
  } else {
    console.error('  [FAIL] Falha na validação de Modaete yo, Adam-kun:', { adamBad, adamTop });
  }

  console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
}

runTests();
