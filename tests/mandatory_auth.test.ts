/**
 * ZAPITV — SUÍTE DE TESTES DE AUTENTICAÇÃO OBRIGATÓRIA (MANDATORY AUTH TEST SUITE)
 * 
 * Validação exaustiva e determinística:
 * 1. Bloqueio de streaming em endpoints protegidos para anônimos (401 Unauthorized).
 * 2. Bloqueio de /api/validate-stream e Stremio streams para anônimos (401).
 * 3. Prevenção de SSRF preservada em /api/proxy (502 para loopback).
 * 4. Preservação de endpoints públicos (/api/health, /api/auth/me, /api/device-auth/*).
 * 5. Cadastro com validação obrigatória dos Termos LGPD e emissão de cookie HttpOnly.
 * 6. Consulta de sessão em /api/auth/me com cookie emitido.
 * 7. Liberação de endpoints de streaming para usuário autenticado.
 * 8. Logout e revogação imediata de sessão (bloqueio subsequente a /api/proxy).
 * 9. Pareamento Smart TV via RFC 8628 (desafio -> polling pendente -> aprovação -> concessão de sessão).
 * 10. Acesso a streaming na TV após pareamento bem-sucedido.
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createDatabase, ensureAuthTables } from '../src/server/database/client';

const TEST_DB_PATH = 'data/test_mandatory_auth.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

async function runMandatoryAuthTestSuite() {
  console.log('=== ZAPITV | VALIDAÇÃO DE AUTENTICAÇÃO OBRIGATÓRIA EM TODOS OS DISPOSITIVOS ===\n');

  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }

  process.env.TURSO_DATABASE_URL = TEST_DB_URL;
  process.env.LOCAL_DB_URL = TEST_DB_URL;
  process.env.ALLOW_LOCAL_DB = 'true';
  process.env.VERCEL = '1';

  const testDb = createDatabase(TEST_DB_URL);
  await ensureAuthTables(testDb);
  console.log('✓ [0] Banco de dados de teste inicializado e migrado.');

  const { default: app } = await import('../server.ts');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Servidor ativo em ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------------------
    // CENÁRIO 1: Bloqueio de streaming em /api/proxy para usuário anônimo (401)
    // -------------------------------------------------------------------------
    console.log('[Cenário 1] Testando bloqueio anônimo em /api/proxy...');
    const proxyAnonRes = await fetch(`${baseUrl}/api/proxy?url=${encodeURIComponent('https://example.com/stream.m3u8')}`);
    assert.equal(proxyAnonRes.status, 401, 'Requisição anônima a /api/proxy deve retornar 401 Unauthorized');
    const proxyAnonBody = await proxyAnonRes.json();
    assert.ok(proxyAnonBody.error.includes('Autenticação necessária'), 'Mensagem amigável de autenticação exigida');
    console.log('✓ [Cenário 1] /api/proxy anônimo bloqueado com 401 Unauthorized.');

    // -------------------------------------------------------------------------
    // CENÁRIO 2: Bloqueio de /api/validate-stream para usuário anônimo (401)
    // -------------------------------------------------------------------------
    console.log('[Cenário 2] Testando bloqueio anônimo em /api/validate-stream...');
    const valAnonRes = await fetch(`${baseUrl}/api/validate-stream?url=${encodeURIComponent('https://example.com/stream.m3u8')}`);
    assert.equal(valAnonRes.status, 401, 'Requisição anônima a /api/validate-stream deve retornar 401 Unauthorized');
    const valAnonBody = await valAnonRes.json();
    assert.ok(valAnonBody.error.includes('Autenticação necessária'), 'Mensagem amigável de autenticação exigida');
    console.log('✓ [Cenário 2] /api/validate-stream anônimo bloqueado com 401 Unauthorized.');

    // -------------------------------------------------------------------------
    // CENÁRIO 3: Bloqueio de /api/stremio/:addon/stream para anônimo (401)
    // -------------------------------------------------------------------------
    console.log('[Cenário 3] Testando bloqueio anônimo em /api/stremio/:addon/stream...');
    const stremioAnonRes = await fetch(`${baseUrl}/api/stremio/mockaddon/stream/movie/tt1234567.json`);
    assert.equal(stremioAnonRes.status, 401, 'Requisição anônima a stream do Stremio deve retornar 401 Unauthorized');
    console.log('✓ [Cenário 3] /api/stremio/:addon/stream anônimo bloqueado com 401 Unauthorized.');

    // -------------------------------------------------------------------------
    // CENÁRIO 4: SSRF bloqueado em /api/proxy antes de qualquer target privado
    // -------------------------------------------------------------------------
    console.log('[Cenário 4] Testando proteção SSRF em /api/proxy...');
    const ssrfRes = await fetch(`${baseUrl}/api/proxy?url=${encodeURIComponent('http://127.0.0.1:4000/')}`);
    assert.equal(ssrfRes.status, 502, 'Tentativa de SSRF em loopback deve retornar 502');
    console.log('✓ [Cenário 4] SSRF bloqueado com 502 Bad Gateway.');

    // -------------------------------------------------------------------------
    // CENÁRIO 5: Preservação de endpoints públicos
    // -------------------------------------------------------------------------
    console.log('[Cenário 5] Testando disponibilidade dos endpoints públicos...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200, '/api/health deve ser público');

    const authMeAnonRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(authMeAnonRes.status, 200, '/api/auth/me anônimo deve retornar 200 OK');
    const authMeAnonData = await authMeAnonRes.json();
    assert.equal(authMeAnonData.authenticated, false);
    assert.equal(authMeAnonData.user, null);

    const challengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, { method: 'POST' });
    assert.equal(challengeRes.status, 201, '/api/device-auth/challenge deve ser público para Smart TVs');
    const challengeData = await challengeRes.json();
    assert.ok(challengeData.deviceCode, 'Deve retornar deviceCode');
    assert.ok(challengeData.userCode, 'Deve retornar userCode');
    console.log('✓ [Cenário 5] Endpoints públicos funcionando corretamente.');

    // -------------------------------------------------------------------------
    // CENÁRIO 6: Cadastro de usuário com validação de Termos LGPD e cookie
    // -------------------------------------------------------------------------
    console.log('[Cenário 6] Testando cadastro e aceite obrigatório de Termos LGPD...');
    // Tentativa sem aceite de termos
    const regWithoutTermsRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Carlos Silva',
        email: 'carlos.silva@exemplo.com',
        password: 'SenhaForte123!',
        passwordConfirm: 'SenhaForte123!',
        termsAccepted: false
      })
    });
    assert.equal(regWithoutTermsRes.status, 400, 'Cadastro sem aceite de termos deve ser rejeitado');

    // Cadastro válido com termos aceitos
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Carlos Silva',
        email: 'carlos.silva@exemplo.com',
        password: 'SenhaForte123!',
        passwordConfirm: 'SenhaForte123!',
        termsAccepted: true
      })
    });
    assert.equal(regRes.status, 201, 'Cadastro com termos aceitos deve retornar 201 Created');
    const regCookieHeader = regRes.headers.get('set-cookie');
    assert.ok(regCookieHeader, 'Deve conter Set-Cookie com a sessão');
    assert.ok(regCookieHeader.includes('HttpOnly'), 'Cookie de sessão deve ser HttpOnly');
    const userCookie = regCookieHeader.split(';')[0];

    // Validação da sessão em /api/auth/me
    const authMeUserRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: userCookie }
    });
    assert.equal(authMeUserRes.status, 200);
    const authMeUserData = await authMeUserRes.json();
    assert.equal(authMeUserData.authenticated, true);
    assert.equal(authMeUserData.user.email, 'carlos.silva@exemplo.com');
    console.log('✓ [Cenário 6] Cadastro com LGPD e emissão de cookie HttpOnly aprovados.');

    // -------------------------------------------------------------------------
    // CENÁRIO 7: Usuário autenticado acessa endpoints protegidos
    // -------------------------------------------------------------------------
    console.log('[Cenário 7] Testando acesso autenticado a /api/proxy...');
    // Simula uma URL externa válida para o proxy com cookie autenticado
    const proxyAuthRes = await fetch(`${baseUrl}/api/proxy?url=${encodeURIComponent('https://httpbin.org/get')}`, {
      headers: { Cookie: userCookie }
    });
    // Não pode retornar 401 Unauthorized
    assert.notEqual(proxyAuthRes.status, 401, 'Usuário autenticado não pode receber 401');
    console.log(`✓ [Cenário 7] Acesso autenticado permitido (status: ${proxyAuthRes.status}).`);

    // -------------------------------------------------------------------------
    // CENÁRIO 8: Logout e revogação imediata da sessão
    // -------------------------------------------------------------------------
    console.log('[Cenário 8] Testando logout e revogação de sessão...');
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: userCookie }
    });
    assert.equal(logoutRes.status, 200);
    const logoutCookie = logoutRes.headers.get('set-cookie');
    assert.ok(logoutCookie?.includes('Max-Age=0') || logoutCookie?.includes('expires='), 'Cookie deve ser limpo');

    // Sessão antiga deve ser rejeitada imediatamente
    const postLogoutMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: userCookie }
    });
    assert.equal((await postLogoutMeRes.json()).authenticated, false);

    const postLogoutProxyRes = await fetch(`${baseUrl}/api/proxy?url=${encodeURIComponent('https://example.com/stream.m3u8')}`, {
      headers: { Cookie: userCookie }
    });
    assert.equal(postLogoutProxyRes.status, 401, 'Sessão revogada no logout deve receber 401 Unauthorized');
    console.log('✓ [Cenário 8] Logout revoga a sessão imediatamente no servidor.');

    // -------------------------------------------------------------------------
    // CENÁRIO 9: Pareamento Smart TV via RFC 8628 e concessão de sessão
    // -------------------------------------------------------------------------
    console.log('[Cenário 9] Testando pareamento Smart TV via RFC 8628...');
    // 1. Login do usuário no celular para obter sessão
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carlos.silva@exemplo.com',
        password: 'SenhaForte123!'
      })
    });
    assert.equal(loginRes.status, 200);
    const phoneCookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(phoneCookie);

    // 2. TV gera desafio
    const tvChallengeRes = await fetch(`${baseUrl}/api/device-auth/challenge`, { method: 'POST' });
    assert.equal(tvChallengeRes.status, 201);
    const tvChallenge = await tvChallengeRes.json();
    const { deviceCode, userCode } = tvChallenge;

    // 3. TV inicia polling inicial (deve retornar pending)
    const tvPollPending = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode })
    });
    assert.equal(tvPollPending.status, 200);
    assert.equal((await tvPollPending.json()).status, 'pending');

    // 4. Celular aprova o código da TV
    const approveRes = await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: phoneCookie
      },
      body: JSON.stringify({
        userCode,
        deviceName: 'Samsung Tizen 4K TV'
      })
    });
    assert.equal(approveRes.status, 200);

    // Aguarda intervalo mínimo de polling da RFC 8628 (evita slow_down)
    await new Promise((resolve) => setTimeout(resolve, 4100));

    // 5. TV realiza polling seguinte (deve retornar approved + cookie de sessão da TV)
    const tvPollApproved = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode })
    });
    assert.equal(tvPollApproved.status, 200);
    const tvApprovedData = await tvPollApproved.json();
    assert.equal(tvApprovedData.status, 'approved');
    const tvCookieHeader = tvPollApproved.headers.get('set-cookie');
    assert.ok(tvCookieHeader, 'TV deve receber cookie de sessão dedicado');
    const tvCookie = tvCookieHeader.split(';')[0];

    // 6. TV valida sua sessão
    const tvAuthMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: tvCookie }
    });
    assert.equal(tvAuthMeRes.status, 200);
    assert.equal((await tvAuthMeRes.json()).authenticated, true);

    // 7. TV acessa proxy de streaming
    const tvProxyRes = await fetch(`${baseUrl}/api/proxy?url=${encodeURIComponent('https://httpbin.org/get')}`, {
      headers: { Cookie: tvCookie }
    });
    assert.notEqual(tvProxyRes.status, 401, 'TV vinculada não pode receber 401 no proxy');
    console.log('✓ [Cenário 9] Pareamento de TV via RFC 8628 e liberação de sessão concluídos com sucesso.');

    console.log('\n===============================================================');
    console.log('🎉 TODOS OS CENÁRIOS DE AUTENTICAÇÃO OBRIGATÓRIA FORAM APROVADOS!');
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

runMandatoryAuthTestSuite().catch((err) => {
  console.error('\n❌ FALHA NA SUÍTE DE TESTES:', err);
  process.exit(1);
});
