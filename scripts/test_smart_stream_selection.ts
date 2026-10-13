import {
  analyzeStreamSubtitleFormat,
  calculateSmartStreamScore,
  smartRankStreams,
  SubtitleFormat
} from '../src/core/subtitles/streamSubtitleDetector';
import { StremioStream } from '../src/core/stremio/stremioTypes';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${desc}`);
    failed++;
  }
}

console.log('🧪 Iniciando testes de Seleção Inteligente de Fontes sem Legendas Embutidas (ZapiTV)...\n');

// Mock Streams
const streamDubbed: StremioStream = {
  name: 'ZapiTV 1080p',
  title: 'Modaete yo, Adam-kun - E01 [Dublado PT-BR] 1080p',
  url: 'http://cdn.example.com/dubbed.mp4',
  quality: '1080p',
  isDubbed: true
};

const streamCleanRaw: StremioStream = {
  name: 'TokyoInsider 1080p',
  title: 'Modaete yo, Adam-kun - 01 [RAW Clean Unsubbed] 1080p x264',
  url: 'http://cdn.example.com/clean_raw.mp4',
  quality: '1080p'
};

const streamCleanRaw720p: StremioStream = {
  name: 'TokyoInsider 720p',
  title: 'Modaete yo, Adam-kun - 01 [RAW Clean Unsubbed] 720p',
  url: 'http://cdn.example.com/clean_raw_720p.mp4',
  quality: '720p'
};

const streamSoftsub: StremioStream = {
  name: 'SubsPlease 1080p',
  title: '[SubsPlease] Modaete yo, Adam-kun - 01 (1080p) [Multi-Sub MKV] [Softsubs]',
  url: 'http://cdn.example.com/softsub.mkv',
  quality: '1080p'
};

const streamHardsubPtBr: StremioStream = {
  name: 'Anbient 1080p',
  title: '[Anbient] Modaete yo, Adam-kun - Episodio 01 [Hardsub PT-BR] [Legenda Fixa] 1080p.mp4',
  url: 'http://cdn.example.com/hardsub_ptbr.mp4',
  quality: '1080p'
};

const streamHardsubEng: StremioStream = {
  name: 'HorribleSubs 1080p',
  title: '[HorribleSubs] Modaete yo, Adam-kun - 01 [English Hardsub] [Hardcoded Subs] 1080p',
  url: 'http://cdn.example.com/hardsub_eng.mp4',
  quality: '1080p'
};

// =========================================================================
// Testes Unitários de Detecção de Formato
// =========================================================================
console.log('--- Validação da Identificação Automática de Tipos de Legenda ---');
assert(analyzeStreamSubtitleFormat(streamCleanRaw).format === 'clean_confirmed', 'streamCleanRaw classificado como clean_confirmed');
assert(analyzeStreamSubtitleFormat(streamSoftsub).format === 'softsub', 'streamSoftsub classificado como softsub');
assert(analyzeStreamSubtitleFormat(streamHardsubPtBr).format === 'hardsub_ptbr', 'streamHardsubPtBr classificado como hardsub_ptbr');
assert(analyzeStreamSubtitleFormat(streamHardsubEng).format === 'hardsub_foreign', 'streamHardsubEng classificado como hardsub_foreign');
assert(analyzeStreamSubtitleFormat(streamDubbed).isClean === true, 'streamDubbed classificado como vídeo limpo sem hardsubs');

// =========================================================================
// Cenário 1: Anime com Hardsub PT-BR e alternativa limpa com legenda externa
// =========================================================================
console.log('\n--- Cenário 1: Anime com Hardsub PT-BR e alternativa limpa com legenda externa ---');
const ranked1 = smartRankStreams([streamHardsubPtBr, streamCleanRaw], { hasExternalPtSub: true });
assert(ranked1[0].url === streamCleanRaw.url, 'Prioridade 3 vence: versão limpa escolhida sobre hardsub quando há legenda externa');
assert(ranked1[0]._smartPriority === 3, 'Prioridade do topo é 3 (Vídeo limpo + legenda PT-BR externa)');
assert(ranked1[1].url === streamHardsubPtBr.url, 'Hardsub PT-BR fica como opção posterior (Prioridade 5)');

// =========================================================================
// Cenário 2: Anime somente com Hardsub PT-BR (sem alternativa limpa)
// =========================================================================
console.log('\n--- Cenário 2: Anime somente com Hardsub PT-BR ---');
const ranked2 = smartRankStreams([streamHardsubPtBr], { hasExternalPtSub: false });
assert(ranked2[0].url === streamHardsubPtBr.url, 'Hardsub PT-BR selecionado como fallback alternativo com sucesso');
assert(ranked2[0]._smartPriority === 5, 'Prioridade é 5 (Hardsub PT-BR quando não há legenda externa)');

// =========================================================================
// Cenário 3: Anime limpo sem legenda PT-BR disponível vs Hardsub PT-BR
// =========================================================================
console.log('\n--- Cenário 3: Anime limpo sem legenda PT-BR disponível ---');
const ranked3 = smartRankStreams([streamCleanRaw, streamHardsubPtBr], { hasExternalPtSub: false });
assert(ranked3[0].url === streamHardsubPtBr.url, 'Quando não há legenda externa PT-BR, o Hardsub PT-BR prevalece para permitir compreensão');
assert(ranked3[1].url === streamCleanRaw.url, 'Versão limpa sem nenhuma legenda fica como opção secundária');

// =========================================================================
// Cenário 4: Anime com softsub selecionável
// =========================================================================
console.log('\n--- Cenário 4: Anime com softsub selecionável ---');
const ranked4 = smartRankStreams([streamHardsubPtBr, streamSoftsub], { hasExternalPtSub: true });
assert(ranked4[0].url === streamSoftsub.url, 'Softsub selecionável é priorizado sobre hardsub PT-BR');
assert(ranked4[0]._smartPriority === 3, 'Softsub com legenda externa classificado como Prioridade 3');

// =========================================================================
// Cenário 5: Anime com legenda gravada em inglês (Hardsub foreign)
// =========================================================================
console.log('\n--- Cenário 5: Anime com legenda gravada em inglês ---');
const scoreForeign = calculateSmartStreamScore(streamHardsubEng, { hasExternalPtSub: false });
assert(scoreForeign.priority === 6, 'Hardsub em inglês classificado como Prioridade 6');
assert(scoreForeign.score < 0, 'Hardsub em inglês recebe pontuação negativa para nunca ser escolhido');

const ranked5 = smartRankStreams([streamHardsubEng, streamHardsubPtBr], { hasExternalPtSub: false });
assert(ranked5[0].url === streamHardsubPtBr.url, 'Hardsub PT-BR escolhido sobre Hardsub em inglês');
assert(ranked5.length === 1, 'Hardsub estrangeiro com score negativo foi descartado do ranking final');

// =========================================================================
// Cenário 6: Anime dublado PT-BR sem legendas
// =========================================================================
console.log('\n--- Cenário 6: Anime dublado PT-BR sem legendas ---');
const ranked6 = smartRankStreams([streamCleanRaw, streamHardsubPtBr, streamDubbed], { hasExternalPtSub: true });
assert(ranked6[0].url === streamDubbed.url, 'Dublado PT-BR limpo tem Prioridade Máxima 1 absoluta');
assert(ranked6[0]._smartPriority === 1, 'Prioridade do topo é 1 (Dublagem brasileira limpa)');
assert(ranked6[1].url === streamCleanRaw.url, 'Segunda opção é a versão limpa com legenda externa (Prioridade 3)');
assert(ranked6[2].url === streamHardsubPtBr.url, 'Terceira opção é o hardsub PT-BR (Prioridade 5)');

// =========================================================================
// Cenário 7: Episódio com duas fontes limpas de qualidades diferentes (1080p vs 720p)
// =========================================================================
console.log('\n--- Cenário 7: Episódio com duas fontes de qualidades diferentes ---');
const ranked7 = smartRankStreams([streamCleanRaw720p, streamCleanRaw], { hasExternalPtSub: true });
assert(ranked7[0].url === streamCleanRaw.url, 'Versão 1080p limpa escolhida sobre versão 720p limpa');
assert(ranked7[0].quality === '1080p', 'Qualidade 1080p tem pontuação superior');

// =========================================================================
// Cenário 8: Troca automática de fonte durante a reprodução (Fallback ordenado)
// =========================================================================
console.log('\n--- Cenário 8: Troca automática de fonte durante a reprodução ---');
// Simulando uma lista de fontes ordenada inteligentemente
const streamsList = smartRankStreams([streamHardsubPtBr, streamCleanRaw, streamSoftsub], { hasExternalPtSub: true });
// Fonte 0 (limpa) falha por erro de rede -> player avança para índice 1
let currentIndex = 0;
const failedIndex = currentIndex;
const nextCandidateIndex = currentIndex + 1;
assert(streamsList[failedIndex].url === streamCleanRaw.url, 'Fonte inicial primária é a limpa com legenda externa');
assert(streamsList[nextCandidateIndex].url === streamSoftsub.url, 'Próxima fonte de fallback inteligente é o softsub');

// =========================================================================
// Cenário 9: Não sobrepor legendas externas a fontes com Hardsub
// =========================================================================
console.log('\n--- Cenário 9: Prevenção de legendas duplicadas em Hardsub ---');
const hardsubAnalysis = analyzeStreamSubtitleFormat(streamHardsubPtBr);
const shouldAutoEnableExternalSubsOnHardsub = !hardsubAnalysis.isHardsub;
assert(!shouldAutoEnableExternalSubsOnHardsub, 'Legendas externas NÃO devem ser ativadas automaticamente em vídeos com Hardsub');
const cleanAnalysis = analyzeStreamSubtitleFormat(streamCleanRaw);
const shouldAutoEnableExternalSubsOnClean = !cleanAnalysis.isHardsub;
assert(shouldAutoEnableExternalSubsOnClean, 'Legendas externas DEVEM ser ativadas automaticamente em vídeos limpos sem dublagem');

console.log('\n===========================================');
console.log(`📊 Resultado dos testes: ${passed} passaram, ${failed} falharam.`);
console.log('===========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
