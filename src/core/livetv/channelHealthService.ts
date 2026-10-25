import { LiveChannel, ChannelHealthStatus, LiveStreamSource } from './types';
import { liveTvProviderRegistry } from './LiveTVProviderRegistry';
import { liveStreamValidator, StreamHealthMetrics } from './LiveStreamValidator';
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
  public async checkChannelHealth(channel: LiveChannel, timeoutMs = 4500): Promise<ChannelHealthStatus> {
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

    let foundAvailable = false;
    let anyUnstable = false;

    for (const url of testUrls) {
      const status = await liveStreamValidator.validateStreamUrl(url, timeoutMs);
      if (status === 'AVAILABLE' || status === 'VERIFIED') {
        foundAvailable = true;
        // Se a fonte funcional for um backup, promove ela para stream principal
        if (url !== channel.streamUrl) {
          channel.streamUrl = url;
        }
        channel.status = 'AVAILABLE';
        liveTvProviderRegistry.updateChannelStatus(channel.id, 'AVAILABLE');
        return 'AVAILABLE';
      } else if (status === 'UNSTABLE') {
        anyUnstable = true;
      }
    }

    const finalStatus: ChannelHealthStatus = anyUnstable ? 'UNSTABLE' : 'UNAVAILABLE';
    channel.status = finalStatus;
    liveTvProviderRegistry.updateChannelStatus(channel.id, finalStatus);
    return finalStatus;
  }

  /**
   * Confirmação de reprodução real em runtime pelo Player com métricas de primeiro frame
   */
  public confirmPlayback(channel: LiveChannel, activeUrl: string, timeToFirstFrameMs?: number): void {
    if (channel.requiresExternalAccess) {
      channel.status = 'EXTERNAL_ACCESS';
      liveTvProviderRegistry.updateChannelStatus(channel.id, 'EXTERNAL_ACCESS');
      return;
    }
    channel.status = 'AVAILABLE';
    liveStreamValidator.recordPlaybackSuccess(activeUrl, timeToFirstFrameMs);
    channelSourceResolver.markSourceSuccess(channel.id, activeUrl);
    liveTvProviderRegistry.updateChannelStatus(channel.id, 'AVAILABLE');
  }

  /**
   * Registro de travamento (stalling) detectado pelo player
   */
  public recordStall(channel: LiveChannel, activeUrl: string): void {
    liveStreamValidator.recordStall(activeUrl);
    const metrics = liveStreamValidator.getMetrics(activeUrl);
    if (metrics && metrics.stallCount >= 3) {
      liveTvProviderRegistry.updateChannelStatus(channel.id, 'UNSTABLE');
    }
  }

  /**
   * Registro de duração acumulada de reprodução sem travamentos
   */
  public recordPlayDuration(activeUrl: string, seconds: number): void {
    liveStreamValidator.recordPlayDuration(activeUrl, seconds);
  }

  /**
   * Registro determinístico e unificado de falha de reprodução.
   * Registra a falha uma única vez, atualiza métricas e seleciona a próxima fonte se houver.
   */
  public handlePlaybackFailure(
    channel: LiveChannel,
    failedUrl: string,
    reason = 'Erro na transmissão',
    isNetwork = false,
    isPermanent = false
  ): LiveStreamSource | null {
    // 1. Registra no validador de saúde
    liveStreamValidator.recordPlaybackFailure(failedUrl, reason, isNetwork);

    // 2. Registra no resolvedor de fontes e busca próximo backup
    const nextSource = channelSourceResolver.getNextSource(channel, failedUrl, reason, isPermanent);

    // 3. Atualiza o status do canal no catálogo
    const newStatus: ChannelHealthStatus = nextSource ? 'UNSTABLE' : 'UNAVAILABLE';
    channel.status = newStatus;
    liveTvProviderRegistry.updateChannelStatus(channel.id, newStatus);

    return nextSource;
  }

  /**
   * Alias de compatibilidade com chamadas legadas
   */
  public reportPlaybackFailure(
    channel: LiveChannel,
    failedUrl: string,
    isNetwork = false,
    isPermanent = false
  ): LiveStreamSource | null {
    return this.handlePlaybackFailure(channel, failedUrl, 'Instabilidade de conexão', isNetwork, isPermanent);
  }

  /**
   * Obtém métricas de saúde de uma fonte
   */
  public getSourceMetrics(url: string): StreamHealthMetrics | undefined {
    return liveStreamValidator.getMetrics(url);
  }

  /**
   * Dispara verificação em lote dos canais principais com limitação de concorrência
   */
  public async verifyAllChannels(onProgress?: (completed: number, total: number) => void): Promise<void> {
    const channels = liveTvProviderRegistry.getAllChannels();
    const batchSize = 3;
    let completed = 0;

    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async ch => {
        await this.checkChannelHealth(ch, 3500);
        completed++;
        if (onProgress) onProgress(completed, channels.length);
      }));
    }
  }
}

export const channelHealthService = ChannelHealthService.getInstance();
