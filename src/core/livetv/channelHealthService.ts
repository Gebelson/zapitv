import { LiveChannel, ChannelHealthStatus } from './types';
import { liveTvProviderRegistry } from './LiveTVProviderRegistry';
import { liveStreamValidator } from './LiveStreamValidator';
import { channelSourceResolver } from './ChannelSourceResolver';

export class ChannelHealthService {
  private static instance: ChannelHealthService;

  public static getInstance(): ChannelHealthService {
    if (!ChannelHealthService.instance) {
      ChannelHealthService.instance = new ChannelHealthService();
    }
    return ChannelHealthService.instance;
  }

  /**
   * Converte a URL do stream para a rota de proxy do ZapiTV caso necessário para evitar bloqueio por CORS
   */
  public getPlayableUrl(channelOrUrl: LiveChannel | string): string {
    const rawUrl = typeof channelOrUrl === 'string' ? channelOrUrl : channelOrUrl.streamUrl;
    return liveStreamValidator.getPlayableUrl(rawUrl);
  }

  /**
   * Valida ativamente a disponibilidade da transmissão do canal
   */
  public async checkChannelHealth(channel: LiveChannel, timeoutMs = 4000): Promise<ChannelHealthStatus> {
    if (channel.requiresExternalAccess) {
      liveTvProviderRegistry.updateChannelStatus(channel.id, 'EXTERNAL_ACCESS');
      return 'EXTERNAL_ACCESS';
    }

    liveTvProviderRegistry.updateChannelStatus(channel.id, 'CHECKING');

    const sources = channelSourceResolver.getRankedSources(channel);
    const testUrls = sources.map(s => s.url).filter(Boolean);

    if (testUrls.length === 0) {
      liveTvProviderRegistry.updateChannelStatus(channel.id, 'UNAVAILABLE');
      return 'UNAVAILABLE';
    }

    for (const url of testUrls) {
      const status = await liveStreamValidator.validateStreamUrl(url, timeoutMs);
      if (status === 'AVAILABLE') {
        // Se a URL que funcionou for um backup, promove ela para stream principal
        if (url !== channel.streamUrl) {
          channel.streamUrl = url;
        }
        liveTvProviderRegistry.updateChannelStatus(channel.id, 'AVAILABLE');
        return 'AVAILABLE';
      }
    }

    liveTvProviderRegistry.updateChannelStatus(channel.id, 'UNAVAILABLE');
    return 'UNAVAILABLE';
  }

  /**
   * Confirmação de reprodução real em runtime pelo Player (Etapa 2)
   */
  public confirmPlayback(channel: LiveChannel, activeUrl: string): void {
    if (channel.requiresExternalAccess) {
      liveTvProviderRegistry.updateChannelStatus(channel.id, 'EXTERNAL_ACCESS');
      return;
    }
    liveStreamValidator.recordPlaybackSuccess(activeUrl);
    liveTvProviderRegistry.updateChannelStatus(channel.id, 'AVAILABLE');
  }

  /**
   * Registro de erro de reprodução real pelo Player (Etapa 2)
   */
  public reportPlaybackFailure(channel: LiveChannel, failedUrl: string, isNetwork = false): void {
    liveStreamValidator.recordPlaybackFailure(failedUrl, isNetwork);
    channelSourceResolver.markSourceFailed(channel.id, failedUrl);

    // Se o canal ainda tem fontes não testadas, marca como UNSTABLE; se todas falharem, UNAVAILABLE
    const nextSource = channelSourceResolver.getNextSource(channel, failedUrl);
    const newStatus: ChannelHealthStatus = nextSource ? 'UNSTABLE' : 'UNAVAILABLE';
    liveTvProviderRegistry.updateChannelStatus(channel.id, newStatus);
  }

  /**
   * Dispara verificação em lote dos canais principais com limitação de concorrência
   */
  public async verifyAllChannels(onProgress?: (completed: number, total: number) => void): Promise<void> {
    const channels = liveTvProviderRegistry.getAllChannels();
    const batchSize = 4;
    let completed = 0;

    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async ch => {
        await this.checkChannelHealth(ch, 3000);
        completed++;
        if (onProgress) onProgress(completed, channels.length);
      }));
    }
  }
}

export const channelHealthService = ChannelHealthService.getInstance();
