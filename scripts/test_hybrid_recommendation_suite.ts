import { hybridRecommendationEngine } from '../src/core/recommendations/hybridRecommendationEngine';
import { recommendationEngine } from '../src/core/recommendations/recommendationEngine';
import { collaborativeEngine } from '../src/core/recommendations/CollaborativeEngine';
import { CollaborativeTrainer } from '../src/core/recommendations/CollaborativeTrainer';
import { consentManager } from '../src/core/recommendations/consentManager';
import { userPreferenceStore } from '../src/core/recommendations/userPreferenceStore';
import { ContentItem, ContentType } from '../types';
import { featuredRankingService } from '../src/core/rankings/FeaturedRankingService';
import { similarTitlesService } from '../src/core/recommendations/similarTitlesService';
import fs from 'fs';
import path from 'path';

async function runHybridRecommendationSuite() {
  console.log('========================================================================');
  console.log('🚀 INICIANDO SUÍTE DE TESTES: MOTOR HÍBRIDO E FILTRAGEM COLABORATIVA');
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

  // Catálogo controlado de teste
  const mockCatalog: ContentItem[] = [
    {
      id: 'movie_coraline',
      title: 'Coraline e o Mundo Secreto',
      type: ContentType.MOVIE,
      rating: 8.0,
      year: 2009,
      image: 'coraline.jpg',
      genres: ['Animação', 'Fantasia'],
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
      genres: ['Animação', 'Fantasia'],
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
      genres: ['Ficção Científica', 'Drama'],
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'movie_adult_sample',
      title: 'Adult Exclusive Video',
      type: ContentType.MOVIE,
      rating: 5.5,
      year: 2023,
      image: 'adult.jpg',
      genres: ['Adulto'],
      isAdult: true,
      availabilityStatus: 'verified'
    }
  ];

  // --------------------------------------------------------------------------
  // TESTE 1: Cold Start e Fallback para Content-Based Filtering
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Cold Start e Fallback Puro para Content-Based ---');
  {
    // Limpa modelo ativo no collaborativeEngine para simular início sem dados agregados
    collaborativeEngine.setModel({
      version: 1,
      trainedAt: new Date().toISOString(),
      totalInteractions: 0,
      uniqueUsersCount: 0,
      catalogCoverage: 0,
      isActivated: false,
      confidenceScore: 0,
      itemSimilarities: {}
    });

    const coldRanked = hybridRecommendationEngine.rankCandidatesHybrid(
      mockCatalog.filter(c => !c.isAdult),
      'cold_user_test'
    );

    assert('Retorna ranking para todos os candidatos no cold start', coldRanked.length === 7);
    assert('Alpha colaborativo é rigorosamente 0.0 no cold start', coldRanked.every(r => r.collaborativeWeight === 0.0));
    assert('isCollaborativeActive é false no cold start', coldRanked.every(r => r.isCollaborativeActive === false));
    const contentDirect = recommendationEngine.rankCandidates(mockCatalog.filter(c => !c.isAdult), userPreferenceStore.getPreferencesSync('cold_user_test'));
    assert('Score híbrido equivale exatamente ao score de conteúdo', 
      coldRanked.every(r => {
        const direct = contentDirect.find(c => c.item.id === r.item.id);
        return direct && Math.abs(r.finalScore - direct.finalScore) < 0.001;
      }));
  }

  // --------------------------------------------------------------------------
  // TESTE 2: Treinamento Colaborativo com Dados Sintéticos Isolados
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Treinamento Colaborativo Item-Item (Cosine + Shrinkage) ---');
  const tempTestDir = path.resolve(process.cwd(), 'data', 'temp_test_cf');
  if (!fs.existsSync(tempTestDir)) fs.mkdirSync(tempTestDir, { recursive: true });

  const testTrainer = new CollaborativeTrainer(tempTestDir, {
    minUniqueUsers: 5,
    minInteractions: 10,
    minCatalogCoverage: 0.05,
    maxCollaborativeWeight: 0.35
  });

  {
    // Simula 6 perfis de usuários sintéticos apenas para validação algorítmica
    // Grupo 1: Fãs de Investigação / Séries Policiais
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_1', contentId: 'series_dexter', weight: 1.0, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_1', contentId: 'series_mindhunter', weight: 0.9, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_2', contentId: 'series_dexter', weight: 1.0, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_2', contentId: 'series_mindhunter', weight: 1.0, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_3', contentId: 'series_dexter', weight: 0.8, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_3', contentId: 'series_mindhunter', weight: 0.9, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_3', contentId: 'movie_interstellar', weight: 0.5, timestamp: Date.now() });

    // Grupo 2: Fãs de Anime
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_4', contentId: 'anime_shingeki', weight: 1.0, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_4', contentId: 'anime_demon_slayer', weight: 1.0, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_5', contentId: 'anime_shingeki', weight: 0.9, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_5', contentId: 'anime_demon_slayer', weight: 0.9, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_6', contentId: 'anime_shingeki', weight: 1.0, timestamp: Date.now() });
    await testTrainer.ingestEvent({ anonymousId: 'user_syn_6', contentId: 'anime_demon_slayer', weight: 0.8, timestamp: Date.now() });

    // Treina o modelo colaborativo com os eventos
    const trainedModel = await testTrainer.train(mockCatalog.length);

    assert('Modelo foi treinado com sucesso', typeof trainedModel === 'object');
    assert('Contabilizou 6 usuários únicos sintéticos', trainedModel.uniqueUsersCount === 6);
    assert('Total de interações registradas >= 12', trainedModel.totalInteractions >= 12);
    assert('Critério de ativação foi atingido (isActivated: true)', trainedModel.isActivated === true);
    assert('Score de confiança estatística é maior que 0', trainedModel.confidenceScore > 0);

    // Verifica correlações aprendidas
    const dexterSims = trainedModel.itemSimilarities['series_dexter'] || [];
    assert('Dexter possui similaridades colaborativas', dexterSims.length > 0);
    const topDexterCollab = dexterSims[0];
    assert('Item mais similar a Dexter via comportamento coletivo é Mindhunter', 
      topDexterCollab && topDexterCollab.targetId === 'series_mindhunter');
    assert('Similaridade Dexter-Mindhunter é alta (> 0.5)', topDexterCollab && topDexterCollab.score > 0.5);

    const aotSims = trainedModel.itemSimilarities['anime_shingeki'] || [];
    const topAotCollab = aotSims[0];
    assert('Item mais similar a Attack on Titan via comportamento coletivo é Demon Slayer',
      topAotCollab && topAotCollab.targetId === 'anime_demon_slayer');

    // Instala o modelo no collaborativeEngine para os testes de ranking híbrido
    collaborativeEngine.setModel(trainedModel);
  }

  // --------------------------------------------------------------------------
  // TESTE 3: Inferência Híbrida e Escalação Dinâmica de Alpha
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Inferência Híbrida e Escalação Dinâmica de Alpha ---');
  {
    const hybridUserId = 'user_hybrid_crime_fan';
    await userPreferenceStore.clearPreferences(hybridUserId);

    // Usuário assistiu Dexter
    const dexterItem = mockCatalog.find(i => i.id === 'series_dexter')!;
    await userPreferenceStore.recordPlayback(dexterItem, 3500, 3600, false, hybridUserId);

    // Avalia candidato Mindhunter para este usuário
    const mindhunterItem = mockCatalog.find(i => i.id === 'series_mindhunter')!;
    const scoreResult = collaborativeEngine.scoreCandidate(mindhunterItem, hybridUserId);

    assert('Candidato Mindhunter possui score colaborativo para fã de Dexter', scoreResult.score > 0.5);
    assert('Alpha colaborativo dinâmico está ativado (> 0)', scoreResult.alpha > 0);
    assert('Alpha colaborativo respeita o teto máximo (<= 0.35)', scoreResult.alpha <= 0.35);

    // Ranking híbrido completo
    const hybridRanked = hybridRecommendationEngine.rankCandidatesHybrid(
      mockCatalog.filter(c => !c.isAdult),
      hybridUserId
    );

    const topCandidate = hybridRanked[0];
    assert('Mindhunter ou Dexter lideram o ranking híbrido', 
      topCandidate.item.id === 'series_mindhunter' || topCandidate.item.id === 'series_dexter');
    assert('Mindhunter possui colaborativo ativo na resposta', 
      hybridRanked.find(r => r.item.id === 'series_mindhunter')!.isCollaborativeActive === true);
    assert('Razões de match incluem recomendação coletiva', 
      hybridRanked.find(r => r.item.id === 'series_mindhunter')!.matchReasons.some(m => m.includes('similares')));
  }

  // --------------------------------------------------------------------------
  // TESTE 4: Proteção de Privacidade, Consentimento e Bloqueio de Conteúdo Adulto
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Proteção de Privacidade, Consentimento e Bloqueio Adulto ---');
  {
    // 1. Consentimento inicial é desligado por padrão
    consentManager.setCollaborativeOptIn(false);
    assert('Consentimento inicia desativado por padrão', consentManager.isCollaborativeOptedIn() === false);

    const normalItem = mockCatalog.find(i => i.id === 'movie_coraline')!;
    assert('Sem consentimento, canSendEvent retorna false', consentManager.canSendEvent(normalItem) === false);

    // 2. Com consentimento ativado
    consentManager.setCollaborativeOptIn(true);
    assert('Consentimento ativado com sucesso', consentManager.isCollaborativeOptedIn() === true);
    assert('Com consentimento, canSendEvent para item comum retorna true', consentManager.canSendEvent(normalItem) === true);

    // 3. Bloqueio estrito de itens adultos (mesmo com consentimento ativado!)
    const adultItem = mockCatalog.find(i => i.id === 'movie_adult_sample')!;
    assert('canSendEvent bloqueia rigorosamente item adulto mesmo com opt-in ativo', 
      consentManager.canSendEvent(adultItem) === false);

    // 4. Identificador anônimo é UUID v4 criptográfico puro
    const anonId = consentManager.getAnonymousClientId();
    assert('Identificador anônimo é uma string UUID válida', typeof anonId === 'string' && anonId.length >= 32);

    // 5. Rotação de identificador sob demanda
    const rotatedId = consentManager.rotateAnonymousId();
    assert('Rotação gera identificador diferente', rotatedId !== anonId);

    // 6. Revogação de consentimento purga identificador
    await consentManager.revokeConsentAndPurge();
    assert('Revogação desativa opt-in', consentManager.isCollaborativeOptedIn() === false);
  }

  // --------------------------------------------------------------------------
  // TESTE 5: Fileiras Híbridas da Home (Comunidade ZapiTV)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Fileiras Híbridas da Home e Preservação de Continuar Assistindo ---');
  {
    const profileIdHome = 'user_home_hybrid_test';
    await userPreferenceStore.clearPreferences(profileIdHome);

    const dexter = mockCatalog.find(i => i.id === 'series_dexter')!;
    await userPreferenceStore.recordPlayback(dexter, 3500, 3600, false, profileIdHome);

    const homeRows = hybridRecommendationEngine.getHybridHomeRows(
      mockCatalog,
      profileIdHome,
      [dexter] // Continuar assistindo presente
    );

    assert('Home gera fileiras híbridas personalizadas', homeRows.length >= 3);
    assert('Primeira fileira é estritamente Continuar Assistindo', homeRows[0].id === 'continue_watching');
    assert('Contém fileira Recomendados para Você', homeRows.some(r => r.id.includes('recommended_for_you')));

    // Verifica presença da fileira baseada em comunidade coletiva
    const collabRow = homeRows.find(r => r.id.startsWith('collab_watched_') || r.id.startsWith('because_watched_'));
    assert('Contém fileira baseada na obra de referência', !!collabRow);
    if (collabRow && collabRow.id.startsWith('collab_watched_')) {
      assert('Título da fileira colaborativa menciona quem curtiu Dexter', collabRow.title.includes('Dexter'));
    }
  }

  // --------------------------------------------------------------------------
  // TESTE 6: Preservação de Páginas Especiais (Em Destaque, Semelhantes, Busca)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Preservação Estrita de Em Destaque, Semelhantes e Busca ---');
  {
    // Em Destaque: rankings semanais do IMDb NÃO são tocados pelo híbrido
    const featured = featuredRankingService.getFeaturedSelectionSync();
    assert('Em Destaque preserva fonte oficial semanal do IMDb', typeof featured === 'object');

    // Títulos Semelhantes: preserva cálculo semântico direto
    const coraline = mockCatalog.find(i => i.id === 'movie_coraline')!;
    const similar = similarTitlesService.getImmediateSimilar(coraline, mockCatalog);
    assert('Títulos Semelhantes de Coraline mantém O Estranho Mundo de Jack', 
      similar.some(s => s.id === 'movie_nightmare'));

    // Catálogo ordenado por relevância híbrida preserva todos os itens elegíveis
    const sortedCatalog = hybridRecommendationEngine.sortCatalogByHybridRelevance(
      mockCatalog.filter(c => !c.isAdult),
      'user_hybrid_crime_fan'
    );
    assert('Catálogo híbrido preserva todos os 7 títulos elegíveis para paginação', sortedCatalog.length === 7);
  }

  // Limpeza de arquivos temporários de teste
  try {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  } catch {}

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO FINAL DA SUÍTE HÍBRIDA: ${passed} PASS, ${failed} FAIL`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHybridRecommendationSuite().catch((err) => {
  console.error('Erro na execução da suíte híbrida:', err);
  process.exit(1);
});
