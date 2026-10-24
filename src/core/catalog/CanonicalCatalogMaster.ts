/**
 * ZapiTV — CanonicalCatalogMaster (Catálogo Mestre Unificado)
 * ETAPA 2 — Unificação de metadados provenientes de TMDB, IMDb e AniList.
 * 
 * Responsabilidades:
 * 1. Identificadores Canônicos Universalmente Qualificados (filmes, séries, animes e episódios).
 * 2. Prevenção absoluta de colisões de IDs entre mídias de tipos diferentes (ex: TMDB Movie vs TV).
 * 3. Preservação estrita de temporadas, episódios, títulos originais e datas de lançamento.
 * 4. Separação completa e estanque entre as categorias Filmes, Séries e Animes.
 * 5. Registro interno de títulos (incluindo não-lançados/sem fontes) vs catálogo público reproduzível.
 * 6. Atualização periódica de lançamentos e episódios com controle de concorrência e cache.
 */

import { ContentItem, ContentType } from '../../../types';
import { tmdbService } from '../tmdb/tmdbClient';
import { aniListClient } from '../anilist/aniListClient';
import { normalizeCatalogText } from './catalogDeduplication';
import { theatricalFilterService } from './theatricalFilterService';
import { catalogEligibilityService } from './CatalogEligibilityService';
import { adultContentService } from '../adult/AdultContentService';
import { FEATURED_CATALOG_ITEMS } from './featuredCatalogItems';
import { filmesData } from '../../../constants';

export interface CanonicalIdParsed {
  category: 'movie' | 'series' | 'anime';
  provider: 'imdb' | 'tmdb' | 'anilist' | 'local';
  rawId: string;
  season?: number;
  episode?: number;
}

export interface MasterCatalogEntry {
  canonicalId: string;
  item: ContentItem;
  registeredAt: number;
  lastUpdatedAt: number;
  isPubliclyVisible: boolean;
  unreleased: boolean;
}

export class CanonicalCatalogMaster {
  private static instance: CanonicalCatalogMaster;

  // Armazenamento central em memória
  private masterRegistry = new Map<string, MasterCatalogEntry>();

  // Índices secundários de busca rápida e resolução cruzada
  private indexByImdb = new Map<string, string>(); // imdbId -> canonicalId
  private indexByTmdbMovie = new Map<string, string>(); // tmdbMovieId -> canonicalId
  private indexByTmdbSeries = new Map<string, string>(); // tmdbSeriesId -> canonicalId
  private indexByAniList = new Map<number, string>(); // anilistId -> canonicalId
  private indexByTitleYear = new Map<string, string>(); // title_year_cat -> canonicalId

  // Controle de atualização periódica
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private lastPeriodicRefresh = 0;
  private isRefreshing = false;
  private isSeeded = false;

  private constructor() {
    // Agenda revalidação periódica de novos episódios e lançamentos a cada 30 minutos
    this.schedulePeriodicRefresh(30 * 60 * 1000);
  }

  public ensureSeeded(): void {
    if (this.isSeeded) return;
    this.isSeeded = true;
    this.seedBundledCatalog();
  }

  public seedBundledCatalog(): void {
    const combined = [
      ...(Array.isArray(filmesData) ? filmesData : []),
      ...(Array.isArray(FEATURED_CATALOG_ITEMS) ? FEATURED_CATALOG_ITEMS : [])
    ];
    for (const item of combined) {
      if (item && item.id) {
        this.registerItem(item);
      }
    }
  }

  public static getInstance(): CanonicalCatalogMaster {
    if (!CanonicalCatalogMaster.instance) {
      CanonicalCatalogMaster.instance = new CanonicalCatalogMaster();
    }
    return CanonicalCatalogMaster.instance;
  }

  /**
   * Constrói um identificador canônico universal qualificado por tipo e provedor
   */
  public buildCanonicalId(
    type: ContentType,
    provider: 'imdb' | 'tmdb' | 'anilist' | 'local',
    rawId: string | number,
    epParams?: { season: number; episode: number } | null
  ): string {
    let cat = 'movie';
    if (type === ContentType.ANIME) cat = 'anime';
    else if (type === ContentType.SERIES) cat = 'series';

    const cleanRaw = String(rawId).trim().toLowerCase();
    const baseId = `${cat}:${provider}:${cleanRaw}`;

    if (epParams && typeof epParams.season === 'number' && typeof epParams.episode === 'number') {
      const s = String(epParams.season).padStart(2, '0');
      const e = String(epParams.episode).padStart(2, '0');
      return `${baseId}:s${s}:e${e}`;
    }

    return baseId;
  }

