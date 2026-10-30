import { ChannelHealthStatus } from './types';
import { VERIFIED_STREAMS_SNAPSHOT } from './verifiedStreamsSnapshot';
import { directMediaUrl } from '../playback/directMediaUrl';

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
  private static readonly STORAGE_KEY = 'zapitv_live_health_metrics_v2';
  private metricsMap = new Map<string, StreamHealthMetrics>();
  private readonly CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 horas de validade (expiração periódica controlada)
  private pendingChecks = new Map<string, Promise<ChannelHealthStatus>>();
  private limiter = new ConcurrencyLimiter(3);

  private constructor() {
    this.loadPersistedCache();
    this.seedFromSnapshot();
  }

  public static getInstance(): LiveStreamValidator {
    if (!LiveStreamValidator.instance) {
      LiveStreamValidator.instance = new LiveStreamValidator();
    }
    return LiveStreamValidator.instance;
  }

  private loadPersistedCache(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(LiveStreamValidator.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          for (const item of parsed) {
            if (item && item.testedUrl && (now - item.timestamp) < this.CACHE_TTL_MS) {
              this.metricsMap.set(item.testedUrl, item);
            }
          }
        }
      }
    } catch {}
  }

  private seedFromSnapshot(): void {
    const now = Date.now();
    for (const seed of Object.values(VERIFIED_STREAMS_SNAPSHOT)) {
      if (!this.metricsMap.has(seed.streamUrl)) {
        this.metricsMap.set(seed.streamUrl, {
          status: 'VERIFIED',
          testedUrl: seed.streamUrl,
          timestamp: now,
          latencyMs: seed.latencyMs,
          hasLivePlaylist: true,
          segmentAccessible: true,
          lastSuccess: now,
          failureCount: 0,
          stallCount: 0
        });
      }
    }
  }

  private persistCache(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const entries = Array.from(this.metricsMap.values()).slice(0, 100);
      localStorage.setItem(LiveStreamValidator.STORAGE_KEY, JSON.stringify(entries));
    } catch {}
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
    return directMediaUrl(rawUrl) || '';
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

        const fetchTarget = directMediaUrl(url);
        if (!fetchTarget) return 'UNAVAILABLE';

        const reqHeaders: Record<string, string> = {
          'Range': 'bytes=0-8192'
        };
        if (typeof window === 'undefined') {
          reqHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZapiTV-LiveCore/2.0';
        }

        const response = await fetch(fetchTarget, {
          method: 'GET',
          headers: reqHeaders,
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

        // Binary media is not a playlist. Some origins ignore Range and would
        // otherwise download the entire video during response.text().
        if (/^(?:video|audio)\//i.test(contentType) && !/mpegurl/i.test(contentType) || /\.(?:mp4|webm|mkv)(?:[?#]|$)/i.test(url)) {
          await response.body?.cancel();
          this.updateMetrics(url, { status: 'INCONCLUSIVE', httpStatus, contentType, latencyMs,
            lastFailureReason: 'Origem direta respondeu; confirmação de reprodução depende do player.' });
          return 'INCONCLUSIVE';
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
        let segmentAccessible: boolean | 'inconclusive' = true;
        let hasLivePlaylist = true;

        if (isHls) {
          // Base URL para resolução relativa (considerando redirecionamentos 302/301)
          const masterBaseUrl = response.url || fetchTarget || url;

          // Verifica se é uma playlist ao vivo contínua
          if (text.includes('#EXT-X-ENDLIST')) {
            hasLivePlaylist = false;
          }

          const isMaster = text.includes('#EXT-X-STREAM-INF');

          if (isMaster) {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            let variantUrl = '';
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                for (let j = i + 1; j < lines.length; j++) {
                  if (!lines[j].startsWith('#')) {
                    variantUrl = lines[j];
                    break;
                  }
                }
                if (variantUrl) break;
              }
            }

            if (variantUrl && !variantUrl.startsWith('#')) {
              try {
                const resolvedVariant = new URL(variantUrl, masterBaseUrl).href;
                const vRes = await fetch(resolvedVariant, {
                  method: 'GET',
                  headers: { 'Range': 'bytes=0-4096' },
                  signal: AbortSignal.timeout(3000)
                });
                if (vRes.ok || vRes.status === 206) {
                  const variantBaseUrl = vRes.url || resolvedVariant;
                  const vText = await vRes.text();
                  if (vText.includes('#EXT-X-ENDLIST')) {
                    hasLivePlaylist = false;
                  }
                  // Busca primeiro segmento (suporta TS, fMP4/CMAF .m4s/.mp4, áudio .aac/.m4a)
                  const vLines = vText.split('\n').map(l => l.trim()).filter(Boolean);
                  const segLine = vLines.find(l => !l.startsWith('#') && (
                    l.includes('.ts') ||
                    l.includes('.m4s') ||
                    l.includes('.mp4') ||
                    l.includes('.m4a') ||
                    l.includes('.aac') ||
                    l.includes('http')
                  ));
                  if (segLine) {
                    const resolvedSeg = new URL(segLine, variantBaseUrl).href;
                    const segRes = await fetch(resolvedSeg, {
                      method: 'GET',
                      headers: { 'Range': 'bytes=0-1024' },
                      signal: AbortSignal.timeout(3000)
                    });
                    await segRes.body?.cancel();
                    if (segRes.ok || segRes.status === 206) {
                      segmentAccessible = true;
                    } else if (segRes.status === 401 || segRes.status === 403) {
                      this.updateMetrics(url, {
                        status: 'RESTRICTED',
                        httpStatus: segRes.status,
                        lastFailureReason: `HTTP ${segRes.status} Acesso restrito aos segmentos de mídia`
                      });
                      return 'RESTRICTED';
                    } else {
                      segmentAccessible = false;
                    }
                  } else {
                    segmentAccessible = 'inconclusive';
                  }
                } else if (vRes.status === 401 || vRes.status === 403) {
                  this.updateMetrics(url, {
                    status: 'RESTRICTED',
                    httpStatus: vRes.status,
                    lastFailureReason: `HTTP ${vRes.status} Acesso restrito à playlist variante`
                  });
                  return 'RESTRICTED';
                } else {
                  segmentAccessible = false;
                }
              } catch {
                // Erro real ao carregar variante ou segmentos: não assumir true
                segmentAccessible = false;
              }
            } else {
              segmentAccessible = 'inconclusive';
            }
          } else {
            // Media Playlist direta
            const masterBaseUrl = response.url || fetchTarget || url;
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const segLine = lines.find(l => !l.startsWith('#') && (
              l.includes('.ts') ||
              l.includes('.m4s') ||
              l.includes('.mp4') ||
              l.includes('.m4a') ||
              l.includes('.aac') ||
              l.includes('http') ||
              !l.includes('.m3u8')
            ));
            if (segLine) {
              try {
                const resolvedSeg = new URL(segLine, masterBaseUrl).href;
                const segRes = await fetch(resolvedSeg, {
                  method: 'GET',
                  headers: { 'Range': 'bytes=0-1024' },
                  signal: AbortSignal.timeout(3000)
                });
                await segRes.body?.cancel();
                if (segRes.ok || segRes.status === 206) {
                  segmentAccessible = true;
                } else if (segRes.status === 401 || segRes.status === 403) {
                  this.updateMetrics(url, {
                    status: 'RESTRICTED',
                    httpStatus: segRes.status,
                    lastFailureReason: `HTTP ${segRes.status} Acesso restrito aos segmentos de mídia`
                  });
                  return 'RESTRICTED';
                } else {
                  segmentAccessible = false;
                }
              } catch {
                segmentAccessible = false;
              }
            } else {
              segmentAccessible = 'inconclusive';
            }
          }
        }

        if (segmentAccessible === false) {
          this.updateMetrics(url, {
            status: 'UNSTABLE',
            httpStatus,
            contentType,
            latencyMs,
            hasLivePlaylist,
            segmentAccessible: false,
            lastFailureReason: 'Segmentos de mídia inacessíveis ou falha de entrega'
          });
          return 'UNSTABLE';
        }

        if (segmentAccessible === 'inconclusive') {
          this.updateMetrics(url, {
            status: 'INCONCLUSIVE',
            httpStatus,
            contentType,
            latencyMs,
            hasLivePlaylist,
            lastFailureReason: 'Verificação de segmentos inconclusiva no manifesto'
          });
          return 'INCONCLUSIVE';
        }

        // ETAPA D & E: SUCESSO DE VALIDAÇÃO
        this.updateMetrics(url, {
          status: 'VERIFIED',
          httpStatus,
          contentType,
          latencyMs,
          hasLivePlaylist,
          segmentAccessible: true,
          lastSuccess: Date.now()
        });
        return 'VERIFIED';

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
      status: 'VERIFIED',
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
    this.persistCache();
  }

  public clearCache(): void {
    this.metricsMap.clear();
    this.pendingChecks.clear();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LiveStreamValidator.STORAGE_KEY);
      } catch {}
    }
  }
}

export const liveStreamValidator = LiveStreamValidator.getInstance();
