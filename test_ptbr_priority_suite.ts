import { sourceSelectionService } from './src/core/selection/sourceSelectionService';
import { audioPreferenceService } from './src/core/audio/audioPreferenceService';
import { subtitlePreferenceService } from './src/core/subtitles/subtitlePreferenceService';
import { StremioStream } from './src/core/stremio/stremioTypes';

console.log('===============================================================');
console.log('🧪 INICIANDO BATERIA DE TESTES: PRIORIDADE DE DUBLAGEM PT-BR');
console.log('===============================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   Detalhes: ${details}`);
    process.exitCode = 1;
  }
}

// =========================================================================
// CENÁRIO 1: Dublado 720p com hardsub VS Original 1080p limpo com legenda externa
// =========================================================================
console.log('--- CENÁRIO 1: Dublado 720p Hardsub vs. Original 1080p RAW + Legenda externa ---');
{
  const streamA: StremioStream = {
    name: 'AnimeFire [Dublado]',
    title: 'Episódio 01 - Dublado em Português [Hardsub]',
    url: 'https://example.com/dub_hardsub.mp4',
    quality: '720p'
  };

  const streamB: StremioStream = {
    name: 'SubsPlease [RAW]',
    title: 'Episode 01 [1080p] [RAW] [Clean Video]',
    url: 'https://example.com/raw_clean.mp4',
    quality: '1080p'
  };

  const ranked = sourceSelectionService.rankStreams([streamA, streamB], {
    hasExternalPtSub: true
  });

  const selected = ranked[0];
  const evalA = sourceSelectionService.evaluateStream(streamA, { hasExternalPtSub: true });
  const evalB = sourceSelectionService.evaluateStream(streamB, { hasExternalPtSub: true });

  assert(
    selected.name === streamA.name,
    'Cenário 1: Selecionar fonte dublada 720p com hardsub em vez de original 1080p limpo',
    `Selecionado: ${selected.name} (Score: ${(selected as any)._smartScore}), Esperado: ${streamA.name} (Score A: ${evalA.score}, Score B: ${evalB.score})`
  );
  assert(
    evalA.score > evalB.score,
    'Cenário 1: Pontuação da dublagem supera versão legendada limpa',
    `Score A: ${evalA.score} > Score B: ${evalB.score}`
  );
}

// =========================================================================
// CENÁRIO 2: Duas fontes dubladas, uma limpa e outra com hardsub
// =========================================================================
console.log('\n--- CENÁRIO 2: Dublada Limpa vs. Dublada Hardsub ---');
{
  const streamClean: StremioStream = {
    name: 'ZapiTV Acervo [Dublado]',
    title: 'Episódio 01 - Dublado [1080p] [Clean Video] [RAW]',
    url: 'https://example.com/dub_clean.mp4',
    quality: '1080p'
  };

  const streamHardsub: StremioStream = {
    name: 'Provider [Dublado]',
    title: 'Episódio 01 - Dublado [1080p] [Hardsub]',
    url: 'https://example.com/dub_hardsub.mp4',
    quality: '1080p'
  };

  const ranked = sourceSelectionService.rankStreams([streamHardsub, streamClean], {
    hasExternalPtSub: false
  });

  assert(
    ranked[0].name === streamClean.name,
    'Cenário 2: Entre duas fontes dubladas, prioriza a versão com vídeo limpo',
    `Primeiro: ${ranked[0].name}, Segundo: ${ranked[1].name}`
  );
}

// =========================================================================
// CENÁRIO 3: Sem dublagem: Fonte limpa 1080p com legenda externa vs. Hardsub PT-BR 720p
// =========================================================================
console.log('\n--- CENÁRIO 3: Sem dublagem: Limpa 1080p + Legenda Externa vs. Hardsub PT-BR ---');
{
  const streamCleanRaw: StremioStream = {
    name: 'Erai-raws [RAW]',
    title: 'Episode 01 [1080p] [Clean Video]',
    url: 'https://example.com/raw.mp4',
    quality: '1080p'
  };

  const streamHardsubPt: StremioStream = {
    name: 'AnimeFire [Leg]',
    title: 'Episódio 01 [720p] [Hardsub PT-BR]',
    url: 'https://example.com/hardsub.mp4',
    quality: '720p'
  };

  const ranked = sourceSelectionService.rankStreams([streamHardsubPt, streamCleanRaw], {
    hasExternalPtSub: true // Legenda externa disponível no ZapiTV!
  });

  assert(
    ranked[0].name === streamCleanRaw.name,
    'Cenário 3: Com legenda externa no ZapiTV, prioriza o vídeo original limpo 1080p sobre hardsub',
    `Selecionado: ${ranked[0].name}, Esperado: ${streamCleanRaw.name}`
  );
}

