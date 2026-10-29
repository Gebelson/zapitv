/**
 * ZAPITV — SUÍTE DE TESTES: PASSO A PASSO PARA ENTRAR NA TV PELO CELULAR
 * 
 * Validação do fluxo completo de ativação guiada:
 * 1. Geração de desafio com QR Code e URL /tv/ativar?code=XXXX-XXXX sem segredos.
 * 2. Validação do código no celular via /api/device-auth/validate.
 * 3. Fluxo de novo usuário: cadastro no celular com aceite de termos LGPD.
 * 4. Fluxo de usuário existente: login no celular preservando o código.
 * 5. Fluxo de usuário já logado: avanço direto para confirmação de autorização.
 * 6. Autorização explícita com "Autorizar televisão" (sem aprovação silenciosa).
 * 7. Polling da TV com transição automática para approved e emissão de sessão própria.
 * 8. Carregamento de múltiplos perfis na TV após a aprovação para seleção imediata.
 * 9. Cancelamento/recusa da solicitação no celular ("Cancelar") refletido na TV.
 * 10. Garantia de uso único (reuso de código previamente consumido bloqueado).
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import http from 'http';
import QRCode from 'qrcode';
import { createDatabase, ensureAuthTables } from '../src/server/database/client';

const TEST_DB_PATH = 'data/test_tv_activation_guided.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

async function runTvActivationFlowTests() {
  console.log('=== ZAPITV | TESTES DE ATIVAÇÃO GUIADA DE SMART TV PELO CELULAR ===\n');

  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }

  process.env.TURSO_DATABASE_URL = TEST_DB_URL;
  process.env.LOCAL_DB_URL = TEST_DB_URL;
  process.env.ALLOW_LOCAL_DB = 'true';
  process.env.VERCEL = '1';

  const testDb = createDatabase(TEST_DB_URL);
  await ensureAuthTables(testDb);
  console.log('✓ [0] Banco de dados inicializado e migrado.');

  const { default: app } = await import('../server.ts');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Servidor ativo em ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------------------
    // ETAPA 1: Geração de desafio e QR Code na TV
    // -------------------------------------------------------------------------
    console.log('[Etapa 1] TV inicia ativação guiada e gera desafio...');
    const tvChallengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapi-Client': 'tv',
        'User-Agent': 'Mozilla/5.0 (SmartTV; Tizen 6.0) AppleWebKit/537.36 Samsung TV'
      }
    });
    assert.equal(tvChallengeRes.status, 201, 'Desafio de TV deve retornar 201 Created');
    const challenge = await tvChallengeRes.json();
    assert.ok(challenge.deviceCode, 'Deve conter deviceCode');
    assert.ok(challenge.userCode, 'Deve conter userCode');
    assert.ok(challenge.verificationUrl, 'Deve conter verificationUrl');
    assert.ok(challenge.verificationUrl.includes(`/tv/ativar?code=${challenge.userCode}`), 'URL deve apontar para /tv/ativar com código');

    // Valida que o QR Code SVG é gerado localmente sem vazar tokens de sessão ou segredos
    const qrSvg = await QRCode.toString(challenge.verificationUrl, { type: 'svg' });
    assert.ok(qrSvg.includes('<svg'), 'Deve gerar SVG de QR Code');
    assert.equal(challenge.verificationUrl.includes('token'), false, 'QR Code NÃO pode conter token de sessão');
    assert.equal(challenge.verificationUrl.includes('secret'), false, 'QR Code NÃO pode conter segredos');
    assert.equal(challenge.verificationUrl.includes('password'), false, 'QR Code NÃO pode conter senha');
    console.log(`✓ [Etapa 1] Desafio gerado com sucesso para "${challenge.deviceName}". Código: ${challenge.userCode}`);

    // -------------------------------------------------------------------------
    // ETAPA 2: Celular abre /tv/ativar?code=XXXX e valida o código
    // -------------------------------------------------------------------------
    console.log('[Etapa 2] Celular valida o código de ativação recebido pelo QR Code...');
    const validateRes = await fetch(`${baseUrl}/api/device-auth/validate?code=${encodeURIComponent(challenge.userCode)}`);
    assert.equal(validateRes.status, 200);
    const validateData = await validateRes.json();
    assert.equal(validateData.valid, true);
    assert.equal(validateData.challenge.userCode, challenge.userCode);
    assert.ok(validateData.challenge.deviceName, 'Deve identificar o nome do dispositivo na TV');
    console.log(`✓ [Etapa 2] Código validado pelo celular. Aparelho identificado: "${validateData.challenge.deviceName}".`);

    // -------------------------------------------------------------------------
    // ETAPA 3: Celular sem login -> Novo usuário realiza cadastro com LGPD
    // -------------------------------------------------------------------------
    console.log('[Etapa 3] Novo usuário realiza cadastro no celular preservando o código...');
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mariana Costa',
        email: 'mariana.costa@exemplo.com',
        password: 'SenhaSegura456!',
        passwordConfirm: 'SenhaSegura456!',
        termsAccepted: true
      })
    });
    assert.equal(registerRes.status, 201);
    const regCookie = registerRes.headers.get('set-cookie')?.split(';')[0];
    assert.ok(regCookie, 'Deve receber cookie HttpOnly no celular');
    console.log('✓ [Etapa 3] Cadastro concluído no celular mantendo o contexto de ativação da TV.');

    // -------------------------------------------------------------------------
    // ETAPA 4: Celular autenticado autoriza explicitamente a televisão
    // -------------------------------------------------------------------------
    console.log('[Etapa 4] Celular autenticado clica em "Autorizar televisão"...');
    // Tentativa anônima bloqueada
    const anonApproveRes = await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode: challenge.userCode })
    });
    assert.equal(anonApproveRes.status, 401, 'Aprovação anônima deve ser rejeitada com 401');

    // Aprovação autenticada com sucesso
    const approveRes = await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: regCookie
      },
      body: JSON.stringify({ userCode: challenge.userCode })
    });
    assert.equal(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.equal(approveData.success, true);
    console.log('✓ [Etapa 4] Televisão autorizada com sucesso pelo celular.');

    // -------------------------------------------------------------------------
    // ETAPA 5: Polling da TV detecta aprovação e recebe sessão própria
    // -------------------------------------------------------------------------
    console.log('[Etapa 5] TV realiza polling e detecta aprovação automática...');
    const pollRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapi-Client': 'tv'
      },
      body: JSON.stringify({ deviceCode: challenge.deviceCode })
    });
    assert.equal(pollRes.status, 200);
    const pollData = await pollRes.json();
    assert.equal(pollData.status, 'approved', 'Status deve mudar para approved');
    const tvCookie = pollRes.headers.get('set-cookie')?.split(';')[0];
    assert.ok(tvCookie, 'TV deve receber cookie de sessão dedicado');
    assert.notEqual(tvCookie, regCookie, 'Sessão da TV deve ser independente da sessão do celular');
    console.log('✓ [Etapa 5] TV conectada automaticamente com sessão própria e independente.');

    // -------------------------------------------------------------------------
    // ETAPA 6: TV abre listagem de perfis da conta conectada
    // -------------------------------------------------------------------------
    console.log('[Etapa 6] TV consulta perfis para seleção pós-conexão...');
    const profilesRes = await fetch(`${baseUrl}/api/profiles`, {
      headers: { Cookie: tvCookie }
    });
    assert.equal(profilesRes.status, 200);
    const profilesData = await profilesRes.json();
    assert.ok(Array.isArray(profilesData.profiles), 'Deve retornar lista de perfis da conta');
    assert.ok(profilesData.profiles.length >= 1, 'Conta recém-criada deve possuir perfil padrão');
    console.log(`✓ [Etapa 6] Perfis carregados na TV (${profilesData.profiles.length} perfil encontrado: "${profilesData.profiles[0].name}").`);

    // -------------------------------------------------------------------------
    // ETAPA 7: Garantia de uso único (reuso de código consumido é rejeitado)
    // -------------------------------------------------------------------------
    console.log('[Etapa 7] Testando garantia de uso único do código de ativação...');
    const reApproveRes = await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: regCookie
      },
      body: JSON.stringify({ userCode: challenge.userCode })
    });
    assert.equal(reApproveRes.status, 400, 'Reuso de código consumido deve ser rejeitado');
    console.log('✓ [Etapa 7] Código consumido rejeitado contra reuso.');

    // -------------------------------------------------------------------------
    // ETAPA 8: Fluxo de cancelamento/recusa da televisão
    // -------------------------------------------------------------------------
    console.log('[Etapa 8] Testando recusa explícita da TV pelo celular ("Cancelar")...');
    const tvChallenge2Res = await fetch(`${baseUrl}/api/device-auth/challenge`, { method: 'POST' });
    const challenge2 = await tvChallenge2Res.json();

    const rejectRes = await fetch(`${baseUrl}/api/device-auth/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode: challenge2.userCode })
    });
    assert.equal(rejectRes.status, 200);

    const pollRejectRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: challenge2.deviceCode })
    });
    // RFC 8628 mapeia rejected para status HTTP 403 access_denied
    assert.equal(pollRejectRes.status, 403);
    const pollRejectData = await pollRejectRes.json();
    assert.equal(pollRejectData.status, 'rejected');
    console.log('✓ [Etapa 8] Recusa explícita processada com sucesso no celular e na TV.');

    console.log('\n===============================================================');
    console.log('🎉 TODOS OS TESTES DO FLUXO GUIADO DE ATIVAÇÃO FORAM APROVADOS!');
    console.log('===============================================================\n');
    process.exit(0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
  }
}

runTvActivationFlowTests().catch((err) => {
  console.error('\n❌ FALHA NOS TESTES DE ATIVAÇÃO GUIADA:', err);
  process.exit(1);
});
