import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAddress, validHost, resolvePublicUrl, safeName } from '../security.mjs';

test('bloqueia redes locais e endereços reservados', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', 'fc00::1']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('8.8.8.8'), true);
});

test('valida Host e URLs de origem', async () => {
  assert.equal(validHost('evil.example:19573', 19573), false);
  assert.equal(validHost('127.0.0.1:19573', 19573), true);
  await assert.rejects(resolvePublicUrl('http://127.0.0.1/video.mp4'));
  await assert.rejects(resolvePublicUrl('http://169.254.169.254/metadata'));
  await assert.rejects(resolvePublicUrl('file:///etc/passwd'));
});

test('nome de arquivo não permite escapar da pasta local', () => {
  assert.equal(safeName('../filme\\:teste'), 'filmeteste');
});
