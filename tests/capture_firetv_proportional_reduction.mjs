import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/firetv_proportional_evidence';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const UA_FIRE_TV_STICK = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36';
const UA_FIRE_TV_720 = 'Mozilla/5.0 (Linux; Android 9; AFTSS Build/PS7229) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36 Silk/119.3.2';
const UA_FIRE_TV_4K = 'Mozilla/5.0 (Linux; Android 11; AFTKM Build/PS7652) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Safari/537.36 Silk/119.3.2';
const UA_SAMSUNG_TIZEN = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36';
const UA_LG_WEBOS = 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager';
const UA_MSX = 'Mozilla/5.0 (SmartHub; SMART-TV; U; Linux/SmartTV) AppleWebKit/538.1+ (KHTML, like Gecko) MediaStationX/0.1.155';

const SCENARIOS = [
  {
    id: '01_firetv_960x540',
    name: 'Fire TV Stick (960x540, DPR 2.0)',
    family: 'firetv',
    w: 960,
    h: 540,
    dpr: 2.0,
    ua: UA_FIRE_TV_STICK
  },
  {
    id: '02_firetv_1280x720',
    name: 'Fire TV 720p (1280x720, DPR 1.5)',
    family: 'firetv',
    w: 1280,
    h: 720,
    dpr: 1.5,
    ua: UA_FIRE_TV_720
  },
  {
    id: '03_firetv_1920x1080',
    name: 'Fire TV 1080p / 4K Max (1920x1080, DPR 1.0)',
    family: 'firetv',
    w: 1920,
    h: 1080,
    dpr: 1.0,
    ua: UA_FIRE_TV_4K
  },
  {
    id: '04_samsung_tizen_960x540',
    name: 'Samsung Tizen (960x540, DPR 1.0 - Sem redução Fire TV)',
    family: 'samsung',
    w: 960,
    h: 540,
    dpr: 1.0,
    ua: UA_SAMSUNG_TIZEN
  },
  {
    id: '05_samsung_tizen_1920x1080',
    name: 'Samsung Tizen (1920x1080, DPR 1.0 - Proporção Plena)',
    family: 'samsung',
    w: 1920,
    h: 1080,
    dpr: 1.0,
    ua: UA_SAMSUNG_TIZEN
  },
  {
    id: '06_lg_webos_1280x720',
    name: 'LG webOS (1280x720, DPR 1.0 - Proporção Plena)',
    family: 'generic',
    w: 1280,
    h: 720,
    dpr: 1.0,
    ua: UA_LG_WEBOS
  },
  {
    id: '07_msx_1280x720',
    name: 'Media Station X (1280x720, DPR 1.0 - MSX não-Fire)',
    family: 'msx',
    w: 1280,
    h: 720,
    dpr: 1.0,
    ua: UA_MSX
  }
];

