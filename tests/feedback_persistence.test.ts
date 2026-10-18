import assert from 'node:assert/strict';

process.env.TURSO_DATABASE_URL = 'file::memory:';
delete process.env.TURSO_AUTH_TOKEN;

const { getDatabase } = await import('../src/server/database/client');
const { withFeedbackStore } = await import('../src/server/feedback/repository');
const connection = getDatabase();
if (!connection) throw new Error('Banco de teste indisponível');

try {
  await connection.client.execute(`CREATE TABLE global_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL
  )`);

  await Promise.all(Array.from({ length: 6 }, (_, index) =>
    withFeedbackStore(store => store.submitFeedback({
      category: 'video_not_loading',
      userDescription: `Falha ${index}`,
      technicalContext: { canonicalMediaId: 'test:movie:1', mediaType: 'movie', mediaTitle: 'Obra de teste' },
      clientSubmissionToken: `parallel-${index}`
    }), { write: true, actor: 'anonymous-feedback' })
  ));

  const snapshot = await withFeedbackStore(store => store.getSnapshot());
  assert.equal(snapshot.reports.length, 6, 'Gravações concorrentes não podem perder relatos');
  assert.equal(new Set(snapshot.reports.map(report => report.id)).size, 6);
  assert.equal(snapshot.clusters.reduce((sum, cluster) => sum + cluster.totalReports, 0), 6);
  const clusterId = snapshot.clusters[0].id;
  await withFeedbackStore(store => store.updateClusterStatus(clusterId, 'investigating', 'admin-test'), {
    write: true, actor: 'admin-test'
  });
  const persisted = await withFeedbackStore(store => store.getClusterDetails(clusterId));
  assert.equal(persisted?.cluster.status, 'investigating');
  const [row] = await connection.client.execute('SELECT version FROM global_settings WHERE key = ?', ['feedback_store_v1']).then(result => result.rows);
  assert.equal(row.version, 7);
  console.log('Feedback no Turso local: persistência e concorrência OK');
} finally {
  connection.client.close();
}
