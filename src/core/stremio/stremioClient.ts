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
    const isRelative = this.baseUrl.startsWith('/');
    const directUrl = isRelative
      ? `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`
      : `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    
    // Se for URL relativa interna (/api/stremio/...), busca diretamente no host local
    if (isRelative) {
      const res = await fetch(directUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }

    // Provedores externos: tentar direto com timeout de 4s
    try {
      const res = await fetch(directUrl, { signal: AbortSignal.timeout(Math.min(timeoutMs, 4000)) });
      if (res.ok) {
        const text = await res.text();
        if (text.startsWith('{') || text.startsWith('[')) {
          return JSON.parse(text);
        }
      }
    } catch (err) {
      // Direct fetch failed, fallback to local CORS proxy
    }

    // Fallback: proxy via server.ts
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(directUrl)}`;
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        throw new Error(`Proxy status: ${res.status}`);
      }
      const text = await res.text();
      if (!text.startsWith('{') && !text.startsWith('[')) {
        throw new Error('Resposta inválida do add-on (não é JSON)');
      }
      return JSON.parse(text);
    } catch (err: any) {
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
