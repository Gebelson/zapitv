import { db } from '../../../db';
import { ContentItem } from '../../../types';

export interface WatchProgress {
  contentId: string;
  item: ContentItem;
  season?: number;
  episode?: number;
  currentTime: number;
  duration: number;
  percentage: number;
  updatedAt: string;
}

export interface EpisodeWatchProgress {
  contentId: string;
  season: number;
  episode: number;
  currentTime: number;
  duration: number;
  percentage: number;
  updatedAt: string;
}

class StorageService {
  private readonly FAVORITES_KEY = 'zapitv_local_favorites';
  private readonly HISTORY_KEY = 'zapitv_local_history';
  private readonly PROGRESS_KEY = 'zapitv_local_progress';
  private readonly EPISODE_PROGRESS_KEY = 'zapitv_episode_progress';
  private readonly SETTINGS_KEY = 'zapitv_local_settings';

  private itemProgressCache: Map<string, WatchProgress> = new Map();
  private episodeProgressCache: Map<string, EpisodeWatchProgress> = new Map();

  constructor() {
    this.initSyncCaches();
  }

  private initSyncCaches(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const itemData = localStorage.getItem(this.PROGRESS_KEY);
        if (itemData) {
          const list: WatchProgress[] = JSON.parse(itemData);
          if (Array.isArray(list)) {
            list.forEach(p => {
              if (p?.contentId) this.itemProgressCache.set(p.contentId, p);
            });
          }
        }

        const epData = localStorage.getItem(this.EPISODE_PROGRESS_KEY);
        if (epData) {
          const map: Record<string, EpisodeWatchProgress> = JSON.parse(epData);
          if (map && typeof map === 'object') {
            Object.entries(map).forEach(([key, val]) => {
              if (val) this.episodeProgressCache.set(key, val);
            });
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar cache de progresso local:', e);
    }

    // Sync from IndexedDB in background
    this.syncFromDb().catch(() => {});
  }

  public async syncFromDb(): Promise<void> {
    try {
      const row = await db.keyValueStore.get(this.PROGRESS_KEY);
      if (row && Array.isArray(row.value)) {
        row.value.forEach((p: WatchProgress) => {
          if (p?.contentId) this.itemProgressCache.set(p.contentId, p);
        });
      }

      const epRow = await db.keyValueStore.get(this.EPISODE_PROGRESS_KEY);
      if (epRow && epRow.value && typeof epRow.value === 'object') {
        Object.entries(epRow.value).forEach(([key, val]) => {
          this.episodeProgressCache.set(key, val as EpisodeWatchProgress);
        });
      }
    } catch {}
  }

  public getEpisodeKey(contentId: string, season: number, episode: number): string {
    return `${contentId}_s${season}_e${episode}`;
  }

  /**
   * Retorna síncronamente a porcentagem assistida do item (0 a 100)
   */
  public getSyncItemProgress(contentId: string): number {
    const record = this.itemProgressCache.get(contentId);
    return record?.percentage || 0;
  }

  public getSyncItemProgressRecord(contentId: string): WatchProgress | null {
    return this.itemProgressCache.get(contentId) || null;
  }

  /**
   * Retorna síncronamente a porcentagem assistida do episódio específico (0 a 100)
   */
  public getSyncEpisodeProgress(contentId: string, season: number, episode: number): number {
    const key = this.getEpisodeKey(contentId, season, episode);
    const record = this.episodeProgressCache.get(key);
    return record?.percentage || 0;
  }

  public getSyncEpisodeProgressRecord(contentId: string, season: number, episode: number): EpisodeWatchProgress | null {
    const key = this.getEpisodeKey(contentId, season, episode);
    return this.episodeProgressCache.get(key) || null;
  }

  public async getFavorites(): Promise<string[]> {
    try {
      const row = await db.keyValueStore.get(this.FAVORITES_KEY);
      return row ? row.value : [];
    } catch {
      const saved = localStorage.getItem(this.FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    }
  }

  public async saveFavorites(favorites: string[]): Promise<void> {
    try {
      await db.keyValueStore.put({ key: this.FAVORITES_KEY, value: favorites });
    } catch {
      localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
    }
  }

  public async toggleFavorite(id: string): Promise<string[]> {
    const list = await this.getFavorites();
    const next = list.includes(id) ? list.filter(item => item !== id) : [...list, id];
    await this.saveFavorites(next);
    return next;
  }

  public async getContinueWatching(): Promise<WatchProgress[]> {
    try {
      const row = await db.keyValueStore.get(this.PROGRESS_KEY);
      if (row && Array.isArray(row.value)) return row.value;
    } catch {}
    
    try {
      const saved = localStorage.getItem(this.PROGRESS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}

    return Array.from(this.itemProgressCache.values());
  }

  public async saveProgress(progress: WatchProgress): Promise<void> {
    // 1. Calcula porcentagem normalizada (se assistiu >= 92% marca 100% como concluído)
    const rawPct = progress.duration > 0 ? (progress.currentTime / progress.duration) * 100 : 0;
    const percentage = rawPct >= 92 ? 100 : Math.max(1, Math.round(rawPct));
    const normalizedProgress: WatchProgress = {
      ...progress,
      percentage
    };

    // 2. Atualiza cache em memória
    this.itemProgressCache.set(normalizedProgress.contentId, normalizedProgress);

    // 3. Atualiza lista de continuar assistindo
    const list = await this.getContinueWatching();
    const existingIndex = list.findIndex(p => p.contentId === normalizedProgress.contentId);
    
    let next: WatchProgress[];
    if (existingIndex !== -1) {
      next = [...list];
      next[existingIndex] = normalizedProgress;
    } else {
      next = [normalizedProgress, ...list];
    }
    next = next.slice(0, 30);

    try {
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(next));
      await db.keyValueStore.put({ key: this.PROGRESS_KEY, value: next });
    } catch {
      try {
        localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(next));
      } catch {}
    }

    // 4. Se for série/anime com temporada e episódio, salva progresso por episódio
    if (normalizedProgress.season !== undefined && normalizedProgress.episode !== undefined) {
      const epKey = this.getEpisodeKey(normalizedProgress.contentId, normalizedProgress.season, normalizedProgress.episode);
      const epRecord: EpisodeWatchProgress = {
        contentId: normalizedProgress.contentId,
        season: normalizedProgress.season,
        episode: normalizedProgress.episode,
        currentTime: normalizedProgress.currentTime,
        duration: normalizedProgress.duration,
        percentage,
        updatedAt: normalizedProgress.updatedAt
      };
      this.episodeProgressCache.set(epKey, epRecord);

      try {
        const epMapObj: Record<string, EpisodeWatchProgress> = {};
        this.episodeProgressCache.forEach((v, k) => { epMapObj[k] = v; });
        localStorage.setItem(this.EPISODE_PROGRESS_KEY, JSON.stringify(epMapObj));
        await db.keyValueStore.put({ key: this.EPISODE_PROGRESS_KEY, value: epMapObj });
      } catch {}
    }

    // 5. Emite evento global para atualizar miniaturas e cards instantaneamente sem recarregar a tela
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zapitv_progress_updated', {
        detail: {
          contentId: normalizedProgress.contentId,
          season: normalizedProgress.season,
          episode: normalizedProgress.episode,
          percentage,
          currentTime: normalizedProgress.currentTime,
          duration: normalizedProgress.duration
        }
      }));
    }
  }

  public async getProgress(contentId: string): Promise<WatchProgress | null> {
    const inMem = this.itemProgressCache.get(contentId);
    if (inMem) return inMem;
    const list = await this.getContinueWatching();
    return list.find(p => p.contentId === contentId) || null;
  }

  public async exportDataAsJson(): Promise<string> {
    const favorites = await this.getFavorites();
    const progress = await this.getContinueWatching();
    const epMapObj: Record<string, EpisodeWatchProgress> = {};
    this.episodeProgressCache.forEach((v, k) => { epMapObj[k] = v; });
    const providers = localStorage.getItem('zapitv_providers_config');

    const data = {
      version: "1.1",
      exportDate: new Date().toISOString(),
      favorites,
      progress,
      episodeProgress: epMapObj,
      providers: providers ? JSON.parse(providers) : []
    };

    return JSON.stringify(data, null, 2);
  }

  public async importDataFromJson(jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.favorites)) {
        await this.saveFavorites(data.favorites);
      }
      if (Array.isArray(data.progress)) {
        await db.keyValueStore.put({ key: this.PROGRESS_KEY, value: data.progress });
        localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(data.progress));
        data.progress.forEach((p: WatchProgress) => {
          if (p?.contentId) this.itemProgressCache.set(p.contentId, p);
        });
      }
      if (data.episodeProgress && typeof data.episodeProgress === 'object') {
        await db.keyValueStore.put({ key: this.EPISODE_PROGRESS_KEY, value: data.episodeProgress });
        localStorage.setItem(this.EPISODE_PROGRESS_KEY, JSON.stringify(data.episodeProgress));
        Object.entries(data.episodeProgress).forEach(([key, val]) => {
          this.episodeProgressCache.set(key, val as EpisodeWatchProgress);
        });
      }
      if (Array.isArray(data.providers)) {
        localStorage.setItem('zapitv_providers_config', JSON.stringify(data.providers));
      }
      return true;
    } catch (e) {
      console.error("Erro ao importar JSON:", e);
      return false;
    }
  }

  public getCachedCatalog(key: string): ContentItem[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(`zapitv_catalog_${key}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) return list;
        }
      }
    } catch {}
    return [];
  }

  public saveCachedCatalog(key: string, items: ContentItem[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage && Array.isArray(items) && items.length > 0) {
        localStorage.setItem(`zapitv_catalog_${key}`, JSON.stringify(items.slice(0, 200)));
      }
    } catch {}
  }
}

export const storageService = new StorageService();
