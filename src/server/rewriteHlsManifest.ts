const HLS_URI_ATTRIBUTE = /\bURI=(['"])(.*?)\1/g;

export function rewriteHlsManifest(manifest: string, sourceUrl: string): string | null {
  if (!manifest.trimStart().startsWith('#EXTM3U')) return null;

  const directUri = (uri: string): string => {
    try {
      const absolute = new URL(uri, sourceUrl);
      if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return uri;
      return absolute.href;
    } catch {
      return uri;
    }
  };

  return manifest.split(/\r?\n/).map((line) => {
    if (line.startsWith('#')) {
      return line.replace(HLS_URI_ATTRIBUTE, (_match, quote: string, uri: string) =>
        `URI=${quote}${directUri(uri)}${quote}`
      );
    }
    return line.trim() ? directUri(line.trim()) : line;
  }).join('\n');
}
