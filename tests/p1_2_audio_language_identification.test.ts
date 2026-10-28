import assert from 'node:assert/strict';
import { audioPreferenceService } from '../src/core/audio/audioPreferenceService';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { classifyStream } from '../src/core/audio/audioDetector';
import { StremioStream } from '../src/core/stremio/stremioTypes';

console.log('=== ZapiTV | P1.2 — Validação de Identificação de Dublagem e Idiomas ===\n');

// =========================================================================
// CASO 1: Jimihen!! (Anime japonês legendado em provedor brasileiro)
// =========================================================================
console.log('1. Testando Jimihen!! (Sem herança indevida de provedor brasileiro)...');
const jimihenSubStream: StremioStream = {
  name: 'FenixFlix (HLS Proxy)',
  title: 'Jimihen!! Episódio 1 [Legendado]',
  url: 'https://cdn.example.com/jimihen-ep1.m3u8',
  providerId: 'fenixflix-animes'
};

const jimihenAnalysis = audioPreferenceService.analyzeAudio(jimihenSubStream);
assert.equal(jimihenAnalysis.isPtBr, false, 'Jimihen legendado NÃO pode ter isPtBr: true');
assert.equal(jimihenAnalysis.isDubbed, false, 'Jimihen legendado NÃO pode ter isDubbed: true');
assert.equal(jimihenAnalysis.tier, 'original', 'Jimihen legendado deve ter tier: original');
assert.equal(jimihenAnalysis.isDualAudio, false, 'Jimihen legendado NÃO é dual audio');

const jimihenCls = classifyStream(jimihenSubStream);
assert.equal(jimihenCls.isPtBr, false, 'Classificação de Jimihen não deve ter isPtBr: true');
assert.equal(jimihenCls.isDubbed, false, 'Classificação de Jimihen não deve ter isDubbed: true');
assert.equal(jimihenCls.badge, '💬', 'Badge de Jimihen deve ser legenda (💬)');
assert.match(jimihenCls.badgeLabel, /Legenda/i, 'BadgeLabel deve indicar Legenda e nunca Dublado');

const jimihenLang = audioSelectionManager.inspectStreamAudioLanguage(jimihenSubStream, 'ja');
assert.equal(jimihenLang, 'ja', 'inspectStreamAudioLanguage deve retornar ja para Jimihen legendado');

const jimihenOptions = audioSelectionManager.buildAudioOptions({
  item: { title: 'Jimihen!!: Omote to Ura', type: 'anime', originalLanguage: 'ja' },
  streams: [jimihenSubStream],
  hlsTracks: [],
  currentStreamIndex: 0,
  activeAudioId: null
});
assert.equal(jimihenOptions.length, 1, 'Deve haver 1 opção de áudio');
assert.equal(jimihenOptions[0].langCode, 'ja', 'Idioma da opção deve ser Japonês (ja)');
assert.equal(jimihenOptions[0].badge, 'Original', 'Selo deve ser Original, NUNCA Dublado');
assert.equal(jimihenOptions[0].isCurrent, true, 'Faixa japonesa deve estar ativa');
assert.ok(!jimihenOptions.some(o => o.langCode === 'pt-BR'), 'NÃO deve inventar opção de Dublado PT-BR');
console.log('✓ Jimihen!!: classificação estrita de legenda, sem dublagem falsa');

// =========================================================================
// CASO 2: Hope: O Primeiro Impacto (Filme legendado)
// =========================================================================
console.log('\n2. Testando Hope: O Primeiro Impacto (Legendado de provedor brasileiro)...');
const hopeSubStream: StremioStream = {
  name: 'FrostStream (Proxy)',
  title: 'Hope: O Primeiro Impacto (2020) 1080p Legendado',
  url: 'https://cdn.example.com/hope-1080p.mp4',
  providerId: 'froststream-http'
};

const hopeAnalysis = audioPreferenceService.analyzeAudio(hopeSubStream);
assert.equal(hopeAnalysis.isPtBr, false, 'Hope legendado NÃO pode ser isPtBr: true');
assert.equal(hopeAnalysis.isDubbed, false, 'Hope legendado NÃO pode ser isDubbed: true');
assert.equal(hopeAnalysis.tier, 'original', 'Hope legendado deve ter tier: original');

const hopeCls = classifyStream(hopeSubStream);
assert.equal(hopeCls.badge, '💬', 'Badge de Hope deve ser legenda (💬)');
assert.ok(!hopeCls.badgeLabel.toLowerCase().includes('dublado'), 'BadgeLabel não pode conter "Dublado"');
console.log('✓ Hope: O Primeiro Impacto classificado corretamente como legendado');

