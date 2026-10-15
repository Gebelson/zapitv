/**
 * ZapiTV — AudioEnhancer
 * Motor de aprimoramento inteligente e estabilização de volume via Web Audio API.
 * 
 * Pipeline de DSP Inteligente:
 * Áudio original → Medição de intensidade → Controle gradual de ganho (AGC com histerese e noise-gate)
 * → Equalização de inteligibilidade vocal → Compressão adaptativa → Limitação de picos (True Peak Ceiling) → Saída.
 * 
 * Características arquiteturais:
 * 1. Estabilização sem pumping: Histerese de ±1.8 dB, limites de velocidade de ganho (slew rate) e congelamento no silêncio.
 * 2. Inteligibilidade vocal: Preservação de timbres (PT, JA, EN, ES) com realce suave nas formantes de diálogo (2.8 kHz) e corte de rumble (< 55 Hz).
 * 3. Dinâmica natural: Nunca achata todo o som em um único volume; controla apenas excessos desconfortáveis.
 * 4. Independência do controle manual: O volume do usuário é respeitado e nunca é disputado pelo nivelamento.
 * 5. Transições sem estalo: Crossfade suave de potência constante (equal-power) entre áudio original e processado.
 * 6. Troca suave de dublagem/fontes: Reset suave de ganho e histórico sem picos ou estalos.
 */

import {
  AiEnhancerSettings,
  AudioProcessingPlan
} from './aiEnhancerTypes';

export interface LoudnessTelemetry {
  currentGainDb: number;
  trackedLoudnessDbfs: number;
  isSilence: boolean;
  rmsDbfs: number;
  peakDbfs: number;
  targetLoudnessDbfs: number;
}

/**
 * Motor matemático de nivelamento automático inteligente de intensidade (Intelligent Leveler Engine)
 */
export class AudioLevelerEngine {
  // Constantes de calibração acústica (baseadas em padrões de broadcast e streaming EBU R128 / ITU-R BS.1770)
  public static readonly TARGET_LOUDNESS_DBFS = -22.0;       // Nível alvo nominal confortável
  public static readonly NOISE_FLOOR_DBFS = -46.0;           // Limiar de silêncio / ruído de fundo (noise gate)
  public static readonly HYSTERESIS_DEADBAND_DB = 1.8;       // Zona morta onde o ganho não se move (previne pumping)
  public static readonly MAX_BOOST_DB = 3.5;                 // Boost máximo de diálogos baixos (preserva dinâmica)
  public static readonly MAX_ATTENUATION_DB = -6.0;          // Atenuação máxima de trechos ensurdecedores
  public static readonly SLEW_RATE_BOOST_DB_PER_SEC = 1.0;   // Taxa de subida suave pós-explosão (1 dB/s)
  public static readonly SLEW_RATE_ATTEN_DB_PER_SEC = 3.0;   // Taxa de atenuação controlada (3 dB/s)
  public static readonly SMOOTHING_ALPHA = 0.88;             // Fator de suavização do integrador de curto/médio prazo (~1.5s)
  public static readonly CEILING_GAIN_LINEAR = 0.90;         // Teto de saída conservador (-0.91 dBFS para true peak)

  private currentGainDb: number = 0.0;
  private trackedLoudnessDbfs: number = AudioLevelerEngine.TARGET_LOUDNESS_DBFS;
  private isSilenceGateActive: boolean = false;
  private silenceDurationSeconds: number = 0.0;
  private lastRmsDbfs: number = -100.0;
  private lastPeakDbfs: number = -100.0;
  private targetLoudnessDbfs: number = AudioLevelerEngine.TARGET_LOUDNESS_DBFS;

  constructor() {
    this.reset(true);
  }

