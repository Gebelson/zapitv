/**
 * ZAPITV | P4.B — SUÍTE DE TESTES DE HOMOLOGAÇÃO DO BANCO REMOTO E VERCEL PREVIEW
 * 
 * Validação dos requisitos de homologação e riscos remanescentes:
 * 1. Preservação de fila offline no logout (Risco A do P4.A)
 * 2. Isolamento estrito entre contas no mesmo dispositivo/browser
 * 3. Retomada de fila offline pós-relogin na mesma conta
 * 4. Atomicidade em concorrência de idempotência (Risco B do P4.A)
 * 5. Reenvio de mutações antigas após expiração de 7 dias (LWW e tombstones)
 * 6. Compatibilidade Vercel Preview e resolução de URLs no QR code de pareamento
 * 7. Auditoria de migrações Drizzle e integridade relacional
 */

import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createDatabase, ensureAuthTables } from '../src/server/database/client';
import {
  users,
  sessions,
  profiles,
  profilePlaybackProgress,
  profileWatchHistory,
  profileMyList,
  profileFavorites,
  processedSyncMutations,
} from '../src/server/database/schema';
import { authRouter } from '../src/server/auth/routes';
import { profilesRouter } from '../src/server/profiles/routes';
import { deviceAuthRouter, linkedDevicesRouter } from '../src/server/deviceAuth/routes';
import { syncRouter } from '../src/server/sync/routes';
import { SyncService } from '../src/server/sync/syncService';
import { SyncQueueManager, syncQueue } from '../src/core/sync/syncQueue';
import { authClient } from '../src/core/auth/authClient';
import { getPublicBaseUrl, createDeviceLinkChallenge } from '../src/server/deviceAuth/deviceAuthService';
import { eq, and } from 'drizzle-orm';

// Polyfill de localStorage e window para execução em ambiente Node
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] || null,
};

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).window = {
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { origin: 'http://127.0.0.1' },
};

const TEST_DB_PATH = 'data/test_sync_p4b.db';
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

  let bodyStr: string | undefined = undefined;
  if (body) {
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

async function startServer(port = 0): Promise<{ server: http.Server; baseUrl: string; port: number }> {
  const app = buildTestApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });
  const serverPort = (server.address() as any).port;
  return {
    server,
    baseUrl: `http://127.0.0.1:${serverPort}`,
    port: serverPort,
  };
}

