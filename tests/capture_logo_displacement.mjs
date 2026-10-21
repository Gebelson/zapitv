import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.goto('http://localhost:4173/tv', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Captura do contêiner da logo
  const logoElem = await page.$('header > div:first-child');
  if (logoElem) {
    const outLogo = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_logo_text_adjusted.png';
    await logoElem.screenshot({ path: outLogo });
    console.log('✓ Logo capturada com sucesso:', outLogo);
  }

  const headerElem = await page.$('header');
  if (headerElem) {
    const outHeader = 'C:/Users/gebel/.gemini/antigravity/brain/8cfcb7f3-0115-429d-ad15-6044fcc95e4d/tv_header_nav_crop.png';
    await headerElem.screenshot({ path: outHeader });
    console.log('✓ Header atualizado capturado:', outHeader);
  }

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
