import assert from 'node:assert/strict';
import { OfflineSourceInspector } from '../src/core/offline/offlineSourceInspector';
import type { StremioStream } from '../src/core/stremio/stremioTypes';

const inspector = new OfflineSourceInspector();
const originalFetch = globalThis.fetch;
const requested: string[] = [];

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  requested.push(url);
  if (url.includes('unavailable')) return new Response('', { status: 503 });
  return new Response(new Uint8Array([0]), {
    status: 206,
    headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-0/30823' }
  });
}) as typeof fetch;

try {
  const base: StremioStream = {
    url: 'https://media.example/episode-1.mp4', sourceType: 'mp4', quality: '720p'
  };
  const denied = await inspector.inspectDownloadOptionsDetailed([base]);
  assert.equal(denied.options.length, 0, 'streaming online não concede download');
  assert.equal(requested.length, 0, 'fonte sem permissão não deve ser acessada');
  assert.match(denied.reason || '', /assistir online.*permissão/, 'explica a diferença entre assistir e salvar');

  const proxy = await inspector.inspectDownloadOptionsDetailed([{
    ...base, url: '/api/proxy?url=https%3A%2F%2Fmedia.example%2Fepisode-1.mp4', offlineAllowed: true
  }]);
  assert.equal(proxy.options.length, 0, 'proxy não comprova acesso direto para download');

  const available = await inspector.inspectDownloadOptionsDetailed([
    { ...base, url: 'https://media.example/unavailable-episode-1.mp4', offlineAllowed: true },
    { ...base, offlineAllowed: true }
  ]);
  assert.equal(available.options.length, 1);
  assert.equal(available.options[0].sourceUrl, base.url, 'usa a alternativa da mesma qualidade');
  assert.equal(available.options[0].estimatedBytes, 30823, 'mostra o tamanho recebido da origem');

  const unknownQuality = await inspector.inspectDownloadOptionsDetailed([{
    url: 'https://media.example/episode-2.mp4', sourceType: 'mp4', offlineAllowed: true
  }]);
  assert.equal(unknownQuality.options[0]?.quality, 'Original', 'não inventa resolução');

  const hls = await inspector.inspectDownloadOptionsDetailed([{
    url: 'https://media.example/episode-1.m3u8', sourceType: 'hls', quality: '720p', offlineAllowed: true
  }]);
  assert.equal(hls.options.length, 0, 'HLS sem armazenamento de segmentos não é anunciado como MP4');
  console.log('offline_source_selection: 5 cenários passaram');
} finally {
  globalThis.fetch = originalFetch;
}
// providerRegistry inicia tarefas de fundo; o processo de teste já terminou.
process.exit(0);
