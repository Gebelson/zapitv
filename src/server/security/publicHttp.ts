import { lookup } from 'node:dns/promises';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

export function isPublicIp(raw: string): boolean {
  const ip = raw.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(ip) === 6) {
    if (ip.startsWith('::ffff:')) return false;
    return /^(2|3)[0-9a-f]{3}:/.test(ip) &&
      !ip.startsWith('2001:db8:') && !ip.startsWith('2001:0:') && !ip.startsWith('2002:');
  }
  return false;
}

async function resolvePublicTarget(raw: string): Promise<{ url: URL; address: string; family: number }> {
  if (raw.length > 4096) throw new Error('URL inválida');
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal') || host === 'metadata.google.internal') throw new Error('Destino não permitido');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => !isPublicIp(entry.address))) throw new Error('Destino não permitido');
  return { url, ...addresses[0] };
}

export async function publicHttpGet(raw: string, options: { headers?: Record<string, string>; signal?: AbortSignal; timeoutMs?: number } = {}) {
  let current = raw;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const { url, address, family } = await resolvePublicTarget(current);
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = (url.protocol === 'https:' ? https : http).request(url, {
        method: 'GET',
        headers: options.headers,
        lookup: (_host, _opts, callback) => callback(null, address, family),
        signal: options.signal,
        timeout: options.timeoutMs ?? 12000
      }, resolve);
      request.on('timeout', () => request.destroy(new Error('Tempo limite de origem')));
      request.on('error', reject);
      request.end();
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
      response.destroy();
      if (redirects === 3) throw new Error('Redirecionamentos em excesso');
      current = new URL(response.headers.location, url).href;
      continue;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(response.headers)) {
      if (typeof value === 'string') headers.set(name, value);
    }
    const readLimited = async (limit: number, truncate = false): Promise<Buffer> => {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of response) {
        if (size + chunk.length > limit) {
          if (truncate) {
            chunks.push(chunk.subarray(0, limit - size));
            response.destroy();
            return Buffer.concat(chunks);
          }
          response.destroy();
          throw new Error('Resposta excede o limite permitido');
        }
        size += chunk.length;
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    };
    return {
      status: response.statusCode || 502,
      ok: (response.statusCode || 502) >= 200 && (response.statusCode || 502) < 300,
      headers,
      url: url.href,
      body: response,
      text: async () => (await readLimited(1024 * 1024)).toString('utf8'),
      arrayBuffer: async () => readLimited(64 * 1024, true)
    };
  }
  throw new Error('Redirecionamentos em excesso');
}
