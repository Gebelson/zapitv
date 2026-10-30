import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteHlsManifest } from '../src/server/rewriteHlsManifest';

describe('HLS references must stay on the media origin', () => {
  it('keeps every variant, subtitle and segment on the origin of its source', () => {
    const source = 'https://media.example/cdn/master.m3u8?token=abc';
    const manifest = [
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=SUBTITLES,URI="/captions/pt.m3u8"',
      '#EXT-X-STREAM-INF:BANDWIDTH=2000000',
      '/hls/720p.m3u8',
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
      '#EXTINF:4.0,',
      'https://segments.example/part1.ts',
      ''
    ].join('\n');

    const rewritten = rewriteHlsManifest(manifest, source);
    assert.ok(rewritten?.includes('URI="https://media.example/captions/pt.m3u8"'));
    assert.ok(rewritten?.includes('https://media.example/hls/720p.m3u8'));
    assert.ok(rewritten?.includes('URI="https://media.example/cdn/key.bin"'));
    assert.ok(rewritten?.includes('https://segments.example/part1.ts'));
    assert.ok(!rewritten?.includes('/api/proxy'));
    assert.ok(rewritten?.includes('#EXT-X-STREAM-INF:BANDWIDTH=2000000'));
  });

  it('rejects a successful HTML response instead of presenting it as a playable playlist', () => {
    assert.equal(rewriteHlsManifest('<html>Access denied</html>', 'https://media.example/master.m3u8'), null);
  });
});
