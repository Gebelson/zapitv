import { chromium } from 'playwright';

async function inspectCardDetails() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto('https://zapitv-kappa.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const cardDetails = await page.evaluate(() => {
    // Busca os primeiros 5 cards
    const cards = Array.from(document.querySelectorAll('.grid > div, [data-testid="content-card"]')).slice(0, 5);
    return cards.map(c => {
      const img = c.querySelector('img');
      const text = c.innerText;
      return {
        cardHtml: c.outerHTML.slice(0, 300),
        imgSrc: img?.src,
        imgNaturalWidth: img?.naturalWidth,
        imgComplete: img?.complete,
        innerText: text
      };
    });
  });

  console.log('Detalhes dos Cards na Home:', JSON.stringify(cardDetails, null, 2));

  // Inspeciona os Carrosséis (ContentRows)
  const rows = await page.evaluate(() => {
    const sectionHeaders = Array.from(document.querySelectorAll('h3, h2')).map(h => h.innerText);
    const rowCards = document.querySelectorAll('.overflow-x-auto').length;
    return { sectionHeaders, rowContainers: rowCards };
  });

  console.log('Seções encontradas:', JSON.stringify(rows, null, 2));

  await browser.close();
}

inspectCardDetails().catch(console.error);
