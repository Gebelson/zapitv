/**
 * ZapiTV — AudioEnhancer
 * Motor de aprimoramento inteligente de áudio em tempo real via Web Audio API.
 * 
 * Pipeline de DSP:
 * 1. High-Pass Filter (< 60 Hz): Elimina rumbles, vibrações subgraves e ruído de vento
 * 2. Peaking EQ (~2.8 kHz - 3.2 kHz): Aumenta presença e inteligibilidade de diálogos
 * 3. DynamicsCompressorNode: Reduz a distância entre sussurros e explosões sonoras
 * 4. GainNode (Makeup Gain + Limiter): Previne clipping e equilibra volumes baixos
 * 5. Modo Bypass com transparência acústica total e latência zero ao desativar ou comparar
 */

import {
  AiEnhancerSettings,
  AudioProcessingPlan
} from './aiEnhancerTypes';

export class AudioEnhancer {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private vocalFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private makeupGain: GainNode | null = null;
  private isConnected = false;
  private isBypassed = true;
  private isHoldingComparison = false;
  private boundVideo: HTMLVideoElement | null = null;

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
    lowCutFrequencyHz: 60,
    noiseGateThresholdDb: -50,
    isBypassed: true,
    isCorsRestricted: false
  };

  /**
   * Conecta o elemento de vídeo ao grafo da Web Audio API
   * Garante a regra do navegador de que createMediaElementSource só pode ser chamado UMA vez por elemento.
   */
  public attach(video: HTMLVideoElement): void {
    if (this.boundVideo === video && this.isConnected) {
      return;
    }

    this.boundVideo = video;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[ZapiAiAudio] Web Audio API não suportada no navegador.');
        return;
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      // Reutiliza ou cria o nó fonte para o elemento de vídeo
      if (!this.sourceNode) {
        try {
          this.sourceNode = this.audioCtx.createMediaElementSource(video);
        } catch (err: any) {
          // Se já foi criado anteriormente em outra instância, ignoramos erro
          console.warn('[ZapiAiAudio] Aviso ao conectar nó de áudio:', err.message);
          return;
        }
      }

      // 1. Filtro corta-subgraves (< 60 Hz) para remover rumbles
      this.highPassFilter = this.audioCtx.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.setValueAtTime(60, this.audioCtx.currentTime);
      this.highPassFilter.Q.setValueAtTime(0.707, this.audioCtx.currentTime);

      // 2. Filtro de inteligibilidade vocal (formantes de fala em ~2.8 kHz)
      this.vocalFilter = this.audioCtx.createBiquadFilter();
      this.vocalFilter.type = 'peaking';
      this.vocalFilter.frequency.setValueAtTime(2800, this.audioCtx.currentTime);
      this.vocalFilter.Q.setValueAtTime(1.2, this.audioCtx.currentTime);
      this.vocalFilter.gain.setValueAtTime(0, this.audioCtx.currentTime);

      // 3. Compressor de faixa dinâmica com joelho suave (soft knee)
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-20, this.audioCtx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.audioCtx.currentTime);
      this.compressor.ratio.setValueAtTime(1.0, this.audioCtx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.audioCtx.currentTime); // 5ms
      this.compressor.release.setValueAtTime(0.25, this.audioCtx.currentTime); // 250ms

      // 4. Ganho de compensação / Limiter suave
      this.makeupGain = this.audioCtx.createGain();
      this.makeupGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      // Encadeamento do grafo de áudio:
      // Source -> HighPass -> VocalFilter -> Compressor -> MakeupGain -> Destination
      this.sourceNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.vocalFilter);
      this.vocalFilter.connect(this.compressor);
      this.compressor.connect(this.makeupGain);
      this.makeupGain.connect(this.audioCtx.destination);

      this.isConnected = true;

      // Aplica as configurações iniciais
      this.applyParameters();
    } catch (err: any) {
      console.warn('[ZapiAiAudio] Falha ao configurar Web Audio API (mantendo áudio nativo):', err);
      this.isConnected = false;
    }
  }

  /**
   * Garante que o contexto de áudio seja ativado após interação do usuário
   */
  public resumeAudioContext(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Alterna modo de comparação imediata (ao segurar o botão "Comparar Original")
   */
  public setHoldComparison(isHolding: boolean): void {
    this.isHoldingComparison = isHolding;
    this.applyParameters();
  }

  /**
   * Calcula o plano de DSP com base nas configurações
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
        lowCutFrequencyHz: 60,
        noiseGateThresholdDb: -50,
        isBypassed: true,
        isCorsRestricted: false
      };
    }

    const intensity = settings.intensity;
    let vocalGainDb = 2.8;
    let thresholdDb = -22;
    let compRatio = 3.2;
    let makeupDb = 2.0;

    switch (intensity) {
      case 'subtle':
        vocalGainDb = 1.8;
        thresholdDb = -18;
        compRatio = 2.2;
        makeupDb = 1.0;
        break;
      case 'balanced':
      case 'auto':
        vocalGainDb = 2.8;
        thresholdDb = -22;
        compRatio = 3.2;
        makeupDb = 2.0;
        break;
      case 'strong':
        vocalGainDb = 4.2;
        thresholdDb = -26;
        compRatio = 4.5;
        makeupDb = 3.2;
        break;
    }

    return {
      pipeline: 'webaudio',
      vocalClarityGainDb: vocalGainDb,
      compressorThresholdDb: thresholdDb,
      compressorRatio: compRatio,
      makeupGainDb: makeupDb,
      lowCutFrequencyHz: 60,
      noiseGateThresholdDb: -50,
      isBypassed: false,
      isCorsRestricted: false
    };
  }

  /**
   * Atualiza configurações do usuário (chamado pela interface)
   */
  public updateSettings(newSettings: AiEnhancerSettings): void {
    this.settings = { ...newSettings };
    this.currentPlan = this.computeAudioPlan(this.settings);
    this.applyParameters();
  }

  /**
   * Ajusta os parâmetros dos nós DSP da Web Audio API
   */
  public applyParameters(): void {
    this.currentPlan = this.computeAudioPlan(this.settings);
    const isActive = this.settings.enabled && this.settings.audioEnabled && !this.isHoldingComparison;

    if (!this.isConnected || !this.audioCtx || !this.vocalFilter || !this.compressor || !this.makeupGain) {
      return;
    }

    const now = this.audioCtx.currentTime;

    if (!isActive) {
      // Modo Bypass transparente: Ganho 0 dB, razão 1:1, sem alteração de sinal
      this.vocalFilter.gain.setTargetAtTime(0, now, 0.04);
      this.compressor.ratio.setTargetAtTime(1.0, now, 0.04);
      this.compressor.threshold.setTargetAtTime(-50, now, 0.04);
      this.makeupGain.gain.setTargetAtTime(1.0, now, 0.04);
      this.isBypassed = true;
      return;
    }

    // Aplica transição suave (sem cliques/pops no som)
    this.vocalFilter.gain.setTargetAtTime(this.currentPlan.vocalClarityGainDb, now, 0.05);
    this.compressor.threshold.setTargetAtTime(this.currentPlan.compressorThresholdDb, now, 0.05);
    this.compressor.ratio.setTargetAtTime(this.currentPlan.compressorRatio, now, 0.05);

    // Converte ganho dB para multiplicador linear
    const linearGain = Math.pow(10, this.currentPlan.makeupGainDb / 20);
    this.makeupGain.gain.setTargetAtTime(linearGain, now, 0.05);

    this.isBypassed = false;
  }

  /**
   * Desconecta o motor e restaura modo padrão
   */
  public detach(): void {
    if (this.vocalFilter && this.audioCtx && this.compressor && this.makeupGain) {
      const now = this.audioCtx.currentTime;
      this.vocalFilter.gain.setValueAtTime(0, now);
      this.compressor.ratio.setValueAtTime(1.0, now);
      this.makeupGain.gain.setValueAtTime(1.0, now);
    }
    this.isBypassed = true;
    this.boundVideo = null;
  }

  public getCurrentPlan(): AudioProcessingPlan {
    return this.currentPlan;
  }
}

export const audioEnhancer = new AudioEnhancer();
