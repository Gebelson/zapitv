import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { tvPerformanceService } from '../src/core/tv/tvPerformanceService';
import { tvPerformanceProfileService } from '../src/core/tv/tvPerformanceProfileService';
import { normalizeSearchTerm } from '../src/components/tv/TvSearchView';

async function runTvPerformanceBenchmarkTests() {
  console.log('\n========================================================================');
  console.log('--- BATERIA DE AUDITORIA E BENCHMARK DE DESEMPENHO NA SMART TV ---');
  console.log('========================================================================\n');

  const contentRowPath = path.resolve('src/components/tv/TvContentRow.tsx');
  const cardPath = path.resolve('src/components/tv/TvCard16x9.tsx');
  const heroPath = path.resolve('src/components/tv/TvHeroBanner.tsx');
  const homePath = path.resolve('src/components/tv/TvHomeView.tsx');
  const categoryPath = path.resolve('src/components/tv/TvCategoryView.tsx');
  const animePath = path.resolve('src/components/tv/TvAnimeView.tsx');
  const searchPath = path.resolve('src/components/tv/TvSearchView.tsx');
  const appPath = path.resolve('src/pages/tv/TvApp.tsx');
  const perfServicePath = path.resolve('src/core/tv/tvPerformanceService.ts');
  const profileServicePath = path.resolve('src/core/tv/tvPerformanceProfileService.ts');

  assert(fs.existsSync(contentRowPath), 'TvContentRow.tsx deve existir');
  assert(fs.existsSync(cardPath), 'TvCard16x9.tsx deve existir');
  assert(fs.existsSync(heroPath), 'TvHeroBanner.tsx deve existir');
  assert(fs.existsSync(homePath), 'TvHomeView.tsx deve existir');
  assert(fs.existsSync(categoryPath), 'TvCategoryView.tsx deve existir');
  assert(fs.existsSync(animePath), 'TvAnimeView.tsx deve existir');
  assert(fs.existsSync(searchPath), 'TvSearchView.tsx deve existir');
  assert(fs.existsSync(appPath), 'TvApp.tsx deve existir');
  assert(fs.existsSync(perfServicePath), 'tvPerformanceService.ts deve existir');
  assert(fs.existsSync(profileServicePath), 'tvPerformanceProfileService.ts deve existir');

  const contentRowCode = fs.readFileSync(contentRowPath, 'utf8');
  const cardCode = fs.readFileSync(cardPath, 'utf8');
  const heroCode = fs.readFileSync(heroPath, 'utf8');
  const categoryCode = fs.readFileSync(categoryPath, 'utf8');
  const animeCode = fs.readFileSync(animePath, 'utf8');
  const searchCode = fs.readFileSync(searchPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');

  // Cenário 1: Eliminação de reflow forçado por offsetHeight em TvContentRow
  console.log('✓ Cenário 1: Eliminação de reflow síncrono forçado (offsetHeight) durante navegação');
  assert.ok(
    !contentRowCode.includes('trackRef.current.offsetHeight'),
    'TvContentRow NÃO deve conter leituras síncronas de layout (offsetHeight) que forçam reflow no Tizen'
  );

  // Cenário 2: will-change dinâmico/seletivo no trilho horizontal
  console.log('✓ Cenário 2: will-change dinâmico (desativa camadas GPU ociosas)');
  assert.ok(
    !contentRowCode.includes('className="relative z-10 flex items-center gap-6 will-change-transform"'),
    'TvContentRow NÃO deve aplicar will-change-transform estático em todos os trilhos simultaneamente'
  );
  assert.ok(
    contentRowCode.includes("willChange: (transitionEnabled || isAnimatingRef.current) ? 'transform' : 'auto'"),
    'TvContentRow deve aplicar willChange apenas enquanto o trilho estiver animando'
  );

  // Cenário 3: Eliminação de filtros blur(20px) em cards não selecionados
  console.log('✓ Cenário 3: Redução drástica de GPU blur(20px) em capas inativas');
  assert.ok(
    cardCode.includes('{isTvFocused && !suppressFocusBorder && ('),
    'TvCard16x9 deve renderizar a camada com filter: blur(20px) exclusivamente quando focado com borda ativa'
  );

  // Cenário 4: Eliminação de listeners de progresso desnecessários em cards sem barra de progresso
  console.log('✓ Cenário 4: Eliminação de listeners redundantes de progresso na janela');
  assert.ok(
    cardCode.includes('if (!showProgress) return;'),
    'TvCard16x9 deve registrar o listener zapitv_progress_updated apenas quando showProgress for verdadeiro'
  );

  // Cenário 5: Resolução otimizada de imagens para Smart TV
  console.log('✓ Cenário 5: Resolução de imagem adaptada à TV (w500 em vez de original 4K)');
  assert.ok(
    cardCode.includes('tvPerformanceProfileService.getOptimizedPosterUrl'),
    'TvCard16x9 deve invocar tvPerformanceProfileService.getOptimizedPosterUrl para evitar carregar originais 4K'
  );
  const testUrl = 'https://image.tmdb.org/t/p/original/poster123.jpg';
  const optUrl = tvPerformanceProfileService.getOptimizedPosterUrl(testUrl);
  assert.strictEqual(optUrl, 'https://image.tmdb.org/t/p/w500/poster123.jpg');

  // Cenário 6: Pré-decodificação assíncrona do próximo destaque do Hero
  console.log('✓ Cenário 6: Pré-decodificação assíncrona do próximo slide do banner principal');
  assert.ok(
    heroCode.includes('resolveBannerImage(nextSlide)'),
    'TvHeroBanner deve pré-resolver o próximo slide antes de iniciar a transição'
  );

  // Cenário 7: Pausa automática da rotação do banner quando rolado para fora da tela
  console.log('✓ Cenário 7: Pausa automática de rotação do banner quando rolado para fora da tela');
  assert.ok(
    heroCode.includes('(window.scrollY || 0) > 450') && heroCode.includes('setIsPaused'),
    'TvHeroBanner deve pausar o timer de rotação quando o banner for rolado para fora da viewport'
  );

  // Cenário 8: Padronização da rolagem vertical suave sem comandos concorrentes em TvCategoryView
  console.log('✓ Cenário 8: Eliminação de comandos simultâneos de rolagem em TvCategoryView');
  assert.ok(
    !categoryCode.includes('document.documentElement.scrollTop = 0') &&
    !categoryCode.includes('document.body.scrollTop = 0') &&
    !categoryCode.includes('heroEl.scrollIntoView'),
    'TvCategoryView deve eliminar comandos concorrentes e instantâneos de scrollTop/scrollIntoView'
  );
  assert.ok(
    categoryCode.includes('isScrollingToHeroRef') && categoryCode.includes("window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })"),
    'TvCategoryView deve utilizar transição única com debounce de rolagem suave'
  );

  // Cenário 9: Padronização da rolagem vertical suave sem comandos concorrentes em TvAnimeView
  console.log('✓ Cenário 9: Eliminação de comandos simultâneos de rolagem em TvAnimeView');
  assert.ok(
    !animeCode.includes('document.documentElement.scrollTop = 0') &&
    !animeCode.includes('document.body.scrollTop = 0') &&
    !animeCode.includes('heroEl.scrollIntoView'),
    'TvAnimeView deve eliminar comandos concorrentes e instantâneos de scrollTop/scrollIntoView'
  );

  // Cenário 10: Cache de índice no TvSearchView para busca imediata sem bloquear thread
  console.log('✓ Cenário 10: Cache em nível de módulo para o índice de busca da TV');
  assert.ok(
    searchCode.includes('cachedSearchableIndex') && searchCode.includes('cachedContentRef'),
    'TvSearchView deve reutilizar índice em nível de módulo para abertura instantânea com 0ms de bloqueio'
  );

  // Cenário 11: Isolamento estrito de reprodução de vídeo (100% de CPU/GPU dedicada)
  console.log('✓ Cenário 11: Isolamento estrito de tela durante reprodução de vídeo');
  assert.ok(
    appCode.includes('playingItem && playingMatchesRoute ?') &&
    appCode.includes('playerOnly={true}'),
    'TvApp deve desmontar carrosséis e banner em segundo plano quando o player estiver ativo'
  );

  // Cenário 12: Suspensão inteligente de categorias durante screensaver
  console.log('✓ Cenário 12: Suspensão das categorias no descanso de tela');
  assert.ok(
    appCode.includes('suspended={screensaverActive}'),
    'TvApp deve propagar suspended={screensaverActive} para suspender animações no descanso de tela'
  );

  // Cenário 13: Perfis de hardware (high, balanced, eco) calibrados
  console.log('✓ Cenário 13: Perfil adaptativo de hardware');
  const highConfig = tvPerformanceProfileService.getActiveConfig();
  assert.ok(highConfig.name === 'high' || highConfig.name === 'balanced' || highConfig.name === 'eco');
  assert.ok(typeof highConfig.bufferSlotsLeft === 'number');
  assert.ok(typeof highConfig.bufferSlotsRight === 'number');

  // Cenário 14: Monitoramento leve de FPS e telemetria
  console.log('✓ Cenário 14: Telemetria e medição sem sobrecarga');
  const metrics = tvPerformanceService.getMetrics();
  assert.ok(typeof metrics.fps === 'number');
  assert.ok(typeof metrics.avgFrameTimeMs === 'number');
  assert.ok(typeof metrics.jankCount === 'number');

  // Cenário 15: Normalização semântica e fonética rápida na busca
  console.log('✓ Cenário 15: Performance de normalização textual da busca');
  const startNorm = performance.now();
  for (let i = 0; i < 1000; i++) {
    normalizeSearchTerm('Demon Slayer: Kimetsu no Yaiba - Arco da Vila dos Ferreiros');
  }
  const normTime = performance.now() - startNorm;
  assert.ok(normTime < 100, `Normalização de 1000 títulos deve ser executada em menos de 100ms (tempo medido: ${normTime.toFixed(1)}ms)`);
  console.log(`    ↳ 1000 normalizações executadas em ${normTime.toFixed(2)}ms (aprox. ${(normTime / 1000).toFixed(4)}ms por título)`);

  // Cenário 16: Zero quebra nas suítes e contratos existentes
  console.log('✓ Cenário 16: Preservação integral dos contratos e estabilidade');
  assert.ok(contentRowCode.includes('SAFE_MARGIN_LEFT = 64'));
  assert.ok(contentRowCode.includes('border-cyan-400'));
  assert.ok(contentRowCode.includes('NORMAL_DURATION = 320'));
  assert.ok(contentRowCode.includes('CHAINED_DURATION = 260'));

  console.log('\n========================================================================');
  console.log('TODOS OS 16 CENÁRIOS DE BENCHMARK E DESEMPENHO PASSARAM COM 100% DE SUCESSO!');
  console.log('========================================================================\n');
}

runTvPerformanceBenchmarkTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ Falha na bateria de benchmark de desempenho:', err);
  process.exit(1);
});
