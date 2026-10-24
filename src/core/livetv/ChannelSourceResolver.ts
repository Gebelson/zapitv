/**
 * ZapiTV — ChannelSourceResolver
 * Responsável por identificar, pontuar e resolver as fontes de transmissão disponíveis para cada canal.
 * Prioriza ESTABILIDADE sobre resolução:
 * 1. Fontes oficiais e tecnicamente compatíveis
 * 2. Histórico recente de reprodução bem-sucedida e ausência de stalls/erros
 * 3. 720p estável > 1080p instável
 * 4. Expiração temporal de falhas (evita banimento permanente após soluços transitórios de rede)
 */

import { LiveChannel, LiveStreamSource } from './types';
import { liveStreamValidator } from './LiveStreamValidator';

export interface ResolvedSourceResult {
  primaryUrl: string;
  quality: string;
  format: 'hls' | 'dash' | 'mp4';
  sources: LiveStreamSource[];
  isFallback: boolean;
  activeSourceIndex: number;
}

export class ChannelSourceResolver {
  private static instance: ChannelSourceResolver;

  // Mapa de URLs com falha temporária por canal (canalId -> Map de url para timestamp da falha)
  private failedSourcesPerChannel = new Map<string, Map<string, number>>();
  // Falhas expiram após 3 minutos (180s) para permitir auto-recuperação
  private readonly FAILURE_EXPIRATION_MS = 3 * 60 * 1000;

  public static getInstance(): ChannelSourceResolver {
    if (!ChannelSourceResolver.instance) {
      ChannelSourceResolver.instance = new ChannelSourceResolver();
    }
    return ChannelSourceResolver.instance;
  }

  /**
   * Calcula a pontuação de estabilidade de uma fonte.
   * Regra estrita: 720p estável deve pontuar mais que 1080p instável.
   */
  public calculateStabilityScore(source: LiveStreamSource): number {
    let score = 0;

    // 1. Provedor Oficial (+500)
    if (source.isOfficial) {
      score += 500;
    }

    // 2. Consulta de saúde e métricas no validador
    const metrics = liveStreamValidator.getMetrics(source.url);
    const cachedStatus = metrics?.status || liveStreamValidator.getCachedStatus(source.url);

    if (cachedStatus === 'AVAILABLE') {
      score += 300;
    } else if (cachedStatus === 'CHECKING' || !cachedStatus) {
      score += 100;
    } else if (cachedStatus === 'UNSTABLE') {
      score -= 250;
    } else if (cachedStatus === 'RESTRICTED') {
      score -= 400;
    } else if (cachedStatus === 'UNAVAILABLE' || cachedStatus === 'ERROR') {
      score -= 600;
    }

    if (metrics) {
      // Sucesso recente (+150)
      if (metrics.lastSuccess && (Date.now() - metrics.lastSuccess) < 10 * 60 * 1000) {
        score += 150;
      }

      // Penalização por travamentos (stalls): -60 por stall
      if (metrics.stallCount > 0) {
        score -= metrics.stallCount * 60;
      }

      // Penalização por falhas de reprodução: -120 por falha
      if (metrics.failureCount > 0) {
        score -= metrics.failureCount * 120;
      }

      // Penalização por latência excessiva (> 2000ms: -50)
      if (metrics.latencyMs && metrics.latencyMs > 2000) {
        score -= 50;
      }
    }

    // 3. Resolução declarada (bonificação moderada: 1080p +40, 720p +30, 480p +15)
    // Uma fonte 720p estável (300 + 30 = 330) supera com folga uma 1080p instável (-250 + 40 = -210)
    const height = source.resolutionHeight || this.parseResolution(source.quality);
    if (height >= 1080) {
      score += 40;
    } else if (height >= 720) {
      score += 30;
    } else {
      score += 15;
    }

    return score;
  }

