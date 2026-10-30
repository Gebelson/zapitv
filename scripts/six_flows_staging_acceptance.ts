/** Explicit opt-in remote acceptance. Default --check is configuration-only (no network).
 * No environment file is imported into the parent process or forwarded wholesale.
 * --local-selftest exercises the same HTTP assertions against disposable SQLite;
 * it is never evidence of remote acceptance.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import http from 'node:http';

const filename = fileURLToPath(import.meta.url);
const root = resolve(dirname(filename), '..');
function requireCondition(condition: unknown, code: string): asserts condition { if (!condition) throw new Error(code); }

export function databaseHost(raw: string | undefined): string {
  requireCondition(raw, 'DATABASE_ENDPOINT_REQUIRED');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('DATABASE_ENDPOINT_INVALID'); }
  requireCondition(['libsql:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
    !url.search && !url.hash && ['', '/'].includes(url.pathname) && !url.port, 'DATABASE_ENDPOINT_UNSAFE');
  return url.hostname.toLowerCase();
}

export function validateStagingConfig(env: Record<string, string | undefined>) {
  const staging = databaseHost(env.TURSO_STAGING_DATABASE_URL);
  requireCondition(staging !== databaseHost(env.TURSO_PRODUCTION_DATABASE_URL), 'STAGING_EQUALS_PRODUCTION');
  requireCondition(env.TURSO_STAGING_AUTH_TOKEN?.trim(), 'STAGING_TOKEN_REQUIRED');
  return { url: env.TURSO_STAGING_DATABASE_URL!, token: env.TURSO_STAGING_AUTH_TOKEN! };
}

export function removeOwnedTempDirectory(directory: string, prefix: 'zapitv-p0-' | 'p0-guard-test-') {
  const absolute = resolve(directory);
  const tempRoot = `${resolve(tmpdir())}${sep}`;
  requireCondition(absolute.toLowerCase().startsWith(tempRoot.toLowerCase()) &&
    basename(absolute).startsWith(prefix), 'UNSAFE_FIXTURE_CLEANUP_PATH');
  rmSync(absolute, { recursive: true, force: true });
}

async function worker(local: boolean) {
  const runUUID = randomUUID();
  const marker = `p0-${runUUID}`;
  const fixture = mkdtempSync(join(tmpdir(), 'zapitv-p0-'));
  const originalCwd = process.cwd();
  process.chdir(fixture); // All server-side filesystem caches are disposable.
  const { createClient } = await import('@libsql/client');
  const { drizzle } = await import('drizzle-orm/libsql');
  const schema = await import('../src/server/database/schema');
  let databaseDeadline = AbortSignal.timeout(150000);
  const client = createClient({ url: local ? 'file::memory:' : process.env.TURSO_DATABASE_URL!,
    authToken: local ? undefined : process.env.TURSO_AUTH_TOKEN,
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([databaseDeadline, AbortSignal.timeout(15000)]) }) });
  const db = { client, db: drizzle(client, { schema }) };
  let server: http.Server | undefined;
  let disposeCatalog = () => {};
  let phase = 'preflight';
  let cleanupCompleted = false;
  let fixturesStarted = false;
  const startedAt = Date.now();
  const emails = [`${marker}-a@example.test`, `${marker}-b@example.test`];
  const passed: string[] = [];
  const deadline = AbortSignal.timeout(150000);
  try {
    if (local) {
      const { migrate } = await import('drizzle-orm/libsql/migrator');
      await migrate(db.db, { migrationsFolder: join(root, 'drizzle') });
    } else {
      // Read-only preflight, using the existing P4.B snapshot contract (not a migration).
      const { readMigrationFiles } = await import('drizzle-orm/migrator');
      const migrations = readMigrationFiles({ migrationsFolder: join(root, 'drizzle') });
      const tx = await client.transaction('read');
      try {
        const applied = (await tx.execute('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')).rows;
        requireCondition(applied.length === 7 && migrations.length === 8, 'PREFLIGHT_LEDGER_CHANGED');
        requireCondition(applied.every((row, i) => row.hash === migrations[i].hash && Number(row.created_at) === migrations[i].folderMillis), 'PREFLIGHT_JOURNAL_MISMATCH');
        const expected = JSON.parse(readFileSync(join(root, 'drizzle/meta/0006_snapshot.json'), 'utf8')).tables;
        const entries = Object.entries(expected) as [string, any][];
        const metadata = await tx.batch(entries.map(([table]) => `PRAGMA table_info("${table}")`));
        for (const [index, [, definition]] of entries.entries()) {
          const actual = new Set(metadata[index].rows.map(row => String(row.name)));
          requireCondition(Object.keys(definition.columns).every(column => actual.has(column)), 'PREFLIGHT_REQUIRED_SCHEMA_MISSING');
        }
        await tx.rollback();
      } finally { tx.close(); }
      console.log(JSON.stringify({ mode: 'remote-readonly-preflight', migrationCount: 7, expectedMigrations: 8,
        journalMatches: true, missingRequiredTablesOrColumns: [], fullSchemaCompatibilityApproved: false }));
    }
    const { setTestDatabase } = await import('../src/server/auth/authMiddleware');
    setTestDatabase(db); // Bypasses ensureAuthTables: no remote DDL.
    const { canonicalCatalogMaster } = await import('../src/core/catalog/CanonicalCatalogMaster');
    disposeCatalog = () => canonicalCatalogMaster.dispose();
    const { default: app } = await import('../server.ts');
    server = http.createServer(app);
    await new Promise<void>((resolveListen, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', resolveListen);
    });
    const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
    type Jar = Map<string, string>;
    const pc: Jar = new Map(), mobile: Jar = new Map(), tv: Jar = new Map(), other: Jar = new Map(), guest: Jar = new Map();
    async function request(jar: Jar, method: string, path: string, body?: unknown, expected = 200) {
      const response = await fetch(`${base}${path}`, { method, signal: AbortSignal.any([deadline, AbortSignal.timeout(20000)]),
        headers: { 'Content-Type': 'application/json', Origin: base, 'User-Agent': `${marker} SmartTV`,
          'X-Forwarded-For': marker, Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') },
        body: body === undefined ? undefined : JSON.stringify(body) });
      // Deliberately never print body/header data, even in assertion failures.
      requireCondition(response.status === expected, `HTTP_${method}_${path.split('?')[0]}_EXPECTED_${expected}_GOT_${response.status}`);
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';')[0], index = pair.indexOf('=');
        const key = pair.slice(0, index), value = pair.slice(index + 1);
        if (!value || /max-age=0/i.test(raw)) jar.delete(key); else jar.set(key, value);
      }
      const data = await response.json();
      return { data, headers: response.headers };
    }
    const check = (condition: unknown, code: string) => requireCondition(condition, code);
    phase = 'policy';
    const policy = (await request(guest, 'GET', '/api/auth/policy')).data;
    check(policy.mandatoryAuth === true, 'STAGING_POLICY_MUST_ALREADY_REQUIRE_AUTH');
    check((await request(guest, 'GET', '/api/auth/me')).data.authenticated === false, 'GUEST_SESSION');
    await request(guest, 'GET', '/api/featured'); // Explicit catalog exception.
    await request(guest, 'GET', '/api/validate-stream?url=https%3A%2F%2Fexample.com%2Fp0.m3u8', undefined, 401);
    await request(guest, 'GET', '/api/stremio/p0/stream/movie/p0.json', undefined, 401);
    await request(guest, 'GET', '/api/proxy?url=https%3A%2F%2Fexample.com%2Fp0.m3u8', undefined, 401);
    passed.push('mandatoryAuth policy endpoint, streaming gates and public exceptions');

    phase = 'registration-login';
    fixturesStarted = true;
    const password = `P0-${randomUUID()}-9`;
    const register = async (jar: Jar, email: string) => (await request(jar, 'POST', '/api/auth/register', {
      name: marker, email, password, passwordConfirm: password, termsAccepted: true }, 201)).data.user;
    const accountA = await register(pc, emails[0]);
    const accountB = await register(other, emails[1]);
    if (local && process.env.P0_LOCAL_FAILPOINT === 'after-registration') throw new Error('LOCAL_EXPECTED_FAILPOINT');
    await request(pc, 'POST', '/api/auth/logout', {});
    check((await request(pc, 'GET', '/api/auth/me')).data.authenticated === false, 'LOGOUT_NOT_REVOKED');
    await request(pc, 'POST', '/api/auth/login', { email: emails[0], password });
    check((await request(pc, 'GET', '/api/auth/me')).data.user.id === accountA.id, 'LOGIN_ACCOUNT_MISMATCH');
    passed.push('register, password login, logout and real database sessions');

    phase = 'qr';
    const challenge = (await request(tv, 'POST', '/api/device-auth/challenge', {}, 201)).data;
    check(new URL(challenge.verificationUrl).origin === 'https://staging.example.test', 'QR_ORIGIN');
    check((await request(tv, 'GET', '/api/auth/me')).data.authenticated === false, 'TV_AUTH_BEFORE_APPROVAL');
    await request(guest, 'POST', '/api/device-auth/approve', { userCode: challenge.userCode }, 401);
    await request(mobile, 'POST', '/api/auth/login', { email: emails[0], password });
    await request(mobile, 'POST', '/api/device-auth/approve', { userCode: challenge.userCode });
    const poll = await request(tv, 'POST', '/api/device-auth/poll', { deviceCode: challenge.deviceCode });
    check(poll.data.status === 'approved' && !('cookieToken' in poll.data), 'QR_APPROVAL_OR_TOKEN_BODY');
    check(tv.get('zapitv_session') && tv.get('zapitv_session') !== mobile.get('zapitv_session') && tv.get('zapitv_session') !== pc.get('zapitv_session'), 'TV_SESSION_NOT_INDEPENDENT');
    check((await request(tv, 'GET', '/api/auth/me')).data.user.id === accountA.id, 'TV_WRONG_ACCOUNT');
    await request(mobile, 'POST', '/api/auth/logout', {});
    check((await request(tv, 'GET', '/api/auth/me')).data.authenticated === true, 'MOBILE_LOGOUT_REVOKED_TV');
    await request(tv, 'POST', '/api/device-auth/poll', { deviceCode: challenge.deviceCode }, 400);
    passed.push('QR create, mobile login, authenticated approval, TV poll, distinct session and single use');

    phase = 'profiles-progress-isolation';
    const profiles = (await request(pc, 'GET', '/api/profiles')).data.profiles;
    const profileA = profiles[0];
    const avatarId = (await request(pc, 'GET', '/api/profiles/avatars')).data.avatars[0].id;
    const profileA2 = (await request(pc, 'POST', '/api/profiles', { name: 'P0 alternate', avatarId }, 201)).data.profile;
    const profileB = (await request(other, 'GET', '/api/profiles')).data.profiles[0];
    await request(pc, 'PUT', `/api/profiles/${profileA2.id}`, { name: 'P0 edited', avatarId });
    await request(pc, 'POST', `/api/profiles/${profileA.id}/select`, {});
    await request(tv, 'POST', `/api/profiles/${profileA.id}/select`, {});
    check((await request(pc, 'GET', '/api/profiles/active')).data.profile.id === profileA.id, 'PROFILE_SELECTION');
    const canonicalId = `p0:${runUUID}`;
    await request(pc, 'POST', '/api/sync/progress', { canonicalId, contentType: 'movie', positionSec: 123,
      durationSec: 1200, deviceName: marker, updatedAt: Date.now(), clientMutationId: randomUUID(), clientSendTime: Date.now() });
    const pulled = (await request(tv, 'GET', '/api/sync/pull')).data;
    check(pulled.profileId === profileA.id && pulled.progress.some((row: any) => row.canonicalId === canonicalId && row.positionSec === 123), 'PC_PROGRESS_NOT_ON_TV');
    for (const [jar, id] of [[pc, profileA2.id], [other, profileB.id]] as [Jar, string][]) {
      const state = (await request(jar, 'GET', `/api/sync/pull?profileId=${id}`)).data;
      check(!state.progress.some((row: any) => row.canonicalId === canonicalId), 'PROGRESS_LEAK');
    }
    await request(other, 'POST', `/api/profiles/${profileA.id}/select`, {}, 403);
    await request(other, 'GET', `/api/sync/pull?profileId=${profileA.id}`, undefined, 403);
    await request(other, 'POST', '/api/sync/progress', { profileId: profileA.id, canonicalId, positionSec: 999, durationSec: 1200 }, 403);
    await request(other, 'GET', `/api/auth/user/${accountA.id}`, undefined, 403);
    passed.push('profiles create/edit/select, PC to TV progress, account and profile isolation');

    phase = 'cross-device-continuity';
    // The QR isolation test intentionally logged this session out; authenticate it anew.
    await request(mobile,'POST','/api/auth/login',{email:emails[0],password});
    await request(mobile,'POST',`/api/profiles/${profileA.id}/select`,{});
    const continuityCases = [
      ['tt0388629','One Piece',1999,'series'],['tt5753856','Dark',2017,'series'],
      ['tmdb-121','Doctor Who',1963,'series'],['tt2531336','Lupin',2021,'series'],
      [`anime:${runUUID}`,'Controlled anime fixture',2021,'anime'],
    ] as const;
    const mutations = continuityCases.flatMap(([id,title,year,type],index)=>[
      {id:randomUUID(),type:'progress',action:'save',timestamp:Date.now(),data:{canonicalId:id,contentType:type,season:1,episode:index+1,positionSec:120+index,durationSec:1200}},
      {id:randomUUID(),type:'history',action:'save',timestamp:Date.now(),data:{canonicalId:id,contentType:type,season:1,episode:index+1,title,year,posterUrl:'https://image.example.test/controlled.jpg'}},
      {id:randomUUID(),type:'my_list',action:'set',timestamp:Date.now(),data:{canonicalId:id}},
    ]);
    for (let offset=0;offset<mutations.length;offset+=3) {
      const chunk=mutations.slice(offset,offset+3);
      const batch=(await request(pc,'POST','/api/sync/batch',{profileId:profileA.id,mutations:chunk,clientSendTime:Date.now()})).data;
      check(batch.results?.length===chunk.length && batch.results.every((result:any)=>result.success===true),'CONTINUITY_BATCH_NOT_CONFIRMED');
    }
    const states = await Promise.all([pc,mobile,tv].map(async jar=>(await request(jar,'GET',`/api/sync/pull?profileId=${profileA.id}`)).data));
    const normalized = states.map(state=>state.progress.filter((row:any)=>continuityCases.some(([id])=>id===row.canonicalId)).map((row:any)=>[row.canonicalId,row.contentType,row.season,row.episode,row.positionSec,row.version]).sort());
    check(JSON.stringify(normalized[0])===JSON.stringify(normalized[1]) && JSON.stringify(normalized[1])===JSON.stringify(normalized[2]) && normalized[0].length===5,'CONTINUITY_THREE_SESSION_PARITY');
    check(states.every(state=>state.history.some((row:any)=>row.canonicalId==='tmdb-121'&&row.title==='Doctor Who'&&row.year===1963)),'CONTINUITY_HISTORY_METADATA');
    passed.push('five real remote progress/history/list records identical across three independent HTTP sessions');

    phase = 'admin-uid';
    process.env.ADMIN_EMAILS = emails[1];
    process.env.ADMIN_USER_IDS = accountA.id;
    check((await request(pc, 'GET', '/api/auth/me')).data.user.role === 'admin', 'ADMIN_UID_ROLE');
    check((await request(other, 'GET', '/api/auth/me')).data.user.role === 'user', 'EMAIL_GRANTED_ADMIN');
    const page = await request(pc, 'GET', '/api/auth/admin/users');
    check(Array.isArray(page.data.users) && page.headers.get('cache-control')?.includes('no-store'), 'ADMIN_USERS_CONTRACT');
    check(page.data.users.every((user: any) => !('passwordHash' in user) && !('token' in user)), 'ADMIN_USERS_SECRET_FIELD');
    await request(other, 'GET', '/api/auth/admin/users', undefined, 403);
    await request(guest, 'GET', '/api/auth/admin/users', undefined, 401);
    await request(other, 'GET', '/api/catalog/diagnostic', undefined, 403);
    await request(guest, 'GET', '/api/catalog/diagnostic', undefined, 403);
    await request(pc, 'GET', '/api/catalog/diagnostic');
    passed.push('ADMIN_USER_IDS grants, email cannot grant admin, diagnostic denials');

    phase = 'unauthenticated-outbox';
    const mutation = { id: randomUUID(), type: 'progress', action: 'save', timestamp: Date.now(),
      data: { canonicalId, contentType: 'movie', positionSec: 999, durationSec: 1200 } };
    await request(guest, 'POST', '/api/sync/batch', { profileId: profileA.id, mutations: [mutation], clientSendTime: Date.now() }, 401);
    await request(other, 'POST', '/api/sync/batch', { profileId: profileA.id, mutations: [mutation], clientSendTime: Date.now() }, 403);
    const finalState = (await request(tv, 'GET', '/api/sync/pull')).data;
    check(finalState.progress.some((row: any) => row.canonicalId === canonicalId && row.positionSec === 123), 'DENIED_MUTATION_CHANGED_PROGRESS');
    check((await client.execute({ sql: 'SELECT count(*) AS n FROM processed_sync_mutations WHERE id = ?', args: [mutation.id] })).rows[0].n === 0, 'DENIED_MUTATION_RESERVED_ID');
    passed.push('unauthenticated/cross-account queued mutation refused without persistence');
    phase = 'complete';
  } catch(error) {
    console.error(JSON.stringify({phase,elapsedMs:Date.now()-startedAt,errorName:error instanceof Error ? error.name : 'UnknownError',deadlineExceeded:deadline.aborted,databaseDeadlineExceeded:databaseDeadline.aborted}));
    throw error;
  } finally {
    // Stop accepting requests before cleanup. On HTTP timeout the DB fetch timeout
    // is shorter, so the handler settles before the request deadline.
    if (server) { server.closeAllConnections(); await new Promise<void>(done => server!.close(() => done())); }
    try {
      databaseDeadline = AbortSignal.timeout(60000);
      if (fixturesStarted) {
      // All predicates refer only to this UUID's accounts/UA/IP; no age-only deletes.
      const userSql = 'SELECT id FROM users WHERE email IN (?, ?) AND name = ? AND created_at >= ?';
      const args = [...emails, marker, startedAt];
      const profileSql = `SELECT id FROM profiles WHERE user_id IN (${userSql})`;
      await client.batch([
        ...['processed_sync_mutations', 'profile_playback_progress', 'profile_watch_history', 'profile_my_list', 'profile_favorites']
          .map(table => ({ sql: `DELETE FROM ${table} WHERE profile_id IN (${profileSql})`, args })),
        ...['linked_devices', 'sessions', 'profiles'].map(table => ({ sql: `DELETE FROM ${table} WHERE user_id IN (${userSql})`, args })),
        { sql: 'DELETE FROM device_link_challenges WHERE user_agent = ? AND created_at >= ?', args: [`${marker} SmartTV`, startedAt] },
        { sql: 'DELETE FROM login_attempts WHERE ip_address = ? AND attempt_at >= ?', args: [marker, startedAt] },
        { sql: `DELETE FROM users WHERE id IN (${userSql})`, args },
      ], 'write');
      const remaining = await client.batch([
        { sql: `SELECT count(*) AS n FROM users WHERE id IN (${userSql})`, args },
        { sql: 'SELECT count(*) AS n FROM device_link_challenges WHERE user_agent = ?', args: [`${marker} SmartTV`] },
        { sql: 'SELECT count(*) AS n FROM login_attempts WHERE ip_address = ?', args: [marker] },
      ], 'read');
      requireCondition(remaining.every(result => Number(result.rows[0].n) === 0), 'CLEANUP_NOT_EMPTY');
      }
      cleanupCompleted = true;
    } finally {
      disposeCatalog();
      client.close(); process.chdir(originalCwd); removeOwnedTempDirectory(fixture, 'zapitv-p0-');
      console.log(JSON.stringify({ mode: local ? 'local-sqlite-selftest' : 'remote-staging-http', runUUID,
        phase, elapsedMs: Date.now()-startedAt, passed, cleanupCompleted, fullSchemaCompatibilityApproved: false,
        limits: ['No browser UI/device hardware assertion', 'No physical network-offline assertion', 'No global policy writes or migrations in remote mode'] }));
    }
  }
}

async function main() {
  if (process.argv.includes('--worker')) {
    requireCondition(process.env.P0_ACCEPTANCE_WORKER === 'true', 'WORKER_NOT_AUTHORIZED');
    return worker(process.env.P0_LOCAL_SELFTEST === 'true');
  }
  const failpoint = process.argv.includes('--local-selftest-failure');
  const local = process.argv.includes('--local-selftest') || failpoint;
  const index = process.argv.indexOf('--env-file');
  const env = index >= 0 ? parseEnv(readFileSync(process.argv[index + 1], 'utf8')) : process.env;
  const config = local ? null : validateStagingConfig(env);
  if (!local && !process.argv.includes('--execute')) {
    console.log(JSON.stringify({ mode: 'configuration-only', valid: true, networkRequests: 0, writesExecuted: 0,
      requires: ['P0_STAGING_ISOLATION_REVIEWED=true', 'P0_ALLOW_STAGING_WRITES=true'], fullSchemaCompatibilityApproved: false }));
    return;
  }
  if (!local) {
    requireCondition(process.env.P0_STAGING_ISOLATION_REVIEWED === 'true', 'ISOLATION_REVIEW_REQUIRED');
    requireCondition(process.env.P0_ALLOW_STAGING_WRITES === 'true', 'STAGING_WRITES_NOT_AUTHORIZED');
  }
  // Explicit child allowlist: production URLs/tokens and inherited app/admin config
  // are never exposed to modules imported by the acceptance worker.
  const childEnv: Record<string, string> = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) {
    if (process.env[key]) childEnv[key] = process.env[key]!;
  }
  Object.assign(childEnv, { VERCEL: '1', NODE_ENV: 'production', APP_URL: 'https://staging.example.test',
    MANDATORY_AUTH: 'true', P0_ACCEPTANCE_WORKER: 'true', P0_LOCAL_SELFTEST: String(local) });
  if (failpoint) childEnv.P0_LOCAL_FAILPOINT = 'after-registration';
  if (config) Object.assign(childEnv, { TURSO_DATABASE_URL: config.url, TURSO_AUTH_TOKEN: config.token });
  const child = spawn(process.execPath, ['--import', 'tsx', filename, '--worker'], { cwd: root, env: childEnv, stdio: 'inherit' });
  // Last-resort bound exceeds the worker's150s request budget +60s cleanup budget.
  // Kill only this child, report cleanup as unconfirmed, and preserve failure status.
  let timedOut = false;
  const watchdog = setTimeout(() => {
    timedOut = true;
    console.error(JSON.stringify({ status: 'failed', code: 'WORKER_DEADLINE_EXCEEDED', cleanupCompleted: false }));
    child.kill();
  }, 240000);
  try {
    await new Promise<void>((done, reject) => { child.once('error', () => reject(new Error('WORKER_START_FAILED')));
      child.once('exit', code => { process.exitCode = !timedOut && code === 0 ? 0 : 1; done(); }); });
  } finally { clearTimeout(watchdog); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    // Suppress SQL text, endpoint URLs, cookies and assertion actual/expected values.
    const message = error instanceof Error ? error.message : '';
    console.error(JSON.stringify({ status: 'failed', code: /^[A-Z0-9_/.-]+$/i.test(message) ? message.toUpperCase() : 'ACCEPTANCE_FAILED' }));
    process.exitCode = 1;
  });
}
