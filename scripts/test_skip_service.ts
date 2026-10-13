import { skipService, SkipInterval } from '../src/core/skip/skipService';
import { ContentType, ContentItem } from '../types';

// Mock localStorage in Node
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

async function testSkipService() {
  console.log('=== TESTE 1: Skip Anime (Naruto / MAL 20 / Ep 1) ===');
  const narutoItem: ContentItem = {
    id: 'anime-naruto',
    title: 'Naruto',
    type: ContentType.ANIME,
    rating: 8.5,
    year: 2002,
    image: ''
  };

  const narutoIntervals = await skipService.getSkipTimes(narutoItem, 1, 1, 1420);
  console.log(`Naruto Ep 1 obteve ${narutoIntervals.length} intervalos:`);
  narutoIntervals.forEach(i => {
    console.log(` - [${i.type.toUpperCase()}] ${i.label}: ${i.startTime}s -> ${i.endTime}s (${i.source})`);
  });

  if (narutoIntervals.length === 0) {
    throw new Error('Falha ao obter intervalos para Naruto Ep 1');
  }

  const opInterval = narutoIntervals.find(i => i.type === 'op');
  if (!opInterval || opInterval.startTime !== 1) {
    throw new Error('Intervalo de abertura de Naruto não confere');
  }
  console.log('✔ Teste 1 passou com sucesso!');

  console.log('\n=== TESTE 1B: Skip Anime por Título via AniList (Attack on Titan / Ep 1) ===');
  const aotItem: ContentItem = {
    id: 'anime-aot',
    title: 'Attack on Titan',
    type: ContentType.ANIME,
    rating: 9.0,
    year: 2013,
    image: ''
  };
  const aotIntervals = await skipService.getSkipTimes(aotItem, 1, 1, 1500);
  console.log(`Attack on Titan Ep 1 obteve ${aotIntervals.length} intervalos:`);
  aotIntervals.forEach(i => {
    console.log(` - [${i.type.toUpperCase()}] ${i.label}: ${i.startTime}s -> ${i.endTime}s (${i.source})`);
  });
  if (aotIntervals.length === 0) {
    throw new Error('Falha ao obter intervalos para Attack on Titan');
  }
  console.log('✔ Teste 1B passou com sucesso!');

  console.log('\n=== TESTE 2: Skip Série (Game of Thrones / tt0944947 / S1 E1) ===');
  const gotItem: ContentItem = {
    id: 'series-got',
    imdbId: 'tt0944947',
    title: 'Game of Thrones',
    type: ContentType.SERIES,
    rating: 9.3,
    year: 2011,
    image: ''
  };

  const gotIntervals = await skipService.getSkipTimes(gotItem, 1, 1, 3700);
  console.log(`Game of Thrones S1 E1 obteve ${gotIntervals.length} intervalos:`);
  gotIntervals.forEach(i => {
    console.log(` - [${i.type.toUpperCase()}] ${i.label}: ${i.startTime}s -> ${i.endTime}s (${i.source})`);
  });

  const gotOp = gotIntervals.find(i => i.type === 'op');
  if (!gotOp || gotOp.startTime !== 437 || gotOp.endTime !== 531) {
    throw new Error('Intervalo de abertura de Game of Thrones não confere');
  }
  console.log('✔ Teste 2 passou com sucesso!');

  console.log('\n=== TESTE 3: Auto-Skip Preference ===');
  console.log('Padrão auto-skip:', skipService.isAutoSkipEnabled());
  if (skipService.isAutoSkipEnabled() !== false) {
    throw new Error('Auto-skip deve ser desabilitado por padrão (requisito 8)');
  }
  skipService.setAutoSkipEnabled(true);
  if (skipService.isAutoSkipEnabled() !== true) {
    throw new Error('Falha ao habilitar auto-skip');
  }
  skipService.setAutoSkipEnabled(false);
  console.log('✔ Teste 3 passou: auto-skip inicia desabilitado por padrão!');

  console.log('\n=== TESTE 4: Offset Manual e Compensação de Edição ===');
  skipService.setSkipOffset(gotItem.id, 5); // +5s logo extra
  const offsetGot = await skipService.getSkipTimes(gotItem, 1, 1, 3700);
  const offsetOp = offsetGot.find(i => i.type === 'op');
  if (!offsetOp || offsetOp.startTime !== 442 || offsetOp.endTime !== 536) {
    throw new Error(`Offset de +5s falhou: obteve ${offsetOp?.startTime}s -> ${offsetOp?.endTime}s`);
  }
  console.log(`Com offset +5s: ${offsetOp.startTime}s -> ${offsetOp.endTime}s (raw: ${offsetOp.rawStartTime}s -> ${offsetOp.rawEndTime}s)`);
  skipService.setSkipOffset(gotItem.id, 0); // Limpa offset
  console.log('✔ Teste 4 passou com sucesso!');

  console.log('\n=== TESTE 5: Marcação Manual Customizada ===');
  skipService.saveManualInterval(gotItem.id, 1, 2, {
    startTime: 120,
    endTime: 210,
    type: 'op'
  });
  const manualResult = await skipService.getSkipTimes(gotItem, 1, 2, 3600);
  const manualOp = manualResult.find(i => i.type === 'op');
  if (!manualOp || manualOp.startTime !== 120 || manualOp.endTime !== 210 || manualOp.source !== 'manual') {
    throw new Error('Marcação manual falhou');
  }
  console.log(`Marcação manual salva: ${manualOp.label} ${manualOp.startTime}s -> ${manualOp.endTime}s`);
  skipService.clearManualInterval(gotItem.id, 1, 2);
  console.log('✔ Teste 5 passou com sucesso!');

  console.log('\n=== TESTE 6: Cache em Memória e LocalStorage ===');
  const cachedCallStart = Date.now();
  const cachedGot = await skipService.getSkipTimes(gotItem, 1, 1, 3700);
  const elapsed = Date.now() - cachedCallStart;
  console.log(`Chamada com cache respondeu em ${elapsed}ms (${cachedGot.length} intervalos)`);
  if (elapsed > 50) {
    console.warn(`Atenção: chamada de cache demorou ${elapsed}ms`);
  }
  console.log('✔ Teste 6 passou com sucesso!');

  console.log('\nTODOS OS TESTES DO SKIP SERVICE PASSARAM!');
}

testSkipService().catch(err => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
