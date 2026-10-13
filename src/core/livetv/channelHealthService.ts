import { LiveChannel, ChannelHealthStatus } from './types';
import { channelRegistry } from './channelRegistry';
import { liveStreamValidator } from './LiveStreamValidator';

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
  public getPlayableUrl(channel: LiveChannel): string {
    return liveStreamValidator.getPlayableUrl(channel.streamUrl);
  }

  /**
   * Valida ativamente a disponibilidade da transmissão do canal
   */
  public async checkChannelHealth(channel: LiveChannel, timeoutMs = 4000): Promise<ChannelHealthStatus> {
    if (channel.requiresExternalAccess) {
      return 'AVAILABLE';
    }

    channelRegistry.updateChannelStatus(channel.id, 'CHECKING');

    const testUrls = [channel.streamUrl, ...(channel.backupStreamUrls || [])].filter(Boolean);
    if (testUrls.length === 0) {
      channelRegistry.updateChannelStatus(channel.id, 'UNAVAILABLE');
      return 'UNAVAILABLE';
    }

    for (const url of testUrls) {
      const status = await liveStreamValidator.validateStreamUrl(url, timeoutMs);
      if (status === 'AVAILABLE') {
        // Se a URL que funcionou for um backup, promove ela para stream principal
        if (url !== channel.streamUrl) {
          channel.streamUrl = url;
        }
        channelRegistry.updateChannelStatus(channel.id, 'AVAILABLE');
        return 'AVAILABLE';
      }
    }

    channelRegistry.updateChannelStatus(channel.id, 'UNAVAILABLE');
    return 'UNAVAILABLE';
  }

  /**
   * Dispara verificação em lote dos canais principais
   */
  public async verifyAllChannels(): Promise<void> {
    const channels = channelRegistry.getAllChannels();
    // Limita a concorrência para não travar o navegador
    const batchSize = 4;
    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(ch => this.checkChannelHealth(ch, 3000)));
    }
  }
}

export const channelHealthService = ChannelHealthService.getInstance();
