/**
 * ZapiTV - SimilarTitlesService
 * Sistema inteligente de recomendação de Títulos Semelhantes baseado em:
 * 1. Metadados reais e recomendações do TMDB e AniList
 * 2. Cálculo semântico de relevância (gênero, temática, palavras-chave, estilo narrativo, diretor/criador)
 * 3. Priorização de franquias, universos e relações canônicas (sequels, prequels, spin-offs)
 * 4. Isolamento estrito de categorias (filmes com filmes, séries com séries, animes com animes)
 * 5. Ordenação exclusiva por relevância (sem viés de popularidade bruta)
 * 6. Validação de disponibilidade real no catálogo ZapiTV (sem obras não lançadas ou em cartaz)
 * 7. Eliminação de fallbacks aleatórios: se não houver títulos relevantes, retorna lista vazia
 * 8. Cache inteligente em memória com TTL para consultas instantâneas
 */

import { ContentItem, ContentType } from '../../../types';
import { tmdbService, TMDBRawItem } from '../tmdb/tmdbClient';
import { searchService } from '../search/searchService';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../catalog/catalogDeduplication';
import { adultContentService } from '../adult/AdultContentService';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';

export interface ScoredSimilarItem {
  item: ContentItem;
  score: number;
  matchReasons: string[];
}

export interface SimilarityContext {
  tmdbRecommendations?: Array<{ id: number; title?: string; name?: string }>;
  tmdbSimilar?: Array<{ id: number; title?: string; name?: string }>;
  tmdbKeywords?: string[];
  collectionId?: number;
  collectionName?: string;
  collectionTitles?: string[];
  aniListRelations?: string[];
  aniListRecommendations?: string[];
  aniListTags?: string[];
}

// Stop words para normalização de sinopses e keywords em PT e EN
const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'pelo', 'pela', 'pelos', 'pelas', 'para',
  'com', 'como', 'que', 'se', 'e', 'ou', 'mas', 'ao', 'aos', 'sua', 'seu', 'suas',
  'seus', 'ele', 'ela', 'eles', 'elas', 'este', 'esta', 'isto', 'esse', 'essa', 'isso',
  'aquele', 'aquela', 'aquilo', 'muito', 'mais', 'quando', 'onde', 'quem', 'qual',
  'the', 'of', 'and', 'to', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on',
  'are', 'with', 'as', 'i', 'his', 'they', 'be', 'at', 'one', 'have', 'this', 'from',
  'or', 'had', 'by', 'not', 'word', 'but', 'what', 'some', 'we', 'can', 'out', 'other',
  'were', 'all', 'there', 'when', 'up', 'use', 'your', 'how', 'said', 'an', 'each',
  'she', 'which', 'do', 'their', 'time', 'if', 'will', 'way', 'about', 'many', 'then',
  'them', 'write', 'would', 'like', 'so', 'these', 'her', 'long', 'make', 'thing', 'see',
  'him', 'two', 'has', 'look', 'more', 'day', 'could', 'go', 'come', 'did', 'number',
  'sound', 'no', 'most', 'people', 'my', 'over', 'know', 'water', 'than', 'call', 'first',
  'who', 'may', 'down', 'side', 'been', 'now', 'find'
]);

// Palavras-chave temáticas de alto impacto para match semântico
const HIGH_IMPACT_THEMES = [
  'stop motion', 'dark fantasy', 'serial killer', 'investigação', 'investigation',
  'psicológico', 'psychological', 'detetive', 'detective', 'sobrenatural', 'supernatural',
  'magia', 'magic', 'bruxa', 'witch', 'vampiro', 'vampire', 'viagem no tempo', 'time travel',
  'multiverso', 'multiverse', 'cyberpunk', 'inteligência artificial', 'artificial intelligence',
  'apocalipse', 'post-apocalyptic', 'apocalíptico', 'zumbi', 'zombie', 'super-herói', 'superhero',
  'espaço', 'space', 'alienígena', 'alien', 'demônio', 'demon', 'máfia', 'mafia', 'crime',
  'policial', 'police', 'assassinato', 'murder', 'vingança', 'revenge', 'assassino', 'killer',
  'monstro', 'monster', 'fantasma', 'ghost', 'casa mal-assombrada', 'haunted', 'animação sombria',
  'parallel world', 'mundo paralelo', 'dimensão paralela', 'distopia', 'dystopia', 'survival',
  'sobrevivência', 'mecha', 'titã', 'titan', 'escola', 'shounen', 'seinen', 'isekai'
];

