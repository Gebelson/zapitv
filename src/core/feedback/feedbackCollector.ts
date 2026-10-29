/**
 * ZapiTV — FeedbackCollector
 * Coletor de contexto técnico do lado do cliente para envio transparente de feedbacks.
 * Captura dados da mídia, do player, do ambiente e de diagnósticos sem invadir privacidade.
 */

import {
  FeedbackCategory,
  FeedbackSubmissionRequest,
  FeedbackSubmissionResponse,
  TechnicalContext
} from './feedbackTypes';
import { ContentItem } from '../../../types';
import { classifyFeedbackMedia } from './mediaClassifier';

export interface PlaybackContextOptions {
  item?: ContentItem;
  season?: number;
  episode?: number;
  sourceId?: string;
  providerId?: string;
  streamName?: string;
  streamUrlHost?: string;
  streamType?: 'hls' | 'mp4' | 'direct' | 'webtorrent' | 'unknown';
  requestedLanguage?: string;
  declaredLanguage?: string;
  activeAudioTrack?: string;
  selectedQuality?: string;
  detectedResolution?: string;
  selectedSubtitleId?: string;
  playerState?: 'playing' | 'paused' | 'buffering' | 'idle' | 'error' | 'intro';
  currentTimeSeconds?: number;
  durationSeconds?: number;
  lastErrorMessage?: string;
  errorCode?: string;
  failureStage?: 'source_discovery' | 'hls_manifest' | 'decoding' | 'playback_stall' | 'audio_sync' | 'subtitle_fetch' | 'none';
  isStalling?: boolean;
}

export class FeedbackCollector {
  private static clientTokenKey = 'zapitv_feedback_client_token';

  /**
   * Obtém ou gera um token anônimo de sessão para idempotência e prevenção de spam
   */
  private static offlineQueueKey = 'zapitv_feedback_offline_queue';

  /**
   * Obtém ou gera um token anônimo para idempotência
   */
  public static getClientSubmissionToken(forceNew: boolean = false): string {
    if (typeof window === 'undefined') return 'server_render';
    try {
      let token = forceNew ? null : sessionStorage.getItem(this.clientTokenKey);
      if (!token) {
        token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        sessionStorage.setItem(this.clientTokenKey, token);
      }
      return token;
    } catch {
      return `tok_fallback_${Date.now()}`;
    }
  }

