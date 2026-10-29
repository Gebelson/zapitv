import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const suite = path.resolve('tests/one_piece_episode_accuracy.test.ts');
function run(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', ...args], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, NODE_ENV: 'test', VERCEL: '1', TURSO_DATABASE_URL: 'file::memory:', TURSO_AUTH_TOKEN: '' },
  });
}

test('One Piece accuracy assertions complete with a natural process exit', () => {
  const result = run([suite]);
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, (result.stderr || result.stdout).slice(-2500));
  assert.match(result.stdout, /TODOS OS TESTES DE INTEGRIDADE DE ONE PIECE FORAM CONCLUÍDOS/);
});

test('catalog teardown preserves a pre-existing failure exit code', () => {
  const result = run(['--input-type=module', '-e', `process.exitCode = 7; await import(${JSON.stringify(pathToFileURL(suite).href)});`]);
  assert.ifError(result.error);
  assert.equal(result.status, 7, 'cleanup must never force a successful process exit');
});
