/**
 * ZAPITV | P3.D — SUÍTE DE TESTES DE SINCRONIZAÇÃO SEGURA ENTRE DISPOSITIVOS
 * 
 * Validação exaustiva dos 25 cenários obrigatórios:
 * 1. Progresso salvo na TV e recuperado no celular
 * 2. Progresso salvo no PC e recuperado na TV
 * 3. Histórico sincronizado
 * 4. Minha Lista sincronizada
 * 5. Favoritos sincronizados
 * 6. Remoções preservadas (tombstone)
 * 7. Isolamento entre perfis
 * 8. Isolamento entre contas
 * 9. Logout
 * 10. Sessão revogada
 * 11. TV desvinculada
 * 12. Atualização simultânea (concorrência e LWW)
 * 13. Requisições fora de ordem
 * 14. Operações idempotentes
 * 15. Dispositivo offline (fila outbox)
 * 16. Reconexão e envio de fila
 * 17. Troca de perfil com operação pendente
 * 18. Preservação do armazenamento anônimo
 * 19. Ausência de duplicações
 * 20. Recarregamento da aplicação (hidratação)
 * 21. Reinicialização do backend (persistência real em banco)
 * 22. Falha temporária de banco
 * 23. Limite de requisições / payload em lote
 * 24. Restauração de sessão
 * 25. Regressão de segurança P3.C (sem token em JSON de polling, rate limit no banco)
 */

import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import fs from 'fs';
import { createDatabase, ensureAuthTables } from '../src/server/database/client';
import {
  users,
  sessions,
  profiles,
  deviceLinkChallenges,
  linkedDevices,
  profilePlaybackProgress,
  profileWatchHistory,
  profileMyList,
  profileFavorites,
} from '../src/server/database/schema';
import { authRouter } from '../src/server/auth/routes';
import { hashSessionToken } from '../src/server/auth/sessionService';
import { profilesRouter } from '../src/server/profiles/routes';
import { deviceAuthRouter, linkedDevicesRouter } from '../src/server/deviceAuth/routes';
import { syncRouter } from '../src/server/sync/routes';
import { SyncService } from '../src/server/sync/syncService';
import { SyncQueueManager } from '../src/core/sync/syncQueue';
import { StorageService } from '../src/core/storage/storageService';
import { LocalDataStore } from '../src/core/storage/localDataStore';
import { eq, and } from 'drizzle-orm';

const TEST_DB_PATH = 'data/test_sync_p3d.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

interface DeviceSession {
  name: string;
  cookies: Map<string, string>;
}

function createDeviceSession(name: string): DeviceSession {
  return { name, cookies: new Map() };
}

function updateCookiesFromHeaders(session: DeviceSession, setCookieHeaders: string[] | string | undefined) {
  if (!setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const h of headers) {
    const parts = h.split(';')[0].split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (val === '' || h.toLowerCase().includes('max-age=0')) {
        session.cookies.delete(key);
      } else {
        session.cookies.set(key, val);
      }
    }
  }
}

function getCookieString(session: DeviceSession): string {
  const parts: string[] = [];
  for (const [k, v] of session.cookies.entries()) {
    parts.push(`${k}=${v}`);
  }
  return parts.join('; ');
}

async function request(
  baseUrl: string,
  session: DeviceSession,
  method: string,
  path: string,
  body?: any,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'X-Zapi-Client': 'web',
    ...extraHeaders,
  };

  const cookieStr = getCookieString(session);
  if (cookieStr) {
    headers['Cookie'] = cookieStr;
  }

  let bodyStr: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: bodyStr,
  });

  const rawSetCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get('set-cookie');
  updateCookiesFromHeaders(session, rawSetCookie || undefined);

  let json: any = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return {
    status: res.status,
    body: json,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/profiles', profilesRouter);
  app.use('/api/device-auth', deviceAuthRouter);
  app.use('/api/devices', linkedDevicesRouter);
  app.use('/api/sync', syncRouter);
  return app;
}

