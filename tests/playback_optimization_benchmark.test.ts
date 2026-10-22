import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playbackOptimizerService } from '../src/core/playback/PlaybackOptimizerService';
import { audioCodecService } from '../src/core/audio/audioCodecService';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';

describe('ZapiTV — Playback Optimizer & Network Simulation Benchmarks', () => {
  beforeEach(() => {
    playbackOptimizerService.resetTelemetry();
    vi.restoreAllMocks();
  });

  describe('1. Detecção de Perfil de Rede e Conexão Lenta (3G / 2G / Slow Wi-Fi)', () => {
    it('deve identificar conexão 3G lenta e ativar modo de otimização de banda', () => {
      // Mock do navigator.connection simulando rede móvel 3G
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 (Linux; Android 10) Chrome/90.0 Mobile',
          connection: {
            effectiveType: '3g',
            downlink: 1.2,
            rtt: 450,
            saveData: false,
            addEventListener: vi.fn()
          }
        },
        configurable: true,
        writable: true
      });

      const net = playbackOptimizerService.getNetworkProfile();
      expect(net.effectiveType).toBe('3g');
      expect(net.downlinkMbps).toBe(1.2);
      expect(net.rttMs).toBe(450);
      expect(net.isSlowConnection).toBe(true);
      expect(net.isUnstable).toBe(true); // RTT > 400ms
    });

    it('deve identificar Wi-Fi de alta velocidade e não restringir buffer', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
          connection: {
            effectiveType: '4g',
            downlink: 85.0,
            rtt: 25,
            saveData: false,
            addEventListener: vi.fn()
          }
        },
        configurable: true,
        writable: true
      });

      const net = playbackOptimizerService.getNetworkProfile();
      expect(net.effectiveType).toBe('4g');
      expect(net.downlinkMbps).toBe(85.0);
      expect(net.isSlowConnection).toBe(false);
      expect(net.isUnstable).toBe(false);
    });

    it('deve ativar isSlowConnection imediatamente se o usuário tiver saveData=true', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 Chrome/120.0',
          connection: {
            effectiveType: '4g',
            downlink: 15.0,
            rtt: 50,
            saveData: true,
            addEventListener: vi.fn()
          }
        },
        configurable: true,
        writable: true
      });

      const net = playbackOptimizerService.getNetworkProfile();
      expect(net.saveData).toBe(true);
      expect(net.isSlowConnection).toBe(true);
    });
  });

  describe('2. Configuração HLS Adaptativa Dinâmica por Dispositivo e Rede', () => {
    it('deve gerar configuração restrita e segura de memória para Smart TVs', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 (SmartHub; SMART-TV; U; Linux/SmartTV) AppleWebKit/538.1 (KHTML, like Gecko) Version/5.0 TV Safari/538.1',
          hardwareConcurrency: 2,
          connection: {
            effectiveType: '4g',
            downlink: 15,
            rtt: 60,
            saveData: false,
            addEventListener: vi.fn()
          }
        },
        configurable: true,
        writable: true
      });

      const dev = playbackOptimizerService.getDeviceProfile();
      expect(dev.deviceType).toBe('smart-tv');
      expect(dev.isLowEnd).toBe(true);
      expect(dev.memoryLimitMB).toBeLessThanOrEqual(64);

      const hlsConfig = playbackOptimizerService.buildOptimalHlsConfig();
      expect(hlsConfig.maxBufferSize).toBeLessThanOrEqual(30 * 1024 * 1024); // máximo 30MB para evitar OOM na TV
      expect(hlsConfig.capLevelToPlayerSize).toBe(true);
      expect(hlsConfig.enableWorker).toBe(true);
    });

    it('não classifica uma TV capaz como hardware fraco apenas pelo tipo de aparelho', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 (SMART-TV; Tizen)',
          hardwareConcurrency: 8,
          deviceMemory: 4,
          connection: { effectiveType: '4g', downlink: 20, rtt: 40 }
        },
        configurable: true,
        writable: true
      });

      const dev = playbackOptimizerService.getDeviceProfile();
      const config = playbackOptimizerService.buildOptimalHlsConfig();
      expect(dev.deviceType).toBe('smart-tv');
      expect(dev.isLowEnd).toBe(false);
      expect(dev.recommendedInitialQuality).toBe('1080p');
      expect(config.maxBufferLength).toBe(30);
      expect(config.maxBufferSize).toBe(30 * 1024 * 1024);
    });

    it('deve iniciar no nível mais baixo (360p/480p) em conexões 3G para garantir TTFF rápido', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
          hardwareConcurrency: 4,
          connection: {
            effectiveType: '3g',
            downlink: 1.0,
            rtt: 500,
            saveData: false,
            addEventListener: vi.fn()
          }
        },
        configurable: true,
        writable: true
      });

      const hlsConfig = playbackOptimizerService.buildOptimalHlsConfig();
      expect(hlsConfig.startLevel).toBe(0); // Força menor resolução de início para não travar
      expect(hlsConfig.maxBufferLength).toBe(15); // Buffer curto de 15s para não esgotar largura de banda
    });
  });

  describe('3. Algoritmo ABR Multi-Fonte (MP4 / WebM / Direct Streams)', () => {
    const availableQualities = ['360p', '480p', '720p', '1080p'];

    it('deve realizar DOWNGRADE RÁPIDO para prevenir travamento se buffer < 2.5s', () => {
      const decision = playbackOptimizerService.evaluateMultiSourceAbr({
        availableQualities,
        currentQuality: '1080p',
        bufferAheadSeconds: 1.8, // Buffer crítico: 1.8 segundos
        isStalling: false
      });

      expect(decision.shouldChange).toBe(true);
      expect(decision.targetQuality).toBe('720p');
      expect(decision.reason).toContain('Buffer crítico');
    });

    it('deve realizar DOWNGRADE RÁPIDO para 360p se ocorrer stall em 480p', () => {
      const decision = playbackOptimizerService.evaluateMultiSourceAbr({
        availableQualities,
        currentQuality: '480p',
        bufferAheadSeconds: 0.5,
        isStalling: true // Stall ativo
      });

      expect(decision.shouldChange).toBe(true);
      expect(decision.targetQuality).toBe('360p');
    });

    it('não deve fazer downgrade abaixo da menor qualidade disponível', () => {
      const decision = playbackOptimizerService.evaluateMultiSourceAbr({
        availableQualities,
        currentQuality: '360p',
        bufferAheadSeconds: 0.2,
        isStalling: true
      });

      expect(decision.shouldChange).toBe(false);
      expect(decision.targetQuality).toBe('360p');
    });

    it('deve realizar UPGRADE CAUTELOSO para 1080p quando o buffer exceder 25s de forma estável', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          connection: {
            effectiveType: '4g',
            downlink: 40.0,
            rtt: 30,
            saveData: false,
            addEventListener: vi.fn()
          }
        },
        configurable: true,
        writable: true
      });

      const decision = playbackOptimizerService.evaluateMultiSourceAbr({
        availableQualities,
        currentQuality: '720p',
        bufferAheadSeconds: 28.5, // Buffer abundante
        isStalling: false
      });

      expect(decision.shouldChange).toBe(true);
      expect(decision.targetQuality).toBe('1080p');
      expect(decision.reason).toContain('Conexão estável e buffer saudável');
    });

    it('não deve promover para 4K em dispositivo com hardware fraco ou tela pequena', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 (Linux; Android 9; LowEndMobile)',
          hardwareConcurrency: 2,
          connection: {
            effectiveType: '4g',
            downlink: 50.0,
            rtt: 40,
            saveData: false,
            addEventListener: vi.fn()
          }
        },
        configurable: true,
        writable: true
      });

      const decision = playbackOptimizerService.evaluateMultiSourceAbr({
        availableQualities: ['720p', '1080p', '4K'],
        currentQuality: '1080p',
        bufferAheadSeconds: 30.0,
        isStalling: false
      });

      expect(decision.shouldChange).toBe(false);
      expect(decision.targetQuality).toBe('1080p');
      expect(decision.reason).toContain('4K evitado');
    });
  });

  describe('4. Telemetria e Monitoramento de Stalls e TTFF', () => {
    it('deve registrar e calcular Time To First Frame (TTFF) com precisão', () => {
      playbackOptimizerService.notifyLoadStart('hls');
      const initialMetrics = playbackOptimizerService.getTelemetry();
      expect(initialMetrics.ttffMs).toBeNull();
      expect(initialMetrics.streamSourceType).toBe('hls');

      // Simula passagem de tempo e notifica primeiro frame
      playbackOptimizerService.notifyFirstFrame();

      const updated = playbackOptimizerService.getTelemetry();
      expect(updated.ttffMs).not.toBeNull();
      expect(updated.ttffMs).toBeGreaterThanOrEqual(0);
    });

    it('deve acumular contadores de buffering e duração total de pausas', () => {
      playbackOptimizerService.notifyBufferingStart();
      playbackOptimizerService.notifyBufferingEnd();

      const t = playbackOptimizerService.getTelemetry();
      expect(t.bufferingCount).toBe(1);
      expect(t.totalBufferingDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('deve registrar recuperações de stall bem-sucedidas', () => {
      playbackOptimizerService.recordStallRecovered();
      playbackOptimizerService.recordStallRecovered();

      const t = playbackOptimizerService.getTelemetry();
      expect(t.stallsRecovered).toBe(2);
    });

    it('deve notificar assinantes quando a telemetria for atualizada', () => {
      let notifiedCount = 0;
      const unsub = playbackOptimizerService.subscribeTelemetry(() => {
        notifiedCount++;
      });

      // Já recebe a emissão inicial
      expect(notifiedCount).toBe(1);

      // Simula elemento de vídeo com buffer
      const mockVideo = {
        currentTime: 10,
        buffered: {
          length: 1,
          start: () => 0,
          end: () => 25
        }
      } as unknown as HTMLVideoElement;

      playbackOptimizerService.updateVideoMetrics(mockVideo, '720p');
      expect(notifiedCount).toBe(2);

      const t = playbackOptimizerService.getTelemetry();
      expect(t.bufferAheadSeconds).toBe(15);
      expect(t.currentResolution).toBe('720p');

      unsub();
    });
  });

  describe('5. Priorização de Codecs de Áudio Compatíveis', () => {
    it('deve identificar codecs universais (AAC e MP3)', () => {
      const aacStream: any = {
        name: 'Torrentio',
        title: 'Movie 1080p [AAC 2.0 Stereo - Universal]',
        url: 'https://cdn.example.com/movie_aac.mp4'
      };

      const eac3Stream: any = {
        name: 'Torrentio',
        title: 'Movie 1080p [DDP 5.1 / E-AC3]',
        url: 'https://cdn.example.com/movie_eac3.mkv'
      };

      const aacInfo = audioCodecService.inspectStreamCodecs(aacStream);
      const eac3Info = audioCodecService.inspectStreamCodecs(eac3Stream);

      expect(aacInfo.primaryCodec).toBe('aac');
      expect(aacInfo.isUniversal).toBe(true);
      expect(eac3Info.primaryCodec).toBe('eac3');
      expect(eac3Info.isUniversal).toBe(false);
    });
  });

  describe('6. Avaliação e Pontuação de Provedores (Score por Latência e Sucesso)', () => {
    it('deve atribuir score positivo a provedores rápidos e com alta taxa de sucesso', () => {
      // 3 requisições rápidas de 300ms com 100% de sucesso
      playbackOptimizerService.recordProviderResult('fast-provider', 300, true);
      playbackOptimizerService.recordProviderResult('fast-provider', 280, true);
      playbackOptimizerService.recordProviderResult('fast-provider', 320, true);

      const score = playbackOptimizerService.getProviderScore('fast-provider');
      const stats = playbackOptimizerService.getProviderStats('fast-provider');

      expect(stats?.totalAttempts).toBe(3);
      expect(stats?.successfulAttempts).toBe(3);
      expect(stats?.averageLatencyMs).toBeLessThan(500);
      expect(score).toBeGreaterThan(0);
    });

    it('deve penalizar severamente provedores lentos ou com falhas frequentes', () => {
      // Provedor com timeouts e alta taxa de falha
      playbackOptimizerService.recordProviderResult('slow-failing-provider', 8000, false);
      playbackOptimizerService.recordProviderResult('slow-failing-provider', 9000, false);
      playbackOptimizerService.recordProviderResult('slow-failing-provider', 6000, true);

      const score = playbackOptimizerService.getProviderScore('slow-failing-provider');
      const stats = playbackOptimizerService.getProviderStats('slow-failing-provider');

      expect(stats?.totalAttempts).toBe(3);
      expect(stats?.successfulAttempts).toBe(1);
      expect(stats?.averageLatencyMs).toBeGreaterThan(6000);
      expect(score).toBeLessThan(0);
    });
  });

  describe('7. Seleção Inteligente de Fontes e Adaptação à Conexão (3G vs Wi-Fi)', () => {
    it('deve penalizar fontes 4K pesadas e priorizar HLS adaptativo em rede 3G', () => {
      // Simula conexão 3G móvel lenta
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          userAgent: 'Mozilla/5.0 (Linux; Android 10) Mobile',
          connection: {
            effectiveType: '3g',
            downlink: 1.0,
            rtt: 500,
            saveData: false,
            addEventListener: vi.fn()
          }
        },
        configurable: true,
        writable: true
      });

      const net = playbackOptimizerService.getNetworkProfile();
      expect(net.isSlowConnection).toBe(true);

      const stream4kMp4: any = {
        name: 'Torrentio',
        title: 'Filme 4K UHD 2160p [MP4 40Mbps]',
        url: 'https://cdn.example.com/filme_4k.mp4',
        quality: '2160p',
        sourceType: 'mp4',
        isDubbed: true,
        isPtBr: true,
        providerId: 'provider-a'
      };

      const streamHls720p: any = {
        name: 'Show Subtitle',
        title: 'Filme 720p HLS Adaptativo Dublado PT-BR',
        url: 'https://cdn.example.com/filme.m3u8',
        quality: '720p',
        sourceType: 'hls',
        isDubbed: true,
        isPtBr: true,
        providerId: 'provider-b'
      };

      const ranked = sourceSelectionService.rankStreams([stream4kMp4, streamHls720p], {
        hasExternalPtSub: true
      });

      // Em 3G, o HLS adaptativo 720p deve ser ranqueado acima do 4K de 40Mbps para não travar
      expect(ranked[0].sourceType).toBe('hls');
    });
  });
});


