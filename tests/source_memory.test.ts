import assert from 'node:assert/strict';
import express from 'express';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createDatabase } from '../src/server/database/client';
import { issueSourceTicket, listRememberedSources, recordSourceEvidence, reliabilityScore, validSourceDescriptor } from '../src/server/database/sourceMemory';
import { sourceReliability } from '../src/server/database/schema';
import { sourceReference, prioritizeRememberedSources } from '../src/core/providers/sourceMemory';
import { databaseRouter } from '../src/server/database/routes';
import type { StremioStream } from '../src/core/stremio/stremioTypes';

async function main() {
  const connection = createDatabase('file::memory:');
  await migrate(connection.db, { migrationsFolder: './drizzle' });
  const identity = { canonicalId: 'series:imdb:tt0306414:s01:e01', mediaType: 'series' as const, season: 1, episode: 1 };
  const descriptor = { ...identity, providerId: 'fenixflix-animes', sourceRef: 'westworld|s01e01|hls|1080p', format: 'hls' };
  assert.equal(validSourceDescriptor(descriptor), true);
  assert.equal(validSourceDescriptor({ ...descriptor, canonicalId: 'series:imdb:tt0306414:s01:e02' }), false);
  assert.equal(validSourceDescriptor({ ...descriptor, sourceRef: 'https://example.test/token=x' }), false);

  const stream: StremioStream = { providerId: descriptor.providerId, name: 'Westworld', title: 'S01E01', sourceType: 'hls', quality: '1080p', url: 'https://video.test/watch.m3u8?token=secret' };
  assert.equal(sourceReference(stream), descriptor.sourceRef);
  assert.equal(sourceReference({ ...stream, url: 'https://video.test/new.m3u8?token=changed' }), descriptor.sourceRef);

  const ticket = await issueSourceTicket(connection, descriptor);
  assert.deepEqual(await listRememberedSources(connection, identity), []);
  assert.equal(await recordSourceEvidence(connection, ticket, 'startup_failure', {}), 'recorded');
  assert.equal(await recordSourceEvidence(connection, ticket, 'startup_failure', {}), 'invalid');
  const [failure] = await connection.db.select().from(sourceReliability);
  assert.equal(failure.startupFailures, 1);
  assert.equal(failure.successes, 0);

  const tickets = await Promise.all(Array.from({ length: 5 }, () => issueSourceTicket(connection, descriptor)));
  // Test clock aging in this isolated DB; production tickets must live for 5s before success.
  await connection.client.execute({ sql: 'UPDATE source_evidence_tickets SET issued_at = issued_at - 6000 WHERE outcome IS NULL', args: [] });
  const results = await Promise.all(tickets.map(id => recordSourceEvidence(connection, id, 'success', { startupMs: 1800, audioLanguage: 'pt-BR', quality: '1080p' })));
  assert.deepEqual(results, Array(5).fill('recorded'));
  const [row] = await connection.db.select().from(sourceReliability);
  assert.equal(row.successes, 5);
  assert.equal(row.startupFailures, 1);
  assert.equal(row.audioLanguage, 'pt-BR');
  const remembered = await listRememberedSources(connection, identity);
  assert.equal(remembered.length, 1);
  assert.equal(remembered[0].sourceRef, descriptor.sourceRef);
  assert.equal(await listRememberedSources(connection, { ...identity, episode: 2, canonicalId: 'series:imdb:tt0306414:s01:e02' }).then(rows => rows.length), 0);
  assert.equal(reliabilityScore({ ...row, expiresAt: Date.now() - 1 }), 0);
  assert(reliabilityScore(row) > reliabilityScore({ ...row, lastSuccessAt: Date.now() - 30 * 86_400_000 }));

  const foreign: StremioStream = { ...stream, isPtBr: false, isDubbed: false, name: 'Foreign', title: 'S01E01 EN' };
  const portuguese: StremioStream = { ...stream, isPtBr: true, isDubbed: true };
  const ordered = prioritizeRememberedSources([foreign, portuguese], [{ ...remembered[0], sourceRef: sourceReference(foreign), score: 100 }]);
  assert.equal(ordered[0], portuguese, 'collective score must not outrank PT-BR');
  const sameLanguageAlternative: StremioStream = { ...portuguese, name: 'Other source' };
  const provisionalOrder = prioritizeRememberedSources([sameLanguageAlternative, portuguese], [
    { ...remembered[0], trusted: false, score: 16, sourceRef: sourceReference(portuguese) },
  ]);
  assert.equal(provisionalOrder[0], portuguese, 'one real success may break a tie within the same audio tier');

  // HTTP boundary with an isolated persistent SQLite file (same route shape used on Vercel).
  const apiPath = `./source-memory-test-${process.pid}.db`;
  process.env.TURSO_DATABASE_URL = `file:${apiPath}`;
  const apiDb = createDatabase(process.env.TURSO_DATABASE_URL);
  await migrate(apiDb.db, { migrationsFolder: './drizzle' });
  const app = express();
  app.use(express.json());
  app.use('/api/db', databaseRouter);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    const query = new URLSearchParams({ ...identity, season: '1', episode: '1' });
    let response = await fetch(`${origin}/api/db/source-memory?${query}`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).sources, []);
    response = await fetch(`${origin}/api/db/source-memory/tickets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(descriptor),
    });
    assert.equal(response.status, 200);
    const { ticket: httpTicket } = await response.json();
    response = await fetch(`${origin}/api/db/source-memory/evidence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: httpTicket, outcome: 'success', startupMs: 1000 }),
    });
    assert.equal(response.status, 409, 'server rejects success before real playback duration');
    await apiDb.client.execute({ sql: 'UPDATE source_evidence_tickets SET issued_at = issued_at - 6000', args: [] });
    response = await fetch(`${origin}/api/db/source-memory/evidence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: httpTicket, outcome: 'success', startupMs: 1000 }),
    });
    assert.equal(response.status, 200);
    response = await fetch(`${origin}/api/db/source-memory?${query}`);
    assert.equal((await response.json()).sources.length, 1);
  } finally {
    server.close();
    await apiDb.client.close();
    const { unlink } = await import('node:fs/promises');
    await unlink(apiPath).catch(() => {});
  }
  await connection.client.close();
  console.log('source memory: migration, validation, idempotency, concurrent updates, expiry, episode isolation and audio order passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
