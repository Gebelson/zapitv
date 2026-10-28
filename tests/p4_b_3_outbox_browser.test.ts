import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

async function run() {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
  const browser = await chromium.launch({ headless: true });
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== 'string');
    for (const tv of [false, true]) {
      const context = await browser.newContext(tv ? { userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Silk/119.3.2 Safari/537.36' } : {});
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        let writes = 0;
        await page.route('**/api/sync/**', route => {
          if (route.request().method() !== 'GET') writes++;
          return route.fulfill({ json: { profileId: 'profile_A', serverTime: Date.now(), progress: [], history: [], myList: [],
            favorites: [{ canonicalId: 'private-title-A', isRemoved: 1, updatedAt: Date.now() }] } });
        });
        await page.goto(`http://127.0.0.1:${address.port}/tests/harness/outbox_recovery.html${tv ? '?tv=1' : ''}`);
        const review = page.getByRole('button', { name: 'Revisar alterações' });
        await review.waitFor();
        if (tv) {
          await page.evaluate(() => (window as any).__setTvFocus('sync-recovery-review'));
          await page.keyboard.press('Enter');
        } else await review.click();
        await page.getByText('Conta: private-title-A · Removido', { exact: true }).waitFor();
        if (tv) await page.keyboard.press('Escape');
        else await page.getByRole('button', { name: 'Manter no dispositivo' }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await page.reload();
        await review.waitFor();
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zapitv_outbox_account_A_profile_A')!));
        assert.equal(saved[0].id, 'original-expired-uuid');
        await page.evaluate(() => (window as any).changeRecoveryAccount('account_B'));
        await page.getByRole('complementary', { name: 'Recuperação de sincronização' }).waitFor({ state: 'hidden' });
        assert.equal(await page.getByText('private-title-A').count(), 0);
        await page.evaluate(() => (window as any).changeRecoveryAccount('account_A'));
        await review.waitFor();
        assert.equal(writes, 0, 'review/preservation never sends mutations');
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    console.log('Outbox browser: notice, read-only comparison, preserve, F5, account isolation and TV Enter/Back passed.');
  } finally { await browser.close(); await server.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
