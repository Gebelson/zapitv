import { chromium } from 'playwright';

// External integration: run with WATCH_TEST_DURATION_SECONDS=900 for a 15 min session.
const base = process.env.WATCH_TEST_BASE_URL || 'http://localhost:4000';
const seconds = Math.max(30, Number(process.env.WATCH_TEST_DURATION_SECONDS || 90));
const itemId = process.env.WATCH_TEST_ITEM_ID || 'open-night-living-dead-1968';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required']
});
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const httpFailures: Record<string, number> = {};
  const pageErrors: string[] = [];
  page.on('response', response => {
    if (response.url().includes('/api/proxy') && response.status() >= 400) {
      const target = new URL(response.url()).searchParams.get('url');
      const host = target ? new URL(target).hostname : 'unknown';
      const key = `${response.status()}@${host}`;
      httpFailures[key] = (httpFailures[key] || 0) + 1;
    }
  });
  page.on('pageerror', error => pageErrors.push(error.message.slice(0, 120)));
  await page.goto(`${base}/tv/assistir/filme/${itemId}?tvdiag=1`, { waitUntil: 'domcontentloaded' });
  const video = page.locator('video[data-zapi-main-video]');
  await video.waitFor({ timeout: 40_000 });
  await page.evaluate(() => {
    const element = document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]')!;
    const events = { waiting: 0, stalled: 0, playing: 0, error: 0 };
    for (const name of Object.keys(events) as Array<keyof typeof events>) {
      element.addEventListener(name, () => { events[name]++; });
    }
    (window as any).__tvBufferEvents = events;
  });
  try {
    await page.waitForFunction(() => {
      const element = document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]');
      return element && element.currentTime > 1 && !element.paused;
    }, undefined, { timeout: 90_000 });
  } catch {
    const play = page.locator('[data-focus-key="tv-player-play"]');
    if (await play.count()) await play.click();
    await page.waitForFunction(() => {
      const element = document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]');
      return element && element.currentTime > 1 && !element.paused;
    }, undefined, { timeout: 30_000 });
  }
  const startedAt = await video.evaluate(element => (element as HTMLVideoElement).currentTime);
  await page.waitForTimeout(seconds * 1000);
  const result = await page.evaluate(() => {
    const element = document.querySelector<HTMLVideoElement>('video[data-zapi-main-video]')!;
    const frames = element.getVideoPlaybackQuality?.();
    return {
      currentTime: element.currentTime, readyState: element.readyState,
      sourceTransport: element.currentSrc.startsWith('blob:') ? 'hls.js'
        : element.currentSrc.includes('/api/proxy') ? 'proxy' : 'direct',
      videoWidth: element.videoWidth, videoHeight: element.videoHeight,
      droppedFrames: frames?.droppedVideoFrames ?? null,
      totalFrames: frames?.totalVideoFrames ?? null,
      events: (window as any).__tvBufferEvents,
      mediaError: element.error?.code ?? null
    };
  });
  console.log(JSON.stringify({ requestedSeconds: seconds, advancedSeconds: Math.round(result.currentTime - startedAt),
    httpFailures, pageErrors, ...result }));
  if (result.currentTime - startedAt < seconds * 0.8 || result.mediaError || pageErrors.length) {
    throw new Error('A reprodução prolongada não foi confirmada; consulte as métricas acima.');
  }
} finally {
  await browser.close();
}
