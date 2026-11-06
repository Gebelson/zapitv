import {
  StremioManifest,
  StremioCatalogResponse,
  StremioMetaResponse,
  StremioStreamResponse
} from './stremioTypes';

export type StremioErrorKind =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'HTTP_ERROR'
  | 'CORS_ERROR'
  | 'INVALID_JSON'
  | 'RATE_LIMITED'
  | 'AUTH_REQUIRED'
  | 'MEDIA_PROXY_DISABLED';

export class StremioRequestError extends Error {
  public readonly kind: StremioErrorKind;
  public readonly status?: number;
  public readonly endpoint: string;
  public readonly url: string;
  public readonly directFailed?: boolean;
  public readonly proxyFailed?: boolean;
  public readonly rawMessage: string;

  constructor(params: {
    message: string;
    kind: StremioErrorKind;
    status?: number;
    endpoint: string;
    url: string;
    directFailed?: boolean;
    proxyFailed?: boolean;
    rawMessage?: string;
  }) {
    super(params.message);
    this.name = 'StremioRequestError';
    this.kind = params.kind;
    this.status = params.status;
    this.endpoint = params.endpoint;
    this.url = params.url;
    this.directFailed = params.directFailed;
    this.proxyFailed = params.proxyFailed;
    this.rawMessage = params.rawMessage || params.message;
  }
}

export interface StremioRequestOptions {
  signal?: AbortSignal;
  totalTimeoutMs?: number;
  directTimeoutMs?: number;
  preferProxy?: boolean;
  allowDirectFallback?: boolean;
}

function resolveStremioUrl(url: string): string {
  if (url.startsWith('/')) {
    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.VITE_APP_URL || `http://127.0.0.1:${process.env.PORT || 4000}`);
    return `${origin}${url}`;
  }
  return url;
}

function normalizeOptions(options?: StremioRequestOptions | number): StremioRequestOptions {
  if (typeof options === 'number') {
    return { totalTimeoutMs: options };
  }
  return options || {};
}

/**
 * Utilitário para executar fetch HTTP com cancelamento real e classificação precisa de erro
 */
async function executeHttpRequest(
  url: string,
  timeoutMs: number,
  userSignal?: AbortSignal
): Promise<{ ok: boolean; status: number; text: string; json?: any }> {
  if (userSignal?.aborted) {
    throw new StremioRequestError({
      message: 'Requisição cancelada pelo usuário.',
      kind: 'ABORTED',
      endpoint: url,
      url
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort('TIMEOUT');
  }, timeoutMs);

  const onUserAbort = () => {
    controller.abort('USER_ABORT');
  };

  if (userSignal) {
    userSignal.addEventListener('abort', onUserAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*'
      }
    });

    const text = await response.text();
    let json: any = undefined;
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        json = JSON.parse(text);
      } catch {
        // json parse error handled below if response.ok
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      text,
      json
    };
  } catch (err: any) {
    if (userSignal?.aborted) {
      throw new StremioRequestError({
        message: 'Requisição cancelada pelo usuário.',
        kind: 'ABORTED',
        endpoint: url,
        url,
        rawMessage: err?.message
      });
    }

    if (timedOut || err?.name === 'AbortError' || err?.message === 'TIMEOUT') {
      throw new StremioRequestError({
        message: `Tempo limite de conexão esgotado (${timeoutMs}ms).`,
        kind: 'TIMEOUT',
        endpoint: url,
        url,
        rawMessage: err?.message
      });
    }

    // CORS ou falha de rede típica de navegadores
    const isNetworkOrCors =
      err instanceof TypeError ||
      /network|cors|failed to fetch/i.test(err?.message || '');

    throw new StremioRequestError({
      message: isNetworkOrCors
        ? `Falha de rede ou restrição CORS ao acessar: ${url}`
        : (err?.message || 'Erro de comunicação de rede'),
      kind: isNetworkOrCors ? 'CORS_ERROR' : 'NETWORK_ERROR',
      endpoint: url,
      url,
      rawMessage: err?.message
    });
  } finally {
    clearTimeout(timeoutId);
    if (userSignal) {
      userSignal.removeEventListener('abort', onUserAbort);
    }
  }
}

export class StremioClient {
  private static pendingEntries = new Map<string, {
    promise: Promise<any>;
    controller: AbortController;
    consumers: Set<AbortSignal | null>;
  }>();
  private baseUrl: string;

