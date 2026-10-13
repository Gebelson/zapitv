import { LiveTvPreferencesState, LiveChannelCategory } from './types';

const STORAGE_KEY = 'zapitv_live_tv_prefs_v1';

const DEFAULT_PREFERENCES: LiveTvPreferencesState = {
  favoriteChannelIds: ['tv-cultura', 'record-news'],
  lastWatchedChannelId: 'tv-cultura',
  selectedCategory: 'todos',
  preferredQuality: 'Auto',
  volume: 0.8,
  isMuted: false,
  activeMode: 'programas'
};

export class LiveTvPreferencesService {
  private static instance: LiveTvPreferencesService;
  private state: LiveTvPreferencesState;
  private listeners = new Set<(state: LiveTvPreferencesState) => void>();

  constructor() {
    this.state = this.loadFromStorage();
  }

  public static getInstance(): LiveTvPreferencesService {
    if (!LiveTvPreferencesService.instance) {
      LiveTvPreferencesService.instance = new LiveTvPreferencesService();
    }
    return LiveTvPreferencesService.instance;
  }

  private loadFromStorage(): LiveTvPreferencesState {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_PREFERENCES };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          favoriteChannelIds: Array.isArray(parsed.favoriteChannelIds) ? parsed.favoriteChannelIds : DEFAULT_PREFERENCES.favoriteChannelIds
        };
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_PREFERENCES };
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore
    }
  }

  private notify(): void {
    this.saveToStorage();
    for (const listener of this.listeners) {
      try {
        listener({ ...this.state });
      } catch (e) {
        console.error(e);
      }
    }
  }

  public getState(): LiveTvPreferencesState {
    return { ...this.state };
  }

  public subscribe(listener: (state: LiveTvPreferencesState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  public isFavorite(channelId: string): boolean {
    return this.state.favoriteChannelIds.includes(channelId);
  }

  public toggleFavorite(channelId: string): boolean {
    const isFav = this.isFavorite(channelId);
    if (isFav) {
      this.state.favoriteChannelIds = this.state.favoriteChannelIds.filter(id => id !== channelId);
    } else {
      this.state.favoriteChannelIds = [...this.state.favoriteChannelIds, channelId];
    }
    this.notify();
    return !isFav;
  }

  public setLastWatched(channelId: string): void {
    this.state.lastWatchedChannelId = channelId;
    this.notify();
  }

  public setSelectedCategory(cat: LiveChannelCategory): void {
    this.state.selectedCategory = cat;
    this.notify();
  }

  public setPreferredQuality(quality: string): void {
    this.state.preferredQuality = quality;
    this.notify();
  }

  public setVolume(vol: number): void {
    this.state.volume = Math.max(0, Math.min(1, vol));
    this.notify();
  }

  public setIsMuted(muted: boolean): void {
    this.state.isMuted = muted;
    this.notify();
  }

  public setActiveMode(mode: 'programas' | 'televisao'): void {
    this.state.activeMode = mode;
    this.notify();
  }
}

export const liveTvPreferences = LiveTvPreferencesService.getInstance();
