/**
 * ZAPITV — PLAYBACK OPTIMIZER SERVICE
 * 
 * Sistema central de otimização de reprodução para:
 * 1. Qualidade Adaptativa (ABR) inteligente para HLS e fontes diretas MP4/WebM.
 * 2. Otimização para conexões lentas (3G, 4G instável) e dispositivos fracos (Smart TVs, celulares antigos).
 * 3. Buffer dinâmico proporcional à rede e memória disponível.
 * 4. Inicialização ultra-rápida (TTFF < 500ms) com pré-buffer em segundo plano.
 * 5. Detecção de compatibilidade de formatos e codecs por plataforma.
 * 6. Detecção ativa de congelamentos (stalls) e recuperação automática com preservação de continuidade.
 * 7. Telemetria e diagnóstico em tempo real (bitrate, buffering, frames perdidos).
 */

import Hls, { HlsConfig } from 'hls.js';
import { StremioStream } from '../stremio/stremioTypes';
import { audioCodecService } from '../audio/audioCodecService';

export interface NetworkProfile {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown';
  downlinkMbps: number;
  rttMs: number;
  saveData: boolean;
  isSlowConnection: boolean;
  isUnstable: boolean;
}

export interface DeviceProfile {
  deviceType: 'smart-tv' | 'mobile' | 'tablet' | 'desktop';
  isLowEnd: boolean;
  screenResolution: { width: number; height: number };
  maxOptimalResolution: '4K' | '1440p' | '1080p' | '720p' | '480p' | '360p';
  recommendedInitialQuality: '4K' | '1080p' | '720p' | '480p' | '360p';
  memoryLimitMB: number;
  hardwareConcurrency: number;
}

export interface PlaybackTelemetry {
  ttffMs: number | null; // Time to First Frame
  bufferingCount: number;
  totalBufferingDurationMs: number;
  currentBitrateKbps: number | null;
  currentResolution: string;
  bufferAheadSeconds: number;
  droppedFrames: number;
  totalFrames: number;
  stallsRecovered: number;
  activeAbrMode: 'auto' | 'manual';
  effectiveNetworkType: string;
  streamSourceType: 'hls' | 'mp4' | 'dash' | 'unknown';
}

export interface QualityVariant {
  quality: string;
  height: number;
  bitrate?: number;
  streamIndex?: number;
  hlsLevelIndex?: number;
}

export interface ProviderPerformanceRecord {
  providerId: string;
  totalAttempts: number;
  successfulAttempts: number;
  averageLatencyMs: number;
  lastAttemptTime: number;
}

export class PlaybackOptimizerService {
  private static instance: PlaybackOptimizerService;

  // Histórico de desempenho e latência dos provedores de fontes
  private providerStats = new Map<string, ProviderPerformanceRecord>();

  // Telemetria ativa
  private telemetry: PlaybackTelemetry = {
    ttffMs: null,
    bufferingCount: 0,
    totalBufferingDurationMs: 0,
    currentBitrateKbps: null,
    currentResolution: 'auto',
    bufferAheadSeconds: 0,
    droppedFrames: 0,
    totalFrames: 0,
    stallsRecovered: 0,
    activeAbrMode: 'auto',
    effectiveNetworkType: 'unknown',
    streamSourceType: 'unknown'
  };

  // Medição de largura de banda em tempo real (EWMA)
  private estimatedBandwidthBps = 5_000_000; // Padrão inicial: 5 Mbps
  private loadStartTime = 0;
  private bufferStartTime: number | null = null;
  private stallTimeoutTimer: any = null;
  private healthCheckInterval: any = null;

  // Listeners de telemetria
  private telemetryListeners = new Set<(telemetry: PlaybackTelemetry) => void>();

  private constructor() {
    this.initNetworkMonitoring();
  }

  public static getInstance(): PlaybackOptimizerService {
    if (!PlaybackOptimizerService.instance) {
      PlaybackOptimizerService.instance = new PlaybackOptimizerService();
    }
    return PlaybackOptimizerService.instance;
  }

