import { chromium } from 'playwright';

async function testSeekingPtBrBrowser() {
  console.log('🚀 Iniciando teste end-to-end em navegador real (Playwright)...');
  console.log('🎯 Objetivo: Testar avanço e retrocesso na timeline (50%, 75%, 90%) sem falso aviso de dublagem indisponível');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox']
  }).catch(() => chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox']
  }));

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const logs: string[] = [];
  const errors: string[] = [];
  let nonDubbedPromptDetected = false;

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
    } else if (text.includes('[Zapi') || text.includes('Seek') || text.includes('audio') || text.includes('Audio')) {
      logs.push(text);
      console.log('  [Player Log]:', text);
    }
    if (text.includes('Dublagem indisponível') || text.includes('Conteúdo indisponível no seu idioma')) {
      nonDubbedPromptDetected = true;
      console.error('❌ ALERTA: Aviso de dublagem detectado no console:', text);
    }
  });

  try {
    console.log('1. Acessando http://localhost:4000/ ...');
    await page.goto('http://localhost:4000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('2. Clicando no botão "Assistir" do Hero banner...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Assistir'));
      if (btn) btn.click();
    });

    console.log('3. Aguardando inicialização do player e carregamento de metadados...');
    await page.waitForTimeout(4000);

    // Verifica se elemento de vídeo está presente
    const videoLocator = page.locator('video');
    await videoLocator.waitFor({ state: 'attached', timeout: 15000 });

    const initialStatus = await page.evaluate(() => {
      const v = document.querySelector('video') as HTMLVideoElement | null;
      const text = document.body.innerText || '';
      const promptVisible = text.includes('Dublagem indisponível') || text.includes('Conteúdo indisponível no seu idioma');
      return {
        currentTime: v?.currentTime || 0,
        duration: v?.duration || 0,
        paused: v?.paused,
        promptVisible
      };
    });

    console.log('📊 Status Inicial:', initialStatus);
    if (initialStatus.promptVisible) {
      throw new Error('Falha: Prompt de dublagem indisponível já estava visível no início.');
    }

    // Aguarda duração válida (> 0)
    let dur = initialStatus.duration;
    for (let i = 0; i < 10 && (isNaN(dur) || dur <= 0); i++) {
      await page.waitForTimeout(1000);
      dur = await page.evaluate(() => {
        const v = document.querySelector('video') as HTMLVideoElement | null;
        return v?.duration || 0;
      });
    }

    const testDuration = dur > 0 ? dur : 100;
    console.log(`⏱ Duração do conteúdo: ${testDuration}s`);

    const seekPositions = [
      { label: '50%', target: Math.round(testDuration * 0.5) },
      { label: '75%', target: Math.round(testDuration * 0.75) },
      { label: '90%', target: Math.round(testDuration * 0.9) },
      { label: 'Retorno para 25%', target: Math.round(testDuration * 0.25) }
    ];

    for (const step of seekPositions) {
      console.log(`\n⏩ Executando Seek para ${step.label} (${step.target}s)...`);

      // Realiza o seek através do input slider ou API do player
      await page.evaluate((targetSec) => {
        const slider = document.querySelector('input[type="range"][max]') as HTMLInputElement | null;
        if (slider) {
          slider.value = String(targetSec);
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          slider.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const v = document.querySelector('video') as HTMLVideoElement | null;
          if (v) v.currentTime = targetSec;
        }
      }, step.target);

      // Aguarda 1.5s para simular buffering e carregamento de chunks na nova posição
      await page.waitForTimeout(1500);

      // Inspeciona DOM para checar integridade
      const stepCheck = await page.evaluate(() => {
        const v = document.querySelector('video') as HTMLVideoElement | null;
        const text = document.body.innerText || '';
        const hasPrompt = text.includes('Dublagem indisponível') || text.includes('Conteúdo indisponível no seu idioma');
        const hasError = text.includes('Fonte Indisponível') || text.includes('Não foi possível reproduzir');
        return {
          currentTime: v?.currentTime || 0,
          paused: v?.paused,
          readyState: v?.readyState,
          hasPrompt,
          hasError
        };
      });

      console.log(`  -> Estado após seek para ${step.label}:`, stepCheck);

      if (stepCheck.hasPrompt) {
        throw new Error(`FALHA CRÍTICA: Falso aviso de dublagem indisponível apareceu após seek para ${step.label}!`);
      }
      if (stepCheck.hasError) {
        throw new Error(`FALHA CRÍTICA: Erro de reprodução apareceu após seek para ${step.label}!`);
      }
    }

    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO: Todos os seeks foram executados sem perda de idioma ou falsos avisos!');
  } finally {
    await browser.close();
  }
}

testSeekingPtBrBrowser().catch(err => {
  console.error('❌ Teste falhou:', err);
  process.exit(1);
});
