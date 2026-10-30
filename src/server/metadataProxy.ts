import type { Request, Response } from 'express';
import { publicHttpGet } from './security/publicHttp';

// Deliberately server-owned. Browser-added providers cannot turn this into an
// arbitrary public fetch service. These are the existing factory addon origins.
const ORIGINS = new Set([
  'https://froststream.cloutteam.com', 'https://fenixflix.fenixhub.online',
  'https://torrentio.strem.fun', 'https://magnetflix.flixbr.online',
  'https://v3-cinemeta.strem.io', 'https://opensubtitles-v3.strem.io',
  'https://public-domain-movies.strem.fun',
]);
export const MAX_METADATA_BYTES = 512 * 1024;
export function isAddonMetadataUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return !url.username && !url.password && ORIGINS.has(url.origin) &&
      /\/(?:manifest\.json|(?:catalog|meta|stream|subtitles)\/[^/]+\/[^/]+(?:\/[^/]*)?\.json)$/.test(url.pathname);
  } catch { return false; }
}

export function createMetadataProxy(get = publicHttpGet) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!isAddonMetadataUrl(url) || req.headers.range) {
      return res.status(410).json({ code: 'MEDIA_PROXY_DISABLED', error: 'O proxy de mídia foi desativado. Esta fonte precisa permitir reprodução direta.' });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', close);
    let upstream: Awaited<ReturnType<typeof publicHttpGet>> | undefined;
    try {
      upstream = await get(url, { headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' }, signal: controller.signal, timeoutMs: 8000 });
      // Redirects are SSRF-checked by publicHttpGet and must stay within the
      // same approved metadata policy. Never forward upstream media headers.
      if (!isAddonMetadataUrl(upstream.url) || !/\bapplication\/(?:[\w.+-]+\+)?json\b/i.test(upstream.headers.get('content-type') || '')) {
        return res.status(415).json({ code: 'METADATA_ONLY', error: 'Somente metadados JSON são permitidos.' });
      }
      if (Number(upstream.headers.get('content-length') || 0) > MAX_METADATA_BYTES) return res.status(413).json({ error: 'Metadados excedem o limite.' });
      if (!upstream.ok) return res.status(502).json({ error: 'Metadados temporariamente indisponíveis.' });
      const text = await upstream.text(MAX_METADATA_BYTES);
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') return res.status(502).json({ error: 'Metadados inválidos.' });
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json(data);
    } catch {
      if (!res.headersSent && !res.destroyed) return res.status(502).json({ error: 'Falha ao consultar metadados.' });
    } finally {
      clearTimeout(timer); res.off('close', close); upstream?.body.destroy();
    }
  };
}
