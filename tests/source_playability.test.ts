import assert from 'node:assert/strict';
import { ContentType, type ContentItem } from '../types';
import type { StremioStream } from '../src/core/stremio/stremioTypes';
import { isSourcePlayableHere } from '../src/core/providers/sourceReadiness';
import { prioritizeRememberedSources, sourceReference } from '../src/core/providers/sourceMemory';
import { sourceSelectionService } from '../src/core/selection/sourceSelectionService';
import { sourceVerificationService } from '../src/core/providers/sourceVerificationService';
import { providerRegistry, stremioEpisodeId } from '../src/core/providers/providerRegistry';
import { streamValidator } from '../src/core/providers/streamValidator';

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

const episodeOne = { season: 1, episode: 1 };
assert.equal(stremioEpisodeId('tt32499579', episodeOne), 'tt32499579:1:1');
assert.equal(stremioEpisodeId('tmdb:255752', episodeOne), 'tmdb:255752:1:1');
assert.equal(stremioEpisodeId('tmdb:9980', episodeOne), 'tmdb:9980:1:1');
assert.equal(stremioEpisodeId('tt0281474:1:1', episodeOne), 'tt0281474:1:1');
assert.equal(stremioEpisodeId('anilist:108465', episodeOne), 'anilist:108465:1:1');
const wrongWoody: StremioStream = {
  name: 'Magnetflix HD', description: 'O Novo Pica-Pau • S01E01 • Servidor: Magnetflix #20',
  url: 'https://media.example.test/185995.mp4', sourceType: 'mp4',
};
assert.equal(streamValidator.isStreamMatchingTargetTitle(wrongWoody, 'O Novo Pica-Pau', 'The New Woody Woodpecker Show', [], episodeOne), false);
const proxiedWrongWoody = { ...wrongWoody,
  url: `/api/proxy?url=${encodeURIComponent(wrongWoody.url!)}`
};
assert.equal(streamValidator.isStreamMatchingTargetTitle(proxiedWrongWoody,
  'O Novo Pica-Pau', 'The New Woody Woodpecker Show', [], episodeOne), false);
assert.equal(streamValidator.filterCleanStreams([proxiedWrongWoody],
  'O Novo Pica-Pau', 'The New Woody Woodpecker Show', [], episodeOne).length, 0);
assert.equal(streamValidator.isStreamMatchingTargetTitle({ ...wrongWoody, url: 'https://media.example.test/other.mp4' }, 'O Novo Pica-Pau', undefined, [], episodeOne), true);
assert.equal(streamValidator.isStreamMatchingTargetTitle({ ...wrongWoody, description: 'O Novo Pica-Pau • S01E02 • Servidor: Magnetflix #20' }, 'O Novo Pica-Pau', undefined, [], { season: 1, episode: 2 }), true);
assert.equal(streamValidator.isStreamMatchingTargetTitle(wrongWoody, 'Hotel Assombrado', undefined, [], episodeOne), true);
const declared = (title: string): StremioStream => ({
  name: 'Fonte HLS', title: `🐦‍🔥 ${title}\n⏸️ T01 EP01`,
  url: 'https://media.example.test/episode.m3u8', sourceType: 'hls',
});
assert.equal(streamValidator.isStreamMatchingTargetTitle(declared('A Casa do Dragão'), 'House of the Dragon', 'House of the Dragon', [], episodeOne), true);
assert.equal(streamValidator.isStreamMatchingTargetTitle(declared('Game of Thrones'), 'House of the Dragon', 'House of the Dragon', [], episodeOne), false);
assert.equal(streamValidator.isStreamMatchingTargetTitle(declared('Mushoku Tensei: Jobless Reincarnation: Mushoku Tensei III: Isekai Ittara Honki Dasu'), 'Mushoku Tensei: Jobless Reincarnation', undefined, [], episodeOne), false);
assert.equal(streamValidator.isStreamMatchingTargetTitle(declared('Mushoku Tensei: Jobless Reincarnation'), 'Mushoku Tensei: Jobless Reincarnation', undefined, [], episodeOne), true);
assert.equal(streamValidator.isStreamMatchingTargetTitle({ ...declared('Mushoku Tensei: Jobless Reincarnation'), title: '🐦‍🔥 Mushoku Tensei: Jobless Reincarnation\n🐉 Malfoy' }, 'Mushoku Tensei: Jobless Reincarnation', undefined, [], episodeOne), false);

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
