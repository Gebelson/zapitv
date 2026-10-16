import { chromium } from 'playwright';

async function inspectIndexedDB() {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:4000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const dbData = await page.evaluate(async () => {
    // Open Dexie database ZapiTVDatabase directly
    return new Promise((resolve) => {
      const req = indexedDB.open('ZapiTVDatabase');
      req.onsuccess = (e: any) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains('content')) {
          return resolve({ error: 'no content store' });
        }
        const tx = idb.transaction('content', 'readonly');
        const store = tx.objectStore('content');
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          const items = getAllReq.result || [];
          const featured = items.filter((i: any) => i.isFeatured);
          const titles = items.map((i: any) => i.title);
          const matchesVerdade = items.filter((i: any) => 
            (i.title && i.title.toLowerCase().includes('verdade')) ||
            (i.title && i.title.toLowerCase().includes('oculta'))
          );
          resolve({
            totalItems: items.length,
            featuredCount: featured.length,
            featuredList: featured.map((f: any) => ({ id: f.id, title: f.title, order: f.order, heroTags: f.heroTags })),
            matchesVerdade
          });
        };
      };
      req.onerror = () => resolve({ error: 'cannot open db' });
    });
  });

  console.log('IndexedDB Data:');
  console.log(JSON.stringify(dbData, null, 2));

  await browser.close();
}

inspectIndexedDB().catch(console.error);
