import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

export const DEFAULT_ORIGINS = new Set(['https://zapitv-stream.vercel.app', 'http://localhost:4000', 'http://127.0.0.1:4000']);

export function validHost(host, port) {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

export function publicAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const p = address.split('.').map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224) return false;
    if (p[0] === 169 && p[1] === 254) return false;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
    if (p[0] === 192 && p[1] === 168) return false;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return false;
    if (p[0] === 192 && p[1] === 0) return false;
    if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return false;
    if (p[0] === 192 && p[1] === 0 && p[2] === 2) return false;
    if (p[0] === 198 && p[1] === 51 && p[2] === 100) return false;
    if (p[0] === 203 && p[1] === 0 && p[2] === 113) return false;
    return true;
  }
  if (version === 6) {
    const s = address.toLowerCase();
    if (s.startsWith('::ffff:')) return publicAddress(s.slice(7));
    return !(/^(::|::1|f[cd]|fe[89ab]|ff|2001:db8)/i.test(s));
  }
  return false;
}

export async function resolvePublicUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || (url.port && !['80', '443'].includes(url.port))) {
    throw new Error('URL de origem não permitida.');
  }
  const addresses = isIP(url.hostname) ? [{ address: url.hostname, family: isIP(url.hostname) }] : await dnsLookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(x => !publicAddress(x.address))) throw new Error('Endereço privado ou local não permitido como origem.');
  return { url, address: addresses[0].address, family: addresses[0].family };
}

export function safeName(value) {
  return String(value || '').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/^\.+|\.+$/g, '').trim().slice(0, 100) || 'video';
}
