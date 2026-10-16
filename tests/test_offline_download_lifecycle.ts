import { chromium } from 'playwright';

async function testDownloadLifecycle() {
  console.log('=== TESTE DO CICLO COMPLETO DE DOWNLOAD OFFLINE: CORALINE ===');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Offline') || text.includes('Download') || text.includes('sw.js') || text.includes('Coraline') || msg.type() === 'error') {
      console.log(`[Browser ${msg.type()}]:`, text);
    }
  });

  page.on('pageerror', err => {
    console.error('[Browser PageError]:', err.message);
  });

  console.log('1. Acessando /filmes/tt0327597 (Coraline e o Mundo Secreto)...');
  await page.goto('http://localhost:4000/filmes/tt0327597', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const titleVisible = await page.locator('h1:has-text("Coraline")').first().isVisible();
  console.log('2. Título Coraline visível no modal?', titleVisible);

  const downloadBtn = page.locator('button:has-text("Baixar")').first();
  console.log('3. Clicando no botão Baixar...');
  await downloadBtn.click();

  const modalHeading = page.locator('text=Download Offline ZapiTV').first();
  await modalHeading.waitFor({ state: 'visible', timeout: 12000 });
  console.log('4. Janela "Download Offline ZapiTV" aberta com sucesso!');

  await page.waitForTimeout(1000);

  // Lista as qualidades reais exibidas
  const qualityButtons = page.locator('button:has(span.font-black)');
  const qCount = await qualityButtons.count();
  console.log(`5. Quantidade de qualidades identificadas: ${qCount}`);
  for (let i = 0; i < qCount; i++) {
    const txt = (await qualityButtons.nth(i).innerText()).replace(/\n/g, ' ');
    console.log(`   - Qualidade ${i + 1}: ${txt}`);
  }

  const confirmBtn = page.locator('button:has-text("Confirmar e Baixar")');
  const isConfirmDisabled = await confirmBtn.isDisabled();
  console.log('6. Botão "Confirmar e Baixar" está ativo?', !isConfirmDisabled);

  if (!isConfirmDisabled) {
    console.log('7. Clicando em "Confirmar e Baixar"...');
    await confirmBtn.click();

    // Aguarda o registro aparecer no banco local
    console.log('8. Aguardando registro do download no banco offline...');
    let records: any[] = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(800);
      records = await page.evaluate(() => {
        const db = (window as any).__zapitv_offlineDb;
        return db ? db.getAllDownloads() : [];
      });
      if (records.length > 0) break;
    }

    console.log('9. Registros de download encontrados no IndexedDB:', JSON.stringify(records, null, 2));

    // Aguarda 4 segundos de streaming de vídeo para observar bytes baixados
    console.log('10. Acompanhando chunks de streaming...');
    await page.waitForTimeout(4000);

    const progress = await page.evaluate(() => {
      const db = (window as any).__zapitv_offlineDb;
      const first = db ? db.getAllDownloads()[0] : null;
      if (!first) return null;
      return {
        id: first.id,
        quality: first.quality,
        status: first.status,
        downloadedBytes: first.downloadedBytes,
        totalBytes: first.totalBytes,
        speedBytesPerSec: first.speedBytesPerSec,
        errorReason: first.errorReason
      };
    });
    console.log('11. Status de progresso da transferência:', progress);

    // Navega para /downloads para verificar a visualização do usuário
    console.log('12. Navegando para página Meus Downloads (/downloads)...');
    await page.goto('http://localhost:4000/downloads', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const pageContent = await page.locator('body').innerText();
    const hasCoralineInDownloads = pageContent.includes('Coraline');
    console.log('13. Coraline aparece na página Meus Downloads?', hasCoralineInDownloads);

    // Se estiver em andamento, testa pausar
    const pauseBtn = page.locator('button[title="Pausar"]').first();
    if (await pauseBtn.isVisible()) {
      console.log('14. Testando botão de pausa na UI...');
      await pauseBtn.click();
      await page.waitForTimeout(1000);

      const statusAfterPause = await page.evaluate(() => {
        const db = (window as any).__zapitv_offlineDb;
        return db ? db.getAllDownloads()[0]?.status : null;
      });
      console.log('    Status após pausa:', statusAfterPause);

      // Testa retomar
      const resumeBtn = page.locator('button[title="Retomar"]').first();
      if (await resumeBtn.isVisible()) {
        console.log('15. Testando botão de retomar na UI...');
        await resumeBtn.click();
        await page.waitForTimeout(1000);

        const statusAfterResume = await page.evaluate(() => {
          const db = (window as any).__zapitv_offlineDb;
          return db ? db.getAllDownloads()[0]?.status : null;
        });
        console.log('    Status após retomada:', statusAfterResume);
      }
    }
  }

  await browser.close();
  console.log('=== TESTE DO CICLO COMPLETO CONCLUÍDO COM SUCESSO ===');
}

testDownloadLifecycle().catch(console.error);
