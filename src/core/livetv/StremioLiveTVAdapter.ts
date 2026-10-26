import { RawChannelInput } from './types';

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
        this.manifest = await resp.json();
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
                const resolvedStreamUrl = await this.resolveStream(meta.type || catalog.type, meta.id);
                if (!resolvedStreamUrl) return null;

                const isTemporary = this.isTemporarySportsEvent(meta.name, catalog.name);

                return {
                  id: meta.id,
                  tvgId: meta.id,
                  name: meta.name,
                  tvgLogo: meta.logo || meta.poster,
                  description: meta.description,
                  groupTitle: meta.genres?.[0] || catalog.name,
                  url: resolvedStreamUrl,
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
   * Resolve a URL de stream de um canal a partir do endpoint /stream/:type/:id.json
   */
  public async resolveStream(type: string, id: string): Promise<string | null> {
    if (!this.baseUrl) return null;
    try {
      const streamUrl = `${this.baseUrl}/stream/${type}/${encodeURIComponent(id)}.json`;
      const resp = await fetch(streamUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });

      if (resp.ok) {
        const data = await resp.json();
        const streams: StremioStream[] = data.streams || [];
        const webStream = streams.find(s => s.url && !s.behaviorHints?.notWebReady) || streams[0];
        return webStream?.url || null;
      }
    } catch {}
    return null;
  }
}
