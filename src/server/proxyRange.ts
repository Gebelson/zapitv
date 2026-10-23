const MAX_PROXY_RANGE_BYTES = 4 * 1024 * 1024;

// Keep progressive video requests shorter than a serverless invocation while
// preserving standard 206/Content-Range semantics and browser seeking.
export function normalizeProxyRange(raw: string): string | null {
  if (!/^bytes=\d*-\d*(?:,\d*-\d*){0,4}$/.test(raw)) return null;
  const suffix = /^bytes=-(\d+)$/.exec(raw);
  if (suffix) {
    const bytes = Number(suffix[1]);
    return Number.isSafeInteger(bytes) && bytes > 0
      ? `bytes=-${Math.min(bytes, MAX_PROXY_RANGE_BYTES)}` : null;
  }
  if (raw.includes(',')) {
    let total = 0;
    for (const part of raw.slice(6).split(',')) {
      const match = /^(\d+)-(\d+)$/.exec(part);
      if (!match) return null;
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) return null;
      total += end - start + 1;
      if (total > MAX_PROXY_RANGE_BYTES) return null;
    }
    return raw;
  }
  const single = /^bytes=(\d+)-(\d*)$/.exec(raw);
  if (!single) return null;
  const start = Number(single[1]);
  const end = single[2] ? Number(single[2]) : Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) return null;
  return `bytes=${start}-${Math.min(end, start + MAX_PROXY_RANGE_BYTES - 1)}`;
}
