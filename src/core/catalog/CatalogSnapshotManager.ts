import { ContentItem } from '../../../types';
import { CatalogSortOption } from '../../../components/SortDropdown';
import { hybridRecommendationEngine } from '../recommendations/hybridRecommendationEngine';
import { bannedContentRegistry } from './BannedContentRegistry';
import { deduplicateContentItems, getCanonicalKeysForItem } from './catalogDeduplication';

export interface SnapshotContext {
  profileId: string;
  isChild: boolean;
  category: 'movies' | 'series' | 'animes' | 'all';
  genreFilter?: string;
}

export class CatalogSnapshotManager {
  private static instance: CatalogSnapshotManager;

  private constructor() {}

  public static getInstance(): CatalogSnapshotManager {
    if (!CatalogSnapshotManager.instance) {
      CatalogSnapshotManager.instance = new CatalogSnapshotManager();
    }
    return CatalogSnapshotManager.instance;
  }

  /**
   * Ordena uma lista de itens respeitando rigorosamente a opção escolhida pelo usuário.
   * Não permite que o algoritmo personalizado substitua a ordenação manual quando o usuário escolheu outra opção.
   */
  public sortItemsByOption(
    items: ContentItem[],
    sortOption: CatalogSortOption = 'recommended',
    context?: Partial<SnapshotContext>
  ): ContentItem[] {
    if (!Array.isArray(items) || items.length <= 1) return items || [];

    const clean = bannedContentRegistry.filterCleanItems(items);
    const ctx: SnapshotContext = {
      profileId: context?.profileId || 'default',
      isChild: context?.isChild === true,
      category: context?.category || 'all',
      genreFilter: context?.genreFilter
    };

    switch (sortOption) {
      case 'popularity': {
        // Mais populares primeiro
        return [...clean].sort((a, b) => {
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          const popA = typeof a.popularity === 'number' ? a.popularity : (a.tmdbPopularity || 0);
          const popB = typeof b.popularity === 'number' ? b.popularity : (b.tmdbPopularity || 0);
          if (Math.abs(popB - popA) > 0.01) return popB - popA;

          const rankA = a.imdbRank && a.imdbRank > 0 ? a.imdbRank : 9999;
          const rankB = b.imdbRank && b.imdbRank > 0 ? b.imdbRank : 9999;
          if (rankA !== rankB) return rankA - rankB;
          return (b.rating || 0) - (a.rating || 0);
        });
      }

      case 'release_date': {
        // Mais recentes primeiro (Lançamentos)
        return [...clean].sort((a, b) => {
          const yearA = Number(a.year) || (a.releaseDate ? parseInt(a.releaseDate.substring(0, 4), 10) : 0);
          const yearB = Number(b.year) || (b.releaseDate ? parseInt(b.releaseDate.substring(0, 4), 10) : 0);
          if (yearB !== yearA) return yearB - yearA;
          if (b.releaseDate && a.releaseDate) return b.releaseDate.localeCompare(a.releaseDate);
          return (b.rating || 0) - (a.rating || 0);
        });
      }

      case 'rating': {
        // Melhores avaliados primeiro
        return [...clean].sort((a, b) => {
          const diff = (b.rating || 0) - (a.rating || 0);
          if (Math.abs(diff) > 0.05) return diff;
          const yearA = Number(a.year) || (a.releaseDate ? parseInt(a.releaseDate.substring(0, 4), 10) : 0);
          const yearB = Number(b.year) || (b.releaseDate ? parseInt(b.releaseDate.substring(0, 4), 10) : 0);
          return yearB - yearA;
        });
      }

      case 'recently_added': {
        // Adicionados recentemente ao catálogo
        return [...clean].sort((a, b) => {
          const timeA = (a as any).addedAt || (a as any).createdAt || (a as any).timestamp;
          const timeB = (b as any).addedAt || (b as any).createdAt || (b as any).timestamp;
          if (timeA && timeB && timeA !== timeB) {
            return Number(timeB) - Number(timeA);
          }
          if (timeA && !timeB) return -1;
          if (!timeA && timeB) return 1;

          // Se não houver timestamp explícito, recorre ao ano/data mais recente
          const yearA = Number(a.year) || (a.releaseDate ? parseInt(a.releaseDate.substring(0, 4), 10) : 0);
          const yearB = Number(b.year) || (b.releaseDate ? parseInt(b.releaseDate.substring(0, 4), 10) : 0);
          if (yearB !== yearA) return yearB - yearA;
          if (b.releaseDate && a.releaseDate) return b.releaseDate.localeCompare(a.releaseDate);
          return (b.rating || 0) - (a.rating || 0);
        });
      }

      case 'oldest': {
        // Mais antigos primeiro (obras clássicas)
        return [...clean].sort((a, b) => {
          const yearA = Number(a.year) || (a.releaseDate ? parseInt(a.releaseDate.substring(0, 4), 10) : 9999);
          const yearB = Number(b.year) || (b.releaseDate ? parseInt(b.releaseDate.substring(0, 4), 10) : 9999);
          if (yearA !== yearB) return yearA - yearB;
          if (a.releaseDate && b.releaseDate) return a.releaseDate.localeCompare(b.releaseDate);
          return (a.rating || 0) - (b.rating || 0);
        });
      }

      case 'title_az': {
        // Alfabético A-Z
        return [...clean].sort((a, b) => {
          const tA = (a.title || '').trim().toLowerCase();
          const tB = (b.title || '').trim().toLowerCase();
          return tA.localeCompare(tB, 'pt-BR', { sensitivity: 'base', numeric: true });
        });
      }

      case 'title_za': {
        // Alfabético Z-A
        return [...clean].sort((a, b) => {
          const tA = (a.title || '').trim().toLowerCase();
          const tB = (b.title || '').trim().toLowerCase();
          return tB.localeCompare(tA, 'pt-BR', { sensitivity: 'base', numeric: true });
        });
      }

      case 'recommended':
      default: {
        // Recomendações personalizadas híbridas
        return hybridRecommendationEngine.sortCatalogByHybridRelevance(
          clean,
          ctx.profileId,
          ctx.genreFilter,
          ctx.isChild,
          ctx.category
        );
      }
    }
  }

