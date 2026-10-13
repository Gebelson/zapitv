import { liveTvPreferences, LiveTvPreferencesService } from './liveTvPreferences';
import { LiveChannelCategory, LiveTvPreferencesState } from './types';

export class ChannelFavoritesService {
  private static instance: ChannelFavoritesService;

  public static getInstance(): ChannelFavoritesService {
    if (!ChannelFavoritesService.instance) {
      ChannelFavoritesService.instance = new ChannelFavoritesService();
    }
    return ChannelFavoritesService.instance;
  }

  public getFavorites(): string[] {
    return liveTvPreferences.getState().favoriteChannelIds;
  }

  public isFavorite(channelId: string): boolean {
    return liveTvPreferences.isFavorite(channelId);
  }

  public toggleFavorite(channelId: string): boolean {
    return liveTvPreferences.toggleFavorite(channelId);
  }

  public setLastWatched(channelId: string): void {
    liveTvPreferences.setLastWatched(channelId);
  }

  public getLastWatched(): string | null {
    return liveTvPreferences.getState().lastWatchedChannelId;
  }

  public setSelectedCategory(category: LiveChannelCategory): void {
    liveTvPreferences.setSelectedCategory(category);
  }

  public getSelectedCategory(): LiveChannelCategory {
    return liveTvPreferences.getState().selectedCategory;
  }

  public subscribe(listener: (state: LiveTvPreferencesState) => void): () => void {
    return liveTvPreferences.subscribe(listener);
  }
}

export const channelFavoritesService = ChannelFavoritesService.getInstance();