  /**
   * Monitoramento de mudanças na rede (online/offline e Network Information API)
   */
  private initNetworkMonitoring(): void {
    if (typeof window === 'undefined') return;

    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
      const updateNetwork = () => {
        const net = this.getNetworkProfile();
        this.telemetry.effectiveNetworkType = net.effectiveType;
        this.notifyTelemetry();
      };
      try {
        conn.addEventListener('change', updateNetwork);
      } catch {}
    }
  }

  /**
   * Identifica o perfil de rede atual com detecção inteligente de conexões lentas e instáveis
   */
  public getNetworkProfile(): NetworkProfile {
    const nav = (typeof navigator !== 'undefined' ? navigator : (globalThis as any)?.navigator) as any;
    if (!nav) {
      return {
        effectiveType: 'unknown',
        downlinkMbps: 10,
        rttMs: 50,
        saveData: false,
        isSlowConnection: false,
        isUnstable: false
      };
    }

    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    const effectiveType = conn?.effectiveType || (nav.onLine ? '4g' : 'slow-2g');
    const downlinkMbps = conn?.downlink ?? (this.estimatedBandwidthBps / 1_000_000);
    const rttMs = conn?.rtt ?? 60;
    const saveData = Boolean(conn?.saveData);

    const isSlowConnection = saveData ||
      effectiveType === 'slow-2g' ||
      effectiveType === '2g' ||
      effectiveType === '3g' ||
      downlinkMbps < 2.5 ||
      rttMs > 350;

    const isUnstable = rttMs > 400 || (this.telemetry.bufferingCount > 3 && this.telemetry.totalBufferingDurationMs > 5000);

    return {
      effectiveType,
      downlinkMbps,
      rttMs,
      saveData,
      isSlowConnection,
      isUnstable
    };
  }

  /**
   * Perfil detalhado de capacidades do dispositivo e tela
   */
  public getDeviceProfile(): DeviceProfile {
    const nav = (typeof navigator !== 'undefined' ? navigator : (globalThis as any)?.navigator) as any;
    if (!nav) {
      return {
        deviceType: 'desktop',
        isLowEnd: false,
        screenResolution: { width: 1920, height: 1080 },
        maxOptimalResolution: '1080p',
        recommendedInitialQuality: '1080p',
        memoryLimitMB: 512,
        hardwareConcurrency: 4
      };
    }

    const ua = (nav.userAgent || '').toLowerCase();
    const hwConcurrency = nav.hardwareConcurrency || 4;
    const deviceMemory = nav.deviceMemory || 4;

    const isSmartTv = /smart-tv|tizen|webos|viera|bravia|netcast|crkey|aft|googletv/i.test(ua);
    const isMobile = !isSmartTv && /mobile|android|iphone|ipod/i.test(ua);
    const winScreen = typeof window !== 'undefined' ? window.screen : null;
    const isTablet = !isSmartTv && (/ipad/i.test(ua) || (isMobile && winScreen && Math.min(winScreen.width, winScreen.height) >= 600));
    const isDesktop = !isSmartTv && !isMobile && !isTablet;

    const deviceType: DeviceProfile['deviceType'] = isSmartTv ? 'smart-tv' : (isMobile ? 'mobile' : (isTablet ? 'tablet' : 'desktop'));
    const isLowEnd = hwConcurrency <= 2 || deviceMemory <= 2 || isSmartTv;

    const screenWidth = typeof window !== 'undefined' ? (window.screen?.width || 1920) : 1920;
    const screenHeight = typeof window !== 'undefined' ? (window.screen?.height || 1080) : 1080;
    const maxDimension = Math.max(screenWidth, screenHeight);

    let maxOptimalResolution: DeviceProfile['maxOptimalResolution'] = '1080p';
    if (maxDimension >= 3840 && !isLowEnd) {
      maxOptimalResolution = '4K';
    } else if (maxDimension >= 2560 && !isLowEnd) {
      maxOptimalResolution = '1440p';
    } else if (maxDimension <= 854 || (isMobile && isLowEnd)) {
      maxOptimalResolution = '720p';
    }

    const net = this.getNetworkProfile();
    let recommendedInitialQuality: DeviceProfile['recommendedInitialQuality'] = '1080p';
    if (net.isSlowConnection) {
      recommendedInitialQuality = net.effectiveType === 'slow-2g' || net.effectiveType === '2g' ? '360p' : '480p';
    } else if (net.downlinkMbps < 5 || isLowEnd) {
      recommendedInitialQuality = '720p';
    }

    const memoryLimitMB = isSmartTv ? 64 : (isLowEnd ? 128 : 512);

    return {
      deviceType,
      isLowEnd,
      screenResolution: { width: screenWidth, height: screenHeight },
      maxOptimalResolution,
      recommendedInitialQuality,
      memoryLimitMB,
      hardwareConcurrency: hwConcurrency
    };
  }

  /**
   * Constrói configuração HLS.js customizada de alta performance para a conexão e dispositivo
   */
  public buildOptimalHlsConfig(): Partial<HlsConfig> {
    const net = this.getNetworkProfile();
    const dev = this.getDeviceProfile();

    // Em conexões lentas ou aparelhos fracos: buffer menor para economizar memória e evitar OOM
    let maxBufferLength = 30;
    let maxMaxBufferLength = 60;
    let maxBufferSize = 30 * 1024 * 1024; // 30 MB

    if (net.isSlowConnection || dev.isLowEnd) {
      maxBufferLength = 15;
      maxMaxBufferLength = 30;
      maxBufferSize = 15 * 1024 * 1024; // 15 MB
    } else if (net.downlinkMbps >= 15 && !dev.isLowEnd) {
      // Conexão rápida em desktop: buffer generoso para zero travamentos
      maxBufferLength = 45;
      maxMaxBufferLength = 90;
      maxBufferSize = 60 * 1024 * 1024; // 60 MB
    }

    return {
      enableWorker: true,
      lowLatencyMode: false, // Desativa baixa latência em VoD para garantir buffer contínuo sem micro-travas
      backBufferLength: dev.isLowEnd ? 30 : 60,
      maxBufferLength,
      maxMaxBufferLength,
      maxBufferSize,
      capLevelToPlayerSize: true, // Nunca baixa 4K se o player for menor que 1080p
      autoStartLoad: true,
      startFragPrefetch: true, // Carrega antecipadamente o próximo segmento
      fragLoadingTimeOut: net.isSlowConnection ? 20000 : 12000,
      manifestLoadingTimeOut: 10000,
      fragLoadingMaxRetry: 4,
      fragLoadingRetryDelay: 800,
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 4,
      // Fatores ABR balanceados: conservador para evitar oscilações bruscas
      abrBandWidthFactor: net.isSlowConnection ? 0.80 : 0.90,
      abrBandWidthUpFactor: 0.70, // Cauteloso ao subir de qualidade
      abrEwmaDefaultEstimate: net.isSlowConnection ? 800_000 : 3_500_000,
      abrEwmaFastVoD: 2.0,
      abrEwmaSlowVoD: 6.0,
      startLevel: net.isSlowConnection ? 0 : -1 // Força menor resolução de início em 3G/2G para TTFF < 500ms
    };
  }

  /**
   * Notifica início do carregamento de uma mídia para contagem de TTFF
   */
  public notifyLoadStart(sourceType: 'hls' | 'mp4' | 'dash' | 'unknown'): void {
    this.loadStartTime = performance.now();
    this.telemetry.ttffMs = null;
    this.telemetry.streamSourceType = sourceType;
    this.telemetry.bufferingCount = 0;
    this.telemetry.totalBufferingDurationMs = 0;
    this.telemetry.stallsRecovered = 0;
    this.bufferStartTime = null;
  }

  /**
   * Registra primeiro frame renderizado (TTFF medido)
   */
  public notifyFirstFrame(): void {
    if (this.loadStartTime > 0 && this.telemetry.ttffMs === null) {
      this.telemetry.ttffMs = Math.round(performance.now() - this.loadStartTime);
      this.notifyTelemetry();
    }
  }

  /**
   * Registra evento de início de buffering (vídeo esperando dados)
   */
  public notifyBufferingStart(): void {
    if (this.bufferStartTime === null) {
      this.bufferStartTime = performance.now();
      this.telemetry.bufferingCount++;
      this.notifyTelemetry();
    }
  }

  /**
   * Registra encerramento de buffering e contabiliza tempo acumulado
   */
  public notifyBufferingEnd(): void {
    if (this.bufferStartTime !== null) {
      const duration = performance.now() - this.bufferStartTime;
      this.telemetry.totalBufferingDurationMs += Math.round(duration);
      this.bufferStartTime = null;
      this.notifyTelemetry();
    }
  }

  /**
   * Atualiza métricas ao vivo do elemento de vídeo HTML5
   */
  public updateVideoMetrics(video: HTMLVideoElement | null, activeQuality: string): void {
    if (!video) return;

    // 1. Buffer à frente
    const currentTime = video.currentTime;
    let bufferAhead = 0;
    if (video.buffered && video.buffered.length > 0) {
      for (let i = 0; i < video.buffered.length; i++) {
        const start = video.buffered.start(i);
        const end = video.buffered.end(i);
        if (currentTime >= start && currentTime <= end) {
          bufferAhead = Math.max(0, end - currentTime);
          break;
        }
      }
    }
    this.telemetry.bufferAheadSeconds = Math.round(bufferAhead * 10) / 10;
    this.telemetry.currentResolution = activeQuality;

    // 2. Frames perdidos (via API VideoPlaybackQuality se disponível)
    if (typeof (video as any).getVideoPlaybackQuality === 'function') {
      try {
        const qual = (video as any).getVideoPlaybackQuality();
        this.telemetry.droppedFrames = qual.droppedVideoFrames || 0;
        this.telemetry.totalFrames = qual.totalVideoFrames || 0;
      } catch {}
    }

    this.notifyTelemetry();
  }

  /**
   * Registra a taxa de transferência real medida após o download de um segmento
   */
  public recordSampleThroughput(bytes: number, durationMs: number): void {
    if (durationMs <= 0 || bytes <= 0) return;
    const bps = (bytes * 8) / (durationMs / 1000);
    // Filtro EWMA: 80% do valor anterior + 20% da nova medição
    this.estimatedBandwidthBps = Math.round(this.estimatedBandwidthBps * 0.8 + bps * 0.2);
    this.telemetry.currentBitrateKbps = Math.round(this.estimatedBandwidthBps / 1000);
    this.notifyTelemetry();
  }

  /**
   * Avalia e decide a qualidade ABR ótima para fontes MP4 nativas (Multi-Source ABR)
   */
  public evaluateMultiSourceAbr(params: {
    availableQualities: string[];
    currentQuality: string;
    bufferAheadSeconds: number;
    isStalling: boolean;
  }): { shouldChange: boolean; targetQuality: string; reason: string } {
    const { availableQualities, currentQuality, bufferAheadSeconds, isStalling } = params;
    const qualities = availableQualities.filter(q => q !== 'auto');
    if (qualities.length <= 1) {
      return { shouldChange: false, targetQuality: currentQuality, reason: 'Apenas uma resolução disponível' };
    }

    const net = this.getNetworkProfile();
    const ORDER: Record<string, number> = {
      '360p': 1,
      '480p': 2,
      '720p': 3,
      '1080p': 4,
      '1440p': 5,
      '4K': 6
    };

    const sorted = [...qualities].sort((a, b) => (ORDER[a] || 0) - (ORDER[b] || 0));
    const currentIndex = sorted.findIndex(q => q.toLowerCase() === currentQuality.toLowerCase());

    // 1. REGRA DE DOWNGRADE RÁPIDO (Proteção Anti-Travamento)
    // Se o buffer estiver crítico (< 2.5s) ou houve stall em conexão lenta/instável
    if ((isStalling || bufferAheadSeconds < 2.5) && currentIndex > 0) {
      const lowerQuality = sorted[Math.max(0, currentIndex - 1)];
      return {
        shouldChange: true,
        targetQuality: lowerQuality,
        reason: `Buffer crítico (${bufferAheadSeconds.toFixed(1)}s) ou travamento. Reduzindo para ${lowerQuality} para garantir reprodução contínua.`
      };
    }

    // 2. REGRA DE UPGRADE CAUTELOSO
    // Se o buffer estiver muito saudável (> 25s) de forma estável e a conexão permitir
    if (bufferAheadSeconds > 25 && !net.isSlowConnection && !net.isUnstable && currentIndex < sorted.length - 1) {
      const higherQuality = sorted[currentIndex + 1];
      // Não sobe para 4K se for tela pequena de celular ou dispositivo fraco
      const dev = this.getDeviceProfile();
      if (higherQuality === '4K' && dev.isLowEnd) {
        return { shouldChange: false, targetQuality: currentQuality, reason: '4K evitado por restrição de hardware do dispositivo' };
      }

      return {
        shouldChange: true,
        targetQuality: higherQuality,
        reason: `Conexão estável e buffer saudável (${bufferAheadSeconds.toFixed(1)}s). Aumentando para ${higherQuality}.`
      };
    }

    return { shouldChange: false, targetQuality: currentQuality, reason: 'Qualidade ótima mantida' };
  }

  /**
   * Limpa ou reinicia os contadores de telemetria
   */
  public resetTelemetry(): void {
    this.telemetry = {
      ttffMs: null,
      bufferingCount: 0,
      totalBufferingDurationMs: 0,
      currentBitrateKbps: null,
      currentResolution: 'auto',
      bufferAheadSeconds: 0,
      droppedFrames: 0,
      totalFrames: 0,
      stallsRecovered: 0,
      activeAbrMode: 'auto',
      effectiveNetworkType: this.getNetworkProfile().effectiveType,
      streamSourceType: 'unknown'
    };
    this.notifyTelemetry();
  }

  /**
   * Notifica que um travamento foi recuperado com sucesso
   */
  public recordStallRecovered(): void {
    this.telemetry.stallsRecovered++;
    this.notifyTelemetry();
  }

  /**
   * Obtém snapshot imutável da telemetria
   */
  public getTelemetry(): PlaybackTelemetry {
    return { ...this.telemetry };
  }

  /**
   * Assina atualizações de telemetria
   */
  public subscribeTelemetry(listener: (telemetry: PlaybackTelemetry) => void): () => void {
    this.telemetryListeners.add(listener);
    listener(this.getTelemetry());
    return () => this.telemetryListeners.delete(listener);
  }

  /**
   * Registra resultado de consulta a um provedor para orientar ordenação e concorrência
   */
  public recordProviderResult(providerId: string, latencyMs: number, success: boolean): void {
    const existing = this.providerStats.get(providerId) || {
      providerId,
      totalAttempts: 0,
      successfulAttempts: 0,
      averageLatencyMs: latencyMs,
      lastAttemptTime: Date.now()
    };

    existing.totalAttempts++;
    if (success) {
      existing.successfulAttempts++;
      // EWMA da latência: 70% histórico, 30% nova medição
      existing.averageLatencyMs = Math.round(existing.averageLatencyMs * 0.7 + latencyMs * 0.3);
    }
    existing.lastAttemptTime = Date.now();
    this.providerStats.set(providerId, existing);
  }

  /**
   * Calcula pontuação dinâmica para o provedor com base em histórico real de velocidade e disponibilidade
   */
  public getProviderScore(providerId: string): number {
    const stats = this.providerStats.get(providerId);
    if (!stats || stats.totalAttempts === 0) return 0;

    let score = 0;
    const successRate = stats.successfulAttempts / stats.totalAttempts;

    // Confiabilidade histórica
    if (successRate >= 0.85) score += 3000;
    else if (successRate < 0.40) score -= 6000;

    // Latência e velocidade média de resposta
    if (stats.averageLatencyMs < 400) score += 4000;
    else if (stats.averageLatencyMs < 800) score += 2000;
    else if (stats.averageLatencyMs > 4000) score -= 5000;

    return score;
  }

  public getProviderStats(providerId: string): ProviderPerformanceRecord | undefined {
    return this.providerStats.get(providerId);
  }

  public getAllProviderStats(): ProviderPerformanceRecord[] {
    return Array.from(this.providerStats.values());
  }

  private notifyTelemetry(): void {
    const data = this.getTelemetry();
    this.telemetryListeners.forEach(fn => fn(data));
  }
}

export const playbackOptimizerService = PlaybackOptimizerService.getInstance();
