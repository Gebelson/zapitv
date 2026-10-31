import { seriesSeasonMappingService, DOCTOR_WHO_CANONICAL } from '../src/core/series/seriesSeasonMappingService';
import { streamValidator } from '../src/core/providers/streamValidator';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { episodeAvailabilityService } from '../src/core/episodes/episodeAvailabilityService';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { ContentType } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

async function runDoctorWhoAccuracySuite() {
  console.log('\n========================================================================');
  console.log('  ZapiTV — Suíte de Integridade, Identidade e Reprodução de Doctor Who  ');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Identidades Canônicas e Isolamento de Obras Distintas
  // -------------------------------------------------------------------------
  console.log('[Etapa 1] Validando identidades canônicas e isolamento entre 1963, 2005 e 2024...');

  // 1.1 Clássica (1963)
  const classicIdentity = canonicalIdentityService.buildIdentity({
    id: 'doctor-who-1963',
    title: 'Doctor Who',
    year: 1963,
    tmdbId: '121',
    imdbId: 'tt0056751',
    type: ContentType.SERIES,
    rating: 8.5
  }, { season: 1, episode: 1 });

  assert(seriesSeasonMappingService.identifyFranchiseVersion(classicIdentity) === 'classic_1963', 'Deve identificar como classic_1963');
  assert(seriesSeasonMappingService.getPresentationSeasonsCount(classicIdentity) === 26, 'Clássica deve ter 26 temporadas');

  // 1.2 Moderna (2005)
  const modernIdentity = canonicalIdentityService.buildIdentity({
    id: 'doctor-who-2005',
    title: 'Doctor Who',
    year: 2005,
    tmdbId: '57243',
    imdbId: 'tt0436992',
    type: ContentType.SERIES,
    rating: 8.6
  }, { season: 1, episode: 1 });

  assert(seriesSeasonMappingService.identifyFranchiseVersion(modernIdentity) === 'modern_2005', 'Deve identificar como modern_2005');
  assert(seriesSeasonMappingService.getPresentationSeasonsCount(modernIdentity) === 15, 'Moderna deve ter 15 temporadas unificadas');

  // 1.3 Nova Era (2024)
  const era2024Identity = canonicalIdentityService.buildIdentity({
    id: 'doctor-who-2024',
    title: 'Doctor Who',
    year: 2024,
    tmdbId: '239770',
    imdbId: 'tt30842880',
    type: ContentType.SERIES,
    rating: 7.2
  }, { season: 1, episode: 1 });

  assert(seriesSeasonMappingService.identifyFranchiseVersion(era2024Identity) === 'era_2024', 'Deve identificar como era_2024');
  assert(seriesSeasonMappingService.getPresentationSeasonsCount(era2024Identity) === 2, '2024 standalone deve ter 2 temporadas');

  // 1.4 Teste de não equivalência entre obras homônimas
  const isSameClassicModern = canonicalIdentityService.isSameWork(
    { title: 'Doctor Who', year: 1963, type: ContentType.SERIES },
    { title: 'Doctor Who', year: 2005, type: ContentType.SERIES }
  );
  assert(!isSameClassicModern, 'Doctor Who (1963) e Doctor Who (2005) NÃO podem ser considerados a mesma obra!');

  const isSameModern2024 = canonicalIdentityService.isSameWork(
    { title: 'Doctor Who', year: 2005, type: ContentType.SERIES },
    { title: 'Doctor Who', year: 2024, type: ContentType.SERIES }
  );
  assert(!isSameModern2024, 'Doctor Who (2005) e Doctor Who (2024) NÃO podem ser considerados a mesma obra!');

  console.log('✓ Identidades canônicas estritamente isoladas (1963: 26 temporadas, 2005: 15 temporadas, 2024: 2 temporadas)');

  // -------------------------------------------------------------------------
  // 2. Mapeamento da Continuidade Moderna (15 Temporadas)
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 2] Validando mapeamento da continuidade moderna (T14 e T15)...');

  // T1..T13 mapeiam para a produção de 2005 (TMDB 57243)
  for (let s = 1; s <= 13; s++) {
    const mapping = seriesSeasonMappingService.mapPresentationToProductionSeason(s);
    assert(mapping.targetTmdbId === '57243', `Temporada ${s} deve mapear para TMDB 57243`);
    assert(mapping.targetSeason === s, `Temporada ${s} deve preservar targetSeason = ${s}`);
    assert(mapping.era === 'modern_2005', `Temporada ${s} deve pertencer à era modern_2005`);
  }

  // T14 mapeia para a produção de 2024 Season 1 (TMDB 239770)
  const mapS14 = seriesSeasonMappingService.mapPresentationToProductionSeason(14);
  assert(mapS14.targetTmdbId === '239770', 'Temporada 14 deve mapear para TMDB 239770');
  assert(mapS14.targetImdbId === 'tt30842880', 'Temporada 14 deve mapear para IMDb tt30842880');
  assert(mapS14.targetSeason === 1, 'Temporada 14 deve mapear para a Season 1 da produção de 2024');
  assert(mapS14.era === 'era_2024', 'Temporada 14 deve pertencer à era 2024');

  // T15 mapeia para a produção de 2024 Season 2 (TMDB 239770)
  const mapS15 = seriesSeasonMappingService.mapPresentationToProductionSeason(15);
  assert(mapS15.targetTmdbId === '239770', 'Temporada 15 deve mapear para TMDB 239770');
  assert(mapS15.targetSeason === 2, 'Temporada 15 deve mapear para a Season 2 da produção de 2024');
  assert(mapS15.era === 'era_2024', 'Temporada 15 deve pertencer à era 2024');

  console.log('✓ Continuidade mapeada com precisão: T1-T13 -> TMDB 57243 (S1-13), T14 -> TMDB 239770 (S1), T15 -> TMDB 239770 (S2)');

  // -------------------------------------------------------------------------
  // 3. Obtenção de Metadados Canônicos de Episódios
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 3] Validando metadados de episódios sem mistura de eras...');

  // 3.1 T14E1 deve ser Space Babies (ou "Bebês do Espaço" em PT-BR)
  const s14Eps = await tmdbService.getSeasonEpisodes('57243', 14);
  assert(Array.isArray(s14Eps) && s14Eps.length > 0, 'Episódios da T14 devem ser carregados');
  assert(s14Eps[0].number === 1, 'Primeiro episódio deve ser número 1');
  const ep1TitleLower = s14Eps[0].title.toLowerCase();
  assert(
    ep1TitleLower.includes('space babies') || ep1TitleLower.includes('bebês do espaço') || ep1TitleLower.includes('bebes do espaco'),
    `T14E01 deve ser "Space Babies" / "Bebês do Espaço", obtido: "${s14Eps[0].title}"`
  );
  console.log(`✓ T14E01 retornado com sucesso: "${s14Eps[0].title}" (origem: produção de 2024)`);

  // 3.2 T14E02 deve ser The Devil's Chord (ou "O Acorde do Diabo" em PT-BR)
  assert(s14Eps[1].number === 2, 'Segundo episódio deve ser número 2');
  const ep2TitleLower = s14Eps[1].title.toLowerCase();
  assert(
    ep2TitleLower.includes('devil') || ep2TitleLower.includes('diabo') || ep2TitleLower.includes('chord') || ep2TitleLower.includes('acorde'),
    `T14E02 deve ser "The Devil's Chord" / "O Acorde do Diabo", obtido: "${s14Eps[1].title}"`
  );
  console.log(`✓ T14E02 retornado com sucesso: "${s14Eps[1].title}"`);

  // 3.3 T15E1 deve mapear para a temporada 15
  const s15Eps = await tmdbService.getSeasonEpisodes('57243', 15);
  assert(Array.isArray(s15Eps) && s15Eps.length > 0, 'Episódios da T15 devem ser carregados');
  assert(s15Eps[0].number === 1, 'Primeiro episódio da T15 deve ser número 1');
  console.log(`✓ T15E01 retornado com sucesso: "${s15Eps[0].title}"`);

  // -------------------------------------------------------------------------
  // 4. Bloqueio Estrito de Fontes Incompatíveis (Rejeição de Falso Match)
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 4] Validando bloqueio estrito de fontes de eras diferentes...');

  // 4.1 O caso do incidente: usuário pede Doctor Who 2005 S01E01 (Rose), mas o stream é de 2024 (Space Babies)
  const corrupt2024Stream = {
    name: 'Torrentio 1080p',
    title: 'Doctor Who 2024 S01E01 Space Babies 1080p WEB-DL DDP5.1 Atmos H.264',
    url: 'https://torrent.stream/stream/doctor_who_2024_s01e01.mkv'
  };

  // Avaliação no SourceConfidenceEngine para Doctor Who 2005 T1E1
  const evalIncident = sourceConfidenceEngine.evaluate(corrupt2024Stream, modernIdentity);
  assert(!evalIncident.isMatch, 'SourceConfidenceEngine DEVE REJEITAR stream de 2024 Space Babies quando o pedido é 2005 Rose!');
  assert(evalIncident.confidence === 'REJECTED', 'Status deve ser estritamente REJECTED');
  console.log(`✓ SourceConfidenceEngine rejeitou stream de 2024 para pedido de 2005 T1E1 (Motivo: "${evalIncident.reasons[0]}")`);

  // Avaliação no StreamValidator para Doctor Who 2005 T1E1
  const isMatchValidator = streamValidator.isStreamMatchingTargetTitle(
    corrupt2024Stream,
    'Doctor Who',
    'Doctor Who',
    ['Doctor Who (2005)', 'dr who'],
    { season: 1, episode: 1 }
  );
  assert(!isMatchValidator, 'StreamValidator DEVE REJEITAR stream de 2024 Space Babies para Doctor Who 2005 T1E1!');
  console.log('✓ StreamValidator rejeitou stream de 2024 para pedido de 2005 T1E1');

  // 4.2 Stream legítimo de 2005 T1E1 (Rose)
  const legit2005Stream = {
    name: 'Torrentio 1080p',
    title: 'Doctor Who 2005 S01E01 Rose 1080p BluRay x264',
    url: 'https://torrent.stream/stream/doctor_who_2005_s01e01.mkv'
  };
  const evalLegit2005 = sourceConfidenceEngine.evaluate(legit2005Stream, modernIdentity);
  assert(evalLegit2005.isMatch, 'SourceConfidenceEngine deve aceitar stream legítimo de 2005 Rose');
  console.log('✓ Stream legítimo de 2005 Rose aceito com sucesso para 2005 T1E1');

  // 4.3 Usuário pede Doctor Who Clássica 1963 S01E01 (An Unearthly Child)
  // Rejeita streams de 2005 (Rose) e 2024 (Space Babies)
  const corruptModernForClassic = {
    name: 'Torrentio 1080p',
    title: 'Doctor Who S01E01 Rose 2005 720p HDTV x264',
    url: 'https://torrent.stream/stream/doctor_who_rose.mkv'
  };
  const evalClassicReject = sourceConfidenceEngine.evaluate(corruptModernForClassic, classicIdentity);
  assert(!evalClassicReject.isMatch, 'Deve rejeitar stream de 2005 Rose para requisição de 1963 An Unearthly Child!');
  console.log('✓ Stream de 2005 Rose rejeitado para pedido da série clássica de 1963');

  // 4.4 Usuário pede Season 14 Episode 1 (Space Babies) na Apresentação Moderna
  const modernS14Identity = canonicalIdentityService.buildIdentity({
    id: 'doctor-who-2005',
    title: 'Doctor Who',
    year: 2005,
    tmdbId: '57243',
    imdbId: 'tt0436992',
    type: ContentType.SERIES,
    rating: 8.6
  }, { season: 14, episode: 1 });

  // Stream indexado como S14E01
  const s14Stream = {
    name: 'Torrentio 1080p',
    title: 'Doctor Who S14E01 Space Babies 1080p WEB-DL DDP5.1',
    url: 'https://torrent.stream/stream/doctor_who_s14e01.mkv'
  };
  const isValidS14 = streamValidator.isStreamMatchingTargetTitle(
    s14Stream,
    'Doctor Who',
    'Doctor Who',
    ['Doctor Who (2005)', 'dr who'],
    { season: 14, episode: 1 }
  );
  assert(isValidS14, 'Stream com S14E01 Space Babies deve ser aceito para a Temporada 14 Episódio 1');
  console.log('✓ Stream indexado como S14E01 Space Babies aceito para a Temporada 14');

  // Stream indexado como 2024 S01E01 Space Babies (aceito na T14 pela equivalência canônica)
  const s01Stream2024 = {
    name: 'Torrentio 1080p',
    title: 'Doctor Who 2024 S01E01 Space Babies 1080p WEB-DL DDP5.1 Atmos',
    url: 'https://torrent.stream/stream/doctor_who_2024_s01e01_space_babies.mkv'
  };
  const isValid2024ForS14 = streamValidator.isStreamMatchingTargetTitle(
    s01Stream2024,
    'Doctor Who',
    'Doctor Who',
    ['Doctor Who (2005)', 'dr who'],
    { season: 14, episode: 1 }
  );
  assert(isValid2024ForS14, 'Stream indexado como 2024 S01E01 Space Babies deve ser aceito para a Temporada 14');
  console.log('✓ Stream indexado como 2024 S01E01 Space Babies aceito para a Temporada 14 via equivalência');

  // Rejeição de Rose na T14
  const roseForS14 = {
    name: 'Torrentio 1080p',
    title: 'Doctor Who 2005 S01E01 Rose 1080p BluRay x264',
    url: 'https://torrent.stream/stream/doctor_who_2005_rose.mkv'
  };
  const isRoseRejectedForS14 = streamValidator.isStreamMatchingTargetTitle(
    roseForS14,
    'Doctor Who',
    'Doctor Who',
    ['Doctor Who (2005)', 'dr who'],
    { season: 14, episode: 1 }
  );
  assert(!isRoseRejectedForS14, 'Rose (2005) DEVE ser rejeitado para a Temporada 14!');
  console.log('✓ Stream de 2005 Rose rejeitado para a Temporada 14');

  // -------------------------------------------------------------------------
  // 5. Consultas a Provedores com Múltiplas Convenções
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 5] Validando geração de especificações de busca para múltiplos provedores...');

  const specsS14E1 = seriesSeasonMappingService.getProviderQuerySpecs(14, 1);
  assert(specsS14E1.length >= 2, 'Deve gerar especificações de busca sob ambas as convenções');
  assert(specsS14E1.some(s => s.stremioId === 'tt30842880:1:1'), 'Deve consultar tt30842880:1:1 (era 2024)');
  assert(specsS14E1.some(s => s.stremioId === 'tt0436992:14:1'), 'Deve consultar tt0436992:14:1 (continuidade)');
  console.log('✓ ProviderQuerySpecs inclui tanto a identidade de 2024 (tt30842880:1:1) quanto continuidade (tt0436992:14:1)');

  // -------------------------------------------------------------------------
  // 6. Continuidade e Transição de Temporada (T13 -> T14)
  // -------------------------------------------------------------------------
  console.log('\n[Etapa 6] Validando transição contínua da Temporada 13 para a Temporada 14...');

  const availableSeasonsList = Array.from({ length: 15 }, (_, i) => i + 1);
  const nextFromS13LastEp = episodeAvailabilityService.getNextAvailableEpisode(
    13,
    6, // Último episódio regular da T13 (The Vanquishers)
    [
      { id: 'ep-1', number: 1, title: 'The Halloween Apocalypse' },
      { id: 'ep-2', number: 2, title: 'War of the Sontarans' },
      { id: 'ep-3', number: 3, title: 'Once, Upon Time' },
      { id: 'ep-4', number: 4, title: 'Village of the Angels' },
      { id: 'ep-5', number: 5, title: 'Survivors of the Flux' },
      { id: 'ep-6', number: 6, title: 'The Vanquishers' }
    ] as any[],
    availableSeasonsList
  );

  assert(Boolean(nextFromS13LastEp), 'Deve encontrar o próximo episódio');
  assert(nextFromS13LastEp?.season === 14, `Próxima temporada deve ser 14, obtido: ${nextFromS13LastEp?.season}`);
  assert(nextFromS13LastEp?.episode === 1, `Próximo episódio deve ser 1, obtido: ${nextFromS13LastEp?.episode}`);
  assert(nextFromS13LastEp?.title.includes('Space Babies'), `Título do próximo episódio deve ser Space Babies, obtido: "${nextFromS13LastEp?.title}"`);
  console.log(`✓ Transição da T13E06 avançou com perfeição para T14E01: "${nextFromS13LastEp?.title}"`);

  console.log('\n========================================================================');
  console.log('  TODOS OS 12 REQUISITOS DE DOCTOR WHO FORAM VALIDADOS COM SUCESSO!     ');
  console.log('========================================================================\n');
  process.exit(0);
}

runDoctorWhoAccuracySuite().catch(err => {
  console.error('\n❌ Falha na suíte de testes de Doctor Who:', err);
  process.exit(1);
});
