/**
 * ZapiTV - EditorialCuratorService
 * Curadoria Editorial Inteligente para a Home (Desktop e Web):
 * 1. Camada de Distribuição Editorial Global com controle canônico de exclusividade
 *    e penalidade suave para evitar que as mesmas obras dominem múltiplas fileiras.
 * 2. Catálogo editorial amplo: 10 a 16 categorias ricas estilo Netflix / Prime Video.
 * 3. Carrosséis com 30 a 40 títulos quando houver acervo elegível suficiente.
 * 4. Equilíbrio perfeito entre popularidade real, novidade, avaliação e descoberta.
 * 5. Personalização por perfil com respeito estrito a perfis infantis (isChild).
 * 6. Cache de sessão confiável com fingerprint de catálogo e preferências.
 * 7. PRESERVAÇÃO ESTRITA: "Continuar Assistindo" e seções do administrador intocadas.
 */

import { ContentItem, ContentType, CustomSection } from '../../../types';
import { UserPreferenceProfile, PersonalizedRow } from './recommendationTypes';
import { userPreferenceStore } from './userPreferenceStore';
import { collaborativeEngine } from './CollaborativeEngine';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { deduplicateContentItems, getCanonicalKeysForItem, normalizeCatalogText } from '../catalog/catalogDeduplication';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';
import { searchService } from '../search/searchService';
import { canonicalCatalogMaster } from '../catalog/CanonicalCatalogMaster';
import { streamingPlatformExclusivesService } from '../platforms/StreamingPlatformExclusivesService';
import { StreamingPlatformId } from '../platforms/streamingExclusivesTypes';

export interface EditorialRowDefinition {
  id: string;
  title: string;
  subtitle: string;
  reasonType: PersonalizedRow['reasonType'];
  minItems: number;
  targetCount: number;
  isChildAppropriate: boolean;
  isChildOnly?: boolean;
  filter: (item: ContentItem, profile: UserPreferenceProfile) => boolean;
  score: (item: ContentItem, hybridScore: number, profile: UserPreferenceProfile) => number;
}

export class EditorialCuratorService {
  private static instance: EditorialCuratorService;

  private sessionCache = new Map<string, { timestamp: number; rows: PersonalizedRow[] }>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de estabilidade durante a sessão

  private constructor() {}

  public static getInstance(): EditorialCuratorService {
    if (!EditorialCuratorService.instance) {
      EditorialCuratorService.instance = new EditorialCuratorService();
    }
    return EditorialCuratorService.instance;
  }

  public invalidateCache(): void {
    this.sessionCache.clear();
  }

