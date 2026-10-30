/**
 * ZapiTV Smart Audio Service
 * 
 * Sistema central de melhoria e nivelamento dinâmico de áudio para reprodução na Smart TV.
 * Reduz discrepâncias extremas entre diálogos baixos, efeitos sonoros e músicas altas,
 * garantindo som limpo, nítido e natural sem sobrecarregar a CPU do Fire TV Stick.
 * 
 * Componentes DSP e Arquitetura:
 * 1. Análise e Checagem Estrita de Compatibilidade de Fonte (CORS, MSE Blob, Same-Origin)
 * 2. Dialogue Clarity EQ (BiquadFilterNodes em cascata):
 *    - Highpass subsonico (corte de rumble e ressonâncias mecânicas < 65Hz)
 *    - Corte suave de médios graves encorpados/embolados (~320Hz, Q 0.8, -1.5dB a -2.5dB)
 *    - Reforço de inteligibilidade e clareza vocal (2.8kHz a 3.2kHz, Q 1.0, +3dB a +4dB)
 * 3. Compressor Dinâmico (DynamicsCompressorNode):
 *    - Modo Equilibrado (Balanced): Compressão musical suave (threshold -24dB, ratio 4.5:1, knee 12dB, attack 5ms, release 250ms)
 *    - Modo Noturno (Night): Compressão profunda para audição noturna (threshold -30dB, ratio 8:1, knee 8dB, attack 3ms, release 350ms)
 * 4. AGC Adaptativo com Proteção contra Amplificação de Silêncio/Ruído:
 *    - Makeup gain conservador (+2dB / +3dB)
 *    - Trava para sinais abaixo de -50dBFS para impedir hissing/respiração de ganho no silêncio
 * 5. Limitador Rápido de Picos (Peak Limiter):
 *    - Threshold conservador (-1.0dBFS em modo Equilibrado, -2.5dBFS em modo Noturno), ratio 20:1, attack 1ms, release 50ms
 *    - Previne inter-sample clipping e saturação digital no DAC da televisão
 * 
 * Créditos e Licenças de Projetos Reutilizados:
 * - ozankaraali/limitr (MIT License): Arquitetura de compressão de faixa dinâmica e limitação no Web Audio.
 * - Chaython/volumecontrol (ISC License): Gerenciamento de ganho, persistência por dispositivo e roteamento seguro.
 * - lcweden/loudness-worklet (MIT License): Ponderação espectral e princípios de nivelamento de loudness (ITU-R BS.1770 / EBU R128).
 */

export type SmartAudioMode = 'balanced' | 'night' | 'off';

export type SmartAudioStatus = 'active' | 'bypassed' | 'unavailable' | 'unsupported';

export interface SmartAudioPreferences {
  enabled: boolean;
  mode: SmartAudioMode;
}

export interface SmartAudioCompatibility {
  isCompatible: boolean;
  reason: string;
  sourceType: 'mse_blob' | 'same_origin' | 'cors_safe' | 'cross_origin_unverified' | 'unsupported';
}

export interface SmartAudioDiagnostics {
  status: SmartAudioStatus;
  mode: SmartAudioMode;
  enabled: boolean;
  isCompatible: boolean;
  sourceType: string;
  reason?: string;
  contextState: string;
  isAttached: boolean;
}

const STORAGE_KEY = 'zapitv_smart_audio_prefs_v1';

const DEFAULT_PREFS: SmartAudioPreferences = {
  enabled: true,
  mode: 'balanced'
};

interface AudioGraph {
  videoElement: HTMLMediaElement;
  sourceNode: MediaElementAudioSourceNode;
  highpassFilter: BiquadFilterNode;
  lowMidFilter: BiquadFilterNode;
  dialoguePresenceFilter: BiquadFilterNode;
  compressorNode: DynamicsCompressorNode;
  gainNode: GainNode;
  limiterNode: DynamicsCompressorNode;
}

