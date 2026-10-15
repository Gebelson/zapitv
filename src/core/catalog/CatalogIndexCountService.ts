/**
 * ZAPITV — CATALOG INDEX COUNT SERVICE
 * 
 * Gerencia o índice completo e imutável de contagem de títulos do catálogo do ZapiTV.
 * 
 * Regras Estritas:
 * 1. Consulta o total diretamente no índice completo consolidado do acervo.
 * 2. Conta apenas títulos únicos (deduplicados por chave canônica) com disponibilidade confirmada.
 * 3. Nunca utiliza o array.length de listas parciais ou paginadas da interface.
 * 4. Não realiza animações ou incrementos numéricos durante a rolagem.
 * 5. Provê estado de prontidão para exibição de placeholder discreto antes da consolidação.
 * 6. Permanece 100% estável durante a navegação, paginação e scroll do usuário.
 * 7. Atualiza o total somente quando os dados do catálogo realmente mudarem.
 */

import { ContentItem } from '../../../types';
import { searchService } from '../search/searchService';
import { catalogEligibilityService } from './CatalogEligibilityService';
import { mediaAvailabilityIndex } from './MediaAvailabilityIndex';
import { filmesData } from '../../../constants';
import { VERIFIED_OPEN_ITEMS } from './verifiedCatalog';
import { catalogReleaseStore } from './CatalogReleaseStore';

export interface CatalogCategoryTotals {
  movies: number;
  series: number;
  animes: number;
  totalAll: number;
}

export class CatalogIndexCountService {
  private static instance: CatalogIndexCountService;

  private isInitialized = false;
  private isComputing = false;
  private lastCatalogSignature = '';

  // Índices consolidados de contagem por categoria
  private categoryTotals: CatalogCategoryTotals = {
    movies: 0,
    series: 0,
    animes: 0,
    totalAll: 0
  };

  // Índices de contagem por categoria e gênero
  private genreTotals = {
    movies: new Map<string, number>(),
    series: new Map<string, number>(),
    animes: new Map<string, number>()
  };

  private listeners = new Set<() => void>();

  private constructor() {
    // Inicialização assíncrona do catálogo base
    this.recomputeIndex();
    catalogReleaseStore.subscribe(() => {
      this.recomputeIndex();
    });
  }

  public static getInstance(): CatalogIndexCountService {
    if (!CatalogIndexCountService.instance) {
      CatalogIndexCountService.instance = new CatalogIndexCountService();
    }
    return CatalogIndexCountService.instance;
  }

  /**
   * Chave canônica única para deduplicação infalível entre múltiplas fontes
   */
  public getCanonicalKey(item: ContentItem): string {
    if (item.id) return item.id.toLowerCase();
    if (item.imdbId && item.imdbId.startsWith('tt')) {
      return item.imdbId.toLowerCase();
    }
    if (item.id && item.id.startsWith('tt')) {
      return item.id.toLowerCase();
    }
    if (item.tmdbId) {
      return `tmdb-${item.tmdbId}`;
    }
    if (item.id && (item.id.startsWith('tmdb-') || item.id.startsWith('open-') || item.id.startsWith('filme-') || item.id.startsWith('serie-'))) {
      return item.id.toLowerCase();
    }
    if (item.title) {
      const cleanTitle = item.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-');
      return `title-${cleanTitle}-${item.type || 'unknown'}-${item.year || 0}`;
    }
    return (item.id || 'unknown-item').toLowerCase();
  }

