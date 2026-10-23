/**
 * ZAPITV — TV PERFORMANCE SERVICE
 * 
 * Monitoramento leve de métricas de desempenho e diagnóstico em tempo real
 * especificamente calibrado para Smart TVs (Samsung Tizen / Media Station X).
 * 
 * Monitora:
 * - FPS e estabilidade de intervalos entre frames (target 16.67ms @ 60Hz).
 * - Frames lentos (jank / long frames > 33ms ou > 50ms).
 * - Latência de resposta aos comandos do controle remoto (D-Pad, Enter, Back).
 * - Contagem de nós DOM navegáveis e camadas GPU no viewport da TV.
 * - Perfil adaptativo de hardware (Alto Desempenho, Equilibrado, Econômico).
 */

export interface TvPerformanceMetrics {
  fps: number;
  avgFrameTimeMs: number;
  droppedFrames: number;
  jankCount: number;
  lastInputLatencyMs: number;
  avgInputLatencyMs: number;
  domNodeCount: number;
  navigableFocusableCount: number;
  activeImageDecodes: number;
  gpuLayerHintCount: number;
  hardwareProfile: 'high' | 'balanced' | 'eco';
}

class TvPerformanceService {
  private static instance: TvPerformanceService;

  private isTv: boolean = false;
  private rafId: number | null = null;
  private lastFrameTime: number = 0;
  private frameTimes: number[] = [];
  private jankCount: number = 0;
  private droppedFrames: number = 0;
  private fps: number = 60;
  private avgFrameTimeMs: number = 16.6;

  private inputLatencies: number[] = [];
  private lastInputLatencyMs: number = 0;
  private currentHardwareProfile: 'high' | 'balanced' | 'eco' = 'balanced';

  private activeImageDecodes: number = 0;
  private isSamplingActive: boolean = false;
  private samplingSubscribers = new Set<() => void>();

  private constructor() {
    this.detectHardwareProfile();
  }

  public static getInstance(): TvPerformanceService {
    if (!TvPerformanceService.instance) {
      TvPerformanceService.instance = new TvPerformanceService();
    }
    return TvPerformanceService.instance;
  }

  /**
   * Identifica o perfil de hardware seguro da Smart TV
   */
  public detectHardwareProfile(): 'high' | 'balanced' | 'eco' {
    if (typeof window === 'undefined') {
      this.currentHardwareProfile = 'balanced';
      return 'balanced';
    }

    const ua = (navigator.userAgent || '').toLowerCase();
    const nav = navigator as any;
    const isSamsungTv = /tizen|maple|samsung.*(?:tv|smarttv)|mediastationx|media\s*station\s*x/i.test(ua);
    const hwConcurrency = nav.hardwareConcurrency || 4;
    const deviceMemory = nav.deviceMemory || 4;

    // Smart TVs como Samsung The Frame / Tizen ou MSX possuem restrições de VRAM na GPU
    if (isSamsungTv) {
      if (deviceMemory <= 2 || hwConcurrency <= 2) {
        this.currentHardwareProfile = 'eco';
      } else {
        this.currentHardwareProfile = 'balanced';
      }
    } else if (hwConcurrency >= 8 && deviceMemory >= 8) {
      this.currentHardwareProfile = 'high';
    } else {
      this.currentHardwareProfile = 'balanced';
    }

    return this.currentHardwareProfile;
  }

  public getHardwareProfile(): 'high' | 'balanced' | 'eco' {
    return this.currentHardwareProfile;
  }

  public setHardwareProfile(profile: 'high' | 'balanced' | 'eco'): void {
    this.currentHardwareProfile = profile;
    this.notifySubscribers();
  }

  /**
   * Inicia amostragem leve de frames sem consumir CPU
   */
  public startFrameSampling(): void {
    if (this.isSamplingActive || typeof window === 'undefined') return;
    this.isSamplingActive = true;
    this.lastFrameTime = performance.now();
    this.frameTimes = [];

    const sample = (now: number) => {
      if (!this.isSamplingActive) return;

      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      if (delta > 0 && delta < 500) {
        this.frameTimes.push(delta);
        if (this.frameTimes.length > 60) {
          this.frameTimes.shift();
        }

        // Frame maior que 33.3ms em 60Hz indica queda de frame (jank)
        if (delta > 33.3) {
          this.jankCount++;
          const dropped = Math.max(1, Math.round(delta / 16.67) - 1);
          this.droppedFrames += dropped;
        }

        const sum = this.frameTimes.reduce((acc, t) => acc + t, 0);
        this.avgFrameTimeMs = sum / this.frameTimes.length;
        this.fps = Math.min(60, Math.round(1000 / Math.max(1, this.avgFrameTimeMs)));
      }

      this.rafId = requestAnimationFrame(sample);
    };

    this.rafId = requestAnimationFrame(sample);
  }

  public stopFrameSampling(): void {
    this.isSamplingActive = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Registra a latência entre um comando físico do controle remoto e sua renderização
   */
  public recordInputLatency(startMs: number): void {
    const latency = Math.max(0, performance.now() - startMs);
    this.lastInputLatencyMs = latency;
    this.inputLatencies.push(latency);
    if (this.inputLatencies.length > 50) {
      this.inputLatencies.shift();
    }
  }

  public recordImageDecodeStart(): void {
    this.activeImageDecodes++;
  }

  public recordImageDecodeEnd(): void {
    this.activeImageDecodes = Math.max(0, this.activeImageDecodes - 1);
  }

  /**
   * Obtém métricas consolidadas em tempo real
   */
  public getMetrics(): TvPerformanceMetrics {
    let domNodeCount = 0;
    let navigableFocusableCount = 0;
    let gpuLayerHintCount = 0;

    if (typeof document !== 'undefined') {
      const tvRoot = document.querySelector('[data-tv-app-root]') || document.body;
      domNodeCount = tvRoot ? tvRoot.querySelectorAll('*').length : 0;
      navigableFocusableCount = document.querySelectorAll('[data-focus-key]').length;
      gpuLayerHintCount = document.querySelectorAll('.will-change-transform, .transform-gpu').length;
    }

    const avgInput = this.inputLatencies.length > 0
      ? this.inputLatencies.reduce((a, b) => a + b, 0) / this.inputLatencies.length
      : 0;

    return {
      fps: this.fps,
      avgFrameTimeMs: Number(this.avgFrameTimeMs.toFixed(1)),
      droppedFrames: this.droppedFrames,
      jankCount: this.jankCount,
      lastInputLatencyMs: Number(this.lastInputLatencyMs.toFixed(1)),
      avgInputLatencyMs: Number(avgInput.toFixed(1)),
      domNodeCount,
      navigableFocusableCount,
      activeImageDecodes: this.activeImageDecodes,
      gpuLayerHintCount,
      hardwareProfile: this.currentHardwareProfile
    };
  }

  public subscribe(callback: () => void): () => void {
    this.samplingSubscribers.add(callback);
    return () => {
      this.samplingSubscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    this.samplingSubscribers.forEach(cb => cb());
  }

  public resetStats(): void {
    this.frameTimes = [];
    this.jankCount = 0;
    this.droppedFrames = 0;
    this.inputLatencies = [];
    this.lastInputLatencyMs = 0;
  }
}

export const tvPerformanceService = TvPerformanceService.getInstance();
