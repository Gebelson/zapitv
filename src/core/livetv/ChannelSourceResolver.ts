/**
 * ZapiTV — ChannelSourceResolver
 * Responsável por identificar, pontuar e resolver as fontes de transmissão disponíveis para cada canal.
 * Eleva automaticamente streams oficiais, de maior resolução e com compatibilidade HLS para navegadores web e Smart TVs.
 * Inclui controle anti-loop e rotação inteligente para fontes alternativas quando ocorrem falhas.
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

  // Mapa de URLs com falha temporária por canal (canalId -> Set de URLs com falha)
  private failedSourcesPerChannel = new Map<string, Set<string>>();

  public static getInstance(): ChannelSourceResolver {
    if (!ChannelSourceResolver.instance) {
      ChannelSourceResolver.instance = new ChannelSourceResolver();
    }
    return ChannelSourceResolver.instance;
  }

  /**
   * Extrai e ordena todas as fontes válidas de um canal
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

    // Ordenar: Oficiais primeiro, depois por resolução decrescente (1080p > 720p > 480p)
    validSources.sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) return -1;
      if (!a.isOfficial && b.isOfficial) return 1;
      return (b.resolutionHeight || 720) - (a.resolutionHeight || 720);
    });

    return validSources;
  }

  /**
   * Resolve a melhor fonte para reprodução, excluindo opcionalmente URLs que já falharam
   */
  public resolveBestSource(channel: LiveChannel, excludeUrls: string[] = []): ResolvedSourceResult {
    const allSources = this.getRankedSources(channel);
    const failedSet = this.failedSourcesPerChannel.get(channel.id) || new Set<string>();

    const totalExcluded = new Set([...excludeUrls, ...Array.from(failedSet)]);

    // Procura primeira fonte válida que não esteja na lista de falhas
    let chosenIndex = allSources.findIndex(s => !totalExcluded.has(s.url));

    // Se todas as fontes falharam, reseta as falhas e usa a primeira fonte principal para permitir retry
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
    const failedSet = this.failedSourcesPerChannel.get(channel.id) || new Set<string>();

    // Filtra fontes que ainda não falharam
    const candidates = allSources.filter(s => s.url !== currentFailedUrl && !failedSet.has(s.url));

    if (candidates.length > 0) {
      return candidates[0];
    }

    return null;
  }

  /**
   * Marca uma URL como falha temporária para o canal
   */
  public markSourceFailed(channelId: string, url: string): void {
    if (!url) return;
    let set = this.failedSourcesPerChannel.get(channelId);
    if (!set) {
      set = new Set<string>();
      this.failedSourcesPerChannel.set(channelId, set);
    }
    set.add(url);
  }

  /**
   * Limpa registro de falhas de um canal (ex: quando o usuário recarrega manualmente)
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
