import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('pareamento, Origin, autenticação e bloqueio de origem local', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'zapitv-helper-test-'));
  const port = 19900 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '')], {
    env: { ...process.env, ZAPITV_HELPER_PORT: String(port), ZAPITV_HELPER_DIR: directory },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  try {
    for (let i = 0; i < 40 && !output.includes('Código de pareamento:'); i++) await new Promise(resolve => setTimeout(resolve, 50));
    assert.match(output, /Código de pareamento: \d{6}/);
    const code = output.match(/Código de pareamento: (\d{6})/)[1];
    const base = `http://127.0.0.1:${port}`;
    const origin = 'https://zapitv-stream.vercel.app';
    const badOrigin = await fetch(base + '/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(badOrigin.status, 403);
    assert.equal((await fetch(base + '/library', { headers: { Origin: origin } })).status, 401);
    const pair = await fetch(base + '/pair', { method: 'POST', headers: { Origin: origin, 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    assert.equal(pair.status, 200);
    const { token } = await pair.json();
    assert.equal((await fetch(base + '/library', { headers: { Origin: origin, Authorization: `Bearer ${token}` } })).status, 200);
    const blocked = await fetch(base + '/jobs', { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ itemId: 'tmdb-1', title: 'Teste', format: 'mp4', url: 'http://127.0.0.1:4000/video.mp4', offlineAllowed: true }) });
    assert.equal(blocked.status, 400);
    const revoked = await fetch(base + '/disconnect', { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}` } });
    assert.equal(revoked.status, 200);
    assert.equal((await fetch(base + '/library', { headers: { Origin: origin, Authorization: `Bearer ${token}` } })).status, 401);
  } finally {
    child.kill();
    await rm(directory, { recursive: true, force: true });
  }
});
