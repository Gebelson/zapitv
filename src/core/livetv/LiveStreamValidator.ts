import { ChannelHealthStatus } from './types';

interface HealthCacheEntry {
  status: ChannelHealthStatus;
  timestamp: number;
  testedUrl: string;
}

const PARKED_DOMAINS = [
  'superflixapi.top',
  'parklogic.com',
  'bodis.com',
  'sedo.com',
  'parkingcrew.net',
  'hugedomains.com',
  'dan.com'
];

export class LiveStreamValidator {
  private static instance: LiveStreamValidator;
  private cache = new Map<string, HealthCacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache
  private pendingChecks = new Map<string, Promise<ChannelHealthStatus>>();

  public static getInstance(): LiveStreamValidator {
    if (!LiveStreamValidator.instance) {
      LiveStreamValidator.instance = new LiveStreamValidator();
    }
    return LiveStreamValidator.instance;
  }

  /**
   * Verifica se o domínio é conhecido por ser parked/propaganda
   */
  public isParkedDomain(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return PARKED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }

  /**
   * Converte a URL do stream para rota proxy do ZapiTV caso necessário para evitar bloqueio CORS ou mixed content
   */
  public getPlayableUrl(rawUrl: string): string {
    if (!rawUrl) return '';

    if (typeof window !== 'undefined') {
      const isHttpsPage = window.location.protocol === 'https:';
      const isHttpStream = rawUrl.startsWith('http://');

      // Se for página HTTPS com stream HTTP (mixed content) ou porta não-padrão com restrição de CORS
      if ((isHttpsPage && isHttpStream) || rawUrl.includes(':8000') || rawUrl.includes(':8083') || rawUrl.includes(':1935') || rawUrl.includes(':8080')) {
        return `/api/proxy?url=${encodeURIComponent(rawUrl)}`;
      }
    }

    return rawUrl;
  }

  /**
   * Valida ativamente a disponibilidade de uma URL de transmissão
   */
  public async validateStreamUrl(url: string, timeoutMs = 4000): Promise<ChannelHealthStatus> {
    if (!url) return 'UNAVAILABLE';

    if (this.isParkedDomain(url)) {
      return 'UNAVAILABLE';
    }

    const cached = this.cache.get(url);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.status;
    }

    if (this.pendingChecks.has(url)) {
      return this.pendingChecks.get(url)!;
    }

    const checkPromise = (async (): Promise<ChannelHealthStatus> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const fetchTarget = (typeof window !== 'undefined' && url.startsWith('http://'))
          ? `/api/proxy?url=${encodeURIComponent(url)}`
          : url;

        const response = await fetch(fetchTarget, {
          method: 'GET',
          headers: {
            'Range': 'bytes=0-2048',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZapiTV-LiveCore/2.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.status === 403 || response.status === 401) {
          const entry: HealthCacheEntry = { status: 'RESTRICTED', timestamp: Date.now(), testedUrl: url };
          this.cache.set(url, entry);
          return 'RESTRICTED';
        }

        if (response.status === 404 || response.status === 410) {
          const entry: HealthCacheEntry = { status: 'EXPIRED', timestamp: Date.now(), testedUrl: url };
          this.cache.set(url, entry);
          return 'EXPIRED';
        }

        if (response.ok || response.status === 206) {
          const text = await response.text();
          // Verifica se é um manifesto HLS ou formato compatível e não uma página HTML de propaganda
          if (text.includes('#EXTM3U') || text.includes('#EXT-X-STREAM-INF') || text.includes('#EXTINF') || text.includes('<MPD')) {
            const entry: HealthCacheEntry = { status: 'AVAILABLE', timestamp: Date.now(), testedUrl: url };
            this.cache.set(url, entry);
            return 'AVAILABLE';
          }

          // Se retornou HTML genérico de bloqueio/propaganda
          if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
            const entry: HealthCacheEntry = { status: 'UNAVAILABLE', timestamp: Date.now(), testedUrl: url };
            this.cache.set(url, entry);
            return 'UNAVAILABLE';
          }

          // Stream binário aceitável
          const entry: HealthCacheEntry = { status: 'AVAILABLE', timestamp: Date.now(), testedUrl: url };
          this.cache.set(url, entry);
          return 'AVAILABLE';
        }

        const entry: HealthCacheEntry = { status: 'UNAVAILABLE', timestamp: Date.now(), testedUrl: url };
        this.cache.set(url, entry);
        return 'UNAVAILABLE';
      } catch (err: any) {
        const status: ChannelHealthStatus = (err.name === 'AbortError') ? 'UNAVAILABLE' : 'ERROR';
        const entry: HealthCacheEntry = { status, timestamp: Date.now(), testedUrl: url };
        this.cache.set(url, entry);
        return status;
      } finally {
        this.pendingChecks.delete(url);
      }
    })();

    this.pendingChecks.set(url, checkPromise);
    return checkPromise;
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const liveStreamValidator = LiveStreamValidator.getInstance();
