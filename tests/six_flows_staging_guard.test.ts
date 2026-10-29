import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { databaseHost, validateStagingConfig, removeOwnedTempDirectory } from '../scripts/six_flows_staging_acceptance';

const valid = { TURSO_STAGING_DATABASE_URL: 'libsql://staging.example.test',
  TURSO_STAGING_AUTH_TOKEN: 'fake-local-test-token', TURSO_PRODUCTION_DATABASE_URL: 'libsql://production.example.test' };

test('staging guards accept explicit distinct endpoints and reject unsafe configuration', () => {
  assert.equal(validateStagingConfig(valid).url, valid.TURSO_STAGING_DATABASE_URL);
  for (const endpoint of [undefined, '', 'file:data/production.db', 'http://staging.example.test',
    'libsql://user:secret@staging.example.test', 'libsql://staging.example.test/path',
    'libsql://staging.example.test?token=secret', 'libsql://staging.example.test#fragment', 'libsql://staging.example.test:443']) {
    assert.throws(() => databaseHost(endpoint));
  }
  assert.throws(() => validateStagingConfig({ ...valid, TURSO_PRODUCTION_DATABASE_URL: 'https://STAGING.example.test' }), /STAGING_EQUALS_PRODUCTION/);
  assert.throws(() => validateStagingConfig({ ...valid, TURSO_STAGING_AUTH_TOKEN: '' }), /STAGING_TOKEN_REQUIRED/);
});

test('configuration-only and unauthorized execute finish without importing application or contacting endpoints', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p0-guard-test-'));
  const file = join(directory, '.env.fake');
  try {
    writeFileSync(file, Object.entries({ ...valid, P4B2_ISOLATION_REVIEWED: 'true',
      P0_ALLOW_STAGING_WRITES: 'true', P0_STAGING_ISOLATION_REVIEWED: 'true' }).map(([key, value]) => `${key}=${value}`).join('\n'));
    const env = { ...process.env };
    delete env.P0_ALLOW_STAGING_WRITES;
    delete env.P0_STAGING_ISOLATION_REVIEWED;
    const launch = (mode: string) => spawnSync(process.execPath,
      ['--import', 'tsx', resolve('scripts/six_flows_staging_acceptance.ts'), mode, '--env-file', file],
      { encoding: 'utf8', env, timeout: 10000 });
    const checked = launch('--check');
    assert.equal(checked.status, 0);
    assert.equal(JSON.parse(checked.stdout).networkRequests, 0);
    assert.equal(JSON.parse(checked.stdout).writesExecuted, 0);
    const denied = launch('--execute');
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /ISOLATION_REVIEW_REQUIRED/);
    assert.doesNotMatch(denied.stdout + denied.stderr, /fake-local-test-token|production\.example\.test/);
    const directWorker = spawnSync(process.execPath,
      ['--import', 'tsx', resolve('scripts/six_flows_staging_acceptance.ts'), '--worker'],
      { encoding: 'utf8', env: { ...env, P0_ACCEPTANCE_WORKER: '' }, timeout: 10000 });
    assert.equal(directWorker.status, 1);
    assert.match(directWorker.stderr, /WORKER_NOT_AUTHORIZED/);
  } finally { removeOwnedTempDirectory(directory, 'p0-guard-test-'); }
});

test('recursive fixture cleanup refuses workspace paths and unrelated temp directories', () => {
  assert.throws(() => removeOwnedTempDirectory(resolve('.'), 'zapitv-p0-'), /UNSAFE_FIXTURE_CLEANUP_PATH/);
  assert.throws(() => removeOwnedTempDirectory(tmpdir(), 'zapitv-p0-'), /UNSAFE_FIXTURE_CLEANUP_PATH/);
  assert.throws(() => removeOwnedTempDirectory(join(tmpdir(), 'unrelated'), 'zapitv-p0-'), /UNSAFE_FIXTURE_CLEANUP_PATH/);
});

test('real local HTTP failure retains nonzero exit and verifies fixture cleanup in finally', () => {
  const result = spawnSync(process.execPath,
    ['--import', 'tsx', resolve('scripts/six_flows_staging_acceptance.ts'), '--local-selftest-failure'],
    { encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 1);
  const report = result.stdout.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line))
    .find(item => item.mode === 'local-sqlite-selftest');
  assert.equal(report?.phase, 'registration-login');
  assert.equal(report?.cleanupCompleted, true);
  assert.match(result.stderr, /LOCAL_EXPECTED_FAILPOINT/);
});
