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
  private baseUrl: string;
  private manifest: StremioManifest | null = null;

  constructor(addonBaseUrl: string) {
    this.baseUrl = addonBaseUrl.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
  }

  /**
   * Obtém e valida o manifesto do add-on Stremio
   */
  public async getManifest(): Promise<StremioManifest | null> {
    if (this.manifest) return this.manifest;

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
   * Obtém todos os canais anunciados nos catálogos de TV do add-on
   */
  public async fetchCatalogChannels(): Promise<RawChannelInput[]> {
    const manifest = await this.getManifest();
    if (!manifest) return [];

    const tvCatalogs = manifest.catalogs.filter(c => 
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

          for (const meta of metas) {
            channels.push({
              id: meta.id,
              tvgId: meta.id,
              name: meta.name,
              tvgLogo: meta.logo || meta.poster,
              description: meta.description,
              groupTitle: meta.genres?.[0] || catalog.name,
              url: '', // Streams são resolvidos sob demanda ou pré-buscados
              provider: manifest.name || 'Stremio Addon',
              isOfficial: false
            });
          }
        }
      } catch {}
    }

    return channels;
  }

  /**
   * Resolve a URL de stream de um canal a partir do endpoint /stream/:type/:id.json
   */
  public async resolveStream(type: string, id: string): Promise<string | null> {
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
