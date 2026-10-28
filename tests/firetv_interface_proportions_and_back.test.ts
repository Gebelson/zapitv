/**
 * ZAPITV — SUÍTE DE TESTES AUTOMATIZADOS: PROPORÇÕES DEFINITIVAS E CONTROLE FIRE TV
 * 
 * Validação rigorosa dos 10 Requisitos P0:
 * 1. Carrosséis da Home: 6 capas completas + metade da 7ª capa visível na extremidade direita
 * 2. Diminuição das informações nas capas (TvCard16x9): gradiente suave de base, fontes e badges
 * 3. Logo ZapiTV aproximada do símbolo Z 3D sem sobreposição com "Início"
 * 4. Botão Voltar do controle remoto Fire TV (debounce 250ms, keycodes 4/10009/461/27, popstate, navegação por abas)
 * 5. Grade de Resultados da Busca: exatamente 6 colunas por fileira (repeat(6, minmax(0, 1fr))) e proporções compactas
 * 6. ZapiLoader proporcional na TV (76px vs 220px)
 * 7. Barra inferior do Ao Vivo (TvLiveChannelOverlay): max-w-3xl, logo 40px, tipografia compacta
 * 8. Redução proporcional do TvHeroBanner
 * 9. Tokens centralizados no TvViewportService
 * 10. Proteção contra regressões visuais ou de desempenho
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tvViewportService } from '../src/core/tv/tvViewportService';
import { getVisibleSlots } from '../src/components/tv/TvContentRow';
import { tvNavigationManager } from '../src/core/tv/tvNavigationManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Iniciando Testes Automatizados dos 10 Requisitos P0 do Fire TV...\n');

  // =========================================================================
  // 1. CARROSSÉIS DA HOME: 6 CAPAS COMPLETAS E 7ª PELA METADE
  // =========================================================================
  console.log('--- 1. Carrosséis da Home: Proporção de 6,5 Capas Visíveis ---');
  
  // Simula ambiente Fire TV 960x540
  (global as any).window = {
    innerWidth: 960,
    innerHeight: 540,
    devicePixelRatio: 2.0,
    screen: { width: 960, height: 540 },
    visualViewport: { width: 960, height: 540 },
    addEventListener: () => {},
    removeEventListener: () => {},
    history: { pushState: () => {} }
  };
  (global as any).document = {
    documentElement: {
      clientWidth: 960,
      clientHeight: 540,
      classList: { add: () => {}, remove: () => {} },
      style: { setProperty: () => {} }
    },
    body: {
      classList: { add: () => {}, remove: () => {} }
    }
  };

  const metrics = tvViewportService.computeMetrics();
  assert.strictEqual(metrics.scaleCategory, 'compact');
  assert.strictEqual(metrics.cardWidth, 132, 'cardWidth deve ser 132px para Fire TV 960x540');
  assert.strictEqual(metrics.cardGap, 12, 'cardGap deve ser 12px para Fire TV 960x540');
  assert.ok(metrics.safeMarginX === 28 || metrics.safeMarginX === 32, 'safeMarginX deve ser 28px ou 32px para Fire TV 960x540');

  // Matemática exata do carrossel na tela:
  // Largura disponível a partir de safeMarginX = 960 - 32 = 928px
  // 6 primeiras capas (slots 0 a 5): 6 * 132 = 792px de cards
  // 6 espaçamentos entre os 7 cards: 6 * 12 = 72px de gap
  // Posição de início do 7º card (slot 6): 32 (margem) + 6 * (132 + 12) = 32 + 864 = 896px
  // Área visível do 7º card até a borda direita (960px): 960 - 896 = 64px
  // Fração visível do 7º card: 64 / 132 = 48.48% (~metade exata!)
  const slot6Start = metrics.safeMarginX + 6 * (metrics.cardWidth + metrics.cardGap);
  const slot6VisibleWidth = 960 - slot6Start;
  const slot6VisibleFraction = slot6VisibleWidth / metrics.cardWidth;

  console.log(`  Largura do card: ${metrics.cardWidth}px | Gap: ${metrics.cardGap}px | SafeMarginX: ${metrics.safeMarginX}px`);
  console.log(`  Início do 7º card (Slot 6): ${slot6Start}px`);
  console.log(`  Largura visível do 7º card na extremidade direita: ${slot6VisibleWidth}px`);
  console.log(`  Fração visível do 7º card: ${(slot6VisibleFraction * 100).toFixed(1)}% (exatamente metade da 7ª capa!)`);

  assert.ok(slot6VisibleFraction >= 0.45 && slot6VisibleFraction <= 0.55, 'A 7ª capa deve estar aproximadamente 50% visível');

  // getVisibleSlots deve conter [-1, 0, 1, 2, 3, 4, 5, 6, 7] quando houver >= 7 conteúdos
  const slotsInfinite = getVisibleSlots(10);
  assert.deepStrictEqual(slotsInfinite, [-1, 0, 1, 2, 3, 4, 5, 6, 7], 'Deve renderizar slots [-1, 0, 1, 2, 3, 4, 5, 6, 7]');
  
  // Para 1 a 6 conteúdos, carrossel deve ser estritamente finito
  assert.deepStrictEqual(getVisibleSlots(1), [0]);
  assert.deepStrictEqual(getVisibleSlots(4), [0, 1, 2, 3]);
  assert.deepStrictEqual(getVisibleSlots(6), [0, 1, 2, 3, 4, 5]);
  console.log('  ✅ Carrossel com 6,5 capas rigorosamente validado.');

  // =========================================================================
  // 2. DIMINUIÇÃO DAS INFORMAÇÕES NAS CAPAS (TvCard16x9.tsx)
  // =========================================================================
  console.log('\n--- 2. Informações nas Capas (TvCard16x9.tsx) ---');
  const cardPath = path.resolve(__dirname, '../src/components/tv/TvCard16x9.tsx');
  const cardContent = fs.readFileSync(cardPath, 'utf8');

  // O gradiente escuro de legibilidade deve ser restrito à base (h-14 sm:h-18), não h-24 sm:h-28
  assert.ok(cardContent.includes('h-14 sm:h-18 bg-gradient-to-t'), 'Gradiente inferior deve ser compacto (h-14 sm:h-18)');
  assert.ok(!cardContent.includes('h-24 sm:h-28 bg-gradient-to-t'), 'NÃO deve usar gradiente de h-24 cobrindo metade do card');
  assert.ok(cardContent.includes('p-2 sm:p-2.5'), 'Padding do card deve ser proporcional (p-2 sm:p-2.5)');
  assert.ok(cardContent.includes('text-[9px] sm:text-[10px]'), 'Metadados devem usar tipografia discreta');
  assert.ok(cardContent.includes("isFireTv ? 'text-[9.5px]' : 'text-[10.5px] sm:text-xs'") || cardContent.includes('text-[10.5px] sm:text-xs font-bold'), 'Título deve ser proporcional à capa vertical');
  console.log('  ✅ Capas verticais limpas com gradiente restrito à base e tipografia nítida.');

  // =========================================================================
  // 3. LOGO ZAPITV NO CABEÇALHO (TvHeader.tsx)
  // =========================================================================
  console.log('\n--- 3. Logo ZapiTV no Cabeçalho (TvHeader.tsx) ---');
  const headerPath = path.resolve(__dirname, '../src/components/tv/TvHeader.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  assert.ok(headerContent.includes('gap-1.5 sm:gap-2'), 'Logo container deve ter gap-1.5 aproximando o texto do ícone Z');
  assert.ok(headerContent.includes('ml-0 drop-shadow-lg'), 'Texto oficial zapitv-text.png deve ter ml-0');
  assert.ok(headerContent.includes('src="/zapitv-text.png"'), 'Texto oficial zapitv-text.png deve estar presente');
  assert.ok(headerContent.includes('focusKey="tv-nav-home"'), 'Link Início deve estar presente');
  console.log('  ✅ Logo ZapiTV perfeitamente integrada e aproximada do ícone Z 3D.');

  // =========================================================================
  // 4. BOTÃO VOLTAR DO CONTROLE REMOTO FIRE TV (tvNavigationManager.ts)
  // =========================================================================
  console.log('\n--- 4. Botão Voltar do Controle Remoto Fire TV ---');
  const navManagerPath = path.resolve(__dirname, '../src/core/tv/tvNavigationManager.ts');
  const navManagerContent = fs.readFileSync(navManagerPath, 'utf8');

  // Debounce de 250ms
  assert.ok(navManagerContent.includes('lastBackTriggerTime'), 'Deve conter controle de tempo do último disparo de voltar');
  assert.ok(navManagerContent.includes('250'), 'Deve ter debounce de 250ms');
  
  // Suporte a keyCodes e eventos Silk
  assert.ok(navManagerContent.includes('e.keyCode === 4'), 'Deve capturar keyCode 4 (Android / Fire TV Back)');
  assert.ok(navManagerContent.includes('e.keyCode === 10009'), 'Deve capturar keyCode 10009 (Tizen Back)');
  assert.ok(navManagerContent.includes('e.keyCode === 461'), 'Deve capturar keyCode 461 (webOS Back)');
  assert.ok(navManagerContent.includes('e.keyCode === 27'), 'Deve capturar keyCode 27 (Escape)');
  assert.ok(navManagerContent.includes('popstate'), 'Deve escutar popstate da WebView');
  assert.ok(navManagerContent.includes('handleGlobalKeyUp'), 'Deve capturar keyup para neutralizar duplicatas');

  // Teste de debounce no manipulador de eventos
  assert.ok(navManagerContent.includes('now - this.lastBackTriggerTime < 250'), 'Deve aplicar debounce de 250ms');

  let backCount = 0;
  const unreg = tvNavigationManager.registerBackHandler('test-back', 999, () => {
    backCount++;
    return true;
  });

  const firstCall = tvNavigationManager.dispatchBack();
  assert.strictEqual(firstCall, true, 'Disparo deve ser processado na pilha');
  assert.strictEqual(backCount, 1, 'Contador de voltar deve ser 1');
  unreg();

  // Verificação no TvApp.tsx das ações do Voltar
  const tvAppPath = path.resolve(__dirname, '../src/pages/tv/TvApp.tsx');
  const tvAppContent = fs.readFileSync(tvAppPath, 'utf8');
  assert.ok(tvAppContent.includes('currentTab === \'featured\''), 'Voltar em Ao Vivo deve tratar revelação do header');
  assert.ok(tvAppContent.includes('handleRevealLiveHeader()'), 'Voltar em Ao Vivo deve chamar handleRevealLiveHeader()');
  assert.ok(tvAppContent.includes('tabFocusKeys[currentTab]'), 'Voltar deve manter a aba ativa no header e não forçar home');
  console.log('  ✅ Sistema de botão Voltar robusto, com debounce de 250ms e comportamento de abas verificado.');

  // =========================================================================
  // 5. GRADE DE RESULTADOS DA BUSCA: EXATAMENTE 6 COLUNAS
  // =========================================================================
  console.log('\n--- 5. Grade de Resultados da Busca: 6 Colunas por Fileira ---');
  const searchPath = path.resolve(__dirname, '../src/components/tv/TvSearchView.tsx');
  const searchContent = fs.readFileSync(searchPath, 'utf8');

  // Grade com 6 colunas completas
  assert.ok(searchContent.includes('gridTemplateColumns: \'repeat(6, minmax(0, 1fr))\''), 'A grade de busca DEVE usar repeat(6, minmax(0, 1fr))');
  assert.ok(!searchContent.includes('grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'), 'NÃO deve usar breakpoints Tailwind genéricos na grade da TV');
  
  // Coluna esquerda da busca compacta
  assert.ok(searchContent.includes('viewport.searchSidebarWidth'), 'Deve usar searchSidebarWidth dinâmico');
  assert.ok(searchContent.includes('viewport.keyboardKeyHeight'), 'Deve usar keyboardKeyHeight dinâmico');
  assert.ok(searchContent.includes('viewport.keyboardFontSize'), 'Deve usar keyboardFontSize dinâmico');
  assert.ok(metrics.searchSidebarWidth === 260, 'searchSidebarWidth em compact deve ser 260px');
  assert.ok(metrics.keyboardKeyHeight === 30, 'keyboardKeyHeight em compact deve ser 30px');
  console.log('  ✅ Busca com grade de 6 colunas perfeitas e proporções calibradas.');

  // =========================================================================
  // 6. ÍCONE DE CARREGAMENTO ZAPILOADER
  // =========================================================================
  console.log('\n--- 6. ZapiLoader Proporcional no Ambiente TV ---');
  const loaderPath = path.resolve(__dirname, '../src/components/common/ZapiLoader.tsx');
  const loaderContent = fs.readFileSync(loaderPath, 'utf8');

  assert.ok(loaderContent.includes('\'tv\''), 'ZapiLoader deve aceitar tamanho \'tv\'');
  assert.ok(loaderContent.includes('case \'tv\':'), 'ZapiLoader deve mapear tamanho \'tv\'');
  assert.ok(loaderContent.includes('width = 76;'), 'Tamanho \'tv\' deve definir largura de 76px');
  assert.ok(metrics.loaderSize === 68 || metrics.loaderSize === 76, 'tvViewportService deve definir loaderSize proporcional em compact (68-76px)');
  assert.ok(tvAppContent.includes('size={viewport.loaderSize || 76}'), 'TvApp deve usar loaderSize dinâmico no loading');
  console.log('  ✅ Loader compacto (~76px) para TV validado.');

  // =========================================================================
  // 7. BARRA INFERIOR DE AO VIVO (TvLiveChannelOverlay.tsx)
  // =========================================================================
  console.log('\n--- 7. Barra Inferior de Ao Vivo (TvLiveChannelOverlay.tsx) ---');
  const liveOverlayPath = path.resolve(__dirname, '../src/components/tv/live/TvLiveChannelOverlay.tsx');
  const liveOverlayContent = fs.readFileSync(liveOverlayPath, 'utf8');

  assert.ok(liveOverlayContent.includes('useTvViewport()'), 'TvLiveChannelOverlay deve usar useTvViewport');
  assert.ok(liveOverlayContent.includes('viewport.hudMaxW'), 'TvLiveChannelOverlay deve usar hudMaxW');
  assert.ok(metrics.hudMaxW === 'max-w-[620px]' || metrics.hudMaxW === 'max-w-3xl', 'hudMaxW em compact deve ser max-w-[620px] ou max-w-3xl');
  assert.ok(liveOverlayContent.includes('w-10 h-10'), 'Logo do canal deve ter tamanho compacto w-10 h-10 em compact');
  assert.ok(liveOverlayContent.includes('h-1'), 'Barra de progresso deve ser fina h-1 em compact');
  console.log('  ✅ HUD de Ao Vivo proporcional e discreto no Fire TV.');

  // =========================================================================
  // 8. REDUÇÃO DO TVHEROBANNER
  // =========================================================================
  console.log('\n--- 8. Redução Proporcional do TvHeroBanner ---');
  const heroPath = path.resolve(__dirname, '../src/components/tv/TvHeroBanner.tsx');
  const heroContent = fs.readFileSync(heroPath, 'utf8');

  assert.ok(heroContent.includes('clamp(1.1rem, 2.2vw, 1.45rem)'), 'Título deve usar clamp(1.1rem, 2.2vw, 1.45rem)');
  assert.ok(heroContent.includes('max-w-md'), 'Sinopse deve ser limitada a max-w-md em compact');
  assert.ok(heroContent.includes('line-clamp-2'), 'Sinopse deve limitar a 2 linhas em compact');
  console.log('  ✅ TvHeroBanner com tipografia compacta e equilibrada.');

  // =========================================================================
  // 9 e 10. TOKENS CENTRALIZADOS E PROTEÇÃO CONTRA REGRESSÕES
  // =========================================================================
  console.log('\n--- 9 & 10. Tokens Centralizados e Proteção contra Regressões ---');
  const indexCss = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
  assert.ok(!indexCss.includes('body { zoom:'), 'Zero zoom em body');
  assert.ok(!indexCss.includes('html { zoom:'), 'Zero zoom em html');
  assert.ok(!indexCss.includes('body { transform: scale('), 'Zero transform scale em body');
  console.log('  ✅ Nenhuma regressão de zoom global. Tokens 100% integrados.');

  console.log('\n🎉 TODOS OS 10 REQUISITOS P0 DO FIRE TV FORAM VALIDADOS COM SUCESSO!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Falha na validação dos requisitos do Fire TV:', err);
  process.exit(1);
});
