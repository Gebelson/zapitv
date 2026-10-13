import {
  StremioManifest,
  StremioCatalogResponse,
  StremioMetaResponse,
  StremioStreamResponse
} from './stremioTypes';

export class StremioClient {
  private baseUrl: string;

  constructor(url: string) {
    let clean = url.trim();
    if (clean.startsWith('stremio://')) {
      clean = clean.replace('stremio://', 'https://');
    }
    if (clean.endsWith('/manifest.json')) {
      clean = clean.replace('/manifest.json', '');
    }
    this.baseUrl = clean.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async fetchWithFallback(endpoint: string, timeoutMs = 8000): Promise<any> {
    const directUrl = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    
    // First try direct fetch
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(directUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      // Direct fetch failed, fallback to local CORS proxy
    }

    // Fallback: proxy via server.ts
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(directUrl)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Proxy status: ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(`Falha ao consultar Stremio Addon [${directUrl}]: ${err.message}`);
    }
  }

  public async getManifest(): Promise<StremioManifest> {
    return this.fetchWithFallback('manifest.json');
  }

  public async getCatalog(
    type: string,
    id: string,
    extra?: Record<string, string>
  ): Promise<StremioCatalogResponse> {
    let path = `catalog/${type}/${id}`;
    if (extra && Object.keys(extra).length > 0) {
      const queryParts = Object.entries(extra)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      path += `/${queryParts}`;
    }
    path += '.json';
    return this.fetchWithFallback(path);
  }

  public async getMeta(type: string, id: string): Promise<StremioMetaResponse> {
    const path = `meta/${type}/${encodeURIComponent(id)}.json`;
    return this.fetchWithFallback(path);
  }

  public async getStreams(type: string, id: string): Promise<StremioStreamResponse> {
    const path = `stream/${type}/${encodeURIComponent(id)}.json`;
    return this.fetchWithFallback(path);
  }
}
