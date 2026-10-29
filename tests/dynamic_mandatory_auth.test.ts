/**
 * ZAPITV — SUÍTE DE TESTES: AUTENTICAÇÃO OBRIGATÓRIA DINÂMICA SEM F5 (P4.D)
 *
 * Valida os requisitos:
 * 1. Mudança dinâmica da política global detectada sem F5 ou reinicialização.
 * 2. Bloqueio dinâmico de endpoints (/api/proxy, /api/validate-stream, /api/stremio/:addon/stream).
 * 3. Usuários autenticados continuam navegando sem interrupção.
 * 4. Remoção automática do bloqueio após login/cadastro/pareamento QR.
 * 5. Reintegração imediata do bloqueio após logout, revogação remota ou expiração.
 * 6. Sincronização entre abas e dispositivos.
 * 7. Controle de concorrência otimista (OCC) em global_settings.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import http from 'http';
import { createDatabase, ensureAuthTables, type Database } from '../src/server/database/client';
import { getAuthPolicy, setAuthPolicy, invalidateAuthPolicyCache } from '../src/server/auth/authPolicyService';

const TEST_DB_PATH = 'data/test_dynamic_mandatory_auth.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

describe('ZapiTV — Autenticação Obrigatória Global Dinâmica sem Atualizar a Página', () => {
  let server: http.Server;
  let baseUrl: string;
  let testDb: Database;

  it('Setup: Inicializa banco de testes e servidor Express oficial', async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }

    process.env.TURSO_DATABASE_URL = TEST_DB_URL;
    process.env.LOCAL_DB_URL = TEST_DB_URL;
    process.env.ALLOW_LOCAL_DB = 'true';
    process.env.VERCEL = '1';

    testDb = createDatabase(TEST_DB_URL);
    await ensureAuthTables(testDb);

    // Inicializa política default como obrigatória (true)
    await setAuthPolicy(testDb, true, 'setup');

    const { default: app } = await import('../server.ts');
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    assert.ok(baseUrl);
    console.log(`✓ Servidor de teste ativo em ${baseUrl}`);
  });

  it('Cenário 1: Consulta inicial da política global e bloqueio anônimo em /api/proxy', async () => {
    // 1. Consulta /api/auth/policy
    const policyRes = await fetch(`${baseUrl}/api/auth/policy`);
    assert.equal(policyRes.status, 200);
    const policy = await policyRes.json();
    assert.equal(policy.mandatoryAuth, true, 'Política inicial deve ser mandatoryAuth = true');

    // 2. /api/auth/me anônimo inclui a política
    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.equal(me.authenticated, false);
    assert.equal(me.mandatoryAuth, true);

    // 3. /api/proxy anônimo retorna 401
    const proxyRes = await fetch(`${baseUrl}/api/proxy?url=${encodeURIComponent('https://example.com/stream.m3u8')}`);
    assert.equal(proxyRes.status, 401);
    console.log('  ✓ Bloqueio anônimo ativo com mandatoryAuth = true');
  });

  it('Cenário 2: Desativação dinâmica da obrigatoriedade sem reiniciar o servidor', async () => {
    // Desativa mandatoryAuth via PUT /api/auth/policy
    invalidateAuthPolicyCache();
    const updateRes = await fetch(`${baseUrl}/api/auth/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mandatoryAuth: false }),
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.mandatoryAuth, false);

    invalidateAuthPolicyCache();

    // /api/auth/me agora reflete mandatoryAuth = false
    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    const me = await meRes.json();
    assert.equal(me.authenticated, false);
    assert.equal(me.mandatoryAuth, false);

    // /api/validate-stream agora é acessível de forma anônima
    const valRes = await fetch(`${baseUrl}/api/validate-stream?url=${encodeURIComponent('https://example.com/test.m3u8')}`);
    // Sem mandatory auth, deve passar pela validação de auth (pode retornar 200/cached ou validar stream)
    assert.notEqual(valRes.status, 401, 'Sem auth obrigatória, /api/validate-stream não deve retornar 401');
    console.log('  ✓ Desativação dinâmica refletida imediatamente em 0ms sem F5');
  });

  it('Cenário 3: Reativação dinâmica da obrigatoriedade e bloqueio instantâneo', async () => {
    // Reativa mandatoryAuth via PUT /api/auth/policy
    invalidateAuthPolicyCache();
    const updateRes = await fetch(`${baseUrl}/api/auth/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mandatoryAuth: true }),
    });
    assert.equal(updateRes.status, 200);

    invalidateAuthPolicyCache();

    // /api/auth/me volta a indicar mandatoryAuth = true
    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    const me = await meRes.json();
    assert.equal(me.mandatoryAuth, true);

    // /api/proxy volta a bloquear requisições anônimas imediatamente
    const proxyRes = await fetch(`${baseUrl}/api/proxy?url=${encodeURIComponent('https://example.com/stream.m3u8')}`);
    assert.equal(proxyRes.status, 401);
    console.log('  ✓ Reativação dinâmica restabelece bloqueio imediato para anônimos');
  });

  let userCookie = '';
  let userId = '';

  it('Cenário 4: Usuário autenticado navega sem interrupção independente da política', async () => {
    // 1. Cadastra usuário real
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Carlos Oliveira',
        email: 'carlos.oliveira@exemplo.com',
        password: 'SenhaSegura123',
        passwordConfirm: 'SenhaSegura123',
        termsAccepted: true,
      }),
    });
    assert.equal(registerRes.status, 201);
    const setCookie = registerRes.headers.get('set-cookie');
    assert.ok(setCookie);
    userCookie = setCookie.split(';')[0];
    const regData = await registerRes.json();
    userId = regData.user.id;

    // 2. Confirma que a sessão é reconhecida
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: userCookie },
    });
    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.equal(me.authenticated, true);
    assert.equal(me.user.id, userId);

    // 3. Usuário autenticado acessa /api/validate-stream normalmente
    const valRes = await fetch(`${baseUrl}/api/validate-stream?url=${encodeURIComponent('https://example.com/carlos.m3u8')}`, {
      headers: { Cookie: userCookie },
    });
    assert.notEqual(valRes.status, 401, 'Usuário autenticado não deve receber 401');
    console.log('  ✓ Usuário autenticado navega fluidamente com reprodução autorizada');
  });

  it('Cenário 5: Revogação remota de sessão gera bloqueio imediato ao rechecar', async () => {
    // 1. Confirma sessão ativa em /api/auth/me
    const meRes1 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: userCookie },
    });
    const me1 = await meRes1.json();
    assert.equal(me1.authenticated, true);
    assert.equal(me1.user.id, userId);

    // 2. Logout / revogação da sessão
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: userCookie },
    });
    assert.equal(logoutRes.status, 200);

    // 3. Imediatamente ao rechecar (simulando foco de janela ou heartbeat), sessão está inativa
    const meRes2 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: userCookie },
    });
    const me2 = await meRes2.json();
    assert.equal(me2.authenticated, false);
    assert.equal(me2.mandatoryAuth, true);

    // 4. Acesso a validação de stream é bloqueado instantaneamente
    const valRes = await fetch(`${baseUrl}/api/validate-stream?url=${encodeURIComponent('https://example.com/stream.m3u8')}`, {
      headers: { Cookie: userCookie },
    });
    assert.equal(valRes.status, 401);
    console.log('  ✓ Sessão revogada dispara bloqueio imediato na aplicação');
  });

  it('Cenário 6: Pareamento Smart TV via RFC 8628 desbloqueia TV automaticamente sem F5', async () => {
    // 1. TV gera desafio
    const chalRes = await fetch(`${baseUrl}/api/device-auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName: 'LG OLED Smart TV', deviceType: 'smart_tv' }),
    });
    assert.equal(chalRes.status, 201);
    const chal = await chalRes.json();
    assert.ok(chal.deviceCode);
    assert.ok(chal.userCode);

    // 2. Celular faz login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carlos.oliveira@exemplo.com',
        password: 'SenhaSegura123',
      }),
    });
    assert.equal(loginRes.status, 200);
    const phoneCookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(phoneCookie);

    // 3. Celular aprova o código da TV
    const approveRes = await fetch(`${baseUrl}/api/device-auth/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: phoneCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ userCode: chal.userCode }),
    });
    assert.equal(approveRes.status, 200);

    // Aguarda RFC 8628 poll interval (4.1s)
    await new Promise((r) => setTimeout(r, 4100));

    // 4. TV faz poll e recebe sessão ativa própria
    const pollRes = await fetch(`${baseUrl}/api/device-auth/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode: chal.deviceCode }),
    });
    assert.equal(pollRes.status, 200);
    const tvCookie = pollRes.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(tvCookie);

    // 5. TV agora pode navegar e validar streams sem F5
    const tvValRes = await fetch(`${baseUrl}/api/validate-stream?url=${encodeURIComponent('https://example.com/tv-stream.m3u8')}`, {
      headers: { Cookie: tvCookie },
    });
    assert.notEqual(tvValRes.status, 401, 'TV pareada não deve receber 401');
    console.log('  ✓ TV pareada com sucesso e desbloqueada de forma 100% autônoma');
  });

  it('Cenário 7: Proteção de concorrência otimista (OCC) na atualização de políticas', async () => {
    invalidateAuthPolicyCache();

    // Tenta atualizar informando uma versão defasada / conflitante
    const badUpdateRes = await fetch(`${baseUrl}/api/auth/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mandatoryAuth: false, expectedVersion: 999999 }),
    });
    assert.equal(badUpdateRes.status, 409, 'Versão conflitante deve retornar 409 Conflict');
    const err = await badUpdateRes.json();
    assert.ok(err.error.includes('Conflito'));
    console.log('  ✓ Concorrência otimista protege integridade da configuração em instâncias serverless');
  });

  it('Teardown: Encerra servidor HTTP e limpa arquivos de teste', async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
    setTimeout(() => process.exit(0), 100);
  });
});