export class SimilarTitlesService {
  private cache = new Map<string, { timestamp: number; items: ContentItem[] }>();
  private readonly CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutos
  private readonly MIN_RELEVANCE_THRESHOLD = 30; // Pontuação mínima obrigatória para ser considerado semelhante

  /**
   * Obtém títulos semelhantes relevantes para a obra atual dentro do acervo validado do ZapiTV.
   */
  public async getSimilarTitles(sourceItem: ContentItem, catalogItems: ContentItem[]): Promise<ContentItem[]> {
    if (!sourceItem || bannedContentRegistry.isBanned(sourceItem)) return [];

    const cacheKey = this.getCanonicalCacheKey(sourceItem);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.items;
    }

    // 1. Filtrar o catálogo garantindo elegibilidade e isolamento de conteúdo adulto
    const isSourceAdult = adultContentService.isAdultContent(sourceItem);
    const eligibleCatalog = catalogEligibilityService.filterEligibleItemsSync(catalogItems, { allowAdult: isSourceAdult }).filter(candidate => {
      if (!candidate) return false;
      if (bannedContentRegistry.isBanned(candidate)) return false;
      if (candidate.id === sourceItem.id) return false;
      if (sourceItem.imdbId && candidate.imdbId && sourceItem.imdbId.toLowerCase() === candidate.imdbId.toLowerCase()) return false;
      if (sourceItem.tmdbId && candidate.tmdbId && String(sourceItem.tmdbId) === String(candidate.tmdbId)) return false;
      
      // Isolamento absoluto: obras normais não recomendam adulto e vice-versa
      const isCandidateAdult = adultContentService.isAdultContent(candidate);
      if (isSourceAdult !== isCandidateAdult) return false;

      return true;
    });

    if (eligibleCatalog.length === 0) {
      return [];
    }

    // 2. Buscar metadados enriquecidos externos (TMDB e AniList) em paralelo
    const context = await this.fetchExternalContext(sourceItem);

    // 3. Avaliar relevância de cada candidato
    const scoredList: ScoredSimilarItem[] = [];

    for (const candidate of eligibleCatalog) {
      const evaluation = this.evaluateCandidate(sourceItem, candidate, context);
      if (evaluation.score >= this.MIN_RELEVANCE_THRESHOLD) {
        scoredList.push(evaluation);
      }
    }

    // 4. Ordenar exclusivamente por pontuação de relevância decrescente
    scoredList.sort((a, b) => b.score - a.score);

    // 5. Deduplicar e limitar aos melhores 12 resultados
    const uniqueItems = deduplicateContentItems(scoredList.map(s => s.item)).slice(0, 12);

    // Salvar em cache
    this.cache.set(cacheKey, { timestamp: Date.now(), items: uniqueItems });

