/**
 * ZapiTV - HybridRecommendationEngine
 * Motor Híbrido de Recomendações Personalizadas:
 * 1. Combina Content-Based Filtering (afinidade, temas, sinopse, franquia)
 *    com Collaborative Filtering Item-Item (padrões implícitos coletivos)
 * 2. Transição dinâmica e contínua do peso colaborativo alpha [0.0 a 0.35]
 *    baseada na confiança estatística e cobertura do catálogo
 * 3. Cold Start perfeito: opera 100% em Content-Based quando não houver dados coletivos suficientes
 * 4. Re-ranking de diversidade e anti-clustering com 15% reservado para descobertas
 * 5. Fileiras ricas na Home e ordenação personalizada em Filmes, Séries e Animes
 */

import { ContentItem } from '../../../types';
import { recommendationEngine, isAnimationOrKidsContent } from './recommendationEngine';
import { collaborativeEngine } from './CollaborativeEngine';
import { userPreferenceStore } from './userPreferenceStore';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../catalog/catalogDeduplication';
import { searchService } from '../search/searchService';
import {
  PersonalizedRow,
  ScoredCandidate,
  RankingOptions
} from './recommendationTypes';

export interface HybridScoredCandidate extends ScoredCandidate {
  collaborativeScore: number;
  collaborativeWeight: number; // alpha aplicado
  isCollaborativeActive: boolean;
}

export class HybridRecommendationEngine {
  private cache: Map<string, { timestamp: number; items: ContentItem[]; rows?: PersonalizedRow[] }> = new Map();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de estabilidade de sessão
  private currentVersion = 1;

  public invalidateCache(): void {
    this.cache.clear();
    this.currentVersion++;
    recommendationEngine.invalidateCache();
  }

