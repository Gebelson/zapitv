import { chromium } from 'playwright';

async function testCoralineDirectFlow() {
  console.log('--- TESTE E2E: ACESSO DIRETO A CORALINE E DOWNLOAD OFFLINE ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  page.on('console', msg => {
    if (msg.text().includes('Download') || msg.text().includes('Coraline') || msg.text().includes('offlineSourceInspector')) {
      console.log(`[Browser Console ${msg.type()}]:`, msg.text());
    }
  });

  console.log('1. Navegando diretamente para /filmes/tt0327597 (Coraline)...');
  await page.goto('http://localhost:4000/filmes/tt0327597', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Verifica se o modal abriu
  const titleHeading = page.locator('h1:has-text("Coraline")').first();
  const isTitleVisible = await titleHeading.isVisible();
  console.log('2. Título "Coraline" visível no modal?', isTitleVisible);

  // Localiza o botão Baixar
  const downloadBtn = page.locator('button:has-text("Baixar")').first();
  const isDlVis = await downloadBtn.isVisible();
  console.log('3. Botão Baixar visível no modal?', isDlVis);

  if (isDlVis) {
    console.log('4. Clicando no botão Baixar...');
    await downloadBtn.click();

    // Aguarda o modal de seleção de qualidade
    const modalTitle = page.locator('text=Download Offline ZapiTV').first();
    await modalTitle.waitFor({ state: 'visible', timeout: 10000 });
    console.log('5. Janela "Download Offline ZapiTV" aberta com sucesso!');

    await page.waitForTimeout(1500);

    // Inspeciona as opções de qualidade reais exibidas
    const qualityButtons = page.locator('button:has(span.font-black)');
    const count = await qualityButtons.count();
    console.log(`6. Quantidade de opções de qualidade exibidas: ${count}`);

    for (let i = 0; i < count; i++) {
      const txt = (await qualityButtons.nth(i).innerText()).replace(/\n/g, ' ');
      console.log(`   Opção ${i + 1}: ${txt}`);
    }

    // Inspeciona o botão Confirmar e Baixar
    const confirmBtn = page.locator('button:has-text("Confirmar e Baixar")');
    const isConfirmVis = await confirmBtn.isVisible();
    const isConfirmDisabled = await confirmBtn.isDisabled();
    console.log(`7. Botão "Confirmar e Baixar" visível: ${isConfirmVis}, desativado: ${isConfirmDisabled}`);

    if (isConfirmVis && !isConfirmDisabled) {
      console.log('8. Clicando em "Confirmar e Baixar"...');
      await confirmBtn.click();
      await page.waitForTimeout(2000);

      // Verifica status do botão Baixar (deve indicar baixando ou baixado)
      const buttonTextAfter = await downloadBtn.innerText();
      console.log('9. Texto do botão após confirmar:', buttonTextAfter);

      // Vai até /downloads
      console.log('10. Navegando para /downloads...');
      await page.goto('http://localhost:4000/downloads', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const downloadsBody = await page.locator('body').innerText();
      const hasCoraline = downloadsBody.includes('Coraline');
      console.log('11. Coraline está presente na página de Meus Downloads?', hasCoraline);
    }
  }

  await browser.close();
  console.log('--- TESTE FINALIZADO COM SUCESSO ---');
}

testCoralineDirectFlow().catch(console.error);