  public static getOfflineQueue(): FeedbackSubmissionRequest[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.offlineQueueKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public static enqueueOfflineSubmission(request: FeedbackSubmissionRequest): void {
    if (typeof window === 'undefined') return;
    try {
      const queue = this.getOfflineQueue();
      const isAlreadyInQueue = queue.some(q => 
        q.clientSubmissionToken === request.clientSubmissionToken &&
        q.category === request.category
      );
      if (!isAlreadyInQueue) {
        queue.push(request);
        const trimmed = queue.slice(-25);
        localStorage.setItem(this.offlineQueueKey, JSON.stringify(trimmed));
      }
    } catch (e) {
      console.warn('[FeedbackCollector] Erro ao enfileirar feedback offline:', e);
    }
  }

  public static async flushOfflineQueue(): Promise<{ sent: number; failed: number }> {
    if (typeof window === 'undefined') return { sent: 0, failed: 0 };
    const queue = this.getOfflineQueue();
    if (!queue.length) return { sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;
    const remaining: FeedbackSubmissionRequest[] = [];

    for (const item of queue) {
      try {
        const response = await fetch('/api/feedback/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (response.ok || response.status === 400) {
          sent++;
        } else {
          remaining.push(item);
          failed++;
        }
      } catch {
        remaining.push(item);
        failed++;
        break;
      }
    }

    try {
      if (remaining.length) {
        localStorage.setItem(this.offlineQueueKey, JSON.stringify(remaining));
      } else {
        localStorage.removeItem(this.offlineQueueKey);
      }
    } catch {}

    return { sent, failed };
  }

  /**
   * Detecta informações essenciais de navegador e sistema operacional
   */
  public static detectEnvironment(): { browser: string; os: string; deviceType: 'desktop' | 'mobile' | 'tablet' | 'tv' } {
    if (typeof window === 'undefined' || !navigator) {
      return { browser: 'Node/Server', os: 'Linux', deviceType: 'desktop' };
    }

    const ua = navigator.userAgent;
    let browser = 'Desconhecido';
    let os = 'Desconhecido';
    let deviceType: 'desktop' | 'mobile' | 'tablet' | 'tv' = 'desktop';

    // Browser
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';
    else if (/opr\//i.test(ua)) browser = 'Opera';

    // OS
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/tizen|webos|smart-tv/i.test(ua)) os = 'SmartTV';

    // Device
    if (/tv|tizen|webos|googletv|appletv/i.test(ua)) {
      deviceType = 'tv';
    } else if (/tablet|ipad/i.test(ua)) {
      deviceType = 'tablet';
    } else if (/mobile|iphone|android/i.test(ua)) {
      deviceType = 'mobile';
    }

    return { browser, os, deviceType };
  }

  /**
   * Captura o contexto técnico completo no momento do reporte
   */
  public static captureTechnicalContext(options: PlaybackContextOptions = {}): TechnicalContext {
    const env = this.detectEnvironment();
    const item = options.item;
    const classification = classifyFeedbackMedia(
      item,
      options.season,
      options.episode,
      options.streamName
    );

    let host = options.streamUrlHost;
    if (!host && options.sourceId && options.sourceId.includes('://')) {
      try {
        host = new URL(options.sourceId).hostname;
      } catch {}
    }

    const currentRoute = typeof window !== 'undefined' && window.location ? window.location.pathname : '/';

    return {
      // Mídia rigorosamente tipada
      canonicalMediaId: classification.canonicalMediaId || item?.id,
      mediaTitle: item?.title || (classification.displayTitle || undefined),
      mediaType: classification.mediaType,
      season: classification.season,
      episode: classification.episode,
      year: item?.year,
      tmdbId: item?.tmdbId ? String(item.tmdbId) : undefined,
      imdbId: item?.imdbId,
      malId: item?.malId ? String(item.malId) : undefined,

      // Reprodução
      sourceId: options.sourceId,
      providerId: options.providerId,
      streamName: options.streamName,
      streamUrlHost: host,
      streamType: options.streamType || 'unknown',
      requestedLanguage: options.requestedLanguage || 'pt-BR',
      declaredLanguage: options.declaredLanguage,
      activeAudioTrack: options.activeAudioTrack,
      selectedQuality: options.selectedQuality || 'auto',
      detectedResolution: options.detectedResolution,
      selectedSubtitleId: options.selectedSubtitleId || 'off',
      playerState: options.playerState || 'idle',
      currentTimeSeconds: options.currentTimeSeconds,
      durationSeconds: options.durationSeconds,

      // Diagnóstico
      lastErrorMessage: options.lastErrorMessage,
      errorCode: options.errorCode,
      failureStage: options.failureStage || 'none',
      isStalling: options.isStalling,

      // Ambiente
      appVersion: '1.0.0',
      browser: env.browser,
      os: env.os,
      deviceType: env.deviceType,
      currentRoute,
      timestamp: Date.now()
    };
  }

  /**
   * Envia o feedback para o backend com tratamento de erros de rede
   */
  public static async sendFeedback(
    category: FeedbackCategory,
    userDescription?: string,
    contextOptions: PlaybackContextOptions = {}
  ): Promise<FeedbackSubmissionResponse> {
    const technicalContext = this.captureTechnicalContext(contextOptions);
    const clientSubmissionToken = this.getClientSubmissionToken();

    const requestPayload: FeedbackSubmissionRequest = {
      category,
      userDescription: userDescription?.trim() || '',
      technicalContext,
      clientSubmissionToken
    };

    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        let serverErrorMsg = `Servidor respondeu com código ${response.status}`;
        try {
          const errJson = await response.json();
          serverErrorMsg = errJson.error || errJson.details || serverErrorMsg;
        } catch {
          try {
            const errorText = await response.text();
            if (errorText) serverErrorMsg = errorText;
          } catch {}
        }

        return {
          success: false,
          reportId: '',
          clusterId: '',
          message: serverErrorMsg,
          error: serverErrorMsg,
          isNewCluster: false,
          isOfflineQueued: false,
          status: 'delivered'
        };
      }

      const data: FeedbackSubmissionResponse = await response.json();

      // Rotação do token para que envios subsequentes independentes não sejam bloqueados
      this.getClientSubmissionToken(true);

      // Tenta descarregar a fila offline em segundo plano
      this.flushOfflineQueue().catch(() => {});

      return {
        ...data,
        status: 'delivered'
      };
    } catch (err: any) {
      console.warn('[FeedbackCollector] Falha ao enviar para API do servidor, usando fallback local persistente:', err);

      this.enqueueOfflineSubmission(requestPayload);

      return {
        success: false,
        reportId: `fb_offline_${Date.now()}`,
        clusterId: 'pending_sync',
        message: 'Sem conexão com o servidor no momento. Seu relato foi salvo neste dispositivo (Aguardando envio) e será transmitido automaticamente quando a conexão retornar.',
        error: err?.message || 'Falha de conexão',
        isNewCluster: false,
        isOfflineQueued: true,
        status: 'queued_offline'
      };
    }
  }

  /**
   * Método de conveniência para submissão direta de feedbacks
   */
  public static submitFeedback(
    category: FeedbackCategory,
    userDescription?: string,
    contextOptions: PlaybackContextOptions = {}
  ): Promise<FeedbackSubmissionResponse> {
    return FeedbackCollector.sendFeedback(category, userDescription, contextOptions);
  }
}



if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => {
    FeedbackCollector.flushOfflineQueue().catch(() => {});
  });
}