async function run() {
  console.log('=== ZAPITV | CAPTURA VISUAL E MEDIÇÕES DOM: REDUÇÃO PROPORCIONAL FIRE TV ===\n');

  // Inicializa servidor Vite na porta 5204
  const server = await createServer({
    server: { port: 5204 }
  });
  await server.listen();
  console.log('✓ Servidor Vite ativo em http://localhost:5204\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const domReport = {};

  try {
    for (const sc of SCENARIOS) {
      console.log(`\n========================================================================`);
      console.log(`[Cenário ${sc.id}] ${sc.name}`);
      console.log(`========================================================================`);

      const context = await browser.newContext({
        viewport: { width: sc.w, height: sc.h },
        deviceScaleFactor: sc.dpr,
        userAgent: sc.ua
      });

      const page = await context.newPage();
      domReport[sc.id] = { name: sc.name, measurements: {} };

      // -----------------------------------------------------------------------
      // 1. HEADER & MENU DE PERFIL
      // -----------------------------------------------------------------------
      const headerUrl = `http://localhost:5204/tests/harness/header_profile_preview.html?deviceFamily=${sc.family}&banner=dark`;
      await page.goto(headerUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      // Medições do Header
      const headerMeasurements = await page.evaluate(() => {
        const header = document.querySelector('[data-testid="tv-header"]')?.getBoundingClientRect();
        const logoIcon = document.querySelector('[data-testid="tv-header"] .group\\/logo > div')?.getBoundingClientRect();
        const logoText = document.querySelector('[data-testid="tv-header"] .group\\/logo > img')?.getBoundingClientRect();
        const firstLink = document.querySelector('[data-focus-key="tv-nav-home"]')?.getBoundingClientRect();
        const searchBtn = document.querySelector('[data-focus-key="tv-nav-search"]')?.getBoundingClientRect();
        const profileBtn = document.querySelector('[data-focus-key="tv-nav-profile"]')?.getBoundingClientRect();
        const indicator = document.querySelector('[data-testid="tv-nav-indicator"]')?.getBoundingClientRect();
        return {
          headerHeight: header ? Math.round(header.height) : null,
          logoIconWidth: logoIcon ? Math.round(logoIcon.width) : null,
          logoIconHeight: logoIcon ? Math.round(logoIcon.height) : null,
          logoTextHeight: logoText ? Math.round(logoText.height) : null,
          firstLinkWidth: firstLink ? Math.round(firstLink.width) : null,
          firstLinkHeight: firstLink ? Math.round(firstLink.height) : null,
          searchBtnWidth: searchBtn ? Math.round(searchBtn.width) : null,
          profileBtnWidth: profileBtn ? Math.round(profileBtn.width) : null,
          indicatorWidth: indicator ? Math.round(indicator.width) : null
        };
      });
      domReport[sc.id].measurements.header = headerMeasurements;
      console.log('  Header:', headerMeasurements);

      // Screenshot 1: Header
      const pathHeader = path.join(outDir, `${sc.id}_1_header.png`);
      await page.screenshot({ path: pathHeader });
      console.log('  ✓ Screenshot Header:', pathHeader);

      // Abre Menu de Perfil
      await page.click('[data-focus-key="tv-nav-profile"]');
      await page.waitForTimeout(400);

      const menuMeasurements = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-testid="tv-profile-menu-dropdown"]')?.getBoundingClientRect();
        const avatar = document.querySelector('[data-testid="tv-profile-menu-dropdown"] .rounded-full.border-cyan-400\\/60')?.getBoundingClientRect();
        const firstItem = document.querySelector('[data-focus-key="tv-menu-mylist"]')?.getBoundingClientRect();
        return {
          menuWidth: dropdown ? Math.round(dropdown.width) : null,
          menuHeight: dropdown ? Math.round(dropdown.height) : null,
          avatarWidth: avatar ? Math.round(avatar.width) : null,
          itemHeight: firstItem ? Math.round(firstItem.height) : null
        };
      });
      domReport[sc.id].measurements.profileMenu = menuMeasurements;
      console.log('  Profile Menu:', menuMeasurements);

      // Screenshot 2: Profile Menu aberto
      const pathMenu = path.join(outDir, `${sc.id}_2_profile_menu.png`);
      await page.screenshot({ path: pathMenu });
      console.log('  ✓ Screenshot Profile Menu:', pathMenu);

      // -----------------------------------------------------------------------
      // 2. BUSCA COMPLETA, TECLADO VIRTUAL E GRADE DE RESULTADOS
      // -----------------------------------------------------------------------
      const searchUrl = `http://localhost:5204/tests/harness/search_keyboard_preview.html?deviceFamily=${sc.family}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const searchMeasurements = await page.evaluate(() => {
        const sidebar = document.querySelector('div.flex-shrink-0.h-full.flex.flex-col')?.getBoundingClientRect();
        const keyA = document.querySelector('[data-focus-key="tv-key-a"]')?.getBoundingClientRect();
        const space = document.querySelector('[data-focus-key="tv-key-space"]')?.getBoundingClientRect();
        const backBtn = document.querySelector('[data-focus-key="tv-search-back"]')?.getBoundingClientRect();
        const searchInput = document.querySelector('[data-focus-key="tv-search-input"]')?.getBoundingClientRect();
        const filterAll = document.querySelector('[data-focus-key="tv-filter-all"]')?.getBoundingClientRect();
        const cards = Array.from(document.querySelectorAll('[data-focus-key^="tv-search-card-"]')).map(el => el.getBoundingClientRect());
        return {
          sidebarWidth: sidebar ? Math.round(sidebar.width) : null,
          keyAWidth: keyA ? Math.round(keyA.width) : null,
          keyAHeight: keyA ? Math.round(keyA.height) : null,
          spaceHeight: space ? Math.round(space.height) : null,
          backBtnHeight: backBtn ? Math.round(backBtn.height) : null,
          searchInputHeight: searchInput ? Math.round(searchInput.height) : null,
          filterAllHeight: filterAll ? Math.round(filterAll.height) : null,
          cardCount: cards.length,
          firstCardWidth: cards[0] ? Math.round(cards[0].width) : null,
          firstCardHeight: cards[0] ? Math.round(cards[0].height) : null
        };
      });
      domReport[sc.id].measurements.search = searchMeasurements;
      console.log('  Search & Keyboard:', searchMeasurements);

      // Screenshot 3: Busca Completa
      const pathSearch = path.join(outDir, `${sc.id}_3_search_complete.png`);
      await page.screenshot({ path: pathSearch });
      console.log('  ✓ Screenshot Busca Completa:', pathSearch);

      // Foca na tecla A para demonstrar feedback visual do teclado
      await page.focus('[data-focus-key="tv-key-a"]');
      await page.waitForTimeout(200);

      // Screenshot 4: Teclado Virtual com Foco (crop)
      const keyboardEl = await page.$('.grid.grid-cols-6');
      if (keyboardEl) {
        const pathKeyboard = path.join(outDir, `${sc.id}_4_keyboard_crop.png`);
        await keyboardEl.screenshot({ path: pathKeyboard });
        console.log('  ✓ Screenshot Teclado Crop:', pathKeyboard);
      }

      // Screenshot 5: Grade de resultados (crop da coluna direita)
      const resultsCol = await page.$('.flex-1.h-full.flex.flex-col.overflow-y-auto');
      if (resultsCol) {
        const pathResults = path.join(outDir, `${sc.id}_5_results_grid_crop.png`);
        await resultsCol.screenshot({ path: pathResults });
        console.log('  ✓ Screenshot Grade de Resultados:', pathResults);
      }

      // -----------------------------------------------------------------------
      // 3. HUD INFERIOR AO VIVO
      // -----------------------------------------------------------------------
      const hudUrl = `http://localhost:5204/tests/harness/hud_preview.html?deviceFamily=${sc.family}&channel=maisum&scene=dark`;
      await page.goto(hudUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const hudMeasurements = await page.evaluate(() => {
        const hudSurface = document.querySelector('[data-testid="tv-live-glass-surface"]')?.getBoundingClientRect();
        const numberPill = document.querySelector('[data-testid="tv-channel-number-pill"]')?.getBoundingClientRect();
        const liveIndicator = document.querySelector('[data-testid="tv-live-indicator"]')?.getBoundingClientRect();
        return {
          hudWidth: hudSurface ? Math.round(hudSurface.width) : null,
          hudHeight: hudSurface ? Math.round(hudSurface.height) : null,
          numberPillHeight: numberPill ? Math.round(numberPill.height) : null,
          liveIndicatorHeight: liveIndicator ? Math.round(liveIndicator.height) : null
        };
      });
      domReport[sc.id].measurements.hud = hudMeasurements;
      console.log('  HUD Ao Vivo:', hudMeasurements);

      // Screenshot 6: HUD Ao Vivo
      const pathHud = path.join(outDir, `${sc.id}_6_live_hud.png`);
      await page.screenshot({ path: pathHud });
      console.log('  ✓ Screenshot HUD Ao Vivo:', pathHud);

      await context.close();
    }

    // Salva o relatório detalhado de medições em JSON
    const reportPath = path.join(outDir, 'measurements.json');
    fs.writeFileSync(reportPath, JSON.stringify(domReport, null, 2), 'utf8');
    console.log(`\n✓ Relatório de medições salvo em: ${reportPath}`);

  } finally {
    await browser.close();
    await server.close();
  }

  console.log('\n========================================================================');
  console.log('🎉 TODAS AS CAPTURAS E MEDIÇÕES CONCLUÍDAS COM SUCESSO!');
  console.log('========================================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Erro na execução das capturas:', err);
  process.exit(1);
});
