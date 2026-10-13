/**
 * ZapiTV — ChannelSourceResolver
 * Responsável por identificar, pontuar e resolver as fontes de transmissão disponíveis para cada canal.
 * Eleva automaticamente streams de maior resolução e compatibilidade com navegador web nativo.
 */

import { LiveChannel, LiveStreamSource } from './types';
import { liveStreamValidator } from './LiveStreamValidator';

export interface ResolvedSourceResult {
  primaryUrl: string;
  quality: string;
  format: 'hls' | 'dash' | 'mp4';
  sources: LiveStreamSource[];
  isFallback: boolean;
}

export class ChannelSourceResolver {
  private static instance: ChannelSourceResolver;

  public static getInstance(): ChannelSourceResolver {
    if (!ChannelSourceResolver.instance) {
      ChannelSourceResolver.instance = new ChannelSourceResolver();
    }
    return ChannelSourceResolver.instance;
  }

  /**
   * Resolve e ordena todas as fontes válidas para um canal
   */
  public resolveBestSource(channel: LiveChannel): ResolvedSourceResult {
    const rawSources: LiveStreamSource[] = [...(channel.sources || [])];

    // Se o canal tiver streamUrl mas não estiver em sources
    if (channel.streamUrl && !rawSources.some(s => s.url === channel.streamUrl)) {
      rawSources.unshift({
        id: `${channel.id}-primary`,
        url: channel.streamUrl,
        quality: channel.quality || '1080p',
        provider: 'Canal Primário',
        format: channel.streamUrl.includes('.mpd') ? 'dash' : 'hls',
        isOfficial: channel.isOfficial,
        resolutionHeight: this.parseResolution(channel.quality)
      });
    }

    // Se tiver backupStreamUrls
    if (channel.backupStreamUrls) {
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

    // Filtrar fontes de domínios estacionados
    const validSources = rawSources.filter(s => s.url && !liveStreamValidator.isParkedDomain(s.url));

    // Ordenar: Oficiais primeiro, depois por resolução decrescente (1080p > 720p > 480p)
    validSources.sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) return -1;
      if (!a.isOfficial && b.isOfficial) return 1;
      return (b.resolutionHeight || 720) - (a.resolutionHeight || 720);
    });

    const chosen = validSources[0] || {
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
      sources: validSources,
      isFallback: chosen.isBackup || false
    };
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
