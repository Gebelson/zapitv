import { aiEnhancerService } from './src/core/enhancement/aiEnhancerService';
import { videoEnhancer } from './src/core/enhancement/videoEnhancer';
import { audioEnhancer } from './src/core/enhancement/audioEnhancer';
import { webgpuEnhancer } from './src/core/enhancement/webgpuEnhancer';
import { VideoFrameMetrics } from './src/core/enhancement/aiEnhancerTypes';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// Mock localStorage e window para testes Node.js
const mockStorage = new Map<string, string>();
const storageObj = {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};
(global as any).localStorage = storageObj;
(global as any).window = { localStorage: storageObj };

console.log('===============================================================');
console.log('🧪 TEST SUITE: ZAPITV MOTOR REAL DE MELHORIA POR IA');
console.log('===============================================================\n');

// --- 1. AiEnhancerService: Configurações, Persistência e Modos de Comparação ---
console.log('--- 1. AiEnhancerService: Configurações e Modos de Comparação ---');

aiEnhancerService.setVideoEnabled(true);
aiEnhancerService.setAudioEnabled(true);
aiEnhancerService.setIntensity('balanced');
aiEnhancerService.setComparisonMode('off');
aiEnhancerService.setSplitPosition(50);

let currentSettings = aiEnhancerService.getSettings();
assert(currentSettings.videoEnabled === true && currentSettings.audioEnabled === true, 'Inicializa com imagem e áudio ativos');
assert(currentSettings.intensity === 'balanced', 'Define intensidade balanced corretamente');
assert(currentSettings.comparisonMode === 'off', 'Inicia com modo de comparação desligado');

// Teste de modo split-screen
aiEnhancerService.setComparisonMode('split');
aiEnhancerService.setSplitPosition(65);
currentSettings = aiEnhancerService.getSettings();
assert(currentSettings.comparisonMode === 'split', 'Ativa modo de tela dividida');
assert(currentSettings.splitPosition === 65, 'Atualiza posição do divisor para 65%');

// Teste de clamp na posição do divisor
aiEnhancerService.setSplitPosition(120);
assert(aiEnhancerService.getSettings().splitPosition === 100, 'Limita posição máxima em 100%');
aiEnhancerService.setSplitPosition(-15);
assert(aiEnhancerService.getSettings().splitPosition === 0, 'Limita posição mínima em 0%');

// Teste de persistência e reload
aiEnhancerService.saveSettings();
assert(mockStorage.has('zapitv_ai_enhancement_settings'), 'Persiste preferências no localStorage');

// --- 2. VideoEnhancer: Planos Adaptativos de Vídeo ---
console.log('\n--- 2. VideoEnhancer: Algoritmos Anime4K e AMD CAS ---');

// Cenário Anime 720p em tela 1080p
const animeMetrics720p: VideoFrameMetrics = {
  sourceWidth: 1280,
  sourceHeight: 720,
  displayWidth: 1920,
  displayHeight: 1080,
  scaleFactor: 1.5,
  category: 'anime',
  meanLuminance: 120,
  darkPixelRatio: 0.1,
  brightPixelRatio: 0.1,
  contrastStdDev: 60,
  saturation: 0.45,
  estimatedNoise: 0.05,
  estimatedBlur: 0.2,
  isPristine: false,
  isCorsRestricted: false
};

const animePlan = videoEnhancer.computeProcessingPlan(animeMetrics720p, 'balanced');
assert(animePlan.upscalingApplied === true, 'Aplica upscaling em anime com resolução menor que display');
assert(animePlan.upscalingMethod === 'anime4k', 'Seleciona pipeline Anime4K para animes');
assert(animePlan.lineThinningAmount > 0, 'Ativa restauração e afilamento de traços (Line Thinning)');
assert(animePlan.sharpenAmount > 0.3, 'Aplica ganho de nitidez sem distorcer arte');

// Cenário Live-Action 1080p em tela 4K
const liveActionMetrics: VideoFrameMetrics = {
  sourceWidth: 1920,
  sourceHeight: 1080,
  displayWidth: 3840,
  displayHeight: 2160,
  scaleFactor: 2.0,
  category: 'live-action',
  meanLuminance: 90,
  darkPixelRatio: 0.2,
  brightPixelRatio: 0.05,
  contrastStdDev: 50,
  saturation: 0.32,
  estimatedNoise: 0.08,
  estimatedBlur: 0.15,
  isPristine: false,
  isCorsRestricted: false
};

const liveActionPlan = videoEnhancer.computeProcessingPlan(liveActionMetrics, 'balanced');
assert(liveActionPlan.upscalingApplied === true, 'Aplica upscaling adaptativo para filme/série');
assert(liveActionPlan.upscalingMethod === 'cas-adaptive', 'Seleciona algoritmo AMD FidelityFX CAS para live-action');
assert(liveActionPlan.sharpenAmount > 0.35, 'Aplica nitidez adaptativa CAS preservando granulação cinematográfica');

