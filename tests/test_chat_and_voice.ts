import { chromium } from 'playwright';

async function testChatAndVoice() {
  console.log('================================================================');
  console.log('TESTE COMPLETO DE VERIFICAÇÃO: CHAT BIDIRECIONAL E VOICE CHAT');
  console.log('================================================================');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  try {
    const hostContext = await browser.newContext({ permissions: ['microphone'] });
    const guestContext = await browser.newContext({ permissions: ['microphone'] });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    hostPage.on('console', msg => {
      const txt = msg.text();
      if (txt.includes('WatchParty') || txt.includes('Trystero')) {
        console.log(`[HOST]: ${txt}`);
      }
    });
    guestPage.on('console', msg => {
      const txt = msg.text();
      if (txt.includes('WatchParty') || txt.includes('Trystero')) {
        console.log(`[GUEST]: ${txt}`);
      }
    });

    console.log('\n1. Carregando páginas no localhost:4000...');
    await hostPage.goto('http://localhost:4000', { waitUntil: 'domcontentloaded' });
    await guestPage.goto('http://localhost:4000', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForTimeout(1000);

    console.log('\n2. Host criando sala com mídia "Michael" e usuário "Gebelson"...');
    const roomId = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService;
      return await s.createRoom(
        { id: 'michael-test', title: 'Michael', type: 'movie' } as any,
        'Gebelson',
        undefined,
        'host_broadcast'
      );
    });

    console.log(`Sala criada com sucesso: ${roomId}`);

    console.log('\n3. Convidado entrando na sala como "Zapi Amigo"...');
    await guestPage.evaluate(async (rid) => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService;
      await s.joinRoom(rid, 'Zapi Amigo');
    }, roomId);

    console.log('\n4. Aguardando sincronização e estabelecimento dos canais...');
    let connected = false;
    for (let i = 0; i < 10; i++) {
      await hostPage.waitForTimeout(1000);
      const hostCount = await hostPage.evaluate(async () => {
        const mod = await import('/src/core/watchparty/WatchPartyService.ts');
        return mod.watchPartyService.getParticipantList().length;
      });
      const guestCount = await guestPage.evaluate(async () => {
        const mod = await import('/src/core/watchparty/WatchPartyService.ts');
        return mod.watchPartyService.getParticipantList().length;
      });
      if (hostCount >= 2 && guestCount >= 2) {
        connected = true;
        console.log(`Participantes conectados: Host vê ${hostCount}, Convidado vê ${guestCount}`);
        break;
      }
    }

    if (!connected) {
      throw new Error('Falha: Participantes não sincronizaram presença em 10 segundos.');
    }

    // ------------------------------------------------------------------
    // TESTE 1: ENVIO DE CHAT HOST -> GUEST
    // ------------------------------------------------------------------
    console.log('\n--- TESTE 1: Chat Host -> Convidado ---');
    await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      mod.watchPartyService.sendChatMessage('Olá do Anfitrião Gebelson!');
    });

    await hostPage.waitForTimeout(1000);

    const guestMessages1 = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return mod.watchPartyService.getChatHistory();
    });
    console.log('Mensagens no Convidado:', guestMessages1.map(m => `[${m.senderNickname} (${m.isHost ? 'Host' : 'Guest'})]: ${m.text}`));

    const hostMsgReceived = guestMessages1.some(m => m.text.includes('Olá do Anfitrião Gebelson!') && m.isHost === true);
    if (!hostMsgReceived) {
      throw new Error('Falha no Teste 1: Convidado não recebeu a mensagem enviada pelo Host!');
    }
    console.log('✓ TESTE 1 PASSOU: Convidado recebeu a mensagem do Host com badge de Host correto.');

    // ------------------------------------------------------------------
    // TESTE 2: ENVIO DE CHAT GUEST -> HOST
    // ------------------------------------------------------------------
    console.log('\n--- TESTE 2: Chat Convidado -> Host ---');
    await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      mod.watchPartyService.sendChatMessage('Estou ouvindo perfeitamente, Gebelson!');
    });

    await hostPage.waitForTimeout(1000);

    const hostMessages2 = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return mod.watchPartyService.getChatHistory();
    });
    console.log('Mensagens no Host:', hostMessages2.map(m => `[${m.senderNickname} (${m.isHost ? 'Host' : 'Guest'})]: ${m.text}`));

    const guestMsgReceived = hostMessages2.some(m => m.text.includes('Estou ouvindo perfeitamente, Gebelson!') && m.isHost === false);
    if (!guestMsgReceived) {
      throw new Error('Falha no Teste 2: Host não recebeu a mensagem enviada pelo Convidado!');
    }
    console.log('✓ TESTE 2 PASSOU: Host recebeu a mensagem do Convidado com identificação correta.');

    // ------------------------------------------------------------------
    // TESTE 3: DEDUPLICAÇÃO E RESILIÊNCIA DE CHAT
    // ------------------------------------------------------------------
    console.log('\n--- TESTE 3: Deduplicação e Integridade de Chat ---');
    const guestMsgCountBefore = guestMessages1.length;
    // Tenta reinjetar a mesma mensagem
    await guestPage.evaluate(async (msg) => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      (mod.watchPartyService as any).handleIncomingChatMessage(msg, msg.senderId);
    }, guestMessages1[0]);

    const guestMsgCountAfter = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return mod.watchPartyService.getChatHistory().length;
    });

    if (guestMsgCountAfter > guestMessages1.length + 1) { // +1 pois recebeu mensagem do teste 2
      throw new Error('Falha na deduplicação: mensagem duplicada foi inserida no histórico.');
    }
    console.log('✓ TESTE 3 PASSOU: Deduplicação estrita confirmada.');

    // ------------------------------------------------------------------
    // TESTE 4: VOICE CHAT (MICROFONE HOST -> CONVIDADO)
    // ------------------------------------------------------------------
    console.log('\n--- TESTE 4: Voice Chat (Host liga microfone) ---');
    const hostVoiceStarted = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return await mod.watchPartyService.startVoiceChat();
    });
    console.log('Host iniciou microfone com sucesso?', hostVoiceStarted);
    if (!hostVoiceStarted) throw new Error('Falha ao iniciar microfone no Host.');

    await hostPage.waitForTimeout(2000);

    const guestAudioCheck = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService as any;
      const container = document.getElementById('zapitv-watchparty-audio-container');
      const audioEls = container ? container.querySelectorAll('audio') : [];
      return {
        remoteAudioElementsMapSize: s.remoteAudioElements.size,
        remotePeers: Array.from(s.remoteAudioElements.keys()),
        domContainerExists: Boolean(container),
        domAudioElementCount: audioEls.length,
        hasSrcObject: audioEls.length > 0 && Boolean((audioEls[0] as HTMLAudioElement).srcObject)
      };
    });

    console.log('Diagnóstico de Áudio no Convidado:', guestAudioCheck);
    if (guestAudioCheck.remoteAudioElementsMapSize < 1 || !guestAudioCheck.domContainerExists || guestAudioCheck.domAudioElementCount < 1) {
      throw new Error('Falha no Teste 4: Convidado não anexou o áudio do Host ao DOM container!');
    }
    console.log('✓ TESTE 4 PASSOU: Stream de voz do Host recebida e montada no container DOM do Convidado.');

    // ------------------------------------------------------------------
    // TESTE 5: VOICE CHAT (MICROFONE CONVIDADO -> HOST)
    // ------------------------------------------------------------------
    console.log('\n--- TESTE 5: Voice Chat (Convidado liga microfone) ---');
    const guestVoiceStarted = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return await mod.watchPartyService.startVoiceChat();
    });
    console.log('Convidado iniciou microfone com sucesso?', guestVoiceStarted);
    if (!guestVoiceStarted) throw new Error('Falha ao iniciar microfone no Convidado.');

    await guestPage.waitForTimeout(2000);

    const hostAudioCheck = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService as any;
      const container = document.getElementById('zapitv-watchparty-audio-container');
      const audioEls = container ? container.querySelectorAll('audio') : [];
      return {
        remoteAudioElementsMapSize: s.remoteAudioElements.size,
        remotePeers: Array.from(s.remoteAudioElements.keys()),
        domContainerExists: Boolean(container),
        domAudioElementCount: audioEls.length,
        hasSrcObject: audioEls.length > 0 && Boolean((audioEls[0] as HTMLAudioElement).srcObject)
      };
    });

    console.log('Diagnóstico de Áudio no Host:', hostAudioCheck);
    if (hostAudioCheck.remoteAudioElementsMapSize < 1 || !hostAudioCheck.domContainerExists || hostAudioCheck.domAudioElementCount < 1) {
      throw new Error('Falha no Teste 5: Host não anexou o áudio do Convidado ao DOM container!');
    }
    console.log('✓ TESTE 5 PASSOU: Stream de voz do Convidado recebida e montada no container DOM do Host.');

    // ------------------------------------------------------------------
    // TESTE 6: AUSÊNCIA DE LOOPBACK / ECO LOCAL
    // ------------------------------------------------------------------
    console.log('\n--- TESTE 6: Ausência de auto-eco local ---');
    const hostSelfLoopback = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService as any;
      return s.remoteAudioElements.has(s.selfId);
    });
    const guestSelfLoopback = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService as any;
      return s.remoteAudioElements.has(s.selfId);
    });

    if (hostSelfLoopback || guestSelfLoopback) {
      throw new Error('Falha no Teste 6: Auto-áudio local foi indevidamente anexado à reprodução remota!');
    }
    console.log('✓ TESTE 6 PASSOU: Nenhum participante reproduz o próprio microfone (zero eco/loopback).');

    // ------------------------------------------------------------------
    // TESTE 7: TOGGLE MUTE DE VOZ
    // ------------------------------------------------------------------
    console.log('\n--- TESTE 7: Mutar e Desmutar Microfone ---');
    const isMutedNow = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return mod.watchPartyService.toggleMuteVoice();
    });
    console.log('Convidado mutou microfone?', isMutedNow);
    if (!isMutedNow) throw new Error('Falha ao mutar microfone do Convidado.');

    const isUnmutedNow = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return !mod.watchPartyService.toggleMuteVoice();
    });
    console.log('Convidado desmutou microfone?', isUnmutedNow);
    if (!isUnmutedNow) throw new Error('Falha ao desmutar microfone do Convidado.');
    console.log('✓ TESTE 7 PASSOU: Mutar/desmutar funciona perfeitamente.');

    console.log('\n================================================================');
    console.log('TODOS OS TESTES DE CHAT E VOICE CHAT PASSARAM COM SUCESSO TOTAL!');
    console.log('================================================================\n');

    await hostContext.close();
    await guestContext.close();
  } finally {
    await browser.close();
  }
}

testChatAndVoice().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
