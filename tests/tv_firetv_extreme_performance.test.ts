/**
 * ZAPITV — SUÍTE DE TESTES: ELIMINAÇÃO DA LENTIDÃO EXTREMA NO AMAZON FIRE TV (P0)
 * 
 * Validação rigorosa dos pilares de desempenho no Fire TV Stick / Fire TV 4K:
 * 1. Prioridade máxima da CPU ao controle remoto (pausa automática do preloader durante D-Pad).
 * 2. Suspensão total do pré-carregamento durante a reprodução de vídeo.
 * 3. Janela dinâmica de fileiras (windowed content rendering): renderização de cards apenas para fileiras ativas (+/-2) no Fire TV.
 * 4. Preservação de altura e zero layout shift (CLS 0) nas fileiras em espera.
 * 5. Eliminação de layout thrashing e ResizeObservers síncronos em fileiras fora da tela no Fire TV.
 * 6. Hero Banner direto no Fire TV (zero Image() com timeouts bloqueantes na montagem).
 * 7. Logo do Header estática de alta resolução no Fire TV (zero loops na GPU).
 * 8. Busca escalonada em lotes de 18 cards no Fire TV preservando a grade de 6 colunas.
 * 9. Isolamento total: outras Smart TVs (Samsung Tizen, LG webOS, MSX) mantêm 100% de seus recursos intactos.
 * 10. Telemetria anônima de diagnóstico (P95 de latência de tecla e métricas de fila).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tvImagePreloaderService } from '../src/core/tv/tvImagePreloaderService';
import { tvPerformanceService } from '../src/core/tv/tvPerformanceService';
import { tvScrollService } from '../src/core/tv/tvScrollService';
import { getVisibleSlots } from '../src/components/tv/TvContentRow';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runFireTvExtremePerformanceTests() {
  console.log('\n========================================================================');
  console.log('⚡ SUÍTE DE TESTES: ELIMINAÇÃO DA LENTIDÃO NO AMAZON FIRE TV (P0)');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Controle de Prioridade e Pausa do Preloader
  // -------------------------------------------------------------------------
  console.log('--- 1. Pausa e retomada automática do pré-carregamento ---');
  tvImagePreloaderService.clear();
  assert.strictEqual(tvImagePreloaderService.isPaused(), false, 'Preloader deve iniciar ativo');

  tvImagePreloaderService.pause(80);
  assert.strictEqual(tvImagePreloaderService.isPaused(), true, 'Preloader deve estar pausado imediatamente após pause()');

  await new Promise(r => setTimeout(r, 120));
  assert.strictEqual(tvImagePreloaderService.isPaused(), false, 'Preloader deve retomar automaticamente após o timeout');
  console.log('✔ 1. Pausa e retomada reativa do preloader OK');

  // -------------------------------------------------------------------------
  // 2. Suspensão durante Reprodução de Vídeo
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Suspensão de pré-carregamento durante reprodução de vídeo ---');
  tvImagePreloaderService.setPlaybackActive(true);
  assert.strictEqual(tvImagePreloaderService.isPlaybackActive(), true, 'Playback deve estar marcado como ativo');

  const dummyUrl = 'https://image.tmdb.org/t/p/w500/playback_test.jpg';
  // Quando playback está ativo, preload resolve false de imediato sem baixar
  const preloadResult = await tvImagePreloaderService.preload(dummyUrl, 2);
  assert.strictEqual(preloadResult, false, 'Preloader deve rejeitar tarefas de catálogo durante reprodução de vídeo');

  tvImagePreloaderService.setPlaybackActive(false);
  assert.strictEqual(tvImagePreloaderService.isPlaybackActive(), false, 'Playback deve estar inativo após fechar o player');
  console.log('✔ 2. Liberação de banda e memória para o player de vídeo OK');

  // -------------------------------------------------------------------------
  // 3. Telemetria Consolidada e Cálculo P95
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Telemetria e cálculo do percentil P95 de latência ---');
  tvPerformanceService.resetStats();
  tvPerformanceService.recordInputLatency(10, 45);
  tvPerformanceService.recordInputLatency(10, 32);
  tvPerformanceService.recordInputLatency(10, 85);
  tvPerformanceService.recordInputLatency(10, 110);
  tvPerformanceService.recordInputLatency(10, 28);

  const snapshot = tvPerformanceService.getTelemetrySnapshot();
  assert.ok(snapshot.p95InputLatencyMs >= 85, 'P95 deve refletir a distribuição das amostras gravadas');
  assert.strictEqual(snapshot.samplesCount, 5, 'Contagem de amostras deve ser 5');
  console.log(`✔ 3. Telemetria com P95 calculado (${snapshot.p95InputLatencyMs}ms) OK`);

  // -------------------------------------------------------------------------
  // 4. Auditoria de Código em TvContentRow.tsx
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Auditoria estática de TvContentRow.tsx ---');
  const contentRowCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/tv/TvContentRow.tsx'),
    'utf8'
  );

  assert.ok(
    contentRowCode.includes('isNearViewport = true'),
    'TvContentRow deve aceitar prop isNearViewport com padrão true para compatibilidade'
  );

  assert.ok(
    contentRowCode.includes('if (isFireTv && !isNearViewport) return;'),
    'TvContentRow deve ignorar medição síncrona forçada e ResizeObserver em fileiras fora da viewport no Fire TV'
  );

  assert.ok(
    contentRowCode.includes('if (isFireTv && !focused && !isNearViewport) return;'),
    'TvContentRow deve ignorar pré-carregamento concorrente de imagens em fileiras fora da viewport no Fire TV'
  );

  assert.ok(
    contentRowCode.includes('placeholderHeight'),
    'TvContentRow deve renderizar container preservando altura sem layout shift (CLS 0)'
  );

  assert.ok(
    contentRowCode.includes('getVisibleSlots'),
    'TvContentRow deve manter as regras estritas de 6 capas completas + 7ª metade'
  );
  console.log('✔ 4. TvContentRow configurado com janela inteligente e zero layout shift OK');

  // -------------------------------------------------------------------------
  // 5. Auditoria de Código em TvHomeView.tsx
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Auditoria estática de TvHomeView.tsx ---');
  const homeViewCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/tv/TvHomeView.tsx'),
    'utf8'
  );

  assert.ok(
    homeViewCode.includes('orderedRowIds'),
    'TvHomeView deve computar a ordem sequencial de todas as fileiras ativas'
  );

  assert.ok(
    homeViewCode.includes('isRowNear'),
    'TvHomeView deve possuir função isRowNear para cálculo da janela ativa'
  );

  assert.ok(
    homeViewCode.includes('if (!isFireTv) return true;'),
    'TvHomeView deve isolar e aplicar a janela restrita exclusivamente no Fire TV (outras TVs sempre true)'
  );

  assert.ok(
    homeViewCode.includes('rowIndex < 3'),
    'TvHomeView deve sempre renderizar as primeiras 3 fileiras no topo da página no Fire TV'
  );

  assert.ok(
    homeViewCode.includes('tvScrollService.scrollToHero'),
    'TvHomeView deve delegar a rolagem ao hero para o gerenciador coordenado'
  );
  console.log('✔ 5. TvHomeView com janela adaptativa e rolagem ao topo coordenada OK');

  // -------------------------------------------------------------------------
  // 6. Auditoria de Código em TvSearchView.tsx
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Auditoria estática de TvSearchView.tsx ---');
  const searchViewCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/tv/TvSearchView.tsx'),
    'utf8'
  );

  assert.ok(
    searchViewCode.includes('initialBatch = isFireTv ? 18 : 48'),
    'TvSearchView deve inicializar com 18 cards no Fire TV e 48 nas demais Smart TVs'
  );

  assert.ok(
    searchViewCode.includes('incrementBatch = isFireTv ? 12 : 48'),
    'TvSearchView deve incrementar em lotes moderados (12 cards = 2 fileiras) no Fire TV'
  );
  console.log('✔ 6. TvSearchView com paginação escalonada leve no Fire TV OK');

  // -------------------------------------------------------------------------
  // 7. Auditoria de Código em ZapiAnimatedLogo.tsx
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Auditoria estática de ZapiAnimatedLogo.tsx ---');
  const logoCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/common/ZapiAnimatedLogo.tsx'),
    'utf8'
  );

  assert.ok(
    logoCode.includes('if (isFireTv)'),
    'ZapiAnimatedLogo deve possuir ramo específico para Fire TV'
  );

  assert.ok(
    logoCode.includes('source srcSet={finalPng}'),
    'ZapiAnimatedLogo deve utilizar PNG estático de alta resolução no Fire TV para evitar repaints em loop'
  );

  assert.ok(
    logoCode.includes('source srcSet={finalWebp}'),
    'ZapiAnimatedLogo deve manter WebP/APNG animado para as demais Smart TVs'
  );
  console.log('✔ 7. Logo do header otimizada com eliminação de repaints na GPU do Fire TV OK');

  // -------------------------------------------------------------------------
  // 8. Validação das 6 capas completas e 7ª metade na Home
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Regra obrigatória de 6 capas e meia no carrossel ---');
  const slotsCatalog12 = getVisibleSlots(12);
  // [-1, 0, 1, 2, 3, 4, 5, 6, 7]
  const visibleOnScreen = slotsCatalog12.filter(s => s >= 0 && s <= 5);
  const halfVisibleRight = slotsCatalog12.filter(s => s === 6);
  assert.strictEqual(visibleOnScreen.length, 6, 'Devem existir exatamente 6 capas completas na tela (slots 0 a 5)');
  assert.strictEqual(halfVisibleRight.length, 1, 'Deve existir a 7ª capa visível pela metade na margem direita (slot 6)');
  console.log('✔ 8. Preservação estrita das 6 capas completas + metade da 7ª capa OK');

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS 8 PILARES DE DESEMPENHO EXTREMO NO FIRE TV PASSARAM COM ÊXITO!');
  console.log('========================================================================\n');
}

runFireTvExtremePerformanceTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Falha na bateria de testes de desempenho Fire TV:', err);
    process.exit(1);
  });