  /**
   * Extrai e ordena todas as fontes válidas de um canal priorizando estabilidade
   */
  public getRankedSources(channel: LiveChannel): LiveStreamSource[] {
    const rawSources: LiveStreamSource[] = [...(channel.sources || [])];

    // Se o canal tiver streamUrl mas não estiver explicitamente em sources
    if (channel.streamUrl && !rawSources.some(s => s.url === channel.streamUrl)) {
      rawSources.unshift({
        id: `${channel.id}-primary`,
        url: channel.streamUrl,
        quality: channel.quality || '1080p',
        provider: channel.isOfficial ? 'Oficial' : 'Primário',
        format: channel.streamUrl.includes('.mpd') ? 'dash' : 'hls',
        isOfficial: channel.isOfficial,
        resolutionHeight: this.parseResolution(channel.quality)
      });
    }

    // Se tiver backupStreamUrls
    if (channel.backupStreamUrls && Array.isArray(channel.backupStreamUrls)) {
      for (let i = 0; i < channel.backupStreamUrls.length; i++) {
        const bUrl = channel.backupStreamUrls[i];
        if (bUrl && !rawSources.some(s => s.url === bUrl)) {
          rawSources.push({
            id: `${channel.id}-backup-${i}`,
            url: bUrl,
            quality: '720p',
            provider: 'Fonte Alternativa',
            format: bUrl.includes('.mpd') ? 'dash' : 'hls',
            isOfficial: false,
            isBackup: true,
            resolutionHeight: 720
          });
        }
      }
    }

    // Filtrar fontes de domínios estacionados ou vazias
    const validSources = rawSources.filter(s => s.url && !liveStreamValidator.isParkedDomain(s.url));

    // Ordenar estritamente por pontuação de estabilidade decrescente
    validSources.sort((a, b) => {
      const scoreA = this.calculateStabilityScore(a);
      const scoreB = this.calculateStabilityScore(b);
      return scoreB - scoreA;
    });

    return validSources;
  }

  /**
   * Retorna conjunto de URLs com falhas ativas (não expiradas) para o canal
   */
  private getActiveFailedUrls(channelId: string): Set<string> {
    const map = this.failedSourcesPerChannel.get(channelId);
    if (!map) return new Set();

    const now = Date.now();
    const active = new Set<string>();

    for (const [url, timestamp] of map.entries()) {
      if (now - timestamp < this.FAILURE_EXPIRATION_MS) {
        active.add(url);
      } else {
        map.delete(url); // Expira falha antiga
      }
    }

    return active;
  }

  /**
   * Resolve a melhor fonte para reprodução, excluindo opcionalmente URLs que já falharam
   */
  public resolveBestSource(channel: LiveChannel, excludeUrls: string[] = []): ResolvedSourceResult {
    const allSources = this.getRankedSources(channel);
    const activeFailed = this.getActiveFailedUrls(channel.id);
    const totalExcluded = new Set([...excludeUrls, ...Array.from(activeFailed)]);

    // Procura primeira fonte válida que não esteja na lista de falhas ativas
    let chosenIndex = allSources.findIndex(s => !totalExcluded.has(s.url));

    // Se todas as fontes falharam temporariamente, limpa as falhas expiradas para permitir reconexão
    if (chosenIndex === -1 && allSources.length > 0) {
      this.clearFailedSources(channel.id);
      chosenIndex = 0;
    }

    const chosen = allSources[chosenIndex] || {
      id: `${channel.id}-default`,
      url: channel.streamUrl,
      quality: channel.quality || '720p',
      provider: 'Padrão',
      format: 'hls' as const,
      resolutionHeight: 720
    };

    return {
      primaryUrl: chosen.url,
      quality: chosen.quality,
      format: chosen.format || 'hls',
      sources: allSources,
      isFallback: chosenIndex > 0 || Boolean(chosen.isBackup),
      activeSourceIndex: Math.max(0, chosenIndex)
    };
  }

  /**
   * Obtém a próxima fonte disponível após uma falha de reprodução, prevenindo loops infinitos
   */
  public getNextSource(channel: LiveChannel, currentFailedUrl: string): LiveStreamSource | null {
    this.markSourceFailed(channel.id, currentFailedUrl);

    const allSources = this.getRankedSources(channel);
    const activeFailed = this.getActiveFailedUrls(channel.id);

    // Filtra fontes que ainda não falharam recentemente
    const candidates = allSources.filter(s => s.url !== currentFailedUrl && !activeFailed.has(s.url));

    if (candidates.length > 0) {
      return candidates[0];
    }

    return null;
  }

  /**
   * Marca uma URL como falha temporária com timestamp de expiração
   */
  public markSourceFailed(channelId: string, url: string): void {
    if (!url) return;
    let map = this.failedSourcesPerChannel.get(channelId);
    if (!map) {
      map = new Map<string, number>();
      this.failedSourcesPerChannel.set(channelId, map);
    }
    map.set(url, Date.now());
  }

  /**
   * Limpa registro de falhas de um canal (ex: quando o usuário clica em reconectar)
   */
  public clearFailedSources(channelId?: string): void {
    if (channelId) {
      this.failedSourcesPerChannel.delete(channelId);
    } else {
      this.failedSourcesPerChannel.clear();
    }
  }

  private parseResolution(q?: string): number {
    if (!q) return 720;
    if (q.includes('4k') || q.includes('2160')) return 2160;
    if (q.includes('1080')) return 1080;
    if (q.includes('720')) return 720;
    if (q.includes('480')) return 480;
    return 720;
  }
}

export const channelSourceResolver = ChannelSourceResolver.getInstance();