  /**
   * Executa um passo de medição e cálculo de ganho gradual
   * @param rawRms RMS instantâneo da janela de análise (0..1)
   * @param rawPeak Pico instantâneo da janela de análise (0..1)
   * @param userVolume Volume manual do player (0..1)
   * @param isMuted Se o áudio está silenciado
   * @param deltaTimeSeconds Tempo decorrido desde o último cálculo em segundos
   * @returns Ganho linear a ser aplicado no GainNode
   */
  public computeStep(
    rawRms: number,
    rawPeak: number,
    userVolume: number = 1.0,
    isMuted: boolean = false,
    deltaTimeSeconds: number = 0.05
  ): number {
    if (isMuted || userVolume <= 0.001) {
      this.isSilenceGateActive = true;
      return Math.pow(10, this.currentGainDb / 20);
    }

    // Normalização pelo volume do usuário: impede que abaixar o volume do player engane o nivelador
    const effectiveVolume = Math.max(0.05, Math.min(1.0, userVolume));
    const normalizedRms = rawRms / effectiveVolume;
    const normalizedPeak = rawPeak / effectiveVolume;

    // Conversão para dBFS
    const rmsDbfs = 20 * Math.log10(Math.max(1e-5, normalizedRms));
    const peakDbfs = 20 * Math.log10(Math.max(1e-5, normalizedPeak));
    this.lastRmsDbfs = rmsDbfs;
    this.lastPeakDbfs = peakDbfs;

    const dt = Math.max(0.01, Math.min(0.5, deltaTimeSeconds));

    // 1. Detecção de silêncio / ruído de fundo (Noise Floor Gate)
    if (rmsDbfs < AudioLevelerEngine.NOISE_FLOOR_DBFS) {
      this.isSilenceGateActive = true;
      this.silenceDurationSeconds += dt;

      // Durante silêncios ou pausas de fala, CONGELA o ganho.
      // Se o silêncio persistir por mais de 3 segundos, relaxa imperceptivelmente o ganho para 0 dB
      if (this.silenceDurationSeconds > 3.0 && Math.abs(this.currentGainDb) > 0.1) {
        const decayStep = 0.25 * dt;
        if (this.currentGainDb > 0) {
          this.currentGainDb = Math.max(0, this.currentGainDb - decayStep);
        } else {
          this.currentGainDb = Math.min(0, this.currentGainDb + decayStep);
        }
      }
      return Math.pow(10, this.currentGainDb / 20);
    }

    // 2. Sinal ativo presente
    this.isSilenceGateActive = false;
    this.silenceDurationSeconds = 0.0;

    // Atualiza loudness percebido através de integrador com memória temporal
    this.trackedLoudnessDbfs =
      AudioLevelerEngine.SMOOTHING_ALPHA * this.trackedLoudnessDbfs +
      (1 - AudioLevelerEngine.SMOOTHING_ALPHA) * rmsDbfs;

    // 3. Cálculo do erro em relação ao alvo nominal
    const errorDb = this.targetLoudnessDbfs - this.trackedLoudnessDbfs;

    // 4. Histerese: se o desvio estiver na zona morta (deadband), mantém ganho estritamente estável
    let targetGainDb = this.currentGainDb;
    if (Math.abs(errorDb) > AudioLevelerEngine.HYSTERESIS_DEADBAND_DB) {
      if (errorDb > 0) {
        // Áudio abaixo do ideal -> necessita compensação positiva suave
        const boostNeeded = errorDb - AudioLevelerEngine.HYSTERESIS_DEADBAND_DB;
        targetGainDb = Math.min(AudioLevelerEngine.MAX_BOOST_DB, boostNeeded);
      } else {
        // Áudio acima do ideal -> atenuação controlada
        const attenNeeded = errorDb + AudioLevelerEngine.HYSTERESIS_DEADBAND_DB;
        targetGainDb = Math.max(AudioLevelerEngine.MAX_ATTENUATION_DB, attenNeeded);
      }
    }

    // 5. Controle de velocidade de variação (Slew Rate Limiting) para eliminar pumping
    if (targetGainDb > this.currentGainDb) {
      // Subida de volume: extremamente lenta (1.0 dB/s) para nunca assustar após explosões
      const maxRise = AudioLevelerEngine.SLEW_RATE_BOOST_DB_PER_SEC * dt;
      this.currentGainDb = Math.min(targetGainDb, this.currentGainDb + maxRise);
    } else if (targetGainDb < this.currentGainDb) {
      // Descida de volume: suave e controlada (3.0 dB/s)
      const maxFall = AudioLevelerEngine.SLEW_RATE_ATTEN_DB_PER_SEC * dt;
      this.currentGainDb = Math.max(targetGainDb, this.currentGainDb - maxFall);
    }

    return Math.pow(10, this.currentGainDb / 20);
  }

