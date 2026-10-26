import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/firetv_profile_evidence';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runVisualTests() {
  console.log('=== ZAPITV | TESTES VISUAIS & MEDIÇÕES DOM: REDUÇÃO DO MENU DE PERFIL FIRE TV ===\n');

  // 1. Inicializa servidor Vite programmatic na porta 5198
  console.log('1. Iniciando servidor Vite na porta 5198...');
  const server = await createServer({
    server: { port: 5198 }
  });
  await server.listen();
  console.log('✓ Servidor Vite ativo em http://localhost:5198\n');

  // 2. Lança navegador Chromium headless
  console.log('2. Lançando navegador Chromium headless...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const domMeasurements = {};

  try {
    const testCases = [
      {
        id: '01_firetv_960x540',
        name: 'Amazon Fire TV Stick (960x540, DPR 2.0, Silk Browser)',
        deviceFamily: 'firetv',
        width: 960,
        height: 540,
        dpr: 2.0,
        ua: 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7273) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.3.2 like Chrome/119.0.6045.163 Safari/537.36'
      },
      {
        id: '02_firetv_1280x720',
        name: 'Amazon Fire TV 720p (1280x720, DPR 1.5, Fire OS)',
        deviceFamily: 'firetv',
        width: 1280,
        height: 720,
        dpr: 1.5,
        ua: 'Mozilla/5.0 (Linux; Android 9; AFTSS Build/PS7229) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36 Silk/119.3.2'
      },
      {
        id: '03_firetv_1920x1080',
        name: 'Amazon Fire TV 1080p / 4K Max (1920x1080, DPR 1.0, Silk Browser)',
        deviceFamily: 'firetv',
        width: 1920,
        height: 1080,
        dpr: 1.0,
        ua: 'Mozilla/5.0 (Linux; Android 11; AFTKM Build/PS7652) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Safari/537.36 Silk/119.3.2'
      },
      {
        id: '04_samsung_tizen_960x540',
        name: 'Samsung Tizen (960x540, Compact Viewport — NÃO DEVE REDUZIR)',
        deviceFamily: 'samsung',
        width: 960,
        height: 540,
        dpr: 1.0,
        ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/85.0.4183.93 TV Safari/537.36'
      },
      {
        id: '05_samsung_tizen_1920x1080',
        name: 'Samsung Tizen (1920x1080, Full HD — NÃO DEVE REDUZIR)',
        deviceFamily: 'samsung',
        width: 1920,
        height: 1080,
        dpr: 1.0,
        ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/5.0 Chrome/108.0.0.0 TV Safari/537.36'
      }
    ];

    for (const tc of testCases) {
      console.log(`\n------------------------------------------------------------------------`);
      console.log(`[Cenário ${tc.id}] ${tc.name}`);
      console.log(`------------------------------------------------------------------------`);

      const context = await browser.newContext({
        viewport: { width: tc.width, height: tc.height },
        deviceScaleFactor: tc.dpr,
        userAgent: tc.ua
      });

      const page = await context.newPage();
      const url = `http://localhost:5198/tests/harness/header_profile_preview.html?deviceFamily=${tc.deviceFamily}&banner=dark`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      // Clica no botão de perfil para abrir o menu suspenso
      console.log('Abrindo menu de perfil pelo botão Perfil...');
      await page.click('[data-focus-key="tv-nav-profile"]');
      await page.waitForTimeout(350);

      // Aguarda dropdown estar no DOM
      await page.waitForSelector('[data-testid="tv-profile-menu-dropdown"]', { state: 'visible' });

      // Medições precisas do DOM
      const measurements = await page.evaluate(() => {
        const dropdown = document.querySelector('[data-testid="tv-profile-menu-dropdown"]');
        const overlay = document.querySelector('[data-testid="tv-profile-menu-overlay"]');
        const header = document.querySelector('[data-testid="tv-header"]');
        const myListItem = document.querySelector('[data-focus-key="tv-menu-mylist"]');
        const historyItem = document.querySelector('[data-focus-key="tv-menu-history"]');
        const settingsItem = document.querySelector('[data-focus-key="tv-menu-settings"]');
        const updateItem = document.querySelector('[data-focus-key="tv-menu-update"]');
        const avatar = dropdown?.querySelector('img, div.rounded-full');

        if (!dropdown) return null;

        const rect = dropdown.getBoundingClientRect();
        const computed = window.getComputedStyle(dropdown);
        const mylistRect = myListItem?.getBoundingClientRect();
        const mylistComputed = myListItem ? window.getComputedStyle(myListItem) : null;
        const avatarRect = avatar?.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const overlayComputed = overlay ? window.getComputedStyle(overlay) : null;

        return {
          menuWidth: Math.round(rect.width * 10) / 10,
          menuHeight: Math.round(rect.height * 10) / 10,
          menuTop: Math.round(rect.top),
          menuRight: Math.round(window.innerWidth - rect.right),
          menuLeft: Math.round(rect.left),
          menuBottom: Math.round(rect.bottom),
          padding: computed.padding,
          borderRadius: computed.borderRadius,
          avatarWidth: avatarRect ? Math.round(avatarRect.width * 10) / 10 : 0,
          avatarHeight: avatarRect ? Math.round(avatarRect.height * 10) / 10 : 0,
          firstItemHeight: mylistRect ? Math.round(mylistRect.height * 10) / 10 : 0,
          firstItemFontSize: mylistComputed ? mylistComputed.fontSize : '',
          isOverlayTransparent: overlayComputed ? overlayComputed.backgroundColor.includes('rgba(0, 0, 0, 0)') || overlayComputed.backgroundColor === 'transparent' : true,
          allOptionsPresent: !!(myListItem && historyItem && settingsItem && updateItem),
          allOptionsVisible: (mylistRect?.height || 0) > 0 && ((historyItem?.getBoundingClientRect().height) || 0) > 0,
          isCompactAttr: dropdown.getAttribute('data-firetv-compact') === 'true',
          deviceFamilyAttr: dropdown.getAttribute('data-device-family'),
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight
        };
      });

      console.log(`Dimensões medidas:`, measurements);
      domMeasurements[tc.id] = { testCase: tc.name, measurements };

      // Validação das asserções obrigatórias
      if (tc.deviceFamily === 'firetv') {
        if (measurements.menuWidth < 230 || measurements.menuWidth > 265) {
          throw new Error(`[ERRO] Largura do menu no Fire TV (${measurements.menuWidth}px) deve estar entre 230px e 265px!`);
        }
        if (measurements.avatarWidth < 26 || measurements.avatarWidth > 34) {
          throw new Error(`[ERRO] Avatar no Fire TV (${measurements.avatarWidth}px) deve estar entre 26px e 34px!`);
        }
        if (measurements.firstItemHeight < 30 || measurements.firstItemHeight > 38) {
          throw new Error(`[ERRO] Altura da opção no Fire TV (${measurements.firstItemHeight}px) deve estar entre 30px e 38px!`);
        }
        if (measurements.menuBottom > tc.height) {
          throw new Error(`[ERRO] Menu no Fire TV (${measurements.menuBottom}px) ultrapassa altura do viewport (${tc.height}px)!`);
        }
        console.log(`✓ Fire TV ${tc.id}: Menu compactado com sucesso (largura ${measurements.menuWidth}px, altura ${measurements.menuHeight}px, avatar ${measurements.avatarWidth}px).`);
      } else {
        // Samsung Tizen
        if (measurements.menuWidth < 315 || measurements.menuWidth > 325) {
          throw new Error(`[ERRO] Largura do menu na Samsung Tizen (${measurements.menuWidth}px) DEVE permanecer 320px!`);
        }
        if (measurements.avatarWidth < 38) {
          throw new Error(`[ERRO] Avatar na Samsung Tizen (${measurements.avatarWidth}px) DEVE permanecer ~40px!`);
        }
        if (measurements.firstItemHeight < 40) {
          throw new Error(`[ERRO] Altura da opção na Samsung Tizen (${measurements.firstItemHeight}px) DEVE permanecer ~44px!`);
        }
        console.log(`✓ Samsung Tizen ${tc.id}: Menu permaneceu no tamanho padrão (largura ${measurements.menuWidth}px, avatar ${measurements.avatarWidth}px) sem reduções de Fire TV!`);
      }

      // Captura de tela da página inteira
      const fullPath = path.join(outDir, `${tc.id}_full.png`);
      await page.screenshot({ path: fullPath });
      console.log(`✓ Screenshot completo salvo: ${fullPath}`);

      // Captura recortada do menu e região do header
      const dropdownEl = await page.$('[data-testid="tv-profile-menu-dropdown"]');
      if (dropdownEl) {
        const cropPath = path.join(outDir, `${tc.id}_menu_crop.png`);
        await dropdownEl.screenshot({ path: cropPath });
        console.log(`✓ Crop do menu salvo: ${cropPath}`);
      }

      // Interação D-Pad (Navegação vertical)
      console.log('Testando navegação D-Pad dentro do menu...');
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
      const isHistoryFocused = await page.$eval('[data-focus-key="tv-menu-history"]', (el) => el.getAttribute('data-tv-focused') === 'true');
      console.log(`✓ Foco moveu para 'Histórico': ${isHistoryFocused}`);

      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(150);
      const isMyListFocused = await page.$eval('[data-focus-key="tv-menu-mylist"]', (el) => el.getAttribute('data-tv-focused') === 'true');
      console.log(`✓ Foco retornou para 'Minha Lista': ${isMyListFocused}`);

      await context.close();
    }

    // Salva arquivo JSON com as medições DOM
    const jsonPath = path.join(outDir, 'dom_measurements.json');
    fs.writeFileSync(jsonPath, JSON.stringify(domMeasurements, null, 2), 'utf8');
    console.log(`\n✓ Medições estruturadas salvas em: ${jsonPath}`);

    console.log('\n========================================================================');
    console.log(' TODAS AS 5 CAPTURAS E MEDIÇÕES FORAM CONCLUÍDAS COM SUCESSO! ');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
    await server.close();
  }
}

runVisualTests().catch((err) => {
  console.error('\n❌ Erro durante capturas visuais:', err);
  process.exit(1);
});
