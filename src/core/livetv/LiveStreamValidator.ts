import { ChannelHealthStatus } from './types';

export interface StreamHealthMetrics {
  status: ChannelHealthStatus;
  timestamp: number;
  testedUrl: string;
  httpStatus?: number;
  contentType?: string;
  latencyMs?: number;
  timeToFirstFrameMs?: number;
  totalPlayDurationSec?: number;
  stallCount: number;
  failureCount: number;
  lastSuccess?: number;
  lastFailure?: number;
  lastFailureReason?: string;
  hasLivePlaylist?: boolean;
  segmentAccessible?: boolean;
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

/**
 * Limitador de concorrência para evitar sobrecarga de rede no cliente
 */
class ConcurrencyLimiter {
  private running = 0;
  private queue: (() => Promise<void>)[] = [];

  constructor(private maxConcurrent = 3) {}

  public run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await fn();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.dequeue();
    });
  }

  private dequeue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;
    this.running++;
    const next = this.queue.shift();
    if (next) {
      next().finally(() => {
        this.running--;
        this.dequeue();
      });
    }
  }
}

export class LiveStreamValidator {
  private static instance: LiveStreamValidator;
  private metricsMap = new Map<string, StreamHealthMetrics>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache
  private pendingChecks = new Map<string, Promise<ChannelHealthStatus>>();
  private limiter = new ConcurrencyLimiter(3);

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
    if (!url) return true;
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
   * Retorna o status em cache recente se existir, ou null
   */
  public getCachedStatus(url: string): ChannelHealthStatus | null {
    if (!url) return null;
    const entry = this.metricsMap.get(url);
    if (entry && (Date.now() - entry.timestamp) < this.CACHE_TTL_MS) {
      return entry.status;
    }
    return null;
  }

  /**
   * Retorna métricas completas de saúde da fonte
   */
  public getMetrics(url: string): StreamHealthMetrics | undefined {
    return this.metricsMap.get(url);
  }

