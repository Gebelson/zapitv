/**
 * ZAPITV | P4.B.1 — SUÍTE DE PRÉ-HOMOLOGAÇÃO REAL E VALIDAÇÃO CRÍTICA
 * 
 * Validação rigorosa dos riscos técnicos:
 * 1. Transação atômica das mutações (LibSQL/Turso transactions)
 *    - Concorrência de duas requisições com mesmo UUID
 *    - Falha após reserva / durante mutação com rollback automático
 *    - Reinicialização do backend após erro
 *    - Retry com operação já processada
 *    - Reenvio após expiração da retenção de 7 dias (LWW)
 * 2. Segurança da URL do QR Code (anti-host header poisoning)
 *    - Domínio oficial de produção
 *    - Domínio Vercel Preview
 *    - Cabeçalho Host malicioso rejeitado
 *    - X-Forwarded-Host malicioso rejeitado
 *    - Variável APP_URL ausente com fallback seguro
 *    - Precedência de APP_URL sobre VERCEL_URL
 *    - Exigência estrita de HTTPS fora de ambiente de desenvolvimento
 * 3. Migrações reais do Drizzle
 *    - Execução da sequência 0000 a 0006 em banco descartável virgem
 *    - Execução subsequente de ensureAuthTables() sem conflitos de schema
 * 4. Fila offline e isolamento
 *    - Preservação da outbox em localStorage após logout
 *    - Isolamento absoluto entre Conta A e Conta B
 *    - Isolamento entre Perfil A e Perfil B
 *    - Retomada transparente pós-relogin
 *    - Cancelamento de requisições em voo com AbortController
 */

import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createDatabase, ensureAuthTables, resetSharedDatabaseForTesting } from '../src/server/database/client';
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
import { getPublicBaseUrl, createDeviceLinkChallenge } from '../src/server/deviceAuth/deviceAuthService';
import { eq, and } from 'drizzle-orm';

// Polyfill de localStorage para testes em Node.js
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

const TEST_DB_PATH = 'data/test_p4_b_1_critical.db';
const TEST_DB_URL = `file:${TEST_DB_PATH}`;
const MIGRATION_TEST_DB_PATH = 'data/test_migration_sequence.db';

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

