/**
 * Test Suite: Validação da Reformulação da Melhoria por IA no ZapiTV
 */
import { videoEnhancer } from '../src/core/enhancement/videoEnhancer';
import { aiEnhancerService } from '../src/core/enhancement/aiEnhancerService';
import { audioEnhancer } from '../src/core/enhancement/audioEnhancer';
import { VideoFrameMetrics } from '../src/core/enhancement/aiEnhancerTypes';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FALHA: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${msg}`);
}

console.log('--- TESTE 1: Planos de Super-Resolução e Adaptação Automática por Resolução ---');

// 1. Anime 480p SD -> Display 1080p
const anime480Metrics: VideoFrameMetrics = {
  sourceWidth: 854,
  sourceHeight: 480,
  displayWidth: 1920,
  displayHeight: 1080,
  scaleFactor: 2.25,
  category: 'anime',
  meanLuminance: 120,
  darkPixelRatio: 0.1,
  brightPixelRatio: 0.1,
  contrastStdDev: 45,
  saturation: 0.45,
  estimatedNoise: 0.25,
  estimatedBlur: 0.35,
  isPristine: false,
  isCorsRestricted: false
};

const planAnime480 = videoEnhancer.computeProcessingPlan(anime480Metrics);
assert(planAnime480.upscalingApplied === true, 'Anime 480p deve indicar upscaling aplicado');
assert(planAnime480.upscalingMethod === 'anime4k', 'Anime 480p deve utilizar anime4k');
assert(planAnime480.lineThinningAmount >= 0.75, `Anime 480p afinamento de linhas deve ser potente (>= 0.75), obteve: ${planAnime480.lineThinningAmount}`);
assert(planAnime480.sharpenAmount >= 0.80, `Anime 480p nitidez deve ser potente (>= 0.80), obteve: ${planAnime480.sharpenAmount}`);
assert(planAnime480.denoiseAmount >= 0.45, `Anime 480p remoção de artefatos cel-shading deve ser >= 0.45, obteve: ${planAnime480.denoiseAmount}`);

// 2. Anime 720p HD -> Display 1080p
const anime720Metrics: VideoFrameMetrics = {
  ...anime480Metrics,
  sourceWidth: 1280,
  sourceHeight: 720,
  scaleFactor: 1.5
};

const planAnime720 = videoEnhancer.computeProcessingPlan(anime720Metrics);
assert(planAnime720.upscalingApplied === true, 'Anime 720p deve indicar upscaling aplicado');
assert(planAnime720.lineThinningAmount >= 0.60, `Anime 720p afinamento de linhas deve ser >= 0.60, obteve: ${planAnime720.lineThinningAmount}`);
assert(planAnime720.sharpenAmount >= 0.70, `Anime 720p nitidez deve ser >= 0.70, obteve: ${planAnime720.sharpenAmount}`);

// 3. Anime 1080p FHD
const anime1080Metrics: VideoFrameMetrics = {
  ...anime480Metrics,
  sourceWidth: 1920,
  sourceHeight: 1080,
  scaleFactor: 1.0
};

const planAnime1080 = videoEnhancer.computeProcessingPlan(anime1080Metrics);
assert(planAnime1080.sharpenAmount >= 0.50, `Anime 1080p NÃO deve ter sharpen zero (bug antigo corrigido), obteve: ${planAnime1080.sharpenAmount}`);
assert(planAnime1080.lineThinningAmount >= 0.40, `Anime 1080p restauração de contornos deve ser >= 0.40, obteve: ${planAnime1080.lineThinningAmount}`);

// 4. Live-Action 480p SD -> AMD CAS
const liveAction480Metrics: VideoFrameMetrics = {
  ...anime480Metrics,
  category: 'live-action'
};

const planLive480 = videoEnhancer.computeProcessingPlan(liveAction480Metrics);
assert(planLive480.upscalingMethod === 'cas-adaptive', 'Live-action 480p deve utilizar cas-adaptive');
assert(planLive480.sharpenAmount >= 0.75, `Live-action 480p CAS sharpen deve ser potente (>= 0.75), obteve: ${planLive480.sharpenAmount}`);

// 5. Live-Action 1080p FHD -> AMD CAS
const liveAction1080Metrics: VideoFrameMetrics = {
  ...anime1080Metrics,
  category: 'live-action'
};

const planLive1080 = videoEnhancer.computeProcessingPlan(liveAction1080Metrics);
assert(planLive1080.sharpenAmount >= 0.45, `Live-action 1080p CAS sharpen deve ser >= 0.45, obteve: ${planLive1080.sharpenAmount}`);

console.log('\n--- TESTE 2: Status do Botão Único e Comparação Segurando Original ---');

// Estado inicial desligado
aiEnhancerService.updateAll({ enabled: false, videoEnabled: true });
assert(aiEnhancerService.getStatus() === 'off', `Status com enabled=false deve ser 'off', obteve: ${aiEnhancerService.getStatus()}`);

// Ao ligar sem vídeo acoplado, status = 'initializing'
aiEnhancerService.toggleEnabled();
assert(aiEnhancerService.getStatus() === 'initializing', `Status ao ligar sem vídeo anexado deve ser 'initializing', obteve: ${aiEnhancerService.getStatus()}`);

// Verificação de Hold Comparison
videoEnhancer.setHoldComparison(true);
console.log('✅ OK: videoEnhancer.setHoldComparison(true) executado sem erros');
videoEnhancer.setHoldComparison(false);
console.log('✅ OK: videoEnhancer.setHoldComparison(false) restaurado sem erros');

// Restauração de CORS
const corsMetrics: VideoFrameMetrics = {
  ...anime480Metrics,
  isCorsRestricted: true
};
const planCors = videoEnhancer.computeProcessingPlan(corsMetrics);
assert(planCors.pipeline === 'passthrough', 'Em restrição de CORS pipeline deve ser passthrough');

console.log('\n--- TESTE 3: Aprimoramento de Áudio Automático (Web Audio API) ---');
const audioPlan = audioEnhancer.getCurrentPlan();
assert(audioPlan.vocalClarityGainDb > 0, `Ganho de clareza vocal automático deve ser > 0dB, obteve: ${audioPlan.vocalClarityGainDb}dB`);
assert(audioPlan.compressorRatio > 1, `Compressor de volume balanceado deve ter ratio > 1, obteve: ${audioPlan.compressorRatio}:1`);

console.log('\n🎉 TODOS OS TESTES DE REFORMULAÇÃO DA MELHORIA POR IA PASSARAM COM SUCESSO!');