  /**
   * Validação multi-camada com concorrência limitada:
   * Etapa A: Conectividade (HTTP, timeout, códigos de resposta)
   * Etapa B: Manifesto (HLS EXTM3U / DASH MPD, verificação anti-HTML)
   * Etapa C: Segmentos (Resolução de playlist variante e teste de segmento de vídeo)
   * Etapa D: Continuidade (Verificação de playlist ao vivo em janela deslizante)
   * Etapa E: Compatibilidade (MIME e formatos suportados)
   */
  public async validateStreamUrl(url: string, timeoutMs = 4500): Promise<ChannelHealthStatus> {
    if (!url) return 'UNAVAILABLE';

    if (this.isParkedDomain(url)) {
      this.updateMetrics(url, {
        status: 'UNAVAILABLE',
        lastFailureReason: 'Domínio estacionado / propaganda'
      });
      return 'UNAVAILABLE';
    }

    const cachedStatus = this.getCachedStatus(url);
    if (cachedStatus) {
      return cachedStatus;
    }

    if (this.pendingChecks.has(url)) {
      return this.pendingChecks.get(url)!;
    }

    const checkPromise = this.limiter.run(async (): Promise<ChannelHealthStatus> => {
      const startTime = Date.now();
      try {
        // ETAPA A: CONECTIVIDADE
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const fetchTarget = (typeof window !== 'undefined' && url.startsWith('http://'))
          ? `/api/proxy?url=${encodeURIComponent(url)}`
          : url;

        const response = await fetch(fetchTarget, {
          method: 'GET',
          headers: {
            'Range': 'bytes=0-8192',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZapiTV-LiveCore/2.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - startTime;
        const httpStatus = response.status;
        const contentType = response.headers.get('content-type') || '';

        // Restrição de Acesso (401, 403)
        if (httpStatus === 401 || httpStatus === 403) {
          this.updateMetrics(url, {
            status: 'RESTRICTED',
            httpStatus,
            contentType,
            latencyMs,
            lastFailureReason: `HTTP ${httpStatus} Acesso Restrito / Autenticação Obrigatória`
          });
          return 'RESTRICTED';
        }

        // Recurso Inexistente / Expirado (404, 410)
        if (httpStatus === 404 || httpStatus === 410) {
          this.updateMetrics(url, {
            status: 'UNAVAILABLE',
            httpStatus,
            contentType,
            latencyMs,
            lastFailureReason: `HTTP ${httpStatus} Stream Inexistente ou Expirado`
          });
          return 'UNAVAILABLE';
        }

        // Instabilidade no Servidor Upstream (5xx)
        if (httpStatus >= 500) {
          this.updateMetrics(url, {
            status: 'UNSTABLE',
            httpStatus,
            contentType,
            latencyMs,
            lastFailureReason: `HTTP ${httpStatus} Falha no Servidor Upstream`
          });
          return 'UNSTABLE';
        }

        if (!response.ok && httpStatus !== 206) {
          this.updateMetrics(url, {
            status: 'UNAVAILABLE',
            httpStatus,
            contentType,
            latencyMs,
            lastFailureReason: `HTTP ${httpStatus}`
          });
          return 'UNAVAILABLE';
        }

        // ETAPA B: VALIDAÇÃO DE MANIFESTO
        const text = await response.text();

        // Se retornou página HTML (bloqueio, captcha ou redirecionamento de erro)
        if (text.includes('<!DOCTYPE html>') || text.includes('<html') || text.includes('captcha')) {
          this.updateMetrics(url, {
            status: 'UNAVAILABLE',
            httpStatus,
            contentType,
            latencyMs,
            lastFailureReason: 'Retornou HTML em vez de manifesto de transmissão'
          });
          return 'UNAVAILABLE';
        }

        const isHls = text.includes('#EXTM3U');
        const isDash = text.includes('<MPD');

        if (!isHls && !isDash && !url.includes('.m3u8') && !url.includes('.mpd')) {
          this.updateMetrics(url, {
            status: 'UNAVAILABLE',
            httpStatus,
            contentType,
            latencyMs,
            lastFailureReason: 'Formato incompatível (não é HLS/DASH)'
          });
          return 'UNAVAILABLE';
        }

        // ETAPA C: VALIDAÇÃO DE SEGMENTOS E PLAYLIST
        let segmentAccessible = true;
        let hasLivePlaylist = true;

        if (isHls) {
          // Verifica se é uma playlist ao vivo contínua
          if (text.includes('#EXT-X-ENDLIST')) {
            hasLivePlaylist = false;
          }

          // Se for Master Playlist, tenta resolver primeira variante e validar seu primeiro segmento
          if (text.includes('#EXT-X-STREAM-INF')) {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            let variantUrl = '';
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].startsWith('#EXT-X-STREAM-INF') && i + 1 < lines.length) {
                variantUrl = lines[i + 1];
                break;
              }
            }

            if (variantUrl && !variantUrl.startsWith('#')) {
              try {
                const resolvedVariant = new URL(variantUrl, url).href;
                const vRes = await fetch(resolvedVariant, {
                  method: 'GET',
                  headers: { 'Range': 'bytes=0-4096' },
                  signal: AbortSignal.timeout(3000)
                });
                if (vRes.ok || vRes.status === 206) {
                  const vText = await vRes.text();
                  if (vText.includes('#EXT-X-ENDLIST')) {
                    hasLivePlaylist = false;
                  }
                  // Busca primeiro segmento
                  const vLines = vText.split('\n').map(l => l.trim()).filter(Boolean);
                  const segLine = vLines.find(l => !l.startsWith('#') && (l.includes('.ts') || l.includes('.m4s') || l.includes('.aac') || l.includes('http')));
                  if (segLine) {
                    const resolvedSeg = new URL(segLine, resolvedVariant).href;
                    const segRes = await fetch(resolvedSeg, {
                      method: 'GET',
                      headers: { 'Range': 'bytes=0-1024' },
                      signal: AbortSignal.timeout(3000)
                    });
                    segmentAccessible = segRes.ok || segRes.status === 206;
                  }
                }
              } catch {
                // Erro não fatal no sub-teste de segmento
                segmentAccessible = true;
              }
            }
          }
        }

        if (!segmentAccessible) {
          this.updateMetrics(url, {
            status: 'UNSTABLE',
            httpStatus,
            contentType,
            latencyMs,
            hasLivePlaylist,
            segmentAccessible: false,
            lastFailureReason: 'Segmentos de mídia inacessíveis'
          });
          return 'UNSTABLE';
        }

        // ETAPA D & E: SUCESSO DE VALIDAÇÃO
        this.updateMetrics(url, {
          status: 'AVAILABLE',
          httpStatus,
          contentType,
          latencyMs,
          hasLivePlaylist,
          segmentAccessible: true,
          lastSuccess: Date.now()
        });
        return 'AVAILABLE';

      } catch (err: any) {
        const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
        const status: ChannelHealthStatus = isTimeout ? 'UNSTABLE' : 'UNAVAILABLE';
        this.updateMetrics(url, {
          status,
          lastFailureReason: isTimeout ? 'Tempo limite de resposta excedido (Timeout)' : (err.message || 'Erro de rede')
        });
        return status;
      }
    });

    this.pendingChecks.set(url, checkPromise);
    try {
      return await checkPromise;
    } finally {
      this.pendingChecks.delete(url);
    }
  }

