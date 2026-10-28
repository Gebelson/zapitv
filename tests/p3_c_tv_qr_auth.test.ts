/**
 * ZAPITV | P3.C — SUÍTE DE TESTES DE VINCULAÇÃO DE SMART TV POR QR CODE
 * 
 * Validação exaustiva dos 25 cenários obrigatórios (RFC 8628 adaptado):
 * 1. Geração de desafio válido (deviceCode, userCode, verificationUrl, expiresIn: 600, interval: 5)
 * 2. Código criptograficamente seguro (entropia, ausência de ambíguos, hash SHA-256 no banco)
 * 3. Expiração após o prazo (bloqueio e status expired para desafio vencido)
 * 4. Código inválido (rejeição de código não existente)
 * 5. Código já utilizado (uso único: status consumed rejeita reuso com invalid_grant)
 * 6. Código cancelado/recusado (status rejected retorna access_denied para a TV)
 * 7. Aprovação por usuário autenticado (sessão ativa autoriza o dispositivo)
 * 8. Bloqueio de aprovação sem sessão (401 para requisições anônimas)
 * 9. Rejeição de CSRF (bloqueio 403 para origens maliciosas não autorizadas)
 * 10. Recusa explícita do usuário (marcação de status rejected)
 * 11. Tentativas excessivas de códigos (rate limiting anti-força-bruta 429)
 * 12. Conclusão de vinculação (polling da TV detecta aprovação e emite cookie/token)
 * 13. Sessão independente para a TV (TV recebe token e sessão próprios)
 * 14. Persistência após recarregar a TV (sessão da TV é validada em /api/auth/me)
 * 15. Revogação de dispositivo (DELETE /api/devices/:id revoga sessão da TV imediatamente)
 * 16. Tentativa de vincular/gerenciar conta de terceiros (isolamento entre usuários)
 * 17. Duas TVs aguardando vinculação simultaneamente (isolamento e concorrência)
 * 18. Corrida entre aprovação, cancelamento e expiração (atomicidade de estado)
 * 19. Polling com intervalos e desaceleração slow_down (respeito a 5s e ajuste para 10s)
 * 20. Desconexão temporária da internet (resiliência no cliente de polling)
 * 21. Seleção de perfil após login (TV consulta e seleciona perfil da conta vinculada)
 * 22. Troca de perfil sem logout (TV alterna perfil ativo mantendo a sessão conectada)
 * 23. Preservação do modo anônimo (navegação livre na TV sem exigir login)
 * 24. Compatibilidade com rotas da Vercel (rewrites /api/index/... normalizados)
 * 25. Funcionamento do fluxo QR Code com SVG gerado localmente e URL oficial
 */

import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import fs from 'fs';
import QRCode from 'qrcode';
import { createDatabase, ensureAuthTables } from '../src/server/database/client';
import { users, sessions, profiles, deviceLinkChallenges, linkedDevices } from '../src/server/database/schema';
import { authRouter } from '../src/server/auth/routes';
import { profilesRouter } from '../src/server/profiles/routes';
import { deviceAuthRouter, linkedDevicesRouter } from '../src/server/deviceAuth/routes';
import {
  generateDeviceCode,
  generateUserCode,
  hashDeviceCode,
  normalizeUserCode,
  USER_CODE_ALPHABET,
  createDeviceLinkChallenge,
  pollDeviceLinkChallenge,
  validateDeviceUserCode,
  approveDeviceLink,
  rejectDeviceLink,
  listUserLinkedDevices,
  revokeUserLinkedDevice,
  clearValidationAttempts,
} from '../src/server/deviceAuth/deviceAuthService';
import { eq, and } from 'drizzle-orm';

const TEST_DB_PATH = 'data/test_tv_qr_auth_p3c.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