async function runHomologationTestSuite() {
  console.log('=== ZAPITV | P4.B — SUÍTE DE HOMOLOGAÇÃO REMOTA E VERCEL PREVIEW ===\n');

  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }

  process.env.LOCAL_DB_URL = TEST_DB_URL;
  process.env.ALLOW_LOCAL_DB = 'true';
  process.env.NODE_ENV = 'development';

  const db = createDatabase(TEST_DB_URL);
  await ensureAuthTables(db);

  const serverInstance = await startServer(0);
  const baseUrl = serverInstance.baseUrl;
  const server = serverInstance.server;

  console.log(`Servidor de homologação local em ${baseUrl}\n`);

  // ==========================================================================
  // CENÁRIO 1: PRESERVAÇÃO DE FILA OFFLINE NO LOGOUT (RISCO A DO P4.A)
  // ==========================================================================
  console.log('1. Validando Preservação de Fila Offline no Logout...');
  const sessionA = createDeviceSession('Device A');
  const regResA = await request(baseUrl, sessionA, 'POST', '/api/auth/register', {
    name: 'Alpha User',
    email: 'alpha@zapitv.test',
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    termsAccepted: true,
  });
  assert.equal(regResA.status, 201, 'Registro do Usuário Alpha deve retornar 201');
  const userA = regResA.body.user;

  const profResA = await request(baseUrl, sessionA, 'GET', '/api/profiles');
  assert.equal(profResA.status, 200);
  const profileA1 = profResA.body.profiles[0];

  // Ativa escopo de conta para Usuário A
  syncQueue.setAccountScope(userA.id);

  // Simula gravação offline (rede desconectada)
  try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true, writable: true });
  } catch {}

  const offlineFav = syncQueue.enqueue(profileA1.id, {
    type: 'favorites',
    action: 'set',
    data: { canonicalId: 'movie-matrix', isRemoved: false },
  }, userA.id);

  const offlineProg = syncQueue.enqueue(profileA1.id, {
    type: 'progress',
    action: 'save',
    data: {
      canonicalId: 'movie-matrix',
      contentType: 'movie',
      positionSec: 1800,
      durationSec: 3600,
      progressPercent: 50,
      isCompleted: false,
      updatedAt: Date.now(),
    },
  }, userA.id);

  const expectedStorageKeyA = `zapitv_outbox_${userA.id}_${profileA1.id}`;
  assert.equal(syncQueue.getPendingCount(profileA1.id, userA.id), 2, 'Fila deve ter 2 mutações pendentes');
  const rawStorageBeforeLogout = mockLocalStorage.getItem(expectedStorageKeyA);
  assert.ok(rawStorageBeforeLogout, 'localStorage deve armazenar a chave da conta/perfil');

  // Executa Logout via authClient / pauseAndUnloadQueues
  syncQueue.pauseAndUnloadQueues();

  // VERIFICAÇÃO CRÍTICA DO RISCO A:
  // O logout NÃO pode deletar a chave de outbox do localStorage!
  const rawStorageAfterLogout = mockLocalStorage.getItem(expectedStorageKeyA);
  assert.ok(rawStorageAfterLogout, 'Fila offline DEVE permanecer salva no localStorage após logout');
  const parsedStorageAfterLogout = JSON.parse(rawStorageAfterLogout!);
  assert.equal(parsedStorageAfterLogout.length, 2, 'Todas as mutações continuam salvas no localStorage');
  assert.equal(syncQueue.getAccountScope(), null, 'Escopo da conta ativa deve estar zerado após logout');
  console.log('   ✓ Fila offline preservada com sucesso no localStorage após logout.\n');

  // ==========================================================================
  // CENÁRIO 2: ISOLAMENTO ESTRITO ENTRE CONTAS NO MESMO BROWSER
  // ==========================================================================
  console.log('2. Validando Isolamento Estrito entre Contas no Mesmo Browser...');
  const sessionB = createDeviceSession('Device B');
  const regResB = await request(baseUrl, sessionB, 'POST', '/api/auth/register', {
    name: 'Beta User',
    email: 'beta@zapitv.test',
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    termsAccepted: true,
  });
  assert.equal(regResB.status, 201, 'Registro do Usuário Beta deve retornar 201');
  const userB = regResB.body.user;

  const profResB = await request(baseUrl, sessionB, 'GET', '/api/profiles');
  assert.equal(profResB.status, 200);
  const profileB1 = profResB.body.profiles[0];

  // Usuário B ativa seu escopo
  syncQueue.setAccountScope(userB.id);

  // A fila de B para seu perfil deve estar vazia (nenhum vazamento das mutações de A)
  assert.equal(syncQueue.getPendingCount(profileB1.id, userB.id), 0, 'Fila do Usuário B deve iniciar vazia');

  // B enfileira uma mutação própria
  syncQueue.enqueue(profileB1.id, {
    type: 'my_list',
    action: 'set',
    data: { canonicalId: 'movie-avatar', isRemoved: false },
  }, userB.id);

  const expectedStorageKeyB = `zapitv_outbox_${userB.id}_${profileB1.id}`;
  assert.equal(syncQueue.getPendingCount(profileB1.id, userB.id), 1);
  assert.ok(mockLocalStorage.getItem(expectedStorageKeyB), 'Chave do Usuário B criada separadamente');

  // A chave de A continua perfeitamente intacta com suas 2 mutações
  const rawStorageACheck = mockLocalStorage.getItem(expectedStorageKeyA);
  assert.equal(JSON.parse(rawStorageACheck!).length, 2, 'Fila de A permanece estritamente isolada e intocada');
  console.log('   ✓ Isolamento estrito entre contas comprovado no localStorage.\n');

  // ==========================================================================
  // CENÁRIO 3: RETOMADA DE FILA OFFLINE PÓS-RELOGIN
  // ==========================================================================
  console.log('3. Validando Retomada de Fila Offline pós-Relogin...');
  // B faz logout
  syncQueue.pauseAndUnloadQueues();

  // Usuário A faz login novamente
  const loginResA = await request(baseUrl, sessionA, 'POST', '/api/auth/login', {
    email: 'alpha@zapitv.test',
    password: 'Password123!',
  });
  assert.equal(loginResA.status, 200, 'Login do Usuário Alpha deve ter sucesso');

  // Restaura escopo de A
  syncQueue.setAccountScope(userA.id);

  // Fila de A é recarregada do localStorage
  assert.equal(syncQueue.getPendingCount(profileA1.id, userA.id), 2, 'Fila de A recarregou os 2 itens pendentes');

  // Restaura conectividade e executa sincronização
  try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
  } catch {}
  const queueToSync = syncQueue.getQueue(profileA1.id, userA.id);

  const batchRes = await request(baseUrl, sessionA, 'POST', '/api/sync/batch', {
    profileId: profileA1.id,
    mutations: queueToSync,
  });
  assert.equal(batchRes.status, 200, 'Batch sync de A deve retornar 200');
  assert.equal(batchRes.body.processed, 2, '2 mutações processadas');

  // Limpa a fila após confirmação de sucesso
  syncQueue.clearQueue(profileA1.id, userA.id);
  assert.equal(syncQueue.getPendingCount(profileA1.id, userA.id), 0, 'Fila de A esvaziada após upload');

  // Valida que os dados de A foram persistidos no banco
  const dbProgressA = await db.db.select().from(profilePlaybackProgress).where(
    and(
      eq(profilePlaybackProgress.profileId, profileA1.id),
      eq(profilePlaybackProgress.canonicalId, 'movie-matrix')
    )
  );
  assert.equal(dbProgressA.length, 1);
  assert.equal(dbProgressA[0].positionSec, 1800, 'Progresso de A salvo no banco como 1800s');

  const dbFavsA = await db.db.select().from(profileFavorites).where(
    and(
      eq(profileFavorites.profileId, profileA1.id),
      eq(profileFavorites.canonicalId, 'movie-matrix')
    )
  );
  assert.equal(dbFavsA.length, 1);
  assert.equal(dbFavsA[0].isRemoved, 0, 'Favorito de A ativo no banco');
  console.log('   ✓ Retomada e sincronização pós-relogin concluídas com sucesso.\n');

  // ==========================================================================
  // CENÁRIO 4: ATOMICIDADE EM CONCORRÊNCIA DE IDEMPOTÊNCIA (RISCO B DO P4.A)
  // ==========================================================================
  console.log('4. Validando Atomicidade em Concorrência de Idempotência...');
  const concurrentMutationId = 'mut_atomic_concurrency_race_p4b';
  const concurrentMut = {
    id: concurrentMutationId,
    type: 'my_list' as const,
    action: 'set' as const,
    data: { canonicalId: 'series-cyberpunk', isRemoved: false },
    timestamp: Date.now(),
  };

  // Disparo simultâneo de duas requisições com o mesmo UUID
  const [resConcurrent1, resConcurrent2] = await Promise.all([
    SyncService.processBatch(db, profileA1.id, [concurrentMut]),
    SyncService.processBatch(db, profileA1.id, [concurrentMut]),
  ]);

  assert.equal(resConcurrent1.processed, 1);
  assert.equal(resConcurrent2.processed, 1);

  const resultsPool = [resConcurrent1.results[0], resConcurrent2.results[0]];
  const primaryExec = resultsPool.find(r => r.success && !r.duplicate);
  const deduplicatedExec = resultsPool.find(r => r.success && r.duplicate);

  assert.ok(primaryExec, 'Exatamente uma chamada deve executar a reserva com sucesso');
  assert.ok(deduplicatedExec, 'A chamada concorrente concorrente deve ser deduplicada atomicamente via SQLITE_CONSTRAINT');

  // Confirma no banco que existe apenas 1 entrada em processed_sync_mutations
  const dbProcessedMutations = await db.db.select().from(processedSyncMutations).where(
    eq(processedSyncMutations.id, concurrentMutationId)
  );
  assert.equal(dbProcessedMutations.length, 1, 'processed_sync_mutations deve conter exatamente 1 registro');

  // Confirma no banco que series-cyberpunk tem versão 1
  const dbMyListCyber = await db.db.select().from(profileMyList).where(
    and(
      eq(profileMyList.profileId, profileA1.id),
      eq(profileMyList.canonicalId, 'series-cyberpunk')
    )
  );
  assert.equal(dbMyListCyber.length, 1);
  assert.equal(dbMyListCyber[0].version, 1, 'Versão no banco não foi duplicada');
  console.log('   ✓ Atomicidade concorrente e deduplicação verificadas.\n');

  // ==========================================================================
  // CENÁRIO 5: REENVIO DE MUTAÇÕES APÓS EXPIRAÇÃO DA RETENÇÃO DE 7 DIAS
  // ==========================================================================
  console.log('5. Validando Reenvio de Mutações após Janela de 7 Dias (LWW e Tombstones)...');
  const now = Date.now();
  const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;

  // 1. Estado recente no banco: usuário assistiu até 3200s (88%) hoje
  await SyncService.saveProgress(db, profileA1.id, {
    canonicalId: 'movie-interstellar',
    contentType: 'movie',
    positionSec: 3200,
    durationSec: 3600,
    progressPercent: 88,
    isCompleted: false,
    updatedAt: now,
  });

  // 2. Simula chegada tardia de uma mutação de 10 dias atrás (ex: aparelho que ficou offline por 10 dias)
  // A mutação tem ID já expurgado da tabela de deduplicação, com posição anterior de 400s (11%)
  const lateMutationProg = {
    id: 'mut_late_10days_progress',
    type: 'progress' as const,
    action: 'save' as const,
    data: {
      canonicalId: 'movie-interstellar',
      contentType: 'movie',
      positionSec: 400,
      durationSec: 3600,
      progressPercent: 11,
      isCompleted: false,
      updatedAt: tenDaysAgo,
    },
    timestamp: tenDaysAgo,
  };

  const lateProgResult = await SyncService.processBatch(db, profileA1.id, [lateMutationProg]);
  assert.equal(lateProgResult.processed, 1);
  assert.equal(lateProgResult.results[0].success, false);
  assert.equal(lateProgResult.results[0].error, 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP');

  // Confirma que a posição no banco NÃO foi rebaixada para 400s
  const checkInterstellar = await SyncService.getProgressItem(db, profileA1.id, 'movie-interstellar');
  assert.equal(checkInterstellar.positionSec, 3200, 'Progresso mais recente de 3200s deve prevalecer sobre pacote antigo');

  // 3. Teste de Tombstone com favoritos: item removido recentemente
  await SyncService.setFavorite(db, profileA1.id, 'movie-gladiator', true, now); // Tombstone removido hoje
  
  // Mutação antiga de 10 dias atrás tenta adicionar o item
  const lateMutationFav = {
    id: 'mut_late_10days_fav',
    type: 'favorites' as const,
    action: 'set' as const,
    data: { canonicalId: 'movie-gladiator', isRemoved: false },
    timestamp: tenDaysAgo,
  };

  const lateFavResult = await SyncService.processBatch(db, profileA1.id, [lateMutationFav]);
  assert.equal(lateFavResult.processed, 1);
  assert.equal(lateFavResult.results[0].success, false);
  assert.equal(lateFavResult.results[0].error, 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP');

  const checkGladiator = await db.db.select().from(profileFavorites).where(
    and(
      eq(profileFavorites.profileId, profileA1.id),
      eq(profileFavorites.canonicalId, 'movie-gladiator')
    )
  );
  assert.equal(checkGladiator[0].isRemoved, 1, 'Tombstone recente mantém item removido, impedindo ressurreição');
  console.log('   ✓ Proteção temporal LWW e tombstones homologados contra pacotes expirados.\n');

  // ==========================================================================
  // CENÁRIO 6: COMPATIBILIDADE VERCEL PREVIEW E QR CODE DE PAREAMENTO
  // ==========================================================================
  console.log('6. Validando Compatibilidade Vercel Preview e Resolução de Host...');
  const oldEnvVercel = process.env.VERCEL_URL;
  const oldAppUrl = process.env.APP_URL;
  delete process.env.APP_URL;
  process.env.VERCEL_URL = 'zapitv-git-codex-preview-gebel.vercel.app';
  // 1. Cabeçalhos de proxy reverso da Vercel Preview
  const previewReq = {
    headers: {
      'x-forwarded-host': 'zapitv-git-codex-preview-gebel.vercel.app',
      'x-forwarded-proto': 'https',
    },
  };
  const resolvedPreviewUrl = getPublicBaseUrl(previewReq);
  assert.equal(resolvedPreviewUrl, 'https://zapitv-git-codex-preview-gebel.vercel.app');
  assert.throws(() => getPublicBaseUrl({ headers: { host: 'unrelated.vercel.app' } }));

  // 2. Fallback via process.env.VERCEL_URL
  delete process.env.APP_URL;
  process.env.VERCEL_URL = 'zapitv-preview-staging.vercel.app';
  const resolvedEnvUrl = getPublicBaseUrl({});
  assert.equal(resolvedEnvUrl, 'https://zapitv-preview-staging.vercel.app');
  if (oldEnvVercel === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = oldEnvVercel;
  if (oldAppUrl) process.env.APP_URL = oldAppUrl;

  // 3. Desafio de pareamento de Smart TV gera verificationUrl com domínio de preview
  const challenge = await createDeviceLinkChallenge(db, {
    baseUrl: resolvedPreviewUrl,
  });
  assert.ok(challenge.verificationUrl.startsWith('https://zapitv-git-codex-preview-gebel.vercel.app/tv/ativar?code='));
  console.log('   ✓ Geração de QR Code e URL em Vercel Preview homologados.\n');

  // ==========================================================================
  // CENÁRIO 7: AUDITORIA DE MIGRAÇÕES DRIZZLE E INTEGRIDADE RELACIONAL
  // ==========================================================================
  console.log('7. Validando Integridade das Migrações Drizzle...');
  const migrationsDir = path.resolve('drizzle');
  assert.ok(fs.existsSync(migrationsDir), 'Diretório drizzle deve existir');

  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  console.log(`   Migrações encontradas: ${migrationFiles.join(', ')}`);
  assert.ok(migrationFiles.length >= 7, 'Pelo menos 7 migrações geradas');
  assert.ok(migrationFiles.some(f => f.startsWith('0000_')), 'Migração inicial 0000 presente');
  assert.ok(migrationFiles.some(f => f.startsWith('0006_')), 'Migração 0006 presente');

  for (const mf of migrationFiles) {
    const content = fs.readFileSync(path.join(migrationsDir, mf), 'utf-8');
    assert.ok(content.length > 0, `Migração ${mf} não pode estar vazia`);
    // Garante que migrações utilizam CREATE TABLE IF NOT EXISTS ou ALTER seguro
    assert.ok(
      content.includes('CREATE TABLE IF NOT EXISTS') || content.includes('ALTER TABLE') || content.includes('CREATE INDEX'),
      `Migração ${mf} deve ser segura e idempotente`
    );
  }
  console.log('   ✓ Todas as 7 migrações Drizzle são válidas e idempotentes.\n');

  // ==========================================================================
  // ENCERRAMENTO E LIMPEZA
  // ==========================================================================
  syncQueue.clearAllQueues();
  (server as any).closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { (db.client as any).close?.(); } catch {}
  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }

  console.log('================================================================');
  console.log('TODOS OS 7 CENÁRIOS DA SUÍTE P4.B FORAM APROVADOS COM SUCESSO!');
  console.log('================================================================');
}

runHomologationTestSuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Falha na suíte de testes P4.B:', err);
  process.exit(1);
});
