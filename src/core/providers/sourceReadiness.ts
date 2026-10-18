import type { StremioStream } from '../stremio/stremioTypes';

/** A source requiring the local engine is usable only after the engine was confirmed. */
export function isSourcePlayableHere(stream: StremioStream): boolean {
  if (!stream.url || stream.behaviorHints?.notWebReady === true) return false;
  let url = stream.url;
  try { url = decodeURIComponent(url); } catch {}
  const requiresLocalEngine = Boolean(stream.isTorrent) ||
    /(?:^|[/:])(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url);
  return !requiresLocalEngine || stream.behaviorHints?.notWebReady === false;
}
