import http from 'node:http';
import https from 'node:https';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, rename, stat, rm, open } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { DEFAULT_ORIGINS, validHost, resolvePublicUrl, safeName } from './security.mjs';

const PORT = Number(process.env.ZAPITV_HELPER_PORT || 19573);
const ROOT = path.resolve(process.env.ZAPITV_HELPER_DIR || path.join(os.homedir(), 'Videos', 'ZapiTV'));
const ORIGINS = DEFAULT_ORIGINS;
const DB_FILE = path.join(ROOT, '.zapitv-helper.json');
const jobs = new Map();
const mediaTickets = new Map();
const pairingCode = String(100000 + Math.floor(Math.random() * 900000));
let pairFailures = 0;
let token = randomBytes(32).toString('hex');
let library = [];
let active = 0;

const json = (res, status, value) => {
  const data = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': data.length, 'cache-control': 'no-store' });
  res.end(data);
};
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const readJson = async req => {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 32_768) throw new Error('Requisição muito grande.');
  }
  return JSON.parse(data || '{}');
};
const saveLibrary = async () => {
  const tmp = DB_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify({ version: 1, library }), { mode: 0o600 });
  await rename(tmp, DB_FILE);
};
const publicJob = job => ({ id: job.id, itemId: job.itemId, title: job.title, type: job.type, season: job.season, episode: job.episode, quality: job.quality, format: job.format, status: job.status, bytes: job.bytes, total: job.total, error: job.error || null, createdAt: job.createdAt });

