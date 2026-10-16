import { chromium } from 'playwright';

async function diagnoseCoraline() {
  console.log('--- DIAGNÓSTICO: DOWNLOAD OFFLINE DE CORALINE ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.error('[Browser PageError]:', err);
  });

  console.log('Navegando para http://localhost:4000...');
  await page.goto('http://localhost:4000', { waitUntil: 'networkidle' });

  // Pesquisa por Coraline
  console.log('Pesquisando por Coraline...');
  const searchInput = page.locator('input[type="text"]').first();
  await searchInput.fill('Coraline');
  await searchInput.press('Enter');

  await page.waitForTimeout(2000);

  // Procura pelo card de Coraline
  const card = page.locator('text=Coraline').first();
  if (await card.isVisible()) {
    console.log('Card de Coraline encontrado! Clicando para abrir detalhes...');
    await card.click();
  } else {
    console.log('Card de Coraline não encontrado pelo texto simples. Buscando em cards de conteúdo...');
    const anyCard = page.locator('.group').first();
    await anyCard.click();
  }

  await page.waitForTimeout(2500);

  // Verifica o botão Baixar
  console.log('Procurando pelo botão Baixar...');
  const downloadBtn = page.locator('button:has-text("Baixar")').first();
  const exists = await downloadBtn.count();
  console.log('Botões com texto "Baixar" encontrados:', exists);

  if (exists > 0) {
    console.log('Clicando no botão Baixar...');
    await downloadBtn.click();
    await page.waitForTimeout(2000);

    // Inspeciona o que está dentro do modal de qualidade
    const modal = page.locator('text=Download Offline ZapiTV').first();
    const isModalVisible = await modal.isVisible();
    console.log('Modal "Download Offline ZapiTV" está visível?', isModalVisible);

    const buttonsInModal = await page.locator('button').allInnerTexts();
    console.log('Botões no modal / tela:', buttonsInModal.filter(b => b.trim().length > 0));

    const optionsGrid = page.locator('.grid.grid-cols-3');
    console.log('Grid de opções visível?', await optionsGrid.isVisible());
    if (await optionsGrid.isVisible()) {
      console.log('Texto no grid:', await optionsGrid.innerText());
    }

    const confirmBtn = page.locator('button:has-text("Confirmar e Baixar")');
    if (await confirmBtn.isVisible()) {
      console.log('Confirmar e Baixar disabled?', await confirmBtn.isDisabled());
    }
  }

  await browser.close();
}

diagnoseCoraline().catch(console.error);
