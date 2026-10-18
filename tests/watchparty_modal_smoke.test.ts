import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.ZAPITV_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });

try {
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Filmes', exact: true }).click();
  await page.locator('[data-ui-sound-card]').first().click();
  await page.getByRole('button', { name: 'Grupo', exact: true }).click();

  await page.getByRole('heading', { name: 'Assistir Juntos' }).waitFor({ timeout: 15_000 });
  assert.equal(await page.getByRole('navigation').count(), 1, 'A navegação deve continuar montada');
  assert.deepEqual(pageErrors, [], `Exceções na página: ${pageErrors.join('; ')}`);

  await page.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await page.getByRole('button', { name: 'Grupo', exact: true }).waitFor();
  console.log('Abertura e fechamento de Grupo sem tela branca: OK');
} finally {
  await browser.close();
}
