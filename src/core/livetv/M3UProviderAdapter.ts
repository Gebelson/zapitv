import { RawChannelInput } from './types';
import { liveStreamValidator } from './LiveStreamValidator';

export class M3UProviderAdapter {
  private providerName: string;
  private playlistUrl?: string;

  constructor(providerName = 'M3U Provider', playlistUrl?: string) {
    this.providerName = providerName;
    this.playlistUrl = playlistUrl;
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
   * Carrega e analisa uma playlist M3U remota
   */
  public async fetchAndParse(url?: string): Promise<RawChannelInput[]> {
    const targetUrl = url || this.playlistUrl;
    if (!targetUrl) return [];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZapiTV-M3U/1.0'
        }
      });
      clearTimeout(timeout);

      if (!response.ok) return [];
      const text = await response.text();
      return this.parseM3UContent(text);
    } catch {
      return [];
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