  /**
   * Faz o parse de um identificador canônico estruturado
   */
  public parseCanonicalId(canonicalId: string): CanonicalIdParsed | null {
    if (!canonicalId || typeof canonicalId !== 'string') return null;
    const parts = canonicalId.split(':');
    if (parts.length < 3) return null;

    const category = parts[0] as 'movie' | 'series' | 'anime';
    const provider = parts[1] as 'imdb' | 'tmdb' | 'anilist' | 'local';
    const rawId = parts[2];

    let season: number | undefined;
    let episode: number | undefined;

    if (parts.length >= 5 && parts[3].startsWith('s') && parts[4].startsWith('e')) {
      season = parseInt(parts[3].replace(/^s/, ''), 10);
      episode = parseInt(parts[4].replace(/^e/, ''), 10);
    }

    return { category, provider, rawId, season, episode };
  }

  /**
   * Determina a categoria canônica estrita de um item (Filmes vs Séries vs Animes)
   */
  public classifyCategory(item: ContentItem): ContentType {
    if (!item) return ContentType.MOVIE;

    const titleLower = (item.title || '').toLowerCase();
    const origLower = (item.originalTitle || '').toLowerCase();
    const genres = (item.genres || []).map(g => g.toLowerCase());

    // 1. ANIME: Qualquer produção de animação japonesa (séries ou filmes)
    const isExplicitAnime = (
      item.type === ContentType.ANIME ||
      Boolean(item.aniListId) ||
      Boolean(item.malId) ||
      genres.includes('anime') ||
      genres.includes('japonesa')
    );

    const isAnimeFranchise = (
      /\b(naruto|bleach|one piece|dragon ball|death note|jujutsu kaisen|demon slayer|kimetsu no yaiba|my hero academia|boku no hero|attack on titan|shingeki no kyojin|fullmetal alchemist|hunter x hunter|tokyo ghoul|fairy tail|sword art online|evangelion|cowboy bebop|inuyasha|sailor moon|yu yu hakusho|steins;gate|code geass|chainsaw man|spy x family|solo leveling|black clover|vinland saga|frieren|dungeon meshi|mob psycho|haikyuu|gintama|berserk|slam dunk|akira|chihiro|totoro|mononoke|your name|kimi no na wa|suzume|boruto)\b/i.test(titleLower) ||
      /\b(naruto|bleach|one piece|dragon ball|death note|jujutsu kaisen|demon slayer|kimetsu no yaiba|boku no hero|attack on titan|shingeki no kyojin|evangelion|chainsaw man|frieren)\b/i.test(origLower)
    );

    // Se tiver marcação explícita de live-action ocidental, não é anime
    const isLiveAction = /live[- ]action|a série$|: a série|o filme \(live-action\)/i.test(titleLower);

    if ((isExplicitAnime || isAnimeFranchise) && !isLiveAction) {
      return ContentType.ANIME;
    }

    // 2. SÉRIES: Produções seriadas não-anime
    const typeStr = String(item.type || '').toUpperCase();
    const isSeries = (
      item.type === ContentType.SERIES ||
      typeStr === 'SERIES' ||
      typeStr === 'SÉRIE' ||
      typeStr === 'TV' ||
      item.mediaFormat === 'series' ||
      (Array.isArray(item.episodes) && item.episodes.length > 1) ||
      (typeof item.seasonsCount === 'number' && item.seasonsCount > 0)
    );

    if (isSeries && item.mediaFormat !== 'movie') {
      return ContentType.SERIES;
    }

    // 3. FILMES: Longas-metragens não-anime
    return ContentType.MOVIE;
  }

  /**
   * Registra e unifica um item no Catálogo Mestre a partir de metadados do TMDB, IMDb ou AniList
   */
  public registerItem(rawItem: ContentItem): ContentItem {
    if (!rawItem || (!rawItem.id && !rawItem.title)) return rawItem;

    const strictType = this.classifyCategory(rawItem);
    const item: ContentItem = {
      ...rawItem,
      type: strictType
    };

    // Identifica se é anime longa-metragem ou seriado
    if (item.type === ContentType.ANIME && !item.mediaFormat) {
      item.mediaFormat = (item.episodes && item.episodes.length > 1) ? 'series' : 'movie';
    }

    // Define o ID canônico se ainda não possuir
    let canonicalId = item.canonicalId;
    if (!canonicalId) {
      if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
        canonicalId = this.buildCanonicalId(item.type, 'imdb', item.imdbId.trim());
      } else if (item.aniListId) {
        canonicalId = this.buildCanonicalId(ContentType.ANIME, 'anilist', item.aniListId);
      } else if (item.tmdbId) {
        canonicalId = this.buildCanonicalId(item.type, 'tmdb', item.tmdbId);
      } else {
        canonicalId = this.buildCanonicalId(item.type, 'local', item.id);
      }
      item.canonicalId = canonicalId;
    }

