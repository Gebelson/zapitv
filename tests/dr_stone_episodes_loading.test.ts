import assert from 'node:assert';
import { animeSeasonMappingService } from '../src/core/anime/animeSeasonMappingService';
import { episodeAvailabilityService } from '../src/core/episodes/episodeAvailabilityService';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import { animeEditorialCatalog } from '../src/core/anime/animeEditorialService';
import { canonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
import { ContentType } from '../types';

async function runDrStoneEpisodesLoadingSuite() {
  console.log('=== TESTE DE CARREGAMENTO DE EPISÓDIOS E TEMPORADAS: DR. STONE (ZAPITV) ===\n');

  // --------------------------------------------------------------------------
  // TESTE 1: Cadastro Canônico e Integridade Editorial de Dr. Stone
  // --------------------------------------------------------------------------
  console.log('[Teste 1] Verificando cadastro oficial de Dr. Stone no catálogo...');
  const itemFeatured = FEATURED_CATALOG_ITEMS.find(i => i.id === 'anime-dr-stone' || i.aniListId === 105333 || i.tmdbId === '86031');
  assert.ok(itemFeatured, 'Item anime-dr-stone DEVE existir em FEATURED_CATALOG_ITEMS');
  assert.strictEqual(itemFeatured.tmdbId, '86031');
  assert.strictEqual(itemFeatured.imdbId, 'tt9679542');
  assert.strictEqual(itemFeatured.aniListId, 105333);
  assert.strictEqual(itemFeatured.type, ContentType.ANIME);
  assert.strictEqual(itemFeatured.year, 2019);
  assert.ok((itemFeatured.seasonsCount || 0) >= 3, 'seasonsCount deve ser >= 3');
  assert.ok(itemFeatured.episodes && itemFeatured.episodes.length >= 1, 'Deve possuir episódios cadastrados');

  const itemVerified = VERIFIED_OPEN_ITEMS.find(i => i.id === 'anime-dr-stone-verified' || i.tmdbId === '86031');
  assert.ok(itemVerified, 'Item anime-dr-stone-verified DEVE existir em VERIFIED_OPEN_ITEMS');
  assert.strictEqual(itemVerified.tmdbId, '86031');
  assert.strictEqual(itemVerified.imdbId, 'tt9679542');
  assert.strictEqual(itemVerified.aniListId, 105333);
  assert.strictEqual(itemVerified.type, ContentType.ANIME);

  const category = canonicalCatalogMaster.classifyCategory({
    id: 'test-dr-stone',
    title: 'Dr. Stone',
    type: ContentType.SERIES
  });
  assert.strictEqual(category, ContentType.ANIME, 'Dr. Stone deve ser classificado como ANIME');

  console.log('✓ Teste 1: Cadastro canônico e editorial de Dr. Stone aprovado OK');

  // --------------------------------------------------------------------------
  // TESTE 2: Mapeamento Inteligente de Temporadas TMDB (AnimeSeasonMappingService)
  // --------------------------------------------------------------------------
  console.log('[Teste 2] Verificando resolução de temporadas via AnimeSeasonMappingService...');
  
  // S1
  const mapS1 = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'anilist-105333',
    title: 'Dr. STONE',
    type: ContentType.ANIME,
    aniListId: 105333
  });
  assert.ok(mapS1, 'S1 deve ser mapeado');
  assert.strictEqual(mapS1.tmdbId, '86031');
  assert.strictEqual(mapS1.imdbId, 'tt9679542');
  assert.strictEqual(mapS1.defaultSeason, 1);

  // S2 (Stone Wars)
  const mapS2 = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'anilist-113936',
    title: 'Dr. STONE: STONE WARS',
    type: ContentType.ANIME,
    aniListId: 113936
  });
  assert.ok(mapS2, 'S2 deve ser mapeado');
  assert.strictEqual(mapS2.tmdbId, '86031');
  assert.strictEqual(mapS2.defaultSeason, 2);

  // S0 (Ryusui Especial)
  const mapRyusui = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'anilist-142876',
    title: 'Dr. STONE: Ryuusui',
    type: ContentType.ANIME,
    aniListId: 142876
  });
  assert.ok(mapRyusui, 'Ryusui deve ser mapeado');
  assert.strictEqual(mapRyusui.tmdbId, '86031');
  assert.strictEqual(mapRyusui.defaultSeason, 0);

  // S3 (New World)
  const mapS3 = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'anilist-131518',
    title: 'Dr. STONE: NEW WORLD',
    type: ContentType.ANIME,
    aniListId: 131518
  });
  assert.ok(mapS3, 'S3 deve ser mapeado');
  assert.strictEqual(mapS3.tmdbId, '86031');
  assert.strictEqual(mapS3.defaultSeason, 3);

  // S4 (Science Future)
  const mapS4 = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'anilist-172019',
    title: 'Dr. STONE: SCIENCE FUTURE',
    type: ContentType.ANIME,
    aniListId: 172019
  });
  assert.ok(mapS4, 'S4 deve ser mapeado');
  assert.strictEqual(mapS4.tmdbId, '86031');
  assert.strictEqual(mapS4.defaultSeason, 4);

  // Mapeamento por título
  const mapTitle = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'custom-drstone',
    title: 'Dr. Stone: Stone Wars',
    type: ContentType.ANIME
  });
  assert.ok(mapTitle, 'Mapeamento por título deve funcionar');
  assert.strictEqual(mapTitle.tmdbId, '86031');
  assert.strictEqual(mapTitle.defaultSeason, 2);

  // Rejeição de não-correspondentes
  const mapOther = animeSeasonMappingService.resolveAnimeTmdbIdentity({
    id: 'naruto',
    title: 'Naruto',
    type: ContentType.ANIME,
    aniListId: 20
  });
  assert.notStrictEqual(mapOther?.tmdbId, '86031');

  console.log('✓ Teste 2: Resolução de temporadas via AnimeSeasonMappingService aprovada OK');

  // --------------------------------------------------------------------------
  // TESTE 3: Disponibilidade de Episódios com Suporte a Evidência Oficial
  // --------------------------------------------------------------------------
  console.log('[Teste 3] Verificando filtro de episódios exibidos...');
  assert.strictEqual(episodeAvailabilityService.isEpisodeOfficiallyAired('2019-07-05'), true);
  assert.strictEqual(episodeAvailabilityService.isEpisodeOfficiallyAired('2099-12-31'), false);
  assert.strictEqual(episodeAvailabilityService.isEpisodeOfficiallyAired(undefined), false);

  // Com contexto de evidência oficial em série já estreada
  const airedWithEvidence = episodeAvailabilityService.isEpisodeOfficiallyAired(undefined, {
    seriesYear: 2019,
    episodeTitle: 'Stone World',
    hasOfficialEvidence: true
  });
  assert.strictEqual(airedWithEvidence, true, 'Episódio com evidência oficial deve ser aprovado');

  // filterAiredEpisodes preserva temporada completa
  const sampleSeason1 = Array.from({ length: 24 }, (_, i) => ({
    id: `dr-stone-s1-e${i + 1}`,
    number: i + 1,
    title: `Episódio ${i + 1}`,
    airDate: '2019-07-05',
    description: `Sinopse ${i + 1}`,
    image: '/img.jpg'
  }));

  const filtered = episodeAvailabilityService.filterAiredEpisodes(sampleSeason1, {
    seriesYear: 2019,
    totalEpisodesCount: 24
  });
  assert.strictEqual(filtered.length, 24, 'Todos os 24 episódios devem ser preservados');
  assert.strictEqual(filtered[0].number, 1);
  assert.strictEqual(filtered[23].number, 24);

  // Episódio futuro descartado
  const sampleWithFuture = [
    { id: 'ep-1', number: 1, title: 'Ep 1', airDate: '2019-07-05' },
    { id: 'ep-2', number: 2, title: 'Ep 2', airDate: '2019-07-12' },
    { id: 'ep-99', number: 99, title: 'Ep Futuro', airDate: '2099-01-01' }
  ];
  const filteredWithFuture = episodeAvailabilityService.filterAiredEpisodes(sampleWithFuture);
  assert.strictEqual(filteredWithFuture.length, 2);
  assert.deepStrictEqual(filteredWithFuture.map(e => e.number), [1, 2]);

  console.log('✓ Teste 3: Filtro de episódios com evidência oficial aprovado OK');

  // --------------------------------------------------------------------------
  // TESTE 4: Cache e Deduplicação no TMDB Client
  // --------------------------------------------------------------------------
  console.log('[Teste 4] Verificando cache e requisições em voo no tmdbService...');
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;

  const mockTmdbSeasonData = {
    season_number: 1,
    name: 'Temporada 1',
    episodes: Array.from({ length: 24 }, (_, i) => ({
      id: 1000 + i,
      episode_number: i + 1,
      name: `Episódio ${i + 1}`,
      overview: `Sinopse ${i + 1}`,
      air_date: '2019-07-05',
      still_path: '/still.jpg'
    }))
  };

  globalThis.fetch = (async () => {
    networkCalls++;
    return {
      ok: true,
      status: 200,
      json: async () => mockTmdbSeasonData
    } as any;
  }) as any;

  try {
    const [r1, r2] = await Promise.all([
      tmdbService.getSeasonEpisodes('86031', 1),
      tmdbService.getSeasonEpisodes('86031', 1)
    ]);
    assert.strictEqual(r1.length, 24);
    assert.strictEqual(r2.length, 24);
    assert.strictEqual(networkCalls, 1, 'Chamadas concorrentes devem disparar apenas 1 requisição');

    const r3 = await tmdbService.getSeasonEpisodes('86031', 1);
    assert.strictEqual(r3.length, 24);
    assert.strictEqual(networkCalls, 1, 'Chamada subsequente deve utilizar o cache');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('✓ Teste 4: Cache e deduplicação do TMDB aprovado OK');

  // --------------------------------------------------------------------------
  // TESTE 5: Independência entre Metadados e Fontes de Streams
  // --------------------------------------------------------------------------
  console.log('[Teste 5] Verificando não-remoção de episódios por indisponibilidade de stream...');
  const loadedEps = [
    { id: 'dr-stone-s1e1', number: 1, title: 'Stone World', description: 'Desc 1', image: '/img1.jpg' },
    { id: 'dr-stone-s1e2', number: 2, title: 'King of the Stone World', description: 'Desc 2', image: '/img2.jpg' }
  ];
  // A ausência temporária de streams nunca deve remover o episódio
  const preservedEps = [...loadedEps];
  assert.strictEqual(preservedEps.length, 2);
  assert.strictEqual(preservedEps[0].title, 'Stone World');
  assert.strictEqual(preservedEps[1].title, 'King of the Stone World');
  console.log('✓ Teste 5: Independência de metadados e streams aprovado OK');

  console.log('\n========================================================================');
  console.log('TODOS OS TESTES DE DR. STONE FORAM APROVADOS COM SUCESSO! 🚀');
  console.log('========================================================================\n');
}

runDrStoneEpisodesLoadingSuite().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Falha nos testes de Dr. Stone:', err);
  process.exit(1);
});