  constructor(url: string) {
    let clean = url.trim();
    if (clean.startsWith('stremio://')) {
      clean = clean.replace('stremio://', 'https://');
    }
    if (clean.endsWith('/manifest.json')) {
      clean = clean.replace('/manifest.json', '');
    }
    this.baseUrl = clean.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async fetchPublicMetadata(
    url: string,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<any> {
    if (signal?.aborted) {
      throw new StremioRequestError({
        message: 'Requisição cancelada pelo usuário.',
        kind: 'ABORTED',
        endpoint: url,
        url
      });
    }

    const key = `${url}:${timeoutMs}`;
    let entry = StremioClient.pendingEntries.get(key);
    if (entry?.controller.signal.aborted) {
      StremioClient.pendingEntries.delete(key);
      entry = undefined;
    }

    if (entry) {
      entry.consumers.add(signal || null);
      if (!signal) {
        return entry.promise;
      }
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          entry?.consumers.delete(signal);
          if (entry && (entry.consumers.size === 0 || Array.from(entry.consumers).every(s => s !== null && s.aborted))) {
            entry.controller.abort('USER_ABORT');
          }
          reject(new StremioRequestError({
            message: 'Requisição cancelada pelo usuário.',
            kind: 'ABORTED',
            endpoint: url,
            url
          }));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        entry.promise.then(
          (val) => {
            signal.removeEventListener('abort', onAbort);
            resolve(val);
          },
          (err) => {
            signal.removeEventListener('abort', onAbort);
            reject(err);
          }
        );
      });
    }

    const controller = new AbortController();
    const consumers = new Set<AbortSignal | null>([signal || null]);

    const request = (async () => {
      const result = await executeHttpRequest(url, timeoutMs, controller.signal);
      if (!result.ok) {
        let kind: StremioErrorKind = 'HTTP_ERROR';
        if (result.status === 429) kind = 'RATE_LIMITED';
        else if (result.status === 401 || result.status === 403) kind = 'AUTH_REQUIRED';
        else if (result.status === 410) kind = 'MEDIA_PROXY_DISABLED';

        throw new StremioRequestError({
          message: `HTTP ${result.status}`,
          kind,
          status: result.status,
          endpoint: url,
          url,
          rawMessage: result.text
        });
      }

      if (result.json !== undefined) {
        return result.json;
      }

      throw new StremioRequestError({
        message: 'Resposta inválida do add-on (não é JSON)',
        kind: 'INVALID_JSON',
        status: result.status,
        endpoint: url,
        url,
        rawMessage: result.text.slice(0, 200)
      });
    })();

    const managedPromise = request.finally(() => {
      if (StremioClient.pendingEntries.get(key) === entry) {
        StremioClient.pendingEntries.delete(key);
      }
    });

    entry = {
      promise: managedPromise,
      controller,
      consumers
    };
    if (StremioClient.pendingEntries.size < 64) {
      StremioClient.pendingEntries.set(key, entry);
    }

    if (!signal) {
      return managedPromise;
    }

    return new Promise((resolve, reject) => {
      const onAbort = () => {
        entry?.consumers.delete(signal);
        if (entry && (entry.consumers.size === 0 || Array.from(entry.consumers).every(s => s !== null && s.aborted))) {
          entry.controller.abort('USER_ABORT');
        }
        reject(new StremioRequestError({
          message: 'Requisição cancelada pelo usuário.',
          kind: 'ABORTED',
          endpoint: url,
          url
        }));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      managedPromise.then(
        (val) => {
          signal.removeEventListener('abort', onAbort);
          resolve(val);
        },
        (err) => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        }
      );
    });
  }

