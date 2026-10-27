import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// External integration, opt-in. Only an existing official public channel is played.
async function run() {
  const browser = await chromium.launch({ headless: true });
  const evidence: Record<string, unknown> = { testedAt: new Date().toISOString() };
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript('window.__name = (target) => target;');
    await page.goto(`${process.env.P11_ORIGIN || 'http://localhost:4000'}/tests/harness/storage_integrity.html`);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.evaluate(async () => {
      const { CatalogDiscoveryService } = await import('/src/core/catalog/CatalogDiscoveryService.ts' as string);
      (window as any).p11Catalog = new CatalogDiscoveryService();
    });
    const catalog = [];
    for (const method of ['discoverMovies', 'discoverSeries', 'discoverAnimes']) {
      await context.setOffline(true);
      const offline = await page.evaluate(async method => {
        try { const r = await (window as any).p11Catalog[method](2); return { count: r.items.length, hasMore: r.hasMore, partial: !!r.isPartial }; }
        catch { return { error: 'temporary_discovery_failure' }; }
      }, method);
      await context.setOffline(false);
      const online = await page.evaluate(async method => {
        try { const r = await (window as any).p11Catalog[method](2); return { count: r.items.length, hasMore: r.hasMore, partial: !!r.isPartial }; }
        catch { return { error: 'discovery_failed_after_reconnect' }; }
      }, method);
      catalog.push({ method, offline, online });
    }
    evidence.catalog = catalog;
    await page.evaluate(async () => {
      const react = await import('/node_modules/.vite/deps/react.js' as string);
      const client = await import('/node_modules/.vite/deps/react-dom_client.js' as string);
      const { LiveTvPlayer } = await import('/src/components/livetv/LiveTvPlayer.tsx' as string);
      const { liveTvProviderRegistry } = await import('/src/core/livetv/LiveTVProviderRegistry.ts' as string);
      const channel = liveTvProviderRegistry.getChannelById('tv-camara');
      if (!channel?.isOfficial || channel.requiresExternalAccess) throw new Error('Official channel not eligible');
      const root = (client.createRoot || client.default.createRoot)(document.body.appendChild(document.createElement('div')));
      const events: object[] = [];
      const listener = (event: Event) => { if (event.target instanceof HTMLVideoElement) events.push({ type: event.type, at: performance.now(), time: event.target.currentTime }); };
      const types = ['waiting', 'stalled', 'playing', 'error'];
      types.forEach(type => document.addEventListener(type, listener, true));
      root.render((react.createElement || react.default.createElement)(LiveTvPlayer, { channel, initialMuted: true }));
      (window as any).p11Live = { events, cleanup: () => { root.unmount(); types.forEach(type => document.removeEventListener(type, listener, true)); } };
    });
    const sample = () => page.evaluate(() => {
      const v = document.querySelector('video');
      return { time: v?.currentTime ?? null, readyState: v?.readyState ?? null, error: v?.error?.code ?? null,
        frames: v?.getVideoPlaybackQuality?.().totalVideoFrames ?? null };
    });
    await page.waitForTimeout(20000);
    const initial = await sample();
    await context.setOffline(true);
    await page.waitForTimeout(35000);
    const offline = await sample();
    await context.setOffline(false);
    await page.waitForTimeout(30000);
    const reconnected = await sample();
    await page.waitForTimeout(16000);
    const final = await sample();
    const events = await page.evaluate(() => { const state = (window as any).p11Live; state.cleanup(); return state.events; });
    evidence.live = { channel: 'tv-camara', initial, offline, reconnected, final, events, audioAuditioned: false };
  } finally {
    evidence.completedAt = new Date().toISOString();
    writeFileSync('docs/p11-network-evidence.json', JSON.stringify(evidence, null, 2));
    await browser.close();
  }
}
run().catch(error => { console.error(error.name); process.exitCode = 1; });
