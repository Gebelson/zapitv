import assert from 'node:assert/strict';
import { createPlaybackConfirmationState, observePlayback } from '../src/core/tracking/playbackConfirmation';
import { mediaLoadingTracker } from '../src/core/tracking/mediaLoadingTracker';
import { sourceReference } from '../src/core/providers/sourceMemory';

const id = mediaLoadingTracker.startTrace('series:test', 'Teste', 'series', 1, 2);
mediaLoadingTracker.transition(id, 'READY');
mediaLoadingTracker.transition(id, 'PLAYING');
assert.equal(mediaLoadingTracker.getTrace(id)?.finalStatus, undefined, 'eventos de preparação não comprovam vídeo');

let state = createPlaybackConfirmationState();
state = observePlayback(state, { wallTimeMs: 0, mediaTimeSeconds: 0, presentedFrames: 1, eligible: true });
state = observePlayback(state, { wallTimeMs: 16_000, mediaTimeSeconds: 16, presentedFrames: 1, eligible: true });
assert.equal(state.confirmed, false, 'tempo avançado sem quadros não comprova reprodução');
state = observePlayback(state, { wallTimeMs: 16_000, mediaTimeSeconds: 16, presentedFrames: 5, eligible: true });
assert.equal(state.confirmed, true);
mediaLoadingTracker.recordEvent(id, 'PLAYBACK_CONFIRMED', 'ZapiPlayer');
assert.equal(mediaLoadingTracker.getTrace(id)?.finalStatus, 'SUCCESS');
mediaLoadingTracker.endTrace(id, 'CANCELLED');
assert.equal(mediaLoadingTracker.getTrace(id)?.finalStatus, 'SUCCESS', 'fechar o player não apaga sucesso confirmado');

const second = mediaLoadingTracker.startTrace('series:test', 'Teste', 'series', 1, 3);
assert.notEqual(second, id, 'outro episódio deve ter correlação distinta');
mediaLoadingTracker.recordEvent(second, 'PLAYBACK_FAILED', 'ZapiPlayer', 'FAILED',
  undefined, 'MEDIA_NETWORK_ERROR', 'https://example.test/video.m3u8?token=secret');
const diagnostic = mediaLoadingTracker.getDiagnostic(second);
assert.equal(diagnostic.errorCode, 'MEDIA_NETWORK_ERROR');
assert.match(diagnostic.reason || '', /redacted-url/);
assert.doesNotMatch(JSON.stringify(mediaLoadingTracker.getTrace(second)), /token=secret/);
const source = { name: 'Fonte X', title: 'Episódio 1', sourceType: 'hls', quality: '1080p',
  url: 'https://video.test/playlist.m3u8?token=secret' } as any;
assert.equal(sourceReference(source), sourceReference({ ...source,
  url: 'https://video.test/new.m3u8?token=another' }), 'referência não depende de URL temporária');
assert.doesNotMatch(sourceReference(source), /video\.test|token=/);

state = observePlayback(state, { wallTimeMs: 17_000, mediaTimeSeconds: 17, presentedFrames: 6, eligible: false });
assert.equal(state.confirmed, true, 'resultado confirmado é imutável');
let paused = createPlaybackConfirmationState();
paused = observePlayback(paused, { wallTimeMs: 0, mediaTimeSeconds: 0, presentedFrames: 0, eligible: true });
paused = observePlayback(paused, { wallTimeMs: 5000, mediaTimeSeconds: 5, presentedFrames: 5, eligible: false });
assert.equal(paused.startedAtMs, null, 'pausa ou seek reinicia janela contínua');
console.log('playback_trace: ok');
