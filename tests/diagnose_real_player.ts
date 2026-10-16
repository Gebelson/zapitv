import { chromium } from 'playwright';

async function diagnoseRealPlayer() {
  console.log('🚀 Iniciando diagnóstico real da reprodução do player...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox']
  }).catch(() => chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox']
  }));

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  const logs: string[] = [];
  const errors: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log('🔴 [Console Error]:', text);
      errors.push(text);
    } else if (text.includes('[Zapi') || text.includes('Stream') || text.includes('Source') || text.includes('audio') || text.includes('Audio') || text.includes('dub')) {
      console.log('ℹ️ [Player Log]:', text);
      logs.push(text);
    }
  });

  page.on('pageerror', err => {
    console.log('💥 [PAGE CRASH/ERROR]:', err.message);
    console.log('Stack:', err.stack);
    errors.push(err.message);
  });

  console.log('1. Acessando a página inicial...');
  await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  console.log('2. Clicando no botão "Assistir" do Hero banner...');
  const watchButton = page.locator('button:has-text("Assistir")').first();
  await watchButton.waitFor({ state: 'visible', timeout: 10000 });
  await watchButton.click();

  console.log('3. Aguardando resolução e início do player...');
  await page.waitForTimeout(4000);

  // Inspeciona estado do DOM
  const playerState = await page.evaluate(() => {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    const errorMsg = document.querySelector('h3:has-text("Fonte Indisponível"), h3:has-text("Não foi possível reproduzir"), h3:has-text("Conteúdo indisponível no seu idioma")')?.textContent;
    const promptNonDubbed = document.querySelector('div:has-text("Conteúdo indisponível no seu idioma")') !== null;
    const bodyText = document.body.innerText;
    return {
      hasVideo: Boolean(video),
      videoSrc: video?.src || video?.currentSrc || null,
      videoPaused: video?.paused,
      videoReadyState: video?.readyState,
      videoCurrentTime: video?.currentTime,
      videoDuration: video?.duration,
      videoError: video?.error ? { code: video.error.code, message: video.error.message } : null,
      promptNonDubbed,
      errorMsg,
      hasErrorMessage: bodyText.includes('Não foi possível reproduzir') || bodyText.includes('Fonte Indisponível')
    };
  });

  console.log('4. Estado do Player no DOM:', JSON.stringify(playerState, null, 2));

  // Aguarda mais 5 segundos para observar reprodução ou timeouts
  await page.waitForTimeout(5000);

  const finalState = await page.evaluate(() => {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    const errorEl = document.querySelector('h3:has-text("Fonte Indisponível"), h3:has-text("Não foi possível reproduzir"), h3:has-text("Conteúdo indisponível no seu idioma")');
    return {
      hasVideo: Boolean(video),
      videoSrc: video?.src || video?.currentSrc || null,
      videoPaused: video?.paused,
      videoReadyState: video?.readyState,
      videoCurrentTime: video?.currentTime,
      videoDuration: video?.duration,
      errorDetected: errorEl?.textContent || null
    };
  });
  console.log('5. Estado final após 9 segundos:', JSON.stringify(finalState, null, 2));

  console.log('\n--- Resumo de Erros Capturados ---');
  console.log('Total de erros:', errors.length);
  errors.forEach((e, i) => console.log(`  [${i}]: ${e}`));

  await browser.close();
}

diagnoseRealPlayer().catch(console.error);
