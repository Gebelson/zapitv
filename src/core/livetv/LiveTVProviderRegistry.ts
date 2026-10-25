import { LiveChannel, LiveChannelCategory, ChannelHealthStatus, RawChannelInput } from './types';
import { OfficialChannelProvider } from './OfficialChannelProvider';
import { M3UProviderAdapter } from './M3UProviderAdapter';
import { StremioLiveTVAdapter } from './StremioLiveTVAdapter';
import { channelNormalizer } from './ChannelNormalizer';
import { liveStreamValidator } from './LiveStreamValidator';

interface ChannelOverride {
  customStreamUrl?: string;
  backupStreamUrls?: string[];
  isEnabled?: boolean;
}

const STORAGE_KEY_PROVIDERS = 'zapitv_livetv_providers_v2';
const STORAGE_KEY_OVERRIDES = 'zapitv_livetv_channel_overrides_v2';

export class LiveTVProviderRegistry {
  private static instance: LiveTVProviderRegistry;
  private channels: LiveChannel[] = [];
  private listeners = new Set<(channels: LiveChannel[]) => void>();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Adaptadores registrados
  private m3uAdapters: M3UProviderAdapter[] = [];
  private stremioAdapters: StremioLiveTVAdapter[] = [];

  // Overrides de administração (canais editados/desativados pelo admin)
  private channelOverrides = new Map<string, ChannelOverride>();

  private constructor() {
    this.loadOverrides();
    this.registerDefaultAdapters();

    // Carrega canais oficiais e normaliza inicialmente para disponibilidade síncrona imediata
    const officialRaw = OfficialChannelProvider.getOfficialChannels();
    this.channels = channelNormalizer.normalizeAndDeduplicate(officialRaw);
    this.applyOverridesToChannels();
  }

  public static getInstance(): LiveTVProviderRegistry {
    if (!LiveTVProviderRegistry.instance) {
      LiveTVProviderRegistry.instance = new LiveTVProviderRegistry();
    }
    return LiveTVProviderRegistry.instance;
  }