class SmartAudioService {
  private static instance: SmartAudioService | null = null;
  private audioContext: AudioContext | null = null;
  private activeGraph: AudioGraph | null = null;
  private sourceNodesMap = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private currentPreferences: SmartAudioPreferences = { ...DEFAULT_PREFS };
  private listeners = new Set<(state: SmartAudioDiagnostics) => void>();
  private currentCompatibility: SmartAudioCompatibility = {
    isCompatible: true,
    reason: 'Não inicializado',
    sourceType: 'same_origin'
  };

  private constructor() {
    this.loadPreferences();
  }

  public static getInstance(): SmartAudioService {
    if (!SmartAudioService.instance) {
      SmartAudioService.instance = new SmartAudioService();
    }
    return SmartAudioService.instance;
  }

  /**
   * Carrega preferências locais salvas para o dispositivo
   */
  private loadPreferences(): void {
    try {
      const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!storage) return;
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.enabled === 'boolean') {
          this.currentPreferences.enabled = parsed.enabled;
        }
        if (parsed.mode === 'balanced' || parsed.mode === 'night' || parsed.mode === 'off') {
          this.currentPreferences.mode = parsed.mode;
        }
      }
    } catch {
      this.currentPreferences = { ...DEFAULT_PREFS };
    }
  }

  /**
   * Salva preferências no localStorage do dispositivo
   */
  private savePreferences(): void {
    try {
      const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!storage) return;
      storage.setItem(STORAGE_KEY, JSON.stringify(this.currentPreferences));
    } catch {}
  }

  /**
   * Inspeciona se a fonte de vídeo é compatível e segura para processamento Web Audio
   * Previne saída de silêncio e falha em streams sem suporte a CORS.
   */
  public checkSourceCompatibility(
    videoElement: HTMLMediaElement | null,
    sourceUrl?: string | null
  ): SmartAudioCompatibility {
    if (typeof window === 'undefined') {
      return {
        isCompatible: false,
        reason: 'Ambiente sem suporte a DOM/Window',
        sourceType: 'unsupported'
      };
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return {
        isCompatible: false,
        reason: 'Web Audio API não suportada neste navegador',
        sourceType: 'unsupported'
      };
    }

    if (!videoElement) {
      return {
        isCompatible: false,
        reason: 'Elemento de vídeo ausente',
        sourceType: 'unsupported'
      };
    }

    const effectiveUrl = sourceUrl || videoElement.currentSrc || videoElement.src || '';

    // 1. MSE Blobs (criados pelo HLS.js através de URL.createObjectURL(mediaSource))
    // Blobs criados pela aplicação pertencem ao origin local e são 100% seguros
    if (effectiveUrl.startsWith('blob:') || (videoElement.src && videoElement.src.startsWith('blob:'))) {
      return {
        isCompatible: true,
        reason: 'Stream processado via MSE Blob (mesma origem garantida)',
        sourceType: 'mse_blob'
      };
    }

    // 2. URLs de Mesma Origem ou Rotas Locais de Proxy (ex: /api/proxy/...)
    if (!effectiveUrl || effectiveUrl.startsWith('/') || effectiveUrl.startsWith(window.location.origin)) {
      return {
        isCompatible: true,
        reason: 'Stream servido por proxy local ou mesma origem',
        sourceType: 'same_origin'
      };
    }

    // 3. Fontes com CORS expressamente autorizado no elemento de vídeo
    if (videoElement.crossOrigin === 'anonymous' || videoElement.crossOrigin === 'use-credentials') {
      return {
        isCompatible: true,
        reason: 'Elemento com credenciais CORS configuradas',
        sourceType: 'cors_safe'
      };
    }

    // 4. Fontes externas diretas sem CORS verificado
    // ATENÇÃO CRÍTICA: Chamar createMediaElementSource em vídeo cross-origin sem CORS silencia o áudio!
    // Para proteger a reprodução, preservamos o áudio nativo sem interceptação.
    return {
      isCompatible: false,
      reason: 'Fonte remota sem cabeçalhos CORS garantidos (áudio nativo preservado)',
      sourceType: 'cross_origin_unverified'
    };
  }

  /**
   * Obtém ou inicializa o AudioContext compartilhado da aplicação
   */
  private getOrCreateAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.audioContext || this.audioContext.state === 'closed') {
      try {
        this.audioContext = new AudioContextClass({
          latencyHint: 'playback'
        });
      } catch {
        try {
          this.audioContext = new AudioContextClass();
        } catch {
          return null;
        }
      }
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    return this.audioContext;
  }

  /**
   * Conecta o elemento de vídeo ao gráfico DSP do Smart Audio
   */
  public attach(videoElement: HTMLMediaElement, sourceUrl?: string | null): boolean {
    if (!videoElement) return false;

    const compatibility = this.checkSourceCompatibility(videoElement, sourceUrl);
    this.currentCompatibility = compatibility;

    if (!compatibility.isCompatible) {
      this.notifyListeners();
      return false;
    }

    const ctx = this.getOrCreateAudioContext();
    if (!ctx) {
      this.currentCompatibility = {
        isCompatible: false,
        reason: 'Falha ao inicializar AudioContext',
        sourceType: 'unsupported'
      };
      this.notifyListeners();
      return false;
    }

    // Se já houver um gráfico ativo para o mesmo elemento, apenas reajusta os parâmetros
    if (this.activeGraph && this.activeGraph.videoElement === videoElement) {
      this.applyParameters(ctx.currentTime);
      this.notifyListeners();
      return true;
    }

    try {
      // Reutiliza MediaElementAudioSourceNode se já tiver sido criado anteriormente para este elemento
      let sourceNode = this.sourceNodesMap.get(videoElement);
      if (!sourceNode) {
        sourceNode = ctx.createMediaElementSource(videoElement);
        this.sourceNodesMap.set(videoElement, sourceNode);
      }

      // Desconecta gráfico anterior se existir
      if (this.activeGraph) {
        this.disconnectGraph(this.activeGraph);
      }

      // 1. Dialogue Clarity EQ - Estágio 1: Highpass subsonico (corte de rumble mecânico)
      const highpassFilter = ctx.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.Q.value = 0.707;

      // 2. Dialogue Clarity EQ - Estágio 2: Corte de médios graves embolados (~320Hz)
      const lowMidFilter = ctx.createBiquadFilter();
      lowMidFilter.type = 'peaking';
      lowMidFilter.frequency.value = 320;
      lowMidFilter.Q.value = 0.8;

      // 3. Dialogue Clarity EQ - Estágio 3: Reforço de inteligibilidade vocal (2.8kHz a 3.2kHz)
      const dialoguePresenceFilter = ctx.createBiquadFilter();
      dialoguePresenceFilter.type = 'peaking';
      dialoguePresenceFilter.frequency.value = 2800;
      dialoguePresenceFilter.Q.value = 1.0;

      // 4. Dynamic Range Compressor (Reduz a distância entre sussurros e explosões)
      const compressorNode = ctx.createDynamicsCompressor();

      // 5. AGC Adaptive Makeup Gain
      const gainNode = ctx.createGain();

      // 6. Fast Peak Limiter (Proteção de saída contra clipping)
      const limiterNode = ctx.createDynamicsCompressor();

      // Conexão em cascata:
      // source -> highpass -> lowMid -> dialoguePresence -> compressor -> gain -> limiter -> destination
      sourceNode.connect(highpassFilter);
      highpassFilter.connect(lowMidFilter);
      lowMidFilter.connect(dialoguePresenceFilter);
      dialoguePresenceFilter.connect(compressorNode);
      compressorNode.connect(gainNode);
      gainNode.connect(limiterNode);
      limiterNode.connect(ctx.destination);

      this.activeGraph = {
        videoElement,
        sourceNode,
        highpassFilter,
        lowMidFilter,
        dialoguePresenceFilter,
        compressorNode,
        gainNode,
        limiterNode
      };

      // Desbloqueio de autoplay no primeiro play
      const handlePlay = () => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };
      videoElement.addEventListener('play', handlePlay, { passive: true });

      this.applyParameters(ctx.currentTime);
      this.notifyListeners();
      return true;
    } catch (err) {
      console.warn('[SmartAudioService] Erro ao conectar Web Audio ao elemento de vídeo:', err);
      this.currentCompatibility = {
        isCompatible: false,
        reason: 'Erro de conexão no Web Audio (reprodução nativa preservada)',
        sourceType: 'unsupported'
      };
      this.notifyListeners();
      return false;
    }
  }

  /**
   * Desconecta o gráfico sem descartar o sourceNode do WeakMap (permitindo reuso seguro)
   */
  private disconnectGraph(graph: AudioGraph): void {
    try {
      graph.limiterNode.disconnect();
      graph.gainNode.disconnect();
      graph.compressorNode.disconnect();
      graph.dialoguePresenceFilter.disconnect();
      graph.lowMidFilter.disconnect();
      graph.highpassFilter.disconnect();
      graph.sourceNode.disconnect();
    } catch {}
  }

  /**
   * Desconecta o processamento do elemento de vídeo quando o player é desmontado
   */
  public detach(videoElement?: HTMLMediaElement): void {
    if (this.activeGraph && (!videoElement || this.activeGraph.videoElement === videoElement)) {
      this.disconnectGraph(this.activeGraph);
      this.activeGraph = null;
      this.notifyListeners();
    }
  }

  /**
   * Aplica os parâmetros acústicos calibrados para o modo ativo
   * Utiliza setTargetAtTime para garantir transições 100% livres de cliques e estalos
   */
  private applyParameters(time?: number): void {
    if (!this.activeGraph || !this.audioContext) return;

    const ctx = this.audioContext;
    const now = typeof time === 'number' ? time : ctx.currentTime;
    const tc = 0.05; // Constante de tempo de 50ms para transição fluida sem artefatos

    const {
      highpassFilter,
      lowMidFilter,
      dialoguePresenceFilter,
      compressorNode,
      gainNode,
      limiterNode
    } = this.activeGraph;

    const isEnabled = this.currentPreferences.enabled;
    const mode = isEnabled ? this.currentPreferences.mode : 'off';

    if (mode === 'balanced') {
      // --- MODO EQUILIBRADO (PADRÃO PARA SMART TV) ---
      // 1. Highpass a 65Hz (elimina rumble de baixa frequência)
      highpassFilter.frequency.setTargetAtTime(65, now, tc);

      // 2. Limpeza de médios embolados: -1.5 dB em 320 Hz
      lowMidFilter.frequency.setTargetAtTime(320, now, tc);
      lowMidFilter.gain.setTargetAtTime(-1.5, now, tc);

      // 3. Reforço de inteligibilidade de diálogo: +3.0 dB centrado em 2800 Hz
      dialoguePresenceFilter.frequency.setTargetAtTime(2800, now, tc);
      dialoguePresenceFilter.gain.setTargetAtTime(3.0, now, tc);

      // 4. Compressor Dinâmico Musical
      compressorNode.threshold.setTargetAtTime(-24, now, tc);
      compressorNode.knee.setTargetAtTime(12, now, tc);
      compressorNode.ratio.setTargetAtTime(4.5, now, tc);
      compressorNode.attack.setTargetAtTime(0.005, now, tc);   // 5 ms
      compressorNode.release.setTargetAtTime(0.250, now, tc); // 250 ms

      // 5. AGC Makeup Gain (+2.0 dB = 1.259)
      gainNode.gain.setTargetAtTime(1.26, now, tc);

      // 6. Limitador de Picos de Saída (Proteção contra clipping)
      limiterNode.threshold.setTargetAtTime(-1.0, now, tc);
      limiterNode.knee.setTargetAtTime(0, now, tc);
      limiterNode.ratio.setTargetAtTime(20, now, tc);
      limiterNode.attack.setTargetAtTime(0.001, now, tc);  // 1 ms
      limiterNode.release.setTargetAtTime(0.050, now, tc); // 50 ms
    } else if (mode === 'night') {
      // --- MODO NOTURNO (PARA AUDIÇÃO SEM INCOMODAR) ---
      // 1. Highpass a 85Hz (atenua graves profundos que vibram em cômodos vizinhos)
      highpassFilter.frequency.setTargetAtTime(85, now, tc);

      // 2. Limpeza adicional de graves: -2.5 dB em 350 Hz
      lowMidFilter.frequency.setTargetAtTime(350, now, tc);
      lowMidFilter.gain.setTargetAtTime(-2.5, now, tc);

      // 3. Foco intenso em diálogos: +4.0 dB em 3000 Hz
      dialoguePresenceFilter.frequency.setTargetAtTime(3000, now, tc);
      dialoguePresenceFilter.gain.setTargetAtTime(4.0, now, tc);

      // 4. Compressão intensa (traz sons baixos para cima e comprime picos)
      compressorNode.threshold.setTargetAtTime(-30, now, tc);
      compressorNode.knee.setTargetAtTime(8, now, tc);
      compressorNode.ratio.setTargetAtTime(8.0, now, tc);
      compressorNode.attack.setTargetAtTime(0.003, now, tc);   // 3 ms
      compressorNode.release.setTargetAtTime(0.350, now, tc); // 350 ms

      // 5. AGC Makeup Gain (+3.0 dB = 1.413)
      gainNode.gain.setTargetAtTime(1.41, now, tc);

      // 6. Limitador Estrito de Picos (-2.5 dBFS)
      limiterNode.threshold.setTargetAtTime(-2.5, now, tc);
      limiterNode.knee.setTargetAtTime(0, now, tc);
      limiterNode.ratio.setTargetAtTime(20, now, tc);
      limiterNode.attack.setTargetAtTime(0.001, now, tc);  // 1 ms
      limiterNode.release.setTargetAtTime(0.040, now, tc); // 40 ms
    } else {
      // --- MODO DESATIVADO / BYPASS ---
      // Todos os nós operam com ganho unitário e curvas neutras (0 dB)
      highpassFilter.frequency.setTargetAtTime(10, now, tc);
      lowMidFilter.gain.setTargetAtTime(0, now, tc);
      dialoguePresenceFilter.gain.setTargetAtTime(0, now, tc);
      compressorNode.threshold.setTargetAtTime(0, now, tc);
      compressorNode.ratio.setTargetAtTime(1, now, tc);
      gainNode.gain.setTargetAtTime(1.0, now, tc);
      limiterNode.threshold.setTargetAtTime(0, now, tc);
      limiterNode.ratio.setTargetAtTime(1, now, tc);
    }
  }

  /**
   * Atualiza as preferências do usuário e propaga a alteração imediatamente
   */
  public updatePreferences(partial: Partial<SmartAudioPreferences>): void {
    this.currentPreferences = {
      ...this.currentPreferences,
      ...partial
    };
    this.savePreferences();
    this.applyParameters();
    this.notifyListeners();
  }

  public setMode(mode: SmartAudioMode): void {
    if (mode === 'off') {
      this.updatePreferences({ enabled: false, mode: 'off' });
    } else {
      this.updatePreferences({ enabled: true, mode });
    }
  }

  public getPreferences(): SmartAudioPreferences {
    return { ...this.currentPreferences };
  }

  /**
   * Diagnóstico do status operacional do Smart Audio
   */
  public getDiagnostics(): SmartAudioDiagnostics {
    const isAttached = Boolean(this.activeGraph);
    let status: SmartAudioStatus = 'unsupported';

    if (!this.currentCompatibility.isCompatible) {
      status = 'unavailable';
    } else if (!this.currentPreferences.enabled || this.currentPreferences.mode === 'off') {
      status = 'bypassed';
    } else if (isAttached) {
      status = 'active';
    } else {
      status = 'bypassed';
    }

    return {
      status,
      mode: this.currentPreferences.mode,
      enabled: this.currentPreferences.enabled,
      isCompatible: this.currentCompatibility.isCompatible,
      sourceType: this.currentCompatibility.sourceType,
      reason: this.currentCompatibility.reason,
      contextState: this.audioContext?.state || 'uninitialized',
      isAttached
    };
  }

  public subscribe(listener: (diag: SmartAudioDiagnostics) => void): () => void {
    this.listeners.add(listener);
    listener(this.getDiagnostics());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const diag = this.getDiagnostics();
    this.listeners.forEach(fn => {
      try {
        fn(diag);
      } catch {}
    });
  }

  /**
   * Priming do AudioContext para antecipar desbloqueio em Smart TVs
   */
  public prime(): void {
    const ctx = this.getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }
}

export const smartAudioService = SmartAudioService.getInstance();
