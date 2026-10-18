import type { StremioStream } from '../stremio/stremioTypes';

/** A source requiring the local engine is usable only after the engine was confirmed. */
export function isSourcePlayableHere(stream: StremioStream): boolean {
  if (!stream.url) return false;
  let url = stream.url;
  try { url = decodeURIComponent(url); } catch {}
  const requiresLocalEngine = Boolean(stream.isTorrent) ||
    /(?:^|[/:])(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url);
  if (requiresLocalEngine) {
    return stream.behaviorHints?.notWebReady === false;
  }
  // Streams web (HTTP/HTTPS/Proxy) são reproduzíveis no navegador;
  // provedores upstream frequentemente incluem notWebReady: true por padrão.
  return true;
}