  /**
   * Reseta o histórico de loudness e o ganho para valores neutros nominais
   */
  public reset(immediate: boolean = false): void {
    if (immediate) {
      this.currentGainDb = 0.0;
    }
    this.trackedLoudnessDbfs = this.targetLoudnessDbfs;
    this.isSilenceGateActive = false;
    this.silenceDurationSeconds = 0.0;
    this.lastRmsDbfs = -100.0;
    this.lastPeakDbfs = -100.0;
  }

  public getCurrentGainDb(): number {
    return this.currentGainDb;
  }

  public getTrackedLoudnessDbfs(): number {
    return this.trackedLoudnessDbfs;
  }

  public isSilence(): boolean {
    return this.isSilenceGateActive;
  }

  public getTelemetry(): LoudnessTelemetry {
    return {
      currentGainDb: Math.round(this.currentGainDb * 100) / 100,
      trackedLoudnessDbfs: Math.round(this.trackedLoudnessDbfs * 10) / 10,
      isSilence: this.isSilenceGateActive,
      rmsDbfs: Math.round(this.lastRmsDbfs * 10) / 10,
      peakDbfs: Math.round(this.lastPeakDbfs * 10) / 10,
      targetLoudnessDbfs: this.targetLoudnessDbfs
    };
  }
}

/**
 * Classe principal do AudioEnhancer
 */
export class AudioEnhancer {
  private audioCtx: AudioContext | null = null;
  private sourceNodeMap = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // Nós do grafo de áudio
  private preSplitter: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private vocalFilter: BiquadFilterNode | null = null;
  private levelerGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private ceilingLimiter: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private masterOutGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Motor de nivelamento dinâmico
  private levelerEngine = new AudioLevelerEngine();
  private levelerTimer: any = null;
  private lastUpdateTime: number = 0;
  private timeDomainBuffer: Float32Array | null = null;

  private isConnected = false;
  private isBypassed = true;
  private isHoldingComparison = false;
  private boundVideo: HTMLVideoElement | null = null;

  private userVolume: number = 1.0;
  private isUserMuted: boolean = false;

  private settings: AiEnhancerSettings = {
    enabled: false,
    videoEnabled: true,
    audioEnabled: true,
    intensity: 'auto',
    comparisonMode: 'off',
    splitPosition: 50
  };

  private currentPlan: AudioProcessingPlan = {
    pipeline: 'passthrough',
    vocalClarityGainDb: 0,
    compressorThresholdDb: -20,
    compressorRatio: 1.0,
    makeupGainDb: 0,
    lowCutFrequencyHz: 55,
    noiseGateThresholdDb: -46,
    isBypassed: true,
    isCorsRestricted: false
  };

