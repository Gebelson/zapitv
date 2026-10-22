import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.WATCH_TEST_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});

try {
  for (const path of ['/tv', '/tv/busca', '/tv/filmes']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.clock.install();
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-focus-key]').first().waitFor();
    await page.waitForTimeout(500);
    const focusBefore = await page.evaluate(() => document.activeElement?.getAttribute('data-focus-key'));
    await page.clock.fastForward(300_100);
    await page.locator('[data-tv-screensaver]').waitFor({ timeout: 5000 });
    if (path === '/tv') {
      await page.locator('[data-tv-screensaver] h1').waitFor({ timeout: 10000 });
      const firstTitle = await page.locator('[data-tv-screensaver] h1').textContent();
      await page.clock.fastForward(15_100);
      await page.waitForTimeout(100);
      assert.notEqual(await page.locator('[data-tv-screensaver] h1').textContent(), firstTitle);
      assert.ok(await page.locator('[data-tv-screensaver] img').count() <= 3);
    }
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-tv-screensaver]').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-focus-key')), focusBefore);
    await page.clock.fastForward(300_100);
    await page.locator('[data-tv-screensaver]').waitFor({ timeout: 5000 });
    await page.close();
  }

  const details = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await details.clock.install();
  await details.goto(base + '/tv', { waitUntil: 'domcontentloaded' });
  await details.locator('[data-focus-key="tv-hero-details"]').click();
  await details.locator('[class*="z-[200]"]').first().waitFor();
  await details.clock.fastForward(300_100);
  await details.locator('[data-tv-screensaver]').waitFor();
  await details.keyboard.press('Escape');
  assert.equal(await details.locator('[data-tv-screensaver]').count(), 0);
  assert.ok(await details.locator('[class*="z-[200]"]').count() > 0);
  await details.close();

  const pointer = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pointer.clock.install();
  await pointer.goto(base + '/tv', { waitUntil: 'domcontentloaded' });
  const playButton = pointer.locator('[data-focus-key="tv-hero-play"]');
  await playButton.waitFor();
  const playBounds = await playButton.boundingBox();
  assert.ok(playBounds);
  await pointer.clock.fastForward(300_100);
  await pointer.locator('[data-tv-screensaver]').waitFor();
  await pointer.mouse.click(playBounds.x + playBounds.width / 2, playBounds.y + playBounds.height / 2);
  assert.equal(await pointer.locator('[data-tv-screensaver]').count(), 0);
  assert.equal(new URL(pointer.url()).pathname, '/tv');
  await pointer.close();

  const player = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await player.clock.install();
  await player.goto(base + '/tv/assistir/anime/tmdb-65733/t/1/e/1', { waitUntil: 'domcontentloaded' });
  await player.locator('.zapi-watch-surface').waitFor({ timeout: 20000 });
  await player.clock.fastForward(300_100);
  assert.equal(await player.locator('[data-tv-screensaver]').count(), 0);
  await player.close();

  console.log('Descanso de tela TV: Home, busca, categoria, detalhes, troca, despertar, foco e player OK');
} finally {
  await browser.close();
}
