/**
 * ZapiTV - RecommendationEngine
 * Motor profissional de recomendações personalizadas inspirado na arquitetura de sistemas como Netflix:
 * 1. Candidate Generation: seleção de candidatos do acervo validado por afinidade, similaridade, histórico e popularidade
 * 2. Personalized Ranking: pontuação com pesos configuráveis (afinidade 40%, similaridade 20%, popularidade 15%, novidade 10%, avaliação 10%, áudio 5%)
 * 3. Diversity Re-ranking: eliminação de clusters repetitivos de mesmo gênero/franquia + reserva de 15% para descobertas relevantes
 * 4. Cold Start: suporte refinado para novos usuários sem histórico prévio (popularidade, novidade, diversidade e alta avaliação)
 * 5. Caching de alta performance: estabilidade durante a navegação sem recomputações pesadas a cada render
 */

import { ContentItem, ContentType } from '../../../types';
import {
  RankingWeights,
  DEFAULT_RANKING_WEIGHTS,
  ScoredCandidate,
  CandidateGenerationOptions,
  RankingOptions,
  DiversityOptions,
  PersonalizedRow,
  UserPreferenceProfile
} from './recommendationTypes';
import { userPreferenceStore } from './userPreferenceStore';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { adultContentService } from '../adult/AdultContentService';
import { deduplicateContentItems } from '../catalog/catalogDeduplication';
import { searchService } from '../search/searchService';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';

/**
 * Detecta de forma canônica se uma obra é animação, desenho animado ou conteúdo infantil/família.
 */
export function isAnimationOrKidsContent(item: ContentItem): boolean {
  if (!item) return false;

  // 1. Verificação por gênero
  const animKidsRegex = /animação|animacao|animation|desenho|infantil|kids|criança|crianca|children/i;
  if (item.genres && Array.isArray(item.genres)) {
    if (item.genres.some(g => typeof g === 'string' && animKidsRegex.test(g))) {
      return true;
    }
  }

  // 2. Tipo ANIME ou gênero Anime
  if (item.type === ContentType.ANIME) {
    return true;
  }
  if (item.genres?.some(g => typeof g === 'string' && g.toLowerCase() === 'anime')) {
    return true;
  }

  // 3. Padrões textuais no título ou sinopse
  const title = (item.title || '').toLowerCase();
  const desc = (item.description || item.synopsis || '').toLowerCase();
  const orig = (item.originalTitle || '').toLowerCase();

  const textMarkers = [
    /\bdesenho animado\b/i,
    /\bsérie de animação\b/i,
    /\bserie de animacao\b/i,
    /\banimação infantil\b/i,
    /\banimacao infantil\b/i,
    /\banimated series\b/i,
    /\bcartoon\b/i
  ];

  if (textMarkers.some(re => re.test(title) || re.test(desc) || re.test(orig))) {
    return true;
  }

  return false;
}

export class RecommendationEngine {
  private weights: RankingWeights = { ...DEFAULT_RANKING_WEIGHTS };
  private cache: Map<string, { timestamp: number; items: ContentItem[]; rows?: PersonalizedRow[] }> = new Map();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de estabilidade
  private currentVersion = 1;

  constructor() {
    this.normalizeWeights();
  }

  /**
   * Permite ajustar os pesos do ranking de forma dinâmica.
   */
  public setWeights(newWeights: Partial<RankingWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
    this.normalizeWeights();
    this.invalidateCache();
  }

  /**
   * Retorna os pesos ativos.
   */
  public getWeights(): RankingWeights {
    return { ...this.weights };
  }

  /**
   * Garante que a soma de todos os pesos seja exatamente 1.0 (100%).
   */
  private normalizeWeights(): void {
    const sum =
      this.weights.affinity +
      this.weights.similarity +
      this.weights.popularity +
      this.weights.novelty +
      this.weights.rating +
      this.weights.audioPreference;

    if (sum > 0) {
      this.weights.affinity = this.weights.affinity / sum;
      this.weights.similarity = this.weights.similarity / sum;
      this.weights.popularity = this.weights.popularity / sum;
      this.weights.novelty = this.weights.novelty / sum;
      this.weights.rating = this.weights.rating / sum;
      this.weights.audioPreference = this.weights.audioPreference / sum;
    }
  }

