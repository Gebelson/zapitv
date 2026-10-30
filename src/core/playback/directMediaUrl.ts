/** Resolve old ZapiTV relay links without routing media through an API function. */
export function directMediaUrl(raw: string, pageProtocol?: string): string | null {
  if (!raw || raw.length > 16384) return null;
  let value = raw;
  for (let depth = 0; depth < 4; depth++) {
    let parsed: URL;
    try { parsed = new URL(value, 'https://zapitv.invalid'); } catch { return null; }
    const ownOrigin = typeof window !== 'undefined' ? window.location.origin : null;
    const localRelay = value.startsWith('/api/proxy?') ||
      (ownOrigin && parsed.origin === ownOrigin && parsed.pathname === '/api/proxy');
    if (localRelay) {
      // A required server-side Referer cannot be moved to browser credentials.
      if (parsed.searchParams.has('referer')) return null;
      value = parsed.searchParams.get('url') || '';
      if (!value) return null;
      continue;
    }
    if (parsed.username || parsed.password) return null;
    if (value.startsWith('/') && !value.startsWith('//')) {
      return parsed.pathname.startsWith('/api/') ? null : value;
    }
    if (!['http:', 'https:', 'blob:'].includes(parsed.protocol)) return null;
    if (parsed.pathname === '/api/proxy') return null;
    const protocol = pageProtocol ?? (typeof window !== 'undefined' ? window.location.protocol : undefined);
    if (protocol === 'https:' && parsed.protocol === 'http:') return null;
    return value;
  }
  return null;
}
