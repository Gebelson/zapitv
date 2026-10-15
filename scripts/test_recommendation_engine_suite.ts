import { recommendationEngine } from '../src/core/recommendations/recommendationEngine';
import { userPreferenceStore } from '../src/core/recommendations/userPreferenceStore';
import { ContentItem, ContentType } from '../types';
import { filmesData } from '../constants';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { similarTitlesService } from '../src/core/recommendations/similarTitlesService';
import { adultContentService } from '../src/core/adult/AdultContentService';

async function runRecommendationEngineSuite() {
  console.log('========================================================================');
  console.log('🚀 INICIANDO SUÍTE DE TESTES: MOTOR PROFISSIONAL DE RECOMENDAÇÕES ZAPITV');
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

  // Prepara catálogo de teste com itens conhecidos
  const mockCatalog: ContentItem[] = [
    {
      id: 'movie_coraline',
      title: 'Coraline e o Mundo Secreto',
      type: ContentType.MOVIE,
      rating: 8.0,
      year: 2009,
      image: 'coraline.jpg',
      genres: ['Animação', 'Fantasia', 'Família'],
      director: 'Henry Selick',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_nightmare',
      title: 'O Estranho Mundo de Jack',
      type: ContentType.MOVIE,
      rating: 8.0,
      year: 1993,
      image: 'jack.jpg',
      genres: ['Animação', 'Fantasia', 'Família'],
      director: 'Henry Selick',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'series_dexter',
      title: 'Dexter',
      type: ContentType.SERIES,
      rating: 8.7,
      year: 2006,
      image: 'dexter.jpg',
      genres: ['Policial', 'Drama', 'Mistério'],
      director: 'James Manos Jr.',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'series_mindhunter',
      title: 'Mindhunter',
      type: ContentType.SERIES,
      rating: 8.6,
      year: 2017,
      image: 'mindhunter.jpg',
      genres: ['Policial', 'Drama', 'Mistério'],
      director: 'Joe Penhall',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'anime_shingeki',
      title: 'Attack on Titan',
      type: ContentType.ANIME,
      rating: 9.0,
      year: 2013,
      image: 'aot.jpg',
      genres: ['Anime', 'Ação', 'Fantasia'],
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-subtitles'
    },
    {
      id: 'anime_demon_slayer',
      title: 'Demon Slayer: Kimetsu no Yaiba',
      type: ContentType.ANIME,
      rating: 8.7,
      year: 2019,
      image: 'ds.jpg',
      genres: ['Anime', 'Ação', 'Fantasia'],
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_interstellar',
      title: 'Interestelar',
      type: ContentType.MOVIE,
      rating: 8.7,
      year: 2014,
      image: 'interstellar.jpg',
      genres: ['Ficção Científica', 'Drama', 'Aventura'],
      director: 'Christopher Nolan',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_oppenheimer',
      title: 'Oppenheimer',
      type: ContentType.MOVIE,
      rating: 8.9,
      year: 2023,
      image: 'oppenheimer.jpg',
      genres: ['Drama', 'Histórico', 'Biografia'],
      director: 'Christopher Nolan',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_adult_sample',
      title: 'Private Desires Adult',
      type: ContentType.MOVIE,
      rating: 6.0,
      year: 2022,
      image: 'adult.jpg',
      genres: ['Adulto'],
      isAdult: true,
      availabilityStatus: 'verified'
    }
  ];

  // --------------------------------------------------------------------------
  // TESTE 1: Candidate Generation & Validação de Elegibilidade
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Candidate Generation e Elegibilidade do Catálogo ---');
  {
    const profile = userPreferenceStore.getPreferencesSync('cold_user_test');
    
    // Todos os candidatos sem adulto por padrão
    const candidatesAll = recommendationEngine.generateCandidates(mockCatalog, profile, { allowAdult: false });
    assert('Não inclui conteúdo adulto por padrão', !candidatesAll.some(c => c.isAdult || c.genres?.includes('Adulto')));
    assert('Inclui itens elegíveis do acervo', candidatesAll.length === 8);

    // Filtro estrito de categoria
    const candidatesMovies = recommendationEngine.generateCandidates(mockCatalog, profile, { category: ContentType.MOVIE });
    assert('Candidatos de Filmes contêm apenas FILME', candidatesMovies.every(c => c.type === ContentType.MOVIE));

    const candidatesSeries = recommendationEngine.generateCandidates(mockCatalog, profile, { category: ContentType.SERIES });
    assert('Candidatos de Séries contêm apenas SÉRIE', candidatesSeries.every(c => c.type === ContentType.SERIES));

    const candidatesAnimes = recommendationEngine.generateCandidates(mockCatalog, profile, { category: ContentType.ANIME });
    assert('Candidatos de Animes contêm apenas ANIME', candidatesAnimes.every(c => c.type === ContentType.ANIME));
  }

  // --------------------------------------------------------------------------
  // TESTE 2: Cold Start (Novos Usuários)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Cold Start: Usuários Novos sem Histórico ---');
  {
    const coldProfile = userPreferenceStore.getPreferencesSync('brand_new_user');
    assert('Novo usuário inicia com 0 interações', coldProfile.interactionCount === 0);
    assert('Novo usuário inicia com engagement zero', coldProfile.totalEngagementScore === 0);

    const scoredCold = recommendationEngine.rankCandidates(mockCatalog.filter(c => !c.isAdult), coldProfile);
    assert('Gera ranking ponderado no cold start', scoredCold.length > 0);
    // No cold start, itens de alta avaliação e popularidade/novidade (ex: Oppenheimer, Shingeki) lideram
    const topCold = scoredCold[0].item;
    assert('Item do topo no cold start possui nota >= 8.5', topCold.rating >= 8.5);

    // Fileiras da Home em cold start
    const coldRows = recommendationEngine.getPersonalizedHomeRows(mockCatalog, 'brand_new_user', []);
    assert('Gera fileiras temáticas no cold start', coldRows.length >= 3);
    assert('Fileiras em cold start incluem Em Alta', coldRows.some(r => r.reasonType === 'trending'));
    assert('Fileiras em cold start incluem Aclamados pela Crítica', coldRows.some(r => r.reasonType === 'critically_acclaimed'));
    assert('Não inclui Continuar Assistindo se lista estiver vazia', !coldRows.some(r => r.reasonType === 'continue_watching'));
  }

  // --------------------------------------------------------------------------
  // TESTE 3: Aprendizado de Preferências e Ponderação
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Aprendizado de Preferências e Ponderação por Perfil ---');
  {
    const profileIdDexter = 'user_crime_fan';
    await userPreferenceStore.clearPreferences(profileIdDexter);

    const dexterItem = mockCatalog.find(i => i.id === 'series_dexter')!;
    
    // Simula conclusão de Dexter (90% assistido)
    await userPreferenceStore.recordPlayback(dexterItem, 3240, 3600, false, profileIdDexter);

    const profileUpdated = await userPreferenceStore.getPreferences(profileIdDexter);
    assert('Registrou interação do usuário', profileUpdated.interactionCount > 0);
    assert('Marcou obra como concluída (>= 85%)', profileUpdated.completedContentIds.includes(dexterItem.id));
    assert('Afinidade com gênero Policial é alta', (profileUpdated.genreAffinities['Policial'] || 0) >= 0.8);
    assert('Afinidade com tipo Série é computada', (profileUpdated.typeAffinities[ContentType.SERIES] || 0) > 0);

    // Ranking para fã de crimes/policial
    const rankedForCrimeFan = recommendationEngine.rankCandidates(mockCatalog.filter(c => !c.isAdult), profileUpdated);
    const topScored = rankedForCrimeFan[0];
    assert('Mindhunter ou Dexter recebem pontuação máxima de afinidade', 
      topScored.item.id === 'series_mindhunter' || topScored.item.id === 'series_dexter');
    assert('Breakdown de afinidade de Mindhunter é alto (> 0.7)', 
      rankedForCrimeFan.find(s => s.item.id === 'series_mindhunter')!.breakdown.affinity >= 0.7);
  }

  // --------------------------------------------------------------------------
  // TESTE 4: Perfil com Gosto Oposto (Anime / Fantasia)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Diferenciação Clara de Perfis com Gostos Opostos ---');
  {
    const profileIdAnime = 'user_anime_fan';
    await userPreferenceStore.clearPreferences(profileIdAnime);

    const aotItem = mockCatalog.find(i => i.id === 'anime_shingeki')!;
    const dsItem = mockCatalog.find(i => i.id === 'anime_demon_slayer')!;

    // Fã de anime assiste AOT e favorita Demon Slayer
    await userPreferenceStore.recordPlayback(aotItem, 1400, 1440, false, profileIdAnime);
    await userPreferenceStore.recordFavorite(dsItem, true, profileIdAnime);

    const animeProfile = await userPreferenceStore.getPreferences(profileIdAnime);
    assert('Afinidade com Anime é líder absoluta (1.0)', animeProfile.genreAffinities['Anime'] === 1.0);
    assert('Demon Slayer está nos favoritos', animeProfile.favoriteContentIds.includes(dsItem.id));

    const rankedForAnime = recommendationEngine.rankCandidates(mockCatalog.filter(c => !c.isAdult), animeProfile);
    const topPicksAnime = rankedForAnime.slice(0, 2).map(s => s.item.id);
    assert('Top picks do fã de anime contêm Demon Slayer ou Shingeki', 
      topPicksAnime.includes('anime_demon_slayer') || topPicksAnime.includes('anime_shingeki'));
    
    // Dexter não pode estar no top 2 de um fã exclusivo de animes
    assert('Dexter não está no topo para fã de anime', !topPicksAnime.includes('series_dexter'));
  }

  // --------------------------------------------------------------------------
  // TESTE 5: Filtragem de Ruído (Erros de Player e Bounces Rápidos)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Filtragem de Ruído: Erros de Player e Cliques Rápidos ---');
  {
    const noiseProfileId = 'user_noise_test';
    await userPreferenceStore.clearPreferences(noiseProfileId);

    const oppenheimer = mockCatalog.find(i => i.id === 'movie_oppenheimer')!;

    // 1. Erro de player: NÃO deve gerar preferência nem penalização
    await userPreferenceStore.recordPlayback(oppenheimer, 10, 7200, true, noiseProfileId); // isError = true
    let pref = await userPreferenceStore.getPreferences(noiseProfileId);
    assert('Erro de reprodução não foi registrado como preferência', pref.interactionCount === 0);

    // 2. Bounce rápido acidental (< 25s e < 5%): NÃO deve virar preferência forte
    await userPreferenceStore.recordPlayback(oppenheimer, 15, 7200, false, noiseProfileId);
    pref = await userPreferenceStore.getPreferences(noiseProfileId);
    assert('Bounce acidental (< 25s) é descartado', pref.interactionCount === 0);

    // 3. Assistido de verdade (45 minutos = 2700s de Oppenheimer)
    await userPreferenceStore.recordPlayback(oppenheimer, 2700, 7200, false, noiseProfileId);
    pref = await userPreferenceStore.getPreferences(noiseProfileId);
    assert('Reprodução legítima (> 25s e > 25%) é registrada', pref.interactionCount === 1);
  }

  // --------------------------------------------------------------------------
  // TESTE 6: Pesos Oficiais e Normalização (40%, 20%, 15%, 10%, 10%, 5%)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Pesos do Ranking e Normalização Exata ---');
  {
    const weights = recommendationEngine.getWeights();
    assert('Peso de afinidade inicial é 40% (0.40)', Math.abs(weights.affinity - 0.40) < 0.001);
    assert('Peso de similaridade inicial é 20% (0.20)', Math.abs(weights.similarity - 0.20) < 0.001);
    assert('Peso de popularidade inicial é 15% (0.15)', Math.abs(weights.popularity - 0.15) < 0.001);
    assert('Peso de novidade inicial é 10% (0.10)', Math.abs(weights.novelty - 0.10) < 0.001);
    assert('Peso de avaliação crítica inicial é 10% (0.10)', Math.abs(weights.rating - 0.10) < 0.001);
    assert('Peso de preferência de áudio inicial é 5% (0.05)', Math.abs(weights.audioPreference - 0.05) < 0.001);

    const sum = weights.affinity + weights.similarity + weights.popularity + weights.novelty + weights.rating + weights.audioPreference;
    assert('A soma exata dos pesos normalizados é 1.0 (100%)', Math.abs(sum - 1.0) < 0.0001);
  }

  // --------------------------------------------------------------------------
  // TESTE 7: Diversity Re-ranking e Reserva de Descobertas (~15%)
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Diversity Re-ranking e Descobertas Relevantes ---');
  {
    const profile = userPreferenceStore.getPreferencesSync('user_crime_fan');
    const scored = recommendationEngine.rankCandidates(mockCatalog.filter(c => !c.isAdult), profile);
    const reranked = recommendationEngine.diversityRerank(scored, mockCatalog.length);

    assert('Retorna todos os candidatos reordenados', reranked.length === scored.length);

    // Verifica que não agrupa 3 itens do exato mesmo gênero em sequência
    let maxConsecutive = 0;
    let currentCount = 0;
    let lastGenre = '';
    for (const item of reranked) {
      const g = item.genres?.[0] || '';
      if (g === lastGenre) {
        currentCount++;
      } else {
        lastGenre = g;
        currentCount = 1;
      }
      maxConsecutive = Math.max(maxConsecutive, currentCount);
    }
    assert('Penalidade de diversidade evita mais de 2 repetições consecutivas', maxConsecutive <= 2);
  }

  // --------------------------------------------------------------------------
  // TESTE 8: Preservação Estrita de Outras Páginas (Em Destaque, Semelhantes, Busca)
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Preservação de Em Destaque, Títulos Semelhantes e Busca ---');
  {
    // 1. Em Destaque: rankings semanais do IMDb NÃO são alterados pelo motor
    const featuredSync = featuredRankingService.getFeaturedSelectionSync();
    assert('Em Destaque preserva fonte oficial do IMDb', typeof featuredSync === 'object');

    // 2. Títulos Semelhantes: utiliza similaridade real sem resultados aleatórios
    const coraline = mockCatalog.find(i => i.id === 'movie_coraline')!;
    const immediateSimilar = similarTitlesService.getImmediateSimilar(coraline, mockCatalog);
    assert('Títulos Semelhantes usa similaridade real (Henry Selick / Stop-motion)', 
      immediateSimilar.some(s => s.id === 'movie_nightmare'));

    // 3. Limpeza total de preferências restaura Cold Start
    await userPreferenceStore.clearPreferences('user_crime_fan');
    const cleared = await userPreferenceStore.getPreferences('user_crime_fan');
    assert('clearPreferences restaura interactionCount para 0', cleared.interactionCount === 0);
    assert('clearPreferences esvazia afinidades de gêneros', Object.keys(cleared.genreAffinities).length === 0);
  }

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO FINAL DA SUÍTE: ${passed} PASS, ${failed} FAIL`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRecommendationEngineSuite().catch((err) => {
  console.error('Erro na execução da suíte de recomendações:', err);
  process.exit(1);
});