    return uniqueItems;
  }

  /**
   * Obtém títulos semelhantes imediatos a partir do cache ou de avaliação semântica local estrita.
   * Não faz requisições assíncronas. Retorna apenas títulos com relevância comprovada (score >= 30).
   * Se não houver itens com relevância suficiente, retorna array vazio (sem fallbacks aleatórios).
   */
  public getImmediateSimilar(sourceItem: ContentItem, catalogItems: ContentItem[]): ContentItem[] {
    if (!sourceItem) return [];

    const cacheKey = this.getCanonicalCacheKey(sourceItem);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.items;
    }

    const isSourceAdult = adultContentService.isAdultContent(sourceItem);
    const eligibleCatalog = catalogEligibilityService.filterEligibleItemsSync(catalogItems, { allowAdult: isSourceAdult }).filter(candidate => {
      if (!candidate) return false;
      if (candidate.id === sourceItem.id) return false;
      if (sourceItem.imdbId && candidate.imdbId && sourceItem.imdbId.toLowerCase() === candidate.imdbId.toLowerCase()) return false;
      if (sourceItem.tmdbId && candidate.tmdbId && String(sourceItem.tmdbId) === String(candidate.tmdbId)) return false;
      
      const isCandidateAdult = adultContentService.isAdultContent(candidate);
      if (isSourceAdult !== isCandidateAdult) return false;

      return true;
    });

    if (eligibleCatalog.length === 0) return [];

    const emptyContext: SimilarityContext = {};
    const scoredList: ScoredSimilarItem[] = [];

    for (const candidate of eligibleCatalog) {
      const evaluation = this.evaluateCandidate(sourceItem, candidate, emptyContext);
      if (evaluation.score >= this.MIN_RELEVANCE_THRESHOLD) {
        scoredList.push(evaluation);
      }
    }

    scoredList.sort((a, b) => b.score - a.score);
    return deduplicateContentItems(scoredList.map(s => s.item)).slice(0, 12);
  }

  /**
   * Avalia a pontuação de relevância entre a obra de origem e um candidato do catálogo.
   */
  public evaluateCandidate(source: ContentItem, candidate: ContentItem, context: SimilarityContext): ScoredSimilarItem {
    const reasons: string[] = [];
    let score = 0;

    // -------------------------------------------------------------
    // REGRA 1: COERÊNCIA ESTRITA DE CATEGORIA
    // -------------------------------------------------------------
    const isSourceAnime = searchService.isAnimeItem(source);
    const isCandidateAnime = searchService.isAnimeItem(candidate);

    if (isSourceAnime) {
      // Se a fonte for anime, o candidato DEVE ser anime (série ou filme de anime)
      if (!isCandidateAnime) {
        return { item: candidate, score: -9999, matchReasons: ['Categoria incompatível: fonte anime requer anime'] };
      }
    } else {
      // Se a fonte NÃO for anime, candidato NÃO pode ser anime seriado
      if (searchService.isAnimeSeriesItem(candidate)) {
        return { item: candidate, score: -9999, matchReasons: ['Categoria incompatível: anime não recomendado para obra convencional'] };
      }

      const isSourceMovie = searchService.isMovieItem(source, false);
      const isCandidateMovie = searchService.isMovieItem(candidate, true);
      const isSourceSeries = searchService.isSeriesItem(source);
      const isCandidateSeries = searchService.isSeriesItem(candidate);

      if (isSourceMovie && !isCandidateMovie) {
        return { item: candidate, score: -9999, matchReasons: ['Categoria incompatível: filme requer filme'] };
      }

      if (isSourceSeries && !isCandidateSeries) {
        return { item: candidate, score: -9999, matchReasons: ['Categoria incompatível: série requer série'] };
      }
    }

    // -------------------------------------------------------------
    // REGRA 2: MESMA FRANQUIA, UNIVERSO OU COLEÇÃO
    // -------------------------------------------------------------
    // A) Mesma coleção TMDB (ex.: filmes da mesma franquia)
    if (context.collectionTitles && context.collectionTitles.length > 0) {
      const normCand = this.normalizeTitle(candidate.title);
      if (context.collectionTitles.some(ct => this.normalizeTitle(ct) === normCand)) {
        score += 85;
        reasons.push(`Mesma franquia oficial TMDB (${context.collectionName || 'Coleção'})`);
      }
    }

    // B) Relação direta no AniList (sequel, prequel, spin-off)
    if (context.aniListRelations && context.aniListRelations.length > 0) {
      const normCand = this.normalizeTitle(candidate.title);
      const normOrig = candidate.originalTitle ? this.normalizeTitle(candidate.originalTitle) : '';
      if (context.aniListRelations.some(rel => {
        const normRel = this.normalizeTitle(rel);
        return normRel === normCand || (normOrig && normRel === normOrig);
      })) {
        score += 90;
        reasons.push('Relação canônica de anime no AniList (Prequel/Sequel/Spin-off)');
      }
    }

    // C) Detecção algorítmica de radical de franquia compartilhada
    const franchiseMatch = this.checkFranchiseMatch(source.title, candidate.title, source.originalTitle, candidate.originalTitle);
    if (franchiseMatch) {
      score += 65;
      reasons.push(`Universo / Franquia compartilhada: "${franchiseMatch}"`);
    }

    // -------------------------------------------------------------
    // REGRA 3: RECOMENDAÇÃO OFICIAL TMDB OU ANILIST
    // -------------------------------------------------------------
    // TMDB Recommendations
    if (context.tmdbRecommendations && context.tmdbRecommendations.length > 0) {
      const matchRec = context.tmdbRecommendations.find(rec => {
        if (candidate.tmdbId && String(rec.id) === String(candidate.tmdbId)) return true;
        const normRec = this.normalizeTitle(rec.title || rec.name || '');
        return normRec && (normRec === this.normalizeTitle(candidate.title) || (candidate.originalTitle && normRec === this.normalizeTitle(candidate.originalTitle)));
      });
      if (matchRec) {
        score += 50;
        reasons.push('Recomendação oficial TMDB');
      }
    }

    // TMDB Similar
    if (context.tmdbSimilar && context.tmdbSimilar.length > 0) {
      const matchSim = context.tmdbSimilar.find(sim => {
        if (candidate.tmdbId && String(sim.id) === String(candidate.tmdbId)) return true;
        const normSim = this.normalizeTitle(sim.title || sim.name || '');
        return normSim && (normSim === this.normalizeTitle(candidate.title) || (candidate.originalTitle && normSim === this.normalizeTitle(candidate.originalTitle)));
      });
      if (matchSim) {
        score += 35;
        reasons.push('Similaridade de catálogo TMDB');
      }
    }

    // AniList Community Recommendations
    if (context.aniListRecommendations && context.aniListRecommendations.length > 0) {
      const normCand = this.normalizeTitle(candidate.title);
      const normOrig = candidate.originalTitle ? this.normalizeTitle(candidate.originalTitle) : '';
      if (context.aniListRecommendations.some(rec => {
        const normRec = this.normalizeTitle(rec);
        return normRec === normCand || (normOrig && normRec === normOrig);
      })) {
        score += 55;
        reasons.push('Recomendação da comunidade AniList');
      }
    }

    // -------------------------------------------------------------
    // REGRA 4: MESMO DIRETOR / CRIADOR / ESTÚDIO
    // -------------------------------------------------------------
    if (source.director && candidate.director) {
      const dir1 = source.director.trim().toLowerCase();
      const dir2 = candidate.director.trim().toLowerCase();
      if (dir1 && dir2 && (dir1 === dir2 || dir1.includes(dir2) || dir2.includes(dir1))) {
        score += 35;
        reasons.push(`Mesmo diretor/criador: ${source.director}`);
      }
    }

    // -------------------------------------------------------------
    // REGRA 5: GÊNEROS E TEMÁTICA
    // -------------------------------------------------------------
    const sourceGenres = source.genres || [];
    const candidateGenres = candidate.genres || [];

    if (sourceGenres.length > 0 && candidateGenres.length > 0) {
      // Incompatibilidade de tom severa
      const isSourceKids = sourceGenres.some(g => /infantil|família|kids/i.test(g));
      const isCandidateKids = candidateGenres.some(g => /infantil|família|kids/i.test(g));
      const isSourceTerror = sourceGenres.some(g => /terror|horror/i.test(g));
      const isCandidateTerror = candidateGenres.some(g => /terror|horror/i.test(g));

      // Se um for puramente infantil e o outro terror pesado sem tom família, penalizar
      if ((isSourceKids && !isSourceTerror && isCandidateTerror) || (isCandidateKids && !isCandidateTerror && isSourceTerror)) {
        score -= 40;
      }

      // Gêneros coincidentes
      const commonGenres = sourceGenres.filter(sg => candidateGenres.some(cg => cg.toLowerCase() === sg.toLowerCase()));
      if (commonGenres.length > 0) {
        score += commonGenres.length * 8;
        reasons.push(`Gêneros em comum (${commonGenres.length}): ${commonGenres.join(', ')}`);

        // Bônus se o gênero primário for o mesmo
        if (sourceGenres[0] && candidateGenres[0] && sourceGenres[0].toLowerCase() === candidateGenres[0].toLowerCase()) {
          score += 15;
          reasons.push(`Gênero primário coincidente: ${sourceGenres[0]}`);
        }
      }
    }

    // -------------------------------------------------------------
    // REGRA 6: PALAVRAS-CHAVE E SINOPSE TEMÁTICA
    // -------------------------------------------------------------
    const candidateText = `${candidate.title} ${candidate.originalTitle || ''} ${candidate.description || ''}`.toLowerCase();
    const sourceText = `${source.title} ${source.originalTitle || ''} ${source.description || ''}`.toLowerCase();

    // A) Keywords do TMDB
    if (context.tmdbKeywords && context.tmdbKeywords.length > 0) {
      let matchedKeywordsCount = 0;
      for (const kw of context.tmdbKeywords) {
        const kwLower = kw.toLowerCase();
        if (candidateText.includes(kwLower)) {
          matchedKeywordsCount++;
        }
      }
      if (matchedKeywordsCount > 0) {
        const kwBonus = Math.min(25, matchedKeywordsCount * 6);
        score += kwBonus;
        reasons.push(`Keywords temáticas TMDB em comum (${matchedKeywordsCount})`);
      }
    }

    // B) Tags do AniList
    if (context.aniListTags && context.aniListTags.length > 0) {
      let matchedTagsCount = 0;
      for (const tag of context.aniListTags) {
        if (candidateText.includes(tag.toLowerCase())) {
          matchedTagsCount++;
        }
      }
      if (matchedTagsCount > 0) {
        const tagBonus = Math.min(25, matchedTagsCount * 6);
        score += tagBonus;
        reasons.push(`Tags AniList em comum (${matchedTagsCount})`);
      }
    }

    // C) Temas de alto impacto em comum
    const commonThemes = HIGH_IMPACT_THEMES.filter(theme => 
      sourceText.includes(theme) && candidateText.includes(theme)
    );
    if (commonThemes.length > 0) {
      score += Math.min(30, commonThemes.length * 10);
      reasons.push(`Estilo/Temas fortes em comum: ${commonThemes.slice(0, 3).join(', ')}`);
    }

    // D) Sobreposição lexical de sinopse significativa
    const sourceTokens = this.extractMeaningfulTokens(source.description || '');
    const candidateTokens = this.extractMeaningfulTokens(candidate.description || '');
    if (sourceTokens.size > 0 && candidateTokens.size > 0) {
      let overlap = 0;
      for (const token of sourceTokens) {
        if (candidateTokens.has(token)) overlap++;
      }
      if (overlap >= 2) {
        const descBonus = Math.min(20, overlap * 4);
        score += descBonus;
        reasons.push(`Semelhança semântica de sinopse (${overlap} termos-chave)`);
      }
    }

    return { item: candidate, score, matchReasons: reasons };
  }

  /**
   * Busca metadados externos de TMDB e AniList para construir o contexto semântico.
   */
  private async fetchExternalContext(sourceItem: ContentItem): Promise<SimilarityContext> {
    const context: SimilarityContext = {};

    const isAnime = searchService.isAnimeItem(sourceItem);
    const isMovie = searchService.isMovieItem(sourceItem, true);

    // 1. TMDB ENRICHMENT
    const rawTmdbId = sourceItem.tmdbId || (sourceItem.id.startsWith('tmdb-') ? sourceItem.id.replace('tmdb-', '') : null);
    let resolvedTmdbId = rawTmdbId && /^\d+$/.test(rawTmdbId) ? Number(rawTmdbId) : null;

    if (!resolvedTmdbId && sourceItem.imdbId) {
      try {
        const found = await tmdbService.findByImdb(sourceItem.imdbId);
        if (found?.tmdbId) resolvedTmdbId = Number(found.tmdbId);
      } catch (e) {
        // Silencioso em caso de erro de rede
      }
    }

    if (resolvedTmdbId) {
      try {
        const path = isMovie ? `/movie/${resolvedTmdbId}` : `/tv/${resolvedTmdbId}`;
        const data: any = await (tmdbService as any).request(`${path}?append_to_response=recommendations,similar,keywords`);

        // Extrai recommendations
        if (data.recommendations?.results) {
          context.tmdbRecommendations = data.recommendations.results.map((r: any) => ({
            id: r.id,
            title: r.title,
            name: r.name
          }));
        }

        // Extrai similar
        if (data.similar?.results) {
          context.tmdbSimilar = data.similar.results.map((r: any) => ({
            id: r.id,
            title: r.title,
            name: r.name
          }));
        }

        // Extrai keywords
        const rawKeywords = data.keywords?.keywords || data.keywords?.results || [];
        context.tmdbKeywords = rawKeywords.map((k: any) => k.name).filter(Boolean);

        // Extrai franquia/coleção TMDB se for filme
        if (data.belongs_to_collection?.id) {
          context.collectionId = data.belongs_to_collection.id;
          context.collectionName = data.belongs_to_collection.name;

          try {
            const colData: any = await (tmdbService as any).request(`/collection/${data.belongs_to_collection.id}`);
            if (colData.parts && Array.isArray(colData.parts)) {
              context.collectionTitles = colData.parts.map((p: any) => p.title || p.original_title).filter(Boolean);
            }
          } catch (colErr) {
            // Ignora erro de coleção
          }
        }
      } catch (err) {
        console.warn('[SimilarTitlesService] Erro ao enriquecer via TMDB:', err);
      }
    }

    // 2. ANILIST ENRICHMENT (se for anime)
    if (isAnime) {
      const searchTitle = sourceItem.originalTitle || sourceItem.title;
      try {
        const anilistData = await this.fetchAniListData(searchTitle);
        if (anilistData) {
          context.aniListRelations = anilistData.relations;
          context.aniListRecommendations = anilistData.recommendations;
          context.aniListTags = anilistData.tags;
        }
      } catch (aniErr) {
        console.warn('[SimilarTitlesService] Erro ao enriquecer via AniList:', aniErr);
      }
    }

    return context;
  }

  /**
   * Consulta a API GraphQL pública do AniList para relações e recomendações canônicas de animes.
   */
  private async fetchAniListData(title: string): Promise<{
    relations: string[];
    recommendations: string[];
    tags: string[];
  } | null> {
    if (!title || title.trim().length < 2) return null;

    const cleanTitle = title.replace(/\s*\([^)]*\)/g, '').replace(/:\s*season\s*\d+/i, '').trim();

    const query = `
      query ($search: String) {
        Media (search: $search, type: ANIME) {
          id
          title { romaji english userPreferred native }
          relations {
            edges {
              relationType
              node {
                title { romaji english userPreferred }
              }
            }
          }
          recommendations (sort: RATING_DESC, perPage: 8) {
            nodes {
              mediaRecommendation {
                title { romaji english userPreferred }
              }
            }
          }
          tags {
            name
            rank
          }
        }
      }
    `;

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { search: cleanTitle } })
      });

      if (!res.ok) return null;
      const json: any = await res.json();
      const media = json.data?.Media;
      if (!media) return null;

      const relations: string[] = [];
      if (media.relations?.edges) {
        for (const edge of media.relations.edges) {
          const t = edge.node?.title;
          if (t?.userPreferred) relations.push(t.userPreferred);
          if (t?.english) relations.push(t.english);
          if (t?.romaji) relations.push(t.romaji);
        }
      }

      const recommendations: string[] = [];
      if (media.recommendations?.nodes) {
        for (const node of media.recommendations.nodes) {
          const t = node.mediaRecommendation?.title;
          if (t?.userPreferred) recommendations.push(t.userPreferred);
          if (t?.english) recommendations.push(t.english);
        }
      }

      const tags: string[] = (media.tags || [])
        .filter((t: any) => (t.rank || 0) >= 60)
        .map((t: any) => t.name);

      return { relations, recommendations, tags };
    } catch {
      return null;
    }
  }

  /**
   * Verifica se dois títulos pertencem à mesma franquia através de radicais compartilhados.
   */
  private checkFranchiseMatch(
    title1: string,
    title2: string,
    orig1?: string,
    orig2?: string
  ): string | null {
    const list1 = [title1, orig1].filter(Boolean) as string[];
    const list2 = [title2, orig2].filter(Boolean) as string[];

    // Lista de radicais canônicos de franquias
    const franchiseRoots = [
      'dexter', 'homem-aranha', 'spider-man', 'harry potter', 'animais fantásticos',
      'fantastic beasts', 'star wars', 'senhor dos anéis', 'lord of the rings', 'hobbit',
      'batman', 'superman', 'vingadores', 'avengers', 'velozes e furiosos', 'fast & furious',
      'shingeki no kyojin', 'attack on titan', 'naruto', 'boruto', 'dragon ball',
      'one piece', 'breaking bad', 'better call saul', 'stranger things', 'game of thrones',
      'house of the dragon', 'coraline', 'laika', 'alien', 'predator', 'predador',
      'terminator', 'exterminador', 'matrix', 'john wick', 'jogos vorazes', 'hunger games'
    ];

    for (const t1 of list1) {
      const norm1 = this.normalizeTitle(t1);
      for (const t2 of list2) {
        const norm2 = this.normalizeTitle(t2);

        for (const root of franchiseRoots) {
          if (norm1.includes(root) && norm2.includes(root)) {
            return root;
          }
        }

        // Match por prefixo antes de dois pontos ou traço (ex: "Dexter: New Blood" x "Dexter")
        const prefix1 = norm1.split(/[:\-–]/)[0].trim();
        const prefix2 = norm2.split(/[:\-–]/)[0].trim();
        if (prefix1.length >= 4 && prefix1 === prefix2) {
          return prefix1;
        }
      }
    }

    return null;
  }

  /**
   * Extrai tokens e termos temáticos significativos de uma sinopse, descartando stop-words.
   */
  private extractMeaningfulTokens(text: string): Set<string> {
    const tokens = new Set<string>();
    if (!text) return tokens;

    const words = text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/);

    for (const word of words) {
      if (word.length >= 4 && !STOP_WORDS.has(word)) {
        tokens.add(word);
      }
    }

    return tokens;
  }

  /**
   * Normaliza um título removendo pontuação e acentos para comparação uniforme.
   */
  private normalizeTitle(title: string): string {
    if (!title) return '';
    return title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Gera a chave canônica única do item para o cache em memória.
   */
  private getCanonicalCacheKey(item: ContentItem): string {
    if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
      return `similar_imdb_${item.imdbId.trim().toLowerCase()}`;
    }
    if (item.tmdbId && /^\d+$/.test(String(item.tmdbId).trim())) {
      return `similar_tmdb_${String(item.tmdbId).trim()}`;
    }
    return `similar_id_${item.id.toLowerCase()}`;
  }

  /**
   * Limpa todo o cache em memória (útil para testes ou recarregamento forçado).
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const similarTitlesService = new SimilarTitlesService();
