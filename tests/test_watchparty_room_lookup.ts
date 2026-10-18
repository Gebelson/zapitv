import { chromium } from 'playwright';
import { WatchPartyService } from '../src/core/watchparty/WatchPartyService';

async function runTests() {
  console.log('================================================================');
  console.log('TESTE COMPLETO: SANITIZAÇÃO DE ROOM ID, RESOLUÇÃO DE SALA E RECUPERAÇÃO');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // FASE 1: TESTES UNITÁRIOS DE SANITIZAÇÃO DE ROOM ID
  // -------------------------------------------------------------
  console.log('--- FASE 1: Sanitização de Room ID contra %5B e formatações espúrias ---');

  const testCases = [
    { input: 'zapi-e622-091c-b3a0%5B', expected: 'zapi-e622-091c-b3a0' },
    { input: 'zapi-e622-091c-b3a0[', expected: 'zapi-e622-091c-b3a0' },
    { input: '[zapi-e622-091c-b3a0]', expected: 'zapi-e622-091c-b3a0' },
    { input: 'zapi-e622-091c-b3a0%5D', expected: 'zapi-e622-091c-b3a0' },
    { input: 'zapi-e622-091c-b3a0%255B', expected: 'zapi-e622-091c-b3a0' },
    { input: 'https://zapitv-stream.vercel.app/sala/zapi-e622-091c-b3a0%5B', expected: 'zapi-e622-091c-b3a0' },
    { input: 'https://zapitv.vercel.app/sala/zapi-e622-091c-b3a0?source=whatsapp#intro', expected: 'zapi-e622-091c-b3a0' },
    { input: '[https://zapitv.vercel.app/sala/zapi-e622-091c-b3a0]', expected: 'zapi-e622-091c-b3a0' },
    { input: 'https://zapitv.vercel.app/?sala=zapi-e622-091c-b3a0%5B', expected: 'zapi-e622-091c-b3a0' },
    { input: 'minhasala123%5B', expected: 'minhasala123' },
    { input: '   zapi-1234-abcd   ', expected: 'zapi-1234-abcd' }
  ];

  for (const { input, expected } of testCases) {
    const result = WatchPartyService.sanitizeRoomId(input);
    if (result !== expected) {
      throw new Error(`Falha na sanitização de "${input}": esperava "${expected}", obteve "${result}"`);
    }
    console.log(`✓ Sanitização OK: "${input}" => "${result}"`);
  }
  console.log('✓ FASE 1 PASSOU: Todas as variações de Room ID com %5B foram limpas com sucesso.\n');

  // -------------------------------------------------------------
  // FASE 2: TESTES DE API HTTP (ANNOUNCE, LOOKUP COM %5B, CÓDIGOS DE ERRO)
  // -------------------------------------------------------------
  console.log('--- FASE 2: API HTTP com sanitização de rotas e códigos de erro ---');

  const testRoomId = `zapi-test-${Date.now().toString(36)}`;

  // 1. Host anuncia sala
  const announceRes = await fetch('http://localhost:4000/api/watchparty/room/announce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: testRoomId,
      hostPeerId: 'host-peer-1',
      hostNickname: 'Host Teste',
      media: { id: 'filme-teste', title: 'Filme Teste' },
      transmissionMode: 'host_broadcast'
    })
  });
  const announceData = await announceRes.json();
  if (!announceData?.ok || announceData?.room?.roomId !== testRoomId) {
    throw new Error('Falha ao anunciar sala no servidor');
  }
  console.log(`✓ Anúncio de sala bem-sucedido para: ${testRoomId}`);

  // 2. Lookup usando %5B na URL
  const lookupWithBracket = await fetch(`http://localhost:4000/api/watchparty/room/${encodeURIComponent(testRoomId + '%5B')}`);
  const lookupData = await lookupWithBracket.json();
  if (!lookupData?.ok || lookupData?.room?.roomId !== testRoomId) {
    throw new Error(`Falha ao buscar sala com %5B: ${JSON.stringify(lookupData)}`);
  }
  console.log(`✓ Busca de sala com sufixo %5B resolvida com sucesso: ${lookupData.room.roomId}`);

  // 3. Heartbeat usando %5B
  const hbRes = await fetch(`http://localhost:4000/api/watchparty/room/${encodeURIComponent(testRoomId + '[')}/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      peerId: 'host-peer-1',
      nickname: 'Host Teste',
      isHost: true,
      status: 'ready'
    })
  });
  const hbData = await hbRes.json();
  if (!hbData?.ok) {
    throw new Error('Falha no heartbeat com colchete');
  }
  console.log('✓ Heartbeat com colchete aceito e atualizado.');

  // 4. Sinal usando %5B
  const sigRes = await fetch(`http://localhost:4000/api/watchparty/room/${encodeURIComponent(testRoomId + '%5B')}/signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderPeerId: 'guest-peer-1',
      type: 'join',
      data: { nickname: 'Convidado Teste' }
    })
  });
  const sigData = await sigRes.json();
  if (!sigData?.ok) {
    throw new Error('Falha ao enviar sinal com %5B');
  }
  console.log('✓ Sinal de entrada enviado e participante registrado com sucesso.');

  // 5. Consulta de sala inexistente (espera ROOM_NOT_FOUND)
  const notFoundRes = await fetch('http://localhost:4000/api/watchparty/room/zapi-inexistente-999');
  const notFoundData = await notFoundRes.json();
  if (notFoundRes.status !== 404 || notFoundData?.code !== 'ROOM_NOT_FOUND') {
    throw new Error(`Esperava status 404 ROOM_NOT_FOUND, obteve: ${notFoundRes.status} ${JSON.stringify(notFoundData)}`);
  }
  console.log('✓ Diagnóstico correto para sala inexistente: ROOM_NOT_FOUND');

  // 6. Encerrar sala e verificar ROOM_CLOSED
  const deleteRes = await fetch(`http://localhost:4000/api/watchparty/room/${testRoomId}`, {
    method: 'DELETE'
  });
  if (!deleteRes.ok) throw new Error('Falha ao encerrar sala');

  const closedRes = await fetch(`http://localhost:4000/api/watchparty/room/${testRoomId}`);
  const closedData = await closedRes.json();
  if (closedRes.status !== 404 || closedData?.code !== 'ROOM_CLOSED') {
    throw new Error(`Esperava status 404 ROOM_CLOSED, obteve: ${closedRes.status} ${JSON.stringify(closedData)}`);
  }
  console.log('✓ Diagnóstico correto para sala encerrada: ROOM_CLOSED');
  console.log('✓ FASE 2 PASSOU: Backend responde perfeitamente com rotas sanitizadas e códigos de erro.\n');

  // -------------------------------------------------------------
  // FASE 3: TESTE END-TO-END NO NAVEGADOR COM LINK CONTENDO %5B
  // -------------------------------------------------------------
  console.log('--- FASE 3: Teste End-to-End no Navegador com link contaminado com %5B ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox']
  });

  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();

  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  // Escuta logs para verificar a cadeia de observabilidade
  const hostLogs: string[] = [];
  const guestLogs: string[] = [];
  hostPage.on('console', msg => hostLogs.push(msg.text()));
  guestPage.on('console', msg => guestLogs.push(msg.text()));

  await hostPage.goto('http://localhost:4000/');
  await hostPage.waitForTimeout(1000);

  // Host cria a sala
  const hostCreated = await hostPage.evaluate(async () => {
    const { watchPartyService } = await import('/src/core/watchparty/WatchPartyService.ts');
    const roomId = await watchPartyService.createRoom(
      { id: 'filme-michael', title: 'Michael', type: 'movie' },
      'Gebelson (Host)',
      undefined,
      'host_broadcast'
    );
    return roomId;
  });
  console.log(`Host criou sala com sucesso: ${hostCreated}`);

  // Simula link contaminado com %5B que o convidado abre
  const contaminatedUrl = `http://localhost:4000/sala/${hostCreated}%5B`;
  console.log(`Convidado acessando URL contaminada: ${contaminatedUrl}`);

  await guestPage.goto(contaminatedUrl);
  await guestPage.waitForTimeout(2500);

  // Convidado entra na sala com nickname
  const guestJoinStatus = await guestPage.evaluate(async (cleanTargetId) => {
    const { watchPartyService } = await import('/src/core/watchparty/WatchPartyService.ts');
    try {
      await watchPartyService.joinRoom(cleanTargetId, 'Zapi Amigo (Convidado)');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, hostCreated + '%5B');

  console.log('Resultado do join do convidado com link contendo %5B:', guestJoinStatus);
  if (!guestJoinStatus.success) {
    throw new Error(`Convidado falhou ao entrar na sala com link contendo %5B: ${guestJoinStatus.error}`);
  }

  // Aguarda sincronização e presença
  let synced = false;
  for (let i = 0; i < 20; i++) {
    await hostPage.waitForTimeout(500);
    const hostCount = await hostPage.evaluate(async () => {
      const { watchPartyService } = await import('/src/core/watchparty/WatchPartyService.ts');
      return watchPartyService.getParticipantList().length;
    });
    const guestCount = await guestPage.evaluate(async () => {
      const { watchPartyService } = await import('/src/core/watchparty/WatchPartyService.ts');
      return watchPartyService.getParticipantList().length;
    });

    if (hostCount >= 2 && guestCount >= 2) {
      console.log(`✓ Ambos os participantes conectados e sincronizados! Host vê ${hostCount}, Convidado vê ${guestCount}`);
      synced = true;
      break;
    }
  }

  if (!synced) {
    throw new Error('Falha na sincronização mútua de participantes.');
  }

  // Verifica logs de observabilidade
  const expectedLogs = [
    'ROOM_CREATE',
    'ROOM_REGISTER',
    'ROOM_LOOKUP',
    'PEER_DISCOVERY',
    'ROOM_JOIN',
    'JOIN_ACK'
  ];

  const allLogs = [...hostLogs, ...guestLogs].join('\n');
  for (const logTag of expectedLogs) {
    if (allLogs.includes(logTag)) {
      console.log(`✓ Log de observabilidade confirmado: [WatchParty][${logTag}]`);
    } else {
      console.warn(`Aviso: log de observabilidade [WatchParty][${logTag}] não capturado.`);
    }
  }

  // Teste de Chat Bidirecional sob a nova arquitetura
  await hostPage.evaluate(async () => {
    const { watchPartyService } = await import('/src/core/watchparty/WatchPartyService.ts');
    watchPartyService.sendChatMessage('Mensagem de boas-vindas do Host!');
  });
  await guestPage.waitForTimeout(1000);

  const guestMessages = await guestPage.evaluate(async () => {
    const { watchPartyService } = await import('/src/core/watchparty/WatchPartyService.ts');
    return watchPartyService.getChatHistory().map(m => m.text);
  });
  if (!guestMessages.includes('Mensagem de boas-vindas do Host!')) {
    throw new Error('Convidado não recebeu a mensagem do Host no chat');
  }
  console.log('✓ Chat bidirecional verificado com sucesso após conexão via link sanitizado.');

  await browser.close();

  console.log('\n================================================================');
  console.log('TODAS AS FASES DO TESTE PASSARAM COM SUCESSO TOTAL!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('ERRO CRÍTICO NO TESTE:', err);
  process.exit(1);
});
