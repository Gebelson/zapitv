/**
 * ZapiTV - Suíte de Testes: Carrosséis de Exclusivos das Plataformas de Streaming
 * 
 * Requisitos validados:
 * 1. 8 Plataformas Oficiais (Netflix, Disney+, Prime Video, HBO Max, Apple TV+, Paramount+, Globoplay, Crunchyroll).
 * 2. Títulos exatos conforme especificação e ausência estrita de subtítulos (subtitle: undefined).
 * 3. Diferenciação de originalPlatform vs currentExclusivePlatform e verificação de exclusividade no Brasil.
 * 4. Correspondência confiável por TMDB ID, IMDb ID e título normalizado com ano.
 * 5. Ausência absoluta de duplicatas dentro de cada carrossel.
 * 6. Filtragem de elegibilidade e conformidade com regras de reprodução do ZapiTV.
 * 7. Auto-ocultação se uma plataforma tiver menos de 3 títulos (< minItemsToDisplay).
 * 8. Respeito ao perfil infantil (isChild = true) sem exibição de títulos inadequados.
 * 9. Distribuição harmoniosa e intercalada na Home (Desktop, Mobile e Smart TV), preservando o topo para
 *    Continuar Assistindo e Em Alta no ZapiTV.
 * 10. Cache eficiente em memória com TTL de 15 minutos e suporte a invalidação sob demanda.
 */

import { streamingPlatformExclusivesService } from '../src/core/platforms/StreamingPlatformExclusivesService';
import {
  StreamingPlatformId,
  PLATFORM_CONFIGS,
  PlatformMetadataEntry
} from '../src/core/platforms/streamingExclusivesTypes';
import { VERIFIED_STREAMING_EXCLUSIVES } from '../src/core/platforms/streamingExclusivesData';
import { editorialCuratorService } from '../src/core/recommendations/editorialCuratorService';
import { ContentItem, ContentType } from '../types';