    // Verifica se já existe no catálogo mestre sob esse canonicalId ou sob IDs equivalentes
    let existingEntry = this.masterRegistry.get(canonicalId);
    if (!existingEntry) {
      const aliasCanonical = this.resolveCanonicalId(item);
      if (aliasCanonical && aliasCanonical !== canonicalId) {
        existingEntry = this.masterRegistry.get(aliasCanonical);
        canonicalId = aliasCanonical;
        item.canonicalId = aliasCanonical;
      }
    }

    const currentYear = new Date().getFullYear();
    const isTheatricalOrFuture = (
      theatricalFilterService.isKnownUnreleasedOrTheatrical(item) ||
      item.availabilityStatus === 'unreleased' ||
      item.availabilityStatus === 'unavailable' ||
      Boolean(item.year && item.year > currentYear)
    );

    const isEligible = catalogEligibilityService.isItemPubliclyPlayableSync(item);
    const isPublicVisible = isEligible && !isTheatricalOrFuture && item.availabilityStatus !== 'unreleased' && item.availabilityStatus !== 'unavailable';

    if (existingEntry) {
      // Reconciliação / Enriquecimento preservando metadados ricos
      const merged = existingEntry.item;
      if (!merged.imdbId && item.imdbId) merged.imdbId = item.imdbId;
      if (!merged.tmdbId && item.tmdbId) merged.tmdbId = item.tmdbId;
      if (!merged.aniListId && item.aniListId) merged.aniListId = item.aniListId;
      if (!merged.malId && item.malId) merged.malId = item.malId;
      if (!merged.originalTitle && item.originalTitle) merged.originalTitle = item.originalTitle;
      if (!merged.releaseDate && item.releaseDate) merged.releaseDate = item.releaseDate;
      if (!merged.director && item.director) merged.director = item.director;
      if ((!merged.cast || merged.cast.length === 0) && item.cast) merged.cast = item.cast;
      if ((!merged.genres || merged.genres.length === 0) && item.genres) merged.genres = item.genres;
      if (!merged.overview && item.overview) merged.overview = item.overview;
      if (!merged.backdrop && item.backdrop) merged.backdrop = item.backdrop;
      if (!merged.image && item.image) merged.image = item.image;

      // Preservação de episódios e temporadas
      if ((!merged.episodes || merged.episodes.length === 0) && item.episodes && item.episodes.length > 0) {
        merged.episodes = item.episodes;
      }
      if (!merged.seasonsCount && item.seasonsCount) {
        merged.seasonsCount = item.seasonsCount;
      }

      existingEntry.lastUpdatedAt = Date.now();
      existingEntry.isPubliclyVisible = isPublicVisible;
      existingEntry.unreleased = isTheatricalOrFuture;

      this.indexItem(canonicalId, merged);
      return merged;
    }

    // Novo registro mestre
    const newEntry: MasterCatalogEntry = {
      canonicalId,
      item,
      registeredAt: Date.now(),
      lastUpdatedAt: Date.now(),
      isPubliclyVisible: isPublicVisible,
      unreleased: isTheatricalOrFuture
    };