  /**
   * Cria o snapshot estável inicial ao entrar na página, trocar gênero ou trocar ordenação.
   */
  public createInitialSnapshot(
    items: ContentItem[],
    sortOption: CatalogSortOption = 'recommended',
    context: SnapshotContext
  ): ContentItem[] {
    const deduped = deduplicateContentItems(items);
    return this.sortItemsByOption(deduped, sortOption, context);
  }

  /**
   * Anexa um novo lote de paginação (scroll infinito) estritamente no final da listagem.
   * Garante:
   * 1. Nenhuma duplicata em relação ao snapshot atual.
   * 2. Os cards anteriores NUNCA mudam de posição ou desaparecem.
   * 3. O novo lote é ordenado internamente pelo mesmo critério de ordenação antes de ser anexado.
   */
  public appendPaginationBatch(
    currentSnapshot: ContentItem[],
    incomingBatch: ContentItem[],
    sortOption: CatalogSortOption = 'recommended',
    context: SnapshotContext
  ): ContentItem[] {
    if (!incomingBatch || incomingBatch.length === 0) return currentSnapshot;

    // Registra todas as chaves canônicas (IMDb, TMDb, ID local, título normalizado + ano) já presentes no snapshot
    const seenCanonicalKeys = new Set<string>();
    for (const item of currentSnapshot) {
      if (!item) continue;
      const keys = getCanonicalKeysForItem(item);
      for (const k of keys) {
        seenCanonicalKeys.add(k);
      }
    }

    const uniqueNewItems: ContentItem[] = [];
    for (const item of incomingBatch) {
      if (!item || (!item.id && !item.title) || bannedContentRegistry.isBanned(item)) {
        continue;
      }

      const keys = getCanonicalKeysForItem(item);
      const isDuplicate = keys.some(k => seenCanonicalKeys.has(k));
      if (isDuplicate) {
        continue;
      }

      for (const k of keys) {
        seenCanonicalKeys.add(k);
      }
      uniqueNewItems.push(item);
    }

    if (uniqueNewItems.length === 0) return currentSnapshot;

    // Ordena o novo lote internamente preservando a opção de ordenação
    const sortedBatch = this.sortItemsByOption(uniqueNewItems, sortOption, context);

    // Anexa estritamente ao final preservando todo o histórico anterior
    return [...currentSnapshot, ...sortedBatch];
  }

  private snapshots: Map<string, ContentItem[]> = new Map();

  public getCachedSnapshot(key: string): ContentItem[] | undefined {
    return this.snapshots.get(key);
  }

  public setCachedSnapshot(key: string, items: ContentItem[]): void {
    this.snapshots.set(key, items);
  }

  public clearCachedSnapshot(key?: string): void {
    if (key) {
      this.snapshots.delete(key);
    } else {
      this.snapshots.clear();
    }
  }
}

export const catalogSnapshotManager = CatalogSnapshotManager.getInstance();
