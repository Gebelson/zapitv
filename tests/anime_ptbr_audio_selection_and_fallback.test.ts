import assert from 'node:assert';
import { audioPreferenceService } from '../src/core/audio/audioPreferenceService';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';
import { classifyStream } from '../src/core/audio/audioDetector';
import { StremioStream } from '../src/core/stremio/stremioTypes';

console.log('=== TEST SUITE: ZAPITV | RECUPERAÇÃO DA DUBLAGEM PT-BR E ELIMINAÇÃO DE FALSOS POSITIVOS (SWORD ART ONLINE) ===\n');

const saoContextItem = {
  id: 'tt2250192',
  imdbId: 'tt2250192',
  title: 'Sword Art Online',
  type: 'series',
  genres: ['Anime', 'Ação', 'Aventura', 'Fantasia'],
  originalLanguage: 'ja'
};

const saoHardsubPtBrStream: StremioStream = {
  name: 'Torrentio 1080p',
  title: 'Sword Art Online - 01 (1080p) [Hardsub PT-BR]',
  url: 'https://cdn.example.com/sao_s01e01_hardsub.mp4'
};

const saoDubbed1080pStream: StremioStream = {
  name: 'FenixFlix FHD',
  title: 'Sword Art Online S01E01 1080p Dublado PT-BR',
  url: 'https://cdn.example.com/sao_s01e01_dub1080p.mp4'
};

const saoDubbed720pStream: StremioStream = {
  name: 'Torrentio Brazuca 720p',
  title: 'Sword Art Online S01E01 720p Dublado',
  url: 'https://cdn.example.com/sao_s01e01_dub720p.mp4'
};

const saoDualAudioStream: StremioStream = {
  name: 'Torrentio 1080p',
  title: 'Sword Art Online S01E01 [Dual-Audio] [Jap/Por] [BDRip 1080p]',
  url: 'https://cdn.example.com/sao_s01e01_dual.mp4'
};

const saoJapaneseSubbedStream: StremioStream = {
  name: 'Torrentio 1080p',
  title: 'Sword Art Online S01E01 1080p Japanese [Eng Sub]',
  url: 'https://cdn.example.com/sao_s01e01_ja.mp4'
};

// -----------------------------------------------------------------------------
// TESTE 1: Diferenciação Estrita de Dublagem PT-BR vs Hardsub/Softsub
// -----------------------------------------------------------------------------
console.log('[Teste 1] Verificando diferenciação entre Dublagem PT-BR e Hardsub PT-BR...');

// 1.1 Hardsub PT-BR não pode ser dublado
const hardsubAnalysis = audioPreferenceService.analyzeAudio(saoHardsubPtBrStream);
assert.strictEqual(hardsubAnalysis.isDubbed, false, 'Hardsub PT-BR não pode ser marcado como isDubbed: true');
assert.strictEqual(hardsubAnalysis.isPtBr, false, 'Áudio do Hardsub PT-BR não é PT-BR (apenas a legenda gravada é PT-BR)');
assert.strictEqual(hardsubAnalysis.tier, 'original', 'Hardsub PT-BR deve ter tier: original');

const hardsubLang = audioSelectionManager.inspectStreamAudioLanguage(saoHardsubPtBrStream, 'ja');
assert.strictEqual(hardsubLang, 'ja', 'Idioma de áudio do anime com Hardsub deve ser detectado como Japonês (ja)');

const hardsubEval = sourceSelectionService.evaluateStream(saoHardsubPtBrStream, { hasExternalPtSub: false });
assert.strictEqual(hardsubEval.priority, 5, 'Hardsub PT-BR deve ter Prioridade 5, nunca Prioridade 1');
assert.strictEqual(hardsubEval.subtitleFormat, 'hardsub_ptbr', 'Formato de legenda deve ser hardsub_ptbr');
assert.ok(hardsubEval.score < 50000, 'Score de hardsub não pode ultrapassar 50.000 pontos');

const hardsubCls = classifyStream(saoHardsubPtBrStream);
assert.strictEqual(hardsubCls.isDubbed, false);
assert.strictEqual(hardsubCls.badge, '💬', 'Badge de hardsub deve ser legenda (💬)');
assert.strictEqual(hardsubCls.badgeLabel, 'Hardsub PT-BR');
console.log('  -> Hardsub PT-BR isolado corretamente como legenda gravada em áudio Japonês (ja).');

// 1.2 Dublado PT-BR deve ter prioridade 1 absoluta
const dubbedAnalysis = audioPreferenceService.analyzeAudio(saoDubbed1080pStream);
assert.strictEqual(dubbedAnalysis.isDubbed, true, 'Stream com "Dublado PT-BR" deve ser isDubbed: true');
assert.strictEqual(dubbedAnalysis.isPtBr, true, 'Stream com "Dublado PT-BR" deve ser isPtBr: true');
assert.strictEqual(dubbedAnalysis.tier, 'dubbed_ptbr', 'Deve pertencer ao tier dubbed_ptbr');
assert.strictEqual(dubbedAnalysis.language, 'pt-BR');

