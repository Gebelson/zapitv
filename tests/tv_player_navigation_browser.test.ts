import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Integração opcional com catálogo e provedores reais; não faz parte do CI determinístico.
const base = process.env.WATCH_TEST_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});

try {
  const player = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await player.goto(`${base}/tv/assistir/filme/open-tears-of-steel`, { waitUntil: 'domcontentloaded' });
  await player.locator('[data-focus-key="tv-player-play"]').waitFor({ timeout: 20000 });
  assert.equal(await player.locator('video[data-zapi-main-video]').count(), 1);
  assert.equal(await player.locator('[data-focus-key="tv-player-audio"]').count(), 1);
  for (let i = 0; i < 12; i++) {
    if (await player.locator('[data-focus-key="tv-player-settings"][data-tv-focused="true"]').count()) break;
    await player.keyboard.press('ArrowRight');
  }
  assert.equal(await player.locator('[data-focus-key="tv-player-settings"][data-tv-focused="true"]').count(), 1);
  await player.keyboard.press('Enter');
  await player.getByRole('heading', { name: 'Opções', exact: true }).waitFor();
  await player.keyboard.press('Escape');
  assert.equal(await player.getByRole('heading', { name: 'Opções', exact: true }).count(), 0);
  await player.keyboard.press('Escape');
  await player.keyboard.press('Escape');
  await player.waitForURL(`${base}/tv`);
  await player.getByRole('heading', { name: 'Lágrimas de Aço' }).waitFor();
  await player.close();

  const series = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const pageErrors: string[] = [];
  series.on('pageerror', error => pageErrors.push(error.message));
  await series.goto(`${base}/tv/assistir/serie/series-mayor-kingstown/t/2/e/3`, { waitUntil: 'domcontentloaded' });
  await series.locator('[data-focus-key="tv-player-play"]').waitFor({ timeout: 20000 });
  await series.keyboard.press('Escape');
  await series.keyboard.press('Escape');
  await series.waitForFunction(() => Array.from(document.querySelectorAll('h3')).some(el => el.textContent?.includes('Episódios da Temporada 2')), undefined, { timeout: 20000 });
  await series.locator('[data-focus-key="tv-details-episode-2-3"][data-tv-focused="true"]').waitFor();
  await series.keyboard.press('ArrowUp');
  await series.locator('[data-focus-key="tv-details-season-2"][data-tv-focused="true"]').waitFor();
  await series.keyboard.press('ArrowRight');
  await series.locator('[data-focus-key="tv-details-season-3"][data-tv-focused="true"]').waitFor();
  await series.keyboard.press('Enter');
  await series.locator('[data-focus-key="tv-details-episode-3-1"][data-tv-focused="true"]').waitFor();
  await series.keyboard.press('ArrowRight');
  await series.keyboard.press('Enter');
  await series.waitForURL(`${base}/tv/assistir/serie/series-mayor-kingstown/t/3/e/2`);
  await series.locator('[data-focus-key="tv-player-play"]').waitFor({ timeout: 20000 });
  await series.keyboard.press('Escape');
  await series.keyboard.press('Escape');
  await series.waitForURL(`${base}/tv`);
  await series.waitForFunction(() => Array.from(document.querySelectorAll('h3')).some(el => el.textContent?.includes('Episódios da Temporada 3')), undefined, { timeout: 20000 });
  await series.locator('[data-focus-key="tv-details-episode-3-2"][data-tv-focused="true"]').waitFor();
  await series.keyboard.press('ArrowDown');
  await series.locator('[data-focus-key="row-related-titles"][data-tv-focused="true"]').waitFor();
  await series.keyboard.press('Enter');
  await series.locator('[data-focus-key="tv-details-play"][data-tv-focused="true"]').waitFor();
  assert.notEqual(await series.locator('h1').last().textContent(), 'O Dono de Kingstown');
  await series.keyboard.press('ArrowRight');
  await series.locator('[data-focus-key="tv-details-list"][data-tv-focused="true"]').waitFor();
  await series.keyboard.press('Enter');
  await series.keyboard.press('ArrowRight');
  await series.locator('[data-focus-key="tv-details-fav"][data-tv-focused="true"]').waitFor();
  await series.keyboard.press('Enter');
  assert.deepEqual(pageErrors, []);
  await series.close();

  console.log('TV: menus, Back, temporada, episódio exato e títulos semelhantes por teclado OK');
} finally {
  await browser.close();
}