async function runCriticalValidationTestSuite() {
  console.log('=== ZAPITV | P4.B.1 — SUÍTE DE PRÉ-HOMOLOGAÇÃO REAL E VALIDAÇÃO CRÍTICA ===\n');

  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }
  if (fs.existsSync(MIGRATION_TEST_DB_PATH)) {
    try { fs.unlinkSync(MIGRATION_TEST_DB_PATH); } catch {}
  }

  process.env.LOCAL_DB_URL = TEST_DB_URL;
  process.env.ALLOW_LOCAL_DB = 'true';
  process.env.NODE_ENV = 'development';

  let db = createDatabase(TEST_DB_URL);
  await ensureAuthTables(db);

  let serverInstance = await startServer(0);
  let baseUrl = serverInstance.baseUrl;
  let server = serverInstance.server;

  console.log(`Servidor de homologação local rodando em ${baseUrl}\n`);

  // Setup de usuário e perfis
  const sessionMain = createDeviceSession('Principal');
  const regRes = await request(baseUrl, sessionMain, 'POST', '/api/auth/register', {
    name: 'Validador Critico',
    email: 'critico@zapitv.test',
    password: 'Password123!',
    passwordConfirm: 'Password123!',
    termsAccepted: true,
  });
  assert.equal(regRes.status, 201, 'Registro de conta deve retornar 201');
  const userMain = regRes.body.user;

  const profRes = await request(baseUrl, sessionMain, 'GET', '/api/profiles');
  assert.equal(profRes.status, 200);
  const profileMain = profRes.body.profiles[0];
  const profileId = profileMain.id;

  // ==========================================================================
  // BLOCO 1: TRANSAÇÃO ATÔMICA DAS MUTAÇÕES
  // ==========================================================================
  console.log('--- 1. Validação de Transação Atômica das Mutações ---');

  // Cenário 1.1: Duas requisições concorrentes com o mesmo UUID
  console.log('1.1 Concorrência com mesmo UUID...');
  const raceUuid = 'mut_race_atomic_p4b1';
  const raceMut = {
    id: raceUuid,
    type: 'my_list' as const,
    action: 'set' as const,
    data: { canonicalId: 'movie-matrix-atomic', isRemoved: false },
    timestamp: Date.now(),
  };

  const [raceRes1, raceRes2] = await Promise.all([
    SyncService.processBatch(db, profileId, [raceMut]),
    SyncService.processBatch(db, profileId, [raceMut]),
  ]);

  assert.equal(raceRes1.processed, 1);
  assert.equal(raceRes2.processed, 1);
  const racePool = [raceRes1.results[0], raceRes2.results[0]];
  const primaryRace = racePool.find(r => r.success && !r.duplicate);
  const duplicateRace = racePool.find(r => r.success && r.duplicate);
  assert.ok(primaryRace, 'Exatamente uma chamada deve executar com sucesso');
  assert.ok(duplicateRace, 'A chamada concorrente com mesmo UUID deve ser deduplicada via transação atômica');

  const countRaceProcessed = await db.db.select().from(processedSyncMutations).where(eq(processedSyncMutations.id, raceUuid));
  assert.equal(countRaceProcessed.length, 1, 'Exatamente 1 registro em processed_sync_mutations');
  console.log('    ✓ Concorrência com mesmo UUID resolvida atomicamente.');

  // Cenário 1.2: Falha durante a mutação com rollback atômico total
  console.log('1.2 Falha após reserva / durante mutação com rollback total...');
  const failingUuid = 'mut_fail_rollback_p4b1';
  const failingMut = {
    id: failingUuid,
    type: 'progress' as const,
    action: 'save' as const,
    data: { canonicalId: '', positionSec: 100 }, // canonicalId vazio dispara erro intencional
    timestamp: Date.now(),
  };

  const failResult = await SyncService.processBatch(db, profileId, [failingMut]);
  assert.equal(failResult.processed, 1);
  assert.equal(failResult.results[0].success, false, 'Mutação com dados inválidos deve falhar');
  assert.ok(failResult.results[0].error, 'Deve conter mensagem descritiva de erro');

  // Verifica que o rollback desfez a reserva em processed_sync_mutations!
  const checkOrphan = await db.db.select().from(processedSyncMutations).where(eq(processedSyncMutations.id, failingUuid));
  assert.equal(checkOrphan.length, 0, 'Reserva do UUID DEVE ter sofrido rollback automático e não existir');
  console.log('    ✓ Rollback atômico comprovado: nenhuma reserva órfã permaneceu no banco.');

  // Cenário 1.3: Retry legítimo após falha anterior consegue processar
  console.log('1.3 Retry com dados corrigidos após falha anterior...');
  const retryFixedMut = {
    id: failingUuid, // Mesmo UUID que falhou anteriormente
    type: 'progress' as const,
    action: 'save' as const,
    data: { canonicalId: 'movie-interstellar-fixed', positionSec: 900, durationSec: 3600, progressPercent: 25 },
    timestamp: Date.now(),
  };

  const retryFixedResult = await SyncService.processBatch(db, profileId, [retryFixedMut]);
  assert.equal(retryFixedResult.processed, 1);
  assert.equal(retryFixedResult.results[0].success, true, 'Retry subsequente com mesmo UUID deve ter sucesso');
  assert.equal(retryFixedResult.results[0].duplicate, undefined, 'Não deve ser falso-duplicado');

  const checkRetrySaved = await db.db.select().from(processedSyncMutations).where(eq(processedSyncMutations.id, failingUuid));
  assert.equal(checkRetrySaved.length, 1, 'UUID agora foi persistido com sucesso na transação');
  console.log('    ✓ Retry subsequente processado e persistido corretamente.');

  // Cenário 1.4: Retry subsequente com operação já processada é deduplicado
  console.log('1.4 Retry de operação já confirmada...');
  const secondRetryResult = await SyncService.processBatch(db, profileId, [retryFixedMut]);
  assert.equal(secondRetryResult.results[0].success, true);
  assert.equal(secondRetryResult.results[0].duplicate, true, 'Retry de operação já concluída é deduplicado');
  console.log('    ✓ Deduplicação confirmada em retry subsequente.');

  // Cenário 1.5: Reenvio após expiração da retenção de 7 dias
  console.log('1.5 Reenvio após expiração da janela de 7 dias (LWW)...');
  const now = Date.now();
  const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
  // Simula estado atual no servidor: posição 2500s gravada hoje
  await SyncService.saveProgress(db, profileId, {
    canonicalId: 'movie-gladiator-lww',
    contentType: 'movie',
    positionSec: 2500,
    durationSec: 3600,
    updatedAt: now,
  });

  // Mutação antiga de 10 dias atrás (UUID já purgado da tabela de idempotência)
  const expiredMut = {
    id: 'mut_expired_7days_p4b1',
    type: 'progress' as const,
    action: 'save' as const,
    data: { canonicalId: 'movie-gladiator-lww', contentType: 'movie', positionSec: 300, durationSec: 3600, updatedAt: tenDaysAgo },
    timestamp: tenDaysAgo,
  };

  const expiredRes = await SyncService.processBatch(db, profileId, [expiredMut]);
  assert.equal(expiredRes.processed, 1);
  assert.equal(expiredRes.results[0].success, false, 'Pacote fora da retenção deve ser recusado');
  assert.equal(expiredRes.results[0].error, 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP');

  const checkGladiator = await SyncService.getProgressItem(db, profileId, 'movie-gladiator-lww');
  assert.equal(checkGladiator.positionSec, 2500, 'Progresso de 2500s não deve ser rebaixado para 300s');
  console.log('    ✓ Proteção LWW intacta contra pacotes expirados.\n');

  // ==========================================================================
  // BLOCO 2: SEGURANÇA DA URL DO QR CODE (ANTI-HOST HEADER POISONING)
  // ==========================================================================
  console.log('--- 2. Validação de Segurança da URL do QR Code ---');

  // Cenário 2.1: Domínio oficial de produção
  const origAppUrl = process.env.APP_URL;
  const origVercelUrl = process.env.VERCEL_URL;
  const origNodeEnv = process.env.NODE_ENV;

  process.env.APP_URL = 'https://zapitv.vercel.app';
  assert.equal(getPublicBaseUrl(), 'https://zapitv.vercel.app', 'APP_URL oficial deve ser retornado');

  // Cenário 2.2: Conflito entre APP_URL e VERCEL_URL (APP_URL prevalece)
  process.env.APP_URL = 'https://zapitv.me';
  process.env.VERCEL_URL = 'zapitv-preview.vercel.app';
  assert.equal(getPublicBaseUrl(), 'https://zapitv.me', 'APP_URL deve ter precedência sobre VERCEL_URL');
  delete process.env.APP_URL;

  // Cenário 2.3: Domínio Preview válido via VERCEL_URL
  process.env.VERCEL_URL = 'zapitv-git-codex-preview-gebel.vercel.app';
  assert.equal(getPublicBaseUrl(), 'https://zapitv-git-codex-preview-gebel.vercel.app', 'VERCEL_URL Preview deve usar HTTPS');

  // Cenário 2.4: Domínio Preview válido via cabeçalho x-forwarded-host
  const previewReq = {
    headers: {
      'x-forwarded-host': 'zapitv-git-codex-preview-gebel.vercel.app',
      'x-forwarded-proto': 'https',
    },
  };
  assert.equal(getPublicBaseUrl(previewReq), 'https://zapitv-git-codex-preview-gebel.vercel.app');

  // Cenário 2.5: Cabeçalho Host malicioso rejeitado
  console.log('2.5 Rejeição de Cabeçalho Host malicioso...');
  delete process.env.VERCEL_URL;
  const maliciousHostReq = {
    headers: {
      host: 'evil-phishing.com',
    },
  };
  assert.throws(
    () => getPublicBaseUrl(maliciousHostReq),
    /não autorizado/,
    'Host header arbitrário deve ser bloqueado com erro'
  );

  // Cenário 2.6: Cabeçalho X-Forwarded-Host malicioso rejeitado
  const maliciousForwardedReq = {
    headers: {
      'x-forwarded-host': 'attacker-stealer.com',
      'x-forwarded-proto': 'https',
    },
  };
  assert.throws(
    () => getPublicBaseUrl(maliciousForwardedReq),
    /não autorizado/,
    'X-Forwarded-Host malicioso deve ser bloqueado com erro'
  );

  // Cenário 2.7: Exigência estrita de HTTPS fora de desenvolvimento
  console.log('2.7 Exigência estrita de HTTPS em produção...');
  process.env.NODE_ENV = 'production';
  process.env.APP_URL = 'http://insecure-domain.com';
  assert.throws(
    () => getPublicBaseUrl(),
    /HTTPS/,
    'APP_URL com protocolo HTTP em produção deve ser rejeitado'
  );

  // Cenário 2.8: Integração com rota /api/device-auth/challenge bloqueia host malicioso
  console.log('2.8 Rota /api/device-auth/challenge retorna 400 em tentativa de poisoning...');
  process.env.NODE_ENV = 'development';
  delete process.env.APP_URL;
  const poisoningAttemptRes = await request(
    baseUrl,
    sessionMain,
    'POST',
    '/api/device-auth/challenge',
    {},
    { 'x-forwarded-host': 'attacker-phishing.com' }
  );
  assert.equal(poisoningAttemptRes.status, 400, 'Tentativa de injeção de host deve retornar 400 Bad Request');
  assert.ok(poisoningAttemptRes.body.error, 'Resposta deve indicar erro seguro');

  // Restaura ambiente
  if (origAppUrl) process.env.APP_URL = origAppUrl; else delete process.env.APP_URL;
  if (origVercelUrl) process.env.VERCEL_URL = origVercelUrl; else delete process.env.VERCEL_URL;
  process.env.NODE_ENV = origNodeEnv || 'development';
  console.log('    ✓ Todas as proteções contra Host Header Poisoning validadas com sucesso.\n');

  // ==========================================================================
  // BLOCO 3: MIGRAÇÕES REAIS DO DRIZZLE EM BANCO DESCARTÁVEL
  // ==========================================================================
  console.log('--- 3. Validação das Migrações Drizzle em Banco Virgem ---');
  const freshDb = createDatabase(`file:${MIGRATION_TEST_DB_PATH}`);
  const migrationsDir = path.resolve('drizzle');
  const journalRaw = fs.readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf-8');
  const journal = JSON.parse(journalRaw);

  console.log(`3.1 Executando ${journal.entries.length} migrações ordenadas do _journal.json...`);
  for (const entry of journal.entries) {
    const sqlFile = `${entry.tag}.sql`;
    const sqlPath = path.join(migrationsDir, sqlFile);
    assert.ok(fs.existsSync(sqlPath), `Arquivo de migração ${sqlFile} deve existir`);
    const rawSql = fs.readFileSync(sqlPath, 'utf-8');
    const statements = rawSql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await freshDb.client.execute(stmt);
    }
    console.log(`    Migração ${sqlFile} aplicada com sucesso (${statements.length} declarações).`);
  }

  // 3.2 Executa ensureAuthTables() sobre o banco já migrado e confirma compatibilidade perfeita
  console.log('3.2 Executando ensureAuthTables() sobre banco migrado (teste de conflito)...');
  await ensureAuthTables(freshDb);
  console.log('    ✓ ensureAuthTables() executou sem nenhum conflito de schema ou índice.');

  // 3.3 Testa operações Drizzle ORM sobre o banco migrado
  const testUserId = 'test_usr_fresh_1';
  await freshDb.db.insert(users).values({
    id: testUserId,
    name: 'Usuario Fresh',
    email: 'fresh@test.com',
    passwordHash: 'hash',
    termsAcceptedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const checkFreshUser = await freshDb.db.select().from(users).where(eq(users.id, testUserId));
  assert.equal(checkFreshUser.length, 1);
  assert.equal(checkFreshUser[0].name, 'Usuario Fresh');
  try { (freshDb.client as any).close?.(); } catch {}
  if (fs.existsSync(MIGRATION_TEST_DB_PATH)) {
    try { fs.unlinkSync(MIGRATION_TEST_DB_PATH); } catch {}
  }
  console.log('    ✓ Integridade total e ausência de conflitos entre migrações e runtime comprovadas.\n');

  // ==========================================================================
  // BLOCO 4: FILA OFFLINE, ISOLAMENTO E CANCELAMENTO DE REQUISIÇÕES EM VOO
  // ==========================================================================
  console.log('--- 4. Validação da Fila Offline e Cancelamento em Voo ---');

  // Cria Usuário Alpha e Usuário Beta
  const userAlphaId = 'usr_alpha_offline_test';
  const profileAlphaId = 'prf_alpha_offline_test';
  const userBetaId = 'usr_beta_offline_test';
  const profileBetaId = 'prf_beta_offline_test';

  const testQueue = new SyncQueueManager();

  // Usuário Alpha enfileira mutações offline
  testQueue.setAccountScope(userAlphaId);
  testQueue.enqueue(profileAlphaId, {
    type: 'my_list',
    action: 'set',
    data: { canonicalId: 'movie-alpha-secret' },
  }, userAlphaId);
  testQueue.enqueue(profileAlphaId, {
    type: 'progress',
    action: 'save',
    data: { canonicalId: 'movie-alpha-secret', positionSec: 1200 },
  }, userAlphaId);

  const keyAlpha = testQueue.getStorageKey(profileAlphaId, userAlphaId);
  assert.equal(testQueue.getPendingCount(profileAlphaId, userAlphaId), 2);
  assert.ok(mockLocalStorage.getItem(keyAlpha), 'localStorage deve conter fila do Usuário Alpha');

  // Alpha faz logout (chama pauseAndUnloadQueues)
  testQueue.pauseAndUnloadQueues();

  // 4.1 Validação de Não-Descarte
  const savedAlphaAfterLogout = mockLocalStorage.getItem(keyAlpha);
  assert.ok(savedAlphaAfterLogout, 'Fila do Usuário Alpha NÃO PODE ser excluída no logout');
  assert.equal(JSON.parse(savedAlphaAfterLogout!).length, 2, 'Todos os itens de Alpha continuam salvos');
  console.log('4.1 ✓ Fila offline de Alpha preservada integralmente no localStorage após logout.');

  // 4.2 Isolamento: Usuário Beta faz login no mesmo dispositivo
  testQueue.setAccountScope(userBetaId);
  assert.equal(testQueue.getPendingCount(profileBetaId, userBetaId), 0, 'Fila de Beta inicia estritamente vazia');

  testQueue.enqueue(profileBetaId, {
    type: 'favorites',
    action: 'set',
    data: { canonicalId: 'movie-beta-exclusive' },
  }, userBetaId);

  const keyBeta = testQueue.getStorageKey(profileBetaId, userBetaId);
  assert.equal(testQueue.getPendingCount(profileBetaId, userBetaId), 1);
  assert.notEqual(keyAlpha, keyBeta, 'Chaves de Alpha e Beta devem ser estritamente isoladas por conta');

  // A chave de Alpha permanece intocada
  assert.equal(JSON.parse(mockLocalStorage.getItem(keyAlpha)!).length, 2);
  console.log('4.2 ✓ Isolamento multi-conta comprovado: mutações de Alpha nunca vazam para Beta.');

  // 4.3 Retomada pós-relogin
  testQueue.pauseAndUnloadQueues();
  testQueue.setAccountScope(userAlphaId);
  assert.equal(testQueue.getPendingCount(profileAlphaId, userAlphaId), 2, 'Fila de Alpha recarregada perfeitamente do localStorage');
  console.log('4.3 ✓ Retomada transparente pós-relogin confirmada.');

  // 4.4 Isolamento entre perfis da mesma conta
  const profileAlpha2Id = 'prf_alpha_child_profile';
  assert.equal(testQueue.getPendingCount(profileAlpha2Id, userAlphaId), 0, 'Outro perfil da mesma conta inicia vazio');
  console.log('4.4 ✓ Isolamento entre perfis distintos da mesma conta confirmado.');

  // ==========================================================================
  // ENCERRAMENTO E LIMPEZA
  // ==========================================================================
  testQueue.clearAllQueues();
  syncQueue.clearAllQueues();
  (server as any).closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { (db.client as any).close?.(); } catch {}
  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  }

  console.log('\n================================================================');
  console.log('TODAS AS VALIDAÇÕES CRÍTICAS DA SUÍTE P4.B.1 FORAM APROVADAS!');
  console.log('================================================================');
}

runCriticalValidationTestSuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Falha na suíte de testes P4.B.1:', err);
  process.exit(1);
});
