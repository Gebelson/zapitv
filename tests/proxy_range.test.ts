import assert from 'node:assert/strict';
import { normalizeProxyRange } from '../src/server/proxyRange';

assert.equal(normalizeProxyRange('bytes=0-'), 'bytes=0-4194303');
assert.equal(normalizeProxyRange('bytes=100-199'), 'bytes=100-199');
assert.equal(normalizeProxyRange('bytes=100-99999999'), 'bytes=100-4194403');
assert.equal(normalizeProxyRange('bytes=-500'), 'bytes=-500');
assert.equal(normalizeProxyRange('bytes=-9999999999'), 'bytes=-4194304');
assert.equal(normalizeProxyRange('bytes=0-99,200-299'), 'bytes=0-99,200-299');
assert.equal(normalizeProxyRange('bytes=0-99999999,200-299'), null);
assert.equal(normalizeProxyRange('bytes=200-100'), null);
assert.equal(normalizeProxyRange('bytes=9007199254740992-'), null);
console.log('Proxy: intervalos grandes limitados; seek, sufixo e multipart preservados OK');
