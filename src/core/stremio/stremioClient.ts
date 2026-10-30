import {
  StremioManifest,
  StremioCatalogResponse,
  StremioMetaResponse,
  StremioStreamResponse
} from './stremioTypes';

function resolveStremioUrl(url: string): string {
  if (url.startsWith('/')) {
    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.VITE_APP_URL || `http://127.0.0.1:${process.env.PORT || 4000}`);
    return `${origin}${url}`;
  }
  return url;
}

export class StremioClient {
  private static pending = new Map<string, Promise<any>>();
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

  private async fetchPublicMetadata(url: string, timeoutMs: number): Promise<any> {
    const key = `${url}:${timeoutMs}`;
    const active = StremioClient.pending.get(key);
    if (active) return active;
    const request = (async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
      return response.json();
    })();
    if (StremioClient.pending.size < 64) StremioClient.pending.set(key, request);
    try { return await request; } finally {
      if (StremioClient.pending.get(key) === request) StremioClient.pending.delete(key);
    }
  }

  private async fetchWithFallback(endpoint: string, timeoutMs = 8000): Promise<any> {
    const isRelative = this.baseUrl.startsWith('/');
    const rawPath = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    const directUrl = resolveStremioUrl(rawPath);
    
    // Se for URL relativa interna (/api/stremio/...), busca diretamente no host local
    if (isRelative) {
      const res = await fetch(directUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }

    // Provedores externos: tentar direto com timeout completo antes do fallback
    try {
      return await this.fetchPublicMetadata(directUrl, timeoutMs);
    } catch (err) {
      // Direct fetch failed, fallback to local CORS proxy
    }

    // This authenticated JSON fallback is never deduplicated across sessions.
    const proxyUrl = resolveStremioUrl(`/api/proxy?url=${encodeURIComponent(directUrl)}`);
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
      throw new Error('Falha ao consultar metadados do Stremio Addon.');
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
