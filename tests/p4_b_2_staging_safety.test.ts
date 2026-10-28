import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createDatabase } from '../src/server/database/client';
import { users, profiles } from '../src/server/database/schema';
import { SyncService, type SyncMutation } from '../src/server/sync/syncService';
import { getPublicBaseUrl } from '../src/server/deviceAuth/deviceAuthService';

async function run() {
  const failures: string[] = [];
  const previous = { NODE_ENV: process.env.NODE_ENV, APP_URL: process.env.APP_URL,
    PUBLIC_URL: process.env.PUBLIC_URL, VERCEL_URL: process.env.VERCEL_URL };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.APP_URL; delete process.env.PUBLIC_URL;
    process.env.VERCEL_URL = 'authorized-preview.vercel.app';
    assert.equal(getPublicBaseUrl(), 'https://authorized-preview.vercel.app');
    assert.equal(getPublicBaseUrl({ headers: { host: 'authorized-preview.vercel.app' } }), 'https://authorized-preview.vercel.app');
    for (const host of ['unrelated-preview.vercel.app', 'zapitv.vercel.app', 'authorized-preview.vercel.app.evil.test']) {
      try { assert.throws(() => getPublicBaseUrl({ headers: { 'x-forwarded-host': host } })); }
      catch { failures.push(`QR accepted unauthorized host: ${host}`); }
    }
    process.env.APP_URL = 'https://staging.example.test';
    assert.equal(getPublicBaseUrl({ headers: { host: 'evil.test' } }), 'https://staging.example.test');
    process.env.APP_URL = 'https://dummy:dummy@staging.example.test';
    assert.throws(() => getPublicBaseUrl());
    process.env.APP_URL = 'https://staging.example.test/path';
    assert.throws(() => getPublicBaseUrl());
    delete process.env.APP_URL; delete process.env.VERCEL_URL;
    try { assert.throws(() => getPublicBaseUrl({ headers: { host: 'unrelated-preview.vercel.app' } })); }
    catch { failures.push('QR accepted a deployment without explicit origin configuration'); }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  const db = createDatabase('file::memory:');
  const originalNow = Date.now;
  let clock = originalNow();
  try {
    await migrate(db.db, { migrationsFolder: './drizzle' });
    Date.now = () => clock;
    const userId = randomUUID(), profileId = randomUUID();
    await db.db.insert(users).values({ id: userId, name: 'Test', email: `${userId}@example.test`, passwordHash: 'test-only',
      termsAcceptedAt: clock, createdAt: clock, updatedAt: clock });
    await db.db.insert(profiles).values({ id: profileId, userId, name: 'Test', avatarId: 'test', createdAt: clock, updatedAt: clock });
    const mutations: SyncMutation[] = [
      { id: randomUUID(), type: 'my_list', action: 'set', data: { canonicalId: 'test-list' }, timestamp: clock },
      { id: randomUUID(), type: 'favorites', action: 'set', data: { canonicalId: 'test-favorite' }, timestamp: clock },
      { id: randomUUID(), type: 'progress', action: 'save', data: { canonicalId: 'test-progress', contentType: 'movie', positionSec: 900, durationSec: 1800 }, timestamp: clock }
    ];
    const originalSendTime = clock;
    assert.equal((await SyncService.processBatch(db, profileId, mutations, clock)).processed, 3);
    clock += 8 * 24 * 60 * 60 * 1000;
    assert.equal(await SyncService.purgeExpiredMutations(db), 3);
    const newer = mutations.map(m => ({ ...m, id: randomUUID(), timestamp: clock,
      action: m.type === 'progress' ? 'save' as const : 'remove' as const,
      data: m.type === 'progress' ? { ...m.data, positionSec: 200 } : m.data }));
    assert.equal((await SyncService.processBatch(db, profileId, newer, clock)).processed, 3);
    assert.ok((await SyncService.processBatch(db, profileId, newer, clock)).results.every(r => r.duplicate));
    const replay = await SyncService.processBatch(db, profileId, mutations, originalSendTime);
    const list = await db.client.execute('SELECT is_removed FROM profile_my_list');
    const favorite = await db.client.execute('SELECT is_removed FROM profile_favorites');
    const progress = await db.client.execute('SELECT position_sec FROM profile_playback_progress');
    if (replay.results.some(result => result.success)) failures.push('Expired UUID replay accepted after cleanup');
    assert.ok(replay.results.every(result => result.error === 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP'));
    if (Number(list.rows[0].is_removed) !== 1) failures.push('Expired replay resurrected Minha Lista');
    if (Number(favorite.rows[0].is_removed) !== 1) failures.push('Expired replay resurrected favorite');
    if (Number(progress.rows[0].position_sec) !== 200) failures.push('Expired replay overwrote newer progress');
    for (const timestamp of [clock - 7 * 24 * 60 * 60 * 1000, 0, Number.NaN]) {
      const result = await SyncService.processBatch(db, profileId, [{ ...mutations[0], id: randomUUID(), timestamp }], clock);
      assert.equal(result.results[0].success, false);
    }
    assert.equal((await db.client.execute('SELECT count(*) AS n FROM __drizzle_migrations')).rows[0].n, 7);
  } finally {
    Date.now = originalNow;
    db.client.close();
  }
  assert.deepEqual(failures, []);
  console.log('P4.B.2 local safety: exact QR origin, seven migrations, expired replay and newer state preservation passed. Remote not tested.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
