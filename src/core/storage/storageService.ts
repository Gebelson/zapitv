import { db } from '../../../db';
import { ContentItem, ContentType } from '../../../types';
import { theatricalFilterService } from '../catalog/theatricalFilterService';
import { userPreferenceStore } from '../recommendations/userPreferenceStore';
import { recommendationEngine } from '../recommendations/recommendationEngine';
import { collaborativeEngine } from '../recommendations/CollaborativeEngine';
import { hybridRecommendationEngine } from '../recommendations/hybridRecommendationEngine';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';
import { searchService } from '../search/searchService';

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

export interface PlaybackContinuityInfo {
  hasStarted: boolean;
  isCompleted: boolean;
  season: number;
  episode: number;
  currentTime: number;
  duration: number;
  percentage: number;
  formattedPosition: string; // Ex: "14:35"
  label: string; // Ex: "T2 • E8"
  actionText: string; // "Continuar assistindo" vs "Assistir"
  isNextEpisode: boolean;
}

export function formatPlaybackTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
    this.purgeBannedItemsFromStorage();
  }

  public purgeBannedItemsFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // 1. Purga itens de progresso em memória
      for (const [key] of this.itemProgressCache.entries()) {
        if (bannedContentRegistry.isBannedKeyOrId(key)) this.itemProgressCache.delete(key);
      }
      for (const [key] of this.episodeProgressCache.entries()) {
        if (bannedContentRegistry.isBannedKeyOrId(key)) this.episodeProgressCache.delete(key);
      }

      // 2. Limpa registros globais no localStorage via registro centralizado
      bannedContentRegistry.purgeStorage();
    } catch {}
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
   * Extrai todas as chaves identificadoras potenciais (ID, IMDb, TMDb) de um item ou string
   */
  public getCandidateKeys(itemOrId: string | ContentItem): string[] {
    const keys: Set<string> = new Set();
    if (!itemOrId) return [];

    if (typeof itemOrId === 'string') {
      const trimmed = itemOrId.trim();
      if (trimmed) {
        keys.add(trimmed);
        if (trimmed.startsWith('tmdb-')) {
          keys.add(trimmed.substring(5));
        } else if (/^\d+$/.test(trimmed)) {
          keys.add(`tmdb-${trimmed}`);
        }
      }
    } else if (itemOrId && typeof itemOrId === 'object') {
      if (itemOrId.id) {
        const idTrimmed = itemOrId.id.trim();
        keys.add(idTrimmed);
        if (idTrimmed.startsWith('tmdb-')) {
          keys.add(idTrimmed.substring(5));
        } else if (/^\d+$/.test(idTrimmed)) {
          keys.add(`tmdb-${idTrimmed}`);
        }
      }
      if (itemOrId.imdbId) {
        keys.add(itemOrId.imdbId.trim());
      }
      if (itemOrId.tmdbId) {
        const rawTmdb = String(itemOrId.tmdbId).trim();
        keys.add(rawTmdb);
        keys.add(`tmdb-${rawTmdb}`);
      }
    }
    return Array.from(keys);
  }

  /**
   * Resolve canonicamente o registro de progresso geral do item
   */
  public resolveWatchProgress(itemOrId: string | ContentItem): WatchProgress | null {
    const candidateKeys = this.getCandidateKeys(itemOrId);
    for (const k of candidateKeys) {
      const found = this.itemProgressCache.get(k);
      if (found) return found;
    }

    const targetTitle = typeof itemOrId === 'object' && itemOrId?.title ? itemOrId.title.trim().toLowerCase() : '';
    for (const p of this.itemProgressCache.values()) {
      if (candidateKeys.includes(p.contentId)) return p;
      if (p.item) {
        const itemKeys = this.getCandidateKeys(p.item);
        if (candidateKeys.some(ck => itemKeys.includes(ck))) return p;
        if (targetTitle && p.item.title && p.item.title.trim().toLowerCase() === targetTitle) {
          return p;
        }
      }
    }
    return null;
  }

  /**
   * Resolve canonicamente o progresso de um episódio específico
   */
  public resolveEpisodeWatchProgress(
    itemOrId: string | ContentItem, 
    season: number, 
    episode: number
  ): EpisodeWatchProgress | null {
    const candidateKeys = this.getCandidateKeys(itemOrId);
    for (const k of candidateKeys) {
      const epKey = this.getEpisodeKey(k, season, episode);
      const found = this.episodeProgressCache.get(epKey);
      if (found) return found;
    }

    const suffix = `_s${season}_e${episode}`;
    for (const [key, val] of this.episodeProgressCache.entries()) {
      if (key.endsWith(suffix)) {
        const prefix = key.slice(0, -suffix.length);
        if (candidateKeys.includes(prefix)) {
          return val;
        }
      }
    }
    return null;
  }

  /**
   * Fonte Única da Verdade para retomada automática e continuidade de reprodução
   */
  public getPlaybackContinuity(
    itemOrId: string | ContentItem,
    totalSeasons: number = 1,
    episodesInCurrentSeason?: number
  ): PlaybackContinuityInfo {
    const savedProg = this.resolveWatchProgress(itemOrId);
    const isEpisodic = typeof itemOrId === 'object' 
      ? (itemOrId.type === ContentType.SERIES || itemOrId.type === ContentType.ANIME || Boolean(itemOrId.seasonsCount && itemOrId.seasonsCount > 0))
      : Boolean(savedProg?.season !== undefined || savedProg?.episode !== undefined);

    if (!savedProg || (!savedProg.currentTime && !savedProg.percentage)) {
      return {
        hasStarted: false,
        isCompleted: false,
        season: 1,
        episode: 1,
        currentTime: 0,
        duration: 0,
        percentage: 0,
        formattedPosition: '00:00',
        label: isEpisodic ? 'T1 • E1' : 'Início',
        actionText: 'Assistir',
        isNextEpisode: false
      };
    }

    // Para filmes ou itens não seriados
    if (!isEpisodic && savedProg.season === undefined && savedProg.episode === undefined) {
      const isCompleted = savedProg.percentage >= 92;
      return {
        hasStarted: true,
        isCompleted,
        season: 1,
        episode: 1,
        currentTime: isCompleted ? 0 : savedProg.currentTime,
        duration: savedProg.duration,
        percentage: savedProg.percentage,
        formattedPosition: formatPlaybackTime(savedProg.currentTime),
        label: isCompleted ? 'Assistido' : formatPlaybackTime(savedProg.currentTime),
        actionText: isCompleted ? 'Assistir' : 'Continuar assistindo',
        isNextEpisode: false
      };
    }

    // Para séries e animes
    const s = savedProg.season ?? 1;
    const e = savedProg.episode ?? 1;
    const epRecord = this.resolveEpisodeWatchProgress(itemOrId, s, e) || savedProg;
    const rawPct = epRecord.duration > 0 ? (epRecord.currentTime / epRecord.duration) * 100 : (epRecord.percentage || 0);
    const pct = Math.round(rawPct);
    const isCurrentEpCompleted = pct >= 92;

    if (isCurrentEpCompleted) {
      // Episódio concluído: avançar automaticamente para o próximo
      const epCount = episodesInCurrentSeason && episodesInCurrentSeason > 0 ? episodesInCurrentSeason : undefined;
      
      if (epCount !== undefined && e >= epCount) {
        // Último episódio da temporada atual
        if (s < totalSeasons) {
          return {
            hasStarted: true,
            isCompleted: false,
            season: s + 1,
            episode: 1,
            currentTime: 0,
            duration: 0,
            percentage: 0,
            formattedPosition: '00:00',
            label: `T${s + 1} • E1`,
            actionText: 'Continuar assistindo',
            isNextEpisode: true
          };
        } else {
          // Série completamente concluída
          return {
            hasStarted: true,
            isCompleted: true,
            season: s,
            episode: e,
            currentTime: epRecord.currentTime,
            duration: epRecord.duration,
            percentage: 100,
            formattedPosition: formatPlaybackTime(epRecord.currentTime),
            label: `T${s} • E${e} (Concluído)`,
            actionText: 'Assistir',
            isNextEpisode: false
          };
        }
      } else {
        // Próximo episódio na mesma temporada
        return {
          hasStarted: true,
          isCompleted: false,
          season: s,
          episode: e + 1,
          currentTime: 0,
          duration: 0,
          percentage: 0,
          formattedPosition: '00:00',
          label: `T${s} • E${e + 1}`,
          actionText: 'Continuar assistindo',
          isNextEpisode: true
        };
      }
    }

    // Episódio em andamento (< 92%): retoma exatamente no segundo salvo
    return {
      hasStarted: true,
      isCompleted: false,
      season: s,
      episode: e,
      currentTime: epRecord.currentTime,
      duration: epRecord.duration,
      percentage: pct,
      formattedPosition: formatPlaybackTime(epRecord.currentTime),
      label: `T${s} • E${e}`,
      actionText: 'Continuar assistindo',
      isNextEpisode: false
    };
  }

  /**
   * Retorna síncronamente a porcentagem assistida do item (0 a 100)
   */
  public getSyncItemProgress(contentId: string): number {
    const record = this.resolveWatchProgress(contentId);
    return record?.percentage || 0;
  }

  public getSyncItemProgressRecord(contentId: string): WatchProgress | null {
    return this.resolveWatchProgress(contentId);
  }

  /**
   * Retorna síncronamente a porcentagem assistida do episódio específico (0 a 100)
   */
  public getSyncEpisodeProgress(contentId: string, season: number, episode: number): number {
    const record = this.resolveEpisodeWatchProgress(contentId, season, episode);
    return record?.percentage || 0;
  }

  public getSyncEpisodeProgressRecord(contentId: string, season: number, episode: number): EpisodeWatchProgress | null {
    return this.resolveEpisodeWatchProgress(contentId, season, episode);
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
    recommendationEngine.invalidateCache();
    hybridRecommendationEngine.invalidateCache();
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

    // 6. Atualiza o motor de recomendações híbridas com a nova interação do usuário
    if (normalizedProgress.item) {
      userPreferenceStore.recordPlayback(
        normalizedProgress.item,
        normalizedProgress.currentTime,
        normalizedProgress.duration
      ).then(() => {
        recommendationEngine.invalidateCache();
        hybridRecommendationEngine.invalidateCache();
        // Se usuário consentiu voluntariamente, despacha evento pseudonimizado (item adulto é bloqueado automaticamente)
        const weight = normalizedProgress.percentage >= 85 ? 1.0 : normalizedProgress.percentage >= 50 ? 0.7 : 0.4;
        collaborativeEngine.dispatchConsentedEvent(normalizedProgress.item, weight).catch(() => {});
      }).catch(() => {});
    }
  }

  public async getProgress(contentId: string): Promise<WatchProgress | null> {
    const inMem = this.itemProgressCache.get(contentId);
    if (inMem) return inMem;
    const list = await this.getContinueWatching();
    return list.find(p => p.contentId === contentId) || null;
  }

  public async deleteProgress(contentId: string): Promise<void> {
    this.itemProgressCache.delete(contentId);
    const list = await this.getContinueWatching();
    const next = list.filter(p => p.contentId !== contentId);
    try {
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(next));
      await db.keyValueStore.put({ key: this.PROGRESS_KEY, value: next });
    } catch {
      try {
        localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(next));
      } catch {}
    }
  }

  public async clearAllProgress(): Promise<void> {
    this.itemProgressCache.clear();
    this.episodeProgressCache.clear();
    try {
      localStorage.removeItem(this.PROGRESS_KEY);
      localStorage.removeItem(this.EPISODE_PROGRESS_KEY);
      await db.keyValueStore.delete(this.PROGRESS_KEY);
      await db.keyValueStore.delete(this.EPISODE_PROGRESS_KEY);
    } catch {
      try {
        localStorage.removeItem(this.PROGRESS_KEY);
        localStorage.removeItem(this.EPISODE_PROGRESS_KEY);
      } catch {}
    }
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
          if (Array.isArray(list) && list.length > 0) {
            const clean = bannedContentRegistry.filterCleanItems(list);
            const sanitized = theatricalFilterService.filterAllowedMoviesSync(clean);
            if (key === 'movies') {
              return sanitized.filter(i => searchService.isMovieItem(i, false));
            } else if (key === 'series') {
              return sanitized.filter(i => searchService.isSeriesItem(i));
            } else if (key === 'animes') {
              return sanitized.filter(i => searchService.isAnimeItem(i));
            }
            return sanitized;
          }
        }
      }
    } catch {}
    return [];
  }

  public saveCachedCatalog(key: string, items: ContentItem[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage && Array.isArray(items) && items.length > 0) {
        const clean = bannedContentRegistry.filterCleanItems(items);
        const sanitized = theatricalFilterService.filterAllowedMoviesSync(clean);
        let strictlyTyped = sanitized;
        if (key === 'movies') {
          strictlyTyped = sanitized.filter(i => searchService.isMovieItem(i, false));
        } else if (key === 'series') {
          strictlyTyped = sanitized.filter(i => searchService.isSeriesItem(i));
        } else if (key === 'animes') {
          strictlyTyped = sanitized.filter(i => searchService.isAnimeItem(i));
        }
        localStorage.setItem(`zapitv_catalog_${key}`, JSON.stringify(strictlyTyped.slice(0, 200)));
      }
    } catch {}
  }
}

export const storageService = new StorageService();
