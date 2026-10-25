import { LiveChannel, LiveChannelCategory, ChannelHealthStatus, isChannelVerified } from './types';
import { liveTvProviderRegistry, LiveTVProviderRegistry } from './LiveTVProviderRegistry';

export const CATEGORY_DEFINITIONS: Array<{ id: LiveChannelCategory; label: string }> = [
  { id: 'todos', label: 'Todos os Canais' },
  { id: 'favoritos', label: 'Favoritos' },
  { id: 'aberta', label: 'TV Aberta' },
  { id: 'noticias', label: 'Notícias' },
  { id: 'esportes', label: 'Esportes' },
  { id: 'filmes_series', label: 'Filmes & Séries' },
  { id: 'infantil', label: 'Infantil' },
  { id: 'cultura', label: 'Cultura' },
  { id: 'educacao', label: 'Educação' },
  { id: 'musica', label: 'Música' },
  { id: 'regionais', label: 'Regionais' },
  { id: 'documentarios', label: 'Documentários' }
];

export class ChannelRegistry {
  private static instance: ChannelRegistry;

  public static getInstance(): ChannelRegistry {
    if (!ChannelRegistry.instance) {
      ChannelRegistry.instance = new ChannelRegistry();
    }
    return ChannelRegistry.instance;
  }

  public getAllChannels(): LiveChannel[] {
    return liveTvProviderRegistry.getAllChannels();
  }

  public getVerifiedChannels(): LiveChannel[] {
    return liveTvProviderRegistry.getVerifiedChannels();
  }

  public getChannelById(id: string): LiveChannel | undefined {
    return liveTvProviderRegistry.getChannelById(id);
  }

  public getChannelsByCategory(category: LiveChannelCategory | string, favoriteIds: string[] = []): LiveChannel[] {
    return liveTvProviderRegistry.getChannelsByCategory(category as LiveChannelCategory, favoriteIds);
  }

  public getVerifiedAvailableChannels(): LiveChannel[] {
    return liveTvProviderRegistry.getVerifiedChannels();
  }

  public getAvailableCount(): number {
    return liveTvProviderRegistry.getAvailableCount();
  }

  public updateChannelStatus(id: string, status: ChannelHealthStatus): void {
    liveTvProviderRegistry.updateChannelStatus(id, status);
  }

  public subscribe(listener: (channels: LiveChannel[]) => void): () => void {
    return liveTvProviderRegistry.subscribe(listener);
  }
}

export const channelRegistry = ChannelRegistry.getInstance();
export const VERIFIED_CHANNELS: LiveChannel[] = liveTvProviderRegistry.getVerifiedChannels();
export { liveTvProviderRegistry, LiveTVProviderRegistry };
