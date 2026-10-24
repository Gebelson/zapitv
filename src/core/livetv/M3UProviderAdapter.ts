import { RawChannelInput } from './types';
import { liveStreamValidator } from './LiveStreamValidator';

export class M3UProviderAdapter {
  private id: string;
  private providerName: string;
  private playlistUrl: string;
  private enabled: boolean;
  private lastSync: number = 0;
  private cachedChannels: RawChannelInput[] = [];

  public static readonly DEFAULT_BR_M3U = 'https://iptv-org.github.io/iptv/countries/br.m3u';

  constructor(
    providerName = 'IPTV Aberto (Brasil)', 
    playlistUrl = M3UProviderAdapter.DEFAULT_BR_M3U,
    id?: string,
    enabled = true
  ) {
    this.providerName = providerName;
    this.playlistUrl = playlistUrl;
    this.id = id || `m3u-${providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    this.enabled = enabled;
    this.loadCached();
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.providerName;
  }

  public getUrl(): string {
    return this.playlistUrl;
  }

  public setUrl(url: string): void {
    this.playlistUrl = url;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public getLastSync(): number {
    return this.lastSync;
  }

  public getChannelCount(): number {
    return this.cachedChannels.length;
  }

  /**
   * Converte o conteúdo bruto de uma lista M3U/M3U8 em RawChannelInput[]
   */
  public parseM3UContent(content: string): RawChannelInput[] {
    const lines = content.split(/\r?\n/);
    const channels: RawChannelInput[] = [];

    let currentMeta: Partial<RawChannelInput> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        currentMeta = this.parseExtInfLine(line);
      } else if (!line.startsWith('#') && currentMeta) {
        // Esta linha é a URL do stream
        const url = line;
        
        // Ignora se for domínio de anúncio ou vazio
        if (url && !liveStreamValidator.isParkedDomain(url)) {
          channels.push({
            id: currentMeta.id || currentMeta.tvgId || this.generateSlug(currentMeta.name || 'canal'),
            tvgId: currentMeta.tvgId,
            tvgName: currentMeta.tvgName,
            tvgLogo: currentMeta.tvgLogo,
            groupTitle: currentMeta.groupTitle,
            name: currentMeta.name || 'Canal Desconhecido',
            url: url,
            provider: this.providerName,
            category: currentMeta.groupTitle,
            isOfficial: false
          });
        }
        currentMeta = null;
      }
    }

    return channels;
  }

  /**
   * Analisa a linha #EXTINF para extrair atributos tvg-* e o nome do canal
   */
  private parseExtInfLine(line: string): Partial<RawChannelInput> {
    const meta: Partial<RawChannelInput> = {};

    // Extrair tvg-id
    const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
    if (tvgIdMatch) meta.tvgId = tvgIdMatch[1];

    // Extrair tvg-name
    const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
    if (tvgNameMatch) meta.tvgName = tvgNameMatch[1];

    // Extrair tvg-logo
    const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
    if (tvgLogoMatch) meta.tvgLogo = tvgLogoMatch[1];

    // Extrair group-title
    const groupMatch = line.match(/group-title="([^"]*)"/i);
    if (groupMatch) meta.groupTitle = groupMatch[1];

    // Nome do canal após a última vírgula
    const commaIndex = line.lastIndexOf(',');
    if (commaIndex !== -1) {
      meta.name = line.substring(commaIndex + 1).trim();
    } else if (meta.tvgName) {
      meta.name = meta.tvgName;
    }

    return meta;
  }

  /**
   * Carrega e analisa uma playlist M3U remota com timeout seguro e cache local
   */
  public async fetchAndParse(url?: string): Promise<RawChannelInput[]> {
    if (!this.enabled) {
      return [];
    }

    const targetUrl = url || this.playlistUrl;
    if (!targetUrl) {
      return this.cachedChannels;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/plain, application/x-mpegurl, audio/x-mpegurl, */*'
        }
      });

      clearTimeout(timeout);

      if (response.ok) {
        const text = await response.text();
        if (text.includes('#EXTM3U') || text.includes('#EXTINF')) {
          const channels = this.parseM3UContent(text);
          if (channels.length > 0) {
            this.cachedChannels = channels;
            this.lastSync = Date.now();
            this.persistCached();
            return channels;
          }
        }
      }
    } catch (err) {
      console.warn(`[M3UProviderAdapter] Falha ao sincronizar playlist "${this.providerName}":`, err);
    }

    // Se a busca remota falhar, retorna o cache prévio se disponível
    return this.cachedChannels;
  }

  private persistCached(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const storageKey = `zapitv_m3u_cache_${this.id}`;
      // Guarda uma amostra compacta de até 300 canais para não estourar o limite de 5MB do localStorage
      const slice = this.cachedChannels.slice(0, 300);
      localStorage.setItem(storageKey, JSON.stringify({
        lastSync: this.lastSync,
        channels: slice
      }));
    } catch {}
  }

  private loadCached(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const storageKey = `zapitv_m3u_cache_${this.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.channels)) {
          this.cachedChannels = data.channels;
          this.lastSync = data.lastSync || 0;
        }
      }
    } catch {}
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
