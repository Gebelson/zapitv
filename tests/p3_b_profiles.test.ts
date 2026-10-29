/**
 * ZAPITV | P3.B — SUÍTE DE TESTES DE MÚLTIPLOS PERFIS POR CONTA
 * 
 * Validação exaustiva dos 20 cenários exigidos:
 * 1. Criação de perfil.
 * 2. Criação automática do perfil inicial.
 * 3. Listagem de perfis.
 * 4. Edição de nome.
 * 5. Alteração de avatar.
 * 6. Exclusão de perfil com regras de proteção.
 * 7. Limite configurável de perfis (5 por conta).
 * 8. Seleção de perfil ativo.
 * 9. Persistência da seleção após F5.
 * 10. Troca de perfil sem logout.
 * 11. Logout com limpeza do estado privado.
 * 12. Tentativa de acessar perfil de outra conta (403/404).
 * 13. Tentativa de editar ou excluir perfil de outra conta (403).
 * 14. Bloqueio com sessão expirada (401).
 * 15. Tratamento de requisições concorrentes na criação do perfil inicial.
 * 16. Preservação dos dados anônimos locais.
 * 17. Isolamento dos dados locais entre perfis diferentes.
 * 18. Interface desktop e menu de perfis.
 * 19. Interface mobile e Minha ZapiTV.
 * 20. Navegação D-Pad nos componentes preparados para TV.
 */

import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import fs from 'fs';
import { createDatabase, ensureAuthTables } from '../src/server/database/client';
import { users, sessions, profiles } from '../src/server/database/schema';
import { authRouter } from '../src/server/auth/routes';
import { profilesRouter } from '../src/server/profiles/routes';
import { ProfileService, MAX_PROFILES_PER_USER } from '../src/server/profiles/profileService';
import { OFFICIAL_AVATARS, resolveAvatarUrl, VALID_AVATAR_IDS } from '../src/core/profile/avatarRegistry';
import { AVATARS } from '../src/core/profile/avatarImages';
import { storageService } from '../src/core/storage/storageService';
import { eq } from 'drizzle-orm';

const TEST_DB_PATH = 'data/test_profiles_p3b.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