const dubbedLang = audioSelectionManager.inspectStreamAudioLanguage(saoDubbed1080pStream, 'ja');
assert.strictEqual(dubbedLang, 'pt-BR', 'inspectStreamAudioLanguage deve retornar pt-BR para dublagem brasileira');

const dubbedEval = sourceSelectionService.evaluateStream(saoDubbed1080pStream, { hasExternalPtSub: false });
assert.strictEqual(dubbedEval.priority, 1, 'Dublagem brasileira confirmada deve ter Prioridade 1');
assert.ok(dubbedEval.score >= 100000, 'Dublagem brasileira confirmada deve ter score >= 100.000');

const dubbedCls = classifyStream(saoDubbed1080pStream);
assert.strictEqual(dubbedCls.badge, '🔊', 'Badge de dublado deve ser áudio (🔊)');
assert.strictEqual(dubbedCls.badgeLabel, 'Áudio Dublado PT-BR');
console.log('  -> Dublado PT-BR classificado com Prioridade 1 (100.000+ pontos).');

// 1.3 Dual-Audio
const dualAnalysis = audioPreferenceService.analyzeAudio(saoDualAudioStream);
assert.strictEqual(dualAnalysis.isDualAudio, true);
assert.strictEqual(dualAnalysis.isPtBr, true);
assert.strictEqual(dualAnalysis.tier, 'dual_audio');
const dualEval = sourceSelectionService.evaluateStream(saoDualAudioStream, { hasExternalPtSub: false });
assert.strictEqual(dualEval.priority, 2, 'Dual Audio deve ter Prioridade 2');
assert.ok(dualEval.score >= 90000);
console.log('  -> Dual-Audio classificado com Prioridade 2 (90.000+ pontos).');

// -----------------------------------------------------------------------------
// TESTE 2: Ranqueamento Hierárquico no Catálogo e Player
// -----------------------------------------------------------------------------
console.log('\n[Teste 2] Verificando ranqueamento prioritário das fontes de Sword Art Online...');
const ranked = sourceSelectionService.rankStreams(
  [saoHardsubPtBrStream, saoDubbed1080pStream, saoJapaneseSubbedStream],
  { hasExternalPtSub: false }
);
assert.ok(ranked[0].title?.includes('Dublado'), 'Fonte dublada PT-BR deve vencer release Hardsub');
assert.strictEqual((ranked[0] as any)._smartPriority, 1);
assert.ok((ranked[0] as any)._smartScore > (ranked[1] as any)._smartScore);

const ranked720pVs1080pHardsub = sourceSelectionService.rankStreams(
  [saoHardsubPtBrStream, saoDubbed720pStream],
  { hasExternalPtSub: false }
);
assert.ok(ranked720pVs1080pHardsub[0].title?.includes('720p Dublado'), 'Dublagem 720p deve vencer Hardsub 1080p');
assert.strictEqual((ranked720pVs1080pHardsub[0] as any)._smartPriority, 1);
assert.strictEqual((ranked720pVs1080pHardsub[1] as any)._smartPriority, 5);
console.log('  -> Ranqueamento prioriza rigorosamente fontes dubladas acima de releases legendados.');

// -----------------------------------------------------------------------------
// TESTE 3: Preservação de Múltiplas Fontes Alternativas por Idioma
// -----------------------------------------------------------------------------
console.log('\n[Teste 3] Verificando agrupamento de múltiplos candidatos em buildAudioOptions...');
const candidateStreams = [
  saoDubbed1080pStream,  // idx 0 (PT-BR)
  saoDubbed720pStream,   // idx 1 (PT-BR)
  saoHardsubPtBrStream   // idx 2 (Japonês com legenda)
];

const options = audioSelectionManager.buildAudioOptions({
  item: saoContextItem,
  streams: candidateStreams,
  hlsTracks: [],
  currentStreamIndex: 0,
  activeAudioId: null
});

assert.strictEqual(options.length, 2, 'Devem existir 2 opções de idioma (PT-BR e Japonês)');
const ptOption = options.find(o => o.langCode === 'pt-BR');
assert.ok(ptOption, 'Opção PT-BR deve estar presente');
assert.strictEqual(ptOption?.label, 'Português (Brasil)');
assert.strictEqual(ptOption?.badge, 'Dublado');
assert.strictEqual(ptOption?.streamIndex, 0);
assert.deepStrictEqual(ptOption?.candidateStreamIndices, [0, 1], 'Todas as fontes alternativas PT-BR devem ser preservadas');

