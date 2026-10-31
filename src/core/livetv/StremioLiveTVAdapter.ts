import { RawChannelInput, LiveStreamSource } from './types';
import { liveStreamValidator } from './LiveStreamValidator';

export interface StremioManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  resources: Array<string | { name: string; types: string[]; idPrefixes?: string[] }>;
  types: string[];
  catalogs: Array<{
    type: string;
    id: string;
    name: string;
    genres?: string[];
    extra?: Array<{ name: string; isRequired?: boolean; options?: string[] }>;
  }>;
}

export interface StremioMetaPreview {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  genres?: string[];
  genre?: string;
  streams?: StremioStream[];
}

export interface StremioStream {
  url?: string;
  title?: string;
  name?: string;
  description?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    proxyHeaders?: Record<string, string>;
  };
}

export class StremioLiveTVAdapter {
  private id: string;
  private baseUrl: string;
  private manifest: StremioManifest | null = null;
  private enabled: boolean;
  private lastSync: number = 0;
  private channelCount: number = 0;

  constructor(addonBaseUrl: string, id?: string, enabled = true) {
    this.baseUrl = addonBaseUrl.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
    this.id = id || `stremio-${this.baseUrl.replace(/[^a-z0-9]+/g, '-')}`;
    this.enabled = enabled;
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.manifest?.name || 'Stremio Live Addon';
  }

  public getUrl(): string {
    return this.baseUrl;
  }

  public setUrl(url: string): void {
    this.baseUrl = url.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
    this.manifest = null;
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
    return this.channelCount;
  }

