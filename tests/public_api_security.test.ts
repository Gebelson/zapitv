import assert from 'node:assert/strict';

process.env.VERCEL = '1';
const { default: app } = await import('../server.ts');
const server = app.listen(0);

try {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste indisponível');
  const base = `http://127.0.0.1:${address.port}`;

  const blocked = await fetch(`${base}/api/proxy?url=${encodeURIComponent('http://127.0.0.1:4000/')}`);
  assert.equal(blocked.status, 502);
  assert.equal((await blocked.text()).includes('127.0.0.1'), false);

  const malformed = await fetch(`${base}/api/recommendations/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonymousId: 'a', contentId: 'b' })
  });
  assert.equal(malformed.status, 400);

  for (let i = 0; i < 121; i++) {
    const response = await fetch(`${base}/api/watchparty/room/announce`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: '' })
    });
    assert.equal(response.status, i === 120 ? 429 : 400);
    await response.body?.cancel();
  }

  console.log('APIs públicas: SSRF bloqueado, entradas inválidas e limite de criação de salas OK');
} finally {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
process.exit(0);