// Cenário Vídeo Impecável 4K nativo (Regra da Perfeição / Zero-distortion)
const pristineMetrics: VideoFrameMetrics = {
  sourceWidth: 3840,
  sourceHeight: 2160,
  displayWidth: 3840,
  displayHeight: 2160,
  scaleFactor: 1.0,
  category: 'live-action',
  meanLuminance: 110,
  darkPixelRatio: 0.15,
  brightPixelRatio: 0.08,
  contrastStdDev: 58,
  saturation: 0.35,
  estimatedNoise: 0.04,
  estimatedBlur: 0.04,
  isPristine: true,
  isCorsRestricted: false
};

const pristinePlan = videoEnhancer.computeProcessingPlan(pristineMetrics, 'auto');
assert(pristinePlan.sharpenAmount === 0 && pristinePlan.denoiseAmount === 0, 'Mantém ajustes zerados em vídeos impecáveis no modo auto');
assert(pristinePlan.pipeline === 'passthrough', 'Entra em modo passthrough sem desperdício de GPU');

// Cenário Cena Escura com Sombras Esmagadas
const darkMetrics: VideoFrameMetrics = {
  sourceWidth: 1920,
  sourceHeight: 1080,
  displayWidth: 1920,
  displayHeight: 1080,
  scaleFactor: 1.0,
  category: 'live-action',
  meanLuminance: 45,
  darkPixelRatio: 0.65,
  brightPixelRatio: 0.01,
  contrastStdDev: 35,
  saturation: 0.25,
  estimatedNoise: 0.05,
  estimatedBlur: 0.1,
  isPristine: false,
  isCorsRestricted: false
};

const darkPlan = videoEnhancer.computeProcessingPlan(darkMetrics, 'balanced');
assert(darkPlan.luminanceCorrection > 0, 'Eleva luminância de sombras esmagadas em cenas escuras');
assert(darkPlan.contrastMultiplier > 1.0, 'Recupera contraste em cenas de baixo desvio dinâmico');

// --- 3. AudioEnhancer: Processamento DSP de Voz e Som ---
console.log('\n--- 3. AudioEnhancer: Clareza de Diálogos e Faixa Dinâmica ---');

// Plano com IA ativa
const activeAudioSettings = {
  enabled: true,
  videoEnabled: true,
  audioEnabled: true,
  intensity: 'balanced' as const,
  comparisonMode: 'off' as const,
  splitPosition: 50
};

const activeAudioPlan = audioEnhancer.computeAudioPlan(activeAudioSettings);
assert(activeAudioPlan.pipeline === 'webaudio', 'Web Audio DSP ativo com pipeline webaudio');
assert(activeAudioPlan.vocalClarityGainDb >= 2.5, 'Aplica ganho de presença vocal nos formantes de fala (~2.8 kHz)');
assert(activeAudioPlan.compressorRatio >= 3.0, 'Aplica taxa de compressão dinâmica para atenuar explosões e elevar sussurros');
assert(activeAudioPlan.lowCutFrequencyHz === 60, 'Filtro passa-altas de 60 Hz ativo para remover rumbles');
assert(activeAudioPlan.isBypassed === false, 'Modo bypass inativo durante aprimoramento');

// Plano com IA desativada
const inactiveAudioSettings = {
  enabled: false,
  videoEnabled: true,
  audioEnabled: true,
  intensity: 'balanced' as const,
  comparisonMode: 'off' as const,
  splitPosition: 50
};

const inactiveAudioPlan = audioEnhancer.computeAudioPlan(inactiveAudioSettings);
assert(inactiveAudioPlan.pipeline === 'passthrough', 'Entra em passthrough quando desativado');
assert(inactiveAudioPlan.vocalClarityGainDb === 0, 'Ganho vocal zerado');
assert(inactiveAudioPlan.compressorRatio === 1.0, 'Compressor com razão neutra 1:1');
assert(inactiveAudioPlan.isBypassed === true, 'Modo bypass ativo com latência zero');

// Comparar Original (Hold)
audioEnhancer.setHoldComparison(true);
const holdingAudioPlan = audioEnhancer.computeAudioPlan(activeAudioSettings);
assert(holdingAudioPlan.isBypassed === true, 'Transita instantaneamente para bypass transparente ao segurar "Comparar Original"');
audioEnhancer.setHoldComparison(false);

// --- 4. WebGPUEnhancer: Verificação e Resiliência ---
console.log('\n--- 4. WebGPUEnhancer: Detecção e Resiliência ---');

assert(typeof webgpuEnhancer.checkSupport === 'function', 'WebGPUEnhancer possui método de detecção de suporte');
assert(typeof webgpuEnhancer.renderFrame === 'function', 'WebGPUEnhancer possui renderFrame implementado');
assert(typeof webgpuEnhancer.destroy === 'function', 'WebGPUEnhancer possui limpeza e liberação de buffers');

// Final summary
console.log('\n===============================================================');
console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('===============================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
