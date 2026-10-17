const { chromium } = require('playwright');

async function testPlayPath(urlPath = '/filmes/movie-a-odisseia-2026') {
  console.log(`Launching browser to test direct path: ${urlPath}...`);
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('[vite]') && !text.includes('React DevTools')) {
      console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]`, text);
    }
  });

  page.on('pageerror', err => {
    console.log('[BROWSER UNCAUGHT ERROR]', err.message);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });

  try {
    const fullUrl = `http://localhost:4000${urlPath}`;
    console.log(`Navigating to ${fullUrl}...`);
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Profile select if needed
    const profile = page.locator('text=Quem está assistindo?');
    if (await profile.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Clicking profile...');
      await page.locator('.cursor-pointer').first().click({ force: true });
      await page.waitForTimeout(2000);
    }

    // Wait for Assistir button
    console.log('Looking for "Assistir" button...');
    const playBtn = page.locator('button:has-text("Assistir")').first();
    await playBtn.waitFor({ state: 'visible', timeout: 8000 });
    console.log('Clicking "Assistir" button...');
    await playBtn.click({ force: true });

    // Monitor player state for 12 seconds
    console.log('Monitoring player status...');
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1000);
      const state = await page.evaluate(() => {
        const h2 = document.querySelector('h2');
        const p = document.querySelector('p');
        const video = document.querySelector('video');
        const alert = document.querySelector('.text-red-500');
        return {
          h2: h2 ? h2.textContent : '',
          p: p ? p.textContent : '',
          videoSrc: video ? (video.src ? video.src.substring(0, 80) : 'none') : 'none',
          videoPaused: video ? video.paused : null,
          hasError: Boolean(alert)
        };
      });
      console.log(`[T+${i + 1}s] H2: "${state.h2}" | P: "${state.p.substring(0, 60)}" | VideoSrc: ${state.videoSrc} | Error: ${state.hasError}`);
    }
  } catch (err) {
    console.error('Error during playback test:', err);
  } finally {
    await browser.close();
  }
}

testPlayPath(process.argv[2] || '/filmes/movie-a-odisseia-2026').catch(console.error);
