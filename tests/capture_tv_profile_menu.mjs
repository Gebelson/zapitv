import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  console.log('Navegando para http://localhost:4173/tv...');
  await page.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Clica no botão de Perfil para abrir o TvProfileMenu
  console.log('Abrindo o menu do Perfil...');
  await page.click('[data-focus-key="tv-nav-profile"]');
  await page.waitForTimeout(600);

  // Capturar menu com foco no primeiro item (Minha Lista)
  const outFirst = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_profile_menu_initial.png';
  await page.screenshot({ path: outFirst });
  console.log('✓ Captura inicial do menu do Perfil salva:', outFirst);

  // Navegar para baixo pelo D-Pad até a opção "Atualizar ZapiTV":
  // Minha Lista -> ArrowDown -> Histórico -> ArrowDown -> Configurações -> ArrowDown -> Atualizar ZapiTV
  console.log('Navegando pelo D-Pad do controle remoto até Atualizar ZapiTV...');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500);

  // 1. Captura 1080p completa com Atualizar ZapiTV selecionado com foco do controle remoto
  const outFull = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_profile_menu_update_focused.png';
  await page.screenshot({ path: outFull });
  console.log('✓ Captura 1080p com Atualizar ZapiTV selecionado salva:', outFull);

  // 2. Crop detalhado do Menu Suspenso
  const updateBtn = await page.$('[data-focus-key="tv-menu-update"]');
  if (updateBtn) {
    const parentMenu = await page.$('div.fixed.z-\\[160\\]');
    if (parentMenu) {
      const outCrop = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_profile_menu_crop.png';
      await parentMenu.screenshot({ path: outCrop });
      console.log('✓ Crop do Menu Suspenso salvo:', outCrop);
    }
  }

  // 3. Pressionar Enter no controle remoto para testar o feedback visual ("Atualizando...", spinner)
  console.log('Pressionando Enter / OK no controle remoto sobre "Atualizar ZapiTV"...');
  // Interceptar window.location.reload no teste para capturar o frame de feedback visual
  await page.evaluate(() => {
    window.__reloaded = false;
    window.location.reload = () => { window.__reloaded = true; };
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);

  const outUpdating = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_profile_menu_updating_state.png';
  const parentMenuUpdating = await page.$('div.fixed.z-\\[160\\]');
  if (parentMenuUpdating) {
    await parentMenuUpdating.screenshot({ path: outUpdating });
    console.log('✓ Captura do estado de feedback "Atualizando..." salva:', outUpdating);
  }

  await browser.close();
  console.log('=== Capturas do Menu de Perfil concluídas com sucesso! ===');
}

capture().catch(err => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
