import assert from 'node:assert/strict';
import { audioSelectionManager } from '../src/core/audio/audioSelectionManager';

const tracks = [
  { id: 0, lang: 'en-US', name: 'Original' },
  { id: 1, lang: 'pt-PT', name: 'Português' },
  { id: 2, lang: 'pt-BR', name: 'Track 3' },
  { id: 3, lang: 'ja-JP', name: 'Original' }
];
assert.equal(audioSelectionManager.findMatchingTrack(tracks, 'pt-BR')?.id, 2);
assert.equal(audioSelectionManager.findMatchingTrack(tracks, 'ja')?.id, 3);
assert.equal(audioSelectionManager.findMatchingTrack(tracks, 'en')?.id, 0);
assert.equal(audioSelectionManager.findMatchingTrack(tracks.slice(0, 2), 'pt-BR'), null, 'Portugal cannot silently substitute Brazil');
assert.equal(audioSelectionManager.findMatchingTrack(tracks.slice(0, 1), 'ja'), null, 'Original is not evidence of Japanese');
assert.equal(audioSelectionManager.resolveTrackLanguage({ lang: 'und', name: 'pt-BR' }), 'pt-BR');
assert.equal(audioSelectionManager.resolveTrackLanguage({ lang: 'ja', name: 'Dublado PT-BR' }), 'ja', 'explicit language wins over a contradictory label');
assert.equal(audioSelectionManager.trackLanguageAvailability([], 'pt-BR'), 'unknown');
assert.equal(audioSelectionManager.trackLanguageAvailability([{ lang: 'und', name: 'Track' }], 'pt-BR'), 'unknown');
assert.equal(audioSelectionManager.trackLanguageAvailability([tracks[3]], 'pt-BR'), 'unavailable');
const options = audioSelectionManager.buildAudioOptions({
  item: { id: 'fixture', title: 'Fixture', type: 'ANIME', originalLanguage: 'ja' },
  streams: [{ url: 'https://media.example/a.m3u8', isPtBr: true, isDubbed: true },
    { url: 'https://media.example/pt.mp4', isPtBr: true, isDubbed: true }],
  hlsTracks: [{ id: 0, lang: 'ja', name: 'Original' }], currentStreamIndex: 0, activeAudioId: null
});
assert.equal(options.find(option => option.langCode === 'ja')?.isCurrent, true);
assert.equal(options.find(option => option.langCode === 'pt-BR')?.isCurrent, false, 'addon claims cannot override a known Japanese-only manifest');
assert.ok(options.some(option => option.langCode === 'pt-BR'), 'a separate Brazilian source remains selectable');
console.log('P1 audio: actual declared language, regional codes and unavailable requested tracks passed');
