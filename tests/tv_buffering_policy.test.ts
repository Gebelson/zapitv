import assert from 'node:assert/strict';
import { decideTvStallAction, playbackOptimizerService } from '../src/core/playback/PlaybackOptimizerService';

const base = { bufferAheadSeconds: 0, recoveryAttempted: false, online: true };
assert.equal(decideTvStallAction({ ...base, elapsedMs: 11_500, sinceProgressMs: 11_500 }), 'wait');
assert.equal(decideTvStallAction({ ...base, elapsedMs: 20_000, sinceProgressMs: 1_000 }), 'wait');
assert.equal(decideTvStallAction({ ...base, elapsedMs: 12_000, sinceProgressMs: 8_000 }), 'recover');
assert.equal(decideTvStallAction({ ...base, elapsedMs: 13_000, sinceProgressMs: 1_000, bufferAheadSeconds: 4 }), 'recover');
assert.equal(decideTvStallAction({ ...base, elapsedMs: 30_000, sinceProgressMs: 15_000, recoveryAttempted: true }), 'fallback');
assert.equal(decideTvStallAction({ ...base, elapsedMs: 46_000, sinceProgressMs: 1_000, recoveryAttempted: true }), 'fallback');
assert.equal(decideTvStallAction({ ...base, elapsedMs: 50_000, sinceProgressMs: 50_000, online: false }), 'wait');

Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  onLine: true, userAgent: 'Mozilla/5.0 (SMART-TV; Tizen)', hardwareConcurrency: 2,
  connection: { effectiveType: '4g', downlink: 20, rtt: 50 }
} });
const config = playbackOptimizerService.buildOptimalHlsConfig();
assert.equal(config.maxBufferLength, 24);
assert.equal(config.maxBufferSize, 24 * 1024 * 1024);
playbackOptimizerService.tuneTvHlsBuffer(config, 12_000_000);
assert.ok((config.maxBufferLength || 0) >= 8);
assert.ok((config.maxBufferSize || 0) <= 30 * 1024 * 1024);
assert.ok((config.maxMaxBufferLength || 0) >= (config.maxBufferLength || 0));
console.log('TV: espera por progresso, recuperação limitada, fallback e buffer por bitrate OK');
