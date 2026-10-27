import assert from 'node:assert/strict';
import { heroImageService } from '../src/core/catalog/heroImageService';

const images: FakeImage[] = [];
class FakeImage {
  onload: (() => void | Promise<void>) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1920;
  naturalHeight = 1080;
  src = '';
  constructor() { images.push(this); }
  decode() { return Promise.resolve(); }
  removeAttribute() { this.src = ''; }
}
async function run() {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
  try {
    const url = 'https://image.tmdb.org/t/p/original/p1-abort.jpg';
    const controller = new AbortController();
    const cancelled = heroImageService.validateAndPreloadImage(url, 1000, controller.signal);
    controller.abort();
    assert.equal(await cancelled, false);
    assert.equal(heroImageService.isUrlFailed(url), false, 'navigation cancellation cannot blacklist a valid banner for ten minutes');
    assert.equal(images[0].src, '', 'cancelled image request is released');
    assert.equal(images[0].onload, null);
    const retry = heroImageService.validateAndPreloadImage(url, 1000);
    await images[1].onload?.();
    assert.equal(await retry, true);
    assert.equal(heroImageService.isUrlFailed(url), false);
    const badUrl = 'https://image.tmdb.org/t/p/original/p1-timeout.jpg';
    assert.equal(await heroImageService.validateAndPreloadImage(badUrl, 5), false);
    assert.equal(heroImageService.isUrlFailed(badUrl), true, 'real timeout remains a load failure');
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (oldImage) Object.defineProperty(globalThis, 'Image', oldImage); else Reflect.deleteProperty(globalThis, 'Image');
  }
  console.log('P1 images: cancellation, cleanup, retry and actual timeout passed');
}
run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