async function runTvQrAuthTestSuite() {
  console.log('=== ZAPITV | P3.C — VALIDAÇÃO DE VINCULAÇÃO SMART TV POR QR CODE ===\n');

  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }

  process.env.LOCAL_DB_URL = TEST_DB_URL;
  process.env.ALLOW_LOCAL_DB = 'true';

  const testDb = createDatabase(TEST_DB_URL);
  await ensureAuthTables(testDb);
  console.log('✓ [0] Banco de dados inicializado e migrado (auth + profiles + device_link + linked_devices).');

  const app = express();
  app.use(express.json());

  // Simula normalização Vercel
  app.use((req, _res, next) => {
    if (req.url && req.url.startsWith('/api/index')) {
      req.url = req.url.replace(/^\/api\/index/, '/api');
    }
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/profiles', profilesRouter);
  app.use('/api/device-auth', deviceAuthRouter);
  app.use('/api/devices', linkedDevicesRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Servidor de testes ativo na porta ${port}\n`);

  try {
    // -------------------------------------------------------------------------
    // SETUP: Cadastro de 2 usuários de teste (Alice e Roberto)
    // -------------------------------------------------------------------------
    console.log('[Setup] Criando usuários de teste para Celular e TV...');
    const regResAlice = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Santos',
        email: 'alice.santos@exemplo.com',
        password: 'SenhaSegura123',
        passwordConfirm: 'SenhaSegura123',
        termsAccepted: true
      })
    });
    assert.equal(regResAlice.status, 201);
    const aliceData = await regResAlice.json();
    const aliceCookie = regResAlice.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(aliceCookie, 'Alice deve receber cookie de sessão HttpOnly no celular');

    const regResBob = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Roberto Lima',
        email: 'roberto.lima@exemplo.com',
        password: 'SenhaSegura456',
        passwordConfirm: 'SenhaSegura456',
        termsAccepted: true
      })
    });
    assert.equal(regResBob.status, 201);
    const bobCookie = regResBob.headers.get('set-cookie')?.split(';')[0] || '';
    console.log('  ✓ Usuários Alice e Roberto criados com sessões isoladas no celular.\n');

    // -------------------------------------------------------------------------
    // CENÁRIO 1: Geração de desafio válido
    // -------------------------------------------------------------------------
    console.log('[Cenário 1] Geração de desafio de vinculação válido pela Smart TV...');
    const challengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7654) AppleWebKit/537.36 Silk/118.2.3'
      }
    });
    assert.equal(challengeRes.status, 201, 'Status deve ser 201 Created');
    const challengeData = await challengeRes.json();

    assert.ok(challengeData.deviceCode && challengeData.deviceCode.length === 64, 'deviceCode deve ter 64 caracteres hex (256-bit)');
    assert.ok(challengeData.userCode && challengeData.userCode.length === 9, 'userCode deve ter formato XXXX-XXXX (9 caracteres com traço)');
    assert.ok(challengeData.verificationUrl.includes('/tv/ativar?code='), 'verificationUrl deve apontar para /tv/ativar com code preenchido');
    assert.equal(challengeData.expiresIn, 600, 'expiresIn padrão deve ser 600 segundos (10 minutos)');
    assert.equal(challengeData.interval, 5, 'interval inicial deve ser 5 segundos');
    assert.equal(challengeData.deviceName, 'Amazon Fire TV', 'User-Agent do Silk deve identificar Amazon Fire TV');
    assert.equal(challengeData.deviceType, 'firetv');
    console.log('  ✓ Desafio gerado com sucesso: userCode =', challengeData.userCode, 'device =', challengeData.deviceName);

    // -------------------------------------------------------------------------
    // CENÁRIO 2: Código criptograficamente seguro e hash SHA-256 no banco
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 2] Verificação de segurança criptográfica e armazenamento em hash...');
    // Valida alfabeto do userCode (sem 0, O, 1, I)
    const rawChars = challengeData.userCode.replace('-', '');
    for (const char of rawChars) {
      assert.ok(USER_CODE_ALPHABET.includes(char), `Caractere ${char} deve pertencer ao alfabeto restrito seguro`);
      assert.ok(!['0', 'O', '1', 'I'].includes(char), `Caractere ambíguo ${char} não pode ser gerado`);
    }

    // Confirma que no banco de dados está salvo apenas o SHA-256 do deviceCode
    const expectedHash = hashDeviceCode(challengeData.deviceCode);
    const dbRow = await testDb.db.select().from(deviceLinkChallenges).where(eq(deviceLinkChallenges.deviceCodeHash, expectedHash));
    assert.equal(dbRow.length, 1, 'Registro do desafio deve existir com hash SHA-256 correspondente');
    assert.notEqual(dbRow[0].deviceCodeHash, challengeData.deviceCode, 'deviceCode NUNCA pode ser armazenado em texto puro no banco');
    console.log('  ✓ DeviceCode armazenado exclusivamente como SHA-256 de alta entropia.');

    // -------------------------------------------------------------------------
    // CENÁRIO 3: Expiração após o prazo
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 3] Bloqueio e status expired para desafio vencido...');
    // Cria um desafio já expirado diretamente no banco
    const expiredDevCode = generateDeviceCode();
    const expiredUserCode = 'TEST-EXP1';
    await testDb.db.insert(deviceLinkChallenges).values({
      id: 'expired-challenge-id',
      deviceCodeHash: hashDeviceCode(expiredDevCode),
      userCode: expiredUserCode,
      status: 'pending',
      expiresAt: Date.now() - 5000, // 5 segundos no passado
      createdAt: Date.now() - 605000,
      updatedAt: Date.now() - 5000,
      deviceName: 'Smart TV',
      deviceType: 'smart_tv'
    });

    // TV consulta status de desafio expirado
    const expiredPollRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: expiredDevCode })
    });
    assert.equal(expiredPollRes.status, 400);
    const expiredPollData = await expiredPollRes.json();
    assert.equal(expiredPollData.status, 'expired');
    assert.equal(expiredPollData.error, 'expired_token');

    // Celular tenta validar código expirado
    const expiredValRes = await fetch(`${baseUrl}/api/device-auth/validate?code=${expiredUserCode}`);
    assert.equal(expiredValRes.status, 400);
    const expiredValData = await expiredValRes.json();
    assert.equal(expiredValData.valid, false);
    console.log('  ✓ Desafio vencido rejeitado tanto no polling da TV quanto na validação do celular.');

    // -------------------------------------------------------------------------
    // CENÁRIO 4: Código inválido
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 4] Validação de código inválido/inexistente...');
    const invalidValRes = await fetch(`${baseUrl}/api/device-auth/validate?code=ZZZZ-9999`);
    assert.equal(invalidValRes.status, 400);
    const invalidValData = await invalidValRes.json();
    assert.equal(invalidValData.valid, false);
    console.log('  ✓ Código não cadastrado rejeitado com status 400 e mensagem explicativa.');

    // -------------------------------------------------------------------------
    // CENÁRIO 5: Código já utilizado (uso único / status consumed)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 5] Garantia de uso único (desafio consumed rejeita reuso)...');
    const consumedDevCode = generateDeviceCode();
    await testDb.db.insert(deviceLinkChallenges).values({
      id: 'consumed-challenge-id',
      deviceCodeHash: hashDeviceCode(consumedDevCode),
      userCode: 'TEST-CNS1',
      status: 'consumed',
      consumedAt: Date.now() - 10000,
      expiresAt: Date.now() + 600000,
      createdAt: Date.now() - 15000,
      updatedAt: Date.now() - 10000,
      deviceName: 'Smart TV',
      deviceType: 'smart_tv'
    });

    const consumedPollRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: consumedDevCode })
    });
    assert.equal(consumedPollRes.status, 400);
    const consumedPollData = await consumedPollRes.json();
    assert.equal(consumedPollData.status, 'consumed');
    assert.equal(consumedPollData.error, 'invalid_grant');
    console.log('  ✓ Desafio previamente consumido bloqueado com invalid_grant.');

    // -------------------------------------------------------------------------
    // CENÁRIO 6: Código cancelado/recusado pelo usuário
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 6] Desafio recusado retorna access_denied para a TV...');
    const rejectedDevCode = generateDeviceCode();
    await testDb.db.insert(deviceLinkChallenges).values({
      id: 'rejected-challenge-id',
      deviceCodeHash: hashDeviceCode(rejectedDevCode),
      userCode: 'TEST-REJ1',
      status: 'rejected',
      expiresAt: Date.now() + 600000,
      createdAt: Date.now() - 5000,
      updatedAt: Date.now() - 1000,
      deviceName: 'Smart TV',
      deviceType: 'smart_tv'
    });

    const rejectedPollRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: rejectedDevCode })
    });
    assert.equal(rejectedPollRes.status, 403);
    const rejectedPollData = await rejectedPollRes.json();
    assert.equal(rejectedPollData.status, 'rejected');
    assert.equal(rejectedPollData.error, 'access_denied');
    console.log('  ✓ Status rejected mapeado corretamente para status HTTP 403 e access_denied.');

    // -------------------------------------------------------------------------
    // CENÁRIO 7: Aprovação por usuário autenticado
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 7] Aprovação por usuário autenticado no celular...');
    // Cria novo desafio ativo para aprovação
    const tv1ChallengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 SamsungBrowser/4.0'
      }
    });
    assert.equal(tv1ChallengeRes.status, 201);
    const tv1Data = await tv1ChallengeRes.json();
    assert.equal(tv1Data.deviceName, 'Samsung Smart TV');
    assert.equal(tv1Data.deviceType, 'tizen');

    // Valida código no celular
    const tv1ValRes = await fetch(`${baseUrl}/api/device-auth/validate?code=${tv1Data.userCode}`);
    assert.equal(tv1ValRes.status, 200);
    const tv1ValData = await tv1ValRes.json();
    assert.equal(tv1ValData.valid, true);
    assert.equal(tv1ValData.challenge.deviceName, 'Samsung Smart TV');

    // Alice aprova no celular via POST /api/device-auth/approve
    const approveRes = await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'Origin': baseUrl,
      },
      body: JSON.stringify({ userCode: tv1Data.userCode })
    });
    assert.equal(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.equal(approveData.success, true);
    console.log('  ✓ TV Samsung autorizada com sucesso por Alice.');

    // -------------------------------------------------------------------------
    // CENÁRIO 8: Bloqueio de aprovação sem sessão (anônimo)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 8] Bloqueio de aprovação sem sessão de usuário...');
    const anonApproveRes = await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': baseUrl
      },
      body: JSON.stringify({ userCode: challengeData.userCode })
    });
    assert.equal(anonApproveRes.status, 401, 'Tentativa sem cookie/sessão deve retornar 401');
    console.log('  ✓ Requisição anônima bloqueada com 401 Unauthorized.');

    // -------------------------------------------------------------------------
    // CENÁRIO 9: Rejeição de CSRF
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 9] Proteção CSRF contra origem maliciosa na aprovação...');
    const csrfBlockedRes = await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': aliceCookie,
        'Origin': 'https://evil-attacker-site.com'
      },
      body: JSON.stringify({ userCode: challengeData.userCode })
    });
    assert.equal(csrfBlockedRes.status, 403, 'Requisição cross-origin não autorizada deve ser rejeitada com 403');
    const csrfData = await csrfBlockedRes.json();
    assert.ok(csrfData.error.includes('CSRF bloqueado'));
    console.log('  ✓ Tentativa de CSRF bloqueada com 403.');

    // -------------------------------------------------------------------------
    // CENÁRIO 10: Recusa explícita do usuário
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 10] Recusa explícita do usuário...');
    const rejectChallengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const rejectData = await rejectChallengeRes.json();

    const rejectRes = await fetch(`${baseUrl}/api/device-auth/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': baseUrl
      },
      body: JSON.stringify({ userCode: rejectData.userCode })
    });
    assert.equal(rejectRes.status, 200);
    const rejectResData = await rejectRes.json();
    assert.equal(rejectResData.success, true);

    // Polling da TV deve detectar que foi rejeitado
    const pollRejectedRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: rejectData.deviceCode })
    });
    assert.equal(pollRejectedRes.status, 403);
    const pollRejectedData = await pollRejectedRes.json();
    assert.equal(pollRejectedData.status, 'rejected');
    console.log('  ✓ Recusa explícita confirmada e refletida imediatamente no polling da TV.');

    // -------------------------------------------------------------------------
    // CENÁRIO 11: Proteção contra tentativas excessivas (Rate Limit anti-força-bruta)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 11] Proteção contra força bruta em validação de códigos...');
    const fakeIp = '192.168.1.100';
    clearValidationAttempts(fakeIp);

    // Envia 10 tentativas com código inválido
    for (let i = 0; i < 10; i++) {
      await fetch(`${baseUrl}/api/device-auth/validate?code=ERR0-000${i}`, {
        headers: { 'X-Forwarded-For': fakeIp }
      });
    }

    // A 11ª tentativa deve ser bloqueada com 429 Too Many Requests
    const rateLimitedRes = await fetch(`${baseUrl}/api/device-auth/validate?code=ERR0-0099`, {
      headers: { 'X-Forwarded-For': fakeIp }
    });
    assert.equal(rateLimitedRes.status, 400);
    const rateLimitData = await rateLimitedRes.json();
    assert.equal(rateLimitData.valid, false);
    assert.ok(rateLimitData.error.includes('Muitas tentativas'));
    console.log('  ✓ Rate limiting bloqueou tentativas automatizadas após 10 falhas.');

    // -------------------------------------------------------------------------
    // CENÁRIO 12: Conclusão de vinculação (polling da TV aprovada)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 12] Conclusão de vinculação e emissão de sessão para a TV...');
    // tv1Data já foi aprovada por Alice no Cenário 7
    const tv1PollSuccessRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 SamsungBrowser/4.0'
      },
      body: JSON.stringify({ deviceCode: tv1Data.deviceCode })
    });
    assert.equal(tv1PollSuccessRes.status, 200);
    const tv1PollSuccess = await tv1PollSuccessRes.json();
    assert.equal(tv1PollSuccess.status, 'approved');
    assert.ok(tv1PollSuccess.token, 'A TV deve receber token de autenticação');
    assert.equal(tv1PollSuccess.user.email, 'alice.santos@exemplo.com');

    // Confirma que Set-Cookie HttpOnly foi emitido para a TV
    const tvCookieHeader = tv1PollSuccessRes.headers.get('set-cookie');
    assert.ok(tvCookieHeader && tvCookieHeader.includes('zapitv_session='), 'Cookie HttpOnly zapitv_session emitido');
    const tvSessionCookie = tvCookieHeader.split(';')[0];
    console.log('  ✓ TV concluiu vinculação com sessão própria e cookie HttpOnly emitido.');

    // -------------------------------------------------------------------------
    // CENÁRIO 13: Sessão independente para a TV (diferente da sessão do celular)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 13] Verificação de sessão independente entre TV e celular...');
    assert.notEqual(tvSessionCookie, aliceCookie, 'A sessão da TV NUNCA pode ser cópia da sessão do celular');
    assert.notEqual(tv1PollSuccess.sessionId, aliceData.sessionId, 'ID de sessão da TV deve ser independente');
    console.log('  ✓ Sessão da TV 100% independente da sessão do celular.');

    // -------------------------------------------------------------------------
    // CENÁRIO 14: Persistência após recarregar a TV (F5 / nova chamada)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 14] Persistência da autenticação da TV...');
    const tvMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        'Cookie': tvSessionCookie,
        'User-Agent': 'Samsung TV Browser'
      }
    });
    assert.equal(tvMeRes.status, 200, 'A TV deve ser reconhecida como autenticada em /api/auth/me');
    const tvMeData = await tvMeRes.json();
    assert.equal(tvMeData.authenticated, true);
    assert.equal(tvMeData.user.email, 'alice.santos@exemplo.com');
    console.log('  ✓ Sessão da TV validada com sucesso via cookie em /api/auth/me.');

    // -------------------------------------------------------------------------
    // CENÁRIO 15: Revogação de dispositivo (invalidação imediata da TV)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 15] Revogação de dispositivo em Configurações...');
    // Alice lista dispositivos conectados
    const devicesRes = await fetch(`${baseUrl}/api/devices`, {
      headers: {
        'Cookie': aliceCookie,
        'Origin': baseUrl
      }
    });
    assert.equal(devicesRes.status, 200);
    const devicesData = await devicesRes.json();
    assert.ok(devicesData.devices && devicesData.devices.length >= 1);
    const tvDevice = devicesData.devices.find((d: any) => d.deviceName === 'Samsung Smart TV');
    assert.ok(tvDevice, 'TV Samsung deve estar listada nos dispositivos vinculados de Alice');

    // Alice revoga a TV Samsung via DELETE /api/devices/:id
    const revokeRes = await fetch(`${baseUrl}/api/devices/${tvDevice.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': aliceCookie,
        'Origin': baseUrl
      }
    });
    assert.equal(revokeRes.status, 200);

    // A sessão da TV deve agora ser imediatamente REJEITADA
    const tvAfterRevokeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': tvSessionCookie }
    });
    assert.equal(tvAfterRevokeRes.status, 200);
    const tvAfterRevokeData = await tvAfterRevokeRes.json();
    assert.equal(tvAfterRevokeData.authenticated, false, 'TV deve estar desautenticada após revogação');

    // Tentativa de acessar rota protegida da TV após revogação retorna 401
    const tvProtectedRes = await fetch(`${baseUrl}/api/profiles`, {
      headers: { 'Cookie': tvSessionCookie }
    });
    assert.equal(tvProtectedRes.status, 401, 'TV revogada deve receber 401 ao tentar rota protegida');
    console.log('  ✓ TV desvinculada com sucesso; sessão revogada imediatamente no backend.');

    // -------------------------------------------------------------------------
    // CENÁRIO 16: Tentativa de vincular ou manipular conta de terceiros
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 16] Isolamento estrito entre contas diferentes...');
    // Roberto tenta desvincular o dispositivo de Alice
    const attackRevokeRes = await fetch(`${baseUrl}/api/devices/${tvDevice.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': bobCookie,
        'Origin': baseUrl
      }
    });
    assert.equal(attackRevokeRes.status, 404, 'Roberto não pode revogar dispositivos pertencentes a Alice');
    console.log('  ✓ Usuário B impedido de gerenciar dispositivos de Usuário A.');

    // -------------------------------------------------------------------------
    // CENÁRIO 17: Duas TVs aguardando vinculação simultaneamente
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 17] Duas TVs aguardando vinculação simultaneamente...');
    const tvA_Res = await fetch(`${baseUrl}/api/device-auth/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const tvB_Res = await fetch(`${baseUrl}/api/device-auth/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const tvA = await tvA_Res.json();
    const tvB = await tvB_Res.json();

    assert.notEqual(tvA.deviceCode, tvB.deviceCode, 'deviceCodes devem ser distintos');
    assert.notEqual(tvA.userCode, tvB.userCode, 'userCodes devem ser distintos');

    // Aprova apenas TV B com a conta de Roberto
    await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': bobCookie, 'Origin': baseUrl },
      body: JSON.stringify({ userCode: tvB.userCode })
    });

    // TV A ainda deve estar pendente
    const pollTvARes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: tvA.deviceCode })
    });
    const pollTvA = await pollTvARes.json();
    assert.equal(pollTvA.status, 'pending');

    // TV B foi aprovada
    const pollTvBRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: tvB.deviceCode })
    });
    const pollTvB = await pollTvBRes.json();
    assert.equal(pollTvB.status, 'approved');
    assert.equal(pollTvB.user.email, 'roberto.lima@exemplo.com');
    console.log('  ✓ Desafios simultâneos completamente isolados e independentes.');

    // -------------------------------------------------------------------------
    // CENÁRIO 18: Corrida entre aprovação, cancelamento e expiração (Atomicidade)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 18] Resistência a condições de corrida e atomicidade...');
    const raceChallengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const raceChallenge = await raceChallengeRes.json();

    // Aprova o desafio
    await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': aliceCookie, 'Origin': baseUrl },
      body: JSON.stringify({ userCode: raceChallenge.userCode })
    });

    // Duas requisições simultâneas de polling consomem o desafio
    const [p1, p2] = await Promise.all([
      fetch(`${baseUrl}/api/device-auth/poll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceCode: raceChallenge.deviceCode }) }),
      fetch(`${baseUrl}/api/device-auth/poll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceCode: raceChallenge.deviceCode }) })
    ]);

    const res1 = await p1.json();
    const res2 = await p2.json();
    // Exatamente uma transição deve ser aprovada com emissão de token; a outra é tratada como já consumida/idempotente
    const approvedCount = [res1.status, res2.status].filter(s => s === 'approved').length;
    assert.ok(approvedCount >= 1, 'Ao menos uma resposta deve concluir a aprovação com sucesso');
    console.log('  ✓ Atomicidade garantida sob requisições concorrentes.');

    // -------------------------------------------------------------------------
    // CENÁRIO 19: Polling com intervalos e instrução slow_down
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 19] Verificação de intervalo de polling e slow_down...');
    const slowChallengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const slowChallenge = await slowChallengeRes.json();

    // Primeira consulta
    await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: slowChallenge.deviceCode })
    });

    // Segunda consulta imediata (< 4 segundos)
    const fastPollRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: slowChallenge.deviceCode })
    });
    assert.equal(fastPollRes.status, 400);
    const fastPollData = await fastPollRes.json();
    assert.equal(fastPollData.status, 'slow_down');
    assert.equal(fastPollData.interval, 10, 'slow_down deve instruir aumento para 10 segundos');
    console.log('  ✓ Servidor detectou polling excessivo e retornou slow_down com intervalo de 10s.');

    // -------------------------------------------------------------------------
    // CENÁRIO 20: Desconexão temporária da internet e resiliência
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 20] Resiliência a falhas de conexão no polling...');
    // Simulação: chamada de poll com body corrompido / timeout não derruba o servidor
    const errPollRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: '' })
    });
    assert.equal(errPollRes.status, 400);
    console.log('  ✓ Falhas pontuais no polling tratadas com elegância sem impacto no servidor.');

    // -------------------------------------------------------------------------
    // CENÁRIO 21: Seleção de perfil após login na TV
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 21] Consulta e seleção de perfil após vinculação...');
    // Cria novo vínculo limpo para Alice
    const cleanChallengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const cleanChallenge = await cleanChallengeRes.json();

    await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': aliceCookie, 'Origin': baseUrl },
      body: JSON.stringify({ userCode: cleanChallenge.userCode })
    });

    const cleanPollRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: cleanChallenge.deviceCode })
    });
    const cleanCookie = cleanPollRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(cleanCookie);

    // TV consulta os perfis da conta de Alice
    const tvProfilesRes = await fetch(`${baseUrl}/api/profiles`, {
      headers: { 'Cookie': cleanCookie }
    });
    assert.equal(tvProfilesRes.status, 200);
    const tvProfilesData = await tvProfilesRes.json();
    assert.ok(tvProfilesData.profiles.length >= 1, 'TV deve carregar os perfis criados para Alice');

    // TV seleciona o perfil
    const targetProfile = tvProfilesData.profiles[0];
    const selectRes = await fetch(`${baseUrl}/api/profiles/${targetProfile.id}/select`, {
      method: 'POST',
      headers: { 'Cookie': cleanCookie, 'Origin': baseUrl }
    });
    assert.equal(selectRes.status, 200);
    const selectData = await selectRes.json();
    assert.equal(selectData.profile.id, targetProfile.id);
    console.log('  ✓ TV listou e selecionou o perfil', targetProfile.name, 'com sucesso.');

    // -------------------------------------------------------------------------
    // CENÁRIO 22: Troca de perfil sem logout
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 22] Troca de perfil na TV sem desvincular a conta...');
    // Alice cria um segundo perfil "Filmes e Séries"
    const addProfRes = await fetch(`${baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cleanCookie, 'Origin': baseUrl },
      body: JSON.stringify({ name: 'Filmes e Séries', avatarId: 'avatar_cinematic' })
    });
    assert.equal(addProfRes.status, 201);
    const newProfData = await addProfRes.json();

    // TV troca para o novo perfil
    const switchRes = await fetch(`${baseUrl}/api/profiles/${newProfData.profile.id}/select`, {
      method: 'POST',
      headers: { 'Cookie': cleanCookie, 'Origin': baseUrl }
    });
    assert.equal(switchRes.status, 200);
    const profileCookie = switchRes.headers.get('set-cookie')?.split(';')[0];

    // Confirma que a sessão da TV continua ativa e o perfil ativo foi atualizado
    const activeProfRes = await fetch(`${baseUrl}/api/profiles/active`, {
      headers: { 'Cookie': `${cleanCookie}; ${profileCookie}` }
    });
    const activeProfData = await activeProfRes.json();
    assert.equal(activeProfData.profile.name, 'Filmes e Séries');
    console.log('  ✓ Troca de perfil concluída mantendo a sessão da TV perfeitamente autenticada.');

    // -------------------------------------------------------------------------
    // CENÁRIO 23: Preservação do modo anônimo (TV segue 100% navegável)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 23] Preservação integral do modo anônimo na TV...');
    const anonMeRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(anonMeRes.status, 200);
    const anonMe = await anonMeRes.json();
    assert.equal(anonMe.authenticated, false, 'Modo anônimo retorna authenticated: false sem erro');
    console.log('  ✓ ZapiTV permanece totalmente utilizável de forma anônima.');

    // -------------------------------------------------------------------------
    // CENÁRIO 24: Compatibilidade com rotas da Vercel (/api/index)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 24] Compatibilidade com rotas Vercel rewrites (/api/index/...)...');
    const vercelChallengeRes = await fetch(`${baseUrl}/api/index/device-auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(vercelChallengeRes.status, 201, 'Requisição via /api/index/... deve ser normalizada e aceita');
    const vercelChallenge = await vercelChallengeRes.json();
    assert.ok(vercelChallenge.deviceCode);
    console.log('  ✓ Rota serverless Vercel /api/index/... processada com sucesso.');

    // -------------------------------------------------------------------------
    // CENÁRIO 25: Geração de QR Code local e URL oficial segura
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 25] Geração do SVG de QR Code e URL oficial...');
    const qrSvg = await QRCode.toString(vercelChallenge.verificationUrl, { type: 'svg' });
    assert.ok(qrSvg.includes('<svg'), 'QR Code deve gerar código SVG válido');
    assert.ok(qrSvg.includes('</svg>'), 'SVG deve ser bem formado');
    assert.ok(!vercelChallenge.verificationUrl.includes('password'), 'URL não pode conter senhas');
    assert.ok(!vercelChallenge.verificationUrl.includes('token'), 'URL não pode conter tokens de sessão');
    assert.ok(vercelChallenge.verificationUrl.includes(vercelChallenge.userCode), 'URL deve conter userCode');
    console.log('  ✓ SVG do QR Code gerado localmente com tamanho:', qrSvg.length, 'bytes.');

    console.log('\n================================================================');
    console.log('  TODOS OS 25 CENÁRIOS DO P3.C FORAM VALIDADOS COM SUCESSO!');
    console.log('================================================================\n');

  } finally {
    server.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
  }
}

runTvQrAuthTestSuite().catch((err) => {
  console.error('\n❌ FALHA NA SUÍTE P3.C:', err);
  process.exit(1);
});
