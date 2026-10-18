import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { ContentType, type ContentItem } from '../types';

process.env.TURSO_DATABASE_URL = 'file::memory:';
delete process.env.TURSO_AUTH_TOKEN;

const { getDatabase } = await import('../src/server/database/client');
const { globalSettings } = await import('../src/server/database/schema');
const { catalogReleaseStore } = await import('../src/core/catalog/CatalogReleaseStore');
const { canonicalCatalogMaster } = await import('../src/core/catalog/CanonicalCatalogMaster');
const { CatalogReleaseStorageUnavailable, getPersistedReleases, runPersistedReleaseSync } =
  await import('../src/server/catalog/releaseRepository');
const connection = getDatabase();
if (!connection) throw new Error('Banco de teste indisponível');

const movie = (id: string): ContentItem => ({
  id, title: `Filme ${id.replace('-', ' ')}`, type: ContentType.MOVIE,
  rating: 7, year: 2026, image: `https://example.test/${id}.jpg`
});
const series: ContentItem = {
  id: 'series-a', title: 'Série A', type: ContentType.SERIES, rating: 8, year: 2026,
  image: 'https://example.test/series-a.jpg'
};
const result = () => ({
  timestamp: Date.now(), newMoviesAdded: 0, newSeriesAdded: 0, newAnimesAdded: 0,
  newEpisodesAdded: 0, camSourcesBlocked: 0, theatricalBlocked: 0,
  pendingUnavailables: 0, errors: []
});

try {
  await connection.client.execute(`CREATE TABLE global_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL
  )`);

  await runPersistedReleaseSync(async () => {
    catalogReleaseStore.addRelease(series);
    catalogReleaseStore.recordPending({
      id: 'pending-a', title: 'Pendente A', type: ContentType.MOVIE, reason: 'sem fonte'
    });
    return result();
  });
  catalogReleaseStore.restoreSnapshot(null); // Simula uma nova instância da função Vercel.
  assert.equal(catalogReleaseStore.getReleases().length, 0);
  assert.equal((await getPersistedReleases()).length, 1);

  await runPersistedReleaseSync(async () => {
    assert.equal(catalogReleaseStore.getReleases()[0]?.id, 'series-a');
    assert.equal(catalogReleaseStore.getPendingCount(), 1);
    catalogReleaseStore.addEpisodeToWork('series-a', { id: 'ep-1', number: 1, title: 'Episódio 1' });
    catalogReleaseStore.addRelease(movie('movie-b'));

    // Outro processo salva durante a varredura; o CAS deve unir as duas descobertas.
    const [row] = await connection.db.select().from(globalSettings)
      .where(eq(globalSettings.key, 'catalog_releases_v1')).limit(1);
    assert.ok(row);
    const concurrent = JSON.parse(row.valueJson);
    concurrent.releases[0].episodes = [{
      id: 'ep-2', season: 1, number: 2, title: 'Episódio 2', description: '', image: ''
    }];
    concurrent.releases.push(movie('movie-c'));
    concurrent.pending[0].attempts = 2;
    concurrent.pending[0].lastCheckedAt += 1000;
    await connection.db.update(globalSettings).set({
      valueJson: JSON.stringify(concurrent), version: row.version + 1,
      updatedAt: Date.now(), updatedBy: 'concurrent-test'
    }).where(eq(globalSettings.key, 'catalog_releases_v1'));
    return result();
  });

  catalogReleaseStore.restoreSnapshot(null);
  const releases = await getPersistedReleases();
  assert.deepEqual(new Set(releases.map(item => item.id)), new Set(['series-a', 'movie-b', 'movie-c']));
  assert.deepEqual(releases.find(item => item.id === 'series-a')?.episodes?.map(ep => ep.number), [1, 2]);
  const [saved] = await connection.db.select().from(globalSettings)
    .where(eq(globalSettings.key, 'catalog_releases_v1')).limit(1);
  assert.ok(saved);
  assert.equal(JSON.parse(saved.valueJson).pending[0].attempts, 2);
  assert.equal(saved.version, 3);

  const previousUrl = process.env.TURSO_DATABASE_URL;
  const previousVercel = process.env.VERCEL;
  try {
    delete process.env.TURSO_DATABASE_URL;
    process.env.VERCEL = '1';
    let scanStarted = false;
    await assert.rejects(runPersistedReleaseSync(async () => {
      scanStarted = true;
      return result();
    }), CatalogReleaseStorageUnavailable);
    await assert.rejects(getPersistedReleases(), CatalogReleaseStorageUnavailable);
    assert.equal(scanStarted, false, 'A Vercel não deve varrer sem banco disponível');
  } finally {
    process.env.TURSO_DATABASE_URL = previousUrl;
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
  }
  console.log('catalog_release_persistence.test.ts: passed');
} finally {
  catalogReleaseStore.restoreSnapshot(null);
  canonicalCatalogMaster.dispose();
  connection.client.close();
}
