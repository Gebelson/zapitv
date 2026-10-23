import { chromium } from 'playwright';

// Controlled transport test with a public-domain movie; does not replace the TV player test.
const base = process.env.WATCH_TEST_BASE_URL || 'http://localhost:4000';
const seconds = Math.max(30, Number(process.env.WATCH_TEST_DURATION_SECONDS || 90));
const source = 'https://upload.wikimedia.org/wikipedia/commons/2/24/Night_of_the_Living_Dead_%281968%29.webm';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required']
});
try {
  const page = await browser.newPage();
  let partialResponses = 0;
  let failedResponses = 0;
  const failedRanges: string[] = [];
  page.on('response', response => {
    if (!response.url().includes('/api/proxy')) return;
    if (response.status() === 206) partialResponses++;
    if (response.status() >= 400) {
      failedResponses++;
      failedRanges.push(`${response.status()}:${response.request().headers()['range'] || 'none'}`);
    }
  });
  await page.goto(`${base}/api/health`);
  await page.setContent('<video id="test" playsinline></video>');
  await page.evaluate(url => {
    const video = document.querySelector<HTMLVideoElement>('#test')!;
    video.src = url;
    (window as any).__events = { waiting: 0, stalled: 0, error: 0 };
    for (const name of ['waiting', 'stalled', 'error'] as const) {
      video.addEventListener(name, () => { (window as any).__events[name]++; });
    }
    void video.play();
  }, `${base}/api/proxy?url=${encodeURIComponent(source)}`);
  await page.waitForFunction(() => document.querySelector<HTMLVideoElement>('#test')!.currentTime > 1, undefined, { timeout: 60_000 });
  const start = await page.locator('#test').evaluate(node => (node as HTMLVideoElement).currentTime);
  await page.waitForTimeout(seconds * 1000);
  const result = await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>('#test')!;
    return { currentTime: video.currentTime, readyState: video.readyState,
      mediaError: video.error?.code ?? null, events: (window as any).__events };
  });
  const advancedSeconds = Math.round(result.currentTime - start);
  console.log(JSON.stringify({ requestedSeconds: seconds, advancedSeconds, partialResponses,
    failedResponses, failedRanges, ...result }));
  if (advancedSeconds < seconds * 0.8 || result.mediaError || partialResponses < 2 || failedResponses) {
    throw new Error('Transporte progressivo pelo proxy não foi confirmado.');
  }
} finally {
  await browser.close();
}