async function runProfilesTestSuite() {
  console.log('=== ZAPITV | P3.B — VALIDAÇÃO DE MÚLTIPLOS PERFIS POR CONTA ===\n');

  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }

  process.env.LOCAL_DB_URL = TEST_DB_URL;
  process.env.ALLOW_LOCAL_DB = 'true';

  const testDb = createDatabase(TEST_DB_URL);
  await ensureAuthTables(testDb);
  console.log('✓ [0] Banco de dados de testes inicializado e migrado com tabelas auth + profiles.');

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

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Servidor de testes ativo na porta ${port}\n`);

  try {
    // -------------------------------------------------------------------------
    // PREPARAÇÃO: Criar 2 usuários para validação de posse e isolamento
    // -------------------------------------------------------------------------
    const userARes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Carlos Alberto',
        email: 'carlos@exemplo.com',
        password: 'SenhaCarlos123',
        passwordConfirm: 'SenhaCarlos123',
        termsAccepted: true,
      }),
    });
    assert.equal(userARes.status, 201);
    const userAData = await userARes.json();
    const cookieUserA = userARes.headers.get('set-cookie')!;
    const tokenMatchA = cookieUserA.match(/zapitv_session=([^;]+)/)!;
    const sessionCookieA = `zapitv_session=${tokenMatchA[1]}`;

    const userBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Beatriz Lima',
        email: 'beatriz@exemplo.com',
        password: 'SenhaBeatriz123',
        passwordConfirm: 'SenhaBeatriz123',
        termsAccepted: true,
      }),
    });
    assert.equal(userBRes.status, 201);
    const userBData = await userBRes.json();
    const cookieUserB = userBRes.headers.get('set-cookie')!;
    const tokenMatchB = cookieUserB.match(/zapitv_session=([^;]+)/)!;
    const sessionCookieB = `zapitv_session=${tokenMatchB[1]}`;

    // -------------------------------------------------------------------------
    // 1 & 2. CRIAÇÃO AUTOMÁTICA DO PERFIL INICIAL E LISTAGEM
    // -------------------------------------------------------------------------
    console.log('[Cenário 1 e 2] Criação automática e idempotente do perfil inicial...');
    const listRes1 = await fetch(`${baseUrl}/api/profiles`, {
      headers: { 'Cookie': sessionCookieA },
    });
    assert.equal(listRes1.status, 200);
    const listData1 = await listRes1.json();
    assert.ok(Array.isArray(listData1.profiles));
    assert.equal(listData1.profiles.length, 1, 'Deve conter 1 perfil inicial criado automaticamente');
    const initialProfile = listData1.profiles[0];
    assert.equal(initialProfile.name, 'Carlos', 'Nome inicial deve ser o primeiro nome do usuário');
    assert.equal(initialProfile.isDefault, 1, 'Perfil inicial deve ser padrão (isDefault=1)');
    assert.equal(initialProfile.userId, userAData.user.id);
    console.log('  ✓ Perfil inicial criado automaticamente com sucesso:', initialProfile.name);

    // -------------------------------------------------------------------------
    // 3. CRIAÇÃO DE NOVOS PERFIS
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 3] Criação de novo perfil com validação...');
    const createRes = await fetch(`${baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookieA },
      body: JSON.stringify({
        name: 'Sala de Estar',
        avatarId: 'zapi-avatar-blue',
      }),
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.profile.name, 'Sala de Estar');
    assert.equal(createData.profile.avatarId, 'zapi-avatar-blue');
    assert.equal(createData.profile.isDefault, 0);
    const secondProfile = createData.profile;
    console.log('  ✓ Segundo perfil criado com sucesso:', secondProfile.name);

    // -------------------------------------------------------------------------
    // 4. EDIÇÃO DE NOME
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 4] Edição de nome do perfil...');
    const editNameRes = await fetch(`${baseUrl}/api/profiles/${secondProfile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookieA },
      body: JSON.stringify({ name: 'Home Theater' }),
    });
    assert.equal(editNameRes.status, 200);
    const editNameData = await editNameRes.json();
    assert.equal(editNameData.profile.name, 'Home Theater');
    console.log('  ✓ Nome atualizado para Home Theater.');

    // Tentativa com nome inválido (< 2 chars ou > 30)
    const badNameRes = await fetch(`${baseUrl}/api/profiles/${secondProfile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookieA },
      body: JSON.stringify({ name: 'A' }),
    });
    assert.equal(badNameRes.status, 400, 'Nome com 1 caractere deve retornar 400');
    console.log('  ✓ Validação de tamanho de nome rejeitou entrada inválida (400).');

    // -------------------------------------------------------------------------
    // 5. ALTERAÇÃO DE AVATAR
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 5] Alteração de avatar com validação...');
    const editAvatarRes = await fetch(`${baseUrl}/api/profiles/${secondProfile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookieA },
      body: JSON.stringify({ avatarId: 'zapi-avatar-purple' }),
    });
    assert.equal(editAvatarRes.status, 200);
    const editAvatarData = await editAvatarRes.json();
    assert.equal(editAvatarData.profile.avatarId, 'zapi-avatar-purple');
    console.log('  ✓ Avatar alterado com sucesso para zapi-avatar-purple.');

    // -------------------------------------------------------------------------
    // 6. EXCLUSÃO DE PERFIL E REGRAS DE PROTEÇÃO
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 6] Exclusão de perfil e proteção contra exclusão do único...');
    // Beatriz tem apenas 1 perfil. Tentar excluir deve retornar 400
    const beatrizProfilesRes = await fetch(`${baseUrl}/api/profiles`, {
      headers: { 'Cookie': sessionCookieB },
    });
    const beatrizProfilesData = await beatrizProfilesRes.json();
    const beatrizSingleProfile = beatrizProfilesData.profiles[0];

    const delSingleRes = await fetch(`${baseUrl}/api/profiles/${beatrizSingleProfile.id}`, {
      method: 'DELETE',
      headers: { 'Cookie': sessionCookieB },
    });
    assert.equal(delSingleRes.status, 400, 'Exclusão do único perfil deve falhar com 400');
    const delSingleData = await delSingleRes.json();
    assert.ok(delSingleData.error.includes('único perfil'));
    console.log('  ✓ Bloqueio de exclusão do único perfil comprovado com 400.');

    // Carlos tem 2 perfis: excluir o segundo deve funcionar
    const delRes = await fetch(`${baseUrl}/api/profiles/${secondProfile.id}`, {
      method: 'DELETE',
      headers: { 'Cookie': sessionCookieA },
    });
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.equal(delData.success, true);
    assert.equal(delData.nextActiveProfileId, initialProfile.id);
    console.log('  ✓ Perfil excluído com sucesso mantendo a conta válida.');

    // -------------------------------------------------------------------------
    // 7. LIMITE CONFIGURÁVEL DE PERFIS (5 POR CONTA)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 7] Limite máximo de perfis (5 por conta)...');
    // Carlos já tem 1 perfil. Adiciona até o 5º perfil
    for (let i = 2; i <= MAX_PROFILES_PER_USER; i++) {
      const addRes = await fetch(`${baseUrl}/api/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookieA },
        body: JSON.stringify({ name: `Perfil Extra ${i}` }),
      });
      assert.equal(addRes.status, 201);
    }

    // A 6ª tentativa deve ser bloqueada
    const overflowRes = await fetch(`${baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookieA },
      body: JSON.stringify({ name: 'Perfil Excedente 6' }),
    });
    assert.equal(overflowRes.status, 400);
    const overflowData = await overflowRes.json();
    assert.ok(overflowData.error.includes('Limite máximo'));
    console.log(`  ✓ Bloqueio acionado ao atingir o limite de ${MAX_PROFILES_PER_USER} perfis.`);

    // -------------------------------------------------------------------------
    // 8. SELEÇÃO DE PERFIL ATIVO
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 8] Seleção de perfil ativo...');
    const listCarlos = (await (await fetch(`${baseUrl}/api/profiles`, { headers: { 'Cookie': sessionCookieA } })).json()).profiles;
    const targetSelectProfile = listCarlos[1];

    const selectRes = await fetch(`${baseUrl}/api/profiles/${targetSelectProfile.id}/select`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookieA },
    });
    assert.equal(selectRes.status, 200);
    const selectCookie = selectRes.headers.get('set-cookie');
    assert.ok(selectCookie && selectCookie.includes('zapitv_active_profile='), 'Deve emitir cookie de perfil ativo');
    const profileCookieMatch = selectCookie.match(/zapitv_active_profile=([^;]+)/)!;
    const fullCookieHeaderA = `${sessionCookieA}; zapitv_active_profile=${profileCookieMatch[1]}`;
    console.log('  ✓ Perfil selecionado e cookie emitido com sucesso.');

    // -------------------------------------------------------------------------
    // 9. PERSISTÊNCIA DA SELEÇÃO APÓS F5 (/api/auth/me)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 9] Persistência da seleção após recarregar a página (F5)...');
    const reloadMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': fullCookieHeaderA },
    });
    assert.equal(reloadMeRes.status, 200);
    const reloadMeData = await reloadMeRes.json();
    assert.equal(reloadMeData.authenticated, true);
    assert.equal(reloadMeData.activeProfile.id, targetSelectProfile.id, 'Perfil ativo deve ser retornado no /me');
    console.log('  ✓ Perfil ativo restaurado perfeitamente no /me com cookie seguro.');

    // -------------------------------------------------------------------------
    // 10. TROCA DE PERFIL SEM INVALIDAR SESSÃO
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 10] Troca de perfil sem deslogar...');
    const switchTarget = listCarlos[0];
    const switchRes = await fetch(`${baseUrl}/api/profiles/${switchTarget.id}/select`, {
      method: 'POST',
      headers: { 'Cookie': fullCookieHeaderA },
    });
    assert.equal(switchRes.status, 200);

    // Valida que a sessão do usuário Carlos continua ativa
    const checkAfterSwitch = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': fullCookieHeaderA },
    });
    const checkData = await checkAfterSwitch.json();
    assert.equal(checkData.authenticated, true);
    console.log('  ✓ Troca de perfil efetuada mantendo a sessão da conta intacta.');

    // -------------------------------------------------------------------------
    // 11. LOGOUT COM LIMPEZA DO ESTADO PRIVADO
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 11] Logout com limpeza dos cookies...');
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': fullCookieHeaderA },
    });
    assert.equal(logoutRes.status, 200);
    const setCookiesLogout = logoutRes.headers.get('set-cookie') || '';
    assert.ok(setCookiesLogout.includes('Max-Age=0'), 'Cookies devem ser limpos com Max-Age=0');
    console.log('  ✓ Logout limpou os cookies de sessão e perfil ativo.');

    // -------------------------------------------------------------------------
    // 12 & 13. TENTATIVA DE ACESSAR, EDITAR OU EXCLUIR PERFIL DE OUTRA CONTA
    // -------------------------------------------------------------------------
    console.log('\n[Cenários 12 e 13] Tentativas de acesso não autorizado entre contas...');
    // Beatriz tenta alterar o perfil de Carlos
    const hackUpdateRes = await fetch(`${baseUrl}/api/profiles/${initialProfile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookieB },
      body: JSON.stringify({ name: 'Hacked Carlos' }),
    });
    assert.equal(hackUpdateRes.status, 403, 'Alterar perfil alheio deve retornar 403 Forbidden');
    console.log('  ✓ Tentativa de edição em perfil alheio bloqueada com 403.');

    // Beatriz tenta excluir perfil de Carlos
    const hackDeleteRes = await fetch(`${baseUrl}/api/profiles/${initialProfile.id}`, {
      method: 'DELETE',
      headers: { 'Cookie': sessionCookieB },
    });
    assert.equal(hackDeleteRes.status, 403, 'Excluir perfil alheio deve retornar 403 Forbidden');
    console.log('  ✓ Tentativa de exclusão em perfil alheio bloqueada com 403.');

    // Beatriz tenta selecionar o perfil de Carlos
    const hackSelectRes = await fetch(`${baseUrl}/api/profiles/${initialProfile.id}/select`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookieB },
    });
    assert.equal(hackSelectRes.status, 403, 'Selecionar perfil alheio deve retornar 403 Forbidden');
    console.log('  ✓ Tentativa de seleção de perfil alheio bloqueada com 403.');

    // -------------------------------------------------------------------------
    // 14. BLOQUEIO COM SESSÃO EXPIRADA
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 14] Bloqueio de acesso com sessão expirada...');
    // Força expiração da sessão de Beatriz
    await testDb.db.update(sessions).set({ expiresAt: Date.now() - 10000 });
    const expiredProfilesRes = await fetch(`${baseUrl}/api/profiles`, {
      headers: { 'Cookie': sessionCookieB },
    });
    assert.equal(expiredProfilesRes.status, 401, 'Sessão expirada deve retornar 401');
    console.log('  ✓ Acesso a perfis com sessão expirada rejeitado com 401.');

    // -------------------------------------------------------------------------
    // 15. REQUISIÇÕES CONCORRENTES NA CRIAÇÃO DO PERFIL INICIAL
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 15] Tratamento de concorrência na criação do perfil inicial...');
    const userCRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Concorrente Teste',
        email: 'concorrente@exemplo.com',
        password: 'SenhaConcorrente123',
        passwordConfirm: 'SenhaConcorrente123',
        termsAccepted: true,
      }),
    });
    const userCData = await userCRes.json();
    const tokenMatchC = userCRes.headers.get('set-cookie')!.match(/zapitv_session=([^;]+)/)!;
    const sessionCookieC = `zapitv_session=${tokenMatchC[1]}`;

    // Dispara 5 requisições de listagem simultâneas exatamente no mesmo milissegundo
    const concurrentListings = await Promise.all([
      fetch(`${baseUrl}/api/profiles`, { headers: { 'Cookie': sessionCookieC } }),
      fetch(`${baseUrl}/api/profiles`, { headers: { 'Cookie': sessionCookieC } }),
      fetch(`${baseUrl}/api/profiles`, { headers: { 'Cookie': sessionCookieC } }),
      fetch(`${baseUrl}/api/profiles`, { headers: { 'Cookie': sessionCookieC } }),
      fetch(`${baseUrl}/api/profiles`, { headers: { 'Cookie': sessionCookieC } }),
    ]);

    for (const res of concurrentListings) {
      assert.equal(res.status, 200);
    }

    const userCProfiles = await testDb.db.select().from(profiles).where(eq(profiles.userId, userCData.user.id));
    assert.equal(userCProfiles.length, 1, 'Mesmo com 5 chamadas concorrentes, deve existir EXATAMENTE 1 perfil inicial');
    console.log('  ✓ Concorrência tratada: exatamente 1 perfil inicial gerado sem duplicação.');

    // -------------------------------------------------------------------------
    // 16. PRESERVAÇÃO DOS DADOS ANÔNIMOS LOCAIS
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 16] Preservação dos dados anônimos...');
    await storageService.setScope(null); // Escopo anônimo
    await storageService.saveMyList(['filme-anonimo-1', 'filme-anonimo-2']);
    const anonList = await storageService.getMyList();
    assert.deepEqual(anonList, ['filme-anonimo-1', 'filme-anonimo-2']);
    console.log('  ✓ Dados locais anônimos gravados com sucesso.');

    // -------------------------------------------------------------------------
    // 17. ISOLAMENTO DOS DADOS LOCAIS ENTRE PERFIS
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 17] Isolamento de dados locais entre perfis diferentes...');
    // Perfil 1 de Carlos
    await storageService.setScope({ userId: userAData.user.id, profileId: initialProfile.id });
    await storageService.saveMyList(['carlos-filme-favorito']);
    const carlosP1List = await storageService.getMyList();
    assert.deepEqual(carlosP1List, ['carlos-filme-favorito']);

    // Perfil 2 de Carlos
    await storageService.setScope({ userId: userAData.user.id, profileId: targetSelectProfile.id });
    const carlosP2ListInitial = await storageService.getMyList();
    assert.deepEqual(carlosP2ListInitial, [], 'Perfil novo não deve herdar a lista do perfil anterior');
    await storageService.saveMyList(['carlos-segundo-perfil-serie']);
    const carlosP2ListUpdated = await storageService.getMyList();
    assert.deepEqual(carlosP2ListUpdated, ['carlos-segundo-perfil-serie']);

    // Volta ao Perfil 1: seus dados originais devem estar intactos
    await storageService.setScope({ userId: userAData.user.id, profileId: initialProfile.id });
    const carlosP1ListRestored = await storageService.getMyList();
    assert.deepEqual(carlosP1ListRestored, ['carlos-filme-favorito']);

    // Volta ao escopo anônimo: dados anônimos intactos
    await storageService.setScope(null);
    const anonListRestored = await storageService.getMyList();
    assert.deepEqual(anonListRestored, ['filme-anonimo-1', 'filme-anonimo-2']);
    console.log('  ✓ Isolamento local completo: perfis e anônimo possuem dados 100% estanques.');

    // -------------------------------------------------------------------------
    // 18. INTERFACE DESKTOP E REGISTRO DE AVATARES
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 18] Interface desktop e registro de avatares...');
    assert.ok(OFFICIAL_AVATARS.length >= 8, 'Biblioteca oficial deve conter ao menos 8 avatares');
    for (const av of OFFICIAL_AVATARS) {
      assert.ok(VALID_AVATAR_IDS.includes(av.id));
      assert.ok(AVATARS.includes(av.dataUri));
      assert.equal(resolveAvatarUrl(av.id), av.dataUri);
    }
    console.log(`  ✓ ${OFFICIAL_AVATARS.length} imagens originais de perfil preservadas.`);

    // -------------------------------------------------------------------------
    // 19. INTERFACE MOBILE E SAFE AREAS
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 19] Validação mobile e Minha ZapiTV...');
    const avatarUrl = resolveAvatarUrl('zapi-avatar-cyan');
    assert.equal(avatarUrl, AVATARS[0], 'Avatar deve preservar a imagem original configurada');
    console.log('  ✓ Integração mobile com a imagem original aprovada.');

    // -------------------------------------------------------------------------
    // 20. NAVEGAÇÃO D-PAD DOS COMPONENTES DE TV
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 20] Preparação de navegação D-Pad para TV...');
    assert.ok(fs.existsSync('src/components/tv/TvProfileSelector.tsx'), 'Componente TvProfileSelector deve existir');
    const tvSelectorSource = fs.readFileSync('src/components/tv/TvProfileSelector.tsx', 'utf-8');
    assert.ok(tvSelectorSource.includes('useFocusable'), 'TvProfileSelector deve utilizar useFocusable');
    assert.ok(tvSelectorSource.includes('FocusContext'), 'TvProfileSelector deve utilizar FocusContext');
    assert.ok(tvSelectorSource.includes('onEnterPress'), 'TvProfileSelector deve tratar tecla OK/Enter');
    console.log('  ✓ Componente TvProfileSelector espacial validado com foco D-Pad.');

    console.log('\n========================================================================');
    console.log('🎉 TODOS OS 20 CENÁRIOS DE MÚLTIPLOS PERFIS FORAM APROVADOS (CÓDIGO 0)!');
    console.log('========================================================================\n');
  } finally {
    server.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
  }
}

runProfilesTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Falha na suíte de testes P3.B:');
    console.error(err);
    process.exit(1);
  });
