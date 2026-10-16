import { chromium } from 'playwright';

async function inspectLocalStorage() {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:4000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const lsData = await page.evaluate(() => {
    const res: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      const val = localStorage.getItem(key)!;
      if (val.length < 500) {
        res[key] = val;
      } else {
        res[key] = `length: ${val.length}`;
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            res[key + '_sample'] = parsed.slice(0, 5).map((x: any) => x.title || x.name || x);
          }
        } catch {}
      }
    }
    return res;
  });

  console.log('LocalStorage:');
  console.log(JSON.stringify(lsData, null, 2));

  await browser.close();
}

inspectLocalStorage().catch(console.error);
