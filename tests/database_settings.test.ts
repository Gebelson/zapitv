import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createDatabase } from '../src/server/database/client';
import { readSetting, SettingVersionConflict, writeSetting } from '../src/server/database/settings';
import { episodes, media, mediaExternalIds } from '../src/server/database/schema';
import express from 'express';
import { databaseRouter } from '../src/server/database/routes';

describe('Database and Settings Storage', () => {
  it('manages settings and schema properly', async () => {
    const connection = createDatabase('file::memory:');
    try {
      await migrate(connection.db, { migrationsFolder: './drizzle' });
  assert.equal(await readSetting(connection, 'hero_carousel'), null);

  const first = await writeSetting(connection, 'hero_carousel', [{ id: 'a', title: 'A' }], 0, 'admin-1');
  assert.equal(first.version, 1);
  assert.deepEqual((await readSetting(connection, 'hero_carousel'))?.value, [{ id: 'a', title: 'A' }]);

  await assert.rejects(writeSetting(connection, 'hero_carousel', [], 0, 'admin-2'), SettingVersionConflict);
  const second = await writeSetting(connection, 'hero_carousel', [{ id: 'b', title: 'B' }], 1, 'admin-1');
  assert.equal(second.version, 2);
  await assert.rejects(writeSetting(connection, 'hero_carousel', [], 1, 'admin-2'), SettingVersionConflict);

  const concurrent = await Promise.allSettled([
    writeSetting(connection, 'hero_carousel', [{ id: 'c', title: 'C' }], 2, 'admin-1'),
    writeSetting(connection, 'hero_carousel', [{ id: 'd', title: 'D' }], 2, 'admin-2'),
  ]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await readSetting(connection, 'hero_carousel'))?.version, 3);

  const audit = await connection.client.execute('select previous_version, next_version from admin_audit order by created_at');
  assert.equal(audit.rows.length, 3);

  await connection.db.insert(media).values({ id: 'media-a', type: 'SÉRIE', title: 'Obra A', updatedAt: Date.now() });
  await connection.db.insert(media).values({ id: 'media-b', type: 'SÉRIE', title: 'Obra B', updatedAt: Date.now() });
  await connection.db.insert(mediaExternalIds).values({ mediaId: 'media-a', provider: 'imdb', externalId: 'tt001' });
  await assert.rejects(connection.db.insert(mediaExternalIds).values({ mediaId: 'media-b', provider: 'imdb', externalId: 'tt001' }));
  await connection.db.insert(episodes).values({ id: 'ep-a', mediaId: 'media-a', seasonNumber: 1, episodeNumber: 1, updatedAt: Date.now() });
  await assert.rejects(connection.db.insert(episodes).values({ id: 'ep-b', mediaId: 'media-a', seasonNumber: 1, episodeNumber: 1, updatedAt: Date.now() }));
  await assert.rejects(connection.db.insert(episodes).values({ id: 'ep-orphan', mediaId: 'missing', seasonNumber: 1, episodeNumber: 2, updatedAt: Date.now() }));

  const app = express();
  app.use(express.json());
  app.use('/api/db', databaseRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const publicResponse = await fetch(`${baseUrl}/api/db/global-settings/hero-carousel`);
    assert.equal(publicResponse.status, 200);
    assert.equal((await publicResponse.json()).configured, false);
    const sectionResponse = await fetch(`${baseUrl}/api/db/global-settings/section-titles`);
    assert.equal(sectionResponse.status, 200);
    assert.equal((await sectionResponse.json()).configured, false);
    const writeResponse = await fetch(`${baseUrl}/api/db/global-settings/hero-carousel`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [], expectedVersion: 0 }),
    });
    assert.equal(writeResponse.status, 503);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  console.log('database_settings.test.ts: passed');
    } finally {
      connection.client.close();
    }
  });
});
