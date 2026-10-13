import { LiveChannel, LiveChannelCategory, ChannelHealthStatus, RawChannelInput } from './types';
import { OfficialChannelProvider } from './OfficialChannelProvider';
import { M3UProviderAdapter } from './M3UProviderAdapter';
import { StremioLiveTVAdapter } from './StremioLiveTVAdapter';
import { channelNormalizer } from './ChannelNormalizer';
import { liveStreamValidator } from './LiveStreamValidator';

export class LiveTVProviderRegistry {
  private static instance: LiveTVProviderRegistry;
  private channels: LiveChannel[] = [];
  private listeners = new Set<(channels: LiveChannel[]) => void>();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Adaptadores registrados
  private m3uAdapters: M3UProviderAdapter[] = [];
  private stremioAdapters: StremioLiveTVAdapter[] = [];

  private constructor() {
    // Carrega canais oficiais e normaliza inicialmente para disponibilidade síncrona imediata
    const officialRaw = OfficialChannelProvider.getOfficialChannels();
    this.channels = channelNormalizer.normalizeAndDeduplicate(officialRaw);
    
    // Registra adaptadores padrão
    this.registerDefaultAdapters();
  }

  public static getInstance(): LiveTVProviderRegistry {
    if (!LiveTVProviderRegistry.instance) {
      LiveTVProviderRegistry.instance = new LiveTVProviderRegistry();
    }
    return LiveTVProviderRegistry.instance;
  }

  private registerDefaultAdapters(): void {
    // Registra adaptador M3U para canais públicos brasileiros
    this.m3uAdapters.push(new M3UProviderAdapter('IPTV Brasil Aberto'));

    // Registra adaptador Stremio Live Addon (AIOLiveTV / IPTV Addon Stremio endpoints)
    this.stremioAdapters.push(new StremioLiveTVAdapter('/api/stremio/live'));
  }

  /**
   * Inicializa e agrega todos os provedores em segundo plano
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await this.refreshCatalog();
      } finally {
        this.isInitialized = true;
      }
    })();

    return this.initPromise;
  }

  /**
   * Recarrega e agrega catálogos de todos os provedores configurados
   */
  public async refreshCatalog(): Promise<LiveChannel[]> {
    const rawList: RawChannelInput[] = [];

    // 1. Provedor Oficial e Transmissões Abertas Verificadas
    const official = OfficialChannelProvider.getOfficialChannels();
    rawList.push(...official);

    // 2. Provedores M3U externos (se configurados ou com cache)
    for (const m3u of this.m3uAdapters) {
      try {
        const m3uChannels = await m3u.fetchAndParse();
        if (m3uChannels.length > 0) {
          rawList.push(...m3uChannels);
        }
      } catch {}
    }

    // 3. Provedores Stremio Live Addon
    for (const stremio of this.stremioAdapters) {
      try {
        const stremioChannels = await stremio.fetchCatalogChannels();
        if (stremioChannels.length > 0) {
          rawList.push(...stremioChannels);
        }
      } catch {}
    }

    // Normalizar e deduplicar em uma única lista canônica
    const unified = channelNormalizer.normalizeAndDeduplicate(rawList);

    // Atualiza canais internos mantendo status prévios se existirem
    const prevMap = new Map(this.channels.map(c => [c.id, c.status]));
    for (const ch of unified) {
      if (prevMap.has(ch.id)) {
        ch.status = prevMap.get(ch.id)!;
      }
    }

    this.channels = unified;
    this.notify();
    return this.channels;
  }

  public getAllChannels(): LiveChannel[] {
    return [...this.channels];
  }

  public getChannelById(id: string): LiveChannel | undefined {
    const clean = id.toLowerCase().replace(/-/g, '');
    return this.channels.find(c => 
      c.id === id || 
      c.canonicalId === id ||
      c.id.toLowerCase().replace(/-/g, '') === clean ||
      (c.epgId && c.epgId.toLowerCase().replace(/-/g, '').startsWith(clean))
    );
  }

  public getChannelsByCategory(category: LiveChannelCategory, favoriteIds: string[] = []): LiveChannel[] {
    if (category === 'todos') {
      return this.channels;
    }
    if (category === 'favoritos') {
      return this.channels.filter(c => favoriteIds.includes(c.id));
    }
    return this.channels.filter(c => c.category === category);
  }

  public getAvailableCount(): number {
    return this.channels.filter(c => c.status === 'AVAILABLE').length;
  }

  public searchChannels(query: string): LiveChannel[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.channels;

    return this.channels.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.categoryLabel.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  }

  public updateChannelStatus(channelId: string, status: ChannelHealthStatus): void {
    const ch = this.channels.find(c => c.id === channelId || c.canonicalId === channelId);
    if (ch && ch.status !== status) {
      ch.status = status;
      ch.lastChecked = Date.now();
      this.notify();
    }
  }

  public subscribe(listener: (channels: LiveChannel[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.channels]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const copy = [...this.channels];
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch {}
    }
  }
}

export const liveTvProviderRegistry = LiveTVProviderRegistry.getInstance();
