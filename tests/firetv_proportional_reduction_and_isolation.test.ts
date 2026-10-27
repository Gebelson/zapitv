import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tvViewportService } from '../src/core/tv/tvViewportService';
import { tvPerformanceService } from '../src/core/tv/tvPerformanceService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('\n========================================================================');
  console.log('=== ZAPITV | TESTE P0: REDUÇÃO PROPORCIONAL FIRE TV E ISOLAMENTO SMART TVS ===');
  console.log('========================================================================\n');

  // Mocks de User-Agent representativos de cada família de dispositivos
  const UA_FIRE_TV_STICK = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36';
  const UA_FIRE_TV_720 = 'Mozilla/5.0 (Linux; Android 9; AFTSS Build/PS7229) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36 Silk/119.3.2';
  const UA_FIRE_TV_4K = 'Mozilla/5.0 (Linux; Android 11; AFTKM Build/PS7652) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Safari/537.36 Silk/119.3.2';
  const UA_SAMSUNG_TIZEN = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';
  const UA_LG_WEBOS = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager';
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
  // 1. MATRIZ DE VIEWPORTS: FIRE TV (960x540, 1280x720, 1920x1080)
  // -------------------------------------------------------------------------
  console.log('[1.1] Fire TV Stick (960x540 / Compact)...');
  mockWindow(960, 540, 2.0);
  const ftv540 = tvViewportService.computeMetrics(UA_FIRE_TV_STICK);
  assert.strictEqual(ftv540.isFireTv, true);
  assert.strictEqual(ftv540.deviceFamily, 'firetv');
  assert.strictEqual(ftv540.scaleCategory, 'compact');
  assert.strictEqual(ftv540.logoIconSize, 30, 'Símbolo Z no Fire TV compact deve ser 30px (29-30px)');
  assert.strictEqual(ftv540.logoTextHeight, 16, 'Texto ZapiTV no Fire TV compact deve ser 16px (15-16px)');
  assert.strictEqual(ftv540.navFontSize, 12, 'Links no Fire TV compact devem ser 12px (12-12.5px)');
  assert.strictEqual(ftv540.actionBtnSize, 34, 'Botões de ação no Fire TV compact devem ser 34px (32-34px)');
  assert.strictEqual(ftv540.actionIconSize, 16, 'Ícones de ação no Fire TV compact devem ser 16px (15-16px)');
  assert.strictEqual(ftv540.headerHeight, 52, 'Header no Fire TV compact deve ser 52px');
  assert.strictEqual(ftv540.hudMaxW, 'max-w-[620px]', 'HUD no Fire TV compact deve ter largura de ~620px (560-650px)');
  assert.strictEqual(ftv540.searchSidebarWidth, 260, 'Sidebar na busca no Fire TV compact deve ser 260px');
  assert.strictEqual(ftv540.keyboardKeyHeight, 30, 'Altura das teclas no Fire TV compact deve ser 30px');
  console.log('✓ 1.1: Fire TV Stick 960x540 validado com sucesso.');

  console.log('[1.2] Fire TV (1280x720 / Standard)...');
  mockWindow(1280, 720, 1.5);
  const ftv720 = tvViewportService.computeMetrics(UA_FIRE_TV_720);
  assert.strictEqual(ftv720.isFireTv, true);
  assert.strictEqual(ftv720.scaleCategory, 'standard');
  assert.strictEqual(ftv720.logoIconSize, 37);
  assert.strictEqual(ftv720.logoTextHeight, 19);
  assert.strictEqual(ftv720.navFontSize, 15);
  assert.strictEqual(ftv720.actionBtnSize, 38);
  assert.strictEqual(ftv720.actionIconSize, 19);
  assert.strictEqual(ftv720.headerHeight, 68);
  assert.strictEqual(ftv720.hudMaxW, 'max-w-[760px]', 'HUD no Fire TV 720p deve ter largura de ~760px (700-800px)');
  assert.strictEqual(ftv720.searchSidebarWidth, 330);
  assert.strictEqual(ftv720.keyboardKeyHeight, 36);
  console.log('✓ 1.2: Fire TV 1280x720 validado com sucesso.');

  console.log('[1.3] Fire TV (1920x1080 / Expanded)...');
  mockWindow(1920, 1080, 1.0);
  const ftv1080 = tvViewportService.computeMetrics(UA_FIRE_TV_4K);
  assert.strictEqual(ftv1080.isFireTv, true);
  assert.strictEqual(ftv1080.scaleCategory, 'expanded');
  assert.strictEqual(ftv1080.logoIconSize, 42);
  assert.strictEqual(ftv1080.logoTextHeight, 24);
  assert.strictEqual(ftv1080.navFontSize, 18);
  assert.strictEqual(ftv1080.actionBtnSize, 46);
  assert.strictEqual(ftv1080.actionIconSize, 23);
  assert.strictEqual(ftv1080.headerHeight, 82);
  assert.strictEqual(ftv1080.hudMaxW, 'max-w-[900px]', 'HUD no Fire TV 1080p deve ter largura de ~900px (850-950px)');
  assert.strictEqual(ftv1080.searchSidebarWidth, 360);
  assert.strictEqual(ftv1080.keyboardKeyHeight, 42);
  console.log('✓ 1.3: Fire TV 1920x1080 validado com sucesso.');

  // -------------------------------------------------------------------------
  // 2. ISOLAMENTO E PRESERVAÇÃO: SAMSUNG, LG, MSX (SEM REDUÇÃO FIRE TV)
  // -------------------------------------------------------------------------
  console.log('\n[2.1] Samsung Tizen 960x540 (Proporções originais intactas)...');
  mockWindow(960, 540, 1.0);
  const tizen540 = tvViewportService.computeMetrics(UA_SAMSUNG_TIZEN);
  assert.strictEqual(tizen540.isFireTv, false, 'Samsung NÃO é Fire TV');
  assert.strictEqual(tizen540.headerHeight, 60, 'Header no Tizen 540p deve manter 60px original');
  assert.strictEqual(tizen540.logoIconSize, 34, 'Símbolo Z no Tizen 540p deve manter 34px original');
  assert.strictEqual(tizen540.logoTextHeight, 18, 'Texto no Tizen 540p deve manter 18px original');
  assert.strictEqual(tizen540.navFontSize, 14, 'Links no Tizen 540p devem manter 14px original');
  assert.strictEqual(tizen540.actionBtnSize, 38, 'Ações no Tizen 540p devem manter 38px original');
  assert.strictEqual(tizen540.actionIconSize, 18, 'Ícones no Tizen 540p devem manter 18px original');
  assert.strictEqual(tizen540.hudMaxW, 'max-w-3xl', 'HUD no Tizen 540p deve manter max-w-3xl');
  assert.strictEqual(tizen540.searchSidebarWidth, 300, 'Sidebar no Tizen 540p deve manter 300px');
  assert.strictEqual(tizen540.keyboardKeyHeight, 38, 'Teclado no Tizen 540p deve manter 38px');
  console.log('✓ 2.1: Samsung Tizen 960x540 100% preservado.');

  console.log('[2.2] Samsung Tizen 1920x1080 (Full HD original intacto)...');
  mockWindow(1920, 1080, 1.0);
  const tizen1080 = tvViewportService.computeMetrics(UA_SAMSUNG_TIZEN);
  assert.strictEqual(tizen1080.isFireTv, false);
  assert.strictEqual(tizen1080.headerHeight, 92, 'Header no Tizen 1080p deve manter 92px');
  assert.strictEqual(tizen1080.logoIconSize, 48, 'Símbolo Z no Tizen 1080p deve manter 48px');
  assert.strictEqual(tizen1080.logoTextHeight, 28, 'Texto no Tizen 1080p deve manter 28px');
  assert.strictEqual(tizen1080.navFontSize, 21, 'Links no Tizen 1080p devem manter 21px');
  assert.strictEqual(tizen1080.actionBtnSize, 52, 'Ações no Tizen 1080p devem manter 52px');
  assert.strictEqual(tizen1080.actionIconSize, 26, 'Ícones no Tizen 1080p devem manter 26px');
  assert.strictEqual(tizen1080.hudMaxW, 'max-w-5xl', 'HUD no Tizen 1080p deve manter max-w-5xl');
  assert.strictEqual(tizen1080.searchSidebarWidth, 380, 'Sidebar no Tizen 1080p deve manter 380px');
  assert.strictEqual(tizen1080.keyboardKeyHeight, 46, 'Teclado no Tizen 1080p deve manter 46px');
  console.log('✓ 2.2: Samsung Tizen 1920x1080 100% preservado.');

  console.log('[2.3] LG webOS 1280x720 (720p original intacto)...');
  mockWindow(1280, 720, 1.0);
  const lg720 = tvViewportService.computeMetrics(UA_LG_WEBOS);
  assert.strictEqual(lg720.isFireTv, false);
  assert.strictEqual(lg720.headerHeight, 76, 'Header no webOS deve manter 76px');
  assert.strictEqual(lg720.logoIconSize, 42, 'Símbolo Z no webOS deve manter 42px');
  assert.strictEqual(lg720.logoTextHeight, 22, 'Texto no webOS deve manter 22px');
  assert.strictEqual(lg720.navFontSize, 17, 'Links no webOS devem manter 17px');
  assert.strictEqual(lg720.actionBtnSize, 44, 'Ações no webOS devem manter 44px');
  assert.strictEqual(lg720.actionIconSize, 22, 'Ícones no webOS devem manter 22px');
  assert.strictEqual(lg720.hudMaxW, 'max-w-4xl', 'HUD no webOS deve manter max-w-4xl');
  assert.strictEqual(lg720.searchSidebarWidth, 340, 'Sidebar no webOS deve manter 340px');
  assert.strictEqual(lg720.keyboardKeyHeight, 42, 'Teclado no webOS deve manter 42px');
  console.log('✓ 2.3: LG webOS 1280x720 100% preservado.');

  console.log('[2.4] Media Station X 1280x720 (MSX não-Fire OS original intacto)...');
  mockWindow(1280, 720, 1.0);
  const msx720 = tvViewportService.computeMetrics(UA_MSX);
  assert.strictEqual(msx720.isFireTv, false);
  assert.strictEqual(msx720.headerHeight, 76);
  assert.strictEqual(msx720.searchSidebarWidth, 340);
  assert.strictEqual(msx720.keyboardKeyHeight, 42);
  console.log('✓ 2.4: Media Station X 1280x720 100% preservado.');

  // -------------------------------------------------------------------------
  // 3. AUDITORIA DE CÓDIGO DO MENU DE PERFIL (TvProfileMenu.tsx)
  // -------------------------------------------------------------------------
  console.log('\n[3] Auditoria de Código do TvProfileMenu.tsx...');
  const profileMenuPath = path.resolve(__dirname, '../src/components/tv/TvProfileMenu.tsx');
  const profileMenuCode = fs.readFileSync(profileMenuPath, 'utf8');

  // 3.1 Preservação integral do bloco !isFireTv (320px, avatar 40px, etc.)
  assert.ok(
    profileMenuCode.includes('menuWidth: 320') &&
    profileMenuCode.includes('avatarSize: 40') &&
    profileMenuCode.includes('itemHeight: 44'),
    'TvProfileMenu deve manter o bloco !isFireTv com largura 320px intacto'
  );

  // 3.2 Novas referências Fire TV Compact (215px, avatar 26px, item 29-30px, fonte 10.5-11px, ícone 12px)
  assert.ok(
    profileMenuCode.includes('menuWidth: 215') &&
    profileMenuCode.includes('avatarSize: 26') &&
    (profileMenuCode.includes('itemHeight: 29.5') || profileMenuCode.includes('itemHeight: 30')) &&
    (profileMenuCode.includes('itemFontSize: 10.5') || profileMenuCode.includes('itemFontSize: 11')) &&
    profileMenuCode.includes('iconSize: 12'),
    'TvProfileMenu Fire TV Compact deve aplicar exatamente as novas referências (215px, avatar 26px, etc.)'
  );

  // 3.3 Novas referências Fire TV Standard (225px, avatar 28px, item 31-32px, fonte 11-11.5px, ícone 13px)
  assert.ok(
    profileMenuCode.includes('menuWidth: 225') &&
    profileMenuCode.includes('avatarSize: 28') &&
    (profileMenuCode.includes('itemHeight: 31.5') || profileMenuCode.includes('itemHeight: 32')) &&
    (profileMenuCode.includes('itemFontSize: 11') || profileMenuCode.includes('itemFontSize: 11.5')) &&
    profileMenuCode.includes('iconSize: 13'),
    'TvProfileMenu Fire TV Standard deve aplicar exatamente as novas referências (225px, avatar 28px, etc.)'
  );

  // 3.4 Novas referências Fire TV Expanded (235px, avatar 30px, item 33-34px, fonte 11.5-12px, ícone 14px)
  assert.ok(
    profileMenuCode.includes('menuWidth: 235') &&
    profileMenuCode.includes('avatarSize: 30') &&
    (profileMenuCode.includes('itemHeight: 33.5') || profileMenuCode.includes('itemHeight: 34')) &&
    (profileMenuCode.includes('itemFontSize: 11.5') || profileMenuCode.includes('itemFontSize: 12')) &&
    profileMenuCode.includes('iconSize: 14'),
    'TvProfileMenu Fire TV Expanded deve aplicar exatamente as novas referências (235px, avatar 30px, etc.)'
  );
  console.log('✓ 3: TvProfileMenu refinado e 100% isolado por plataforma.');

  // -------------------------------------------------------------------------
  // 4. AUDITORIA DO HUD AO VIVO (TvLiveChannelOverlay.tsx)
  // -------------------------------------------------------------------------
  console.log('\n[4] Auditoria de Código do TvLiveChannelOverlay.tsx...');
  const hudPath = path.resolve(__dirname, '../src/components/tv/live/TvLiveChannelOverlay.tsx');
  const hudCode = fs.readFileSync(hudPath, 'utf8');

  assert.ok(
    hudCode.includes('viewport.hudMaxW'),
    'TvLiveChannelOverlay deve usar viewport.hudMaxW para a largura responsiva'
  );
  assert.ok(
    hudCode.includes('viewport.isFireTv'),
    'TvLiveChannelOverlay deve ter condicionais baseadas em viewport.isFireTv'
  );
  assert.ok(
    hudCode.includes('min-w-[30px] h-[24px]') && hudCode.includes('min-w-[34px] h-[28px]'),
    'Número do canal deve ter cápsula compacta no Fire TV e padrão nas outras TVs'
  );
  assert.ok(
    hudCode.includes('w-8 h-8') && hudCode.includes('w-10 h-10 p-1.5'),
    'Logo da emissora deve ter variante reduzida no Fire TV'
  );
  assert.ok(
    !hudCode.includes('channel.quality') && !hudCode.includes('▲ Guia'),
    'HUD não pode conter qualidade ou guia de botões'
  );
  console.log('✓ 4: TvLiveChannelOverlay compacto no Fire TV e refinado nas outras TVs.');

  // -------------------------------------------------------------------------
  // 5. AUDITORIA DA BUSCA (TvSearchView.tsx)
  // -------------------------------------------------------------------------
  console.log('\n[5] Auditoria de Código do TvSearchView.tsx...');
  const searchPath = path.resolve(__dirname, '../src/components/tv/TvSearchView.tsx');
  const searchCode = fs.readFileSync(searchPath, 'utf8');

  assert.ok(
    searchCode.includes("gridTemplateColumns: 'repeat(6, minmax(0, 1fr))'"),
    'Grade de resultados da busca deve manter obrigatoriamente 6 colunas'
  );
  assert.ok(
    searchCode.includes('isFireTv ? \'rounded-lg\' : \'rounded-xl\''),
    'Teclas devem ter cantos proporcionais arredondados no Fire TV sem achatamento'
  );
  assert.ok(
    searchCode.includes('isFireTv ? \'gap-1.5\' : \'gap-2.5\''),
    'Filtros de categoria devem ter espaçamento compacto no Fire TV'
  );
  console.log('✓ 5: TvSearchView preserva 6 colunas e proporções ideais do teclado.');

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS TESTES DE REDUÇÃO PROPORCIONAL E ISOLAMENTO PASSARAM!');
  console.log('========================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Erro nos testes de redução proporcional Fire TV:', err);
  process.exit(1);
});