const jaOption = options.find(o => o.langCode === 'ja');
assert.ok(jaOption, 'Opção Japonês deve estar presente');
assert.strictEqual(jaOption?.label, 'Japonês');
assert.strictEqual(jaOption?.badge, 'Original');
assert.deepStrictEqual(jaOption?.candidateStreamIndices, [2]);
console.log('  -> Múltiplos candidatos PT-BR preservados no pool sem descarte.');

// -----------------------------------------------------------------------------
// TESTE 4: Eliminação Total do Falso Positivo Visual na Smart TV
// -----------------------------------------------------------------------------
console.log('\n[Teste 4] Verificando ausência de falsos positivos no check visual (isCurrent)...');
// Cenário 4.1: O vídeo está tocando a fonte Japonesa (idx 2)
const optionsWhenJapanesePlaying = audioSelectionManager.buildAudioOptions({
  item: saoContextItem,
  streams: candidateStreams,
  hlsTracks: [],
  currentStreamIndex: 2, // Japonês tocando!
  activeAudioId: 'stream-pt-br' // Antigo activeAudioId dessincronizado
});

const ptWhenJa = optionsWhenJapanesePlaying.find(o => o.langCode === 'pt-BR');
const jaWhenJa = optionsWhenJapanesePlaying.find(o => o.langCode === 'ja');
assert.strictEqual(ptWhenJa?.isCurrent, false, 'Português (Brasil) NUNCA pode ter isCurrent: true se o áudio tocando for Japonês!');
assert.strictEqual(jaWhenJa?.isCurrent, true, 'Japonês deve ter isCurrent: true pois é a fonte efetivamente em reprodução!');
console.log('  -> Falso positivo eliminado: Japonês tocando marca exclusivamente Japonês no menu.');

// Cenário 4.2: O vídeo está tocando a fonte PT-BR (idx 0)
const optionsWhenPtPlaying = audioSelectionManager.buildAudioOptions({
  item: saoContextItem,
  streams: candidateStreams,
  hlsTracks: [],
  currentStreamIndex: 0, // PT-BR tocando!
  activeAudioId: 'stream-pt-br'
});
const ptWhenPt = optionsWhenPtPlaying.find(o => o.langCode === 'pt-BR');
const jaWhenPt = optionsWhenPtPlaying.find(o => o.langCode === 'ja');
assert.strictEqual(ptWhenPt?.isCurrent, true, 'Português (Brasil) deve ser isCurrent: true');
assert.strictEqual(jaWhenPt?.isCurrent, false, 'Japonês deve ser isCurrent: false');
console.log('  -> Português (Brasil) tocando marca corretamente Português (Brasil).');

// -----------------------------------------------------------------------------
// TESTE 5: Outros Animes Populares (Solo Leveling, Frieren, Kimetsu)
// -----------------------------------------------------------------------------
console.log('\n[Teste 5] Verificando outros animes populares...');
const soloLevelingDub: StremioStream = {
  name: 'FenixFlix FHD',
  title: 'Solo Leveling S01E01 1080p Dublado PT-BR',
  url: 'https://cdn.example.com/solo1.mp4'
};
const frierenSub: StremioStream = {
  name: 'Torrentio 1080p',
  title: 'Sousou no Frieren S01E01 [Hardsub PT-BR]',
  url: 'https://cdn.example.com/frieren1.mp4'
};
const kimetsuDual: StremioStream = {
  name: 'Torrentio 1080p',
  title: 'Kimetsu no Yaiba S01E01 1080p Dual-Audio Dublado',
  url: 'https://cdn.example.com/kimetsu1.mp4'
};

assert.strictEqual(audioPreferenceService.analyzeAudio(soloLevelingDub).tier, 'dubbed_ptbr');
assert.strictEqual(audioSelectionManager.inspectStreamAudioLanguage(soloLevelingDub, 'ja'), 'pt-BR');

assert.strictEqual(audioPreferenceService.analyzeAudio(frierenSub).tier, 'original');
assert.strictEqual(audioSelectionManager.inspectStreamAudioLanguage(frierenSub, 'ja'), 'ja');

assert.strictEqual(audioPreferenceService.analyzeAudio(kimetsuDual).tier, 'dual_audio');
assert.strictEqual(audioSelectionManager.inspectStreamAudioLanguage(kimetsuDual, 'ja'), 'pt-BR');
console.log('  -> Solo Leveling, Frieren e Kimetsu classificados com 100% de precisão.');

console.log('\n=== TODOS OS TESTES DE DUBLAGEM E SELEÇÃO DE ÁUDIO PASSARAM COM SUCESSO! ===');
process.exit(0);