  private registerDefaultAdapters(): void {
    let loadedFromStorage = false;
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PROVIDERS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.m3u)) {
            for (const item of parsed.m3u) {
              this.m3uAdapters.push(new M3UProviderAdapter(item.name, item.url, item.id, item.enabled));
            }
            loadedFromStorage = true;
          }
          if (Array.isArray(parsed.stremio)) {
            for (const item of parsed.stremio) {
              this.stremioAdapters.push(new StremioLiveTVAdapter(item.url, item.id, item.enabled));
            }
          }
        }
      } catch {}
    }

    if (!loadedFromStorage || this.m3uAdapters.length === 0) {
      // Registra adaptador M3U padrão para canais públicos brasileiros
      this.m3uAdapters.push(new M3UProviderAdapter(
        'IPTV Aberto (Brasil)',
        M3UProviderAdapter.DEFAULT_BR_M3U,
        'm3u-iptv-brasil-default',
        true
      ));
    }
  }

  private persistProviders(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = {
        m3u: this.m3uAdapters.map(a => ({
          id: a.getId(),
          name: a.getName(),
          url: a.getUrl(),
          enabled: a.isEnabled()
        })),
        stremio: this.stremioAdapters.map(a => ({
          id: a.getId(),
          name: a.getName(),
          url: a.getUrl(),
          enabled: a.isEnabled()
        }))
      };
      localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(data));
    } catch {}
  }

  private loadOverrides(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OVERRIDES);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.channelOverrides = new Map(Object.entries(parsed));
      }
    } catch {}
  }

  private persistOverrides(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const obj = Object.fromEntries(this.channelOverrides);
      localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(obj));
    } catch {}
  }

  private applyOverridesToChannels(): void {
    for (const channel of this.channels) {
      const override = this.channelOverrides.get(channel.id);
      if (override) {
        if (override.customStreamUrl) {
          if (channel.streamUrl !== override.customStreamUrl) {
            channel.streamUrl = override.customStreamUrl;
            // Invalida status de disponibilidade prévio se a URL foi alterada
            channel.status = 'CHECKING';
          }
          if (!channel.sources) channel.sources = [];
          if (!channel.sources.some(s => s.url === override.customStreamUrl)) {
            channel.sources.unshift({
              id: `${channel.id}-custom`,
              url: override.customStreamUrl,
              quality: '1080p',
              provider: 'Admin Custom',
              format: override.customStreamUrl.includes('.mpd') ? 'dash' : 'hls',
              isOfficial: true,
              resolutionHeight: 1080
            });
          }
        }
        if (override.backupStreamUrls) {
          channel.backupStreamUrls = [...override.backupStreamUrls];
        }
        if (typeof override.isEnabled === 'boolean') {
          channel.isEnabled = override.isEnabled;
        }
      }
    }
  }

  public getM3UAdapters(): M3UProviderAdapter[] {
    return [...this.m3uAdapters];
  }

  public getStremioAdapters(): StremioLiveTVAdapter[] {
    return [...this.stremioAdapters];
  }

  public addM3UAdapter(name: string, url: string): M3UProviderAdapter {
    const adapter = new M3UProviderAdapter(name, url);
    this.m3uAdapters.push(adapter);
    this.persistProviders();
    this.refreshCatalog().catch(() => {});
    return adapter;
  }

  public removeM3UAdapter(id: string): void {
    this.m3uAdapters = this.m3uAdapters.filter(a => a.getId() !== id);
    this.persistProviders();
    this.refreshCatalog().catch(() => {});
  }

  public toggleM3UAdapter(id: string, enabled: boolean): void {
    const adapter = this.m3uAdapters.find(a => a.getId() !== id);
    if (adapter) {
      adapter.setEnabled(enabled);
      this.persistProviders();
      this.refreshCatalog().catch(() => {});
    }
  }

  public updateChannelStreamUrl(channelId: string, newUrl: string): void {
    const existing = this.channelOverrides.get(channelId) || {};
    existing.customStreamUrl = newUrl;
    this.channelOverrides.set(channelId, existing);
    this.persistOverrides();

    const ch = this.channels.find(c => c.id === channelId);
    if (ch) {
      if (ch.streamUrl !== newUrl) {
        ch.streamUrl = newUrl;
        // Invalida status antigo (não transferir AVAILABLE automaticamente para nova URL)
        ch.status = 'CHECKING';
      }
      this.notify();
    }
  }

  public addChannelBackupUrl(channelId: string, backupUrl: string): void {
    const existing = this.channelOverrides.get(channelId) || {};
    const list = existing.backupStreamUrls || [];
    if (!list.includes(backupUrl)) {
      list.push(backupUrl);
      existing.backupStreamUrls = list;
      this.channelOverrides.set(channelId, existing);
      this.persistOverrides();

      const ch = this.channels.find(c => c.id === channelId);
      if (ch) {
        ch.backupStreamUrls = list;
        this.notify();
      }
    }
  }

  public toggleChannelEnabled(channelId: string, enabled: boolean): void {
    const existing = this.channelOverrides.get(channelId) || {};
    existing.isEnabled = enabled;
    this.channelOverrides.set(channelId, existing);
    this.persistOverrides();

    const ch = this.channels.find(c => c.id === channelId);
    if (ch) {
      ch.isEnabled = enabled;
      this.notify();
    }
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

    // 2. Provedores M3U externos
    for (const m3u of this.m3uAdapters) {
      if (m3u.isEnabled()) {
        try {
          const m3uChannels = await m3u.fetchAndParse();
          if (m3uChannels.length > 0) {
            rawList.push(...m3uChannels);
          }
        } catch {}
      }
    }

    // 3. Provedores Stremio Live Addon
    for (const stremio of this.stremioAdapters) {
      if (stremio.isEnabled()) {
        try {
          const stremioChannels = await stremio.fetchCatalogChannels();
          if (stremioChannels.length > 0) {
            rawList.push(...stremioChannels);
          }
        } catch {}
      }
    }

    // Normalizar e deduplicar em uma única lista canônica
    const unified = channelNormalizer.normalizeAndDeduplicate(rawList);

    // Atualiza canais internos mantendo status prévios apenas se a URL principal for a mesma
    const prevMap = new Map(this.channels.map(c => [c.id, { status: c.status, streamUrl: c.streamUrl }]));
    for (const ch of unified) {
      const prev = prevMap.get(ch.id);
      if (prev) {
        if (prev.streamUrl === ch.streamUrl) {
          ch.status = prev.status;
        } else {
          ch.status = 'UNVERIFIED';
        }
      }
    }

    this.channels = unified;
    this.applyOverridesToChannels();
    this.notify();
    return this.channels;
  }

  public getAllChannels(): LiveChannel[] {
    return this.channels.filter(c => c.isEnabled !== false);
  }

  public getAllChannelsIncludingDisabled(): LiveChannel[] {
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

  public getVerifiedChannels(): LiveChannel[] {
    return this.channels.filter(c => 
      c.isEnabled !== false && 
      !c.requiresExternalAccess && 
      (c.status === 'VERIFIED' || c.status === 'AVAILABLE') &&
      Boolean(c.streamUrl) &&
      !liveStreamValidator.isParkedDomain(c.streamUrl)
    );
  }

  public getChannelsByCategory(category: LiveChannelCategory, favoriteIds: string[] = []): LiveChannel[] {
    const visible = this.getVerifiedChannels();
    if (category === 'todos') {
      return visible;
    }
    if (category === 'favoritos') {
      return visible.filter(c => favoriteIds.includes(c.id));
    }
    return visible.filter(c => c.category === category);
  }

  public getAvailableCount(): number {
    return this.getVerifiedChannels().length;
  }

  public searchChannels(query: string): LiveChannel[] {
    const q = query.toLowerCase().trim();
    const visible = this.getVerifiedChannels();
    if (!q) return visible;

    return visible.filter(c => 
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
    listener(this.getAllChannels());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const copy = this.getAllChannels();
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch {}
    }
  }
}

export const liveTvProviderRegistry = LiveTVProviderRegistry.getInstance();
