import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('retomada preserva identidade sem salvar URL temporária', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'zapitv-helper-resume-'));
  const port = 20500 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const origin = 'https://zapitv-stream.vercel.app';
  let child;
  const start = async () => {
    child = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, '')], { env: { ...process.env, ZAPITV_HELPER_PORT: String(port), ZAPITV_HELPER_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    for (let i = 0; i < 40 && !output.includes('Código de pareamento:'); i++) await new Promise(resolve => setTimeout(resolve, 50));
    const code = output.match(/Código de pareamento: (\d{6})/)?.[1];
    assert.ok(code, output);
    const pair = await fetch(base + '/pair', { method: 'POST', headers: { Origin: origin, 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const { token } = await pair.json();
    return { Origin: origin, Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  };
  try {
    let headers = await start();
    const body = JSON.stringify({ itemId: 'tmdb-123', title: 'Teste', type: 'FILME', quality: 'Original', format: 'mp4', offlineAllowed: true, url: 'http://8.8.8.8/video.mp4' });
    const first = await (await fetch(base + '/jobs', { method: 'POST', headers, body })).json();
    const id = first.job.id;
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    const persisted = await readFile(path.join(directory, '.zapitv-jobs.json'), 'utf8');
    assert.ok(persisted.includes(id));
    assert.ok(!persisted.includes('8.8.8.8'));
    headers = await start();
    const saved = await (await fetch(base + '/jobs', { headers })).json();
    assert.equal(saved.jobs.find(job => job.id === id)?.status, 'paused');
    const resumed = await (await fetch(base + '/jobs', { method: 'POST', headers, body })).json();
    assert.equal(resumed.job.id, id);
  } finally {
    child?.kill();
    await rm(directory, { recursive: true, force: true });
  }
});
