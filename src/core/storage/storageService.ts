import { ContentItem, ContentType } from '../../../types';
import { theatricalFilterService } from '../catalog/theatricalFilterService';
import { userPreferenceStore } from '../recommendations/userPreferenceStore';
import { recommendationEngine } from '../recommendations/recommendationEngine';
import { collaborativeEngine } from '../recommendations/CollaborativeEngine';
import { hybridRecommendationEngine } from '../recommendations/hybridRecommendationEngine';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';
import { searchService } from '../search/searchService';

import { LocalDataStore, localDataStore } from './localDataStore';
import { WatchProgress, EpisodeWatchProgress, WatchState, watchStateCodec, contentKey, sameContent, episodeKey, normalizeProgress, normalizeEpisode, normalizeWatchState, mergeWatchStates, listCodec, normalizeIds, StorageScope, getWatchStateCodec, getListCodec } from './watchState';
export type { WatchProgress, EpisodeWatchProgress, StorageScope } from './watchState';
import { contentPoster, mergeContinuityMetadata, continuityContentType } from './continuityMetadata';
import { scopedKey } from './watchState';
import type { DataCodec } from './localDataStore';
import { syncClient } from '../sync/syncClient';
import { syncQueue } from '../sync/syncQueue';

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

export function toContentType(raw: unknown, isEpisodic = false): ContentType {
  if (!raw) return isEpisodic ? ContentType.SERIES : ContentType.MOVIE;
  const lower = String(raw).toLowerCase().trim();
  if (lower === 'anime') return ContentType.ANIME;
  if (lower === 'series' || lower === 'série' || lower === 'serie' || lower === 'show' || lower === 'tv') return ContentType.SERIES;
  if (lower === 'movie' || lower === 'filme') return ContentType.MOVIE;
  if (Object.values(ContentType).includes(raw as any)) return raw as ContentType;
  return isEpisodic ? ContentType.SERIES : ContentType.MOVIE;
}

export class StorageService {
  private itemProgressCache = new Map<string, WatchProgress>();
  private episodeProgressCache = new Map<string, EpisodeWatchProgress>();
  private lastRemoteProgressSync = new Map<string, number>();
  private lastRemoteHistorySync = new Map<string, number>();
  private lastRemotePosition = new Map<string, number>();
  private completedSynced = new Set<string>();
  private currentScope: StorageScope | null = null;
  private scopeEpoch = 0;
  private hydrationRevision = 0;
  private ready: Promise<void>;
  private lastPeriodicRefresh = 0;
  private lifecycleSyncCleanup: (() => void) | null = null;

  constructor(private dataStore: LocalDataStore = localDataStore) {
    this.applyWatchState(this.dataStore.readSync(watchStateCodec));
    this.ready = this.syncFromDb();
    // authSyncService already owns application focus/online/periodic refresh.
  }

  private continuitySyncState: 'idle' | 'loading' | 'synced' | 'offline' = 'idle';
  public getContinuitySyncState() { return this.continuitySyncState; }

  public getScope(): StorageScope | null {
    return this.currentScope;
  }