// =========================================================================
// CASO 3: Chicago Typewriter (Dorama Coreano)
// =========================================================================
console.log('\n3. Testando Chicago Typewriter (Dorama coreano com legenda PT-BR)...');
const chicagoSubStream: StremioStream = {
  name: 'FenixFlix',
  title: 'Chicago Typewriter E01 [Legendado PT-BR]',
  url: 'https://cdn.example.com/chicago-ep1.mp4',
  providerId: 'fenixflix-series'
};

const chicagoAnalysis = audioPreferenceService.analyzeAudio(chicagoSubStream);
assert.equal(chicagoAnalysis.isPtBr, false, 'Chicago Typewriter NÃO é áudio PT-BR');
assert.equal(chicagoAnalysis.isDubbed, false, 'Chicago Typewriter NÃO é dublado');

const chicagoItem = {
  title: 'Chicago Typewriter',
  type: 'series',
  genres: ['Dorama', 'K-Drama', 'Drama'],
  description: 'Série de TV coreana sobre escritores'
};

const detectedOriginal = audioSelectionManager.detectOriginalLanguage(chicagoItem);
assert.equal(detectedOriginal, 'ko', 'Dorama deve ter idioma original detectado como ko');

const chicagoLang = audioSelectionManager.inspectStreamAudioLanguage(chicagoSubStream, 'ko');
assert.equal(chicagoLang, 'ko', 'Áudio de Chicago Typewriter deve ser inspecionado como coreano (ko)');

const chicagoOptions = audioSelectionManager.buildAudioOptions({
  item: chicagoItem,
  streams: [chicagoSubStream],
  hlsTracks: [],
  currentStreamIndex: 0,
  activeAudioId: null
});
assert.equal(chicagoOptions[0].langCode, 'ko', 'Opção de áudio deve ser Coreano (ko)');
assert.equal(chicagoOptions[0].label, 'Coreano', 'Rótulo deve ser Coreano');
assert.equal(chicagoOptions[0].flag, '🇰🇷', 'Bandeira deve ser da Coreia do Sul (🇰🇷)');
assert.equal(chicagoOptions[0].badge, 'Original', 'Selo deve ser Original');
assert.equal(chicagoOptions[0].isCurrent, true, 'Opção coreana deve estar ativa');
console.log('✓ Chicago Typewriter: reconhecido como coreano (ko) sem falsa dublagem');

// =========================================================================
// CASO 4: Sword Art Online (Fontes mistas avaliadas individualmente)
// =========================================================================
console.log('\n4. Testando Sword Art Online (Fontes mistas: Dublado, Hardsub, Dual, RAW)...');
const saoDubbed: StremioStream = {
  name: 'FenixFlix',
  title: 'Sword Art Online S01E01 1080p Dublado PT-BR',
  url: 'https://cdn.example.com/sao-dub.mp4'
};
const saoHardsub: StremioStream = {
  name: 'FenixFlix',
  title: 'Sword Art Online S01E01 1080p Hardsub PT-BR',
  url: 'https://cdn.example.com/sao-hardsub.mp4'
};
const saoDualPt: StremioStream = {
  name: 'Torrentio',
  title: 'Sword Art Online S01E01 1080p Dual Audio [Jap/Por]',
  url: 'https://cdn.example.com/sao-dual.mp4'
};
const saoRaw: StremioStream = {
  name: 'Nyaa',
  title: 'Sword Art Online S01E01 RAW 1080p',
  url: 'https://cdn.example.com/sao-raw.mp4'
};

const dubAnalysis = audioPreferenceService.analyzeAudio(saoDubbed);
assert.equal(dubAnalysis.isPtBr, true, 'Dublado deve ser isPtBr: true');
assert.equal(dubAnalysis.isDubbed, true, 'Dublado deve ser isDubbed: true');
assert.equal(dubAnalysis.tier, 'dubbed_ptbr', 'Dublado deve ter tier dubbed_ptbr');

const hardsubAnalysis = audioPreferenceService.analyzeAudio(saoHardsub);
assert.equal(hardsubAnalysis.isPtBr, false, 'Hardsub NÃO deve ser isPtBr: true');
assert.equal(hardsubAnalysis.isDubbed, false, 'Hardsub NÃO deve ser isDubbed: true');
assert.equal(hardsubAnalysis.tier, 'original', 'Hardsub deve ter tier original');

const dualPtAnalysis = audioPreferenceService.analyzeAudio(saoDualPt);
assert.equal(dualPtAnalysis.isPtBr, true, 'Dual com português deve ser isPtBr: true');
assert.equal(dualPtAnalysis.isDubbed, true, 'Dual com português deve ser isDubbed: true');
assert.equal(dualPtAnalysis.tier, 'dual_audio', 'Dual com português deve ter tier dual_audio');

