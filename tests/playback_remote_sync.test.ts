import assert from 'node:assert/strict';
import { playbackSessionService } from '../src/core/session/playbackSessionService';

const manual = playbackSessionService.startSession('series-1', 'manual_start', 1, 1);
assert.equal(playbackSessionService.shouldPlayIntro(manual.sessionId), true);

playbackSessionService.markIntroPlayed(manual.sessionId);
const nextEpisode = playbackSessionService.startSession('series-1', 'remote_sync', 1, 2);
assert.equal(nextEpisode.sessionId, manual.sessionId);
assert.equal(nextEpisode.episode, 2);
assert.equal(nextEpisode.introPlayed, true);
assert.equal(playbackSessionService.shouldPlayIntro(nextEpisode.sessionId), false);

playbackSessionService.endSession(nextEpisode.sessionId);
const joinedMidPlayback = playbackSessionService.startSession('series-1', 'remote_sync', 1, 3);
assert.equal(joinedMidPlayback.introPlayed, true);
assert.equal(playbackSessionService.shouldPlayIntro(joinedMidPlayback.sessionId), false);
playbackSessionService.endSession(joinedMidPlayback.sessionId);

console.log('Troca remota de episódio sem reiniciar intro: OK');