  /**
   * Invalida o cache quando ocorrem mudanças significativas (interação, limpeza de perfil, etc).
   */
  public invalidateCache(): void {
    this.cache.clear();
    this.currentVersion++;
  }

  // ============================================================================
  // ETAPA 1: CANDIDATE GENERATION
  // ============================================================================

  /**
   * Seleciona candidatos do catálogo validado com disponibilidade confirmada.
   */
  public generateCandidates(
    catalog: ContentItem[],
    profile: UserPreferenceProfile,
    options: CandidateGenerationOptions = {}
  ): ContentItem[] {
    if (!Array.isArray(catalog) || catalog.length === 0) return [];

    const {
      category = 'all',
      genreFilter,
      excludeContentIds = [],
      allowAdult = false
    } = options;

    const excludeSet = new Set(excludeContentIds);

    // 1. Filtrar elegibilidade real do catálogo do ZapiTV (fontes válidas, sem obras em cartaz)
    const eligibleItems = catalogEligibilityService.filterEligibleItemsSync(catalog, { allowAdult });

    return eligibleItems.filter(item => {
      if (!item || !item.id) return false;
      if (bannedContentRegistry.isBanned(item)) return false;
      if (excludeSet.has(item.id)) return false;

      // Isolamento de categoria
      if (category !== 'all') {
        if (item.type !== category) return false;
      }

      // Filtro de gênero opcional
      if (genreFilter && genreFilter !== 'Todos') {
        if (genreFilter === 'Adulto') {
          if (!adultContentService.isAdultContent(item)) return false;
        } else {
          if (!item.genres?.includes(genreFilter)) return false;
        }
      }

      // Isolamento rigoroso de conteúdo adulto se não explicitamente autorizado
      if (!allowAdult && adultContentService.isAdultContent(item)) {
        return false;
      }

      return true;
    });
  }

  // ============================================================================
  // ETAPA 2: PERSONALIZED RANKING
  // ============================================================================

