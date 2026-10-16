import { chromium } from 'playwright';

async function testGpu() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--no-sandbox'
    ]
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:4000');
  const gpuInfo = await page.evaluate(async () => {
    const hasNavGpu = Boolean(navigator.gpu);
    let adapterInfo = null;
    let deviceOk = false;
    if (hasNavGpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          adapterInfo = (adapter as any).info || { architecture: 'found' };
          const device = await adapter.requestDevice();
          deviceOk = Boolean(device);
        }
      } catch (e: any) {
        adapterInfo = { error: String(e) };
      }
    }
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const glVendor = gl ? gl.getParameter(gl.VENDOR) : 'none';
    const glRenderer = gl ? gl.getParameter(gl.RENDERER) : 'none';
    return {
      hasNavGpu,
      adapterInfo,
      deviceOk,
      webgl: Boolean(gl),
      glVendor,
      glRenderer
    };
  });
  
  console.log('GPU Test Results:', JSON.stringify(gpuInfo, null, 2));
  await browser.close();
}

testGpu().catch(err => {
  console.error('Test GPU Error:', err);
  process.exit(1);
});