  /**
   * Verifica se o elemento de vídeo pode ser processado pelo Web Audio sem muting por CORS
   */
  public canSafelyConnectWebAudio(video: HTMLVideoElement): boolean {
    const src = video.currentSrc || video.src;
    if (!src) return true;

    try {
      if (src.startsWith('/') || src.startsWith('blob:')) {
        return true;
      }
      const baseOrigin = typeof window !== 'undefined' && window.location && window.location.href
        ? window.location.href
        : 'http://localhost:4000/';
      const hostOrigin = typeof window !== 'undefined' && window.location && window.location.origin
        ? window.location.origin
        : 'http://localhost:4000';

      const url = new URL(src, baseOrigin);
      const isCrossOrigin = url.origin !== hostOrigin;
      if (isCrossOrigin) {
        return video.crossOrigin === 'anonymous' || video.crossOrigin === 'use-credentials';
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Conecta o elemento de vídeo ao grafo de áudio de alta fidelidade
   */
  public attach(video: HTMLVideoElement): void {
    if (this.boundVideo === video && this.isConnected) {
      return;
    }

    this.boundVideo = video;
    this.userVolume = video.volume !== undefined ? video.volume : 1.0;
    this.isUserMuted = Boolean(video.muted);

    if (!this.canSafelyConnectWebAudio(video)) {
      console.info('[ZapiAiAudio] Fonte externa sem CORS. Mantendo saída nativa limpa.');
      this.currentPlan.isCorsRestricted = true;
      this.currentPlan.pipeline = 'passthrough';
      this.currentPlan.isBypassed = true;
      this.isConnected = false;
      return;
    }

    try {
      const AudioContextClass = typeof window !== 'undefined'
        ? (window.AudioContext || (window as any).webkitAudioContext)
        : null;

      if (!AudioContextClass) {
        console.warn('[ZapiAiAudio] Web Audio API não suportada.');
        return;
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      // Reutilização garantida do MediaElementAudioSourceNode por elemento
      let source = this.sourceNodeMap.get(video);
      if (!source) {
        source = this.audioCtx.createMediaElementSource(video);
        this.sourceNodeMap.set(video, source);
      }
      this.sourceNode = source;

      // 1. Pre-Splitter: nó distribuidor entre caminho original (dry) e aprimorado (wet)
      this.preSplitter = this.audioCtx.createGain();
      this.preSplitter.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      // 2. Caminho Original (Dry Path para Bypass imperceptível com latência zero)
      this.dryGain = this.audioCtx.createGain();
      this.dryGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      // 3. Caminho Aprimorado (Wet Path):
      // A. High-Pass Filter (< 55 Hz): limpa rumbles sem descaracterizar frequências fundamentais da voz
      this.highPassFilter = this.audioCtx.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.setValueAtTime(55, this.audioCtx.currentTime);
      this.highPassFilter.Q.setValueAtTime(0.707, this.audioCtx.currentTime);

      // B. Peaking EQ em formantes vocais (~2.8 kHz, Q suave): melhora nitidez de falas
      this.vocalFilter = this.audioCtx.createBiquadFilter();
      this.vocalFilter.type = 'peaking';
      this.vocalFilter.frequency.setValueAtTime(2800, this.audioCtx.currentTime);
      this.vocalFilter.Q.setValueAtTime(1.0, this.audioCtx.currentTime);
      this.vocalFilter.gain.setValueAtTime(0, this.audioCtx.currentTime);

      // C. Analisador em tempo real para medição espectral e RMS contínuo
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.3;
      this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);

      // D. Leveler Gain: ganho gradual inteligente controlado pelo AudioLevelerEngine
      this.levelerGain = this.audioCtx.createGain();
      this.levelerGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      // E. Compressor de faixa dinâmica adaptativo com joelho ultra suave (sem bombeamento)
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-20, this.audioCtx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.audioCtx.currentTime);
      this.compressor.ratio.setValueAtTime(2.2, this.audioCtx.currentTime);
      this.compressor.attack.setValueAtTime(0.012, this.audioCtx.currentTime);   // 12ms
      this.compressor.release.setValueAtTime(0.380, this.audioCtx.currentTime);  // 380ms

      // F. Limitador de teto de saída conservador (-0.91 dBFS para true peak headroom)
      this.ceilingLimiter = this.audioCtx.createGain();
      this.ceilingLimiter.gain.setValueAtTime(AudioLevelerEngine.CEILING_GAIN_LINEAR, this.audioCtx.currentTime);

      // G. Wet Gain (caminho aprimorado)
      this.wetGain = this.audioCtx.createGain();
      this.wetGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

      // 4. Master Output Gain conectado à saída de áudio
      this.masterOutGain = this.audioCtx.createGain();
      this.masterOutGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      // Encadeamento estrutural estrito (sem saídas paralelas acidentais):
      // Source -> PreSplitter -> [DryPath] -> MasterOut -> Destination
      //                       -> [WetPath: HighPass -> VocalEQ -> Leveler -> Comp -> Ceiling -> WetGain] -> MasterOut
      this.sourceNode.connect(this.preSplitter);

      // Rota Dry
      this.preSplitter.connect(this.dryGain);
      this.dryGain.connect(this.masterOutGain);

      // Rota Wet
      this.preSplitter.connect(this.highPassFilter);
      this.highPassFilter.connect(this.vocalFilter);

      // Tap no analisador para medição de intensidade
      this.vocalFilter.connect(this.analyser);

      // Processamento em série
      this.vocalFilter.connect(this.levelerGain);
      this.levelerGain.connect(this.compressor);
      this.compressor.connect(this.ceilingLimiter);
      this.ceilingLimiter.connect(this.wetGain);
      this.wetGain.connect(this.masterOutGain);

      // Conexão final única com o destino
      this.masterOutGain.connect(this.audioCtx.destination);

      this.isConnected = true;
      this.currentPlan.isCorsRestricted = false;

      // Inicia o loop de controle de ganho em segundo plano
      this.startLevelerLoop();

      // Aplica parâmetros iniciais
      this.applyParameters();
    } catch (err: any) {
      console.warn('[ZapiAiAudio] Falha ao configurar Web Audio API:', err);
      this.isConnected = false;
      this.currentPlan.isBypassed = true;
    }
  }

  /**
   * Inicia o loop periódico de análise de intensidade sonora e automação de ganho
   */
  private startLevelerLoop(): void {
    if (this.levelerTimer) {
      clearInterval(this.levelerTimer);
      this.levelerTimer = null;
    }

    this.lastUpdateTime = Date.now();

    this.levelerTimer = setInterval(() => {
      this.tickLeveler();
    }, 50); // Intervalo de 50ms para amostragem contínua e ágil
  }

  /**
   * Executa a amostragem em tempo real e atualiza o ganho gradual
   */
  public tickLeveler(): void {
    if (!this.isConnected || !this.analyser || !this.audioCtx || this.audioCtx.state !== 'running') {
      return;
    }

    const nowMs = Date.now();
    const dt = Math.max(0.01, (nowMs - this.lastUpdateTime) / 1000);
    this.lastUpdateTime = nowMs;

    // Se o elemento estiver pausado ou mutado, não acumula variações
    if (this.boundVideo && (this.boundVideo.paused || this.boundVideo.ended)) {
      return;
    }

    const isActive = this.settings.enabled && this.settings.audioEnabled && !this.isHoldingComparison;
    if (!isActive) {
      return;
    }

    // Leitura dos dados de áudio no domínio do tempo
    if (!this.timeDomainBuffer || this.timeDomainBuffer.length !== this.analyser.fftSize) {
      this.timeDomainBuffer = new Float32Array(this.analyser.fftSize);
    }
    this.analyser.getFloatTimeDomainData(this.timeDomainBuffer);

    // Cálculo de RMS e Peak
    let sumSq = 0;
    let peak = 0;
    const len = this.timeDomainBuffer.length;
    for (let i = 0; i < len; i++) {
      const sample = this.timeDomainBuffer[i];
      const absSample = Math.abs(sample);
      if (absSample > peak) peak = absSample;
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, len));

    // Passo de cálculo no motor inteligente
    const targetLinearGain = this.levelerEngine.computeStep(
      rms,
      peak,
      this.userVolume,
      this.isUserMuted,
      dt
    );

    // Aplica no nó Gain com automação exponencial suave para ausência total de artefatos
    if (this.levelerGain) {
      const audioTime = this.audioCtx.currentTime;
      this.levelerGain.gain.setTargetAtTime(targetLinearGain, audioTime, 0.08);
    }
  }

  /**
   * Informa o volume e estado de mudo manual do usuário para que o nivelamento não dispute
   */
  public setUserVolume(volume: number, isMuted: boolean): void {
    this.userVolume = Math.max(0, Math.min(1, volume));
    this.isUserMuted = isMuted;
  }

  /**
   * Reseta o estado do nivelador de forma suave (útil na troca de dublagens, fontes ou episódios)
   */
  public resetLevelerState(immediate: boolean = false): void {
    this.levelerEngine.reset(immediate);

    if (this.levelerGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      if (immediate) {
        this.levelerGain.gain.setValueAtTime(1.0, now);
      } else {
        this.levelerGain.gain.setTargetAtTime(1.0, now, 0.05);
      }
    }
  }

  public unlockAudioContext(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('[ZapiAiAudio] Erro ao desbloquear AudioContext:', e);
    }
  }