    this.masterRegistry.set(canonicalId, newEntry);
    this.indexItem(canonicalId, item);
    return item;
  }

  /**
   * Indexa as chaves secundárias para busca e desambiguação instantânea
   */
  private indexItem(canonicalId: string, item: ContentItem): void {
    if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
      this.indexByImdb.set(item.imdbId.trim().toLowerCase(), canonicalId);
    } else if (item.imdbId && /^\d{6,10}$/.test(item.imdbId.trim())) {
      this.indexByImdb.set(`tt${item.imdbId.trim()}`, canonicalId);
    }
    const imdbInId = String(item.id || '').match(/^(?:movie|series|anime)[-_](?:tt)?(\d{6,10})$/i);
    if (imdbInId) {
      this.indexByImdb.set(`tt${imdbInId[1]}`, canonicalId);
    }

    if (item.tmdbId) {
      const cleanTmdb = String(item.tmdbId).trim().toLowerCase();
      if (item.type === ContentType.MOVIE) {
        this.indexByTmdbMovie.set(cleanTmdb, canonicalId);
      } else {
        this.indexByTmdbSeries.set(cleanTmdb, canonicalId);
      }
    }
    const tmdbInId = String(item.id || '').match(/^tmdb-(?:movie-|tv-|anime-)?(\d+)/i);
    if (tmdbInId) {
      if (item.type === ContentType.MOVIE) {
        this.indexByTmdbMovie.set(tmdbInId[1], canonicalId);
      } else {
        this.indexByTmdbSeries.set(tmdbInId[1], canonicalId);
      }
    }

    if (item.aniListId) {
      this.indexByAniList.set(item.aniListId, canonicalId);
    }
    const aniInId = String(item.id || '').match(/^anilist-(\d+)/i);
    if (aniInId) {
      this.indexByAniList.set(Number(aniInId[1]), canonicalId);
    }

    // Indexação fonética e semântica segura por Título + Ano + Categoria
    const titlesToIndex = [item.title, item.originalTitle].filter(Boolean) as string[];
    const cat = item.type || ContentType.MOVIE;
    const year = Number(item.year) || 0;

    for (const rawTitle of titlesToIndex) {
      const norm = normalizeCatalogText(rawTitle);
      if (norm) {
        this.indexByTitleYear.set(`${cat}:${norm}:${year}`, canonicalId);
        if (year > 0) {
          this.indexByTitleYear.set(`${cat}:${norm}:${year - 1}`, canonicalId);
          this.indexByTitleYear.set(`${cat}:${norm}:${year + 1}`, canonicalId);
        }

        // Se contiver subtítulo (separado por ':', '-', '–', '|'), indexa também o título principal
        const parts = rawTitle.split(/[:–—|-]/);
        if (parts.length > 1) {
          const normPrefix = normalizeCatalogText(parts[0].trim());
          if (normPrefix && normPrefix.length >= 4 && normPrefix !== norm) {
            this.indexByTitleYear.set(`${cat}:${normPrefix}:${year}`, canonicalId);
            if (year > 0) {
              this.indexByTitleYear.set(`${cat}:${normPrefix}:${year - 1}`, canonicalId);
              this.indexByTitleYear.set(`${cat}:${normPrefix}:${year + 1}`, canonicalId);
            }
          }
        }
      }
    }
  }

  /**
   * Resolve o canonicalId unificado a partir de qualquer identificador parcial de entrada
   */
  public resolveCanonicalId(item: Partial<ContentItem>): string | null {
    if (!item) return null;

    if (item.canonicalId && this.masterRegistry.has(item.canonicalId)) {
      return item.canonicalId;
    }

    if (item.imdbId) {
      const cleanImdb = item.imdbId.trim().toLowerCase();
      const found = this.indexByImdb.get(cleanImdb);
      if (found) return found;
      if (!cleanImdb.startsWith('tt') && /^\d+$/.test(cleanImdb)) {
        const foundWithTt = this.indexByImdb.get(`tt${cleanImdb}`);
        if (foundWithTt) return foundWithTt;
      }
    }

    if (item.id) {
      if (/^tt\d+$/i.test(item.id.trim())) {
        const found = this.indexByImdb.get(item.id.trim().toLowerCase());
        if (found) return found;
      }
      const matchImdb = item.id.match(/^(?:movie|series|anime)[-_](?:tt)?(\d{6,10})$/i);
      if (matchImdb) {
        const found = this.indexByImdb.get(`tt${matchImdb[1]}`);
        if (found) return found;
      }
    }

    if (item.aniListId) {
      const found = this.indexByAniList.get(item.aniListId);
      if (found) return found;
    }

    if (item.tmdbId) {
      const cleanTmdb = String(item.tmdbId).trim().toLowerCase();
      const isMovie = item.type === ContentType.MOVIE || (item.type as any) === 'movie' || (item.type as any) === 'FILME' || item.mediaFormat === 'movie';
      const found = isMovie ? this.indexByTmdbMovie.get(cleanTmdb) : this.indexByTmdbSeries.get(cleanTmdb);
      if (found) return found;
    }

    if (item.id && item.id.startsWith('tmdb-')) {
      const tmdbMatch = item.id.match(/^tmdb-(?:movie-|tv-|anime-)?(\d+)/i);
      if (tmdbMatch) {
        const cleanTmdb = tmdbMatch[1];
        const isMovie = item.type === ContentType.MOVIE || (item.type as any) === 'movie' || (item.type as any) === 'FILME' || item.mediaFormat === 'movie';
        const found = isMovie ? this.indexByTmdbMovie.get(cleanTmdb) : this.indexByTmdbSeries.get(cleanTmdb);
        if (found) return found;
      }
    }

    const cat = item.type || ContentType.MOVIE;
    const year = Number(item.year) || 0;
    const candidateTitles = [item.title, item.originalTitle].filter(Boolean) as string[];

    for (const rawTitle of candidateTitles) {
      const norm = normalizeCatalogText(rawTitle);
      if (norm) {
        const found = this.indexByTitleYear.get(`${cat}:${norm}:${year}`);
        if (found) return found;

        // Se houver subtítulo, testa o prefixo
        const parts = rawTitle.split(/[:–—|-]/);
        if (parts.length > 1) {
          const normPrefix = normalizeCatalogText(parts[0].trim());
          if (normPrefix && normPrefix.length >= 4) {
            const foundPrefix = this.indexByTitleYear.get(`${cat}:${normPrefix}:${year}`);
            if (foundPrefix) return foundPrefix;
          }
        }
      }
    }

    return null;
  }

  /**
   * Obtém o item mestre pelo canonicalId
   */
  public getItemByCanonicalId(canonicalId: string): ContentItem | null {
    this.ensureSeeded();
    const entry = this.masterRegistry.get(canonicalId);
    return entry ? entry.item : null;
  }

  /**
   * Retorna apenas os conteúdos públicos elegíveis e reproduzíveis para uma categoria estrita
   */
  public getPublicCatalog(category: 'movies' | 'series' | 'animes'): ContentItem[] {
    this.ensureSeeded();
    const targetType = category === 'movies'
      ? ContentType.MOVIE
      : category === 'series'
      ? ContentType.SERIES
      : ContentType.ANIME;

    const results: ContentItem[] = [];
    for (const entry of this.masterRegistry.values()) {
      if (!entry.isPubliclyVisible || entry.unreleased) continue;
      if (entry.item.availabilityStatus === 'unreleased' || entry.item.availabilityStatus === 'unavailable') continue;
      if (entry.item.type === targetType) {
        results.push(entry.item);
      }
    }

    return results;
  }

  /**
   * Retorna os registros internos completos (inclusive não-lançados ou sem fontes confirmadas)
   */
  public getInternalRegistry(): MasterCatalogEntry[] {
    this.ensureSeeded();
    return Array.from(this.masterRegistry.values());
  }

  /**
   * Retorna todos os itens cadastrados no índice mestre sincronamente
   */
  public getAllItemsSync(): ContentItem[] {
    this.ensureSeeded();
    return Array.from(this.masterRegistry.values()).map(e => e.item);
  }

  /**
   * Total de obras cadastradas no índice mestre (visíveis + internas)
   */
  public getTotalCount(): { total: number; publicCount: number; unreleasedCount: number } {
    let publicCount = 0;
    let unreleasedCount = 0;

    for (const entry of this.masterRegistry.values()) {
      if (entry.unreleased) unreleasedCount++;
      if (entry.isPubliclyVisible) publicCount++;
    }

    return {
      total: this.masterRegistry.size,
      publicCount,
      unreleasedCount
    };
  }

  /**
   * Atualização periódica de novos episódios e lançamentos
   */
  public async checkForUpdates(): Promise<{ updatedCount: number; newCount: number }> {
    if (this.isRefreshing) {
      return { updatedCount: 0, newCount: 0 };
    }

    this.isRefreshing = true;
    let updatedCount = 0;
    let newCount = 0;

    try {
      // 1. Atualiza animes populares em alta do AniList
      try {
        const trendingAnimes = await aniListClient.getPopularAnimes(1, 15);
        for (const anime of trendingAnimes) {
          const canonical = this.resolveCanonicalId(anime);
          if (canonical) {
            this.registerItem(anime);
            updatedCount++;
          } else {
            this.registerItem(anime);
            newCount++;
          }
        }
      } catch (err) {
        console.warn('[CanonicalCatalogMaster] Falha ao atualizar animes do AniList:', err);
      }

      this.lastPeriodicRefresh = Date.now();
    } finally {
      this.isRefreshing = false;
    }

    return { updatedCount, newCount };
  }

  /**
   * Agenda a execução periódica de atualização
   */
  public schedulePeriodicRefresh(intervalMs = 30 * 60 * 1000): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshTimer = setInterval(() => {
      this.checkForUpdates().catch(err => {
        console.warn('[CanonicalCatalogMaster] Erro na atualização periódica:', err);
      });
    }, intervalMs);
  }

  /**
   * Limpa o timer para evitar vazamentos em ambientes de teste
   */
  public dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

export const canonicalCatalogMaster = CanonicalCatalogMaster.getInstance();