  public async setScope(scope: StorageScope | null): Promise<void> {
    // Each selection owns a distinct lifetime, including A -> B -> A.
    this.currentScope = scope ? { ...scope } : null;
    this.continuitySyncState = 'idle';
    const selectedEpoch = ++this.scopeEpoch;
    this.applyWatchState({ items: [], episodes: {} });
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("zapitv_progress_updated"));
    syncQueue.setAccountScope(scope?.userId || null, scope?.profileId || null);
    this.ready = this.syncFromDb();
    await this.ready;
    if (this.scopeEpoch !== selectedEpoch) return;
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('zapitv_progress_updated'));
    recommendationEngine.invalidateCache();
    hybridRecommendationEngine.invalidateCache();

    if (scope && scope.userId && scope.profileId) {
      // Hidratação remota assíncrona do perfil autenticado
      void this.hydrateRemoteProfile(scope.profileId);
    }
  }

  /**
   * Resolve metadados canônicos ricos a partir dos catálogos em cache
   */
  public resolveCatalogItem(canonicalOrId: string): ContentItem | null {
    if (!canonicalOrId) return null;
    const cleanId = canonicalOrId.trim();
    const categories = ['movies', 'series', 'animes', 'top_rated'];
    for (const cat of categories) {
      const items = this.getCachedCatalog(cat);
      const found = items.find(i => 
        i.canonicalId === cleanId || 
        i.id === cleanId || 
        i.imdbId === cleanId || 
        (i.tmdbId && String(i.tmdbId) === cleanId) ||
        (cleanId.startsWith('tmdb-') && String(i.tmdbId) === cleanId.slice(5))
      );
      if (found) return found;
    }
    return null;
  }

  /**
   * Puxa dados remotos e hidrata o cache local do perfil com resolução de conflitos
   */
  public async hydrateRemoteProfile(profileId: string): Promise<void> {
    if (!profileId || this.currentScope?.profileId !== profileId) return;

    const scope = this.currentScope;
    const epoch = this.scopeEpoch;
    const revision = ++this.hydrationRevision;
    this.continuitySyncState = 'loading';
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('zapitv_progress_updated'));
    const isCurrent = () => this.scopeEpoch === epoch && this.hydrationRevision === revision;
    const watchCodec = this.getWatchCodec(), listCodec = this.getMyListCodec(), favoritesCodec = this.getFavoritesCodec();
    const historyCodec = this.getContinuityMetadataCodec();
    try {
      // Confirm queued local edits before reading the authoritative result.
      await syncQueue.flush(profileId, scope?.userId);
      if (!isCurrent()) return;
      const remoteData = await syncClient.pull(profileId);
      if (!remoteData || remoteData.profileId !== profileId || !isCurrent()) {
        if (isCurrent()) this.continuitySyncState = 'offline';
        return;
      }

      const mergeList = (local: string[], remote: typeof remoteData.myList, type: 'my_list' | 'favorites') => {
        const ids = new Set(local);
        for (const item of remote) {
          if (item.isRemoved === 1) ids.delete(item.canonicalId);
          else if (item.isRemoved === 0) ids.add(item.canonicalId);
        }
        // Offline edits and in-flight batches still belong to this account/profile.
        // Conflicted edits remain available for review while the remote value wins.
        for (const pending of syncQueue.getQueue(profileId, scope?.userId)) {
          if (pending.type !== type || pending.syncState === 'conflict') continue;
          const id = pending.data?.canonicalId;
          if (!id) continue;
          if (pending.action === 'remove' || pending.data?.isRemoved) ids.delete(id);
          else ids.add(id);
        }
        return normalizeIds([...ids]);
      };

      // 1. Minha Lista: mescla com base em tombstones
      if (Array.isArray(remoteData.myList)) {
        await this.dataStore.update(listCodec, localList => {
          if (!isCurrent()) return localList;
          return mergeList(localList, remoteData.myList, 'my_list');
        });
      }

      // 2. Favoritos: mescla com base em tombstones
      if (Array.isArray(remoteData.favorites)) {
        await this.dataStore.update(favoritesCodec, localFavs => {
          if (!isCurrent()) return localFavs;
          return mergeList(localFavs, remoteData.favorites, 'favorites');
        });
      }

      if (Array.isArray(remoteData.history)) await this.dataStore.update(historyCodec, previous => {
        if (!isCurrent()) return previous;
        const result = [...previous];
        for (const row of remoteData.history) {
          if (row.profileId !== profileId || !continuityContentType(row.contentType)) continue;
          const item: ContentItem = { id: row.canonicalId, canonicalId: row.canonicalId, type: continuityContentType(row.contentType)!,
            mediaFormat: continuityContentType(row.contentType) === ContentType.MOVIE ? 'movie' : 'series', title: row.title || row.canonicalId,
            image: row.posterUrl || '', year: row.year || 0, rating: 0 };
          const index = result.findIndex(existing => sameContent(existing, item));
          if (index < 0) result.push(item); else result[index] = mergeContinuityMetadata(result[index], item);
        }
        return result;
      });

      // 3. Progresso: converte remoteData.progress em WatchState e mescla com mergeWatchStates
      if (Array.isArray(remoteData.progress) && remoteData.progress.length > 0) {
        await this.dataStore.update(watchCodec, localWatch => {
          if (!isCurrent()) return localWatch;
          // Pending offline positions still benefit from history metadata; never acknowledge or replace their mutation.
          localWatch = { ...localWatch, items: localWatch.items.map(progress => {
            const history = remoteData.history?.find(row => row.profileId === profileId && continuityContentType(row.contentType) === progress.item.type &&
              [progress.contentId, progress.item.canonicalId, progress.item.id].includes(row.canonicalId));
            return history ? { ...progress, item: mergeContinuityMetadata(mergeContinuityMetadata(progress.item, { title: history.title, image: history.posterUrl, year: history.year }), progress.item) } : progress;
          }) };
          const remoteItems: WatchProgress[] = [];
          const remoteEpisodes: Record<string, EpisodeWatchProgress> = {};
          const serverWinners: WatchProgress[] = [];

          for (const rp of remoteData.progress) {
            if (rp.profileId !== profileId || !continuityContentType(rp.contentType) || !Number.isFinite(rp.updatedAt) ||
              !Number.isFinite(new Date(rp.updatedAt).getTime())) continue;
            const queued = syncQueue.getQueue(profileId, scope?.userId).filter(pending =>
              pending.type === 'progress' &&
              pending.data?.canonicalId === rp.canonicalId && continuityContentType(pending.data?.contentType) === continuityContentType(rp.contentType) &&
              (pending.data?.season || 0) === (rp.season || 0) && (pending.data?.episode || 0) === (rp.episode || 0));
            if (queued.some(pending => pending.syncState !== 'conflict')) continue;
            const isEpisodic = rp.season > 0 || rp.episode > 0;
            let item: ContentItem = {
              id: rp.canonicalId,
              canonicalId: rp.canonicalId,
              title: rp.canonicalId,
              type: continuityContentType(rp.contentType)!,
              mediaFormat: continuityContentType(rp.contentType) === ContentType.SERIES || isEpisodic ? 'series' : 'movie',
              rating: 0,
              year: 0,
              image: '',
            };
            const localItem = localWatch.items.find(p => sameContent(p.item, item))?.item;
            const history = Array.isArray(remoteData.history) ? remoteData.history.find(h =>
              h.profileId === profileId && h.canonicalId === rp.canonicalId && continuityContentType(h.contentType) === continuityContentType(rp.contentType)) : undefined;
            item = mergeContinuityMetadata(item, localItem);
            item = mergeContinuityMetadata(item, { title: history?.title, image: history?.posterUrl, year: history?.year });
            item = mergeContinuityMetadata(item, localItem);

            const wp: WatchProgress = {
              contentId: rp.canonicalId,
              item,
              season: isEpisodic ? rp.season : undefined,
              episode: isEpisodic ? rp.episode : undefined,
              currentTime: rp.positionSec,
              duration: rp.durationSec,
              percentage: rp.progressPercent,
              updatedAt: new Date(rp.updatedAt).toISOString(),
              remoteVersion: rp.version,
            };

            const normalized = normalizeProgress(wp);
            if (normalized) {
              remoteItems.push(normalized);
              if (queued.some(pending => pending.syncState === 'conflict')) serverWinners.push(normalized);
              if (isEpisodic) {
                const epKey = episodeKey(contentKey(item), rp.season, rp.episode);
                remoteEpisodes[epKey] = {
                  contentId: rp.canonicalId,
                  season: rp.season,
                  episode: rp.episode,
                  currentTime: rp.positionSec,
                  duration: rp.durationSec,
                  percentage: rp.progressPercent,
                  updatedAt: new Date(rp.updatedAt).toISOString(),
                  remoteVersion: rp.version,
                  contentKey: contentKey(item),
                };
              }
            }
          }

          const remoteState: WatchState = { items: remoteItems, episodes: remoteEpisodes };
          // Rejected payloads remain in the recovery queue; the visible resume point follows the server.
          const localState: WatchState = {
            items: localWatch.items.filter(local => !serverWinners.some(remote =>
              sameContent(local.item, remote.item) && local.season === remote.season && local.episode === remote.episode)),
            episodes: Object.fromEntries(Object.entries(localWatch.episodes).filter(([, local]) =>
              !serverWinners.some(remote => local.season === remote.season && local.episode === remote.episode &&
                (local.contentKey ? local.contentKey === contentKey(remote.item) : local.contentId === remote.contentId)))),
          };
          const merged = mergeWatchStates(localState, remoteState);
          if (isCurrent()) this.applyWatchState(merged);
          return merged;
        });
      }

      if (isCurrent()) this.continuitySyncState = 'synced';
    } catch {
      if (isCurrent()) this.continuitySyncState = 'offline';
      console.warn("Não foi possível atualizar o cache remoto do perfil; dados locais preservados.");
    } finally {
      if (isCurrent() && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('zapitv_progress_updated'));
    }
  }

  /**
   * Atualização leve em segundo plano disparada por eventos de ciclo de vida
   * (focus, visibilitychange, online, reconexão de rede ou intervalo).
   * Protegido com throttle de no mínimo 30 segundos para não estourar a cota do Turso.
   */
  public async refreshProgressFromRemote(force = false): Promise<void> {
    if (!this.currentScope?.profileId) return;
    const now = Date.now();
    if (!force && now - this.lastPeriodicRefresh < 30_000) return;
    this.lastPeriodicRefresh = now;
    await this.hydrateRemoteProfile(this.currentScope.profileId);
  }

  /**
   * Registra observadores automáticos de foco, visibilidade e conectividade online
   */
  public initLifecycleSync(): () => void {
    if (typeof window === 'undefined') return () => {};
    if (this.lifecycleSyncCleanup) {
      this.lifecycleSyncCleanup();
      this.lifecycleSyncCleanup = null;
    }

    const handleResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.refreshProgressFromRemote().catch(() => {});
      }
    };

    const handleOnline = () => {
      this.refreshProgressFromRemote(true).catch(() => {});
    };

    const handleFocus = () => {
      this.refreshProgressFromRemote().catch(() => {});
    };

    window.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.refreshProgressFromRemote().catch(() => {});
      }
    }, 45_000);

    const cleanup = () => {
      window.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };

    this.lifecycleSyncCleanup = cleanup;
    return cleanup;
  }

  private getWatchCodec() {
    return getWatchStateCodec(this.currentScope);
  }

  private getFavoritesCodec() {
    return getListCodec('favorites', this.currentScope);
  }

  private getMyListCodec() {
    return getListCodec('mylist', this.currentScope);
  }

  private applyWatchState(state: WatchState): void {
    this.itemProgressCache = new Map(state.items.map(p => [contentKey(p.item), p]));
    this.episodeProgressCache = new Map(Object.entries(state.episodes));
  }

  public purgeBannedItemsFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // 1. Purga itens de progresso em memória
      for (const [key, progress] of this.itemProgressCache.entries()) {
        if (bannedContentRegistry.isBannedKeyOrId(progress.contentId)) this.itemProgressCache.delete(key);
      }
      for (const [key, progress] of this.episodeProgressCache.entries()) {
        if (bannedContentRegistry.isBannedKeyOrId(progress.contentId)) this.episodeProgressCache.delete(key);
      }

      // 2. Limpa registros globais no localStorage via registro centralizado
      bannedContentRegistry.purgeStorage();
    } catch {}
  }

  public async syncFromDb(): Promise<void> {
    const epoch = this.scopeEpoch;
    const state = await this.dataStore.read(this.getWatchCodec());
    if (this.scopeEpoch === epoch) this.applyWatchState(state);
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
      if (itemOrId.canonicalId) keys.add(itemOrId.canonicalId);
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
    const candidates = [...this.itemProgressCache.values()].filter(p => {
      if (typeof itemOrId === 'object') return sameContent(p.item, itemOrId);
      const keys = this.getCandidateKeys(itemOrId);
      return keys.includes(p.contentId) || this.getCandidateKeys(p.item).some(key => keys.includes(key));
    });
    // A string without a media type can be ambiguous (TMDB movie and TV IDs overlap).
    return candidates.length === 1 ? candidates[0] : null;
  }

  public resolveEpisodeWatchProgress(
    itemOrId: string | ContentItem,
    season: number,
    episode: number
  ): EpisodeWatchProgress | null {
    if (typeof itemOrId === 'object' && (itemOrId.type === ContentType.MOVIE || itemOrId.mediaFormat === 'movie')) return null;
    const parent = this.resolveWatchProgress(itemOrId);
    const ids = this.getCandidateKeys(itemOrId);
    if (!parent && typeof itemOrId === 'string' && [...this.itemProgressCache.values()].some(p =>
      ids.includes(p.contentId) || this.getCandidateKeys(p.item).some(id => ids.includes(id)))) return null;
    const key = parent ? contentKey(parent.item) : typeof itemOrId === 'object' ? contentKey(itemOrId) : undefined;
    if (key) {
      const found = this.episodeProgressCache.get(episodeKey(key, season, episode));
      if (found) return found;
    }
    const candidates = [...this.episodeProgressCache.values()].filter(p =>
      p.season === season && p.episode === episode && ids.includes(p.contentId) &&
      (p.contentKey ? p.contentKey === key : typeof itemOrId === 'string' && !key));
    return candidates.length === 1 ? candidates[0] : null;
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
      ? itemOrId.mediaFormat !== 'movie' && (itemOrId.type === ContentType.SERIES || itemOrId.type === ContentType.ANIME || Boolean(itemOrId.seasonsCount && itemOrId.seasonsCount > 0))
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

  public getFavorites(): Promise<string[]> {
    return this.dataStore.read(this.getFavoritesCodec());
  }

  public async saveFavorites(favorites: string[]): Promise<void> {
    await this.dataStore.update(this.getFavoritesCodec(), () => normalizeIds(favorites));
    recommendationEngine.invalidateCache();
    hybridRecommendationEngine.invalidateCache();
  }

  public async toggleFavorite(id: string): Promise<string[]> {
    const scope = this.currentScope;
    let wasRemoved = false;
    const next = await this.dataStore.update(this.getFavoritesCodec(), list => {
      wasRemoved = list.includes(id);
      return wasRemoved ? list.filter(value => value !== id) : [...list, id];
    });
    recommendationEngine.invalidateCache();
    hybridRecommendationEngine.invalidateCache();

    if (scope?.profileId) {
      syncQueue.enqueue(
        scope.profileId,
        {
          type: 'favorites',
          action: wasRemoved ? 'remove' : 'set',
          data: { canonicalId: id, isRemoved: wasRemoved },
        },
        scope.userId
      );
    }

    return next;
  }

  public getMyList(): Promise<string[]> {
    return this.dataStore.read(this.getMyListCodec());
  }

  public async saveMyList(ids: string[]): Promise<void> {
    await this.dataStore.update(this.getMyListCodec(), () => normalizeIds(ids));
  }

  public toggleMyList(id: string): Promise<string[]> {
    const scope = this.currentScope;
    let wasRemoved = false;
    return this.dataStore.update(this.getMyListCodec(), list => {
      wasRemoved = list.includes(id);
      const nextList = wasRemoved ? list.filter(value => value !== id) : [...list, id];

      if (scope?.profileId) {
        syncQueue.enqueue(
          scope.profileId,
          {
            type: 'my_list',
            action: wasRemoved ? 'remove' : 'set',
            data: { canonicalId: id, isRemoved: wasRemoved },
          },
          scope.userId
        );
      }

      return nextList;
    });
  }

  private getContinuityMetadataCodec(): DataCodec<ContentItem[]> {
    return { key: scopedKey('zapitv_continuity_metadata_v1', this.currentScope), legacyKeys: [],
      isValid: Array.isArray, normalize: value => Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && Object.values(ContentType).includes(item.type)) : [],
      migrate: () => [] };
  }

  public getContinuityMetadata(): Promise<ContentItem[]> { return this.dataStore.read(this.getContinuityMetadataCodec()); }

  public async getContinueWatching(): Promise<WatchProgress[]> {
    const epoch = this.scopeEpoch;
    await this.ready;
    if (this.scopeEpoch !== epoch) return [];
    await this.syncFromDb();
    if (this.scopeEpoch !== epoch) return [];
    return [...this.itemProgressCache.values()];
  }

  public async saveProgress(progress: WatchProgress): Promise<void> {
    const normalizedProgress = normalizeProgress(progress);
    if (!normalizedProgress) return;
    const scope = this.currentScope;
    const epoch = this.scopeEpoch;
    const codec = this.getWatchCodec();
    await this.ready;
    const state = await this.dataStore.update(codec, current => {
      const existing = current.items.find(p => sameContent(p.item, normalizedProgress.item));
      const episodes = { ...current.episodes };
      let episodeChanged = false;
      if (normalizedProgress.season !== undefined && normalizedProgress.episode !== undefined) {
        const { item, ...episode } = normalizedProgress;
        const key = episodeKey(contentKey(item), normalizedProgress.season, normalizedProgress.episode);
        if (!episodes[key] || Date.parse(episodes[key].updatedAt) < Date.parse(episode.updatedAt)) {
          episodes[key] = { ...episode, season: normalizedProgress.season, episode: normalizedProgress.episode, contentKey: contentKey(item) };
          episodeChanged = true;
        }
      }
      if (existing && Date.parse(existing.updatedAt) > Date.parse(normalizedProgress.updatedAt)) {
        return episodeChanged ? mergeWatchStates({ items: current.items, episodes }) : current;
      }
      if (existing && existing.updatedAt === normalizedProgress.updatedAt && existing.currentTime === normalizedProgress.currentTime &&
        existing.duration === normalizedProgress.duration && !episodeChanged) return current;
      const items = [...current.items];
      const index = existing ? items.indexOf(existing) : -1;
      if (index >= 0) items[index] = normalizedProgress;
      else items.unshift(normalizedProgress);
      return mergeWatchStates({ items, episodes }, { items: existing ? [existing] : [], episodes: {} });
    });
    if (this.scopeEpoch === epoch) this.applyWatchState(state);
    const percentage = normalizedProgress.percentage;

    // 5. Emite evento global para atualizar miniaturas e cards instantaneamente sem recarregar a tela
    if (this.scopeEpoch === epoch && typeof window !== 'undefined') {
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
    if (this.scopeEpoch === epoch && normalizedProgress.item) {
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

    // 7. Enfileira sincronização de progresso e histórico se perfil autenticado estiver ativo
    // Aplica debounce e controle de taxa de escrita (8-15 escritas/hora) para proteção da cota do Turso
    if (scope?.profileId) {
      const canonicalId = normalizedProgress.item?.canonicalId || normalizedProgress.contentId;
      const contentType = normalizedProgress.item?.type || 'movie';
      const season = normalizedProgress.season || 0;
      const episode = normalizedProgress.episode || 0;
      const positionSec = Math.floor(normalizedProgress.currentTime);
      const durationSec = Math.floor(normalizedProgress.duration);
      const isCompleted = normalizedProgress.percentage >= 92 ? 1 : 0;
      const eventTime = Date.parse(normalizedProgress.updatedAt) || Date.now();

      const progressKey = JSON.stringify([scope.userId, scope.profileId, contentType, canonicalId, season, episode]);
      const lastProgressSync = this.lastRemoteProgressSync.get(progressKey) || 0;
      const lastRecordedPos = this.lastRemotePosition.get(progressKey) ?? -1;
      
      const isInitialStart = lastProgressSync === 0 && positionSec > 0;
      const isFirstCompleted = isCompleted === 1 && !this.completedSynced.has(progressKey);
      const steadyCheckpointElapsed = eventTime - lastProgressSync >= 300_000; // checkpoint regular a cada 5 min (~12/h)

      // Detecta seek intencional: salto de posição desproporcional ao tempo decorrido
      const posDelta = Math.abs(positionSec - lastRecordedPos);
      const timeDeltaSec = lastProgressSync > 0 ? (eventTime - lastProgressSync) / 1000 : 0;
      const isSeekJump = lastRecordedPos >= 0 && posDelta > 30 && Math.abs(posDelta - timeDeltaSec) > 15;

      if (isInitialStart || isFirstCompleted || steadyCheckpointElapsed || isSeekJump) {
        this.lastRemoteProgressSync.set(progressKey, eventTime);
        this.lastRemotePosition.set(progressKey, positionSec);
        if (isFirstCompleted) {
          this.completedSynced.add(progressKey);
        }

        syncQueue.enqueue(
          scope.profileId,
          {
            type: 'progress',
            action: 'save',
            data: {
              canonicalId,
              contentType,
              season,
              episode,
              positionSec,
              durationSec,
              progressPercent: normalizedProgress.percentage,
              isCompleted,
              updatedAt: eventTime,
            },
          },
          scope.userId
        );
      }

      // Histórico é registrado na inicialização, na conclusão ou em intervalos de 60 minutos,
      // evitando escritas redundantes a cada segundo
      const lastHistSync = this.lastRemoteHistorySync.get(progressKey) || 0;
      if (lastHistSync === 0 || isFirstCompleted || eventTime - lastHistSync >= 60 * 60 * 1000) {
        this.lastRemoteHistorySync.set(progressKey, eventTime);

        syncQueue.enqueue(
          scope.profileId,
          {
            type: 'history',
            action: 'save',
            data: {
              canonicalId,
              contentType,
              season,
              episode,
              title: normalizedProgress.item?.title,
              posterUrl: contentPoster(normalizedProgress.item),
              year: normalizedProgress.item?.year,
              watchedAt: eventTime,
              updatedAt: eventTime,
            },
          },
          scope.userId
        );
      }
    }
  }

  public async getProgress(contentId: string): Promise<WatchProgress | null> {
    await this.ready;
    return this.resolveWatchProgress(contentId);
  }

  public async deleteProgress(itemOrId: string | ContentItem): Promise<void> {
    const epoch = this.scopeEpoch;
    const codec = this.getWatchCodec();
    await this.ready;
    const state = await this.dataStore.update(codec, current => {
      const matches = current.items.filter(p => typeof itemOrId === 'object' ? sameContent(p.item, itemOrId) : p.contentId === itemOrId);
      if (matches.length !== 1) return current;
      const target = matches[0];
      const unambiguousId = current.items.filter(p => p.contentId === target.contentId).length === 1;
      return {
        items: current.items.filter(p => p !== target),
        episodes: Object.fromEntries(Object.entries(current.episodes).filter(([, p]) =>
          p.contentKey ? p.contentKey !== contentKey(target.item) : !unambiguousId || p.contentId !== target.contentId))
      };
    });
    if (this.scopeEpoch === epoch) {
      this.applyWatchState(state);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('zapitv_progress_updated'));
    }
  }

  public async clearAllProgress(): Promise<void> {
    const epoch = this.scopeEpoch;
    const codec = this.getWatchCodec();
    await this.ready;
    const state = await this.dataStore.update(codec, () => ({ items: [], episodes: {} }));
    if (this.scopeEpoch === epoch) {
      this.applyWatchState(state);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('zapitv_progress_updated'));
    }
    await this.dataStore.removeLegacy(codec);
  }

  public async exportDataAsJson(): Promise<string> {
    await this.getContinueWatching();
    let providers: unknown[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem('zapitv_providers_config') || '[]');
      if (Array.isArray(saved)) providers = saved;
    } catch {}
    const data = {
      version: '2.0', exportDate: new Date().toISOString(),
      favorites: await this.getFavorites(), myList: await this.getMyList(),
      progress: [...this.itemProgressCache.values()],
      episodeProgress: Object.fromEntries(this.episodeProgressCache), providers
    };
    return JSON.stringify(data, null, 2);
  }

  public async importDataFromJson(jsonString: string): Promise<boolean> {
    const epoch = this.scopeEpoch;
    const watchCodec = this.getWatchCodec(), favoritesCodec = this.getFavoritesCodec(), myListCodec = this.getMyListCodec();
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object' || Array.isArray(data) ||
        !['progress', 'episodeProgress', 'favorites', 'myList', 'providers'].some(key => key in data) ||
        (data.version !== undefined && !['1.0', '1.1', '2.0'].includes(String(data.version))) ||
        (data.episodeProgress !== undefined && (!data.episodeProgress || typeof data.episodeProgress !== 'object' || Array.isArray(data.episodeProgress))) ||
        (data.episodeProgress && Object.values(data.episodeProgress).some(p => !normalizeEpisode(p))) ||
        (data.progress !== undefined && (!Array.isArray(data.progress) || data.progress.some((p: unknown) => !normalizeProgress(p)))) ||
        (data.favorites !== undefined && (!Array.isArray(data.favorites) || data.favorites.some((id: unknown) => typeof id !== 'string'))) ||
        (data.myList !== undefined && (!Array.isArray(data.myList) || data.myList.some((id: unknown) => typeof id !== 'string')))) return false;
      await this.ready;
      if (data.progress || data.episodeProgress) {
        const imported = normalizeWatchState({ items: data.progress, episodes: data.episodeProgress });
        const state = await this.dataStore.update(watchCodec, current => mergeWatchStates(current, imported));
        if (this.scopeEpoch === epoch) this.applyWatchState(state);
      }
      if (data.favorites) await this.dataStore.update(favoritesCodec, list => normalizeIds([...list, ...data.favorites]));
      if (data.myList) await this.dataStore.update(myListCodec, list => normalizeIds([...list, ...data.myList]));
      if (Array.isArray(data.providers)) {
        try { localStorage.setItem('zapitv_providers_config', JSON.stringify(data.providers)); } catch { return false; }
      }
      if (this.scopeEpoch === epoch && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('zapitv_progress_updated'));
      return true;
    } catch {
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