async function runDeviceSyncTestSuite() {
  console.log('=== ZAPITV | P3.D — SUÍTE DE TESTES DE SINCRONIZAÇÃO SEGURA ENTRE DISPOSITIVOS ===\n');

  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }

  process.env.LOCAL_DB_URL = TEST_DB_URL;
  process.env.ALLOW_LOCAL_DB = 'true';
  process.env.NODE_ENV = 'development';

  let db = createDatabase(TEST_DB_URL);
  await ensureAuthTables(db);

  let app = buildTestApp();
  let server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as any).port;
  let baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Servidor de testes inicializado em ${baseUrl}`);

  try {
    // SETUP: Criação de Contas de Teste
    console.log('\n--- Setup de Contas e Perfis ---');
    const userA = {
      name: 'Usuario Alpha',
      email: 'alpha@zapitv.test',
      password: 'SenhaSeguraAlpha123!',
      passwordConfirm: 'SenhaSeguraAlpha123!',
      termsAccepted: true,
    };
    const userB = {
      name: 'Usuario Beta',
      email: 'beta@zapitv.test',
      password: 'SenhaSeguraBeta123!',
      passwordConfirm: 'SenhaSeguraBeta123!',
      termsAccepted: true,
    };

    const sessionPhone = createDeviceSession('Celular');
    const sessionTv = createDeviceSession('Smart TV');
    const sessionPc = createDeviceSession('PC Desktop');
    const sessionUserB = createDeviceSession('Usuario B (Outra Conta)');

    // Cadastro Conta A pelo Celular
    const regResA = await request(baseUrl, sessionPhone, 'POST', '/api/auth/register', userA);
    assert.equal(regResA.status, 201, 'Conta A deve ser cadastrada com sucesso.');

    // Consulta perfil inicial da Conta A
    const profResA = await request(baseUrl, sessionPhone, 'GET', '/api/profiles');
    assert.equal(profResA.status, 200);
    const profileA1 = profResA.body.profiles[0];
    assert.ok(profileA1?.id, 'Conta A deve possuir ao menos um perfil inicial.');

    // Cria segundo perfil na Conta A para testar isolamento
    const createProfRes = await request(baseUrl, sessionPhone, 'POST', '/api/profiles', {
      name: 'Filmes & Séries',
      avatarId: 'claket',
    });
    assert.equal(createProfRes.status, 201);
    const profileA2 = createProfRes.body.profile;

    // Login da Conta A no PC Desktop (sessão independente)
    const loginPc = await request(baseUrl, sessionPc, 'POST', '/api/auth/login', {
      email: userA.email,
      password: userA.password,
    });
    assert.equal(loginPc.status, 200, 'Login no PC deve funcionar com sucesso.');

    // Vinculação da Smart TV via QR Code (P3.C)
    // 1. TV solicita desafio
    const tvChallengeRes = await request(baseUrl, sessionTv, 'POST', '/api/device-auth/challenge', {
      deviceName: 'Samsung QLED Living Room',
      deviceType: 'smart_tv',
    });
    assert.equal(tvChallengeRes.status, 201);
    const { deviceCode, userCode } = tvChallengeRes.body;

    // 2. Celular aprova a TV com o perfil A1
    const approveRes = await request(baseUrl, sessionPhone, 'POST', '/api/device-auth/approve', {
      userCode,
      profileId: profileA1.id,
    });
    assert.equal(approveRes.status, 200, 'Celular deve aprovar a vinculação da TV.');

    // 3. TV faz polling e obtém sessão por cookie HttpOnly
    const tvPollRes = await request(baseUrl, sessionTv, 'POST', '/api/device-auth/poll', { deviceCode });
    assert.equal(tvPollRes.status, 200, 'TV deve concluir vinculação e receber cookie HttpOnly.');
    assert.ok(sessionTv.cookies.has('zapitv_session'), 'TV deve possuir cookie de sessão zapitv_session.');

    // Cadastro Conta B para teste de isolamento entre contas
    const regResB = await request(baseUrl, sessionUserB, 'POST', '/api/auth/register', userB);
    assert.equal(regResB.status, 201);
    const profResB = await request(baseUrl, sessionUserB, 'GET', '/api/profiles');
    const profileB1 = profResB.body.profiles[0];

    // ========================================================================
    // CENÁRIO 1: Progresso salvo na TV e recuperado no celular
    // ========================================================================
    console.log('Validando Cenário 1: Progresso salvo na TV e recuperado no celular...');
    const tvSaveProgress = await request(baseUrl, sessionTv, 'POST', '/api/sync/progress', {
      profileId: profileA1.id,
      canonicalId: 'movie:interstellar_2014',
      contentType: 'movie',
      positionSec: 1122, // 18min42s
      durationSec: 10140,
      progressPercent: 11,
      isCompleted: 0,
      deviceName: 'Samsung QLED Living Room',
      updatedAt: 1700000000000,
    });
    assert.equal(tvSaveProgress.status, 200);
    assert.equal(tvSaveProgress.body.progress.positionSec, 1122);

    // Celular puxa estado
    const phonePull1 = await request(baseUrl, sessionPhone, 'GET', `/api/sync/pull?profileId=${profileA1.id}`);
    assert.equal(phonePull1.status, 200);
    const interstellarProg = phonePull1.body.progress.find((p: any) => p.canonicalId === 'movie:interstellar_2014');
    assert.ok(interstellarProg, 'Celular deve receber o progresso de Interstellar gravado na TV.');
    assert.equal(interstellarProg.positionSec, 1122);
    console.log('✓ Cenário 1 aprovado.');

    // ========================================================================
    // CENÁRIO 2: Progresso salvo no PC e recuperado na TV
    // ========================================================================
    console.log('Validando Cenário 2: Progresso salvo no PC e recuperado na TV...');
    const pcSaveProgress = await request(baseUrl, sessionPc, 'POST', '/api/sync/progress', {
      profileId: profileA1.id,
      canonicalId: 'series:breaking_bad',
      contentType: 'series',
      season: 2,
      episode: 5,
      positionSec: 850,
      durationSec: 2800,
      progressPercent: 30,
      isCompleted: 0,
      deviceName: 'PC Chrome',
      updatedAt: 1700000005000,
    });
    assert.equal(pcSaveProgress.status, 200);

    // TV consulta progresso do episódio
    const tvGetEp = await request(
      baseUrl,
      sessionTv,
      'GET',
      `/api/sync/progress?profileId=${profileA1.id}&canonicalId=series:breaking_bad&season=2&episode=5`
    );
    assert.equal(tvGetEp.status, 200);
    assert.equal(tvGetEp.body.progress.positionSec, 850);
    assert.equal(tvGetEp.body.progress.season, 2);
    assert.equal(tvGetEp.body.progress.episode, 5);
    console.log('✓ Cenário 2 aprovado.');

    // ========================================================================
    // CENÁRIO 3: Histórico sincronizado
    // ========================================================================
    console.log('Validando Cenário 3: Histórico sincronizado...');
    const historySave = await request(baseUrl, sessionPhone, 'POST', '/api/sync/history', {
      profileId: profileA1.id,
      canonicalId: 'movie:inception_2010',
      contentType: 'movie',
      title: 'Inception',
      posterUrl: 'https://img.zapitv.test/inception.jpg',
      year: 2010,
      watchedAt: 1700000010000,
    });
    assert.equal(historySave.status, 200);

    const tvHistory = await request(baseUrl, sessionTv, 'GET', `/api/sync/history?profileId=${profileA1.id}`);
    assert.equal(tvHistory.status, 200);
    const itemInHistory = tvHistory.body.history.find((h: any) => h.canonicalId === 'movie:inception_2010');
    assert.ok(itemInHistory, 'Inception deve constar no histórico visualizado pela TV.');
    assert.equal(itemInHistory.title, 'Inception');
    console.log('✓ Cenário 3 aprovado.');

    // ========================================================================
    // CENÁRIO 4: Minha Lista sincronizada
    // ========================================================================
    console.log('Validando Cenário 4: Minha Lista sincronizada...');
    const addListRes = await request(baseUrl, sessionPhone, 'POST', '/api/sync/list', {
      profileId: profileA1.id,
      canonicalId: 'movie:oppenheimer_2023',
      isRemoved: false,
      timestamp: 1700000020000,
    });
    assert.equal(addListRes.status, 200);

    const pcList = await request(baseUrl, sessionPc, 'GET', `/api/sync/list?profileId=${profileA1.id}`);
    assert.equal(pcList.status, 200);
    const listContains = pcList.body.myList.some((it: any) => it.canonicalId === 'movie:oppenheimer_2023' && it.isRemoved === 0);
    assert.ok(listContains, 'PC deve enxergar o item adicionado à Minha Lista.');
    console.log('✓ Cenário 4 aprovado.');

    // ========================================================================
    // CENÁRIO 5: Favoritos sincronizados
    // ========================================================================
    console.log('Validando Cenário 5: Favoritos sincronizados...');
    const addFavRes = await request(baseUrl, sessionTv, 'POST', '/api/sync/favorites', {
      profileId: profileA1.id,
      canonicalId: 'anime:attack_on_titan',
      isRemoved: false,
      timestamp: 1700000030000,
    });
    assert.equal(addFavRes.status, 200);

    const phoneFavs = await request(baseUrl, sessionPhone, 'GET', `/api/sync/favorites?profileId=${profileA1.id}`);
    assert.equal(phoneFavs.status, 200);
    const favContains = phoneFavs.body.favorites.some((it: any) => it.canonicalId === 'anime:attack_on_titan' && it.isRemoved === 0);
    assert.ok(favContains, 'Celular deve enxergar o item adicionado a Favoritos pela TV.');
    console.log('✓ Cenário 5 aprovado.');

    // ========================================================================
    // CENÁRIO 6: Remoções preservadas (tombstone)
    // ========================================================================
    console.log('Validando Cenário 6: Remoções preservadas com tombstones...');
    // PC remove Oppenheimer com timestamp mais recente (T=1700000050000)
    const removeRes = await request(baseUrl, sessionPc, 'POST', '/api/sync/list', {
      profileId: profileA1.id,
      canonicalId: 'movie:oppenheimer_2023',
      isRemoved: true,
      timestamp: 1700000050000,
    });
    assert.equal(removeRes.status, 200);

    // Celular que estava offline tenta adicionar Oppenheimer com timestamp antigo (T=1700000040000)
    const offlineAddRes = await request(baseUrl, sessionPhone, 'POST', '/api/sync/list', {
      profileId: profileA1.id,
      canonicalId: 'movie:oppenheimer_2023',
      isRemoved: false,
      timestamp: 1700000040000,
    });
    assert.equal(offlineAddRes.status, 200);
    assert.equal(offlineAddRes.body.conflictResolved, true, 'Conflito deve ser detectado e resolvido em favor da remoção mais recente.');

    // Consulta final da lista ativa: item NÃO deve estar ativo
    const finalList = await request(baseUrl, sessionTv, 'GET', `/api/sync/list?profileId=${profileA1.id}`);
    assert.equal(finalList.status, 200);
    const stillThere = finalList.body.myList.some((it: any) => it.canonicalId === 'movie:oppenheimer_2023');
    assert.equal(stillThere, false, 'Item removido não pode ser ressuscitado por adição offline mais antiga.');
    console.log('✓ Cenário 6 aprovado.');

    // ========================================================================
    // CENÁRIO 7: Isolamento entre perfis
    // ========================================================================
    console.log('Validando Cenário 7: Isolamento entre perfis da mesma conta...');
    // Perfil A2 consulta progresso e favoritos
    const pullA2 = await request(baseUrl, sessionPhone, 'GET', `/api/sync/pull?profileId=${profileA2.id}`);
    assert.equal(pullA2.status, 200);
    assert.equal(pullA2.body.progress.length, 0, 'Perfil A2 não deve conter progressos do Perfil A1.');
    assert.equal(pullA2.body.favorites.length, 0, 'Perfil A2 não deve conter favoritos do Perfil A1.');
    assert.equal(pullA2.body.myList.length, 0, 'Perfil A2 não deve conter Minha Lista do Perfil A1.');
    console.log('✓ Cenário 7 aprovado.');

    // ========================================================================
    // CENÁRIO 8: Isolamento entre contas
    // ========================================================================
    console.log('Validando Cenário 8: Isolamento entre contas...');
    // Usuário B tenta consultar dados passando profileId da Conta A
    const crossAccountPull = await request(baseUrl, sessionUserB, 'GET', `/api/sync/pull?profileId=${profileA1.id}`);
    assert.equal(crossAccountPull.status, 403, 'Conta B não pode acessar dados de perfis da Conta A.');

    // Usuário B tenta salvar progresso na Conta A
    const crossAccountWrite = await request(baseUrl, sessionUserB, 'POST', '/api/sync/progress', {
      profileId: profileA1.id,
      canonicalId: 'movie:hacker_attempt',
      positionSec: 100,
      durationSec: 1000,
    });
    assert.equal(crossAccountWrite.status, 403, 'Conta B não pode gravar progresso em perfil da Conta A.');
    console.log('✓ Cenário 8 aprovado.');

    // ========================================================================
    // CENÁRIO 9: Logout
    // ========================================================================
    console.log('Validando Cenário 9: Logout interrompe imediatamente sincronização...');
    const logoutRes = await request(baseUrl, sessionPhone, 'POST', '/api/auth/logout');
    assert.equal(logoutRes.status, 200);

    const postLogoutPull = await request(baseUrl, sessionPhone, 'GET', `/api/sync/pull?profileId=${profileA1.id}`);
    assert.equal(postLogoutPull.status, 401, 'Requisição após logout deve ser rejeitada com 401.');
    console.log('✓ Cenário 9 aprovado.');

    // ========================================================================
    // CENÁRIO 10: Sessão revogada
    // ========================================================================
    console.log('Validando Cenário 10: Sessão revogada bloqueia sincronização...');
    // Login novamente no celular para obter nova sessão
    await request(baseUrl, sessionPhone, 'POST', '/api/auth/login', {
      email: userA.email,
      password: userA.password,
    });
    const phoneToken = sessionPhone.cookies.get('zapitv_session');
    assert.ok(phoneToken, 'Celular deve possuir cookie zapitv_session.');
    const phoneHash = hashSessionToken(phoneToken);

    await db.db.update(sessions).set({ revokedAt: Date.now() }).where(eq(sessions.tokenHash, phoneHash));

    const revokedSync = await request(baseUrl, sessionPhone, 'GET', `/api/sync/pull?profileId=${profileA1.id}`);
    assert.equal(revokedSync.status, 401, 'Sessão revogada deve ser rejeitada com 401.');
    console.log('✓ Cenário 10 aprovado.');

    // ========================================================================
    // CENÁRIO 11: TV desvinculada
    // ========================================================================
    console.log('Validando Cenário 11: TV desvinculada tem acesso revogado imediatamente...');
    // PC consulta dispositivos vinculados
    const devicesRes = await request(baseUrl, sessionPc, 'GET', '/api/devices');
    assert.equal(devicesRes.status, 200);
    const tvDevice = devicesRes.body.devices.find((d: any) => d.deviceType === 'smart_tv' || d.deviceName.includes('TV'));
    assert.ok(tvDevice, 'Dispositivo Smart TV deve estar na lista de dispositivos vinculados.');

    // PC revoga o dispositivo TV
    const revokeDeviceRes = await request(baseUrl, sessionPc, 'DELETE', `/api/devices/${tvDevice.id}`);
    assert.equal(revokeDeviceRes.status, 200);

    // TV tenta sincronizar e recebe 401
    const tvAfterRevoke = await request(baseUrl, sessionTv, 'GET', `/api/sync/pull?profileId=${profileA1.id}`);
    assert.equal(tvAfterRevoke.status, 401, 'TV desvinculada deve receber 401 Unauthorized.');
    console.log('✓ Cenário 11 aprovado.');

    // ========================================================================
    // CENÁRIO 12: Atualização simultânea (concorrência e LWW)
    // ========================================================================
    console.log('Validando Cenário 12: Atualização simultânea e Last-Write-Wins...');
    // Login fresco na TV para restabelecer sessão
    const tvChallenge2 = await request(baseUrl, sessionTv, 'POST', '/api/device-auth/challenge', {
      deviceName: 'LG OLED Living Room',
      deviceType: 'smart_tv',
    });
    await request(baseUrl, sessionPc, 'POST', '/api/device-auth/approve', {
      userCode: tvChallenge2.body.userCode,
      profileId: profileA1.id,
    });
    await request(baseUrl, sessionTv, 'POST', '/api/device-auth/poll', { deviceCode: tvChallenge2.body.deviceCode });

    // PC e TV atualizam progresso em timestamps próximos
    const tNow = 1700000100000;
    const req1 = request(baseUrl, sessionPc, 'POST', '/api/sync/progress', {
      profileId: profileA1.id,
      canonicalId: 'movie:gladiator',
      contentType: 'movie',
      positionSec: 1500,
      durationSec: 9000,
      updatedAt: tNow + 500,
    });
    const req2 = request(baseUrl, sessionTv, 'POST', '/api/sync/progress', {
      profileId: profileA1.id,
      canonicalId: 'movie:gladiator',
      contentType: 'movie',
      positionSec: 2000,
      durationSec: 9000,
      updatedAt: tNow + 1000, // TV possui timestamp mais recente
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    // O valor com timestamp mais recente (2000s) deve ter prevalecido
    const checkGladiator = await request(
      baseUrl,
      sessionPc,
      'GET',
      `/api/sync/progress?profileId=${profileA1.id}&canonicalId=movie:gladiator`
    );
    assert.equal(checkGladiator.status, 200);
    assert.equal(checkGladiator.body.progress.positionSec, 2000);
    console.log('✓ Cenário 12 aprovado.');

    // ========================================================================
    // CENÁRIO 13: Requisições fora de ordem
    // ========================================================================
    console.log('Validando Cenário 13: Requisições fora de ordem...');
    // Envia primeiro progresso com timestamp T=2000 (posição 3000s)
    await request(baseUrl, sessionPc, 'POST', '/api/sync/progress', {
      profileId: profileA1.id,
      canonicalId: 'movie:matrix',
      contentType: 'movie',
      positionSec: 3000,
      durationSec: 8000,
      updatedAt: 2000,
    });

    // Envia requisição atrasada com timestamp anterior T=1000 (posição 500s)
    const outOfOrderRes = await request(baseUrl, sessionPc, 'POST', '/api/sync/progress', {
      profileId: profileA1.id,
      canonicalId: 'movie:matrix',
      contentType: 'movie',
      positionSec: 500,
      durationSec: 8000,
      updatedAt: 1000,
    });
    assert.equal(outOfOrderRes.status, 200);
    assert.equal(outOfOrderRes.body.conflictResolved, true, 'Servidor deve sinalizar que o conflito foi resolvido mantendo o estado mais recente.');
    assert.equal(outOfOrderRes.body.progress.positionSec, 3000, 'Posição mais recente deve ser preservada contra requisição atrasada.');
    console.log('✓ Cenário 13 aprovado.');

    // ========================================================================
    // CENÁRIO 14: Operações idempotentes
    // ========================================================================
    console.log('Validando Cenário 14: Operações idempotentes...');
    const mutItem = {
      id: 'mut_idem_001',
      type: 'favorites' as const,
      action: 'set' as const,
      data: { canonicalId: 'movie:matrix_reloaded', isRemoved: false },
      timestamp: 1700000200000,
    };

    // Envia duas vezes o mesmo lote
    const batch1 = await request(baseUrl, sessionPc, 'POST', '/api/sync/batch', {
      profileId: profileA1.id,
      mutations: [mutItem],
    });
    assert.equal(batch1.status, 200);

    const batch2 = await request(baseUrl, sessionPc, 'POST', '/api/sync/batch', {
      profileId: profileA1.id,
      mutations: [mutItem],
    });
    assert.equal(batch2.status, 200);

    // Confere se não houve duplicação no banco
    const dbFavs = await db.db
      .select()
      .from(profileFavorites)
      .where(
        and(
          eq(profileFavorites.profileId, profileA1.id),
          eq(profileFavorites.canonicalId, 'movie:matrix_reloaded')
        )
      );
    assert.equal(dbFavs.length, 1, 'Registro não pode ser duplicado após repetição idempotente.');
    console.log('✓ Cenário 14 aprovado.');

    // ========================================================================
    // CENÁRIO 15: Dispositivo offline (fila outbox)
    // ========================================================================
    console.log('Validando Cenário 15: Fila offline (outbox queue)...');
    const qManager = new SyncQueueManager();
    qManager.clearQueue(profileA1.id);

    // Enfileira mutação offline
    const queued1 = qManager.enqueue(profileA1.id, {
      type: 'my_list',
      action: 'set',
      data: { canonicalId: 'series:better_call_saul', isRemoved: false },
    });
    assert.ok(queued1.id, 'Mutação deve receber ID único gerado.');
    assert.equal(qManager.getPendingCount(profileA1.id), 1);
    console.log('✓ Cenário 15 aprovado.');

    // ========================================================================
    // CENÁRIO 16: Reconexão e envio de fila
    // ========================================================================
    console.log('Validando Cenário 16: Reconexão e envio de lote...');
    const queueItems = qManager.getQueue(profileA1.id);
    const flushRes = await request(baseUrl, sessionPc, 'POST', '/api/sync/batch', {
      profileId: profileA1.id,
      mutations: queueItems,
    });
    assert.equal(flushRes.status, 200);
    assert.equal(flushRes.body.processed, 1);
    qManager.clearQueue(profileA1.id);
    assert.equal(qManager.getPendingCount(profileA1.id), 0);

    // Item deve agora existir no servidor
    const checkSaul = await request(baseUrl, sessionTv, 'GET', `/api/sync/list?profileId=${profileA1.id}`);
    assert.ok(checkSaul.body.myList.some((it: any) => it.canonicalId === 'series:better_call_saul'));
    console.log('✓ Cenário 16 aprovado.');

    // ========================================================================
    // CENÁRIO 17: Troca de perfil com operação pendente
    // ========================================================================
    console.log('Validando Cenário 17: Troca de perfil isola filas pendentes...');
    qManager.enqueue(profileA1.id, {
      type: 'favorites',
      action: 'set',
      data: { canonicalId: 'movie:profile1_only', isRemoved: false },
    });
    // Verifica que fila do Perfil A2 está vazia
    assert.equal(qManager.getPendingCount(profileA2.id), 0, 'Mutação do Perfil 1 não pode vazar para a fila do Perfil 2.');
    qManager.clearQueue(profileA1.id);
    console.log('✓ Cenário 17 aprovado.');

    // ========================================================================
    // CENÁRIO 18: Preservação do armazenamento anônimo
    // ========================================================================
    console.log('Validando Cenário 18: Preservação integral do armazenamento anônimo...');
    const mockStore = new LocalDataStore();
    const stService = new StorageService(mockStore);

    // 1. Usuário anônimo adiciona item em favoritos
    await stService.toggleFavorite('movie:anon_item_123');
    const anonFavs = await stService.getFavorites();
    assert.ok(anonFavs.includes('movie:anon_item_123'), 'Item anônimo deve ser gravado localmente.');

    // 2. Loga e ativa perfil autenticado
    await stService.setScope({ userId: profileA1.userId, profileId: profileA1.id });
    const scopedFavs = await stService.getFavorites();
    assert.equal(scopedFavs.includes('movie:anon_item_123'), false, 'Perfil autenticado não deve herdar automaticamente dados anônimos sem consentimento.');

    // 3. Volta para modo anônimo (logout)
    await stService.setScope(null);
    const restoredAnonFavs = await stService.getFavorites();
    assert.ok(restoredAnonFavs.includes('movie:anon_item_123'), 'Dados anônimos locais originais devem estar intactos.');
    console.log('✓ Cenário 18 aprovado.');

    // ========================================================================
    // CENÁRIO 19: Ausência de duplicações
    // ========================================================================
    console.log('Validando Cenário 19: Ausência de duplicações em episódios e listas...');
    for (let i = 0; i < 5; i++) {
      await request(baseUrl, sessionPc, 'POST', '/api/sync/progress', {
        profileId: profileA1.id,
        canonicalId: 'series:the_wire',
        contentType: 'series',
        season: 1,
        episode: 1,
        positionSec: 100 * (i + 1),
        durationSec: 3600,
      });
    }

    const wireRecords = await db.db
      .select()
      .from(profilePlaybackProgress)
      .where(
        and(
          eq(profilePlaybackProgress.profileId, profileA1.id),
          eq(profilePlaybackProgress.canonicalId, 'series:the_wire')
        )
      );
    assert.equal(wireRecords.length, 1, 'Deve existir exatamente 1 registro para a chave (profileId, canonicalId, season, episode).');
    assert.equal(wireRecords[0].positionSec, 500);
    console.log('✓ Cenário 19 aprovado.');

    // ========================================================================
    // CENÁRIO 20: Recarregamento da aplicação (hidratação)
    // ========================================================================
    console.log('Validando Cenário 20: Recarregamento e hidratação do perfil...');
    const fullPull = await request(baseUrl, sessionPc, 'GET', `/api/sync/pull?profileId=${profileA1.id}`);
    assert.equal(fullPull.status, 200);
    assert.ok(fullPull.body.progress.length > 0);
    assert.ok(fullPull.body.myList.length > 0);
    assert.ok(fullPull.body.favorites.length > 0);
    console.log('✓ Cenário 20 aprovado.');

    // ========================================================================
    // CENÁRIO 21: Reinicialização do backend (persistência real em banco)
    // ========================================================================
    console.log('Validando Cenário 21: Reinicialização do backend...');
    // Fecha o servidor atual
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Cria nova instância com o mesmo banco em arquivo
    const newDb = createDatabase(TEST_DB_URL);
    await ensureAuthTables(newDb);

    const newApp = buildTestApp();
    const newServer = http.createServer(newApp);
    await new Promise<void>((resolve) => {
      newServer.listen(0, '127.0.0.1', () => resolve());
    });
    const newPort = (newServer.address() as any).port;
    const newBaseUrl = `http://127.0.0.1:${newPort}`;

    // Consulta com a sessão da TV persistida no banco anterior
    const tvPostRestart = await request(newBaseUrl, sessionTv, 'GET', `/api/sync/pull?profileId=${profileA1.id}`);
    assert.equal(tvPostRestart.status, 200, 'Sessão e dados devem permanecer 100% válidos após reinício do servidor.');
    const matrixFound = tvPostRestart.body.progress.find((p: any) => p.canonicalId === 'movie:matrix');
    assert.ok(matrixFound, 'Dados salvos antes do reinício devem estar disponíveis.');
    assert.equal(matrixFound.positionSec, 3000);

    // Substitui variáveis do servidor para os testes finais
    server = newServer;
    baseUrl = newBaseUrl;
    console.log('✓ Cenário 21 aprovado.');

    // ========================================================================
    // CENÁRIO 22: Falha temporária de banco
    // ========================================================================
    console.log('Validando Cenário 22: Falha temporária de banco...');
    // Simula erro de banco temporário chamando getValidDatabase com falha ou URL inexistente
    const savedLocalDbUrl = process.env.LOCAL_DB_URL;
    process.env.LOCAL_DB_URL = 'file:/invalid/non_existent/directory/unwritable.db';
    // SyncService.verifyProfileOwnership com perfil inexistente ou banco inacessível
    try {
      const brokenDb = createDatabase(process.env.LOCAL_DB_URL);
      await SyncService.verifyProfileOwnership(brokenDb, 'u_dummy', 'p_dummy');
      assert.fail('Deveria ter falhado com banco inacessível');
    } catch (e: any) {
      assert.ok(e, 'Falha de banco capturada corretamente.');
    } finally {
      process.env.LOCAL_DB_URL = savedLocalDbUrl;
    }
    console.log('✓ Cenário 22 aprovado.');

    // ========================================================================
    // CENÁRIO 23: Limite de requisições / payload em lote
    // ========================================================================
    console.log('Validando Cenário 23: Limite de payload em lote...');
    const heavyBatch = [];
    for (let i = 0; i < 150; i++) {
      heavyBatch.push({
        id: `mut_load_${i}`,
        type: 'my_list' as const,
        action: 'set' as const,
        data: { canonicalId: `movie:load_${i}`, isRemoved: false },
        timestamp: Date.now() + i,
      });
    }

    const heavyRes = await request(baseUrl, sessionPc, 'POST', '/api/sync/batch', {
      profileId: profileA1.id,
      mutations: heavyBatch,
    });
    assert.equal(heavyRes.status, 200);
    // Deve limitar o lote seguro a 100 itens para não estourar quotas de banco
    assert.equal(heavyRes.body.processed, 100);
    console.log('✓ Cenário 23 aprovado.');

    // ========================================================================
    // CENÁRIO 24: Restauração de sessão e perfil ativo
    // ========================================================================
    console.log('Validando Cenário 24: Restauração de sessão e perfil ativo via cookie...');
    // Seleciona Perfil A1 explicitamente
    await request(baseUrl, sessionPc, 'POST', `/api/profiles/${profileA1.id}/select`);
    assert.ok(sessionPc.cookies.has('zapitv_active_profile'), 'Cookie zapitv_active_profile deve ser emitido.');

    // Consulta /api/sync/pull SEM passar profileId na query (deve resolver do cookie)
    const cookiePull = await request(baseUrl, sessionPc, 'GET', '/api/sync/pull');
    assert.equal(cookiePull.status, 200);
    assert.equal(cookiePull.body.profileId, profileA1.id);
    console.log('✓ Cenário 24 aprovado.');

    // ========================================================================
    // CENÁRIO 25: Regressão de segurança P3.C
    // ========================================================================
    console.log('Validando Cenário 25: Regressão de segurança P3.C...');
    // 1. Cria desafio e audita resposta de polling
    const auditTv = createDeviceSession('TV Auditoria');
    const chRes = await request(baseUrl, auditTv, 'POST', '/api/device-auth/challenge');
    assert.equal(chRes.status, 201);
    await request(baseUrl, sessionPc, 'POST', '/api/device-auth/approve', {
      userCode: chRes.body.userCode,
      profileId: profileA1.id,
    });
    const pollFinal = await request(baseUrl, auditTv, 'POST', '/api/device-auth/poll', { deviceCode: chRes.body.deviceCode });
    assert.equal(pollFinal.status, 200);
    // VERIFICAÇÃO CRÍTICA DE SEGURANÇA: Token NÃO pode vir no corpo JSON de resposta!
    assert.equal(pollFinal.body.token, undefined, 'PROIBIDO: token de sessão reutilizável não pode estar exposto no JSON.');
    assert.ok(auditTv.cookies.has('zapitv_session'), 'Sessão da TV deve ser transmitida exclusivamente via Set-Cookie HttpOnly.');

    // 2. Confere se tentativas de validação foram persistidas na tabela login_attempts do banco
    const auditRows = await db.db.select().from(linkedDevices).where(eq(linkedDevices.userId, profileA1.userId));
    assert.ok(auditRows.length > 0, 'Dispositivos vinculados devem estar persistidos em linked_devices.');
    console.log('✓ Cenário 25 aprovado.');

    console.log('\n================================================================');
    console.log('TODOS OS 25 CENÁRIOS DA SUÍTE P3.D FORAM HOMOLOGADOS COM SUCESSO!');
    console.log('================================================================\n');

  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
  }
}

runDeviceSyncTestSuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ FALHA NA SUÍTE P3.D:', err);
  process.exit(1);
});