  private async fetchWithFallback(
    endpoint: string,
    rawOptions?: StremioRequestOptions | number
  ): Promise<any> {
    const options = normalizeOptions(rawOptions);
    const totalTimeoutMs = options.totalTimeoutMs && options.totalTimeoutMs > 0 ? options.totalTimeoutMs : 8000;
    const directTimeoutMs = options.directTimeoutMs && options.directTimeoutMs > 0
      ? Math.min(options.directTimeoutMs, totalTimeoutMs)
      : Math.min(totalTimeoutMs, 2600, Math.max(1200, Math.floor(totalTimeoutMs * 0.45)));
    const preferProxy = Boolean(options.preferProxy);
    const userSignal = options.signal;

    if (userSignal?.aborted) {
      throw new StremioRequestError({
        message: 'Requisição cancelada pelo usuário.',
        kind: 'ABORTED',
        endpoint,
        url: this.baseUrl
      });
    }

    const isRelative = this.baseUrl.startsWith('/');
    const rawPath = `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    const directUrl = resolveStremioUrl(rawPath);

    // 1. URLs relativas internas (/api/stremio/...): fetch direto sem proxy
    if (isRelative) {
      const result = await executeHttpRequest(directUrl, totalTimeoutMs, userSignal);
      if (!result.ok) {
        throw new StremioRequestError({
          message: `HTTP ${result.status}`,
          kind: result.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR',
          status: result.status,
          endpoint,
          url: directUrl
        });
      }
      if (result.json !== undefined) {
        return result.json;
      }
      throw new StremioRequestError({
        message: 'Resposta inválida da rota interna (não é JSON)',
        kind: 'INVALID_JSON',
        status: result.status,
        endpoint,
        url: directUrl
      });
    }

    const startTime = Date.now();
    let directError: StremioRequestError | null = null;

    // 2. Se preferProxy estiver desativado, tenta fetch direto com o orçamento alocado
    if (!preferProxy) {
      try {
        return await this.fetchPublicMetadata(directUrl, directTimeoutMs, userSignal);
      } catch (err: any) {
        if (err instanceof StremioRequestError && err.kind === 'ABORTED') {
          throw err;
        }
        directError = err instanceof StremioRequestError ? err : new StremioRequestError({
          message: err?.message || 'Falha no fetch direto',
          kind: 'NETWORK_ERROR',
          endpoint,
          url: directUrl,
          directFailed: true,
          rawMessage: err?.message
        });
      }
    }

    // 3. Fallback ou execução prioritária via proxy seguro
    const elapsed = Date.now() - startTime;
    const remainingProxyBudget = totalTimeoutMs - elapsed;
    if (remainingProxyBudget <= 0) {
      throw new StremioRequestError({message:'Orçamento total da consulta esgotado.',kind:'TIMEOUT',endpoint,url:directUrl});
    }

    if (userSignal?.aborted) {
      throw new StremioRequestError({
        message: 'Requisição cancelada pelo usuário.',
        kind: 'ABORTED',
        endpoint,
        url: directUrl
      });
    }

    const proxyUrl = resolveStremioUrl(`/api/proxy?url=${encodeURIComponent(directUrl)}`);

    try {
      const proxyResult = await executeHttpRequest(proxyUrl, remainingProxyBudget, userSignal);
      if (!proxyResult.ok) {
        let kind: StremioErrorKind = 'HTTP_ERROR';
        if (proxyResult.status === 429) kind = 'RATE_LIMITED';
        else if (proxyResult.status === 401 || proxyResult.status === 403) kind = 'AUTH_REQUIRED';
        else if (proxyResult.status === 410) kind = 'MEDIA_PROXY_DISABLED';

        // Se o proxy retornou código de erro conhecido upstream
        if (proxyResult.json?.code === 'RATE_LIMITED') kind = 'RATE_LIMITED';
        if (proxyResult.json?.code === 'AUTH_REQUIRED') kind = 'AUTH_REQUIRED';
        if (proxyResult.json?.code === 'MEDIA_PROXY_DISABLED') kind = 'MEDIA_PROXY_DISABLED';

        throw new StremioRequestError({
          message: proxyResult.json?.error || `Proxy retornou HTTP ${proxyResult.status}`,
          kind,
          status: proxyResult.json?.status || proxyResult.status,
          endpoint,
          url: proxyUrl,
          directFailed: Boolean(directError),
          proxyFailed: true,
          rawMessage: proxyResult.text
        });
      }

      if (proxyResult.json !== undefined) {
        return proxyResult.json;
      }

      throw new StremioRequestError({
        message: 'Resposta inválida do add-on via proxy (não é JSON)',
        kind: 'INVALID_JSON',
        status: proxyResult.status,
        endpoint,
        url: proxyUrl,
        directFailed: Boolean(directError),
        proxyFailed: true,
        rawMessage: proxyResult.text.slice(0, 200)
      });
    } catch (proxyErr: any) {
      if (proxyErr instanceof StremioRequestError && proxyErr.kind === 'ABORTED') {
        throw proxyErr;
      }

      // Se preferProxy estava ativo e falhou, e allowDirectFallback estiver habilitado
      if (preferProxy && options.allowDirectFallback) {
        const remainingDirect = totalTimeoutMs - (Date.now() - startTime);
        if (remainingDirect > 800 && !userSignal?.aborted) {
          try {
            return await this.fetchPublicMetadata(directUrl, remainingDirect, userSignal);
          } catch {}
        }
      }

      // Constrói erro descritivo tipado preservando a causa raiz
      const finalKind: StremioErrorKind = proxyErr instanceof StremioRequestError
        ? proxyErr.kind
        : (directError?.kind || 'NETWORK_ERROR');

      throw new StremioRequestError({
        message: proxyErr?.message || directError?.message || 'Falha ao consultar metadados do Stremio Addon.',
        kind: finalKind,
        status: proxyErr?.status || directError?.status,
        endpoint,
        url: directUrl,
        directFailed: Boolean(directError),
        proxyFailed: true,
        rawMessage: proxyErr?.rawMessage || directError?.rawMessage
      });
    }
  }

  public async getManifest(options?: StremioRequestOptions | number): Promise<StremioManifest> {
    return this.fetchWithFallback('manifest.json', options);
  }

  public async getCatalog(
    type: string,
    id: string,
    extra?: Record<string, string>,
    options?: StremioRequestOptions | number
  ): Promise<StremioCatalogResponse> {
    let path = `catalog/${type}/${id}`;
    if (extra && Object.keys(extra).length > 0) {
      const queryParts = Object.entries(extra)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      path += `/${queryParts}`;
    }
    path += '.json';
    return this.fetchWithFallback(path, options);
  }

  public async getMeta(
    type: string,
    id: string,
    options?: StremioRequestOptions | number
  ): Promise<StremioMetaResponse> {
    const path = `meta/${type}/${encodeURIComponent(id)}.json`;
    return this.fetchWithFallback(path, options);
  }

  public async getStreams(
    type: string,
    id: string,
    options?: StremioRequestOptions | number
  ): Promise<StremioStreamResponse> {
    const path = `stream/${type}/${encodeURIComponent(id)}.json`;
    return this.fetchWithFallback(path, options);
  }
}