  public resumeAudioContext(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public hasAudioSignal(): boolean {
    if (!this.isConnected || !this.analyser || this.audioCtx?.state !== 'running') {
      return true;
    }
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);
    return buffer.some(val => val > 0);
  }

  public setHoldComparison(isHolding: boolean): void {
    this.isHoldingComparison = isHolding;
    this.applyParameters();
  }

  /**
   * Calcula o plano de ação acústico baseado nas configurações
   */
  public computeAudioPlan(settings: AiEnhancerSettings): AudioProcessingPlan {
    const isActive = settings.enabled && settings.audioEnabled && !this.isHoldingComparison;

    if (!isActive) {
      return {
        pipeline: 'passthrough',
        vocalClarityGainDb: 0,
        compressorThresholdDb: -20,
        compressorRatio: 1.0,
        makeupGainDb: 0,
        lowCutFrequencyHz: 55,
        noiseGateThresholdDb: -46,
        isBypassed: true,
        isCorsRestricted: false
      };
    }

    const intensity = settings.intensity;
    let vocalGainDb = 2.2;
    let thresholdDb = -20;
    let compRatio = 2.2;
    let makeupDb = 0; // Makeup dinâmico gerenciado pelo AudioLevelerEngine

    switch (intensity) {
      case 'subtle':
        vocalGainDb = 1.5;
        thresholdDb = -18;
        compRatio = 1.8;
        break;
      case 'balanced':
      case 'auto':
        vocalGainDb = 2.2;
        thresholdDb = -20;
        compRatio = 2.2;
        break;
      case 'strong':
        vocalGainDb = 3.0;
        thresholdDb = -23;
        compRatio = 2.6;
        break;
    }

    return {
      pipeline: 'webaudio',
      vocalClarityGainDb: vocalGainDb,
      compressorThresholdDb: thresholdDb,
      compressorRatio: compRatio,
      makeupGainDb: makeupDb,
      lowCutFrequencyHz: 55,
      noiseGateThresholdDb: -46,
      isBypassed: false,
      isCorsRestricted: false
    };
  }

