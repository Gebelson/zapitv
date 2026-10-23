import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import path from 'node:path';

const base = process.env.WATCH_TEST_BASE_URL || 'http://localhost:4000';
const artifactDir = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});

try {
  console.log('--- Iniciando Captura Visual do Redesign do Player Smart TV ---');

  // 1. 1920x1080: Controles Visíveis (Filme)
  const page1080 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page1080.goto(`${base}/tv/assistir/filme/open-tears-of-steel`, { waitUntil: 'domcontentloaded' });
  await page1080.locator('[data-focus-key="tv-player-play"]').waitFor({ timeout: 20000 });
  await page1080.waitForTimeout(1000);

  // Verifica que o painel de diagnóstico NÃO está visível
  assert.equal(await page1080.locator('text=ZapiTV Smart TV Diagnostic').count(), 0);
  assert.equal(await page1080.locator('[data-focus-key="tv-diag-toggle"]').count(), 0);

  // Screenshot 1: Controles Visíveis 1080p
  await page1080.screenshot({ path: path.join(artifactDir, 'tv_player_controls_1080p.png') });
  console.log('✓ Screenshot 1: tv_player_controls_1080p.png');

  // 2. Abre Drawer de Áudio e Legendas
  await page1080.locator('[data-focus-key="tv-player-audio"]').click();
  await page1080.getByRole('heading', { name: 'Áudio e Legendas', exact: true }).waitFor({ timeout: 5000 });
  await page1080.waitForTimeout(500);

  // Screenshot 2: Drawer Áudio e Legendas
  await page1080.screenshot({ path: path.join(artifactDir, 'tv_player_drawer_audio_subtitles_1080p.png') });
  console.log('✓ Screenshot 2: tv_player_drawer_audio_subtitles_1080p.png');

  // Fecha o drawer com Escape
  await page1080.keyboard.press('Escape');
  await page1080.waitForTimeout(400);

  // 3. Abre Drawer de Mais Opções
  await page1080.locator('[data-focus-key="tv-player-settings"]').click();
  await page1080.getByRole('heading', { name: 'Opções', exact: true }).waitFor({ timeout: 5000 });
  await page1080.waitForTimeout(500);

  // Screenshot 3: Drawer Opções
  await page1080.screenshot({ path: path.join(artifactDir, 'tv_player_drawer_options_1080p.png') });
  console.log('✓ Screenshot 3: tv_player_drawer_options_1080p.png');

  await page1080.keyboard.press('Escape');
  await page1080.close();

  // 4. 1920x1080: Série com Drawer de Episódios
  const seriesPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await seriesPage.goto(`${base}/tv/assistir/serie/series-mayor-kingstown/t/2/e/3`, { waitUntil: 'domcontentloaded' });
  await seriesPage.locator('[data-focus-key="tv-player-play"]').waitFor({ timeout: 20000 });
  await seriesPage.waitForTimeout(1000);

  // Abre drawer de episódios
  if (await seriesPage.locator('[data-focus-key="tv-player-episodes"]').count() > 0) {
    await seriesPage.locator('[data-focus-key="tv-player-episodes"]').click();
    await seriesPage.getByRole('heading', { name: 'Episódios', exact: true }).waitFor({ timeout: 5000 });
    await seriesPage.waitForTimeout(500);
    await seriesPage.screenshot({ path: path.join(artifactDir, 'tv_player_drawer_episodes_1080p.png') });
    console.log('✓ Screenshot 4: tv_player_drawer_episodes_1080p.png');
    await seriesPage.keyboard.press('Escape');
  }
  await seriesPage.close();

  // 5. 1280x720: Resolução HD Adaptativa
  const page720 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page720.goto(`${base}/tv/assistir/filme/open-tears-of-steel`, { waitUntil: 'domcontentloaded' });
  await page720.locator('[data-focus-key="tv-player-play"]').waitFor({ timeout: 20000 });
  await page720.waitForTimeout(800);
  await page720.screenshot({ path: path.join(artifactDir, 'tv_player_controls_720p.png') });
  console.log('✓ Screenshot 5: tv_player_controls_720p.png');
  await page720.close();

  console.log('--- Todas as 5 Capturas Visuais do Player Foram Realizadas com Sucesso! ---');
} finally {
  await browser.close();
}
