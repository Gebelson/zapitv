import { chromium } from 'playwright';
import path from 'node:path';

const base = process.env.WATCH_TEST_BASE_URL || 'http://localhost:4000';
const artifactDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});

try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${base}/tv/assistir/serie/series-mayor-kingstown/t/2/e/3`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-focus-key="tv-player-play"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);

  // Se o botão de episódios existir, clica nele
  const hasEpisodesBtn = await page.locator('[data-focus-key="tv-player-episodes"]').count();
  console.log('hasEpisodesBtn:', hasEpisodesBtn);
  if (hasEpisodesBtn > 0) {
    await page.locator('[data-focus-key="tv-player-episodes"]').click();
    await page.getByRole('heading', { name: 'Episódios', exact: true }).waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, 'tv_player_drawer_episodes_1080p.png') });
    console.log('✓ Capturado: tv_player_drawer_episodes_1080p.png');
  } else {
    // Também tira screenshot da tela da série
    await page.screenshot({ path: path.join(artifactDir, 'tv_player_series_controls_1080p.png') });
    console.log('✓ Capturado: tv_player_series_controls_1080p.png');
  }
  await page.close();
} finally {
  await browser.close();
}