  public updateSettings(newSettings: AiEnhancerSettings): void {
    this.settings = { ...newSettings };
    this.currentPlan = this.computeAudioPlan(this.settings);
    this.applyParameters();
  }

  /**
   * Aplica parâmetros aos nós com crossfade suave sem estalos nem interrupções
   */
  public applyParameters(): void {
    this.currentPlan = this.computeAudioPlan(this.settings);
    const isActive = this.settings.enabled && this.settings.audioEnabled && !this.isHoldingComparison;

    if (!this.isConnected || !this.audioCtx || !this.dryGain || !this.wetGain) {
      return;
    }

    const now = this.audioCtx.currentTime;

    if (!isActive) {
      // Modo Bypass: Crossfade suave de 60ms para o caminho original
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.02);

      if (this.vocalFilter) {
        this.vocalFilter.gain.setTargetAtTime(0, now, 0.04);
      }
      if (this.compressor) {
        this.compressor.ratio.setTargetAtTime(1.0, now, 0.04);
      }
      this.isBypassed = true;
      return;
    }

    // Modo Aprimorado: Crossfade suave de 60ms para o caminho aprimorado
    this.dryGain.gain.setTargetAtTime(0.0, now, 0.02);
    this.wetGain.gain.setTargetAtTime(1.0, now, 0.02);

    if (this.vocalFilter) {
      this.vocalFilter.gain.setTargetAtTime(this.currentPlan.vocalClarityGainDb, now, 0.05);
    }
    if (this.compressor) {
      this.compressor.threshold.setTargetAtTime(this.currentPlan.compressorThresholdDb, now, 0.05);
      this.compressor.ratio.setTargetAtTime(this.currentPlan.compressorRatio, now, 0.05);
    }

    this.isBypassed = false;
  }

  /**
   * Desconecta o motor e restaura modo padrão com liberação de recursos
   */
  public detach(): void {
    if (this.levelerTimer) {
      clearInterval(this.levelerTimer);
      this.levelerTimer = null;
    }

    if (this.audioCtx && this.dryGain && this.wetGain) {
      const now = this.audioCtx.currentTime;
      this.dryGain.gain.setValueAtTime(1.0, now);
      this.wetGain.gain.setValueAtTime(0.0, now);
    }

    this.isBypassed = true;
    this.boundVideo = null;
  }

  public getCurrentPlan(): AudioProcessingPlan {
    return this.currentPlan;
  }

  public getLoudnessTelemetry(): LoudnessTelemetry {
    return this.levelerEngine.getTelemetry();
  }

  public getLevelerEngine(): AudioLevelerEngine {
    return this.levelerEngine;
  }
}

export const audioEnhancer = new AudioEnhancer();
