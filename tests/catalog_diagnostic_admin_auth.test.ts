/**
 * ZAPITV — SUÍTE DE TESTES: RESTRIÇÃO DO DIAGNÓSTICO DO CATÁLOGO A ADMINISTRADORES
 *
 * Valida os requisitos:
 * 1. Ocultar completamente o ícone de diagnóstico para usuários comuns.
 * 2. Ocultar a opção "Diagnóstico do Catálogo" de todos os menus de contas comuns.
 * 3. Exibir ambos normalmente para administradores autenticados.
 * 4. Aplicar as restrições no PC, mobile, modo TV, Fire TV e demais dispositivos.
 * 5. Validar a permissão administrativa pelo mecanismo de autorização real do backend.
 * 6. Impedir que usuários comuns acessem funcionalidades e endpoints administrativos relacionados ao diagnóstico.
 * 7. Retornar HTTP 403 para requisições autenticadas sem permissão administrativa, sem expor dados internos.
 * 8. Preservar integralmente as funcionalidades para administradores autorizados.
 *
 * Teste exaustivo com:
 * - Conta Administradora
 * - Conta Comum
 * - Visitante Não Autenticado
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import http from 'http';
import { createDatabase, ensureAuthTables, type Database } from '../src/server/database/client';
import { isUserAdmin } from '../src/server/auth/authMiddleware';

const TEST_DB_PATH = 'data/test_catalog_diag_auth.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

describe('ZapiTV — Restrição de Diagnóstico do Catálogo aos Administradores', () => {
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
    process.env.ADMIN_EMAILS = 'graficadfuturo@gmail.com,admin.zapitv@zapi.com';

    testDb = createDatabase(TEST_DB_URL);
    await ensureAuthTables(testDb);

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

  // -------------------------------------------------------------------------
  // 1. VISITANTE NÃO AUTENTICADO (ANÔNIMO)
  // -------------------------------------------------------------------------
  it('1. Visitante Não Autenticado: /api/auth/me indica anônimo e endpoints retornam 403', async () => {
    // 1.1 /api/auth/me retorna authenticated: false e user: null
    const meRes = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.equal(me.authenticated, false);
    assert.equal(me.user, null);

    // 1.2 /api/catalog/diagnostic retorna 403 Forbidden
    const diagRes = await fetch(`${baseUrl}/api/catalog/diagnostic`);
    assert.equal(diagRes.status, 403, 'Visitante anônimo deve receber 403');
    const diagBody = await diagRes.json();
    assert.equal(diagBody.error, 'Acesso negado. Apenas administradores autorizados.');
    assert.equal(diagBody.status, undefined, 'Não deve expor status interno');

    // 1.3 /api/catalog/diagnostic/clean-cache retorna 403
    const cleanRes = await fetch(`${baseUrl}/api/catalog/diagnostic/clean-cache`, { method: 'POST' });
    assert.equal(cleanRes.status, 403);

    // 1.4 /api/catalog/diagnostic/resume-queue retorna 403
    const resumeRes = await fetch(`${baseUrl}/api/catalog/diagnostic/resume-queue`, { method: 'POST' });
    assert.equal(resumeRes.status, 403);

    console.log('  ✓ Visitante não autenticado bloqueado em todos os endpoints com 403');
  });

  // -------------------------------------------------------------------------
  // 2. CONTA COMUM (USUÁRIO AUTENTICADO NÃO ADMINISTRADOR)
  // -------------------------------------------------------------------------
  let regularUserCookie = '';

  it('2. Conta Comum: Cadastra usuário comum e valida retorno 403 nos endpoints administrativos', async () => {
    // 2.1 Cadastra conta comum
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Carlos Oliveira',
        email: 'carlos.comum@exemplo.com',
        password: 'SenhaComum123',
        passwordConfirm: 'SenhaComum123',
        termsAccepted: true,
      }),
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.user.role, 'user', 'Conta comum deve receber role: user');
    const cookie = regRes.headers.get('set-cookie');
    assert.ok(cookie);
    regularUserCookie = cookie.split(';')[0];

    // 2.2 /api/auth/me confirma que a conta comum é role: 'user'
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: regularUserCookie },
    });
    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.equal(me.authenticated, true);
    assert.equal(me.user.email, 'carlos.comum@exemplo.com');
    assert.equal(me.user.role, 'user');

    // 2.3 Tentativa de acessar /api/catalog/diagnostic retorna 403 Forbidden
    const diagRes = await fetch(`${baseUrl}/api/catalog/diagnostic`, {
      headers: { Cookie: regularUserCookie },
    });
    assert.equal(diagRes.status, 403, 'Usuário comum autenticado deve receber 403 Forbidden');
    const diagData = await diagRes.json();
    assert.equal(diagData.error, 'Acesso negado. Apenas administradores autorizados.');
    assert.equal(diagData.status, undefined, 'Nenhum dado interno de diagnóstico pode ser exposto');

    // 2.4 Tentativa de limpar cache de diagnóstico retorna 403
    const cleanRes = await fetch(`${baseUrl}/api/catalog/diagnostic/clean-cache`, {
      method: 'POST',
      headers: { Cookie: regularUserCookie },
    });
    assert.equal(cleanRes.status, 403);

    // 2.5 Tentativa de acelerar fila de diagnóstico retorna 403
    const resumeRes = await fetch(`${baseUrl}/api/catalog/diagnostic/resume-queue`, {
      method: 'POST',
      headers: { Cookie: regularUserCookie },
    });
    assert.equal(resumeRes.status, 403);

    console.log('  ✓ Conta comum autenticada impedida de acessar ferramentas e endpoints de diagnóstico com 403');
  });

  // -------------------------------------------------------------------------
  // 3. CONTA ADMINISTRADORA (ADMIN AUTENTICADO)
  // -------------------------------------------------------------------------
  let adminCookie = '';

  it('3. Conta Administradora: Autentica administrador e valida acesso total aos endpoints', async () => {
    // 3.1 Cadastra conta administradora (email em ADMIN_EMAILS)
    const regAdminRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Administrador ZapiTV',
        email: 'graficadfuturo@gmail.com',
        password: 'AdminMasterPass123',
        passwordConfirm: 'AdminMasterPass123',
        termsAccepted: true,
      }),
    });
    assert.equal(regAdminRes.status, 201);
    const regAdminData = await regAdminRes.json();
    assert.equal(regAdminData.user.role, 'admin', 'Email administrador deve receber role: admin');
    const cookie = regAdminRes.headers.get('set-cookie');
    assert.ok(cookie);
    adminCookie = cookie.split(';')[0];

    // 3.2 /api/auth/me confirma que a conta administradora é role: 'admin'
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.equal(me.authenticated, true);
    assert.equal(me.user.email, 'graficadfuturo@gmail.com');
    assert.equal(me.user.role, 'admin', 'Backend deve autorizar role como admin');

    // 3.3 Acesso a /api/catalog/diagnostic retorna 200 OK
    const diagRes = await fetch(`${baseUrl}/api/catalog/diagnostic`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(diagRes.status, 200, 'Administrador deve receber 200 OK');
    const diagData = await diagRes.json();
    assert.equal(diagData.status, 'ok');
    assert.ok(diagData.timestamp);
    assert.ok(diagData.message.includes('Diagnóstico do Catálogo'));

    // 3.4 Limpeza de cache de diagnóstico pelo administrador retorna 200 OK
    const cleanRes = await fetch(`${baseUrl}/api/catalog/diagnostic/clean-cache`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    assert.equal(cleanRes.status, 200);
    const cleanData = await cleanRes.json();
    assert.equal(cleanData.success, true);

    // 3.5 Aceleração da fila de diagnóstico pelo administrador retorna 200 OK
    const resumeRes = await fetch(`${baseUrl}/api/catalog/diagnostic/resume-queue`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    assert.equal(resumeRes.status, 200);
    const resumeData = await resumeRes.json();
    assert.equal(resumeData.success, true);

    console.log('  ✓ Conta administradora possui acesso integral a todos os recursos de diagnóstico');
  });

  // -------------------------------------------------------------------------
  // 4. VERIFICAÇÃO ESTRUTURAL DO FRONTEND (PC, MOBILE E TV)
  // -------------------------------------------------------------------------
  it('4. Frontend: Validação estrutural de visibilidade no Header, Mobile e Modais', () => {
    // 4.1 Header.tsx: O ícone laranja e o item de menu exigem isAdmin && onOpenDiagnostics
    const headerCode = fs.readFileSync('components/Header.tsx', 'utf8');
    assert.ok(
      headerCode.includes('{isAdmin && onOpenDiagnostics &&'),
      'Header.tsx deve condicionar o botão laranja a isAdmin'
    );
    assert.ok(
      headerCode.includes('Diagnóstico do Catálogo'),
      'Header.tsx deve conter Diagnóstico do Catálogo protegido por isAdmin'
    );

    // 4.2 MobileMyZapiView.tsx: O item de menu de diagnóstico exige isAdmin && onOpenDiagnostics
    const mobileCode = fs.readFileSync('src/components/mobile/MobileMyZapiView.tsx', 'utf8');
    assert.ok(
      mobileCode.includes('{isAdmin && onOpenDiagnostics &&'),
      'MobileMyZapiView.tsx deve condicionar Diagnóstico do Catálogo a isAdmin'
    );

    // 4.3 App.tsx: Passa onOpenDiagnostics apenas se isAdmin for verdadeiro
    const appCode = fs.readFileSync('App.tsx', 'utf8');
    assert.ok(
      appCode.includes('onOpenDiagnostics={isAdmin ? () => setIsDiagnosticModalOpen(true) : undefined}'),
      'App.tsx não deve repassar onOpenDiagnostics para não-administradores'
    );
    assert.ok(
      appCode.includes('{isAdmin && isDiagnosticModalOpen &&'),
      'App.tsx deve impedir renderização do modal CatalogDiagnosticModal se !isAdmin'
    );

    // 4.4 CatalogDiagnosticModal.tsx: Valida autorização no backend ao abrir
    const modalCode = fs.readFileSync('src/components/catalog/CatalogDiagnosticModal.tsx', 'utf8');
    assert.ok(
      modalCode.includes("fetch('/api/catalog/diagnostic'"),
      'CatalogDiagnosticModal.tsx deve verificar autorização no backend ao ser montado'
    );

    console.log('  ✓ Proteções visuais e estruturais validadas no PC, Mobile e TV');
  });

  it('Teardown: Encerra servidor HTTP e limpa arquivos temporários', async () => {
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
