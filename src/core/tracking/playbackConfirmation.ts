/** Browser observations only. This does not assert title identity or audible sound. */
export interface PlaybackObservation {
  wallTimeMs: number;
  mediaTimeSeconds: number;
  presentedFrames: number | null;
  eligible: boolean;
}

export interface PlaybackConfirmationState {
  startedAtMs: number | null;
  startedAtSeconds: number | null;
  framesAtStart: number | null;
  confirmed: boolean;
}

export function createPlaybackConfirmationState(): PlaybackConfirmationState {
  return { startedAtMs: null, startedAtSeconds: null, framesAtStart: null, confirmed: false };
}

export function observePlayback(
  state: PlaybackConfirmationState, observation: PlaybackObservation
): PlaybackConfirmationState {
  if (state.confirmed) return state;
  if (!observation.eligible || !Number.isFinite(observation.mediaTimeSeconds)) {
    return createPlaybackConfirmationState();
  }
  if (state.startedAtMs === null || state.startedAtSeconds === null || state.framesAtStart === null) {
    return { startedAtMs: observation.wallTimeMs, startedAtSeconds: observation.mediaTimeSeconds,
      framesAtStart: observation.presentedFrames, confirmed: false };
  }
  // Missing frame evidence stays inconclusive, even if currentTime advances.
  return { ...state, confirmed: observation.presentedFrames !== null &&
    observation.presentedFrames > state.framesAtStart &&
    observation.wallTimeMs - state.startedAtMs >= 15_000 &&
    observation.mediaTimeSeconds - state.startedAtSeconds >= 15 };
}