  /**
   * Pontua candidatos através da fusão híbrida:
   * Score = (1 - alpha) * Score_content + alpha * Score_collab
   */
  public rankCandidatesHybrid(
    candidates: ContentItem[],
    profileId: string = 'default',
    options: RankingOptions = {}
  ): HybridScoredCandidate[] {
    const profile = userPreferenceStore.getPreferencesSync(profileId);
    if (options.isChild !== undefined) {
      profile.isChild = options.isChild;
    }
    
    // 1. Obter pontuação base baseada em conteúdo (Content-Based) com opções de ranking
    const contentScored = recommendationEngine.rankCandidates(candidates, profile, undefined, options);

    const hybridResults: HybridScoredCandidate[] = [];

    for (const sc of contentScored) {
      // 2. Avaliar pontuação colaborativa e alpha dinâmico
      const collabResult = collaborativeEngine.scoreCandidate(sc.item, profileId);
      const alpha = collabResult.alpha; // 0.0 em cold start ou até 0.35 quando ativo
      const collabScore = collabResult.score;

      let finalScore = alpha > 0
        ? Math.round((((1 - alpha) * sc.finalScore) + (alpha * collabScore)) * 1000) / 1000
        : sc.finalScore;

      // Requisito 4: No perfil padrão, a influência colaborativa não deve sobrepujar a regra de live-action
      if (!options.isChild && !options.isExplicitAnimationFilter && isAnimationOrKidsContent(sc.item) && (options.category === 'movies' || options.category === 'series' || options.category === 'all')) {
        finalScore = Math.min(finalScore, sc.finalScore);
      }

      const reasons = [...(sc.matchReasons || [])];
      if (alpha > 0 && collabResult.isCoOccurrent) {
        reasons.push('Popular entre usuários com gostos similares');
      }

      hybridResults.push({
        ...sc,
        finalScore,
        collaborativeScore: collabScore,
        collaborativeWeight: alpha,
        isCollaborativeActive: alpha > 0,
        matchReasons: reasons
      });
    }

    // Ordenação decrescente pela pontuação híbrida com desempate determinístico
    return hybridResults.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      return (a.item.id || '').localeCompare(b.item.id || '');
    });
  }

  /**
   * Ordena todo o catálogo elegível de uma categoria por relevância híbrida,
   * preservando 100% dos títulos acessíveis pela paginação contínua.
   */
  public sortCatalogByHybridRelevance(
    items: ContentItem[],
    profileIdOrOptions: string | { profileId?: string; genreFilter?: string; isChild?: boolean; category?: 'movies' | 'series' | 'animes' | 'all' } = 'default',
    genreFilter?: string,
    isChild: boolean = false,
    category: 'movies' | 'series' | 'animes' | 'all' = 'all'
  ): ContentItem[] {
    if (!Array.isArray(items) || items.length <= 1) return items || [];

    const profileId = typeof profileIdOrOptions === 'string' ? profileIdOrOptions : (profileIdOrOptions?.profileId || 'default');
    const effectiveGenreFilter = typeof profileIdOrOptions === 'object' ? profileIdOrOptions.genreFilter : genreFilter;
    const effectiveIsChildInput = typeof profileIdOrOptions === 'object' ? (profileIdOrOptions.isChild ?? isChild) : isChild;
    const effectiveCategory = typeof profileIdOrOptions === 'object' ? (profileIdOrOptions.category || category) : category;

    // Isolamento estrito por categoria conforme Requisito Canônico
    let cleanItems = items;
    if (effectiveCategory === 'movies') {
      cleanItems = cleanItems.filter(i => searchService.isMovieItem(i, false));
    } else if (effectiveCategory === 'series') {
      cleanItems = cleanItems.filter(i => searchService.isSeriesItem(i));
    } else if (effectiveCategory === 'animes') {
      cleanItems = cleanItems.filter(i => searchService.isAnimeItem(i));
    }

    // Filtro de gênero contextual se especificado
    if (effectiveGenreFilter && effectiveGenreFilter !== 'Todos') {
      const genreMatches = cleanItems.filter(i => i.genres?.includes(effectiveGenreFilter));
      if (genreMatches.length > 0) {
        cleanItems = genreMatches;
      }
    }

    const profile = userPreferenceStore.getPreferencesSync(profileId);
    const effectiveIsChild = effectiveIsChildInput || profile.isChild === true;

    const cacheKey = `${profileId}_${effectiveIsChild ? 'child' : 'adult'}_hybridsort_${category}_${cleanItems.length}_${genreFilter || 'all'}_v${this.currentVersion}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.items;
    }

    const isExplicitAnimationFilter = !!(genreFilter && /animação|animacao|animation|infantil/i.test(genreFilter));

    const hybridScored = this.rankCandidatesHybrid(cleanItems, profileId, {
      isChild: effectiveIsChild,
      isExplicitAnimationFilter,
      category
    });

    const reranked = recommendationEngine.diversityRerank(hybridScored, cleanItems.length, {
      isChildProfile: effectiveIsChild,
      isExplicitAnimationFilter,
      category,
      topLiveActionSlots: 16
    });

    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      items: reranked
    });

    return reranked;
  }

  /**
   * Gera as fileiras personalizadas da Home combinando sinais híbridos:
   * 1. Continuar Assistindo preservado no topo
   * 2. "Recomendados para Você" (híbrido unificado)
   * 3. Fileira Colaborativa da Comunidade ("Quem curtiu X também assistiu Y") se houver dados
   * 4. Fileira Temática / Gênero Favorito
   * 5. Aclamados pela Crítica e Em Alta
   */
  public getHybridHomeRows(
    catalog: ContentItem[],
    profileId: string = 'default',
    continueWatchingItems: ContentItem[] = [],
    isChild: boolean = false
  ): PersonalizedRow[] {
    const cacheKey = `${profileId}_${isChild ? 'child' : 'adult'}_hybridrows_${catalog.length}_cw${continueWatchingItems.length}_v${this.currentVersion}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.rows && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.rows;
    }

    const profile = userPreferenceStore.getPreferencesSync(profileId);
    if (isChild) {
      profile.isChild = true;
    }
    const allEligible = recommendationEngine.generateCandidates(catalog, profile, { category: 'all', allowAdult: false });
    const hybridScoredGlobal = this.rankCandidatesHybrid(allEligible, profileId, { isChild });

    const rows: PersonalizedRow[] = [];

    // FILEIRA 1: Continuar Assistindo (Preservação estrita se houver itens)
    if (continueWatchingItems.length > 0) {
      const validContinuity = catalogEligibilityService.filterEligibleItemsSync(continueWatchingItems);
      if (validContinuity.length > 0) {
        rows.push({
          id: 'continue_watching',
          title: 'Continuar Assistindo',
          subtitle: 'Continue de onde você parou',
          items: deduplicateContentItems(validContinuity),
          reasonType: 'continue_watching'
        });
      }
    }

    const isColdStart = profile.interactionCount === 0 || profile.totalEngagementScore <= 0.1;

    if (isColdStart) {
      // Em Cold Start, utiliza as fileiras equilibradas do RecommendationEngine
      const baseRows = recommendationEngine.getPersonalizedHomeRows(catalog, profileId, []);
      for (const r of baseRows) {
        if (r.reasonType !== 'continue_watching') {
          rows.push(r);
        }
      }
    } else {
      // -------------------------------------------------------------
      // USUÁRIO COM HISTÓRICO: Fileiras Híbridas Ponderadas
      // -------------------------------------------------------------

      // Row 1: Recomendados para Você (Picks Híbridos)
      const topPicks = recommendationEngine.diversityRerank(hybridScoredGlobal, 20);
      if (topPicks.length > 0) {
        rows.push({
          id: 'recommended_for_you_hybrid',
          title: 'Recomendados para Você',
          subtitle: 'Personalizado a partir do seu estilo e dos títulos que você mais curte',
          items: topPicks,
          reasonType: 'top_recommendations'
        });
      }

      // Row 2: Fileira Colaborativa ou "Porque você assistiu X"
      const referenceId = profile.completedContentIds[profile.completedContentIds.length - 1] ||
                          profile.watchedContentIds[profile.watchedContentIds.length - 1] ||
                          profile.favoriteContentIds[0];

      if (referenceId) {
        const referenceItem = catalog.find(i => i.id === referenceId);
        if (referenceItem) {
          const model = collaborativeEngine.getModel();
          const hasCollabLinks = model && model.isActivated && model.itemSimilarities[referenceId]?.length > 0;

          if (hasCollabLinks) {
            // Títulos co-recorrentes colaborativos da comunidade
            const targetIds = new Set(model.itemSimilarities[referenceId].map(t => t.targetId));
            const collabCandidates = hybridScoredGlobal.filter(sc => targetIds.has(sc.item.id) && sc.item.id !== referenceId);
            const collabRowItems = recommendationEngine.diversityRerank(collabCandidates, 18);

            if (collabRowItems.length >= 2) {
              rows.push({
                id: `collab_watched_${referenceItem.id}`,
                title: `Quem curtiu ${referenceItem.title} também assistiu`,
                subtitle: 'Descobertas baseadas em padrões coletivos de quem tem gosto parecido',
                items: collabRowItems,
                reasonType: 'because_you_watched',
                sourceTitle: referenceItem.title
              });
            }
          } else {
            // Fallback baseado em conteúdo
            const similarCandidates = hybridScoredGlobal.filter(sc => 
              sc.item.id !== referenceItem.id &&
              sc.item.genres?.some(g => referenceItem.genres?.includes(g))
            );
            const becauseWatched = recommendationEngine.diversityRerank(similarCandidates, 18);
            if (becauseWatched.length >= 3) {
              rows.push({
                id: `because_watched_${referenceItem.id}`,
                title: `Porque você assistiu ${referenceItem.title}`,
                subtitle: 'Títulos com narrativa, atmosfera e temas semelhantes',
                items: becauseWatched,
                reasonType: 'because_you_watched',
                sourceTitle: referenceItem.title
              });
            }
          }
        }
      }

      // Row 3: Gênero de maior afinidade do usuário
      const sortedAffinities = Object.entries(profile.genreAffinities)
        .sort((a, b) => b[1] - a[1])
        .filter(([genre, score]) => score > 0.3 && genre !== 'Adulto');

      if (sortedAffinities.length > 0) {
        const [topGenre] = sortedAffinities[0];
        const genreCandidates = hybridScoredGlobal.filter(sc => sc.item.genres?.includes(topGenre));
        const genrePicks = recommendationEngine.diversityRerank(genreCandidates, 18);
        if (genrePicks.length >= 3) {
          rows.push({
            id: `top_genre_${topGenre.toLowerCase().replace(/\s+/g, '_')}`,
            title: `Seu Gosto: ${topGenre}`,
            subtitle: `As melhores produções de ${topGenre.toLowerCase()} para seu perfil`,
            items: genrePicks,
            reasonType: 'genre_affinity'
          });
        }
      }

      // Row 4: Aclamados pela Crítica
      const topRated = recommendationEngine.diversityRerank(
        hybridScoredGlobal.filter(sc => sc.item.rating >= 8.0),
        18
      );
      if (topRated.length > 0) {
        rows.push({
          id: 'critically_acclaimed',
          title: 'Aclamados pela Crítica',
          subtitle: 'Histórias premiadas com excelência de avaliação',
          items: topRated,
          reasonType: 'critically_acclaimed'
        });
      }

      // Row 5: Em Alta no ZapiTV
      const trendingPool = hybridScoredGlobal.filter(sc => sc.item.isFeatured || (sc.item.imdbRank && sc.item.imdbRank <= 50));
      const trending = recommendationEngine.diversityRerank(
        trendingPool.length > 0 ? trendingPool : hybridScoredGlobal.slice(0, 18),
        18
      );
      if (trending.length > 0) {
        rows.push({
          id: 'trending_personalized',
          title: 'Em Alta no ZapiTV',
          subtitle: 'Os títulos mais procurados pela comunidade',
          items: trending,
          reasonType: 'trending'
        });
      }
    }

    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      items: [],
      rows
    });

    return rows;
  }
}

export const hybridRecommendationEngine = new HybridRecommendationEngine();
