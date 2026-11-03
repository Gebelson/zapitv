import type { Request, Response } from 'express';
import { publicHttpGet } from './security/publicHttp';
import { authorizedAddonsRegistry } from './providers/authorizedAddonsRegistry';

export const MAX_METADATA_BYTES = 512 * 1024;

/**
 * Validação segura de URL de metadados Stremio.
 * Rejeita qualquer tentativa de proxy de arquivos de vídeo/áudio ou origens não autorizadas.
 */
export function isAddonMetadataUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return false;
    }

    // Apenas origens autorizadas no registro centralizado
    const authorizedOrigins = authorizedAddonsRegistry.getAuthorizedOrigins();
    if (!authorizedOrigins.has(url.origin)) {
      return false;
    }

    const path = url.pathname.toLowerCase();

    // Bloqueia qualquer extensão de mídia direta
    if (/\.(mp4|m3u8|mkv|avi|webm|ts|mpd|mp3|aac|flac|ogg)$/i.test(path)) {
      return false;
    }

    // Deve ser um endpoint canônico do protocolo Stremio JSON:
    // 1. manifest.json (inclusive sob sub-rotas como /qualities=.../manifest.json ou /brazuca/manifest.json)
    // 2. catalog/type/id...json
    // 3. meta/type/id.json
    // 4. stream/type/id.json
    // 5. subtitles/type/id.json
    const isManifest = /(?:^|\/)manifest\.json$/i.test(path);
    const isStremioResource = /\/(?:catalog|meta|stream|subtitles)\/[^/]+(?:\/[^/]+)+\.json$/i.test(path);

    return isManifest || isStremioResource;
  } catch {
    return false;
  }
}

export function createMetadataProxy(get = publicHttpGet) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!isAddonMetadataUrl(url) || req.headers.range) {
      return res.status(410).json({
        code: 'MEDIA_PROXY_DISABLED',
        error: 'O proxy de mídia foi desativado. Esta fonte precisa permitir reprodução direta.'
      });
    }

    const controller = new AbortController();
    const timeoutMs = 8000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', close);

    let upstream: Awaited<ReturnType<typeof publicHttpGet>> | undefined;
    try {
      upstream = await get(url, {
        headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
        signal: controller.signal,
        timeoutMs
      });

      // Redirects are SSRF-checked by publicHttpGet and must stay within the
      // same approved metadata policy. Never forward upstream media headers.
      if (!isAddonMetadataUrl(upstream.url) || !/\bapplication\/(?:[\w.+-]+\+)?json\b/i.test(upstream.headers.get('content-type') || '')) {
        return res.status(415).json({ code: 'METADATA_ONLY', error: 'Somente metadados JSON são permitidos.' });
      }

      if (Number(upstream.headers.get('content-length') || 0) > MAX_METADATA_BYTES) {
        return res.status(413).json({ error: 'Metadados excedem o limite.' });
      }

      if (!upstream.ok) {
        const status = upstream.status === 429 ? 429 : upstream.status === 404 ? 404 : upstream.status === 401 ? 401 : upstream.status === 403 ? 403 : 502;
        return res.status(status).json({
          code: upstream.status === 429 ? 'RATE_LIMITED' : upstream.status === 401 || upstream.status === 403 ? 'AUTH_REQUIRED' : 'UPSTREAM_ERROR',
          status: upstream.status,
          error: 'Metadados temporariamente indisponíveis.'
        });
      }

      const text = await upstream.text(MAX_METADATA_BYTES);
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') {
        return res.status(502).json({ error: 'Metadados inválidos.' });
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json(data);
    } catch {
      if (!res.headersSent && !res.destroyed) {
        return res.status(502).json({ error: 'Falha ao consultar metadados.' });
      }
    } finally {
      clearTimeout(timer);
      res.off('close', close);
      upstream?.body?.destroy?.();
    }
  };
}