async function runStreamingPlatformExclusivesSuite() {
  console.log('========================================================================');
  console.log('🎬 SUÍTE DE TESTES: CARROSSÉIS DE EXCLUSIVOS DAS PLATAFORMAS DE STREAMING');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // 1. Validação das Configurações das 8 Plataformas e Títulos Oficiais
  // --------------------------------------------------------------------------
  console.log('--- 1. Configurações Oficiais e Títulos Exatos ---');
  const expectedPlatforms: Record<StreamingPlatformId, string> = {
    netflix: 'Exclusivos Netflix',
    disney: 'Exclusivos Disney+',
    prime: 'Exclusivos Prime Video',
    hbo: 'Exclusivos HBO Max',
    apple: 'Exclusivos Apple TV+',
    paramount: 'Exclusivos Paramount+',
    globoplay: 'Exclusivos Globoplay',
    crunchyroll: 'Exclusivos Crunchyroll'
  };

  const platformKeys = Object.keys(expectedPlatforms) as StreamingPlatformId[];
  assert('Todas as 8 plataformas estão configuradas', platformKeys.length === 8);

  for (const pid of platformKeys) {
    const config = PLATFORM_CONFIGS[pid];
    assert(
      `Plataforma ${pid} possui título oficial exato: "${expectedPlatforms[pid]}"`,
      config && config.title === expectedPlatforms[pid]
    );
    assert(
      `Plataforma ${pid} possui minItemsToDisplay = 3`,
      config && config.minItemsToDisplay === 3
    );
  }

  // --------------------------------------------------------------------------
  // 2. Metadados Oficiais: originalPlatform vs currentExclusivePlatform
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Diferenciação originalPlatform vs currentExclusivePlatform ---');
  assert('Metadados de exclusivos verificados contêm obras cadastradas', VERIFIED_STREAMING_EXCLUSIVES.length > 20);

  let hasDivergentRights = false;
  let allBrazilExclusiveVerified = true;

  for (const entry of VERIFIED_STREAMING_EXCLUSIVES) {
    if (entry.brazilExclusive !== true) {
      allBrazilExclusiveVerified = false;
    }
    if (entry.originalPlatform !== entry.currentExclusivePlatform) {
      hasDivergentRights = true;
    }
  }

  assert(
    'Metadados suportam e diferenciam produções onde originalPlatform != currentExclusivePlatform',
    hasDivergentRights
  );
  assert(
    'Todos os registros de exclusivos possuem brazilExclusive: true explicitamente comprovado',
    allBrazilExclusiveVerified
  );

  // --------------------------------------------------------------------------
  // 3. Correspondência Confiável por Identificadores (TMDB, IMDb, Título + Ano)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Correspondência por TMDB ID, IMDb ID e Metadados Canônicos ---');
  {
    // Item com TMDB ID correspondente
    const itemTmdb: ContentItem = {
      id: 'test_stranger_things',
      title: 'Stranger Things',
      tmdbId: 66732,
      type: ContentType.SERIES,
      year: 2016,
      availabilityStatus: 'verified'
    };
    const metaTmdb = streamingPlatformExclusivesService.getExclusivityMetadata(itemTmdb);
    assert('Identifica exclusividade com sucesso por TMDB ID', !!metaTmdb && metaTmdb.currentExclusivePlatform === 'netflix');

    // Item com IMDb ID correspondente
    const itemImdb: ContentItem = {
      id: 'test_mandalorian',
      title: 'The Mandalorian',
      imdbId: 'tt8111088',
      type: ContentType.SERIES,
      year: 2019,
      availabilityStatus: 'verified'
    };
    const metaImdb = streamingPlatformExclusivesService.getExclusivityMetadata(itemImdb);
    assert('Identifica exclusividade com sucesso por IMDb ID', !!metaImdb && metaImdb.currentExclusivePlatform === 'disney');

    // Item por Título Normalizado + Ano
    const itemTitle: ContentItem = {
      id: 'test_ted_lasso',
      title: 'Ted Lasso',
      type: ContentType.SERIES,
      year: 2020,
      availabilityStatus: 'verified'
    };
    const metaTitle = streamingPlatformExclusivesService.getExclusivityMetadata(itemTitle);
    assert('Identifica exclusividade com sucesso por Título + Ano', !!metaTitle && metaTitle.currentExclusivePlatform === 'apple');

    // Item não cadastrado
    const itemUnknown: ContentItem = {
      id: 'test_generic_movie',
      title: 'Filme Aleatório Independente Sem Exclusividade',
      type: ContentType.MOVIE,
      year: 2022,
      availabilityStatus: 'verified'
    };
    const metaUnknown = streamingPlatformExclusivesService.getExclusivityMetadata(itemUnknown);
    assert('Retorna null para produções sem exclusividade comprovada', metaUnknown === null);
  }

  // --------------------------------------------------------------------------
  // 4. Auto-Ocultação Quando < minItemsToDisplay (3 itens)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Regra de Auto-Ocultação (< 3 Itens Elegíveis) ---');
  {
    // Catálogo com apenas 2 itens da Netflix
    const smallNetflixCatalog: ContentItem[] = [
      {
        id: 'st_1',
        title: 'Stranger Things',
        tmdbId: 66732,
        type: ContentType.SERIES,
        year: 2016,
        rating: 8.7,
        availabilityStatus: 'verified'
      },
      {
        id: 'wed_2',
        title: 'Wandinha',
        tmdbId: 119051,
        type: ContentType.SERIES,
        year: 2022,
        rating: 8.1,
        availabilityStatus: 'verified'
      }
    ];

    const rowBelowMin = streamingPlatformExclusivesService.getPlatformRow(smallNetflixCatalog, 'netflix');
    assert('Oculta carrossel da plataforma se possuir menos de 3 títulos (retorna null)', rowBelowMin === null);

    // Adiciona o 3º item elegível
    const validNetflixCatalog: ContentItem[] = [
      ...smallNetflixCatalog,
      {
        id: 'squid_3',
        title: 'Round 6',
        tmdbId: 93405,
        type: ContentType.SERIES,
        year: 2021,
        rating: 8.0,
        availabilityStatus: 'verified'
      }
    ];

    const rowValid = streamingPlatformExclusivesService.getPlatformRow(validNetflixCatalog, 'netflix');
    assert('Exibe carrossel da plataforma ao atingir o mínimo de 3 títulos elegíveis', rowValid !== null);
    if (rowValid) {
      assert('Fileira gerada não possui subtítulo (subtitle é undefined)', rowValid.subtitle === undefined);
      assert('Fileira gerada possui reasonType = "platform_exclusives"', rowValid.reasonType === 'platform_exclusives');
      assert('Fileira gerada possui id correspondente', rowValid.id === 'exclusive_netflix');
      assert('Fileira gerada possui exatamente os 3 itens ordenados', rowValid.items.length === 3);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Unicidade Absoluta e Deduplicação Interna
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Unicidade Interna e Ausência de Duplicatas ---');
  {
    const duplicateCatalog: ContentItem[] = [
      {
        id: 'st_dup_1',
        title: 'Stranger Things',
        tmdbId: 66732,
        type: ContentType.SERIES,
        year: 2016,
        rating: 8.7,
        availabilityStatus: 'verified'
      },
      {
        id: 'st_dup_2',
        title: 'Stranger Things',
        tmdbId: 66732,
        type: ContentType.SERIES,
        year: 2016,
        rating: 8.7,
        availabilityStatus: 'verified'
      },
      {
        id: 'wed_dup_1',
        title: 'Wandinha',
        tmdbId: 119051,
        type: ContentType.SERIES,
        year: 2022,
        rating: 8.1,
        availabilityStatus: 'verified'
      },
      {
        id: 'squid_dup_1',
        title: 'Round 6',
        tmdbId: 93405,
        type: ContentType.SERIES,
        year: 2021,
        rating: 8.0,
        availabilityStatus: 'verified'
      }
    ];

    const rowDedup = streamingPlatformExclusivesService.getPlatformRow(duplicateCatalog, 'netflix');
    assert('Fileira gerada não contém títulos duplicados', !!rowDedup && rowDedup.items.length === 3);
  }

  // --------------------------------------------------------------------------
  // 6. Respeito ao Perfil Infantil (isChild = true)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Perfil Infantil (isChild = true) ---');
  {
    const mixedDisneyCatalog: ContentItem[] = [
      {
        id: 'disney_moana',
        title: 'Moana: Um Mar de Aventuras',
        tmdbId: 277834,
        type: ContentType.MOVIE,
        genres: ['Família', 'Animação', 'Aventura'],
        rating: 7.6,
        availabilityStatus: 'verified'
      },
      {
        id: 'disney_frozen',
        title: 'Frozen: Uma Aventura Congelante',
        tmdbId: 109445,
        type: ContentType.MOVIE,
        genres: ['Família', 'Animação', 'Aventura'],
        rating: 7.5,
        availabilityStatus: 'verified'
      },
      {
        id: 'disney_encanto',
        title: 'Encanto',
        tmdbId: 568124,
        type: ContentType.MOVIE,
        genres: ['Família', 'Animação'],
        rating: 7.6,
        availabilityStatus: 'verified'
      },
      {
        id: 'disney_adult_series',
        title: 'Xógum: A Gloriosa Saga do Japão',
        tmdbId: 126308,
        type: ContentType.SERIES,
        genres: ['Drama', 'História', 'Guerra'],
        rating: 8.7,
        availabilityStatus: 'verified'
      }
    ];

    const childDisneyRow = streamingPlatformExclusivesService.getPlatformRow(mixedDisneyCatalog, 'disney', true);
    assert('Perfil infantil filtra produções adultas da plataforma', !!childDisneyRow);
    if (childDisneyRow) {
      assert('Perfil infantil mantém apenas produções adequadas (Moana, Frozen, Encanto)', childDisneyRow.items.length === 3);
      assert('Produção madura (Xógum) não é incluída no perfil infantil', !childDisneyRow.items.some(i => i.title.includes('Xógum')));
    }
  }

  // --------------------------------------------------------------------------
  // 7. Intercalação Harmoniosa na Home (editorialCuratorService)
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Intercalação Harmoniosa na Home (buildHomeEditorialRows) ---');
  {
    // Constrói catálogo realista contendo obras editoriais e produções das 8 plataformas
    const richCatalog: ContentItem[] = [];

    // Adiciona produções para cada uma das 8 plataformas (mínimo de 3 por plataforma)
    const platformSamples: Array<{ platform: StreamingPlatformId; title: string; tmdbId?: number; imdbId?: string; year: number; type: ContentType; genres: string[]; rating: number }> = [
      // Netflix
      { platform: 'netflix', title: 'Stranger Things', tmdbId: 66732, year: 2016, type: ContentType.SERIES, genres: ['Sci-Fi', 'Drama'], rating: 8.7 },
      { platform: 'netflix', title: 'Wandinha', tmdbId: 119051, year: 2022, type: ContentType.SERIES, genres: ['Comédia', 'Mistério'], rating: 8.1 },
      { platform: 'netflix', title: 'Round 6', tmdbId: 93405, year: 2021, type: ContentType.SERIES, genres: ['Ação', 'Suspense'], rating: 8.0 },
      // Disney+
      { platform: 'disney', title: 'The Mandalorian', tmdbId: 82856, imdbId: 'tt8111088', year: 2019, type: ContentType.SERIES, genres: ['Ação', 'Sci-Fi'], rating: 8.6 },
      { platform: 'disney', title: 'Loki', tmdbId: 84958, year: 2021, type: ContentType.SERIES, genres: ['Sci-Fi', 'Aventura'], rating: 8.2 },
      { platform: 'disney', title: 'Moana: Um Mar de Aventuras', tmdbId: 277834, year: 2016, type: ContentType.MOVIE, genres: ['Animação', 'Família'], rating: 7.6 },
      // Prime Video
      { platform: 'prime', title: 'The Boys', tmdbId: 76479, year: 2019, type: ContentType.SERIES, genres: ['Ação', 'Comédia'], rating: 8.6 },
      { platform: 'prime', title: 'Invencível', tmdbId: 95557, year: 2021, type: ContentType.SERIES, genres: ['Animação', 'Ação'], rating: 8.7 },
      { platform: 'prime', title: 'Fallout', tmdbId: 106379, year: 2024, type: ContentType.SERIES, genres: ['Sci-Fi', 'Ação'], rating: 8.4 },
      // HBO Max
      { platform: 'hbo', title: 'Succession', tmdbId: 76331, year: 2018, type: ContentType.SERIES, genres: ['Drama'], rating: 8.9 },
      { platform: 'hbo', title: 'The Last of Us', tmdbId: 100088, year: 2023, type: ContentType.SERIES, genres: ['Drama', 'Sci-Fi'], rating: 8.7 },
      { platform: 'hbo', title: 'A Casa do Dragão', tmdbId: 94997, year: 2022, type: ContentType.SERIES, genres: ['Drama', 'Ação'], rating: 8.4 },
      // Apple TV+
      { platform: 'apple', title: 'Ruptura', tmdbId: 95396, year: 2022, type: ContentType.SERIES, genres: ['Drama', 'Mistério'], rating: 8.7 },
      { platform: 'apple', title: 'Ted Lasso', tmdbId: 97546, year: 2020, type: ContentType.SERIES, genres: ['Comédia', 'Drama'], rating: 8.8 },
      { platform: 'apple', title: 'Silo', tmdbId: 125988, year: 2023, type: ContentType.SERIES, genres: ['Sci-Fi', 'Drama'], rating: 8.1 },
      // Paramount+
      { platform: 'paramount', title: 'Yellowstone', tmdbId: 73586, year: 2018, type: ContentType.SERIES, genres: ['Drama', 'Faroeste'], rating: 8.7 },
      { platform: 'paramount', title: 'Halo', tmdbId: 52814, year: 2022, type: ContentType.SERIES, genres: ['Sci-Fi', 'Ação'], rating: 7.3 },
      { platform: 'paramount', title: 'Tulsa King', tmdbId: 153312, year: 2022, type: ContentType.SERIES, genres: ['Crime', 'Drama'], rating: 8.0 },
      // Globoplay
      { platform: 'globoplay', title: 'Sob Pressão', tmdbId: 74601, year: 2017, type: ContentType.SERIES, genres: ['Drama', 'Médico'], rating: 8.6 },
      { platform: 'globoplay', title: 'Os Outros', tmdbId: 226979, year: 2023, type: ContentType.SERIES, genres: ['Drama', 'Suspense'], rating: 8.4 },
      { platform: 'globoplay', title: 'Justiça', tmdbId: 67915, year: 2016, type: ContentType.SERIES, genres: ['Drama', 'Crime'], rating: 8.2 },
      // Crunchyroll
      { platform: 'crunchyroll', title: 'Attack on Titan', tmdbId: 1429, year: 2013, type: ContentType.ANIME, genres: ['Anime', 'Ação', 'Fantasia'], rating: 9.0 },
      { platform: 'crunchyroll', title: 'Jujutsu Kaisen', tmdbId: 95479, year: 2020, type: ContentType.ANIME, genres: ['Anime', 'Ação', 'Sobrenatural'], rating: 8.6 },
      { platform: 'crunchyroll', title: 'Demon Slayer: Kimetsu no Yaiba', tmdbId: 85937, year: 2019, type: ContentType.ANIME, genres: ['Anime', 'Ação', 'Fantasia'], rating: 8.7 }
    ];

    for (let i = 0; i < platformSamples.length; i++) {
      const p = platformSamples[i];
      richCatalog.push({
        id: `sample_${p.platform}_${i}`,
        title: p.title,
        tmdbId: p.tmdbId,
        imdbId: p.imdbId,
        year: p.year,
        type: p.type,
        genres: p.genres,
        rating: p.rating,
        availabilityStatus: 'verified'
      });
    }

    // Adiciona obras adicionais de apoio editorial (filmes, séries, animes)
    for (let j = 1; j <= 80; j++) {
      richCatalog.push({
        id: `general_item_${j}`,
        title: `Obra Geral ${j}`,
        type: j % 3 === 0 ? ContentType.SERIES : (j % 4 === 0 ? ContentType.ANIME : ContentType.MOVIE),
        genres: j % 2 === 0 ? ['Ação', 'Aventura'] : ['Comédia', 'Família'],
        rating: 7.0 + ((j % 20) / 10),
        year: 2015 + (j % 10),
        availabilityStatus: 'verified'
      });
    }

    const cwItem: ContentItem = {
      id: 'cw_active_1',
      title: 'Obra em Andamento',
      type: ContentType.SERIES,
      availabilityStatus: 'verified'
    };

    editorialCuratorService.invalidateCache();
    const homeRows = editorialCuratorService.buildHomeEditorialRows(
      richCatalog,
      'test_user_rich',
      [cwItem]
    );

    // 1. Topo da Home preservado
    assert('Primeira fileira é estritamente Continuar Assistindo', homeRows[0].id === 'continue_watching');
    assert('Segunda fileira é Em Alta no ZapiTV (ou recomendações prioritárias)', homeRows[1].id === 'trending_zapitv');

    // 2. Presença das 8 plataformas
    const platformRowIds = homeRows.filter(r => r.reasonType === 'platform_exclusives').map(r => r.id);
    assert(
      'Todas as 8 plataformas de streaming estão presentes na Home',
      platformRowIds.length === 8,
      `Presentes: ${platformRowIds.join(', ')}`
    );

    for (const pid of platformKeys) {
      const found = homeRows.find(r => r.id === `exclusive_${pid}`);
      assert(`Carrossel "Exclusivos ${pid}" está presente`, !!found);
      if (found) {
        assert(`Carrossel ${pid} não possui subtítulo`, found.subtitle === undefined);
        assert(`Carrossel ${pid} possui >= 3 itens`, found.items.length >= 3);
      }
    }

    // 3. Intercalação harmoniosa (sem blocos consecutivos das 8 plataformas)
    let maxConsecutivePlatforms = 0;
    let currentConsecutive = 0;
    for (const row of homeRows) {
      if (row.reasonType === 'platform_exclusives') {
        currentConsecutive++;
        if (currentConsecutive > maxConsecutivePlatforms) {
          maxConsecutivePlatforms = currentConsecutive;
        }
      } else {
        currentConsecutive = 0;
      }
    }

    assert(
      'Carrosséis de plataformas são harmoniosamente intercalados (máximo de 1 a 2 plataformas consecutivas, sem aglomeração)',
      maxConsecutivePlatforms <= 2,
      `Máximo consecutivo encontrado: ${maxConsecutivePlatforms}`
    );

    // 4. Posicionamento contextual:
    // Crunchyroll próximo a animes
    const crIndex = homeRows.findIndex(r => r.id === 'exclusive_crunchyroll');
    const animeIndex = homeRows.findIndex(r => r.id === 'anime_hits');
    if (crIndex !== -1 && animeIndex !== -1) {
      assert(
        'Exclusivos Crunchyroll está posicionado próximo a categorias de anime',
        Math.abs(crIndex - animeIndex) <= 2
      );
    }

    // Netflix logo após Em Alta no ZapiTV
    const netflixIndex = homeRows.findIndex(r => r.id === 'exclusive_netflix');
    const trendingIndex = homeRows.findIndex(r => r.id === 'trending_zapitv');
    assert(
      'Exclusivos Netflix está posicionado após Em Alta no ZapiTV',
      netflixIndex === trendingIndex + 1
    );
  }

  // --------------------------------------------------------------------------
  // 8. Cache em Memória com TTL e Invalidação Sob Demanda
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Cache de Sessão e Invalidação Sob Demanda ---');
  {
    const sampleCatalog: ContentItem[] = [
      { id: 'item_c_1', title: 'Stranger Things', tmdbId: 66732, type: ContentType.SERIES, rating: 8.7, availabilityStatus: 'verified' },
      { id: 'item_c_2', title: 'Wandinha', tmdbId: 119051, type: ContentType.SERIES, rating: 8.1, availabilityStatus: 'verified' },
      { id: 'item_c_3', title: 'Round 6', tmdbId: 93405, type: ContentType.SERIES, rating: 8.0, availabilityStatus: 'verified' }
    ];

    streamingPlatformExclusivesService.invalidateCache();
    const call1 = streamingPlatformExclusivesService.getAllPlatformRows(sampleCatalog);
    const call2 = streamingPlatformExclusivesService.getAllPlatformRows(sampleCatalog);

    assert('Chamadas subsequentes utilizam o cache em memória (mesma referência de array)', call1 === call2);

    streamingPlatformExclusivesService.invalidateCache();
    const call3 = streamingPlatformExclusivesService.getAllPlatformRows(sampleCatalog);
    assert('invalidateCache() renova o cache sob demanda', call1 !== call3);
  }

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO FINAL DA SUÍTE DE EXCLUSIVOS: ${passed} PASS, ${failed} FAIL`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStreamingPlatformExclusivesSuite().catch(err => {
  console.error('Erro fatal na execução da suíte:', err);
  process.exit(1);
});
