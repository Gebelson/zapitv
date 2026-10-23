import assert from 'node:assert/strict';
import { createPinnedPublicLookup, isPublicIp, publicHttpGet } from '../src/server/security/publicHttp';

const pinned = createPinnedPublicLookup('8.8.8.8', 4);
pinned('example.com', { all: true }, (error, addresses) => {
  assert.equal(error, null);
  assert.deepEqual(addresses, [{ address: '8.8.8.8', family: 4 }]);
});
pinned('example.com', { all: false }, (error, address, family) => {
  assert.equal(error, null);
  assert.equal(address, '8.8.8.8');
  assert.equal(family, 4);
});

assert.equal(isPublicIp('127.0.0.1'), false);
assert.equal(isPublicIp('10.1.2.3'), false);
assert.equal(isPublicIp('169.254.169.254'), false);
assert.equal(isPublicIp('192.168.1.1'), false);
assert.equal(isPublicIp('192.0.0.10'), false);
assert.equal(isPublicIp('198.51.100.1'), false);
assert.equal(isPublicIp('203.0.113.1'), false);
assert.equal(isPublicIp('::1'), false);
assert.equal(isPublicIp('fc00::1'), false);
assert.equal(isPublicIp('::ffff:127.0.0.1'), false);
assert.equal(isPublicIp('2002:c0a8:0101::'), false);
assert.equal(isPublicIp('8.8.8.8'), true);
assert.equal(isPublicIp('2606:4700::1111'), true);

for (const url of ['file:///etc/passwd', 'http://localhost:4000/', 'http://127.0.0.1/',
  'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://metadata.google.internal/']) {
  await assert.rejects(publicHttpGet(url));
}

console.log('Destinos HTTP públicos: bloqueio de protocolos e endereços internos OK');
