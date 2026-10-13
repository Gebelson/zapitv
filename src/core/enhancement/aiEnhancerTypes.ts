/**
 * ZapiTV — Tipos e interfaces para o motor de Melhoria Inteligente por IA (Vídeo e Áudio)
 * Acelerado por WebGPU e WebGL com suporte a Anime4K, AMD CAS e Web Audio DSP.
 */

export type EnhancementIntensity = 'auto' | 'subtle' | 'balanced' | 'strong';
export type HardwareTier = 'webgpu' | 'webgl' | 'css-fallback' | 'passthrough';
export type ContentCategory = 'anime' | 'live-action' | 'animation-3d' | 'unknown';
export type ComparisonMode = 'off' | 'hold' | 'split';

export interface AiEnhancerSettings {
  enabled: boolean;               // Chave mestre (desativada por padrão)
  videoEnabled: boolean;          // Aprimoramento de imagem ativo
  audioEnabled: boolean;          // Aprimoramento de áudio ativo
  intensity: EnhancementIntensity;// Automático, Suave, Equilibrado, Forte
  categoryOverride?: ContentCategory; // Escolha manual de categoria se desejado
  comparisonMode: ComparisonMode; // Modo de comparação: off, hold (segurar), split (tela dividida)
  splitPosition: number;          // Posição da divisão (0 a 100%)
}

export const DEFAULT_AI_ENHANCER_SETTINGS: AiEnhancerSettings = {
  enabled: false,
  videoEnabled: true,
  audioEnabled: true,
  intensity: 'auto',
  comparisonMode: 'off',
  splitPosition: 50
};

/**
 * Métricas extraídas pela análise inteligente de quadros
 */
export interface VideoFrameMetrics {
  sourceWidth: number;
  sourceHeight: number;
  displayWidth: number;
  displayHeight: number;
  scaleFactor: number;             // displayWidth / sourceWidth
  category: ContentCategory;       // anime vs live-action vs 3d
  meanLuminance: number;           // 0..255 (brilho médio)
  darkPixelRatio: number;          // 0..1 (proporção de pixels escuros < 40)
  brightPixelRatio: number;        // 0..1 (proporção de pixels claros > 220)
  contrastStdDev: number;          // desvio padrão de luminância
  saturation: number;              // 0..1 (saturação média)
  estimatedNoise: number;          // 0..1 (indicador de ruído de alta frequência)
  estimatedBlur: number;           // 0..1 (indicador de falta de bordas nítidas)
  isPristine: boolean;             // True se o vídeo já tem qualidade impecável
  isCorsRestricted: boolean;       // True se a origem não permite leitura direta de pixels
}

/**
 * Plano de ação calculado dinamicamente pelo analisador adaptativo
 */
export interface VideoProcessingPlan {
  pipeline: HardwareTier;
  activeEngine: 'webgpu' | 'webgl' | 'css' | 'passthrough';
  upscalingApplied: boolean;
  upscalingMethod: 'anime4k' | 'cas-adaptive' | 'bicubic' | 'none';
  sharpenAmount: number;           // 0..1 (nitidez adaptativa sem halos)
  denoiseAmount: number;           // 0..1 (redução de ruído/blocking)
  lineThinningAmount: number;      // 0..1 (Anime4K line restoration)
  luminanceCorrection: number;     // -0.5..+0.5 (compensação inteligente de sombras)
  contrastMultiplier: number;      // 0.8..1.3 (multiplicador de contraste)
  saturationMultiplier: number;    // 0.8..1.3 (ajuste sutil de vivacidade)
  cssFilterString: string;         // String para fallback CSS seguro sem CORS
  explanation: string;             // Justificativa para a decisão tomada
}

/**
 * Plano de ação para aprimoramento de áudio via Web Audio API
 */
export interface AudioProcessingPlan {
  pipeline: 'webaudio' | 'passthrough';
  vocalClarityGainDb: number;      // Ganho na faixa de fala (~2.8 kHz - 3.5 kHz)
  compressorThresholdDb: number;   // Limiar do compressor dinâmico
  compressorRatio: number;         // Razão de compressão
  makeupGainDb: number;            // Ganho de compensação para diálogos baixos
  lowCutFrequencyHz: number;       // Filtro corta-subgraves / rumble (< 60 Hz)
  noiseGateThresholdDb: number;    // Atenuação sutil de chiado
  isBypassed: boolean;             // Modo de comparação antes/depois do áudio
  isCorsRestricted: boolean;
}

/**
 * Telemetria de desempenho em tempo real
 */
export interface EnhancerTelemetry {
  fps: number;
  droppedFrames: number;
  avgProcessTimeMs: number;
  gpuMemoryEstimateMb: number;
  audioLatencyMs: number;
  hardwareTier: HardwareTier;
  activeEngine: 'webgpu' | 'webgl' | 'css' | 'passthrough';
  isDegradedForPerformance: boolean;
  lastAnalysisTimestamp: number;
  isCorsRestricted: boolean;
  resolutionSource: string;
  resolutionDisplay: string;
}
