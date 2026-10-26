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
  lastEventLatencyMs: number;
  lastVisualLatencyMs: number;
  lastInputLatencyMs: number;
  avgInputLatencyMs: number;
  domNodeCount: number;
  navigableFocusableCount: number;
  activeImageDecodes: number;
  gpuLayerHintCount: number;
  hardwareProfile: 'high' | 'balanced' | 'eco';
  deviceFamily?: 'firetv' | 'samsung' | 'msx' | 'generic';
  deviceModel?: string;
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
  private lastEventLatencyMs: number = 0;
  private lastVisualLatencyMs: number = 0;
  private lastDomCheckTime: number = 0;
  private cachedDomNodeCount: number = 0;
  private cachedNavigableCount: number = 0;
  private cachedGpuLayerCount: number = 0;
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
   * Detecta se o ambiente de execução é um dispositivo Amazon Fire TV
   */
  public isFireTv(customUa?: string): boolean {
    if (typeof window === 'undefined' && !customUa) return false;
    const ua = (customUa || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '').toLowerCase();

    // Identificadores confiáveis de User-Agent do ecossistema Amazon Fire OS:
    // 1. Identificadores de hardware oficiais Fire TV (AFTT, AFTM, AFTMM, AFTKA, AFTKM, AFTA, AFTEU, etc.)
    // 2. Navegador oficial Silk (Silk/, Silk-Accelerated, AmazonWebAppPlatform)
    // 3. Menções explícitas a FireTV, Fire OS, ou Media Station X rodando sobre Fire OS
    const isAftModel = /\b(aft[a-z0-9]+)\b/i.test(ua);
    const isSilkBrowser = /silk\/|silk-accelerated|amazonwebappplatform/i.test(ua);
    const isFireTvBrand = /firetv|fire\s*tv|fireos/i.test(ua);
    const isAmazonAndroid = /amazon/i.test(ua) && (/android/i.test(ua) || /tv/i.test(ua));
    const isMsxOnFireTv = /mediastationx|media\s*station\s*x/i.test(ua) && (/aft/i.test(ua) || /amazon/i.test(ua) || /fire/i.test(ua));

    return isAftModel || isSilkBrowser || isFireTvBrand || isAmazonAndroid || isMsxOnFireTv;
  }

  /**
   * Retorna a família do dispositivo detectado
   */
  public getDeviceFamily(customUa?: string): 'firetv' | 'samsung' | 'msx' | 'generic' {
    const ua = (customUa || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '').toLowerCase();
    if (this.isFireTv(ua)) return 'firetv';
    if (/tizen|maple|samsung.*(?:tv|smarttv)/i.test(ua)) return 'samsung';
    if (/mediastationx|media\s*station\s*x/i.test(ua)) return 'msx';
    return 'generic';
  }

  /**
   * Retorna o modelo amigável ou identificador de dispositivo
   */
  public getDeviceModel(customUa?: string): string {
    const ua = (customUa || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '').toLowerCase();
    if (this.isFireTv(ua)) {
      if (/\baftkm\b/i.test(ua)) return 'Amazon Fire TV Stick 4K Max (Gen 2)';
      if (/\baftka\b/i.test(ua)) return 'Amazon Fire TV Stick 4K Max';
      if (/\baftga\b/i.test(ua)) return 'Amazon Fire TV Stick 4K (Gen 2)';
      if (/\baftmm\b/i.test(ua)) return 'Amazon Fire TV Stick 4K';
      if (/\baftss\b/i.test(ua)) return 'Amazon Fire TV Stick Lite';
      if (/\baftt\b/i.test(ua)) return 'Amazon Fire TV Stick (Gen 2/3)';
      if (/\baftm\b/i.test(ua)) return 'Amazon Fire TV Stick (Gen 1)';
      if (/\bafteu\b/i.test(ua)) return 'Amazon Fire TV Cube (Gen 3)';
      if (/\bafta\b|\baftr\b/i.test(ua)) return 'Amazon Fire TV Cube';
      if (/\bafts\b/i.test(ua)) return 'Amazon Fire TV';
      if (/silk/i.test(ua)) return 'Amazon Fire TV (Silk Browser)';
      if (/mediastationx|media\s*station\s*x/i.test(ua)) return 'Fire OS (Media Station X)';
      return 'Amazon Fire TV';
    }
    if (/tizen/i.test(ua)) return 'Samsung Tizen TV';
    if (/mediastationx|media\s*station\s*x/i.test(ua)) return 'Media Station X';
    if (/webos/i.test(ua)) return 'LG webOS TV';
    return 'Dispositivo Padrão';
  }

  /**
   * Identifica o perfil de hardware seguro da Smart TV
   */
  public detectHardwareProfile(customUa?: string): 'high' | 'balanced' | 'eco' {
    if (typeof window === 'undefined' && !customUa) {
      this.currentHardwareProfile = 'balanced';
      return 'balanced';
    }

    const ua = (customUa || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '').toLowerCase();
    // Um UA fornecido para diagnóstico/teste não deve herdar o hardware do executor.
    const nav = (!customUa && typeof navigator !== 'undefined' ? navigator : {}) as any;
    const isFireTv = this.isFireTv(ua);
    const isSamsungTv = /tizen|maple|samsung.*(?:tv|smarttv)|mediastationx|media\s*station\s*x/i.test(ua);
    const hwConcurrency = nav.hardwareConcurrency || 4;
    const deviceMemory = nav.deviceMemory || 4;

    // Dispositivos Fire TV: perfil conservador econômico por padrão para garantir fluidez imediata
    // e prevenir travamentos do compositor gráfico na GPU limitada de sticks HDMI
    if (isFireTv) {
      const isHighEndFireTv = /\b(afteu|aftkm)\b/i.test(ua) && hwConcurrency >= 4 && deviceMemory >= 2;
      this.currentHardwareProfile = isHighEndFireTv ? 'balanced' : 'eco';
      return this.currentHardwareProfile;
    }

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
   * Registra a latência do comando físico:
   * - eventDurationOrStart: tempo do handler de evento síncrono (ou timestamp de início)
   * - visualDuration: tempo total percebido até a pintura do primeiro frame (requestAnimationFrame)
   */
  public recordInputLatency(eventDurationOrStart: number, visualDuration?: number): void {
    let eventMs = 0;
    let visualMs = 0;

    if (visualDuration !== undefined) {
      eventMs = Math.max(0, eventDurationOrStart);
      visualMs = Math.max(0, visualDuration);
    } else {
      eventMs = Math.max(0, performance.now() - eventDurationOrStart);
      visualMs = eventMs;
    }

    this.lastEventLatencyMs = Number(eventMs.toFixed(1));
    this.lastVisualLatencyMs = Number(visualMs.toFixed(1));
    this.lastInputLatencyMs = Number(visualMs.toFixed(1));
    this.inputLatencies.push(visualMs);
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
    const now = performance.now();
    // Cache de contagem DOM: evita querySelectorAll('*') custoso a cada 250ms
    if (typeof document !== 'undefined' && now - this.lastDomCheckTime > 2000) {
      this.lastDomCheckTime = now;
      const tvRoot = document.querySelector('[data-tv-app-root]') || document.body;
      this.cachedDomNodeCount = tvRoot ? tvRoot.querySelectorAll('*').length : 0;
      this.cachedNavigableCount = document.querySelectorAll('[data-focus-key]').length;
      this.cachedGpuLayerCount = document.querySelectorAll('.will-change-transform, .transform-gpu').length;
    }

    const avgInput = this.inputLatencies.length > 0
      ? this.inputLatencies.reduce((a, b) => a + b, 0) / this.inputLatencies.length
      : 0;

    return {
      fps: this.fps,
      avgFrameTimeMs: Number(this.avgFrameTimeMs.toFixed(1)),
      droppedFrames: this.droppedFrames,
      jankCount: this.jankCount,
      lastEventLatencyMs: this.lastEventLatencyMs,
      lastVisualLatencyMs: this.lastVisualLatencyMs,
      lastInputLatencyMs: Number(this.lastInputLatencyMs.toFixed(1)),
      avgInputLatencyMs: Number(avgInput.toFixed(1)),
      domNodeCount: this.cachedDomNodeCount,
      navigableFocusableCount: this.cachedNavigableCount,
      activeImageDecodes: this.activeImageDecodes,
      gpuLayerHintCount: this.cachedGpuLayerCount,
      hardwareProfile: this.currentHardwareProfile,
      deviceFamily: this.getDeviceFamily(),
      deviceModel: this.getDeviceModel()
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
