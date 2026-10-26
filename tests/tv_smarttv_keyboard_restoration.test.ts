import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tvViewportService } from '../src/core/tv/tvViewportService';
import { tvPerformanceService } from '../src/core/tv/tvPerformanceService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('\n=== ZAPITV | TESTES P0: RESTAURAÇÃO DO TECLADO DAS SMART TVS E ISOLAMENTO FIRE TV ===\n');

  // Mocks de User-Agent representativos
  const UA_FIRE_TV = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36';
  const UA_SAMSUNG_TIZEN = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';
  const UA_MSX = 'Mozilla/5.0 (SmartHub; SMART-TV; U; Linux/SmartTV) AppleWebKit/538.1+ (KHTML, like Gecko) MediaStationX/0.1.155';

  function mockWindow(w: number, h: number, dpr: number = 1) {
    (global as any).window = {
      innerWidth: w,
      innerHeight: h,
      devicePixelRatio: dpr,
      screen: { width: w, height: h },
      visualViewport: { width: w, height: h },
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    (global as any).document = {
      documentElement: {
        clientWidth: w,
        clientHeight: h,
        classList: { add: () => {}, remove: () => {} },
        style: { setProperty: () => {} }
      },
      body: {
        classList: { add: () => {}, remove: () => {} }
      }
    };
  }

  // -------------------------------------------------------------------------
  // TESTE A: Fire TV em 960x540
  // -------------------------------------------------------------------------
  console.log('[Teste A] Fire TV (960x540 / Compact)...');
  mockWindow(960, 540, 2.0);
  const metricsFireTv540 = tvViewportService.computeMetrics(UA_FIRE_TV);
  assert.strictEqual(metricsFireTv540.isFireTv, true, 'Deve identificar Fire TV');
  assert.strictEqual(metricsFireTv540.deviceFamily, 'firetv');
  assert.strictEqual(metricsFireTv540.scaleCategory, 'compact');
  assert.strictEqual(metricsFireTv540.searchSidebarWidth, 260, 'Sidebar no Fire TV 540p deve ser 260px para acomodar 6 capas');
  assert.strictEqual(metricsFireTv540.keyboardKeyHeight, 30, 'Altura no Fire TV 540p deve ser 30px');
  assert.strictEqual(metricsFireTv540.keyboardFontSize, 11);
  console.log('✓ Teste A aprovado: Fire TV 960x540 calibrado (sidebar 260px, altura 30px).');

  // -------------------------------------------------------------------------
  // TESTE B: Samsung Tizen em 960x540 (Nenhuma redução exclusiva de Fire TV aplicada!)
  // -------------------------------------------------------------------------
  console.log('[Teste B] Samsung Tizen (960x540 / Compact sem redução de Fire TV)...');
  mockWindow(960, 540, 1.0);
  const metricsTizen540 = tvViewportService.computeMetrics(UA_SAMSUNG_TIZEN);
  assert.strictEqual(metricsTizen540.isFireTv, false, 'Samsung Tizen NÃO deve ser tratado como Fire TV');
  assert.strictEqual(metricsTizen540.deviceFamily, 'samsung');
  assert.strictEqual(metricsTizen540.scaleCategory, 'compact');
  assert.strictEqual(metricsTizen540.searchSidebarWidth, 300, 'Sidebar no Tizen 540p deve ser 300px (sem redução de 260px do Fire TV)');
  assert.strictEqual(metricsTizen540.keyboardKeyHeight, 38, 'Altura no Tizen 540p deve ser 38px (sem achatamento de 30px do Fire TV)');
  assert.strictEqual(metricsTizen540.keyboardFontSize, 14, 'Fonte no Tizen 540p deve ser 14px');
  assert.ok(metricsTizen540.keyboardKeyHeight > metricsFireTv540.keyboardKeyHeight, 'Teclado no Tizen deve ser maior que no Fire TV');
  console.log('✓ Teste B aprovado: Samsung Tizen 960x540 preservado com altura nobre de 38px e sidebar de 300px.');

  // -------------------------------------------------------------------------
  // TESTE C: Samsung Tizen em 1920x1080 (Expanded)
  // -------------------------------------------------------------------------
  console.log('[Teste C] Samsung Tizen (1920x1080 / Proporções Normais Restauradas)...');
  mockWindow(1920, 1080, 1.0);
  const metricsTizen1080 = tvViewportService.computeMetrics(UA_SAMSUNG_TIZEN);
  assert.strictEqual(metricsTizen1080.isFireTv, false);
  assert.strictEqual(metricsTizen1080.scaleCategory, 'expanded');
  assert.strictEqual(metricsTizen1080.searchSidebarWidth, 380);
  assert.strictEqual(metricsTizen1080.keyboardKeyHeight, 46, 'Altura no Tizen 1080p deve ser 46px (proporções normais restauradas)');
  assert.strictEqual(metricsTizen1080.keyboardFontSize, 17, 'Fonte no Tizen 1080p deve ser 17px');
  console.log('✓ Teste C aprovado: Samsung Tizen 1920x1080 com altura de 46px e fonte de 17px.');

  // -------------------------------------------------------------------------
  // TESTE D: Media Station X (720p e 1080p)
  // -------------------------------------------------------------------------
  console.log('[Teste D] Media Station X (Preservação de Teclado Adequado)...');
  mockWindow(1280, 720, 1.0);
  const metricsMsx720 = tvViewportService.computeMetrics(UA_MSX);
  assert.strictEqual(metricsMsx720.isFireTv, false);
  assert.strictEqual(metricsMsx720.deviceFamily, 'msx');
  assert.strictEqual(metricsMsx720.scaleCategory, 'standard');
  assert.strictEqual(metricsMsx720.keyboardKeyHeight, 42, 'MSX 720p deve ter altura confortável de 42px');
  assert.strictEqual(metricsMsx720.searchSidebarWidth, 340);

  mockWindow(1920, 1080, 1.0);
  const metricsMsx1080 = tvViewportService.computeMetrics(UA_MSX);
  assert.strictEqual(metricsMsx1080.keyboardKeyHeight, 46, 'MSX 1080p deve ter altura de 46px');
  console.log('✓ Teste D aprovado: Media Station X mantido com proporções plenas (42px em 720p e 46px em 1080p).');

  // -------------------------------------------------------------------------
  // TESTE E: Fire TV em 1280x720 (Standard)
  // -------------------------------------------------------------------------
  console.log('[Teste E] Fire TV (1280x720 / Responsivo sem achatamento)...');
  mockWindow(1280, 720, 1.5);
  const metricsFireTv720 = tvViewportService.computeMetrics(UA_FIRE_TV);
  assert.strictEqual(metricsFireTv720.isFireTv, true);
  assert.strictEqual(metricsFireTv720.scaleCategory, 'standard');
  assert.strictEqual(metricsFireTv720.searchSidebarWidth, 330);
  assert.strictEqual(metricsFireTv720.keyboardKeyHeight, 36);
  assert.strictEqual(metricsFireTv720.keyboardFontSize, 14);
  console.log('✓ Teste E aprovado: Fire TV 1280x720 calibrado (sidebar 330px, altura 36px).');

  // -------------------------------------------------------------------------
  // TESTE F: Verificação de Código no TvSearchView.tsx e TvVirtualKey
  // -------------------------------------------------------------------------
  console.log('\n[Teste F] Auditoria de Código em TvSearchView.tsx...');
  const searchPath = path.resolve(__dirname, '../src/components/tv/TvSearchView.tsx');
  assert.ok(fs.existsSync(searchPath), 'TvSearchView.tsx deve existir');
  const searchCode = fs.readFileSync(searchPath, 'utf8');

  // F.1: style aplicado ao <button> em TvVirtualKey
  assert.ok(
    searchCode.includes('style={{ ...style, minHeight: style?.height }}') ||
    searchCode.includes('style={style}'),
    'TvVirtualKey DEVE repassar a propriedade style ao elemento <button>'
  );
  console.log('✓ F.1: Propriedade style aplicada ao elemento <button> em TvVirtualKey.');

  // F.2: Primeira linha com altura e centralização vertical
  assert.ok(
    searchCode.includes('focusKey="tv-key-space"') &&
    searchCode.includes('focusKey="tv-key-backspace"') &&
    searchCode.includes('focusKey="tv-key-clear"'),
    'TvSearchView deve conter os botões Espaço, Apagar e Limpar na primeira linha'
  );
  assert.ok(
    searchCode.includes('style={{ height: `${viewport.keyboardKeyHeight}px`'),
    'Primeira linha deve utilizar a mesma altura viewport.keyboardKeyHeight das teclas alfanuméricas'
  );
  console.log('✓ F.2: Primeira linha configurada com a mesma altura exata de todas as teclas.');

  // F.3: Preservação de 6 colunas na grade de resultados
  assert.ok(
    searchCode.includes("gridTemplateColumns: 'repeat(6, minmax(0, 1fr))'"),
    'TvSearchView deve manter rigorosamente 6 colunas na grade de resultados'
  );
  console.log('✓ F.3: Grade de resultados com 6 colunas preservada.');

  console.log('\n========================================================================');
  console.log(' TODOS OS TESTES DE RESTAURAÇÃO DO TECLADO PASSARAM COM SUCESSO! ');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Erro nos testes de restauração do teclado:', err);
  process.exit(1);
});
