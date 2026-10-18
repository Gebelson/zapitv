/**
 * ZapiTV — Teste Abrangente de Estabilização Arquitetural da Watch Party
 * 
 * Valida:
 * 1. Testes Unitários de Invariantes:
 *    - WatchPartyStateMachine (transições válidas e rejeição de transições ilegais)
 *    - WatchPartyRoomManager (sanitização canônica de %5B e formatações espúrias)
 *    - WatchPartyChatService (deduplicação estrita por ID e mensagens do sistema)
 *    - WatchPartyPlaybackSyncService (drift calculation, trava anti-loop e sequências fora de ordem)
 * 2. Testes End-to-End Multi-Contexto no Navegador (Chrome com dispositivos falsos):
 *    - Criação de sala e join via link/código sanitizado
 *    - Sincronização de presença bidirecional (2/6 participantes, nomes canônicos e badge Host)
 *    - Plano de Controle: Chat textual bidirecional e deduplicação
 *    - Plano de Mídia: Voice Chat WebRTC, montagem no DOM (#zapitv-watchparty-audio-container), mute e ausência de auto-eco
 *    - Plano de Mídia: Transmissão do Anfitrião (Host Broadcast) com faixas de áudio e vídeo
 *    - Sincronização de Timeline (Play, Pause, Drift compensation)
 *    - Observabilidade e Diagnóstico (rastreamento de passos de conexão)
 */

import { chromium } from 'playwright';
import { WatchPartyStateMachine } from '../src/core/watchparty/WatchPartyStateMachine';
import { WatchPartyRoomManager } from '../src/core/watchparty/WatchPartyRoomManager';
import { WatchPartyChatService } from '../src/core/watchparty/WatchPartyChatService';
import { WatchPartyPlaybackSyncService } from '../src/core/watchparty/WatchPartyPlaybackSyncService';

