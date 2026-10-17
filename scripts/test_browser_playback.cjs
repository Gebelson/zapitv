const { chromium } = require('playwright');

async function testBrowser() {
  console.log('Launching browser to inspect real playback flow...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Capture all console messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
  });

  page.on('pageerror', err => {
    console.log('[BROWSER UNCAUGHT ERROR]', err.message);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`[RESPONSE ${res.status()}] ${res.url()}`);
    }
  });

  page.on('requestfailed', req => {
    console.log(`[REQUEST FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  try {
    console.log('Navigating to http://localhost:4000...');
    await page.goto('http://localhost:4000', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // If profile selection is visible, click the first profile
    const profile = page.locator('text=Quem está assistindo?');
    if (await profile.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Profile selector found, clicking first profile...');
      const profileCard = page.locator('.cursor-pointer').first();
      await profileCard.click({ force: true });
      await page.waitForTimeout(2000);
    }

    console.log('Clicking Assistir button via DOM...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Assistir'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    // Wait and observe what happens in player
    console.log('Observing player for 12 seconds...');
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1000);
      const text = await page.evaluate(() => {
        const h2 = document.querySelector('h2');
        const p = document.querySelector('p');
        return {
          h2: h2 ? h2.textContent : '',
          p: p ? p.textContent : ''
        };
      });
      if (text.h2 || text.p) {
        console.log(`[T+${i + 1}s] H2: "${text.h2}" | P: "${text.p}"`);
      }
    }
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

testBrowser().catch(console.error);
