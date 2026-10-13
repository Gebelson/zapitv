/**
 * ZapiTV — Test Suite de Integridade de Conteúdo e Quarentena de Streams
 * 
 * Valida a prevenção definitiva contra:
 * 1. Trotes adultos / pornografia acidental (Hope: O Primeiro Impacto)
 * 2. Colisões de título em scrapers (Doraemon x Sparks of Tomorrow)
 * 3. Substituições de live-action por animações 3D (Resident Evil)
 * 4. Proteção conservadora para títulos infantis
 * 5. Blind dubbing priority guard (Dublagem nunca sobrepõe a identidade da obra)
 * 6. Fallback seguro quando não há fontes verificadas
 */

import { ContentType, ContentItem } from '../types';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { streamQuarantineService, KNOWN_MALICIOUS_HASHES } from '../src/core/security/streamQuarantineService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FALHA: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ SUCESSO: ${msg}`);
}

async function runIntegrityTests() {
  console.log('===============================================================');
  console.log('🧪 INICIANDO TESTES DE INTEGRIDADE DE CONTEÚDO E QUARENTENA');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TESTE 1: HOPE (2026) — INCIDENTE MIA KHALIFA / TROTE ADULTO
  // --------------------------------------------------------------------------
  console.log('--- TESTE 1: HOPE (2026) E PREVENÇÃO DE TROTE ADULTO ---');
  const hopeItem: ContentItem = {
    id: 'movie_hope_2026',
    title: 'Hope: O Primeiro Impacto',
    originalTitle: 'Hope',
    type: ContentType.MOVIE,
    year: 2026,
    genres: ['Ficção Científica', 'Suspense'],
    rating: 0,
    duration: 120,
    poster: '',
    backdrop: '',
    overview: 'Filme sci-fi coreano de 2026 em cartaz nos cinemas.'
  };

  const hopeIdentity = canonicalIdentityService.buildIdentity(hopeItem);
  assert(hopeIdentity.isTheatricalUnreleased === true, 'Hope 2026 detectado como obra em cartaz/não lançada');

  // Testar hash malicioso conhecido da Mia Khalifa
  const maliciousStream1: StremioStream = {
    name: 'Torrent Tracker [1080p]',
    title: 'Hope (2026) 1080p TS Dublado',
    infoHash: '812efbe7d0a75fb31bf9426db566f299d10b3474',
    behaviorHints: { isFree: true }
  };

  const evalMalicious1 = sourceConfidenceEngine.evaluate(maliciousStream1, hopeIdentity);
  assert(evalMalicious1.confidence === 'QUARANTINED', 'Hash malicioso do caso Hope classificado como QUARANTINED');
  assert(evalMalicious1.isMatch === false, 'Stream malicioso não é considerado match');

  // Testar suposto WEB-DL de filme que está em cartaz
  const fakeWebDlStream: StremioStream = {
    name: 'Torrent Tracker [1080p]',
    title: 'Hope.2026.1080p.AMZN.WEB-DL.DDP5.1.H.264',
    infoHash: '11223344556677889900aabbccddeeff00112233',
    behaviorHints: { isFree: true }
  };

  const evalFakeWebDl = sourceConfidenceEngine.evaluate(fakeWebDlStream, hopeIdentity);
  assert(evalFakeWebDl.confidence === 'QUARANTINED', 'Falso WEB-DL de filme em cartaz colocado em QUARANTINED');

  // Testar se rankStreams elimina todos esses streams
  const rankedHopeStreams = sourceSelectionService.rankStreams([maliciousStream1, fakeWebDlStream], {
    hasExternalPtSub: true,
    identity: hopeIdentity
  });
  assert(rankedHopeStreams.length === 0, 'Nenhum stream fraudulento sobreviveu ao rankStreams para Hope (2026)');

  // --------------------------------------------------------------------------
  // TESTE 2: DORAEMON — COLISÃO COM SPARKS OF TOMORROW
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 2: DORAEMON E COLISÃO COM SPARKS OF TOMORROW ---');
  const doraemonItem: ContentItem = {
    id: 'anime_doraemon',
    title: 'Doraemon: O Gato do Futuro',
    originalTitle: 'Doraemon',
    type: ContentType.ANIME,
    year: 2005,
    genres: ['Animação', 'Infantil', 'Comédia'],
    rating: 8.5,
    duration: 24,
    poster: '',
    backdrop: '',
    overview: 'As aventuras do gato robô do futuro.'
  };

  const doraemonIdentity = canonicalIdentityService.buildIdentity(doraemonItem);
  assert(doraemonIdentity.isChildFriendly === true, 'Doraemon identificado como conteúdo infantil (ChildFriendly)');

  // Stream falso colidido pelo scraper (Sparks of Tomorrow alegando dublagem)
  const sparksCollisionStream: StremioStream = {
    name: 'FenixFlix [DUBLADO]',
    title: 'Sparks of Tomorrow - Episódio 01 [Dublado PT-BR]',
    url: 'https://kurage.live/video/1684/ep1.mp4',
    behaviorHints: { isFree: true }
  };

  const evalSparks = sourceConfidenceEngine.evaluate(sparksCollisionStream, doraemonIdentity);
  assert(evalSparks.confidence === 'REJECTED' || evalSparks.confidence === 'QUARANTINED', 'Sparks of Tomorrow rejeitado para Doraemon');
  assert(evalSparks.isMatch === false, 'Sparks of Tomorrow não dá match com Doraemon');

  // Stream legítimo do acervo ZapiTV
  const legitDoraemonStream: StremioStream = {
    name: 'Acervo ZapiTV [DUBLADO]',
    title: 'Doraemon: O Gato do Futuro - Episódio 01 [Dublado PT-BR]',
    url: 'https://archive.org/download/doraemon_ptbr/ep01.mp4',
    providerId: 'zapitv-verified',
    providerName: 'Acervo ZapiTV',
    behaviorHints: { isFree: true }
  };

  const evalLegit = sourceConfidenceEngine.evaluate(legitDoraemonStream, doraemonIdentity);
  assert(evalLegit.confidence === 'VERIFIED', 'Stream oficial do acervo para Doraemon classificado como VERIFIED');
  assert(evalLegit.isMatch === true, 'Stream oficial é aceito');

  // Testar ranking conjunto: o stream legítimo deve vencer e o colidido deve ser descartado
  const rankedDoraemonStreams = sourceSelectionService.rankStreams([sparksCollisionStream, legitDoraemonStream], {
    hasExternalPtSub: true,
    identity: doraemonIdentity
  });
  assert(rankedDoraemonStreams.length === 1, 'Apenas 1 stream passou no filtro do Doraemon');
  assert(rankedDoraemonStreams[0].url === legitDoraemonStream.url, 'Stream selecionado é o legítimo do Doraemon');

  // --------------------------------------------------------------------------
  // TESTE 3: RESIDENT EVIL LIVE-ACTION vs ANIMAÇÃO 3D (VENDETTA)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 3: RESIDENT EVIL LIVE-ACTION vs ANIMAÇÃO 3D (VENDETTA) ---');
  const reMovieItem: ContentItem = {
    id: 'movie_resident_evil',
    title: 'Resident Evil: O Hóspede Maldito',
    originalTitle: 'Resident Evil',
    type: ContentType.MOVIE,
    year: 2002,
    genres: ['Ação', 'Terror', 'Ficção Científica'],
    rating: 7.0,
    duration: 100,
    poster: '',
    backdrop: '',
    overview: 'Alice acorda sem memória em uma mansão secreta.'
  };

  const reIdentity = canonicalIdentityService.buildIdentity(reMovieItem);

  // Stream de animação 3D com dublagem em PT-BR
  const cgiAnimStream: StremioStream = {
    name: 'Torrent Tracker [DUBLADO]',
    title: 'Resident Evil: Vendetta (2017) 1080p BluRay Dublado',
    infoHash: 'aabbccddeeff00112233445566778899aabbccdd',
    behaviorHints: { isFree: true }
  };

  const evalCgi = sourceConfidenceEngine.evaluate(cgiAnimStream, reIdentity);
  assert(evalCgi.confidence === 'REJECTED', 'Animação 3D "Vendetta" rejeitada para filme live-action');

  // Stream legítimo do filme live-action
  const legitReStream: StremioStream = {
    name: 'Torrent Tracker [DUBLADO]',
    title: 'Resident Evil (2002) 1080p BluRay Dual Audio 5.1',
    infoHash: 'ccddeeff00112233445566778899aabbccddeeff',
    behaviorHints: { isFree: true }
  };

  const evalLegitRe = sourceConfidenceEngine.evaluate(legitReStream, reIdentity);
  assert(evalLegitRe.confidence === 'PROVISIONAL' || evalLegitRe.confidence === 'VERIFIED', 'Filme live-action correto aprovado');

  const rankedReStreams = sourceSelectionService.rankStreams([cgiAnimStream, legitReStream], {
    hasExternalPtSub: true,
    identity: reIdentity
  });
  assert(rankedReStreams.length === 1, 'Apenas o live-action correto passou no ranking');
  assert(rankedReStreams[0].infoHash === legitReStream.infoHash, 'Stream selecionado é o live-action de 2002');

  // --------------------------------------------------------------------------
  // TESTE 4: BLIND DUBBING PRIORITY GUARD
  // (Dublagem não pode usurpar identidade de obra diferente)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 4: DUBBING PRIORITY GUARD ---');
  const matrixItem: ContentItem = {
    id: 'movie_matrix',
    title: 'Matrix',
    originalTitle: 'The Matrix',
    type: ContentType.MOVIE,
    year: 1999,
    genres: ['Ação', 'Ficção Científica'],
    rating: 8.7,
    duration: 136,
    poster: '',
    backdrop: '',
    overview: 'Neo descobre a verdade sobre a simulação da Matrix.'
  };

  const matrixIdentity = canonicalIdentityService.buildIdentity(matrixItem);

  // Stream com dublagem PT-BR excelente, mas de um filme totalmente não relacionado (ex: Shrek)
  const unrelatedDubbedStream: StremioStream = {
    name: 'Dublados BR [DUBLADO]',
    title: 'Shrek (2001) 1080p Dublado PT-BR',
    infoHash: '1234567890abcdef1234567890abcdef12345678',
    behaviorHints: { isFree: true }
  };

  // Stream original do Matrix em inglês com legendas
  const matrixOriginalStream: StremioStream = {
    name: 'YTS [1080p]',
    title: 'The Matrix (1999) 1080p BluRay x264',
    url: 'https://cdn.example.com/matrix_1080p.mp4',
    behaviorHints: { isFree: true }
  };

  const rankedMatrixStreams = sourceSelectionService.rankStreams([unrelatedDubbedStream, matrixOriginalStream], {
    hasExternalPtSub: true,
    identity: matrixIdentity
  });

  assert(rankedMatrixStreams.length === 1, 'Shrek foi descartado e não usurpou Matrix mesmo sendo dublado');
  assert(rankedMatrixStreams[0].title?.includes('The Matrix') === true, 'Stream selecionado é The Matrix');

  // --------------------------------------------------------------------------
  // TESTE 5: PROTEÇÃO INFANTIL (KIDS SAFEGUARD)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 5: PROTEÇÃO DE CONTEÚDO INFANTIL ---');
  const peppaItem: ContentItem = {
    id: 'kids_peppa',
    title: 'Peppa Pig',
    type: ContentType.SERIES,
    year: 2004,
    genres: ['Infantil', 'Kids'],
    rating: 7.0,
    duration: 10,
    poster: '',
    backdrop: '',
    overview: 'Desenho infantil da porquinha Peppa.'
  };
  const peppaIdentity = canonicalIdentityService.buildIdentity(peppaItem);

  const suspiciousKidsStream: StremioStream = {
    name: 'Desconhecido',
    title: 'Random Stream sem metadados',
    url: 'http://random.stream.xyz/video.m3u8',
    behaviorHints: { isFree: true }
  };

  const evalKidsSuspicious = sourceConfidenceEngine.evaluate(suspiciousKidsStream, peppaIdentity);
  assert(evalKidsSuspicious.confidence === 'REJECTED', 'Stream suspeito rejeitado sem hesitação para conteúdo infantil');

  // --------------------------------------------------------------------------
  // TESTE 6: FALLBACK SEGURO (NENHUM STREAM DISPONÍVEL)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 6: FALLBACK SEGURO QUANDO NÃO HÁ FONTES VERIFICADAS ---');
  const rankedEmpty = sourceSelectionService.rankStreams([suspiciousKidsStream], {
    hasExternalPtSub: false,
    identity: peppaIdentity
  });
  assert(rankedEmpty.length === 0, 'Lista final vazia evita reproduzir conteúdo desconhecido');

  console.log('\n===============================================================');
  console.log('🎉 TODOS OS TESTES DE INTEGRIDADE E SEGURANÇA FORAM APROVADOS!');
  console.log('===============================================================\n');
}

runIntegrityTests().catch(err => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