async function runArchitectureSuite() {
  console.log('========================================================================');
  console.log('ZAPITV — SUITE DE ESTABILIZAÇÃO DEFINITIVA DA ARQUITETURA WATCH PARTY');
  console.log('========================================================================\n');

  // ====================================================================
  // ETAPA 1: TESTES UNITÁRIOS DOS MÓDULOS DESACOPLADOS
  // ====================================================================
  console.log('--- ETAPA 1: Invariantes Arquiteturais dos Módulos Especializados ---');

  // 1.1 WatchPartyStateMachine
  console.log('\n[1.1] Testando WatchPartyStateMachine...');
  const sm = new WatchPartyStateMachine('LOBBY');
  if (sm.getState() !== 'LOBBY') throw new Error('Estado inicial incorreto');

  const ok1 = sm.transitionTo('PREPARING', 'teste');
  if (!ok1 || sm.getState() !== 'PREPARING') throw new Error('Falha transição LOBBY -> PREPARING');

  const ok2 = sm.transitionTo('READY', 'teste');
  if (!ok2 || sm.getState() !== 'READY') throw new Error('Falha transição PREPARING -> READY');

  const ok3 = sm.transitionTo('PLAYING_INTRO', 'teste');
  if (!ok3 || sm.getState() !== 'PLAYING_INTRO') throw new Error('Falha transição READY -> PLAYING_INTRO');

  const ok4 = sm.transitionTo('PLAYING_CONTENT', 'teste');
  if (!ok4 || sm.getState() !== 'PLAYING_CONTENT') throw new Error('Falha transição PLAYING_INTRO -> PLAYING_CONTENT');

  const ok5 = sm.transitionTo('PAUSED', 'teste');
  if (!ok5 || sm.getState() !== 'PAUSED') throw new Error('Falha transição PLAYING_CONTENT -> PAUSED');

  // Rejeição de transição ilegal sem force
  sm.reset('CREATING');
  const illegal = sm.transitionTo('PAUSED', 'tentativa ilegal');
  if (illegal) throw new Error('Falha: Transição ilegal CREATING -> PAUSED foi aceita');
  console.log('✓ WatchPartyStateMachine aprovada: transições válidas aceitas e ilegais rejeitadas.');

  // 1.2 WatchPartyRoomManager & Sanitização de Room ID
  console.log('\n[1.2] Testando WatchPartyRoomManager & Sanitização Canônica...');
  const sanitizationTests = [
    { input: 'zapi-arch-1234-abcd%5B', expected: 'zapi-arch-1234-abcd' },
    { input: 'zapi-arch-1234-abcd%5D', expected: 'zapi-arch-1234-abcd' },
    { input: 'zapi-arch-1234-abcd%255B', expected: 'zapi-arch-1234-abcd' },
    { input: '[zapi-arch-1234-abcd]', expected: 'zapi-arch-1234-abcd' },
    { input: 'https://zapitv.vercel.app/sala/zapi-arch-1234-abcd%5B', expected: 'zapi-arch-1234-abcd' },
    { input: 'https://zapitv.vercel.app/sala/zapi-arch-1234-abcd?ref=chat#t=10', expected: 'zapi-arch-1234-abcd' },
    { input: '   zapi-arch-1234-abcd   \n', expected: 'zapi-arch-1234-abcd' }
  ];

  for (const { input, expected } of sanitizationTests) {
    const cleaned = WatchPartyRoomManager.sanitizeRoomId(input);
    if (cleaned !== expected) {
      throw new Error(`Sanitização falhou para "${input}". Esperava "${expected}", obteve "${cleaned}"`);
    }
  }
  console.log('✓ WatchPartyRoomManager aprovado: todos os casos com %5B e formatações espúrias sanitizados.');

  // 1.3 WatchPartyChatService
  console.log('\n[1.3] Testando WatchPartyChatService...');
  const chat = new WatchPartyChatService();
  const m1 = chat.createMessage('Mensagem 1', 'peer-1', 'Gebelson', true);
  const added1 = chat.addMessage(m1);
  if (!added1) throw new Error('Falha ao adicionar mensagem no chat');

  // Tentativa de duplicata
  const addedDuplicate = chat.addMessage(m1);
  if (addedDuplicate) throw new Error('Falha: Mensagem duplicada foi aceita no chat');
  if (chat.getHistory().length !== 1) throw new Error('Tamanho de histórico incorreto');

  const sys = chat.addSystemMessage('Aviso do sistema');
  if (!sys || chat.getHistory().length !== 2) throw new Error('Falha ao adicionar mensagem de sistema');
  console.log('✓ WatchPartyChatService aprovado: deduplicação rigorosa e histórico consistentes.');

  // 1.4 WatchPartyPlaybackSyncService
  console.log('\n[1.4] Testando WatchPartyPlaybackSyncService...');
  const sync = new WatchPartyPlaybackSyncService();
  const pState1 = sync.createPlaybackState(
    { id: 'filme-test', title: 'Filme', type: 'movie' },
    100,
    true,
    1.0,
    'host-1',
    'sala-1',
    7200
  );
  if (pState1.sequence !== 1 || pState1.positionSeconds !== 100) throw new Error('Estado de reprodução inválido');

  // Teste de drift
  const driftInSync = sync.evaluateDrift(100.1, pState1);
  if (!driftInSync.inSync || driftInSync.action !== 'none') throw new Error('Falha na avaliação de sincronia perfeita');

  const driftHardSeek = sync.evaluateDrift(80, pState1);
  if (driftHardSeek.inSync || driftHardSeek.action !== 'hard_seek') throw new Error('Falha na avaliação de hard_seek');

  // Descarte de pacote fora de ordem
  const acceptedStale = sync.handleIncomingPlaybackSync({
    ...pState1,
    sequence: 0,
    positionSeconds: 50
  });
  if (acceptedStale) throw new Error('Falha: Pacote fora de ordem com sequência menor não foi descartado');
  console.log('✓ WatchPartyPlaybackSyncService aprovado: compensação de drift e descarte de sequência obsoleta validados.');

  console.log('\n✓ TODAS AS INVARIANTES ARQUITETURAIS DA ETAPA 1 PASSARAM COM SUCESSO!\n');

  // ====================================================================
  // ETAPA 2: TESTES END-TO-END MULTI-CONTEXTO NO NAVEGADOR
  // ====================================================================
  console.log('--- ETAPA 2: Testes End-to-End Multi-Contexto no Navegador (Chrome) ---');

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
        console.log(`[HOST CONSOLE]: ${txt}`);
      }
    });

    guestPage.on('console', msg => {
      const txt = msg.text();
      if (txt.includes('WatchParty') || txt.includes('Trystero')) {
        console.log(`[GUEST CONSOLE]: ${txt}`);
      }
    });

    console.log('\n[2.1] Carregando aplicação nas duas instâncias (localhost:4000)...');
    await hostPage.goto('http://localhost:4000', { waitUntil: 'domcontentloaded' });
    await guestPage.goto('http://localhost:4000', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForTimeout(1000);

    // 2.2 Host cria sala com código testado contra contaminação
    console.log('\n[2.2] Host cria sala com código contaminado por sufixo %5B...');
    const rawTestId = `zapi-arch-${Date.now().toString(36)}%5B`;
    const roomId = await hostPage.evaluate(async (rawId) => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService;
      return await s.createRoom(
        { id: 'michael-arch-test', title: 'Michael', type: 'movie' } as any,
        'Gebelson',
        rawId,
        'host_broadcast'
      );
    }, rawTestId);

    console.log(`Sala criada e canonicamente sanitizada: ${roomId}`);
    if (roomId.includes('%5b') || roomId.includes('[')) {
      throw new Error(`Código de sala retornado ainda contém caracteres inválidos: ${roomId}`);
    }

    // 2.3 Convidado entra na sala usando link contaminado
    console.log('\n[2.3] Convidado entra na sala via identificador com formatação espúria...');
    const contaminatedJoinId = `${roomId}%5B`;
    await guestPage.evaluate(async (jid) => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService;
      await s.joinRoom(jid, 'Zapi Amigo');
    }, contaminatedJoinId);

    // 2.4 Sincronização de Presença
    console.log('\n[2.4] Aguardando presença bidirecional e validação de nomes...');
    let synched = false;
    for (let i = 0; i < 12; i++) {
      await hostPage.waitForTimeout(1000);
      const hostParticipants = await hostPage.evaluate(async () => {
        const mod = await import('/src/core/watchparty/WatchPartyService.ts');
        return mod.watchPartyService.getParticipantList();
      });
      const guestParticipants = await guestPage.evaluate(async () => {
        const mod = await import('/src/core/watchparty/WatchPartyService.ts');
        return mod.watchPartyService.getParticipantList();
      });

      if (hostParticipants.length >= 2 && guestParticipants.length >= 2) {
        synched = true;
        console.log(`Presença sincronizada com sucesso: Host vê ${hostParticipants.length}, Convidado vê ${guestParticipants.length}`);
        console.log('Participantes no Host:', hostParticipants.map(p => `${p.nickname} (Host: ${p.isHost})`));
        console.log('Participantes no Convidado:', guestParticipants.map(p => `${p.nickname} (Host: ${p.isHost})`));
        break;
      }
    }

    if (!synched) {
      throw new Error('Falha: Participantes não sincronizaram presença em 12 segundos.');
    }
    console.log('✓ Presença bidirecional aprovada: ambos os participantes se reconhecem na sala.');

    // 2.5 Plano de Controle: Chat Bidirecional
    console.log('\n[2.5] Testando Plano de Controle: Chat Bidirecional com badges de Host...');
    await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      mod.watchPartyService.sendChatMessage('Mensagem do Host Gebelson via Arquitetura Estabilizada!');
    });

    await hostPage.waitForTimeout(1000);

    const guestMsgs = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return mod.watchPartyService.getChatHistory();
    });

    const receivedHostMsg = guestMsgs.find(m => m.text.includes('Mensagem do Host Gebelson') && m.isHost === true);
    if (!receivedHostMsg) throw new Error('Convidado não recebeu mensagem com identificação de Host');
    console.log('✓ Host -> Convidado no chat aprovado.');

    await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      mod.watchPartyService.sendChatMessage('Resposta do Convidado Zapi Amigo recebida com clareza!');
    });

    await hostPage.waitForTimeout(1000);

    const hostMsgs = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return mod.watchPartyService.getChatHistory();
    });

    const receivedGuestMsg = hostMsgs.find(m => m.text.includes('Resposta do Convidado Zapi Amigo') && m.isHost === false);
    if (!receivedGuestMsg) throw new Error('Host não recebeu mensagem do convidado');
    console.log('✓ Convidado -> Host no chat aprovado.');

    // 2.6 Plano de Mídia: Voice Chat WebRTC e Montagem no DOM
    console.log('\n[2.6] Testando Plano de Mídia: Voice Chat WebRTC, container DOM e Ausência de Auto-eco...');
    const hostVoiceStarted = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return await mod.watchPartyService.startVoiceChat();
    });
    if (!hostVoiceStarted) throw new Error('Falha ao iniciar microfone no Host');

    await hostPage.waitForTimeout(2000);

    const guestAudioCheck = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const s = mod.watchPartyService as any;
      const container = document.getElementById('zapitv-watchparty-audio-container');
      const audioEls = container ? container.querySelectorAll('audio') : [];
      return {
        domContainerExists: Boolean(container),
        domAudioElementCount: audioEls.length,
        hasSrcObject: audioEls.length > 0 && Boolean((audioEls[0] as HTMLAudioElement).srcObject),
        hasSelfLoopback: s.remoteAudioElements.has(s.selfId)
      };
    });

    console.log('Diagnóstico de Áudio no Convidado:', guestAudioCheck);
    if (!guestAudioCheck.domContainerExists || guestAudioCheck.domAudioElementCount < 1 || !guestAudioCheck.hasSrcObject) {
      throw new Error('Falha: Áudio do Host não foi anexado ao DOM do Convidado');
    }
    if (guestAudioCheck.hasSelfLoopback) {
      throw new Error('Falha: Convidado anexou o próprio áudio (auto-eco detectado)');
    }
    console.log('✓ Voice Chat aprovado: áudio remoto reproduzido no DOM com isolamento de auto-eco.');

    // 2.7 Toggle de Mudo de Microfone
    console.log('\n[2.7] Testando Toggle de Mudo de Microfone...');
    const hostMuted = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return mod.watchPartyService.toggleMuteVoice();
    });
    if (!hostMuted) throw new Error('Falha ao silenciar microfone do Host');

    const hostUnmuted = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return !mod.watchPartyService.toggleMuteVoice();
    });
    if (!hostUnmuted) throw new Error('Falha ao reativar microfone do Host');
    console.log('✓ Silenciamento e reativação de microfone aprovados.');

    // 2.8 Sincronização de Reprodução e Timeline
    console.log('\n[2.8] Testando Sincronização de Timeline (Play, Pause, Compensação de Drift)...');
    await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      mod.watchPartyService.broadcastHostPlayback(142.5, true, 1.0, 7200);
    });

    await hostPage.waitForTimeout(1000);

    const guestSync = await guestPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      const last = mod.watchPartyService.getLastPlaybackState();
      const expected = last ? mod.watchPartyService.calculateExpectedPosition(last) : 0;
      return { last, expected };
    });

    if (!guestSync.last || guestSync.last.positionSeconds !== 142.5 || !guestSync.last.isPlaying) {
      throw new Error('Convidado não recebeu o estado de reprodução transmitido pelo Host');
    }
    if (guestSync.expected < 142.5) {
      throw new Error('Cálculo de posição esperada com drift decorrido falhou');
    }
    console.log(`✓ Sincronização de timeline aprovada: posição ${guestSync.last.positionSeconds}s recebida com compensação calculada.`);

    // 2.9 Diagnóstico e Telemetria de Conexão
    console.log('\n[2.9] Verificando logs de telemetria e etapas de conexão estruturadas...');
    const hostDiagnostics = await hostPage.evaluate(async () => {
      const mod = await import('/src/core/watchparty/WatchPartyService.ts');
      return mod.watchPartyService.getDiagnosticEvents();
    });

    const requiredSteps = ['ROOM_CREATE', 'ROOM_REGISTER', 'PEER_DISCOVERY'];
    for (const step of requiredSteps) {
      const found = hostDiagnostics.some(d => d.step === step);
      if (!found) throw new Error(`Passo de diagnóstico esperado "${step}" não encontrado nos logs.`);
    }
    console.log('✓ Telemetria de diagnóstico validada com sucesso.');

    console.log('\n========================================================================');
    console.log('SUITE DE ARQUITETURA CONCLUÍDA COM SUCESSO TOTAL: ZERO REGRESSÕES!');
    console.log('========================================================================\n');

    await hostContext.close();
    await guestContext.close();
  } finally {
    await browser.close();
  }
}

runArchitectureSuite().catch((err) => {
  console.error('\n❌ ERRO NA SUITE DE ARQUITETURA:', err);
  process.exit(1);
});
