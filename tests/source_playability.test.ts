import assert from 'node:assert/strict';
import { ContentType, type ContentItem } from '../types';
import type { StremioStream } from '../src/core/stremio/stremioTypes';
import { isSourcePlayableHere } from '../src/core/providers/sourceReadiness';
import { prioritizeRememberedSources, sourceReference } from '../src/core/providers/sourceMemory';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { sourceVerificationService } from '../src/core/providers/sourceVerificationService';
import { providerRegistry } from '../src/core/providers/providerRegistry';

const torrent: StremioStream = {
  name: 'Fonte local', title: 'Obra S01E01 Dublado PT-BR',
  url: 'http://127.0.0.1:11470/hash/0', isTorrent: true, isDubbed: true, isPtBr: true,
  behaviorHints: { notWebReady: true }, providerId: 'torrentio-global',
};
const web: StremioStream = {
  name: 'Fonte web', title: 'Obra S01E01 Original',
  url: 'https://cdn.example.test/obra.m3u8', sourceType: 'hls', providerId: 'web',
};

assert.equal(isSourcePlayableHere(torrent), false);
assert.equal(isSourcePlayableHere(web), true);
assert.equal(isSourcePlayableHere({ ...torrent, behaviorHints: { notWebReady: false } }), true);
assert.equal(sourceSelectionService.rankStreams([torrent, web], { hasExternalPtSub: false })[0].url, web.url);
assert.equal(prioritizeRememberedSources(
  [{ ...torrent, _smartPriority: 1 } as StremioStream, { ...web, _smartPriority: 3 } as StremioStream],
  [{ providerId: torrent.providerId!, sourceRef: sourceReference(torrent), score: 100, trusted: true, audioLanguage: 'pt-BR', quality: null }],
)[0].url, web.url);

const item: ContentItem = {
  id: 'series-obra', title: 'Obra', type: ContentType.SERIES, mediaFormat: 'series',
  imdbId: 'tt1234567', year: 2026, rating: 7, image: '',
};
const originalResolve = providerRegistry.resolveStreams;
try {
  let calls = 0;
  (providerRegistry as any).resolveStreams = async () => (++calls === 1 ? [torrent] : [torrent, web]);
  const recovered = await sourceVerificationService.verifySources(item, { season: 1, episode: 1 });
  assert.equal(calls, 2, 'fontes apenas locais devem acionar a segunda verificação');
  assert.equal(recovered.state, 'AVAILABLE');
  assert.deepEqual(recovered.streams.map(s => s.url), [web.url]);

  (providerRegistry as any).resolveStreams = async () => [torrent];
  const unavailableHere = await sourceVerificationService.verifySources(item, { season: 1, episode: 1 });
  assert.equal(unavailableHere.state, 'INCONCLUSIVE');
  assert.equal(unavailableHere.streams.length, 0);
} finally {
  (providerRegistry as any).resolveStreams = originalResolve;
}

console.log('Fontes web priorizadas e torrents sem motor local não anunciados como disponíveis: OK');
process.exit(0);
