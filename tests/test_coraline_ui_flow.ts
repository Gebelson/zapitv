import { chromium } from 'playwright';

async function testCoralineUiFlow() {
  console.log('--- TESTE E2E: FLUXO DE DOWNLOAD DE CORALINE NA UI ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  page.on('console', msg => {
    if (msg.text().includes('Download') || msg.text().includes('Coraline') || msg.type() === 'error') {
      console.log(`[Browser Console ${msg.type()}]:`, msg.text());
    }
  });

  console.log('1. Acessando catálogo de filmes...');
  await page.goto('http://localhost:4000/filmes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('2. Buscando Coraline e o Mundo Secreto...');
  const searchInput = page.locator('input[placeholder*="Buscar"]').first();
  await searchInput.fill('Coraline');
  await searchInput.press('Enter');
  await page.waitForTimeout(2000);

  // Clica no card de Coraline
  const coralineCard = page.locator('text=Coraline').first();
  await coralineCard.waitFor({ state: 'visible', timeout: 8000 });
  console.log('3. Card de Coraline visível. Abrindo modal de detalhes...');
  await coralineCard.click();
  await page.waitForTimeout(2000);

  // Localiza o botão Baixar no modal
  const downloadButton = page.locator('button:has-text("Baixar")').first();
  await downloadButton.waitFor({ state: 'visible', timeout: 8000 });
  console.log('4. Botão Baixar encontrado no modal de detalhes. Clicando...');
  await downloadButton.click();

  // Aguarda a abertura da janela de download
  const downloadModal = page.locator('text=Download Offline ZapiTV').first();
  await downloadModal.waitFor({ state: 'visible', timeout: 12000 });
  console.log('5. Janela de Download Offline ZapiTV aberta com sucesso!');

  await page.waitForTimeout(1000);

  // Inspeciona opções de qualidade reais exibidas
  const qualityButtons = page.locator('button:has(span.font-black)');
  const count = await qualityButtons.count();
  console.log(`6. Quantidade de botões de qualidade na janela: ${count}`);

  const buttonTexts: string[] = [];
  for (let i = 0; i < count; i++) {
    buttonTexts.push((await qualityButtons.nth(i).innerText()).replace(/\n/g, ' '));
  }
  console.log('Qualidades disponíveis:', buttonTexts);

  // Inspeciona o botão "Confirmar e Baixar"
  const confirmBtn = page.locator('button:has-text("Confirmar e Baixar")');
  const isConfirmVisible = await confirmBtn.isVisible();
  const isConfirmDisabled = await confirmBtn.isDisabled();
  console.log(`7. Botão Confirmar e Baixar visível: ${isConfirmVisible}, desativado: ${isConfirmDisabled}`);

  // Se houver opções, clica para confirmar o download
  if (!isConfirmDisabled && count > 0) {
    console.log('8. Clicando em Confirmar e Baixar...');
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    // Verifica estado do botão após confirmação
    const statusText = await downloadButton.innerText();
    console.log('9. Estado do botão de download após confirmação:', statusText);

    // Navega para /downloads para verificar a presença do item
    console.log('10. Navegando para página de Downloads: http://localhost:4000/downloads...');
    await page.goto('http://localhost:4000/downloads', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const downloadsPageContent = await page.locator('body').innerText();
    const hasCoralineInDownloads = downloadsPageContent.includes('Coraline');
    console.log(`11. Coraline aparece na página Meus Downloads? ${hasCoralineInDownloads}`);
  }

  await browser.close();
  console.log('--- TESTE E2E CONCLUÍDO ---');
}

testCoralineUiFlow().catch(console.error);