const rawAnalysis = audioPreferenceService.analyzeAudio(saoRaw);
assert.equal(rawAnalysis.isPtBr, false, 'RAW não pode ser isPtBr: true');
assert.equal(rawAnalysis.isDubbed, false, 'RAW não pode ser isDubbed: true');

// Avaliação de ranqueamento: Dublado PT-BR (Prioridade 1) > Dual Audio (Prioridade 2) > Hardsub (Prioridade 5)
const rankedSao = sourceSelectionService.rankStreams([saoRaw, saoHardsub, saoDualPt, saoDubbed], { hasExternalPtSub: false });
assert.equal(rankedSao[0].title, saoDubbed.title, 'Dublado PT-BR deve vencer como 1º colocado');
assert.equal(rankedSao[1].title, saoDualPt.title, 'Dual Audio PT-BR deve ficar em 2º lugar');
assert.equal(rankedSao[2].title, saoHardsub.title, 'Hardsub deve ficar em 3º lugar');
console.log('✓ Sword Art Online: avaliação individual perfeita e hierarquia Prioridade 1 respeitada');

// =========================================================================
// CASO 5: Bleach: Thousand-Year Blood War (Preservação de identidade)
// =========================================================================
console.log('\n5. Testando Bleach: Thousand-Year Blood War (Sem dublagem sem evidência)...');
const bleachLegendado: StremioStream = {
  name: 'FenixFlix Animes',
  title: 'Bleach: Thousand-Year Blood War S01E01 [Legendado]',
  url: 'https://cdn.example.com/bleach-ep1.mp4'
};
const bleachDublado: StremioStream = {
  name: 'FenixFlix Animes',
  title: 'Bleach: Thousand-Year Blood War S01E01 [Dublado PT-BR]',
  url: 'https://cdn.example.com/bleach-ep1-dub.mp4'
};

const bleachLegAnalysis = audioPreferenceService.analyzeAudio(bleachLegendado);
assert.equal(bleachLegAnalysis.isPtBr, false, 'Bleach Legendado não tem áudio PT-BR');
assert.equal(bleachLegAnalysis.isDubbed, false, 'Bleach Legendado não é dublado');

const bleachDubAnalysis = audioPreferenceService.analyzeAudio(bleachDublado);
assert.equal(bleachDubAnalysis.isPtBr, true, 'Bleach Dublado tem áudio PT-BR');
assert.equal(bleachDubAnalysis.isDubbed, true, 'Bleach Dublado é dublado');
console.log('✓ Bleach: Thousand-Year Blood War: diferenciação correta entre fontes');

// =========================================================================
// CASO 6: Conteúdo Nacional e Dublado Genuíno (Prioridade 1 preservada)
// =========================================================================
console.log('\n6. Testando produções nacionais e filmes dublados genuínos...');
const tropaDeElite: StremioStream = {
  name: 'Nacional',
  title: 'Tropa de Elite (2007) 1080p Nacional',
  url: 'https://cdn.example.com/tropa.mp4'
};
const forrestGumpDub: StremioStream = {
  name: 'FrostStream',
  title: 'Forrest Gump (1994) [1080p] [Dublado PT-BR]',
  url: 'https://cdn.example.com/forrest.mp4'
};

const tropaEval = sourceSelectionService.evaluateStream(tropaDeElite, { hasExternalPtSub: false });
assert.equal(tropaEval.priority, 1, 'Produção nacional deve ter Prioridade 1');
assert.ok(tropaEval.score >= 100000, 'Score nacional deve ser >= 100.000');

const forrestEval = sourceSelectionService.evaluateStream(forrestGumpDub, { hasExternalPtSub: false });
assert.equal(forrestEval.priority, 1, 'Dublado PT-BR deve ter Prioridade 1');
assert.ok(forrestEval.score >= 100000, 'Score dublado deve ser >= 100.000');
console.log('✓ Conteúdos nacionais e dublagens legítimas mantêm Prioridade 1 com score máximo');

// =========================================================================
// CASO 7: Dual Audio Estrangeiro (Dual ENG/JAP ou Dual Latino)
// =========================================================================
console.log('\n7. Testando Dual Audio sem faixa em português...');
const dualEngJap: StremioStream = {
  name: 'Torrentio',
  title: 'Anime Movie 1080p [Dual Audio] [Eng/Jap]',
  url: 'https://cdn.example.com/anime-dual.mkv'
};
const dualLatino: StremioStream = {
  name: 'LatinoAddon',
  title: 'Pelicula 1080p Dual Latino',
  url: 'https://cdn.example.com/latino.mp4'
};
const dualGeneric: StremioStream = {
  name: 'UnknownTracker',
  title: 'Series S01E01 720p Dual Audio',
  url: 'https://cdn.example.com/dual.mp4'
};

