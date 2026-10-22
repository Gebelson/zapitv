import assert from 'node:assert/strict';
import express from 'express';

process.env.TURSO_DATABASE_URL = 'file::memory:';
delete process.env.TURSO_AUTH_TOKEN;
const { watchPartyRouter } = await import('../src/server/watchparty/routes');

const app = express();
app.use(express.json());
app.use('/api/watchparty', watchPartyRouter);
const server = app.listen(0);
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Servidor de teste indisponível');
const base = `http://127.0.0.1:${address.port}/api/watchparty`;
const roomId = `zapi-auth-test-${Date.now()}`;
const post = (url: string, body: unknown, token?: string) => fetch(base + url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body)
});

try {
  const created = await post('/room/announce', { roomId, hostPeerId: 'host', hostNickname: 'Host' });
  assert.equal(created.status, 200);
  const { hostToken } = await created.json();
  assert.match(hostToken, /^[a-f0-9]{64}$/);
  assert.equal((await post('/room/announce', { roomId, hostPeerId: 'attacker' })).status, 403);
  assert.equal((await post('/room/announce', { roomId, hostPeerId: 'host', hostNickname: 'Updated' }, hostToken)).status, 200);
  assert.equal((await post(`/room/${roomId}/heartbeat`, { peerId: 'host', isHost: true })).status, 403);
  assert.equal((await post(`/room/${roomId}/heartbeat`, { peerId: 'guest', isHost: true })).status, 200);
  assert.equal((await fetch(`${base}/room/${roomId}`, { method: 'DELETE' })).status, 403);
  assert.equal((await fetch(`${base}/room/${roomId}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${hostToken}` }
  })).status, 200);
  assert.equal((await fetch(`${base}/room/${roomId}`)).status, 404);
  console.log('Watch Party: anfitrião autenticado por token; falsificação e encerramento não autorizado bloqueados');
} finally {
  server.close();
}