  /**
   * Filtra estritamente streams compatíveis com reprodução web (HLS/DASH/MP4).
   * Rejeita streams P2P/Torrent (infoHash, acestream, magnet), sem URL ou marcados com notWebReady.
   */
  public filterWebReadyStreams(streams: StremioStream[]): StremioStream[] {
    if (!Array.isArray(streams)) return [];
    return streams.filter(s => {
      if (!s || typeof s.url !== 'string') return false;
      const url = s.url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
      if (s.behaviorHints?.notWebReady === true) return false;
      // Rejeita protocolos ou motores P2P/Torrent/AceStream
      if (url.startsWith('acestream:') || url.startsWith('magnet:') || url.includes('.torrent') || (s as any).infoHash) {
        return false;
      }
      // Rejeita domínios de estacionamento / propaganda
      if (liveStreamValidator.isParkedDomain(url)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Obtém e valida o manifesto do add-on Stremio
   */
  public async getManifest(): Promise<StremioManifest | null> {
    if (this.manifest) return this.manifest;
    if (!this.enabled || !this.baseUrl) return null;

    try {
      const resp = await fetch(`${this.baseUrl}/manifest.json`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (resp.ok) {
        const parsed: StremioManifest = await resp.json();
        // Não confundir Brazuca Torrents ou add-ons puramente de torrent sob demanda com canais ao vivo
        const isBrazucaTorrent = (parsed.id || '').toLowerCase().includes('brazuca') ||
          (parsed.name || '').toLowerCase().includes('brazuca') ||
          (parsed.description || '').toLowerCase().includes('brazuca');
        if (isBrazucaTorrent) {
          console.warn(`[StremioLiveTVAdapter] Add-on "${parsed.name}" é um provedor de torrent sob demanda e foi rejeitado como TV ao vivo.`);
          return null;
        }

        this.manifest = parsed;
        return this.manifest;
      }
    } catch {}
    return null;
  }

  /**
   * Obtém todos os canais anunciados nos catálogos de TV do add-on.
   * Não expõe canais com URL vazia para reprodução direta sem stream verificado.
   */
  public async fetchCatalogChannels(): Promise<RawChannelInput[]> {
    if (!this.enabled) return [];

    const manifest = await this.getManifest();
    if (!manifest) return [];

    const tvCatalogs = (manifest.catalogs || []).filter(c => 
      c.type === 'tv' || c.type === 'channel' || c.type === 'livetv' || c.id.toLowerCase().includes('live')
    );

    const channels: RawChannelInput[] = [];

    for (const catalog of tvCatalogs) {
      try {
        const catUrl = `${this.baseUrl}/catalog/${catalog.type}/${catalog.id}.json`;
        const resp = await fetch(catUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });

        if (resp.ok) {
          const data = await resp.json();
          const metas: StremioMetaPreview[] = data.metas || [];

          // Processamento paralelo controlado em lotes de 5 requisições simultâneas
          const BATCH_SIZE = 5;
          for (let i = 0; i < metas.length; i += BATCH_SIZE) {
            const batch = metas.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map(async (meta) => {
                // Se o catálogo já embutir os streams (ex: USA TV Next), utiliza-os diretamente
                let candidateStreams: StremioStream[] = [];
                if (Array.isArray(meta.streams) && meta.streams.length > 0) {
                  candidateStreams = this.filterWebReadyStreams(meta.streams);
                } else {
                  candidateStreams = await this.resolveStreams(meta.type || catalog.type, meta.id);
                }

                if (candidateStreams.length === 0) return null;

                const primaryUrl = candidateStreams[0].url!;
                const backupUrls = candidateStreams.slice(1).map(s => s.url!).filter(Boolean);

                const sources: LiveStreamSource[] = candidateStreams.map((s, idx) => ({
                  id: `${meta.id}-source-${idx}`,
                  url: s.url!,
                  quality: s.name || (s.title?.includes('1080') ? '1080p' : s.title?.includes('720') ? '720p' : '720p'),
                  provider: manifest.name || 'Stremio Live Addon',
                  format: (s.url!.includes('.mpd') ? 'dash' : 'hls') as ('dash' | 'hls'),
                  isOfficial: false,
                  isBackup: idx > 0,
                  resolutionHeight: s.title?.includes('1080') ? 1080 : s.title?.includes('720') ? 720 : 720
                }));

                const isTemporary = this.isTemporarySportsEvent(meta.name, catalog.name);

                return {
                  id: meta.id,
                  tvgId: meta.id,
                  name: meta.name,
                  tvgLogo: meta.logo || meta.poster,
                  description: meta.description,
                  groupTitle: meta.genre || meta.genres?.[0] || catalog.name,
                  url: primaryUrl,
                  sources: sources,
                  backupStreamUrls: backupUrls,
                  provider: manifest.name || 'Stremio Live Addon',
                  isOfficial: false,
                  isTemporaryEvent: isTemporary
                } as RawChannelInput;
              })
            );

            for (const r of results) {
              if (r.status === 'fulfilled' && r.value) {
                channels.push(r.value);
              }
            }
          }
        }
      } catch {}
    }

    this.channelCount = channels.length;
    this.lastSync = Date.now();
    return channels;
  }

  /**
   * Distingue eventos esportivos temporários/jogos de canais lineares permanentes 24/7
   */
  public isTemporarySportsEvent(title: string, catalogName?: string): boolean {
    const t = title.toLowerCase();
    const c = (catalogName || '').toLowerCase();

    // Padrões de confronto direto (ex: "Flamengo x Palmeiras", "Arsenal vs Chelsea", "UFC 308")
    const matchPatterns = [
      /\s+x\s+/,
      /\s+vs\.?\s+/,
      /\b(ufc|combate|fight|f1|formula\s+1|motogp)\b/i,
      /\b(rodada|quartas|semifinal|final|jogo)\b/i,
      /\b\d{1,2}:\d{2}\b/ // Título com horário embutido
    ];

    if (matchPatterns.some(p => p.test(t))) {
      return true;
    }

    if (c.includes('event') || c.includes('sports live') || c.includes('jogos') || c.includes('matches')) {
      return true;
    }

    return false;
  }

  /**
   * Obtém todas as fontes compatíveis de um canal
   */
  public async resolveStreams(type: string, id: string): Promise<StremioStream[]> {
    if (!this.baseUrl) return [];
    try {
      const streamUrl = `${this.baseUrl}/stream/${type}/${encodeURIComponent(id)}.json`;
      const resp = await fetch(streamUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });

      if (resp.ok) {
        const data = await resp.json();
        const rawStreams: StremioStream[] = data.streams || [];
        return this.filterWebReadyStreams(rawStreams);
      }
    } catch {}
    return [];
  }

  /**
   * Resolve a URL de stream de um canal a partir do endpoint /stream/:type/:id.json
   */
  public async resolveStream(type: string, id: string): Promise<string | null> {
    const valid = await this.resolveStreams(type, id);
    return valid[0]?.url || null;
  }
}