const dualEngJapAnalysis = audioPreferenceService.analyzeAudio(dualEngJap);
assert.equal(dualEngJapAnalysis.isPtBr, false, 'Dual ENG/JAP NÃO pode ser isPtBr: true');
assert.equal(dualEngJapAnalysis.isDubbed, false, 'Dual ENG/JAP NÃO pode ser isDubbed: true');
assert.equal(dualEngJapAnalysis.tier, 'foreign', 'Dual ENG/JAP deve ter tier foreign');

const dualLatinoAnalysis = audioPreferenceService.analyzeAudio(dualLatino);
assert.equal(dualLatinoAnalysis.isPtBr, false, 'Dual Latino NÃO é PT-BR');
assert.equal(dualLatinoAnalysis.isDubbed, false, 'Dual Latino NÃO é dublagem brasileira');
assert.equal(dualLatinoAnalysis.language, 'es', 'Dual Latino deve ter language: es');

const dualGenericAnalysis = audioPreferenceService.analyzeAudio(dualGeneric);
assert.equal(dualGenericAnalysis.isPtBr, false, 'Dual Audio genérico sem comprovação NÃO é PT-BR');
assert.equal(dualGenericAnalysis.isDubbed, false, 'Dual Audio genérico sem comprovação NÃO é dublado PT-BR');
console.log('✓ Dual Audio sem comprovada faixa em português não herda falso PT-BR');

// =========================================================================
// CASO 8: Português de Portugal (pt-PT)
// =========================================================================
console.log('\n8. Testando Português de Portugal (pt-PT)...');
const ptPtStream: StremioStream = {
  name: 'LusoProvider',
  title: 'O Filme 1080p Dublado (PT-PT)',
  url: 'https://cdn.example.com/filme-pt.mp4'
};

const ptPtAnalysis = audioPreferenceService.analyzeAudio(ptPtStream);
assert.equal(ptPtAnalysis.isPtBr, false, 'pt-PT NUNCA pode ser isPtBr: true');
assert.equal(ptPtAnalysis.isDubbed, false, 'pt-PT NUNCA pode ser isDubbed: true');
assert.equal(ptPtAnalysis.language, 'pt-PT', 'Idioma deve ser estritamente pt-PT');
console.log('✓ pt-PT blindado: nunca tratado como dublagem brasileira');

// =========================================================================
// CASO 9: Preposição "por" em português (Sem falso positivo)
// =========================================================================
console.log('\n9. Testando ausência de falso positivo com a preposição "por"...');
const porPrepositionStream: StremioStream = {
  name: 'Uploader',
  title: 'Anime S01E01 [Legendado] - Ripado por Equipe Fansub',
  url: 'https://cdn.example.com/fansub.mp4'
};
const porUploadStream: StremioStream = {
  name: 'Tracker',
  title: 'Movie 2024 1080p - Upload por Fulano',
  url: 'https://cdn.example.com/movie.mp4'
};

const porAnalysis1 = audioPreferenceService.analyzeAudio(porPrepositionStream);
assert.equal(porAnalysis1.isPtBr, false, '"por Equipe Fansub" não deve ativar isPtBr');
assert.equal(porAnalysis1.isDubbed, false, '"por Equipe Fansub" não deve ativar isDubbed');

const porAnalysis2 = audioPreferenceService.analyzeAudio(porUploadStream);
assert.equal(porAnalysis2.isPtBr, false, '"Upload por Fulano" não deve ativar isPtBr');
assert.equal(porAnalysis2.isDubbed, false, '"Upload por Fulano" não deve ativar isDubbed');
console.log('✓ Preposição "por" não gera falsos positivos em metadados');

// =========================================================================
// CASO 10: Invalidação de Cache e Reavaliação
// =========================================================================
console.log('\n10. Testando invalidação e isolamento do cache de seleção...');
sourceSelectionService.clearRankingCache();
const rankedAgain = sourceSelectionService.rankStreams([jimihenSubStream], { hasExternalPtSub: false });
assert.equal(rankedAgain[0].url, jimihenSubStream.url);
sourceSelectionService.clearRankingCache();
console.log('✓ Invalidação de cache funciona e reavalia fontes confiavelmente');

console.log('\n========================================================================');
console.log('🎉 TODOS OS TESTES DE IDENTIFICAÇÃO DE DUBLAGEM E IDIOMAS PASSARAM!');
console.log('========================================================================\n');

process.exit(0);
