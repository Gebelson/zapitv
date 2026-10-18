import assert from 'node:assert/strict';

process.env.VERCEL = '1';
const previousSecret = process.env.CRON_SECRET;
const previousDatabaseUrl = process.env.TURSO_DATABASE_URL;
const previousDatabaseToken = process.env.TURSO_AUTH_TOKEN;
delete process.env.CRON_SECRET;
process.env.TURSO_DATABASE_URL = 'file::memory:';
delete process.env.TURSO_AUTH_TOKEN;

const { getDatabase } = await import('../src/server/database/client.ts');
const connection = getDatabase();
if (!connection) throw new Error('Banco de teste indisponível');
await connection.client.execute(`CREATE TABLE global_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
)`);

const { default: app } = await import('../server.ts');
const { featuredRankingService } = await import('../src/core/rankings/FeaturedRankingService.ts');
const { catalogReleaseScheduler } = await import('../src/core/catalog/CatalogReleaseScheduler.ts');

const originalFeaturedUpdate = featuredRankingService.runWeeklyScheduledUpdate;
const originalReleaseSync = catalogReleaseScheduler.executeManualSync;
let featuredCalls = 0;
let releaseCalls = 0;

(featuredRankingService as any).runWeeklyScheduledUpdate = async () => {
  featuredCalls++;
  return {
    weekKey: 'test-week', weekLabel: 'Test week', referenceDate: '2026-10-18',
    lastUpdatedAt: '2026-10-18', nextScheduledUpdateFormatted: 'Next week',
    featuredMovies: [], featuredSeries: [], updateStatus: 'SUCCESS'
  };
};
(catalogReleaseScheduler as any).executeManualSync = async () => {
  releaseCalls++;
  return { timestamp: Date.now() };
};

const server = app.listen(0);

try {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = (path: string, options: RequestInit = {}) => fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Connection: 'close', ...(options.headers as Record<string, string> | undefined) }
  });
  const cronRoutes = [
    ['GET', '/api/featured/cron'],
    ['POST', '/api/featured/cron'],
    ['GET', '/api/catalog/sync-releases'],
    ['POST', '/api/catalog/sync-releases']
  ] as const;

  for (const [method, path] of cronRoutes) {
    const response = await request(path, {
      method, headers: { Authorization: 'Bearer test-cron-secret', 'x-vercel-cron': '1' }
    });
    assert.equal(response.status, 401, `${method} ${path} must fail closed without CRON_SECRET`);
  }

  process.env.CRON_SECRET = 'test-cron-secret';
  for (const [method, path] of cronRoutes) {
    const spoofedHeader = await request(path, { method, headers: { 'x-vercel-cron': '1' } });
    assert.equal(spoofedHeader.status, 401, `${method} ${path} must reject a spoofed cron header`);

    const queryToken = await request(`${path}?secret=test-cron-secret`, { method });
    assert.equal(queryToken.status, 401, `${method} ${path} must reject a URL token`);

    const wrongToken = await request(path, { method, headers: { Authorization: 'Bearer wrong' } });
    assert.equal(wrongToken.status, 401, `${method} ${path} must reject the wrong Bearer token`);
  }
  assert.equal(featuredCalls, 0);
  assert.equal(releaseCalls, 0);

  for (const path of ['/api/featured/refresh', '/api/featured/import-snapshot', '/api/recommendations/train']) {
    const response = await request(path, { method: 'POST' });
    assert.equal(response.status, 403, `${path} must require a Firebase admin`);
  }

  for (const [method, path] of cronRoutes) {
    const response = await request(path, {
      method, headers: { Authorization: 'Bearer test-cron-secret' }
    });
    assert.equal(response.status, 200, `${method} ${path} must accept the configured secret`);
  }
  assert.equal(featuredCalls, 2);
  assert.equal(releaseCalls, 2);
  console.log('Maintenance route authorization: OK');
} finally {
  (featuredRankingService as any).runWeeklyScheduledUpdate = originalFeaturedUpdate;
  (catalogReleaseScheduler as any).executeManualSync = originalReleaseSync;
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
  if (previousDatabaseUrl === undefined) delete process.env.TURSO_DATABASE_URL;
  else process.env.TURSO_DATABASE_URL = previousDatabaseUrl;
  if (previousDatabaseToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
  else process.env.TURSO_AUTH_TOKEN = previousDatabaseToken;
  connection.client.close();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
await new Promise(resolve => setTimeout(resolve, 200));
process.exit(0);
