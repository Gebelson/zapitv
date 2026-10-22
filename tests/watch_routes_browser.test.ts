import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.WATCH_TEST_BASE_URL || 'http://localhost:4000';
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const scenario of [
      { path: '/assistir/filme/movie-digger-2026', title: 'Digger', viewport: { width: 1440, height: 900 } },
      { path: '/assistir/serie/series-ted-lasso/t/1/e/2', title: 'Ted Lasso', viewport: { width: 390, height: 844 } },
      { path: '/tv/assistir/anime/tmdb-65733/t/1/e/1', title: 'Doraemon: O Gato do Futuro', viewport: { width: 1920, height: 1080 } },
    ]) {
      const page = await browser.newPage({ viewport: scenario.viewport });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + scenario.path, { waitUntil: 'domcontentloaded' });
      await page.locator('.zapi-watch-surface').waitFor({ timeout: 20000 });
      await page.getByText(scenario.title, { exact: true }).first().waitFor({ timeout: 20000 });
      assert.equal(new URL(page.url()).pathname, scenario.path);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.zapi-watch-surface').waitFor({ timeout: 20000 });
      await page.getByText(scenario.title, { exact: true }).first().waitFor({ timeout: 20000 });
      assert.equal(new URL(page.url()).pathname, scenario.path);
      assert.deepEqual(errors, [], `Erros de página em ${scenario.path}`);
      if (scenario.path.startsWith('/tv/')) {
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForURL(base + '/tv', { timeout: 10000 });
        await page.getByRole('heading', { name: scenario.title }).waitFor({ timeout: 10000 });
      }
      await page.close();
    }
    console.log('Acesso direto e atualização de filme, série mobile e anime TV: OK');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
