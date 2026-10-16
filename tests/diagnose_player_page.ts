import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('[Console]:', msg.text()));
  page.on('pageerror', err => console.log('[PageError]:', err.message));
  page.on('response', res => {
    if (res.status() >= 400) console.log('HTTP ' + res.status() + ': ' + res.url());
  });
  console.log('Indo para /dev/player-test...');
  await page.goto('http://localhost:4000/dev/player-test');
  await page.waitForTimeout(3000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Body Text:', text.slice(0, 300));
  await browser.close();
}

test().catch(console.error);
