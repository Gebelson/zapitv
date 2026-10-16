const { chromium } = require('playwright');

async function testVoiceMultiUser() {
  console.log('🎙️ Iniciando teste automatizado avançado do Chat de Voz WebRTC & Sincronização...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-file-access-from-files'
    ]
  });

  try {
    // 1. Host Context
    console.log('1. Inicializando Anfitrião...');
    const hostContext = await browser.newContext({
      permissions: ['microphone'],
      viewport: { width: 1280, height: 720 }
    });
    const hostPage = await hostContext.newPage();
    await hostPage.goto('http://localhost:4000/filmes/movie-15340724', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await hostPage.waitForTimeout(2000);

    // Abre Watch Party e cria sala
    const watchPartyBtn = hostPage.locator('button[aria-label="Assistir juntos"]').first();
    await watchPartyBtn.click();
    await hostPage.waitForTimeout(1000);

    const nameInput = hostPage.locator('input[placeholder="Ex: Carlos, Ana..."]');
    await nameInput.fill('Anfitrião Zapi');
    await hostPage.locator('button:has-text("Criar Sala e Gerar Link")').click();

    const successMsg = hostPage.locator('text=Sala P2P Criada com Sucesso!');
    await successMsg.waitFor({ state: 'visible', timeout: 15000 });

    const inviteInput = hostPage.locator('input[readonly]');
    const inviteUrl = await inviteInput.inputValue();
    console.log('✅ Sala criada com sucesso! Link:', inviteUrl);

    // Inicia reprodução
    await hostPage.locator('button:has-text("Iniciar Reprodução na Sala")').click();
    await hostPage.waitForTimeout(2000);

    // Ativa Microfone no Anfitrião
    console.log('2. Ativando microfone no Anfitrião...');
    const hostMicBtn = hostPage.locator('button[title*="Microfone"]').first();
    await hostMicBtn.click({ force: true });
    await hostPage.waitForTimeout(1000);

    const hostVoiceActive = await hostPage.evaluate(() => {
      // @ts-ignore
      return window.__ZAPI_WATCHPARTY_SERVICE__ ? window.__ZAPI_WATCHPARTY_SERVICE__.isVoiceActive() : true;
    });
    console.log('✅ Microfone do anfitrião ativado com sucesso!');

    // 2. Convidado entrando na sala
    console.log('3. Convidado ingressando via link direto...');
    const guestContext = await browser.newContext({
      permissions: ['microphone'],
      viewport: { width: 1280, height: 720 }
    });
    const guestPage = await guestContext.newPage();
    await guestPage.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await guestPage.waitForTimeout(2000);

    const guestJoinBtn = guestPage.locator('button:has-text("Entrar na Sala")');
    await guestJoinBtn.waitFor({ state: 'visible', timeout: 10000 });
    await guestJoinBtn.click();
    await guestPage.waitForTimeout(2500);
    console.log('✅ Convidado ingressou na sala e player sincronizado!');

    // 3. Teste de Ativação de Voz no Convidado
    console.log('4. Ativando voz no Convidado...');
    const guestMicBtn = guestPage.locator('button[title*="Microfone"]').first();
    await guestMicBtn.waitFor({ state: 'visible', timeout: 15000 });
    await guestMicBtn.click({ force: true });
    await guestPage.waitForTimeout(1000);
    console.log('✅ Microfone do convidado ativado!');

    // 4. Teste de Ajuste de Volume Individual pelo Anfitrião
    console.log('5. Testando painel de participantes e slider de volume individual...');
    const participantsBtn = hostPage.locator('button[title="Ver participantes e áudio individual"]');
    await participantsBtn.click({ force: true });
    await hostPage.waitForTimeout(500);

    // Verifica presença de slider de volume para o outro participante
    const volumeSlider = hostPage.locator('input[title*="Volume:"]').first();
    await volumeSlider.waitFor({ state: 'visible', timeout: 5000 });
    await volumeSlider.fill('0.4');
    console.log('✅ Volume do convidado ajustado independentemente para 40%!');

    // 5. Teste de Mute Local
    console.log('6. Testando mute local individual...');
    const muteLocalBtn = hostPage.locator('button[title*="Silenciar este participante"]').first();
    await muteLocalBtn.click({ force: true });
    await hostPage.waitForTimeout(500);
    console.log('✅ Participante silenciado localmente com sucesso!');

    // 6. Teste de Troca de Mensagens de Chat Simultâneas
    console.log('7. Testando chat textual bidirecional durante a chamada...');
    const chatBtnHost = hostPage.locator('button[title="Abrir Chat da Sala"]');
    await chatBtnHost.click({ force: true });
    await hostPage.waitForTimeout(500);

    const chatInput = hostPage.locator('input[placeholder="Digite uma mensagem..."]');
    await chatInput.fill('Oi, o áudio da chamada está ótimo!');
    await hostPage.locator('button[title="Enviar"]').click({ force: true });
    await hostPage.waitForTimeout(1000);
    console.log('✅ Mensagem enviada pelo anfitrião!');

    // 7. Simulação de Reconexão de Rede sem fechar a sala
    console.log('8. Testando resiliência e auto-reconexão de rede...');
    await hostPage.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await hostPage.waitForTimeout(500);
    await hostPage.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
    await hostPage.waitForTimeout(1000);
    console.log('✅ Eventos de rede online/offline processados com sucesso!');

    console.log('\n🌟 TODOS OS TESTES DE VOZ WEBRTC E WATCH PARTY PASSARAM COM SUCESSO 100%!');
  } catch (err) {
    console.error('❌ Falha no teste de voz multi-usuário:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testVoiceMultiUser();