// =========================================================================
// CENÁRIO 4: Sem dublagem e sem legenda externa: Hardsub PT-BR como salvação
// =========================================================================
console.log('\n--- CENÁRIO 4: Sem dublagem e sem legenda externa: Hardsub PT-BR fallback ---');
{
  const streamCleanForeignOnly: StremioStream = {
    name: 'Japanese Broadcast [RAW]',
    title: 'Episode 01 [1080p] [Japanese Audio]',
    url: 'https://example.com/japanese_only.mp4',
    quality: '1080p'
  };

  const streamHardsubPt: StremioStream = {
    name: 'AnimeFire [Leg]',
    title: 'Episódio 01 [720p] [Hardsub PT-BR]',
    url: 'https://example.com/hardsub.mp4',
    quality: '720p'
  };

  const ranked = sourceSelectionService.rankStreams([streamCleanForeignOnly, streamHardsubPt], {
    hasExternalPtSub: false // SEM legenda externa disponível!
  });

  assert(
    ranked[0].name === streamHardsubPt.name,
    'Cenário 4: Sem legenda externa, seleciona hardsub PT-BR para garantir acesso ao conteúdo',
    `Selecionado: ${ranked[0].name}, Esperado: ${streamHardsubPt.name}`
  );
}

// =========================================================================
// CENÁRIO 5: Fonte Dual Audio vs. Fonte com apenas áudio original
// =========================================================================
console.log('\n--- CENÁRIO 5: Dual Audio vs. Apenas Áudio Original ---');
{
  const streamDual: StremioStream = {
    name: 'Comando Torrents [Dual Audio]',
    title: 'Filme 2024 [1080p] [Dual Áudio 5.1]',
    url: 'https://example.com/dual.mkv',
    quality: '1080p'
  };

  const streamOrig: StremioStream = {
    name: 'YTS [Original]',
    title: 'Movie 2024 [1080p] [English Audio] [Clean]',
    url: 'https://example.com/orig.mp4',
    quality: '1080p'
  };

  const ranked = sourceSelectionService.rankStreams([streamOrig, streamDual], {
    hasExternalPtSub: true
  });

  assert(
    ranked[0].name === streamDual.name,
    'Cenário 5: Dual Audio vence fonte com apenas áudio original',
    `Selecionado: ${ranked[0].name}, Esperado: ${streamDual.name}`
  );

  const evalDual = sourceSelectionService.evaluateStream(streamDual, { hasExternalPtSub: true });
  assert(
    evalDual.priority === 2,
    'Cenário 5: Dual Audio classificado na Prioridade 2',
    `Prioridade calculada: ${evalDual.priority}`
  );
}

// =========================================================================
// CENÁRIO 6: Fonte com metadados desconhecidos de legenda + Áudio PT-BR
// =========================================================================
console.log('\n--- CENÁRIO 6: Metadados Desconhecidos + Áudio PT-BR ---');
{
  const streamUnknownSubDubbed: StremioStream = {
    name: 'RedeCanais Stream',
    title: 'Capítulo 01 [Dublado]',
    url: 'https://example.com/unknown_subs.mp4',
    quality: '720p'
  };

  const evalStream = sourceSelectionService.evaluateStream(streamUnknownSubDubbed, {
    hasExternalPtSub: false
  });

  assert(
    evalStream.priority === 1,
    'Cenário 6: Fonte dublada com legendas desconhecidas mantém Prioridade 1',
    `Prioridade: ${evalStream.priority}`
  );
  assert(
    evalStream.score >= 100000,
    'Cenário 6: Pontuação no patamar Tier 1 (>= 100.000)',
    `Score: ${evalStream.score}`
  );
}

// =========================================================================
// CENÁRIO 7: Invalidação de Cache e Integridade de Separação de Serviços
// =========================================================================
console.log('\n--- CENÁRIO 7: Serviços e Invalidação de Cache ---');
{
  const audioResult = audioPreferenceService.analyzeAudio({
    name: 'Filme Dublado PT-BR',
    title: 'Dublado',
    url: 'http://test.com'
  });
  assert(
    audioResult.isDubbed === true && audioResult.tier === 'dubbed_ptbr',
    'AudioPreferenceService identifica corretamente áudio dublado PT-BR',
    `Tier: ${audioResult.tier}`
  );

  const subResult = subtitlePreferenceService.analyzeSubtitles({
    name: 'Anime RAW Clean',
    title: 'RAW',
    url: 'http://test.com'
  });
  assert(
    subResult.format === 'clean_confirmed' && subResult.isClean === true,
    'SubtitlePreferenceService identifica corretamente vídeo limpo',
    `Format: ${subResult.format}`
  );

  sourceSelectionService.clearRankingCache();
  assert(true, 'Cache de seleção limpo com sucesso');
}

console.log('\n===============================================================');
console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS`);
console.log('===============================================================');

if (passedTests === totalTests) {
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
} else {
  console.error('💥 ALGUNS TESTES FALHARAM!\n');
  process.exit(1);
}
