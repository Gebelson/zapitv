import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.WATCH_TEST_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});

try {
  const cases = [
    '/tv/assistir/filme/zapitv-does-not-exist',
    '/tv/assistir/filme/tmdb-65733',
    '/tv/assistir/filme'
  ];

  for (const path of cases) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    for (const action of ['Enter', 'Escape', 'click']) {
      await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      const button = page.locator('[data-focus-key="tv-error-back"]');
      await button.waitFor({ timeout: 15000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await button.waitFor({ timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('[data-focus-key="tv-error-back"]')?.className.includes('ring-2'));

      if (action === 'click') await button.click();
      else await page.keyboard.press(action);

      await page.waitForURL(url => url.pathname === '/tv');
      await page.locator('[data-focus-key="tv-nav-home"]').waitFor();
      assert.equal(await page.locator('[data-focus-key="tv-error-back"]').count(), 0);
    }
    await page.close();
  }
  console.log('Erro de reprodução TV: foco, Enter, Voltar, clique e atualização OK');
} finally {
  await browser.close();
}
