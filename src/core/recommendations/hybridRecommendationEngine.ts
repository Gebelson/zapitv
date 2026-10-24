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
import { editorialCuratorService } from './editorialCuratorService';
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
    editorialCuratorService.invalidateCache();
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
    isChild: boolean = false,
    customSections: any[] = []
  ): PersonalizedRow[] {
    return editorialCuratorService.buildHomeEditorialRows(
      catalog,
      profileId,
      continueWatchingItems,
      isChild,
      customSections
    );
  }
}

export const hybridRecommendationEngine = new HybridRecommendationEngine();
