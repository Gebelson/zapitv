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

type ProxyReason = 'SUCCESS' | 'REQUEST_NOT_ALLOWED' | 'REDIRECT_ENDPOINT_BLOCKED' | 'CONTENT_TYPE_BLOCKED' | 'UPSTREAM_HTTP' | 'DNS_FAILURE' | 'TIMEOUT' | 'CONNECTION_REFUSED' | 'INVALID_JSON' | 'DESTINATION_BLOCKED' | 'NETWORK_FAILURE' | 'CANCELLED' | 'RESPONSE_TOO_LARGE';
interface ProxyDiagnostic {
  providerId: string; resource: string; upstreamStatus: number | null;
  contentTypeClass: 'JSON' | 'HTML' | 'MEDIA' | 'OTHER' | 'MISSING';
  redirected: boolean; reason: ProxyReason; durationMs: number; attempts: number; status: number | null;
}
const diagnostics: ProxyDiagnostic[] = [];
let droppedDiagnostics = 0;
export function getMetadataProxyDiagnostics() {
  return {events:diagnostics.map(event=>({...event})),dropped:droppedDiagnostics,scope:'current-server-instance',maxEvents:200};
}
export function metadataProxyDiagnosticsHandler(req: Request, res: Response) {
  res.setHeader('Cache-Control','no-store');
  if(req.user?.role !== 'admin') return res.status(403).json({code:'FORBIDDEN'});
  return res.json(getMetadataProxyDiagnostics());
}
function diagnosticTarget(raw: string) {
  try {
    const url=new URL(raw);
    const addon=authorizedAddonsRegistry.getAllAddons().filter(a=>{
      try { const base=new URL(a.baseUrl);return base.origin===url.origin && (url.pathname===base.pathname || url.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/')); }catch{return false;}
    }).sort((a,b)=>b.baseUrl.length-a.baseUrl.length)[0];
    const resource=/\/(catalog|meta|stream|subtitles)\//.exec(url.pathname)?.[1] || (/\/manifest\.json$/.test(url.pathname)?'manifest':'unknown');
    return {providerId:addon?.id && /^[a-z0-9_-]{1,80}$/i.test(addon.id)?addon.id:'unknown',resource};
  } catch {return {providerId:'unknown',resource:'unknown'};}
}
function appendDiagnostic(event:ProxyDiagnostic) {
  if(diagnostics.length>=200){diagnostics.shift();droppedDiagnostics++;}
  diagnostics.push({...event});
}
function classifyProxyError(error:any,timedOut=false,cancelled=false):ProxyReason {
  const code=error?.code || error?.cause?.code;
  return timedOut || ['ETIMEDOUT','ESOCKETTIMEDOUT'].includes(code)?'TIMEOUT':cancelled?'CANCELLED':
    ['ENOTFOUND','EAI_AGAIN'].includes(code)?'DNS_FAILURE':code==='ECONNREFUSED'?'CONNECTION_REFUSED':
    error instanceof SyntaxError?'INVALID_JSON':/Destino não permitido|URL inválida/.test(error?.message||'')?'DESTINATION_BLOCKED':
    /limite|size limit/.test(error?.message||'')?'RESPONSE_TOO_LARGE':'NETWORK_FAILURE';
}
export function recordMetadataProxyPreflightFailure(raw:string,error:unknown,durationMs:number) {
  appendDiagnostic({...diagnosticTarget(raw),upstreamStatus:null,contentTypeClass:'MISSING',redirected:false,
    reason:classifyProxyError(error),durationMs,attempts:1,status:502});
}
export function createMetadataProxy(get = publicHttpGet) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    const started=Date.now();
    const event:ProxyDiagnostic={...diagnosticTarget(url),upstreamStatus:null,contentTypeClass:'MISSING',redirected:false,reason:'REQUEST_NOT_ALLOWED',durationMs:0,attempts:0,status:410};
    const record=()=>{
      event.durationMs=Date.now()-started;event.status=res.destroyed?null:res.statusCode;
      appendDiagnostic(event);
    };
    if (!isAddonMetadataUrl(url) || req.headers.range) {
      res.status(410).json({code:'MEDIA_PROXY_DISABLED',error:'O proxy de mídia foi desativado. Esta fonte precisa permitir reprodução direta.'});
      record();return;
    }
    const controller = new AbortController();
    const timeoutMs = 8000;
    let timedOut=false;
    const timer = setTimeout(() => {timedOut=true;controller.abort();}, timeoutMs);
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', close);
    let upstream: Awaited<ReturnType<typeof publicHttpGet>> | undefined;
    try {
      upstream = await get(url, {
        headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
        signal: controller.signal, timeoutMs,
        onAttempt:()=>{event.attempts++;}
      });
      event.attempts=Math.max(1,event.attempts);
      event.upstreamStatus=upstream.status;
      event.redirected=upstream.url!==new URL(url).href;
      const contentType=upstream.headers.get('content-type') || '';
      const jsonType=/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(contentType.trim());
      event.contentTypeClass=jsonType?'JSON':/^text\/html\b/i.test(contentType)?'HTML':/^(video|audio)\//i.test(contentType)?'MEDIA':contentType?'OTHER':'MISSING';
      if (!isAddonMetadataUrl(upstream.url)) {
        event.reason='REDIRECT_ENDPOINT_BLOCKED';
        return res.status(415).json({code:'METADATA_ONLY',error:'Somente metadados JSON são permitidos.'});
      }
      // Preserve upstream failures even when its error document is HTML. No error body is relayed.
      if (!upstream.ok) {
        event.reason='UPSTREAM_HTTP';
        const status = [429,404,401,403].includes(upstream.status)?upstream.status:502;
        return res.status(status).json({code:upstream.status===429?'RATE_LIMITED':[401,403].includes(upstream.status)?'AUTH_REQUIRED':'UPSTREAM_ERROR',status:upstream.status,error:'Metadados temporariamente indisponíveis.'});
      }
      if(!jsonType){
        event.reason='CONTENT_TYPE_BLOCKED';
        return res.status(415).json({code:'METADATA_ONLY',error:'Somente metadados JSON são permitidos.'});
      }
      if (Number(upstream.headers.get('content-length') || 0) > MAX_METADATA_BYTES) {
        event.reason='RESPONSE_TOO_LARGE';return res.status(413).json({error:'Metadados excedem o limite.'});
      }
      const data = JSON.parse(await upstream.text(MAX_METADATA_BYTES));
      if (!data || typeof data !== 'object') {
        event.reason='INVALID_JSON';return res.status(502).json({error:'Metadados inválidos.'});
      }
      event.reason='SUCCESS';
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json(data);
    } catch(error:any) {
      event.attempts=Math.max(1,event.attempts);
      event.reason=classifyProxyError(error,timedOut,controller.signal.aborted);
      if (!res.headersSent && !res.destroyed) return res.status(502).json({error:'Falha ao consultar metadados.'});
    } finally {
      clearTimeout(timer);res.off('close', close);upstream?.body?.destroy?.();record();
    }
  };
}