  /**
   * Extrai um identificador canônico primário estável para o item
   */
  public getPrimaryCanonicalId(item: ContentItem): string {
    if (!item) return '';
    if (item.canonicalId) return item.canonicalId.trim().toLowerCase();
    try {
      const resolved = canonicalCatalogMaster.resolveCanonicalId(item);
      if (resolved) return resolved.trim().toLowerCase();
    } catch {}
    if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
      return item.imdbId.trim().toLowerCase();
    }
    if (item.tmdbId) {
      return `tmdb:${item.type || 'content'}:${item.tmdbId}`;
    }
    const normTitle = normalizeCatalogText(item.title);
    const year = item.year || (item.releaseDate ? item.releaseDate.substring(0, 4) : '');
    return `${normTitle}_${year}_${item.type || 'unknown'}`;
  }

  /**
   * Gera fingerprint confiável do catálogo para invalidar o cache se o acervo mudar
   */
  public generateCatalogFingerprint(items: ContentItem[]): string {
    if (!items || items.length === 0) return 'empty';
    const len = items.length;
    const firstId = items[0]?.id || items[0]?.title || '';
    const lastId = items[len - 1]?.id || items[len - 1]?.title || '';
    const midId = items[Math.floor(len / 2)]?.id || '';
    return `${len}_${firstId}_${midId}_${lastId}`;
  }

  /**
   * Constrói todas as fileiras editoriais da Home garantindo:
   * 1. Continuar Assistindo no topo se houver itens (100% inalterado)
   * 2. Distribuição editorial global com baixa sobreposição entre seções
   * 3. Até 30-40 títulos por carrossel quando houver acervo
   * 4. Categorias ricas e variadas
   */
  public buildHomeEditorialRows(
    catalog: ContentItem[],
    profileId: string = 'default',
    continueWatchingItems: ContentItem[] = [],
    isChild: boolean = false,
    customSections: CustomSection[] = []
  ): PersonalizedRow[] {
    const cleanCatalog = bannedContentRegistry.filterCleanItems(catalog);
    const eligibleCatalog = catalogEligibilityService.filterEligibleItemsSync(cleanCatalog, {
      allowAdult: false
    });

    const catalogFingerprint = this.generateCatalogFingerprint(eligibleCatalog);
    const profile = userPreferenceStore.getPreferencesSync(profileId);
    if (isChild) {
      profile.isChild = true;
    }

    const profileFingerprint = `${profileId}_${isChild ? 'child' : 'adult'}_int${profile.interactionCount}_cw${continueWatchingItems.length}_cs${customSections.length}`;
    const cacheKey = `editorial_home_${profileFingerprint}_${catalogFingerprint}`;

    const cached = this.sessionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.rows;
    }

    // -------------------------------------------------------------------------
    // 1. RASTREADOR DE DISTRIBUIÇÃO EDITORIAL GLOBAL (Anti-Repetição entre Fileiras)
    // -------------------------------------------------------------------------
    const globalUsageMap = new Map<string, number>();
    const markCanonicalUsed = (item: ContentItem) => {
      const keys = getCanonicalKeysForItem(item);
      const primary = this.getPrimaryCanonicalId(item);
      keys.forEach(k => globalUsageMap.set(k, (globalUsageMap.get(k) || 0) + 1));
      if (primary) globalUsageMap.set(primary, (globalUsageMap.get(primary) || 0) + 1);
    };

    const getCanonicalUsageCount = (item: ContentItem): number => {
      const keys = getCanonicalKeysForItem(item);
      const primary = this.getPrimaryCanonicalId(item);
      let maxCount = 0;
      if (primary) maxCount = Math.max(maxCount, globalUsageMap.get(primary) || 0);
      for (const k of keys) {
        maxCount = Math.max(maxCount, globalUsageMap.get(k) || 0);
      }
      return maxCount;
    };

    const rows: PersonalizedRow[] = [];

    // -------------------------------------------------------------------------
    // 2. EXCEÇÃO ABSOLUTA: CONTINUAR ASSISTINDO (PRESERVAÇÃO INTACTA NO TOPO)
    // -------------------------------------------------------------------------
    if (continueWatchingItems && continueWatchingItems.length > 0) {
      const validContinuity = catalogEligibilityService.filterEligibleItemsSync(continueWatchingItems);
      if (validContinuity.length > 0) {
        const dedupedCw = deduplicateContentItems(validContinuity);
        rows.push({
          id: 'continue_watching',
          title: 'Continuar Assistindo',
          subtitle: 'Continue de onde você parou',
          items: dedupedCw,
          reasonType: 'continue_watching'
        });
        // Registra itens do Continuar Assistindo para não repeti-los imediatamente
        dedupedCw.forEach(item => markCanonicalUsed(item));
      }
    }

    // Registra itens já presentes nas seções personalizadas do administrador
    if (customSections && customSections.length > 0) {
      for (const section of customSections) {
        if (section.items && Array.isArray(section.items)) {
          for (const itemId of section.items) {
            const found = eligibleCatalog.find(i => i.id === itemId);
            if (found) markCanonicalUsed(found);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. DEFINIÇÕES EDITORIAIS RICAS (CATÁLOGO DE PROPOSTAS EDITORIAIS)
    // -------------------------------------------------------------------------
    const currentYear = new Date().getFullYear();

    const isAnimation = (item: ContentItem) => {
      return item.type === ContentType.ANIME ||
        item.genres?.some(g => /animação|animacao|animation|desenho|anime/i.test(g));
    };

    const isLiveActionMovie = (item: ContentItem) => {
      return searchService.isMovieItem(item, false) && !isAnimation(item);
    };

    const isLiveActionSeries = (item: ContentItem) => {
      return searchService.isSeriesItem(item) && !isAnimation(item);
    };

    const isAnime = (item: ContentItem) => {
      return searchService.isAnimeItem(item);
    };

    // Coleção completa de definições editoriais possíveis
    const editorialDefinitions: EditorialRowDefinition[] = [
      // --- 1. EM ALTA NO ZAPITV (Rankings Reais e Popularidade Comprovada) ---
      {
        id: 'trending_zapitv',
        title: 'Em Alta no ZapiTV',
        subtitle: 'Os títulos mais procurados e assistidos pela comunidade',
        reasonType: 'trending',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => {
          if (isChild && !isAnimation(item) && !item.genres?.includes('Família')) return false;
          // Privilegia evidências reais de popularidade
          const pop = item.popularity || item.tmdbPopularity || 0;
          return !!(item.isFeatured || (item.imdbRank && item.imdbRank <= 80) || pop > 10 || item.rating >= 7.5);
        },
        score: (item) => {
          let score = 0.5;
          if (item.isFeatured) score += 0.4;
          if (item.imdbRank && item.imdbRank > 0) score += Math.max(0, 0.5 - (item.imdbRank / 150));
          if (item.popularity) score += Math.min(0.3, item.popularity / 100);
          return score;
        }
      },

      // --- 2. RECOMENDAÇÕES PERSONALIZADAS HÍBRIDAS ---
      {
        id: 'recommended_for_you',
        title: isChild ? 'Recomendados para Crianças' : 'Recomendados para Você',
        subtitle: isChild ? 'Histórias alegres e divertidas selecionadas para você' : 'Baseado no seu estilo, afinidades e nos títulos que você mais curte',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => {
          if (isChild) return isAnimation(item) || item.genres?.includes('Família');
          return true;
        },
        score: (item, _score, p) => {
          let score = item.rating ? (item.rating / 10) : 0.6;
          if (item.genres) {
            for (const g of item.genres) {
              if (p.genreAffinities[g]) score += p.genreAffinities[g] * 0.4;
            }
          }
          if (item.imdbRank && item.imdbRank <= 50) score += 0.3;
          if (item.isFeatured) score += 0.2;
          return score;
        }
      },

      // --- 3. ACLAMADOS PELA CRÍTICA (Notas de Excelência >= 7.8) ---
      {
        id: 'critically_acclaimed',
        title: 'Aclamados pela Crítica',
        subtitle: 'Histórias consagradas com as maiores avaliações do cinema e da TV',
        reasonType: 'critically_acclaimed',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => {
          if (isChild && !isAnimation(item) && !item.genres?.includes('Família')) return false;
          return item.rating >= 7.8;
        },
        score: (item) => (item.rating / 10) + (item.imdbRank ? 0.2 : 0)
      },

      // --- 4. ADICIONADOS RECENTEMENTE (Data Real de Inclusão no Catálogo) ---
      {
        id: 'recently_added',
        title: 'Adicionados Recentemente',
        subtitle: 'Novidades recém-chegadas ao acervo da plataforma',
        reasonType: 'new_releases',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => {
          if (isChild && !isAnimation(item) && !item.genres?.includes('Família')) return false;
          const y = item.year || (item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : 0);
          return y >= currentYear - 3 || !!(item as any).addedAt || !!(item as any).createdAt;
        },
        score: (item) => {
          const timestamp = (item as any).addedAt || (item as any).createdAt || (item as any).timestamp;
          if (timestamp) {
            return 1.0 + (Number(timestamp) / 1000000000000);
          }
          const y = item.year || (item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : 2000);
          return (y / currentYear);
        }
      },

      // --- 5. JOIAS ESCONDIDAS (Excelente Avaliação + Menor Exposição / Descoberta) ---
      {
        id: 'hidden_gems',
        title: 'Joias Escondidas',
        subtitle: 'Obras aclamadas e surpreendentes que você talvez ainda não conheça',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => {
          if (isChild && !isAnimation(item) && !item.genres?.includes('Família')) return false;
          // Boas notas (>= 7.2), mas sem ser o blockbuster #1
          const isHighRated = item.rating >= 7.2;
          const notBlockbuster = !item.isFeatured && (!item.imdbRank || item.imdbRank > 60);
          return isHighRated && notBlockbuster;
        },
        score: (item) => {
          // Favorece rating alto e fator novidade moderado
          return (item.rating / 10) * 1.2;
        }
      },

      // --- 6. DESCUBRA ALGO NOVO (Exploração Fora da Bolha do Usuário) ---
      {
        id: 'discover_something_new',
        title: 'Descubra Algo Novo',
        subtitle: 'Produções elogiadas em gêneros e estilos variados para explorar',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item, p) => {
          if (isChild && !isAnimation(item) && !item.genres?.includes('Família')) return false;
          // Identifica gêneros que o usuário ainda NÃO assistiu muito
          if (p.interactionCount > 0 && item.genres) {
            const hasLowAffinity = item.genres.some(g => (p.genreAffinities[g] || 0) < 0.4);
            return hasLowAffinity && item.rating >= 6.8;
          }
          return item.rating >= 7.0;
        },
        score: (item) => (item.rating / 10) + (Math.random() * 0.1)
      },

      // --- 7. FILMES: AÇÃO E AVENTURA ---
      {
        id: 'action_adventure_movies',
        title: 'Filmes de Ação e Aventura',
        subtitle: 'Adrenalina pura, perseguições eletrizantes e grandes jornadas',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: false,
        filter: (item) => isLiveActionMovie(item) && !!item.genres?.some(g => /ação|acao|aventura|action|adventure/i.test(g)),
        score: (item) => (item.rating / 10) + (item.isFeatured ? 0.3 : 0)
      },

      // --- 8. FILMES: PARA TODA A FAMÍLIA ---
      {
        id: 'family_movies',
        title: 'Filmes para Toda a Família',
        subtitle: 'Aventuras e histórias que encantam crianças e adultos juntos',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => {
          const isFam = !!item.genres?.some(g => /família|familia|family|infantil/i.test(g));
          return searchService.isMovieItem(item, false) && isFam;
        },
        score: (item) => (item.rating / 10) + (isAnimation(item) ? 0.2 : 0)
      },

      // --- 9. FILMES: FICÇÃO CIENTÍFICA ---
      {
        id: 'scifi_movies',
        title: 'Para Quem Ama Ficção Científica',
        subtitle: 'Viagens espaciais, futuros distópicos e tecnologias surpreendentes',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: false,
        filter: (item) => isLiveActionMovie(item) && !!item.genres?.some(g => /ficção|ficcao|sci-fi|scifi/i.test(g)),
        score: (item) => (item.rating / 10)
      },

      // --- 10. SÉRIES: PARA MARATONAR ---
      {
        id: 'binge_series',
        title: 'Séries para Maratonar',
        subtitle: 'Episódios viciantes que você não vai conseguir parar de assistir',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: false,
        filter: (item) => isLiveActionSeries(item) && item.rating >= 7.5,
        score: (item) => (item.rating / 10) + (item.isFeatured ? 0.3 : 0)
      },

      // --- 11. SÉRIES: DRAMAS QUE PRENDEM ---
      {
        id: 'drama_series',
        title: 'Dramas que Prendem',
        subtitle: 'Relações intensas, conflitos profundos e atuações memoráveis',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: false,
        filter: (item) => isLiveActionSeries(item) && !!item.genres?.some(g => /drama/i.test(g)),
        score: (item) => (item.rating / 10)
      },

      // --- 12. ANIMES: ANIMES DE SUCESSO (Shounen, Ação, Aventura) ---
      {
        id: 'anime_hits',
        title: 'Animes de Sucesso',
        subtitle: 'Batalhas lendárias, superação e grandes sagas da animação japonesa',
        reasonType: 'top_recommendations',
        minItems: 3,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => isAnime(item) && (!item.genres || item.genres.some(g => /ação|acao|aventura|shounen|shonen/i.test(g))),
        score: (item) => (item.rating / 10) + (item.isFeatured ? 0.3 : 0)
      },

      // --- 13. FILMES: SUSPENSE DE TIRAR O FÔLEGO ---
      {
        id: 'suspense_thriller_movies',
        title: 'Suspense de Tirar o Fôlego',
        subtitle: 'Tensão psicológica, reviravoltas imprevisíveis e mistérios',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: false,
        filter: (item) => isLiveActionMovie(item) && !!item.genres?.some(g => /suspense|thriller|mistério|misterio|policial|crime/i.test(g)),
        score: (item) => (item.rating / 10)
      },

      // --- 14. FILMES: COMÉDIAS PARA RELAXAR ---
      {
        id: 'comedy_movies',
        title: 'Comédias para Relaxar',
        subtitle: 'Boas risadas, humor inteligente e diversão garantida',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => isLiveActionMovie(item) && !!item.genres?.some(g => /comédia|comedia|comedy/i.test(g)),
        score: (item) => (item.rating / 10)
      },

      // --- 15. GRANDES CLÁSSICOS DO CINEMA (Ano <= 2005 e Rating >= 7.5) ---
      {
        id: 'classics_cinema',
        title: 'Grandes Clássicos do Cinema',
        subtitle: 'Obras-primas atemporais que moldaram a história cinematográfica',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => {
          if (isChild && !isAnimation(item) && !item.genres?.includes('Família')) return false;
          const y = item.year || (item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : 9999);
          return searchService.isMovieItem(item, false) && y <= 2005 && item.rating >= 7.3;
        },
        score: (item) => (item.rating / 10) + (item.rating >= 8.5 ? 0.3 : 0)
      },

      // --- 16. FILMES: TERROR E SOBRENATURAL ---
      {
        id: 'horror_movies',
        title: 'Filmes de Terror e Sobrenatural',
        subtitle: 'Calafrios, presenças ocultas e sustos memoráveis',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: false,
        filter: (item) => isLiveActionMovie(item) && !!item.genres?.some(g => /terror|horror/i.test(g)),
        score: (item) => (item.rating / 10)
      },

      // --- 17. SÉRIES: MISTÉRIOS E INVESTIGAÇÕES ---
      {
        id: 'mystery_series',
        title: 'Mistérios e Investigações',
        subtitle: 'Detetives perspicazes, enigmas complexos e crimes misteriosos',
        reasonType: 'top_recommendations',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: false,
        filter: (item) => isLiveActionSeries(item) && !!item.genres?.some(g => /mistério|misterio|policial|crime|investigação|investigacao/i.test(g)),
        score: (item) => (item.rating / 10)
      },

      // --- 18. SÉRIES: MAIS BEM AVALIADAS ---
      {
        id: 'top_rated_series',
        title: 'Séries Mais Bem Avaliadas',
        subtitle: 'As produções seriadas com as mais altas notas do público',
        reasonType: 'critically_acclaimed',
        minItems: 4,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => {
          if (isChild && !isAnimation(item) && !item.genres?.includes('Família')) return false;
          return searchService.isSeriesItem(item) && item.rating >= 8.0;
        },
        score: (item) => (item.rating / 10)
      },

      // --- 19. ANIMES: FANTASIA E OUTROS MUNDOS (Isekai / Magia) ---
      {
        id: 'anime_fantasy',
        title: 'Fantasia e Outros Mundos',
        subtitle: 'Magia, reencarnações em mundos desconhecidos e criaturas místicas',
        reasonType: 'top_recommendations',
        minItems: 3,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => isAnime(item) && !!item.genres?.some(g => /fantasia|isekai|magia|magic/i.test(g)),
        score: (item) => (item.rating / 10)
      },

      // --- 20. ANIMES: MAIS BEM AVALIADOS ---
      {
        id: 'anime_top_rated',
        title: 'Animes Mais Bem Avaliados',
        subtitle: 'As obras-primas da animação japonesa mais aclamadas mundialmente',
        reasonType: 'critically_acclaimed',
        minItems: 3,
        targetCount: 36,
        isChildAppropriate: true,
        filter: (item) => isAnime(item) && item.rating >= 7.8,
        score: (item) => (item.rating / 10)
      }
    ];

    // Se houver histórico do usuário, cria uma fileira contextual baseada na referência
    if (!isChild && profile.interactionCount > 0) {
      const refId = profile.completedContentIds[profile.completedContentIds.length - 1] ||
                    profile.watchedContentIds[profile.watchedContentIds.length - 1] ||
                    profile.favoriteContentIds[0];
      if (refId) {
        const refItem = eligibleCatalog.find(i => i.id === refId);
        if (refItem) {
          const model = collaborativeEngine.getModel();
          const hasCollab = model && model.isActivated && model.itemSimilarities[refId]?.length > 0;
          const rowId = hasCollab ? `collab_watched_${refItem.id}` : `because_watched_${refItem.id}`;
          const rowTitle = hasCollab 
            ? `Quem curtiu ${refItem.title} também assistiu`
            : `Porque você assistiu ${refItem.title}`;
          const rowSubtitle = hasCollab
            ? 'Descobertas baseadas em padrões coletivos de quem tem gosto parecido'
            : 'Títulos com atmosfera, narrativa e temas que você vai gostar';

          editorialDefinitions.splice(2, 0, {
            id: rowId,
            title: rowTitle,
            subtitle: rowSubtitle,
            reasonType: 'because_you_watched',
            minItems: 2,
            targetCount: 36,
            isChildAppropriate: false,
            filter: (item) => {
              if (item.id === refItem.id) return false;
              if (hasCollab) {
                const targetIds = new Set(model.itemSimilarities[refId].map(t => t.targetId));
                if (targetIds.has(item.id)) return true;
              }
              return !!item.genres?.some(g => refItem.genres?.includes(g));
            },
            score: (item) => {
              const shared = item.genres?.filter(g => refItem.genres?.includes(g)).length || 0;
              return (item.rating / 10) + (shared * 0.2);
            }
          });
        }
      }
    }

    // Adaptação dinâmica de tamanho mínimo conforme tamanho total do catálogo
    const catalogSize = eligibleCatalog.length;
    const isSmallCatalog = catalogSize < 25;
    const maxAllowedUsage = isSmallCatalog ? 5 : 2;

    // -------------------------------------------------------------------------
    // 4. CARROSSÉIS DE EXCLUSIVOS DAS PLATAFORMAS DE STREAMING
    // -------------------------------------------------------------------------
    const platformRowMap = new Map<StreamingPlatformId, PersonalizedRow>();
    const platformRows = streamingPlatformExclusivesService.getAllPlatformRows(eligibleCatalog, isChild);
    for (const pRow of platformRows) {
      if (pRow.id.startsWith('exclusive_')) {
        const pid = pRow.id.replace('exclusive_', '') as StreamingPlatformId;
        pRow.subtitle = undefined;
        platformRowMap.set(pid, pRow);
      }
    }
    const insertedPlatforms = new Set<StreamingPlatformId>();

    const tryInsertPlatform = (platformId: StreamingPlatformId) => {
      if (platformRowMap.has(platformId) && !insertedPlatforms.has(platformId)) {
        rows.push(platformRowMap.get(platformId)!);
        insertedPlatforms.add(platformId);
      }
    };

    let editorialRowsAdded = 0;

    // -------------------------------------------------------------------------
    // 5. DISTRIBUIÇÃO EDITORIAL GLOBAL ENTRE FILEIRAS (Exclusividade Inteligente)
    // -------------------------------------------------------------------------
    for (const def of editorialDefinitions) {
      // Perfil Infantil: pula seções inapropriadas
      if (isChild && !def.isChildAppropriate) {
        continue;
      }

      // Candidatos brutos que satisfazem o critério editorial
      const rawCandidates = eligibleCatalog.filter(item => {
        try {
          return def.filter(item, profile);
        } catch {
          return false;
        }
      });

      if (rawCandidates.length === 0) continue;

      // Classifica os candidatos em tiers de uso:
      // Tier 1: 0 aparições anteriores (100% exclusivo)
      // Tier 2: 1 aparição anterior (reutilização permitida com penalidade suave se faltar acervo)
      // Tier 3: >= 2 aparições anteriores (descartado em catálogo normal)
      const tier1Candidates: Array<{ item: ContentItem; finalScore: number }> = [];
      const tier2Candidates: Array<{ item: ContentItem; finalScore: number }> = [];

      for (const item of rawCandidates) {
        const usageCount = getCanonicalUsageCount(item);
        if (usageCount >= maxAllowedUsage) continue; // Bloqueado pelo Tier 3 ou excedente

        const baseScore = def.score(item, item.rating / 10, profile);
        if (usageCount === 0) {
          tier1Candidates.push({ item, finalScore: baseScore });
        } else {
          // Tier 2: penalidade de 80% (multiplicador 0.2)
          tier2Candidates.push({ item, finalScore: baseScore * 0.2 });
        }
      }

      tier1Candidates.sort((a, b) => b.finalScore - a.finalScore);
      tier2Candidates.sort((a, b) => b.finalScore - a.finalScore);

      // Limite dinâmico mínimo para acervos pequenos (testes) ou catálogos maiores
      const effectiveMinItems = isSmallCatalog 
        ? Math.max(1, Math.min(def.minItems, Math.floor(catalogSize / 4)))
        : def.minItems;

      const totalAvailable = tier1Candidates.length + tier2Candidates.length;
      if (totalAvailable < effectiveMinItems) {
        // Não cria fileira se não atingir o mínimo de qualidade editorial
        continue;
      }

      const targetCount = isSmallCatalog
        ? Math.max(2, Math.floor(catalogSize / 2))
        : def.targetCount;

      // Seleciona até targetCount sem duplicatas dentro da fileira
      const selectedItems: ContentItem[] = [];
      const seenRowKeys = new Set<string>();

      const tryAddItem = (candItem: ContentItem) => {
        const keys = getCanonicalKeysForItem(candItem);
        if (keys.some(k => seenRowKeys.has(k))) return false;
        keys.forEach(k => seenRowKeys.add(k));
        selectedItems.push(candItem);
        return true;
      };

      // 1. Prioridade máxima: Adiciona candidatos Tier 1 (100% novos e exclusivos)
      for (const c of tier1Candidates) {
        if (selectedItems.length >= targetCount) break;
        tryAddItem(c.item);
      }

      // 2. Tier 2: Reutilização controlada APENAS se faltar acervo para atingir o volume desejado
      // Em catálogo grande, limita o reaproveitamento a no máximo 6 títulos por fileira
      // para garantir que a página como um todo tenha repetição mínima (< 20%)
      const maxTier2Allowed = isSmallCatalog 
        ? targetCount 
        : Math.min(6, Math.max(0, targetCount - selectedItems.length));

      let tier2Added = 0;
      if (selectedItems.length < targetCount && tier2Added < maxTier2Allowed) {
        for (const c of tier2Candidates) {
          if (selectedItems.length >= targetCount || tier2Added >= maxTier2Allowed) break;
          if (tryAddItem(c.item)) {
            tier2Added++;
          }
        }
      }

      if (selectedItems.length >= effectiveMinItems) {
        // Marca os itens selecionados no rastreador global para as próximas fileiras
        selectedItems.forEach(item => markCanonicalUsed(item));

        rows.push({
          id: def.id,
          title: def.title,
          subtitle: def.subtitle,
          reasonType: def.reasonType,
          items: selectedItems
        });
        editorialRowsAdded++;

        // Intercalação contextual dos carrosséis de exclusivos das plataformas
        if (def.id === 'trending_zapitv') {
          tryInsertPlatform('netflix');
        } else if (def.id === 'recommended_for_you') {
          tryInsertPlatform('prime');
        } else if (def.id === 'critically_acclaimed') {
          tryInsertPlatform('hbo');
        } else if (def.id === 'hidden_gems') {
          tryInsertPlatform('apple');
        } else if (def.id === 'action_adventure_movies') {
          tryInsertPlatform('paramount');
        } else if (def.id === 'family_movies') {
          tryInsertPlatform('disney');
        } else if (def.id === 'drama_series') {
          tryInsertPlatform('globoplay');
        } else if (def.id === 'anime_hits') {
          tryInsertPlatform('crunchyroll');
        }
      }

      // Limite saudável de fileiras editoriais na Home: até 15 carrosséis para variedade e fluidez
      if (editorialRowsAdded >= 15) {
        break;
      }
    }

    // Garante que todas as plataformas de streaming com acervo comprovado (>= 3 itens)
    // sejam incluídas mesmo se uma categoria editorial específica tiver sido suprimida
    const remainingFallbackOrder: StreamingPlatformId[] = [
      'netflix',
      'disney',
      'prime',
      'hbo',
      'apple',
      'paramount',
      'globoplay',
      'crunchyroll'
    ];
    for (const pid of remainingFallbackOrder) {
      tryInsertPlatform(pid);
    }

    this.sessionCache.set(cacheKey, {
      timestamp: Date.now(),
      rows
    });

    return rows;
  }
}

export const editorialCuratorService = EditorialCuratorService.getInstance();