  /**
   * Pontua cada candidato com os fatores normalizados (0 a 1) e aplica os pesos oficiais.
   */
  public rankCandidates(
    candidates: ContentItem[],
    profile: UserPreferenceProfile,
    customWeights?: Partial<RankingWeights>,
    options: RankingOptions = {}
  ): ScoredCandidate[] {
    const w = customWeights ? { ...this.weights, ...customWeights } : this.weights;
    const isColdStart = profile.interactionCount === 0 || profile.totalEngagementScore <= 0.1;
    const isChild = options.isChild === true || profile.isChild === true;
    const isExplicitAnimFilter = options.isExplicitAnimationFilter === true;
    const isGeneralCatalog = options.category === 'movies' || options.category === 'series' || options.category === 'all' || !options.category;

    const scored: ScoredCandidate[] = [];

    // Conjuntos de referência para cálculo rápido
    const completedSet = new Set(profile.completedContentIds);
    const watchedSet = new Set(profile.watchedContentIds);
    const favoriteSet = new Set(profile.favoriteContentIds);

    const currentYear = new Date().getFullYear();

    for (const item of candidates) {
      const matchReasons: string[] = [];
      const isAnimOrKids = isAnimationOrKidsContent(item);

      // 1. Fator Afinidade (A) - [0, 1]
      let affinity = 0.5; // Baseline neutro para novos usuários
      if (!isColdStart) {
        let genreScoreSum = 0;
        let matchedGenreCount = 0;
        if (item.genres && Array.isArray(item.genres)) {
          for (const g of item.genres) {
            const val = profile.genreAffinities[g];
            if (val !== undefined && val > 0) {
              genreScoreSum += val;
              matchedGenreCount++;
              if (val >= 0.7) {
                matchReasons.push(`Gênero favorito: ${g}`);
              }
            }
          }
        }

        const genreFactor = matchedGenreCount > 0 ? (genreScoreSum / matchedGenreCount) : 0.1;

        // Bônus por diretor ou criador
        let directorFactor = 0;
        if (item.director && profile.directorAffinities[item.director]) {
          directorFactor = profile.directorAffinities[item.director];
          matchReasons.push(`Criador: ${item.director}`);
        }

        // Bônus por tipo preferido (Filme vs Série vs Anime)
        const typeFactor = profile.typeAffinities[item.type] || 0.5;

        affinity = Math.min(1.0, (genreFactor * 0.7) + (directorFactor * 0.2) + (typeFactor * 0.1));

        // Requisito 4: Personalização: não permita que o algoritmo favoreça automaticamente animações no catálogo geral.
        // No perfil padrão em catálogos gerais (sem filtro explícito de animação), atenua a afinidade para animações
        // para impedir que o histórico pessoal alavanque animações para o topo de Filmes e Séries.
        if (!isChild && !isExplicitAnimFilter && isGeneralCatalog && isAnimOrKids) {
          affinity = Math.min(affinity, 0.40);
        }
      }

      // 2. Fator Similaridade com histórico recente (S) - [0, 1]
      let similarity = 0.5;
      if (!isColdStart) {
        if (favoriteSet.has(item.id)) {
          similarity = 0.95;
          matchReasons.push('Na sua lista de favoritos');
        } else if (completedSet.has(item.id)) {
          similarity = 0.75; // Já assistiu e concluiu
        } else {
          // Verificar overlap com itens assistidos
          let maxOverlap = 0;
          for (const watchedId of profile.watchedContentIds.slice(-5)) {
            if (watchedId === item.id) continue;
            // Similaridade semântica de gênero
            const overlapCount = (item.genres || []).filter(g => profile.genreAffinities[g] && profile.genreAffinities[g] > 0.5).length;
            maxOverlap = Math.max(maxOverlap, Math.min(1.0, overlapCount * 0.35));
          }
          similarity = Math.max(0.2, maxOverlap);
        }
      }

      // 3. Fator Popularidade Recente (P) - [0, 1]
      // Baseado em dados reais do IMDb / TMDB (vote_count, rating, imdbRank)
      let popularity = 0.5;
      if (item.imdbRank && item.imdbRank > 0) {
        // Ex: rank 1-10 -> 0.95-1.0; rank 11-50 -> 0.85; rank 51-100 -> 0.70
        popularity = Math.max(0.4, 1.0 - (item.imdbRank / 150));
      } else if (item.isFeatured) {
        popularity = 0.88;
      } else if (item.rating && item.rating >= 8.0) {
        popularity = 0.80;
      } else if (item.rating && item.rating >= 7.0) {
        popularity = 0.65;
      }

      // 4. Fator Novidade / Freshness (N) - [0, 1]
      // Privilegia lançamentos recentes sem excluir clássicos
      let novelty = 0.4;
      const releaseYear = item.year || (item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : 0);
      if (releaseYear >= currentYear) {
        novelty = 1.0;
        matchReasons.push('Lançamento recente');
      } else if (releaseYear === currentYear - 1) {
        novelty = 0.9;
      } else if (releaseYear >= currentYear - 3) {
        novelty = 0.8;
      } else if (releaseYear >= currentYear - 7) {
        novelty = 0.65;
      } else if (releaseYear >= 2000) {
        novelty = 0.5;
      } else {
        novelty = 0.35;
      }

      // 5. Fator Avaliação Crítica Real (R) - [0, 1]
      // Normalizado de 0 a 10 (ex: rating 8.5 -> 0.85)
      const rating = item.rating > 0 ? Math.min(1.0, item.rating / 10) : 0.6;
      if (rating >= 0.8) {
        matchReasons.push(`Aclamação crítica: ${item.rating}`);
      }

      // 6. Fator Preferência de Áudio / Idioma (L) - [0, 1]
      let audio = 0.6;
      const status = item.audioStatus;
      if (status === 'pt-br-dubbed' || status === 'pt-br-original') {
        audio = 1.0;
      } else if (status === 'pt-br-declared' || status === 'pt-br-subtitles') {
        audio = 0.85;
      } else if (status === 'universal') {
        audio = 0.75;
      } else {
        audio = 0.5;
      }

      // Cálculo da Pontuação Final Ponderada
      let finalScore =
        (w.affinity * affinity) +
        (w.similarity * similarity) +
        (w.popularity * popularity) +
        (w.novelty * novelty) +
        (w.rating * rating) +
        (w.audioPreference * audio);

      // Requisito 1 & 2: Calibração de perfil
      if (isChild) {
        // Perfil Infantil: prioriza animações, desenhos e conteúdos infantis
        if (isAnimOrKids) {
          finalScore = Math.min(1.0, finalScore + 0.25);
          matchReasons.push('Prioritário para Perfil Infantil');
        } else {
          finalScore = finalScore * 0.85;
        }
      } else if (!isExplicitAnimFilter && isGeneralCatalog) {
        // Perfil Padrão: prioriza live-actions nas primeiras posições
        // Animações permanecem normalmente no catálogo, com pontuação calibrada
        // para que live-actions relevantes e aclamados liderem o topo
        if (isAnimOrKids) {
          finalScore = finalScore * 0.82;
        } else {
          finalScore = Math.min(1.0, finalScore * 1.05);
        }
      }

      scored.push({
        item,
        finalScore: Math.round(finalScore * 1000) / 1000,
        breakdown: {
          affinity: Math.round(affinity * 100) / 100,
          similarity: Math.round(similarity * 100) / 100,
          popularity: Math.round(popularity * 100) / 100,
          novelty: Math.round(novelty * 100) / 100,
          rating: Math.round(rating * 100) / 100,
          audio: Math.round(audio * 100) / 100
        },
        matchReasons
      });
    }

    // Ordenar decrescente pela pontuação final de forma determinística
    return scored.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      return (a.item.id || '').localeCompare(b.item.id || '');
    });
  }

  // ============================================================================
  // ETAPA 3: DIVERSITY RE-RANKING
  // ============================================================================

  /**
   * Reordena os candidatos pontuados aplicando:
   * 1. Penalidade por repetição consecutiva de mesmo gênero ou franquia
   * 2. Reserva de aproximadamente 15% para descobertas relevantes (serendipidade)
   */
  public diversityRerank(
    scoredCandidates: ScoredCandidate[],
    limit?: number,
    options: DiversityOptions = {}
  ): ContentItem[] {
    if (!scoredCandidates || scoredCandidates.length === 0) return [];

    const {
      maxConsecutiveSameGenre = 2,
      discoveryRatio = 0.15,
      isChildProfile = false,
      isExplicitAnimationFilter = false,
      category = 'all',
      topLiveActionSlots = 16
    } = options;

    const totalToSelect = limit ? Math.min(limit, scoredCandidates.length) : scoredCandidates.length;
    const isGeneralCatalog = category === 'movies' || category === 'series' || category === 'all' || !category;

    // Identificar candidatos de descoberta: alta avaliação (>= 8.0) e relevância sólida,
    // mas que pertencem a gêneros menos frequentes no topo para expandir o horizonte do usuário
    const regularPool = [...scoredCandidates];
    const discoveryPool = scoredCandidates
      .filter(sc => sc.breakdown.rating >= 0.78 && sc.finalScore >= 0.55)
      .slice(5); // Pega itens além dos primeiros colocados

    const selected: ContentItem[] = [];
    const selectedIds = new Set<string>();
    const genreHistory: string[] = [];

    // Frequência de franquias já selecionadas
    const selectedFranchises = new Map<string, number>();

    const getFranchiseKey = (item: ContentItem): string | null => {
      if (!item.title) return null;
      const clean = item.title.toLowerCase().split(/[:\-\–\—]/)[0].trim();
      return clean.length >= 4 ? clean : null;
    };

    while (selected.length < totalToSelect && regularPool.length > 0) {
      const currentIndex = selected.length;

      // Requisito 1: No perfil padrão, garantir que os primeiros slots sejam estritamente live-action
      // caso haja candidatos live-action disponíveis no catálogo
      const mustPrioritizeLiveAction = !isChildProfile && !isExplicitAnimationFilter && isGeneralCatalog &&
        currentIndex < topLiveActionSlots &&
        regularPool.some(sc => !selectedIds.has(sc.item.id) && !isAnimationOrKidsContent(sc.item));

      // Requisito 2: No perfil infantil, priorizar animações/kids nos primeiros slots
      const mustPrioritizeKids = isChildProfile && !isExplicitAnimationFilter && isGeneralCatalog &&
        currentIndex < topLiveActionSlots &&
        regularPool.some(sc => !selectedIds.has(sc.item.id) && isAnimationOrKidsContent(sc.item));

      // Verificar se esta posição deve ser uma descoberta reservada (~15% dos slots, ex: índices 3, 7, 11)
      const isDiscoverySlot = (currentIndex > 1 && currentIndex % 6 === 3) && discoveryPool.length > 0;

      let candidateScored: ScoredCandidate | null = null;
      let poolIndex = -1;

      if (isDiscoverySlot) {
        // Encontra a melhor descoberta que atenda aos requisitos do perfil
        for (let i = 0; i < discoveryPool.length; i++) {
          const disc = discoveryPool[i];
          if (!selectedIds.has(disc.item.id)) {
            const isAnim = isAnimationOrKidsContent(disc.item);
            if (mustPrioritizeLiveAction && isAnim) {
              continue; // Evita que descoberta traga animação para os primeiros slots de live-action
            }
            if (mustPrioritizeKids && !isAnim) {
              continue; // Evita que descoberta traga live-action adulto para os primeiros slots kids
            }
            candidateScored = disc;
            candidateScored.isDiscovery = true;
            discoveryPool.splice(i, 1);
            break;
          }
        }
      }

      if (!candidateScored) {
        // Seleção regular com penalidade de diversidade e priorização de perfil
        let bestCandidateScore = -Infinity;

        for (let i = 0; i < regularPool.length; i++) {
          const sc = regularPool[i];
          if (selectedIds.has(sc.item.id)) continue;

          const isAnim = isAnimationOrKidsContent(sc.item);

          // Se o slot atual exige live-action e o candidato é animação, pula enquanto houver live-action
          if (mustPrioritizeLiveAction && isAnim) {
            continue;
          }

          // Se o slot atual exige kids e o candidato não é kids/animação, pula enquanto houver kids
          if (mustPrioritizeKids && !isAnim) {
            continue;
          }

          let penalizedScore = sc.finalScore;
          const primaryGenre = sc.item.genres?.[0] || 'Outros';

          // 1. Penalidade se o mesmo gênero acabou de aparecer 2 vezes seguidas
          const recentSameGenreCount = genreHistory.slice(-maxConsecutiveSameGenre).filter(g => g === primaryGenre).length;
          if (recentSameGenreCount >= maxConsecutiveSameGenre) {
            penalizedScore *= 0.65; // Redução temporária para abrir espaço a outros gêneros
          }

          // 2. Penalidade se a mesma franquia já tem título no topo
          const franchise = getFranchiseKey(sc.item);
          if (franchise && (selectedFranchises.get(franchise) || 0) >= 1) {
            penalizedScore *= 0.70;
          }

          if (penalizedScore > bestCandidateScore) {
            bestCandidateScore = penalizedScore;
            candidateScored = sc;
            poolIndex = i;
          }
        }

        // Se nenhum candidato foi selecionado (ex: acabaram os itens do filtro prioritário), seleciona o melhor restante
        if (!candidateScored) {
          bestCandidateScore = -Infinity;
          for (let i = 0; i < regularPool.length; i++) {
            const sc = regularPool[i];
            if (selectedIds.has(sc.item.id)) continue;
            if (sc.finalScore > bestCandidateScore) {
              bestCandidateScore = sc.finalScore;
              candidateScored = sc;
              poolIndex = i;
            }
          }
        }

        if (poolIndex !== -1) {
          regularPool.splice(poolIndex, 1);
        }
      }

      if (candidateScored) {
        selected.push(candidateScored.item);
        selectedIds.add(candidateScored.item.id);

        const primaryGenre = candidateScored.item.genres?.[0] || 'Outros';
        genreHistory.push(primaryGenre);

        const franchise = getFranchiseKey(candidateScored.item);
        if (franchise) {
          selectedFranchises.set(franchise, (selectedFranchises.get(franchise) || 0) + 1);
        }
      } else {
        break;
      }
    }

    return selected;
  }

  // ============================================================================
  // ORDENAÇÃO DE CATÁLOGOS COMPLETOS (FILMES, SÉRIES, ANIMES)
  // ============================================================================

  /**
   * Ordena todo o catálogo elegível de uma categoria por relevância personalizada,
   * preservando 100% dos títulos acessíveis pela paginação infinita.
   */
  public sortCatalogByRelevance(
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
    if (effectiveIsChild) {
      profile.isChild = true;
    }

    const cacheKey = `${profileId}_${effectiveIsChild ? 'child' : 'adult'}_sort_${category}_${cleanItems.length}_${genreFilter || 'all'}_v${this.currentVersion}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.items;
    }

    const isExplicitAnimationFilter = !!(genreFilter && /animação|animacao|animation|infantil/i.test(genreFilter));

    const scored = this.rankCandidates(cleanItems, profile, undefined, {
      isChild: effectiveIsChild,
      isExplicitAnimationFilter,
      category
    });

    const reranked = this.diversityRerank(scored, cleanItems.length, {
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

  // ============================================================================
  // FILEIRAS PERSONALIZADAS DA HOME
  // ============================================================================

  /**
   * Gera a lista completa de fileiras personalizadas da Home baseada no perfil do usuário:
   * 1. Preserva estritamente "Continuar Assistindo" no topo quando houver itens
   * 2. Fileira "Recomendados para Você" (top picks multivariadas)
   * 3. Fileira dinâmica "Porque você assistiu [Título Mais Relevante]"
   * 4. Fileira do gênero de maior afinidade do usuário
   * 5. Fileira "Aclamados pela Crítica"
   * 6. Fileira "Em Alta no ZapiTV"
   * Em Cold Start (novos usuários), exibe fileiras elegantes por popularidade, diversidade e aclamação.
   */
  public getPersonalizedHomeRows(
    catalog: ContentItem[],
    profileId: string = 'default',
    continueWatchingItems: ContentItem[] = []
  ): PersonalizedRow[] {
    const cacheKey = `${profileId}_homerows_${catalog.length}_cw${continueWatchingItems.length}_v${this.currentVersion}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.rows && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.rows;
    }

    const profile = userPreferenceStore.getPreferencesSync(profileId);
    const isColdStart = profile.interactionCount === 0 || profile.totalEngagementScore <= 0.1;

    // Gerar candidatos elegíveis globais
    const allEligible = this.generateCandidates(catalog, profile, { category: 'all', allowAdult: false });
    const scoredGlobal = this.rankCandidates(allEligible, profile);

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

    if (isColdStart) {
      // -------------------------------------------------------------
      // COLD START: Novos Usuários (Popularidade, Diversidade e Qualidade)
      // -------------------------------------------------------------
      // Row 1: Em Alta no ZapiTV
      const trendingPool = scoredGlobal.filter(sc => sc.item.isFeatured || (sc.item.imdbRank && sc.item.imdbRank <= 50));
      const trendingItems = this.diversityRerank(
        trendingPool.length > 0 ? trendingPool : scoredGlobal.slice(0, 20),
        20
      );
      if (trendingItems.length > 0) {
        rows.push({
          id: 'trending_cold',
          title: 'Em Alta no ZapiTV',
          subtitle: 'Os títulos mais assistidos e comentados da semana',
          items: trendingItems,
          reasonType: 'trending'
        });
      }

      // Row 2: Filmes Populares
      const popularMovies = this.diversityRerank(
        scoredGlobal.filter(sc => sc.item.type === ContentType.MOVIE),
        20
      );
      if (popularMovies.length > 0) {
        rows.push({
          id: 'popular_movies_cold',
          title: 'Filmes Populares',
          subtitle: 'Grandes sucessos do cinema para você curtir',
          items: popularMovies,
          reasonType: 'top_recommendations'
        });
      }

      // Row 3: Séries Imperdíveis
      const popularSeries = this.diversityRerank(
        scoredGlobal.filter(sc => sc.item.type === ContentType.SERIES),
        20
      );
      if (popularSeries.length > 0) {
        rows.push({
          id: 'popular_series_cold',
          title: 'Séries Imperdíveis',
          subtitle: 'Histórias envolventes para maratonar',
          items: popularSeries,
          reasonType: 'top_recommendations'
        });
      }

      // Row 4: Animes de Sucesso
      const popularAnimes = this.diversityRerank(
        scoredGlobal.filter(sc => sc.item.type === ContentType.ANIME),
        20
      );
      if (popularAnimes.length > 0) {
        rows.push({
          id: 'popular_animes_cold',
          title: 'Animes de Sucesso',
          subtitle: 'As melhores animações japonesas',
          items: popularAnimes,
          reasonType: 'top_recommendations'
        });
      }

      // Row 5: Aclamados pela Crítica
      const criticallyAcclaimed = this.diversityRerank(
        scoredGlobal.filter(sc => sc.item.rating >= 8.0),
        20
      );
      if (criticallyAcclaimed.length > 0) {
        rows.push({
          id: 'critically_acclaimed_cold',
          title: 'Aclamados pela Crítica',
          subtitle: 'Obras consagradas com as maiores notas do IMDb e TMDB',
          items: criticallyAcclaimed,
          reasonType: 'critically_acclaimed'
        });
      }
    } else {
      // -------------------------------------------------------------
      // USUÁRIO COM HISTÓRICO: Recomendações Personalizadas Ponderadas
      // -------------------------------------------------------------
      // Row 1: Recomendados para Você
      const topPicks = this.diversityRerank(scoredGlobal, 20);
      if (topPicks.length > 0) {
        rows.push({
          id: 'recommended_for_you',
          title: 'Recomendados para Você',
          subtitle: 'Selecionados a partir do seu estilo e histórico de reprodução',
          items: topPicks,
          reasonType: 'top_recommendations'
        });
      }

      // Row 2: "Porque você assistiu [Último Título Concluído ou Favorito]"
      const referenceId = profile.completedContentIds[profile.completedContentIds.length - 1] ||
                          profile.watchedContentIds[profile.watchedContentIds.length - 1] ||
                          profile.favoriteContentIds[0];

      if (referenceId) {
        const referenceItem = catalog.find(i => i.id === referenceId);
        if (referenceItem) {
          // Candidatos similares ao item de referência
          const similarCandidates = scoredGlobal
            .filter(sc => sc.item.id !== referenceItem.id &&
              sc.item.genres?.some(g => referenceItem.genres?.includes(g))
            );
          const becauseYouWatched = this.diversityRerank(similarCandidates, 18);
          if (becauseYouWatched.length >= 3) {
            rows.push({
              id: `because_watched_${referenceItem.id}`,
              title: `Porque você assistiu ${referenceItem.title}`,
              subtitle: 'Títulos com narrativa, atmosfera e temas semelhantes',
              items: becauseYouWatched,
              reasonType: 'because_you_watched',
              sourceTitle: referenceItem.title
            });
          }
        }
      }

      // Row 3: Gênero de maior afinidade do usuário
      const sortedAffinities = Object.entries(profile.genreAffinities)
        .sort((a, b) => b[1] - a[1])
        .filter(([genre, score]) => score > 0.3 && genre !== 'Adulto');

      if (sortedAffinities.length > 0) {
        const [topGenre] = sortedAffinities[0];
        const genreCandidates = scoredGlobal.filter(sc => sc.item.genres?.includes(topGenre));
        const genrePicks = this.diversityRerank(genreCandidates, 18);
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
      const topRated = this.diversityRerank(
        scoredGlobal.filter(sc => sc.item.rating >= 8.0),
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
      const trendingPool = scoredGlobal.filter(sc => sc.item.isFeatured || (sc.item.imdbRank && sc.item.imdbRank <= 50));
      const trending = this.diversityRerank(
        trendingPool.length > 0 ? trendingPool : scoredGlobal.slice(0, 18),
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

export const recommendationEngine = new RecommendationEngine();
