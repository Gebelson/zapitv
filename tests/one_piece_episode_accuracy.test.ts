import { providerRegistry } from '../src/core/providers/providerRegistry';
import { streamValidator } from '../src/core/providers/streamValidator';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { animeSeasonMappingService } from '../src/core/anime/animeSeasonMappingService';
import { episodeAvailabilityService } from '../src/core/episodes/episodeAvailabilityService';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { ContentType } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runOnePieceAccuracySuite() {
  console.log('\n========================================================================');
  console.log('  ZapiTV — Suíte de Integridade, Ordem e Reprodução de One Piece (1999) ');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Identificação do Catálogo e Mapeamento Canônico
  // -------------------------------------------------------------------------
  console.log('[Etapa 1] Validando catálogo oficial e resolução canônica do anime...');
  
  const opCatalogItem = FEATURED_CATALOG_ITEMS.find(it => it.id === 'anime-one-piece');
  assert(Boolean(opCatalogItem), 'Item anime-one-piece deve existir em FEATURED_CATALOG_ITEMS');
  assert(opCatalogItem?.imdbId === 'tt0388629', `IMDb ID de One Piece deve ser 'tt0388629', obtido: '${opCatalogItem?.imdbId}'`);
  assert(opCatalogItem?.tmdbId === '37854', `TMDB ID de One Piece deve ser '37854', obtido: '${opCatalogItem?.tmdbId}'`);
  assert(opCatalogItem?.aniListId === 21, `AniList ID de One Piece deve ser 21, obtido: '${opCatalogItem?.aniListId}'`);
  assert(Number(opCatalogItem?.seasonsCount) >= 21, 'seasonsCount deve refletir as temporadas reais do anime');
  console.log('✓ Item anime-one-piece no catálogo contém identificadores canônicos corretos (IMDb tt0388629, TMDB 37854, AniList 21)');

  const resolvedIdentity = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'anime-one-piece',
    title: 'One Piece',
    aniListId: 21
  });
  assert(Boolean(resolvedIdentity), 'animeSeasonMappingService deve resolver identidade de One Piece');
  assert(resolvedIdentity?.tmdbId === '37854', `Identidade TMDB resolvida deve ser '37854', obtido: '${resolvedIdentity?.tmdbId}'`);
  assert(resolvedIdentity?.imdbId === 'tt0388629', `Identidade IMDb resolvida deve ser 'tt0388629', obtido: '${resolvedIdentity?.imdbId}'`);
  assert(resolvedIdentity?.canonicalSeriesId === 'anime-one-piece', 'canonicalSeriesId deve ser anime-one-piece');
  console.log('✓ animeSeasonMappingService mapeia One Piece diretamente com chave canônica verificado');

  // Resolução por título em texto puro (ex: "One Piece")
  const resolvedByTitle = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'custom-one-piece',
    title: 'One Piece'
  });
  assert(Boolean(resolvedByTitle), 'animeSeasonMappingService deve resolver One Piece por título');
  assert(resolvedByTitle?.tmdbId === '37854', 'TMDB ID resolvido por título deve ser 37854');
  console.log('✓ animeSeasonMappingService resolve One Piece confiavelmente por título textual');

  // -------------------------------------------------------------------------
  // 2. Isolamento de Fontes: Rejeição da Corrupção Upstream do Arthur (OP-93 em T01 EP01)
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 2] Validando rejeição obrigatória do stream corrompido OP-93 na Temporada 1...');

  // O stream corrompido upstream da FenixFlix (pasta 1268): declara T01 EP01, mas aponta para OP-93.mp4
  const corruptArthurStreamEp1 = {
    name: 'FenixFlix 720p',
    title: '🐦‍🔥 One Piece ⏸️ T01 EP01 🇧🇷 Dublado 🚗 Arthur',
    url: 'https://tomato-sauce.19fc6b4c4bd6173bd6c9d933744fb2a1.r2.cloudflarestorage.com/streams/1268/OP-93.mp4',
    providerId: 'fenixflix-animes'
  };

  const corruptArthurStreamEp2 = {
    name: 'FenixFlix 720p',
    title: '🐦‍🔥 One Piece ⏸️ T01 EP02 🇧🇷 Dublado 🚗 Arthur',
    url: 'https://tomato-sauce.19fc6b4c4bd6173bd6c9d933744fb2a1.r2.cloudflarestorage.com/streams/1268/OP-94.mp4',
    providerId: 'fenixflix-animes'
  };

  const corruptArthurStreamEp3 = {
    name: 'FenixFlix 720p',
    title: '🐦‍🔥 One Piece ⏸️ T01 EP03 🇧🇷 Dublado 🚗 Arthur',
    url: 'https://tomato-sauce.19fc6b4c4bd6173bd6c9d933744fb2a1.r2.cloudflarestorage.com/streams/1268/OP-95.mp4',
    providerId: 'fenixflix-animes'
  };

  // Validando no streamValidator para o Episódio 1
  const isArthurS1E1Valid = streamValidator.isStreamMatchingTargetTitle(
    corruptArthurStreamEp1,
    'One Piece',
    'One Piece',
    ['One Piece (1999)'],
    { season: 1, episode: 1 }
  );
  assert(!isArthurS1E1Valid, 'streamValidator DEVE REJEITAR stream OP-93.mp4 quando o episódio requisitado é 1!');
  console.log('✓ streamValidator rejeitou OP-93.mp4 para a requisição de Season 1 Episode 1');

  // Validando no streamValidator para o Episódio 2 (OP-94.mp4)
  const isArthurS1E2Valid = streamValidator.isStreamMatchingTargetTitle(
    corruptArthurStreamEp2,
    'One Piece',
    'One Piece',
    ['One Piece (1999)'],
    { season: 1, episode: 2 }
  );
  assert(!isArthurS1E2Valid, 'streamValidator DEVE REJEITAR stream OP-94.mp4 para episódio 2!');
  console.log('✓ streamValidator rejeitou OP-94.mp4 para a requisição de Season 1 Episode 2');

  // Validando no streamValidator para o Episódio 3 (OP-95.mp4)
  const isArthurS1E3Valid = streamValidator.isStreamMatchingTargetTitle(
    corruptArthurStreamEp3,
    'One Piece',
    'One Piece',
    ['One Piece (1999)'],
    { season: 1, episode: 3 }
  );
  assert(!isArthurS1E3Valid, 'streamValidator DEVE REJEITAR stream OP-95.mp4 para episódio 3!');
  console.log('✓ streamValidator rejeitou OP-95.mp4 para a requisição de Season 1 Episode 3');

  // Validando no SourceConfidenceEngine para o Episódio 1
  const opS1E1Identity = canonicalIdentityService.buildIdentity({
    id: 'anime-one-piece',
    tmdbId: '37854',
    imdbId: 'tt0388629',
    title: 'One Piece',
    year: 1999,
    type: ContentType.ANIME
  }, { season: 1, episode: 1 });

  const confArthurS1E1 = sourceConfidenceEngine.evaluate(corruptArthurStreamEp1, opS1E1Identity);
  assert(!confArthurS1E1.isMatch, 'SourceConfidenceEngine DEVE REJEITAR OP-93.mp4 (isMatch: false)');
  assert(confArthurS1E1.confidence === 'REJECTED', 'SourceConfidenceEngine DEVE marcar confiança como REJECTED');
  console.log('✓ SourceConfidenceEngine rejeitou OP-93.mp4 com confiança REJECTED para o Episódio 1');

  // -------------------------------------------------------------------------
  // 3. Validação das Fontes Legítimas do Episódio 1 de 1999
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 3] Validando aprovação estrita das fontes legítimas do Episódio 1...');

  // 1. FrostStream T01·E01
  const legitimateFrostStreamS1E1 = {
    name: 'FrostStream 1080p',
    title: '🎬 One Piece (1999) 🥏 T01·E01 🌊 Neon 🌎 Português',
    url: '/api/proxy?url=https%3A%2F%2Ffroststream.cloutteam.com%2Fseries%2Fv1.wXzcI-xBS8SvxPnOr5MBekQ89iYmm77',
    providerId: 'froststream-multi'
  };

  const isFrostValid = streamValidator.isStreamMatchingTargetTitle(
    legitimateFrostStreamS1E1,
    'One Piece',
    'One Piece',
    [],
    { season: 1, episode: 1 }
  );
  assert(isFrostValid, 'FrostStream T01·E01 legítimo deve ser aprovado pelo streamValidator');

  const confFrost = sourceConfidenceEngine.evaluate(legitimateFrostStreamS1E1, opS1E1Identity);
  assert(confFrost.isMatch && confFrost.confidence !== 'REJECTED', 'FrostStream T01·E01 deve ter correspondência aprovada');
  console.log('✓ Fonte legítima FrostStream T01·E01 aprovada com sucesso');

  // 2. Rubeo Legendado (01.mp4/index.m3u8)
  const legitimateRubeoS1E1 = {
    name: 'FenixFlix 720p',
    title: '🐦‍🔥 One Piece ⏸️ T01 EP01 🇯🇵 Legendado 💧 Rubeo',
    url: 'https://cdn-sv01.maximaimg.online/stream/o/one-piece/01.mp4/index.m3u8',
    providerId: 'fenixflix-animes'
  };

  const isRubeoValid = streamValidator.isStreamMatchingTargetTitle(
    legitimateRubeoS1E1,
    'One Piece',
    'One Piece',
    [],
    { season: 1, episode: 1 }
  );
  assert(isRubeoValid, 'Rubeo 01.mp4 legítimo deve ser aprovado pelo streamValidator');

  const confRubeo = sourceConfidenceEngine.evaluate(legitimateRubeoS1E1, opS1E1Identity);
  assert(confRubeo.isMatch && confRubeo.confidence !== 'REJECTED', 'Rubeo 01.mp4 deve ter correspondência aprovada');
  console.log('✓ Fonte legítima Rubeo 01.mp4 aprovada com sucesso');

  // 3. Anipiece Dublado (001.mp4)
  const legitimateAnipieceS1E1 = {
    name: 'FenixFlix 1080p',
    title: '🐦‍🔥 One Piece ⏸️ T01 EP01 🇧🇷 Dublado 🏴‍☠️ Anipiece',
    url: 'https://mangas.cloud/Animes/Letra-O/One%20Piece%20Dublado/001.mp4',
    providerId: 'fenixflix-animes'
  };

  const isAnipieceValid = streamValidator.isStreamMatchingTargetTitle(
    legitimateAnipieceS1E1,
    'One Piece',
    'One Piece',
    [],
    { season: 1, episode: 1 }
  );
  assert(isAnipieceValid, 'Anipiece 001.mp4 legítimo deve ser aprovado');

  const confAnipiece = sourceConfidenceEngine.evaluate(legitimateAnipieceS1E1, opS1E1Identity);
  assert(confAnipiece.isMatch, 'Anipiece 001.mp4 deve ter correspondência aprovada');
  console.log('✓ Fonte legítima Anipiece 001.mp4 aprovada com sucesso');

  // -------------------------------------------------------------------------
  // 4. Integridade da Posição Real do Episódio 93 (Arco de Alabasta)
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 4] Validando integridade do Episódio 93 real (Arco de Alabasta)...');

  // Quando o usuário solicita o Episódio 93 (Season 4 Episode 93 em Alabasta):
  const opS4E93Identity = canonicalIdentityService.buildIdentity({
    id: 'anime-one-piece',
    tmdbId: '37854',
    imdbId: 'tt0388629',
    title: 'One Piece',
    year: 1999,
    type: ContentType.ANIME
  }, { season: 4, episode: 93 });

  // 1. O arquivo OP-93.mp4 É legítimo para o Episódio 93!
  const realS4E93Stream = {
    name: 'FenixFlix 720p',
    title: '🐦‍🔥 One Piece ⏸️ T04 EP93 (Ep. 93) 🇧🇷 Dublado 🚗 Arthur',
    url: 'https://tomato-sauce.19fc6b4c4bd6173bd6c9d933744fb2a1.r2.cloudflarestorage.com/streams/1268/OP-93.mp4',
    providerId: 'fenixflix-animes'
  };

  const isReal93ValidFor93 = streamValidator.isStreamMatchingTargetTitle(
    realS4E93Stream,
    'One Piece',
    'One Piece',
    [],
    { season: 4, episode: 93 }
  );
  assert(isReal93ValidFor93, 'OP-93.mp4 DEVE ser aceito para a requisição de Season 4 Episode 93 (Alabasta)');

  const confReal93 = sourceConfidenceEngine.evaluate(realS4E93Stream, opS4E93Identity);
  assert(confReal93.isMatch && confReal93.confidence !== 'REJECTED', 'OP-93.mp4 deve ser validado para Season 4 Episode 93');
  console.log('✓ OP-93.mp4 aceito corretamente na sua posição canônica real (Temporada 4, Episódio 93 - Alabasta)');

  // 2. Por outro lado, um arquivo do Episódio 1 (001.mp4) NÃO PODE ser aceito para o Episódio 93
  const ep1OfferedForEp93 = {
    name: 'FenixFlix 1080p',
    title: '🐦‍🔥 One Piece ⏸️ T04 EP93 🇧🇷 Dublado 🏴‍☠️ Anipiece',
    url: 'https://mangas.cloud/Animes/Letra-O/One%20Piece%20Dublado/001.mp4',
    providerId: 'fenixflix-animes'
  };

  const isEp1RejectedFor93 = !streamValidator.isStreamMatchingTargetTitle(
    ep1OfferedForEp93,
    'One Piece',
    'One Piece',
    [],
    { season: 4, episode: 93 }
  );
  assert(isEp1RejectedFor93, 'Arquivo 001.mp4 DEVE ser rejeitado quando o episódio solicitado é 93!');
  console.log('✓ Arquivo 001.mp4 rejeitado com sucesso quando requisitado para o Episódio 93');

  // -------------------------------------------------------------------------
  // 5. Navegação Sequencial e Transições entre Temporadas (Próximo Episódio)
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 5] Validando navegação contínua e cálculo do Próximo Episódio...');

  // Mock de episódios da Temporada 1 (1 a 61)
  const mockS1Episodes = Array.from({ length: 61 }, (_, i) => ({
    id: `ep-37854-1-${i + 1}`,
    number: i + 1,
    title: i === 0 ? 'Eu Sou Luffy! O Homem Que Será o Rei dos Piratas!' : `Episódio ${i + 1}`,
    description: 'Sinopse oficial',
    image: 'https://image.tmdb.org/t/p/w500/test.jpg'
  }));

  // Mock de episódios da Temporada 2 (62 a 77)
  const mockS2Episodes = Array.from({ length: 16 }, (_, i) => ({
    id: `ep-37854-2-${i + 62}`,
    number: i + 62,
    title: `Episódio ${i + 62}`,
    description: 'Sinopse oficial',
    image: 'https://image.tmdb.org/t/p/w500/test.jpg'
  }));

  // Transição 1 -> 2
  const nextFrom1 = episodeAvailabilityService.getNextAvailableEpisode(
    1,
    1,
    mockS1Episodes,
    [1, 2, 3, 4],
    mockS2Episodes
  );
  assert(nextFrom1?.season === 1 && nextFrom1?.episode === 2, `Próximo de 1 deve ser S1E2, obtido: S${nextFrom1?.season}E${nextFrom1?.episode}`);
  console.log('✓ Transição T1E01 -> T1E02 correta');

  // Transição 2 -> 3
  const nextFrom2 = episodeAvailabilityService.getNextAvailableEpisode(
    1,
    2,
    mockS1Episodes,
    [1, 2, 3, 4],
    mockS2Episodes
  );
  assert(nextFrom2?.season === 1 && nextFrom2?.episode === 3, `Próximo de 2 deve ser S1E3, obtido: S${nextFrom2?.season}E${nextFrom2?.episode}`);
  console.log('✓ Transição T1E02 -> T1E03 correta');

  // Transição de fronteira de temporada: fim da T1 (61) -> início da T2 (62)
  const nextFrom61 = episodeAvailabilityService.getNextAvailableEpisode(
    1,
    61,
    mockS1Episodes,
    [1, 2, 3, 4],
    mockS2Episodes
  );
  assert(nextFrom61?.season === 2 && nextFrom61?.episode === 62, `Próximo de 61 deve ser S2E62, obtido: S${nextFrom61?.season}E${nextFrom61?.episode}`);
  console.log('✓ Transição de fronteira T1E61 -> T2E62 correta');

  // Transição de fronteira sem episódios pré-carregados da próxima temporada
  const nextFrom61Fallback = episodeAvailabilityService.getNextAvailableEpisode(
    1,
    61,
    mockS1Episodes,
    [1, 2, 3, 4]
  );
  assert(nextFrom61Fallback?.season === 2 && nextFrom61Fallback?.episode === 62, `Fallback de fronteira T1E61 deve ser S2E62, obtido: S${nextFrom61Fallback?.season}E${nextFrom61Fallback?.episode}`);
  console.log('✓ Fallback de fronteira sem episódios da próxima temporada mantém continuidade contínua (S2E62)');

  console.log('\n========================================================================');
  console.log('  TODOS OS TESTES DE INTEGRIDADE DE ONE PIECE FORAM CONCLUÍDOS COM SUCESSO! ');
  console.log('========================================================================\n');
}

runOnePieceAccuracySuite().catch(err => {
  console.error('\n❌ Falha na suíte de testes de One Piece:', err);
  process.exit(1);
});
