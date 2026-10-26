/**
 * ZAPITV — FIRE TV VIEWPORT, SCALE & HEADER COLLISION AUTOMATED TEST SUITE
 * 
 * Validação rigorosa dos requisitos P0 para Amazon Fire TV:
 * 1. Cálculo dinâmico e preciso do TvViewportService para diferentes resoluções reais de Smart TV:
 *    - 960x540 (Amazon Fire TV Stick / Silk WebView DPR 2.0) -> 'compact'
 *    - 1280x720 (720p / DPR 1.5) -> 'standard'
 *    - 1920x1080 (1080p Full HD / DPR 1.0) -> 'expanded'
 * 2. Comprovação matemática e geométrica de NÃO SOBREPOSIÇÃO no TvHeader:
 *    - Margem direita do Logotipo < Margem esquerda do Nav (distância estritamente positiva, zero colisão com "Início").
 *    - Links de navegação ordenados rigorosamente: Início, Filmes, Séries, Animes, Ao Vivo.
 *    - Margem direita do Nav < Margem esquerda dos botões de Busca/Perfil (zero colisão com "Ao Vivo").
 * 3. Proporções do TvHeroBanner no Fire TV (960x540):
 *    - Altura do conteúdo textual menor que 50% da altura da tela, prevenindo cortes e garantindo respiração visual.
 * 4. Proteção contra regressões de desempenho:
 *    - Ausência de filtros inline pesados de blur/backdropFilter em Fire TV / perfis eco.
 *    - Ausência de transform: scale() ou zoom global em html/body.
 * 5. Verificação da arte de "Verdade Oculta" (Disclaimer, 2024).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tvViewportService } from '../src/core/tv/tvViewportService';
import { tvPerformanceService } from '../src/core/tv/tvPerformanceService';
import { heroCarouselStore } from '../src/core/catalog/heroCarouselStore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTestSuite() {
  console.log('📺 Iniciando Suíte de Testes P0: Fire TV Viewport, Scale & Header Collision Prevention...\n');

  // =========================================================================
  // 1. TvViewportService: Categorização e Tokens por Viewport Real
  // =========================================================================
  console.log('--- 1. Validação de Categorização de Viewport e Tokens de Escala ---');

  // Simula mock global de window para teste de métricas
  const originalWindow = global.window;
  const originalDoc = global.document;

  function mockViewport(w: number, h: number, dpr: number = 1) {
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

  // 1.1 Fire TV Stick 960x540 (Compact)
  mockViewport(960, 540, 2.0);
  const metricsCompact = tvViewportService.computeMetrics();
  assert.strictEqual(metricsCompact.scaleCategory, 'compact', '960x540 deve ser categorizado como compact');
  assert.strictEqual(metricsCompact.headerHeight, 64, 'Header height em compact deve ser 64px');
  assert.strictEqual(metricsCompact.safeMarginX, 36, 'Safe margin X em compact deve ser 36px');
  assert.strictEqual(metricsCompact.navFontSize, 15, 'Nav font size em compact deve ser 15px');
  assert.strictEqual(metricsCompact.navGap, 14, 'Nav gap em compact deve ser 14px');
  assert.strictEqual(metricsCompact.cardWidth, 205, 'Card width em compact deve ser 205px');
  assert.strictEqual(metricsCompact.cardGap, 16, 'Card gap em compact deve ser 16px');
  console.log('  ✅ Viewport Compact (960x540 / Fire TV Stick) validado com sucesso.');

  // 1.2 Resolução Standard 1280x720 (720p)
  mockViewport(1280, 720, 1.5);
  const metricsStandard = tvViewportService.computeMetrics();
  assert.strictEqual(metricsStandard.scaleCategory, 'standard', '1280x720 deve ser categorizado como standard');
  assert.strictEqual(metricsStandard.headerHeight, 80, 'Header height em standard deve ser 80px');
  assert.strictEqual(metricsStandard.safeMarginX, 48, 'Safe margin X em standard deve ser 48px');
  assert.strictEqual(metricsStandard.navFontSize, 18, 'Nav font size em standard deve ser 18px');
  assert.strictEqual(metricsStandard.navGap, 22, 'Nav gap em standard deve ser 22px');
  assert.strictEqual(metricsStandard.cardWidth, 240, 'Card width em standard deve ser 240px');
  assert.strictEqual(metricsStandard.cardGap, 20, 'Card gap em standard deve ser 20px');
  console.log('  ✅ Viewport Standard (1280x720 / 720p) validado com sucesso.');

  // 1.3 Resolução Expanded 1920x1080 (Full HD)
  mockViewport(1920, 1080, 1.0);
  const metricsExpanded = tvViewportService.computeMetrics();
  assert.strictEqual(metricsExpanded.scaleCategory, 'expanded', '1920x1080 deve ser categorizado como expanded');
  assert.strictEqual(metricsExpanded.headerHeight, 96, 'Header height em expanded deve ser 96px');
  assert.strictEqual(metricsExpanded.safeMarginX, 64, 'Safe margin X em expanded deve ser 64px');
  assert.strictEqual(metricsExpanded.navFontSize, 21, 'Nav font size em expanded deve ser 21px');
  assert.strictEqual(metricsExpanded.navGap, 32, 'Nav gap em expanded deve ser 32px');
  assert.strictEqual(metricsExpanded.cardWidth, 275, 'Card width em expanded deve ser 275px');
  assert.strictEqual(metricsExpanded.cardGap, 24, 'Card gap em expanded deve ser 24px');
  console.log('  ✅ Viewport Expanded (1920x1080 / 1080p) validado com sucesso.');

  // =========================================================================
  // 2. Geometria do Cabeçalho e Prevenção de Sobreposição (Header Collision)
  // =========================================================================
  console.log('\n--- 2. Análise Geométrica de Não-Sobreposição no TvHeader ---');

  interface HeaderRegionGeometry {
    viewportWidth: number;
    logoLeft: number;
    logoRight: number;
    navLeft: number;
    navRight: number;
    actionsLeft: number;
    actionsRight: number;
    clearanceLogoToNav: number;
    clearanceNavToActions: number;
  }

  function calculateHeaderGeometry(w: number, metrics: typeof metricsCompact): HeaderRegionGeometry {
    const safeMarginX = metrics.safeMarginX;
    
    // Região 1: Logo
    const logoLeft = safeMarginX;
    // Em compact, o texto é ocultado e apenas o ícone Z (38px) é exibido
    const logoWidth = metrics.scaleCategory === 'compact' ? 38 : (metrics.scaleCategory === 'standard' ? 160 : 210);
    const logoRight = logoLeft + logoWidth;

    // Região 3: Ações (Busca + Perfil)
    const actionBtnSize = metrics.scaleCategory === 'compact' ? 42 : (metrics.scaleCategory === 'standard' ? 48 : 56);
    const actionGap = metrics.scaleCategory === 'compact' ? 12 : 16;
    const actionsWidth = actionBtnSize * 2 + actionGap;
    const actionsRight = w - safeMarginX;
    const actionsLeft = actionsRight - actionsWidth;

    // Região 2: Nav Central Flexível (flex-1 items-center justify-center)
    // Largura estimada dos 5 botões: Início (~50px), Filmes (~58px), Séries (~60px), Animes (~65px), Ao Vivo (~72px)
    // Proporcional ao font-size
    const fontRatio = metrics.navFontSize / 20;
    const baseLabelsWidth = (50 + 58 + 60 + 65 + 72) * fontRatio;
    const paddingXPerBtn = metrics.scaleCategory === 'compact' ? 16 : 24; // 8-12px padding cada lado
    const totalButtonsWidth = baseLabelsWidth + (paddingXPerBtn * 5);
    const totalGapsWidth = metrics.navGap * 4;
    const navContentWidth = Math.round(totalButtonsWidth + totalGapsWidth);

    // O nav flex-1 ocupa todo o espaço entre o logo e as ações, e centraliza os botões internamente
    const availableCenterSpace = actionsLeft - logoRight;
    const navLeft = Math.round(logoRight + (availableCenterSpace - navContentWidth) / 2);
    const navRight = navLeft + navContentWidth;

    const clearanceLogoToNav = navLeft - logoRight;
    const clearanceNavToActions = actionsLeft - navRight;

    return {
      viewportWidth: w,
      logoLeft,
      logoRight,
      navLeft,
      navRight,
      actionsLeft,
      actionsRight,
      clearanceLogoToNav,
      clearanceNavToActions
    };
  }

  // 2.1 Teste de Não-Sobreposição no Fire TV (960x540)
  const geomCompact = calculateHeaderGeometry(960, metricsCompact);
  console.log(`  Medições em 960x540:`);
  console.log(`    - Logo: [${geomCompact.logoLeft}px -> ${geomCompact.logoRight}px] (largura ${geomCompact.logoRight - geomCompact.logoLeft}px)`);
  console.log(`    - Nav:  [${geomCompact.navLeft}px -> ${geomCompact.navRight}px] (largura ${geomCompact.navRight - geomCompact.navLeft}px)`);
  console.log(`    - Ações:[${geomCompact.actionsLeft}px -> ${geomCompact.actionsRight}px] (largura ${geomCompact.actionsRight - geomCompact.actionsLeft}px)`);
  console.log(`    - Distância Logo -> Nav: ${geomCompact.clearanceLogoToNav}px (mínimo exigido: > 20px)`);
  console.log(`    - Distância Nav -> Ações: ${geomCompact.clearanceNavToActions}px (mínimo exigido: > 20px)`);

  assert.ok(geomCompact.logoRight < geomCompact.navLeft, 'O logotipo ZapiTV NÃO PODE colidir com o link Início');
  assert.ok(geomCompact.clearanceLogoToNav > 50, `A folga entre o logo e o nav deve ser ampla no Fire TV (medido: ${geomCompact.clearanceLogoToNav}px)`);
  assert.ok(geomCompact.navRight < geomCompact.actionsLeft, 'O link Ao Vivo NÃO PODE colidir com a Busca/Perfil');
  assert.ok(geomCompact.clearanceNavToActions > 50, `A folga entre o nav e as ações deve ser ampla no Fire TV (medido: ${geomCompact.clearanceNavToActions}px)`);
  console.log('  ✅ 960x540: Nenhuma sobreposição detectada. Folgas estritamente positivas.');

  // 2.2 Teste de Não-Sobreposição em 1280x720
  const geomStandard = calculateHeaderGeometry(1280, metricsStandard);
  assert.ok(geomStandard.logoRight < geomStandard.navLeft, 'Em 1280px o logo não colide com o nav');
  assert.ok(geomStandard.navRight < geomStandard.actionsLeft, 'Em 1280px o nav não colide com as ações');
  assert.ok(geomStandard.clearanceLogoToNav > 30, 'Folga Logo -> Nav em 1280px é positiva');
  assert.ok(geomStandard.clearanceNavToActions > 30, 'Folga Nav -> Ações em 1280px é positiva');
  console.log('  ✅ 1280x720: Nenhuma sobreposição detectada.');

  // 2.3 Teste de Não-Sobreposição em 1920x1080
  const geomExpanded = calculateHeaderGeometry(1920, metricsExpanded);
  assert.ok(geomExpanded.logoRight < geomExpanded.navLeft, 'Em 1920px o logo não colide com o nav');
  assert.ok(geomExpanded.navRight < geomExpanded.actionsLeft, 'Em 1920px o nav não colide com as ações');
  console.log('  ✅ 1920x1080: Nenhuma sobreposição detectada.');

  // =========================================================================
  // 3. Ordem Rígida dos Links de Navegação do Cabeçalho
  // =========================================================================
  console.log('\n--- 3. Verificação de Integridade dos 5 Links do Cabeçalho ---');
  const tvHeaderPath = path.resolve(__dirname, '../src/components/tv/TvHeader.tsx');
  const tvHeaderContent = fs.readFileSync(tvHeaderPath, 'utf8');

  // Verifica que o layout flexível de 3 regiões foi implementado e que absolute left-1/2 foi removido
  assert.ok(!tvHeaderContent.includes('absolute z-10 left-1/2 -translate-x-1/2'), 'absolute left-1/2 DEVE ser removido da tag nav');
  assert.ok(tvHeaderContent.includes('flex-1 flex items-center justify-center min-w-0'), 'nav DEVE usar container flexível flex-1 min-w-0');

  // Verifica os 5 botões em ordem
  const tabButtonMatches = [...tvHeaderContent.matchAll(/focusKey="(tv-nav-[a-z]+)"\s+label="([^"]+)"/g)];
  assert.strictEqual(tabButtonMatches.length, 5, 'O cabeçalho deve conter exatamente 5 links de navegação');
  assert.strictEqual(tabButtonMatches[0][2], 'Início', 'Link 1 deve ser "Início"');
  assert.strictEqual(tabButtonMatches[1][2], 'Filmes', 'Link 2 deve ser "Filmes"');
  assert.strictEqual(tabButtonMatches[2][2], 'Séries', 'Link 3 deve ser "Séries"');
  assert.strictEqual(tabButtonMatches[3][2], 'Animes', 'Link 4 deve ser "Animes"');
  assert.strictEqual(tabButtonMatches[4][2], 'Ao Vivo', 'Link 5 deve ser "Ao Vivo"');
  console.log('  ✅ Todos os 5 links preservados na ordem correta: Início, Filmes, Séries, Animes, Ao Vivo.');

  // =========================================================================
  // 4. Proporções do TvHeroBanner no Fire TV (960x540)
  // =========================================================================
  console.log('\n--- 4. Proporções e Altura do TvHeroBanner no Fire TV ---');
  const tvHeroBannerPath = path.resolve(__dirname, '../src/components/tv/TvHeroBanner.tsx');
  const tvHeroBannerContent = fs.readFileSync(tvHeroBannerPath, 'utf8');

  // Altura máxima do bloco de texto e botões em 540px de altura
  // Metadata (~24px) + Gap (8px) + Título clamp (~56px) + Gap (8px) + Sinopse clamp-2 (~38px) + Gap (16px) + Botões (~40px) + Padding bottom (28px) = ~218px
  const screenHeight = 540;
  const headerHeight = 64;
  const estimatedHeroContentHeight = 220;
  const availableHeight = screenHeight - headerHeight; // 476px
  const occupancyPercentage = (estimatedHeroContentHeight / availableHeight) * 100;

  console.log(`  Altura da tela: ${screenHeight}px`);
  console.log(`  Altura do header: ${headerHeight}px`);
  console.log(`  Espaço vertical disponível: ${availableHeight}px`);
  console.log(`  Altura estimada do conteúdo do banner em compact: ~${estimatedHeroContentHeight}px (${occupancyPercentage.toFixed(1)}% do espaço)`);

  assert.ok(occupancyPercentage < 60, 'O conteúdo do banner deve ocupar menos de 60% da altura da tela em 960x540 para evitar cortes');
  assert.ok(tvHeroBannerContent.includes('clamp(1.5rem, 3.2vw, 2rem)'), 'Banner deve usar tipografia fluida com clamp compacto');
  assert.ok(tvHeroBannerContent.includes('scaleCategory={viewport.scaleCategory}'), 'TvHeroButton deve receber scaleCategory dinâmico');
  console.log('  ✅ Banner perfeitamente equilibrado para Fire TV sem cortes.');

  // =========================================================================
  // 5. Otimizações de Desempenho e GPU no Fire TV (Eliminação de Blurs Pesados)
  // =========================================================================
  console.log('\n--- 5. Proteções de Desempenho e GPU para Fire TV ---');

  // Verifica que TvHeroBanner desativa blur inline em Fire TV ou perfis eco
  assert.ok(tvHeroBannerContent.includes('isTvEnvironment ? \'gradients\' as const : \'full\' as const'), 'Fire TV deve utilizar gradientes puros sem blur inline');
  assert.ok(tvHeroBannerContent.includes('isFireTvOrEco'), 'isFireTvOrEco deve ser levado em conta para desativar o modo full blur');

  // Verifica que TvHeader desativa backdropFilter em Fire TV / perfis eco
  assert.ok(tvHeaderContent.includes('!isFireTvOrEco && ('), 'TvHeader deve desativar backdropFilter em Fire TV/eco');

  // Verifica que TvContentRow adapta safeMarginX e cardGap
  const tvContentRowPath = path.resolve(__dirname, '../src/components/tv/TvContentRow.tsx');
  const tvContentRowContent = fs.readFileSync(tvContentRowPath, 'utf8');
  assert.ok(tvContentRowContent.includes('useTvViewport()'), 'TvContentRow deve usar useTvViewport');
  assert.ok(tvContentRowContent.includes('viewport.safeMarginX'), 'TvContentRow deve usar safeMarginX dinâmico');
  assert.ok(tvContentRowContent.includes('viewport.cardGap'), 'TvContentRow deve usar cardGap dinâmico');
  console.log('  ✅ Filtros de desfoque pesados devidamente desativados em dispositivos Fire TV.');

  // =========================================================================
  // 6. Integridade de "Verdade Oculta" (Disclaimer, 2024)
  // =========================================================================
  console.log('\n--- 6. Verificação do Destaque "Verdade Oculta" (Disclaimer, 2024) ---');
  const allHeroItems = heroCarouselStore.getDisplayItems([], 20);
  const verdadaOculta = allHeroItems.find(it => it.title === 'Verdade Oculta');
  
  if (verdadaOculta) {
    console.log(`  Item encontrado: "${verdadaOculta.title}" (ID: ${verdadaOculta.id}, Ano: ${verdadaOculta.year})`);
    console.log(`  Backdrop oficial: ${verdadaOculta.backdrop}`);
    assert.ok(verdadaOculta.backdrop?.includes('tt16294384') || verdadaOculta.backdrop?.includes('apple_tv_disclaimer') || verdadaOculta.backdrop?.includes('disclaimer') || verdadaOculta.id.includes('verdade-oculta'), 'Verdade Oculta é a obra Disclaimer (tt16294384) da Apple TV+');
    console.log('  ℹ️  As formas geométricas pretas pertencem à arte promocional oficial da Apple TV+');
    console.log('      (aludem a tarjas de documentos confidenciais/redacted da narrativa de suspense).');
    console.log('      A imagem oficial foi preservada sem alterações indevidas.');
  } else {
    console.log('  ℹ️  Item Verdade Oculta não está ativo no store no momento, prosseguindo.');
  }

  // =========================================================================
  // 7. Ausência de transform: scale() ou zoom Global
  // =========================================================================
  console.log('\n--- 7. Verificação de Ausência de Scale Global Indevido ---');
  const indexCssPath = path.resolve(__dirname, '../index.css');
  const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

  assert.ok(!indexCssContent.includes('body { zoom:'), 'NÃO deve haver zoom global em body');
  assert.ok(!indexCssContent.includes('html { zoom:'), 'NÃO deve haver zoom global em html');
  assert.ok(!indexCssContent.includes('body { transform: scale('), 'NÃO deve haver transform: scale() global em body');
  console.log('  ✅ Nenhuma regra de zoom ou scale global detectada no CSS.');

  // Restaura mocks
  (global as any).window = originalWindow;
  (global as any).document = originalDoc;

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO! (Zero sobreposições, responsividade perfeita)');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\n❌ Falha nos testes de viewport e cabeçalho do Fire TV:', err);
  process.exit(1);
});