  /**
   * Confirmação de reprodução real em runtime pelo Player (Etapa 2)
   */
  public recordPlaybackSuccess(url: string, timeToFirstFrameMs?: number): void {
    if (!url) return;
    const existing = this.metricsMap.get(url);
    this.updateMetrics(url, {
      status: 'AVAILABLE',
      lastSuccess: Date.now(),
      timeToFirstFrameMs: timeToFirstFrameMs ?? existing?.timeToFirstFrameMs,
      failureCount: 0
    });
  }

  /**
   * Registro de falha real durante reprodução
   */
  public recordPlaybackFailure(url: string, reason = 'Erro de reprodução', isNetworkError = false): void {
    if (!url) return;
    const current = this.metricsMap.get(url);
    const newFailureCount = (current?.failureCount || 0) + 1;
    // Se falhou 1 vez por rede, marca UNSTABLE; se falhou repetidamente (>= 3), marca UNAVAILABLE
    const status: ChannelHealthStatus = (!isNetworkError || newFailureCount >= 3) ? 'UNAVAILABLE' : 'UNSTABLE';

    this.updateMetrics(url, {
      status,
      failureCount: newFailureCount,
      lastFailure: Date.now(),
      lastFailureReason: reason
    });
  }

  /**
   * Registro de travamento (stalling) detectado pelo player
   */
  public recordStall(url: string): void {
    if (!url) return;
    const current = this.metricsMap.get(url);
    const stallCount = (current?.stallCount || 0) + 1;
    const status: ChannelHealthStatus = stallCount >= 3 ? 'UNSTABLE' : (current?.status || 'AVAILABLE');

    this.updateMetrics(url, {
      stallCount,
      status,
      lastFailureReason: stallCount >= 3 ? 'Travamentos (stalls) frequentes durante reprodução' : current?.lastFailureReason
    });
  }

  public recordPlayDuration(url: string, seconds: number): void {
    if (!url || seconds <= 0) return;
    const current = this.metricsMap.get(url);
    const total = (current?.totalPlayDurationSec || 0) + seconds;
    this.updateMetrics(url, { totalPlayDurationSec: total });
  }

  private updateMetrics(url: string, partial: Partial<StreamHealthMetrics>): void {
    const prev = this.metricsMap.get(url) || {
      status: 'CHECKING',
      timestamp: Date.now(),
      testedUrl: url,
      stallCount: 0,
      failureCount: 0
    };

    this.metricsMap.set(url, {
      ...prev,
      ...partial,
      testedUrl: url,
      timestamp: Date.now()
    });
  }

  public clearCache(): void {
    this.metricsMap.clear();
    this.pendingChecks.clear();
  }
}

export const liveStreamValidator = LiveStreamValidator.getInstance();