  /**
   * Recalcula o índice consolidado de títulos únicos com disponibilidade confirmada.
   * Somente roda se houver alteração real nos dados do catálogo.
   */
  public recomputeIndex(additionalItems?: ContentItem[]): void {
    if (this.isComputing) return;

    // Constrói mapa único com base fixa + itens adicionais
    const consolidatedMap = new Map<string, ContentItem>();

    // 1. Catálogo Base Oficial
    if (Array.isArray(filmesData)) {
      for (const item of filmesData) {
        if (item && item.id) {
          const key = this.getCanonicalKey(item);
          consolidatedMap.set(key, item);
        }
      }
    }

    // 2. Acervo de Obras Abertas e Verificadas
    if (Array.isArray(VERIFIED_OPEN_ITEMS)) {
      for (const item of VERIFIED_OPEN_ITEMS) {
        if (item && item.id) {
          const key = this.getCanonicalKey(item);
          consolidatedMap.set(key, item);
        }
      }
    }

    // 3. Conteúdos adicionais do banco (Firebase / Dexie / Firestore)
    if (Array.isArray(additionalItems)) {
      for (const item of additionalItems) {
        if (item && item.id) {
          const key = this.getCanonicalKey(item);
          if (!consolidatedMap.has(key)) {
            consolidatedMap.set(key, item);
          }
        }
      }
    }

    // 4. Lançamentos dinâmicos aprovados pelo AutoReleaseService
    const releases = catalogReleaseStore.getReleases();
    if (Array.isArray(releases)) {
      for (const item of releases) {
        if (item && item.id) {
          const key = this.getCanonicalKey(item);
          if (!consolidatedMap.has(key)) {
            consolidatedMap.set(key, item);
          }
        }
      }
    }

    // Gera assinatura para evitar recálculos desnecessários
    const signature = `${consolidatedMap.size}_${Array.from(consolidatedMap.keys()).slice(0, 10).join('-')}`;
    if (this.isInitialized && signature === this.lastCatalogSignature) {
      return;
    }

    this.isComputing = true;

    try {
      // Filtra estritamente apenas títulos com DISPONIBILIDADE CONFIRMADA
      const uniqueConfirmedItems: ContentItem[] = [];

      for (const item of consolidatedMap.values()) {
        const canonicalKey = this.getCanonicalKey(item);

        // 1. Verifica elegibilidade teatral e de lançamento (sem CAM / sem títulos futuros não lançados)
        const isEligible = catalogEligibilityService.isItemPubliclyPlayableSync(item);
        if (!isEligible) continue;

        // 2. Verifica se não foi marcado como indisponível confirmado no MediaAvailabilityIndex
        const isPlayable = mediaAvailabilityIndex.isPubliclyPlayable(canonicalKey);
        if (!isPlayable) continue;

        uniqueConfirmedItems.push(item);
      }

      // Categorização estrita
      const moviesList: ContentItem[] = [];
      const seriesList: ContentItem[] = [];
      const animesList: ContentItem[] = [];

      for (const item of uniqueConfirmedItems) {
        if (searchService.isAnimeItem(item)) {
          animesList.push(item);
        } else if (searchService.isSeriesItem(item)) {
          seriesList.push(item);
        } else if (searchService.isMovieItem(item)) {
          moviesList.push(item);
        }
      }

      // Atualiza totais por categoria
      this.categoryTotals = {
        movies: moviesList.length,
        series: seriesList.length,
        animes: animesList.length,
        totalAll: uniqueConfirmedItems.length
      };

      // Limpa e reconstrói índices por gênero
      this.genreTotals.movies.clear();
      this.genreTotals.series.clear();
      this.genreTotals.animes.clear();

      const indexGenres = (list: ContentItem[], targetMap: Map<string, number>) => {
        for (const item of list) {
          const genres = item.genres && item.genres.length > 0 ? item.genres : ['Geral'];
          for (const rawGenre of genres) {
            const normalized = rawGenre.trim().toLowerCase();
            targetMap.set(normalized, (targetMap.get(normalized) || 0) + 1);
          }
        }
      };

      indexGenres(moviesList, this.genreTotals.movies);
      indexGenres(seriesList, this.genreTotals.series);
      indexGenres(animesList, this.genreTotals.animes);

      this.lastCatalogSignature = signature;
      this.isInitialized = true;
    } finally {
      this.isComputing = false;
      this.notifyListeners();
    }
  }

  /**
   * Indica se o índice já completou a primeira consulta do catálogo
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Consulta o total exato de títulos disponíveis para a categoria e gênero especificados.
   * Retorna null se o índice ainda estiver em processo de consulta inicial.
   */
  public getTotal(category: 'movies' | 'series' | 'animes' | string, genre?: string): number | null {
    if (!this.isInitialized) {
      return null;
    }

    const cleanCategory = category === 'movies' || category === 'series' || category === 'animes' ? category : 'movies';

    // Se não há filtro de gênero ou o gênero for "Todos", retorna o total direto da categoria
    if (!genre || genre === 'Todos' || !genre.trim()) {
      return this.categoryTotals[cleanCategory];
    }

    // Consulta no índice por gênero normalizado
    const normalizedGenre = genre.trim().toLowerCase();
    const targetMap = this.genreTotals[cleanCategory];

    // Busca exata ou por correspondência de substring
    if (targetMap.has(normalizedGenre)) {
      return targetMap.get(normalizedGenre) || 0;
    }

    // Correspondência flexível (ex: "Ficção" -> "Ficção Científica")
    let matchCount = 0;
    for (const [key, count] of targetMap.entries()) {
      if (key.includes(normalizedGenre) || normalizedGenre.includes(key)) {
        matchCount += count;
      }
    }

    return matchCount;
  }

  /**
   * Subscreve para ser notificado quando o acervo do catálogo sofrer alteração real
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('[CatalogIndexCountService] Erro no listener:', e);
      }
    }
  }
}

export const catalogIndexCountService = CatalogIndexCountService.getInstance();