async function requestSource(raw, headers = {}, signal, redirects = 0) {
  if (redirects > 3) throw new Error('Redirecionamentos demais.');
  const { url, address, family } = await resolvePublicUrl(raw);
  const protocol = url.protocol === 'https:' ? https : http;
  const response = await new Promise((resolve, reject) => {
    const req = protocol.get(url, {
      headers: { 'user-agent': 'ZapiTV-Helper/0.1', ...headers },
      lookup: (_host, options, cb) => options?.all ? cb(null, [{ address, family }]) : cb(null, address, family),
      timeout: 20_000,
      signal
    }, resolve);
    req.on('timeout', () => req.destroy(new Error('Tempo limite da origem.')));
    req.on('error', reject);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    const location = response.headers.location;
    response.resume();
    if (!location) throw new Error('Redirecionamento sem destino.');
    const next = new URL(location, url);
    if (url.protocol === 'https:' && next.protocol !== 'https:') throw new Error('Redirecionamento HTTPS inseguro.');
    return requestSource(next.href, headers, signal, redirects + 1);
  }
  return response;
}

async function transfer(job) {
  active++;
  job.status = 'downloading';
  job.controller = new AbortController();
  try {
    const part = path.join(ROOT, `${job.id}.${job.format}.part`);
    let offset = 0;
    try { offset = (await stat(part)).size; } catch {}
    let response = await requestSource(job.url, offset ? { Range: `bytes=${offset}-`, ...(job.etag ? { 'If-Range': job.etag } : {}) } : {}, job.controller.signal);
    if (response.statusCode === 416 && job.total && offset === job.total) {
      response.resume();
    } else {
      if (response.statusCode !== 200 && response.statusCode !== 206) throw new Error(`Origem HTTP ${response.statusCode}.`);
      const range = String(response.headers['content-range'] || '');
      const validResume = response.statusCode === 206 && range.startsWith(`bytes ${offset}-`);
      if (response.statusCode === 206 && !validResume) throw new Error('Intervalo de retomada incorreto.');
      if (offset && !validResume) offset = 0;
      const length = Number(response.headers['content-length']);
      job.total = Number.isFinite(length) && length > 0 ? length + offset : 0;
      job.etag = String(response.headers.etag || job.etag || '');
      job.bytes = offset;
      const writer = createWriteStream(part, { flags: offset ? 'a' : 'w' });
      try {
        for await (const chunk of response) {
          if (!writer.write(chunk)) await new Promise((resolve, reject) => { writer.once('drain', resolve); writer.once('error', reject); });
          job.bytes += chunk.length;
        }
        await new Promise((resolve, reject) => writer.end(err => err ? reject(err) : resolve()));
      } catch (error) {
        writer.destroy();
        throw error;
      }
    }
    if (job.total && job.bytes !== job.total && offset !== job.total) throw new Error('Arquivo incompleto.');
    const size = (await stat(part)).size;
    if (!size || (job.total && size !== job.total)) throw new Error('Tamanho final inválido.');
    const handle = await open(part, 'r');
    const head = Buffer.alloc(Math.min(size, 4096));
    try { await handle.read(head, 0, head.length, 0); } finally { await handle.close(); }
    if (job.format === 'mp4' && !head.includes(Buffer.from('ftyp'))) throw new Error('Resposta não é um MP4 válido.');
    if (job.format === 'webm' && !head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) throw new Error('Resposta não é um WebM válido.');
    const fileName = `${safeName(job.title)}${job.season && job.episode ? ` - T${job.season}E${job.episode}` : ''} - ${safeName(job.quality)} - ${job.id}.${job.format}`;
    await rename(part, path.join(ROOT, fileName));
    library = library.filter(entry => entry.id !== job.id);
    library.push({ ...publicJob(job), fileName, bytes: size, completedAt: Date.now() });
    await saveLibrary();
    job.status = 'completed';
    job.bytes = size;
  } catch (error) {
    job.status = job.status === 'cancelled' ? 'cancelled' : job.controller.signal.aborted ? 'paused' : 'error';
    job.error = job.status === 'error' ? String(error.message || error) : null;
  } finally {
    job.controller = null;
    active--;
    pump();
  }
}

function pump() {
  for (const job of jobs.values()) {
    if (active >= 2) break;
    if (job.status === 'pending') void transfer(job);
  }
}

async function serveMedia(req, res, id, ticket) {
  const grant = mediaTickets.get(ticket);
  if (!grant || grant.id !== id || Date.now() > grant.expires) return json(res, 403, { error: 'Acesso à mídia expirado.' });
  const entry = library.find(x => x.id === id);
  if (!entry) return json(res, 404, { error: 'Arquivo não encontrado.' });
  const filePath = path.join(ROOT, entry.fileName);
  const info = await stat(filePath);
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  let start = match && match[1] ? Number(match[1]) : 0;
  let end = match && match[2] ? Number(match[2]) : info.size - 1;
  if (start > end || end >= info.size) {
    res.writeHead(416, { 'content-range': `bytes */${info.size}` });
    return res.end();
  }
  res.writeHead(match ? 206 : 200, {
    'content-type': entry.format === 'webm' ? 'video/webm' : 'video/mp4',
    'accept-ranges': 'bytes',
    'content-length': end - start + 1,
    ...(match ? { 'content-range': `bytes ${start}-${end}/${info.size}` } : {}),
    'cache-control': 'no-store'
  });
  createReadStream(filePath, { start, end }).pipe(res);
}

async function handle(req, res) {
  try {
    const origin = req.headers.origin;
    if (!validHost(req.headers.host, PORT) || (origin && !ORIGINS.has(origin))) return json(res, 403, { error: 'Origem não autorizada.' });
    if (origin) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-private-network', 'true');
      res.setHeader('access-control-allow-headers', 'Authorization, Content-Type');
      res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { name: 'ZapiTV Helper', version: '0.1.0', paired: false });
    if (req.method === 'POST' && url.pathname === '/pair') {
      if (!origin || !ORIGINS.has(origin) || pairFailures >= 10) return json(res, 429, { error: 'Pareamento indisponível.' });
      const body = await readJson(req);
      if (!equal(body.code, pairingCode)) { pairFailures++; return json(res, 403, { error: 'Código incorreto.' }); }
      pairFailures = 0;
      return json(res, 200, { token });
    }
    const mediaMatch = /^\/media\/([a-f0-9]{24})$/.exec(url.pathname);
    if (req.method === 'GET' && mediaMatch) {
      const ticket = url.searchParams.get('ticket');
      if (!ticket || !mediaTickets.has(ticket)) return json(res, 403, { error: 'Acesso à mídia negado.' });
      return serveMedia(req, res, mediaMatch[1], ticket);
    }
    const auth = req.headers.authorization?.replace(/^Bearer /, '');
    if (!equal(auth, token)) return json(res, 401, { error: 'Pareamento necessário.' });
    if (req.method === 'POST' && url.pathname === '/disconnect') {
      token = randomBytes(32).toString('hex');
      mediaTickets.clear();
      return json(res, 200, { disconnected: true });
    }
    if (req.method === 'GET' && url.pathname === '/library') {
      const existing = [];
      for (const entry of library) { try { await stat(path.join(ROOT, entry.fileName)); existing.push(entry); } catch {} }
      return json(res, 200, { items: existing });
    }
    if (req.method === 'GET' && url.pathname === '/jobs') return json(res, 200, { jobs: [...jobs.values()].map(publicJob) });
    if (req.method === 'POST' && url.pathname === '/jobs') {
      const body = await readJson(req);
      if (body.offlineAllowed !== true || !body.itemId || !body.title || !['mp4', 'webm'].includes(body.format) || !body.url) return json(res, 400, { error: 'Fonte ou identidade inválida.' });
      if (!/^https?:\/\//i.test(body.url)) return json(res, 400, { error: 'URL inválida.' });
      await resolvePublicUrl(body.url);
      const season = Number(body.season) || undefined;
      const episode = Number(body.episode) || undefined;
      if ((season && !episode) || (!season && episode) || season < 0 || episode < 0) return json(res, 400, { error: 'Episódio inválido.' });
      const quality = safeName(body.quality || 'Original');
      const existing = [...jobs.values()].find(x => x.itemId === body.itemId && x.season === season && x.episode === episode && x.quality === quality && x.status !== 'cancelled');
      if (existing) return json(res, 200, { job: publicJob(existing) });
      const id = randomBytes(12).toString('hex');
      const job = { id, itemId: String(body.itemId).slice(0, 100), title: String(body.title).slice(0, 200), type: ['FILME', 'SÉRIE', 'ANIME'].includes(body.type) ? body.type : undefined, season, episode, quality, format: body.format, url: body.url, status: 'pending', bytes: 0, total: 0, createdAt: Date.now() };
      jobs.set(id, job);
      pump();
      return json(res, 201, { job: publicJob(job) });
    }
    const jobMatch = /^\/jobs\/([a-f0-9]{24})$/.exec(url.pathname);
    if (jobMatch) {
      const job = jobs.get(jobMatch[1]);
      if (!job) return json(res, 404, { error: 'Tarefa não encontrada.' });
      if (req.method === 'GET') return json(res, 200, { job: publicJob(job) });
      if (req.method === 'DELETE') {
        job.controller?.abort(); job.status = 'cancelled';
        await rm(path.join(ROOT, `${job.id}.${job.format}.part`), { force: true });
        return json(res, 200, { job: publicJob(job) });
      }
      if (req.method === 'POST') {
        const body = await readJson(req);
        if (body.action === 'pause' && job.status === 'downloading') { job.controller.abort(); job.status = 'paused'; }
        else if (body.action === 'resume' && ['paused', 'error'].includes(job.status)) { job.status = 'pending'; job.error = null; pump(); }
        else return json(res, 409, { error: 'Transição inválida.' });
        return json(res, 200, { job: publicJob(job) });
      }
    }
    if (req.method === 'POST' && /^\/media\/([a-f0-9]{24})\/ticket$/.test(url.pathname)) {
      const id = url.pathname.split('/')[2];
      if (!library.some(x => x.id === id)) return json(res, 404, { error: 'Arquivo não encontrado.' });
      for (const [key, grant] of mediaTickets) if (grant.expires < Date.now()) mediaTickets.delete(key);
      const ticket = randomBytes(24).toString('hex');
      mediaTickets.set(ticket, { id, expires: Date.now() + 60 * 60 * 1000 });
      return json(res, 200, { url: `http://127.0.0.1:${PORT}/media/${id}?ticket=${ticket}` });
    }
    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    json(res, 400, { error: String(error.message || error) });
  }
}

await mkdir(ROOT, { recursive: true });
try { library = JSON.parse(await readFile(DB_FILE, 'utf8')).library || []; } catch {}
const server = http.createServer(handle);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`ZapiTV Helper em http://127.0.0.1:${PORT}`);
  console.log(`Pasta: ${ROOT}`);
  console.log(`Código de pareamento: ${pairingCode}`);
});
