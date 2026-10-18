import assert from 'node:assert/strict';
import { FeedbackStore } from '../src/core/feedback/FeedbackStore';

const store = new FeedbackStore(false);
assert.deepEqual(JSON.parse(JSON.stringify(store.getClusters())), { clusters: [], total: 0 });
await store.submitFeedback({
  category: 'video_not_loading',
  userDescription: 'Reprodução não iniciou no teste',
  technicalContext: { canonicalMediaId: 'test:movie:1', mediaTitle: 'Obra de teste', mediaType: 'movie' },
  clientSubmissionToken: 'feedback-contract-test'
});
const payload = JSON.parse(JSON.stringify(store.getClusters()));
assert.equal(payload.total, 1);
assert.equal(payload.clusters.length, 1);
assert.ok(payload.clusters[0].fingerprintData);
assert.equal(payload.clusters[0].totalReports, 1);

process.env.VERCEL = '1';
process.env.TURSO_DATABASE_URL = 'file::memory:';
delete process.env.TURSO_AUTH_TOKEN;
const { getDatabase } = await import('../src/server/database/client');
const connection = getDatabase();
if (!connection) throw new Error('Banco de teste indisponível');
await connection.client.execute(`CREATE TABLE global_settings (
  key TEXT PRIMARY KEY NOT NULL, value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL
)`);
const { default: app } = await import('../server.ts');
const server = app.listen(0);

try {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const path of ['/api/feedback/stats', '/api/feedback/clusters', '/api/feedback/clusters/unknown']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 403, `${path} deve exigir administrador`);
  }
  for (const [method, path] of [
    ['PATCH', '/api/feedback/clusters/unknown'],
    ['POST', '/api/feedback/clusters/unknown/prompt'],
    ['PUT', '/api/feedback/clusters/unknown/prompt'],
    ['POST', '/api/feedback/clusters/unknown/merge'],
    ['POST', '/api/feedback/reports/unknown/split']
  ]) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 403, `${method} ${path} deve exigir administrador`);
  }

  const originalError = console.error;
  console.error = () => {};
  let anonymousSubmit: Response;
  try {
    anonymousSubmit = await fetch(`${baseUrl}/api/feedback/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(anonymousSubmit.status, 400, 'Envio anônimo inválido continua alcançando a validação');
  console.log('Contrato JSON e acesso administrativo do feedback: OK');
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  connection.client.close();
}
// Imports of the full API also start background schedulers; they are outside this route test.
await new Promise(resolve => setTimeout(resolve, 80));
process.exit(0);
