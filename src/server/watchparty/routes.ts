import { Router } from "express";
import { getDatabase, Database } from "../database/client";
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const hasHostAuthority = (room: StoredRoom, authorization: unknown): boolean => {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(typeof authorization === 'string' ? authorization : '');
  if (!room.hostTokenHash || !match) return false;
  return timingSafeEqual(Buffer.from(room.hostTokenHash, 'hex'), Buffer.from(hashToken(match[1]), 'hex'));
};

export interface StoredParticipant {
  peerId: string;
  nickname: string;
  isHost: boolean;
  status: string;
  lastSeen: number;
}

export interface StoredRoom {
  roomId: string;
  hostPeerId: string;
  hostNickname: string;
  hostTokenHash?: string;
  media: any;
  transmissionMode: string;
  lifecycleState: string;
  introStartTimestamp?: number;
  introDuration?: number;
  createdAt: number;
  updatedAt: number;
  participants: Map<string, StoredParticipant>;
}

export interface StoredSignal {
  id: string;
  senderPeerId: string;
  targetPeerId?: string;
  type: string;
  data: any;
  timestamp: number;
}

export function sanitizeRoomId(raw: any): string {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();

  // 1. Decodificação recursiva de URI (resolve %5B -> [, %255B -> %5B -> [, etc.)
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(str);
      if (decoded === str) break;
      str = decoded;
    } catch {
      break;
    }
  }

  // 2. Extração de caminhos /sala/ ou parâmetros ?sala=
  if (str.includes('/sala/')) {
    const parts = str.split('/sala/');
    str = parts[parts.length - 1];
  } else if (str.includes('sala=')) {
    const match = str.match(/sala=([^&#\s]+)/);
    if (match && match[1]) {
      str = match[1];
    }
  }

  // 3. Remove query strings, hashes e fragmentos de URL
  str = str.split('?')[0].split('#')[0].trim();

  // 4. Se contiver o padrão canônico zapi-..., isola a chave exata
  const canonicalMatch = str.match(/(zapi-[a-zA-Z0-9_-]+)/i);
  if (canonicalMatch && canonicalMatch[1]) {
    return canonicalMatch[1].replace(/[^a-zA-Z0-9]+$/, '').toLowerCase();
  }

  // 5. Fallback para códigos personalizados:
  str = str.replace(/^[\[\(\{<"'\s]+|[\]\)\}>"'\s,\.;:]+$/g, '');
  str = str.replace(/[^a-zA-Z0-9_-]/g, '');

  return str.toLowerCase();
}

// Timeout de abandono de sala ampliado para 5 minutos (300.000 ms)
export const ROOM_TIMEOUT_MS = 300000;
export const PARTICIPANT_TIMEOUT_MS = 60000;

const activeRooms = new Map<string, StoredRoom>();
const roomSignals = new Map<string, StoredSignal[]>();
const closedRooms = new Set<string>();

let dbInitPromise: Promise<void> | null = null;
async function ensureDbTables(db: Database) {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        await db.client.execute(`
          CREATE TABLE IF NOT EXISTS watchparty_rooms (
            room_id TEXT PRIMARY KEY,
            host_peer_id TEXT NOT NULL,
            host_nickname TEXT NOT NULL,
            host_token_hash TEXT,
            media_json TEXT,
            transmission_mode TEXT NOT NULL DEFAULT 'host_broadcast',
            lifecycle_state TEXT NOT NULL DEFAULT 'LOBBY',
            intro_start_timestamp INTEGER,
            intro_duration INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            is_closed INTEGER NOT NULL DEFAULT 0,
            participants_json TEXT NOT NULL DEFAULT '[]'
          );
        `);
        const columns = await db.client.execute('PRAGMA table_info(watchparty_rooms)');
        if (!columns.rows.some(row => row.name === 'host_token_hash')) {
          await db.client.execute('ALTER TABLE watchparty_rooms ADD COLUMN host_token_hash TEXT');
        }
        await db.client.execute(`
          CREATE TABLE IF NOT EXISTS watchparty_signals (
            id TEXT PRIMARY KEY,
            room_id TEXT NOT NULL,
            sender_peer_id TEXT NOT NULL,
            target_peer_id TEXT,
            type TEXT NOT NULL,
            data_json TEXT,
            timestamp INTEGER NOT NULL
          );
        `);
        await db.client.execute(`
          CREATE INDEX IF NOT EXISTS idx_watchparty_signals_room_time 
          ON watchparty_signals(room_id, timestamp);
        `);
      } catch (err) {
        console.warn('[WatchParty] Falha ao criar tabelas no banco remoto, operando com fallback em memória:', err);
      }
    })();
  }
  return dbInitPromise;
}

async function syncRoomToDb(room: StoredRoom, isClosed = 0) {
  const db = getDatabase();
  if (!db) return;
  try {
    await ensureDbTables(db);
    const participantsArr = Array.from(room.participants.values());
    await db.client.execute({
      sql: `INSERT INTO watchparty_rooms (
        room_id, host_peer_id, host_nickname, host_token_hash, media_json, transmission_mode,
        lifecycle_state, intro_start_timestamp, intro_duration, created_at,
        updated_at, is_closed, participants_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET
        host_peer_id = excluded.host_peer_id,
        host_nickname = excluded.host_nickname,
        host_token_hash = excluded.host_token_hash,
        media_json = excluded.media_json,
        transmission_mode = excluded.transmission_mode,
        lifecycle_state = excluded.lifecycle_state,
        intro_start_timestamp = excluded.intro_start_timestamp,
        intro_duration = excluded.intro_duration,
        updated_at = excluded.updated_at,
        is_closed = excluded.is_closed,
        participants_json = excluded.participants_json;`,
      args: [
        room.roomId,
        room.hostPeerId,
        room.hostNickname,
        room.hostTokenHash ?? null,
        room.media ? JSON.stringify(room.media) : null,
        room.transmissionMode || 'host_broadcast',
        room.lifecycleState || 'LOBBY',
        room.introStartTimestamp ?? null,
        room.introDuration ?? null,
        room.createdAt,
        room.updatedAt,
        isClosed,
        JSON.stringify(participantsArr)
      ]
    });
  } catch (err) {
    console.warn('[WatchParty] Erro ao sincronizar sala com banco:', err);
  }
}

async function fetchRoomFromDb(roomId: string): Promise<{ room?: StoredRoom; isClosed?: boolean; isExpired?: boolean } | null> {
  const db = getDatabase();
  if (!db) return null;
  try {
    await ensureDbTables(db);
    const result = await db.client.execute({
      sql: `SELECT * FROM watchparty_rooms WHERE room_id = ? LIMIT 1;`,
      args: [roomId]
    });
    if (!result.rows || result.rows.length === 0) return null;
    const row: any = result.rows[0];
    const isClosed = Boolean(row.is_closed);
    const now = Date.now();
    const isExpired = (now - Number(row.updated_at)) > ROOM_TIMEOUT_MS;

    let media: any = null;
    if (row.media_json) {
      try { media = JSON.parse(String(row.media_json)); } catch {}
    }
    const participants = new Map<string, StoredParticipant>();
    if (row.participants_json) {
      try {
        const arr = JSON.parse(String(row.participants_json));
        if (Array.isArray(arr)) {
          for (const p of arr) {
            if (p?.peerId) participants.set(p.peerId, p);
          }
        }
      } catch {}
    }

    const room: StoredRoom = {
      roomId: String(row.room_id),
      hostPeerId: String(row.host_peer_id || ''),
      hostNickname: String(row.host_nickname || 'Anfitrião'),
      hostTokenHash: row.host_token_hash ? String(row.host_token_hash) : undefined,
      media,
      transmissionMode: String(row.transmission_mode || 'host_broadcast'),
      lifecycleState: String(row.lifecycle_state || 'LOBBY'),
      introStartTimestamp: row.intro_start_timestamp ? Number(row.intro_start_timestamp) : undefined,
      introDuration: row.intro_duration ? Number(row.intro_duration) : undefined,
      createdAt: Number(row.created_at || now),
      updatedAt: Number(row.updated_at || now),
      participants
    };

    return { room, isClosed, isExpired };
  } catch (err) {
    console.warn('[WatchParty] Erro ao buscar sala no banco:', err);
    return null;
  }
}

async function syncSignalToDb(roomId: string, sig: StoredSignal) {
  const db = getDatabase();
  if (!db) return;
  try {
    await ensureDbTables(db);
    await db.client.execute({
      sql: `INSERT INTO watchparty_signals (id, room_id, sender_peer_id, target_peer_id, type, data_json, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?);`,
      args: [
        sig.id,
        roomId,
        sig.senderPeerId,
        sig.targetPeerId ?? null,
        sig.type,
        sig.data ? JSON.stringify(sig.data) : null,
        sig.timestamp
      ]
    });
  } catch (err) {
    console.warn('[WatchParty] Erro ao salvar sinal no banco:', err);
  }
}

async function fetchSignalsFromDb(roomId: string, peerId: string, since: number): Promise<StoredSignal[]> {
  const db = getDatabase();
  if (!db) return [];
  try {
    await ensureDbTables(db);
    const result = await db.client.execute({
      sql: `SELECT * FROM watchparty_signals 
            WHERE room_id = ? AND timestamp > ? AND sender_peer_id != ? AND (target_peer_id IS NULL OR target_peer_id = ?)
            ORDER BY timestamp ASC LIMIT 100;`,
      args: [roomId, since, peerId, peerId]
    });
    if (!result.rows) return [];
    return result.rows.map((row: any) => ({
      id: String(row.id),
      senderPeerId: String(row.sender_peer_id),
      targetPeerId: row.target_peer_id ? String(row.target_peer_id) : undefined,
      type: String(row.type),
      data: row.data_json ? JSON.parse(String(row.data_json)) : null,
      timestamp: Number(row.timestamp)
    }));
  } catch (err) {
    console.warn('[WatchParty] Erro ao buscar sinais no banco:', err);
    return [];
  }
}

async function markRoomClosedInDb(roomId: string) {
  const db = getDatabase();
  if (!db) return;
  try {
    await ensureDbTables(db);
    await db.client.execute({
      sql: `UPDATE watchparty_rooms SET is_closed = 1, updated_at = ? WHERE room_id = ?;`,
      args: [Date.now(), roomId]
    });
  } catch (err) {
    console.warn('[WatchParty] Erro ao fechar sala no banco:', err);
  }
}

function pruneStaleState() {
  const now = Date.now();
  for (const [roomId, room] of activeRooms.entries()) {
    // Sala sem atualização por mais de 5 minutos é encerrada
    if (now - room.updatedAt > ROOM_TIMEOUT_MS) {
      activeRooms.delete(roomId);
      roomSignals.delete(roomId);
      closedRooms.add(roomId);
    } else {
      // Participantes não vistos por mais de 60 segundos são removidos (exceto o host)
      for (const [peerId, p] of room.participants.entries()) {
        if (!p.isHost && now - p.lastSeen > PARTICIPANT_TIMEOUT_MS) {
          room.participants.delete(peerId);
        }
      }
    }
  }

  for (const [roomId, signals] of roomSignals.entries()) {
    const recent = signals.filter(s => now - s.timestamp < 60000);
    if (recent.length === 0) {
      roomSignals.delete(roomId);
    } else {
      roomSignals.set(roomId, recent.slice(-100));
    }
  }
}

export const watchPartyRouter = Router();

// Limpeza periódica em memória
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(pruneStaleState, 15000);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
}

// 1. Registrar / Anunciar Sala
watchPartyRouter.post('/room/announce', async (req, res) => {
  pruneStaleState();
  const rawRoomId = req.body?.roomId;
  const cleanRoomId = sanitizeRoomId(rawRoomId);

  if (!cleanRoomId || cleanRoomId.length > 128) {
    return res.status(400).json({ ok: false, error: 'Código de sala inválido.', code: 'INVALID_ROOM_CODE' });
  }

  const {
    hostPeerId,
    hostNickname,
    media,
    transmissionMode,
    lifecycleState,
    introStartTimestamp,
    introDuration
  } = req.body || {};
  if (typeof hostPeerId !== 'string' || !hostPeerId || hostPeerId.length > 128 ||
      (hostNickname && (typeof hostNickname !== 'string' || hostNickname.length > 100))) {
    return res.status(400).json({ ok: false, code: 'INVALID_HOST' });
  }

  const now = Date.now();
  let room = activeRooms.get(cleanRoomId);
  let hostToken: string | undefined;

  if (!room) {
    const dbRes = await fetchRoomFromDb(cleanRoomId);
    if (dbRes?.isClosed) return res.status(409).json({ ok: false, code: 'ROOM_CLOSED' });
    if (dbRes?.room) {
      room = dbRes.room;
    }
  }

  if (!room) {
    hostToken = randomBytes(32).toString('hex');
    room = {
      roomId: cleanRoomId,
      hostPeerId: hostPeerId || '',
      hostNickname: hostNickname || 'Anfitrião',
      hostTokenHash: hashToken(hostToken),
      media: media || null,
      transmissionMode: transmissionMode || 'host_broadcast',
      lifecycleState: lifecycleState || 'LOBBY',
      introStartTimestamp,
      introDuration,
      createdAt: now,
      updatedAt: now,
      participants: new Map()
    };
  } else {
    if (!hasHostAuthority(room, req.header('authorization'))) {
      return res.status(403).json({ ok: false, code: 'HOST_AUTH_REQUIRED' });
    }
    room.updatedAt = now;
    if (hostPeerId) room.hostPeerId = hostPeerId;
    if (hostNickname) room.hostNickname = hostNickname;
    if (media) room.media = media;
    if (transmissionMode) room.transmissionMode = transmissionMode;
    if (lifecycleState) room.lifecycleState = lifecycleState;
    if (introStartTimestamp !== undefined) room.introStartTimestamp = introStartTimestamp;
    if (introDuration !== undefined) room.introDuration = introDuration;
  }

  if (room.hostPeerId) {
    room.participants.set(room.hostPeerId, {
      peerId: room.hostPeerId,
      nickname: room.hostNickname,
      isHost: true,
      status: 'ready',
      lastSeen: now
    });
  }

  activeRooms.set(cleanRoomId, room);
  closedRooms.delete(cleanRoomId);

  // Persiste no banco compartilhado
  await syncRoomToDb(room, 0);

  res.json({
    ok: true,
    ...(hostToken ? { hostToken } : {}),
    room: {
      roomId: room.roomId,
      hostPeerId: room.hostPeerId,
      hostNickname: room.hostNickname,
      media: room.media,
      transmissionMode: room.transmissionMode,
      lifecycleState: room.lifecycleState,
      introStartTimestamp: room.introStartTimestamp,
      introDuration: room.introDuration,
      participants: Array.from(room.participants.values())
    }
  });
});

// 2. Consultar Estado Autoritativo da Sala
watchPartyRouter.get('/room/:roomId', async (req, res) => {
  pruneStaleState();
  const rawRoomId = req.params.roomId;
  const cleanRoomId = sanitizeRoomId(rawRoomId);

  if (!cleanRoomId) {
    return res.status(400).json({ ok: false, error: 'Código de sala inválido.', code: 'INVALID_ROOM_CODE' });
  }

  if (closedRooms.has(cleanRoomId)) {
    return res.status(404).json({ ok: false, error: 'Esta sala foi encerrada pelo anfitrião.', code: 'ROOM_CLOSED' });
  }

  let room = activeRooms.get(cleanRoomId);
  const now = Date.now();

  if (!room) {
    const dbRes = await fetchRoomFromDb(cleanRoomId);
    if (dbRes) {
      if (dbRes.isClosed) {
        closedRooms.add(cleanRoomId);
        return res.status(404).json({ ok: false, error: 'Esta sala foi encerrada pelo anfitrião.', code: 'ROOM_CLOSED' });
      }
      if (dbRes.isExpired) {
        return res.status(404).json({ ok: false, error: 'A sala expirou ou o anfitrião se desconectou.', code: 'HOST_DISCONNECTED' });
      }
      if (dbRes.room) {
        room = dbRes.room;
        activeRooms.set(cleanRoomId, room);
      }
    }
  }

  if (!room) {
    return res.status(404).json({
      ok: false,
      error: 'Sala não encontrada ou encerrada pelo anfitrião. Verifique o link e tente novamente.',
      code: 'ROOM_NOT_FOUND'
    });
  }

  if (now - room.updatedAt > ROOM_TIMEOUT_MS) {
    activeRooms.delete(cleanRoomId);
    return res.status(404).json({
      ok: false,
      error: 'A sala expirou por inatividade do anfitrião.',
      code: 'HOST_DISCONNECTED'
    });
  }

  res.json({
    ok: true,
    room: {
      roomId: room.roomId,
      hostPeerId: room.hostPeerId,
      hostNickname: room.hostNickname,
      media: room.media,
      transmissionMode: room.transmissionMode,
      lifecycleState: room.lifecycleState,
      introStartTimestamp: room.introStartTimestamp,
      introDuration: room.introDuration,
      participants: Array.from(room.participants.values())
    }
  });
});

// 3. Heartbeat e Atualização de Presença
watchPartyRouter.post('/room/:roomId/heartbeat', async (req, res) => {
  const cleanRoomId = sanitizeRoomId(req.params.roomId);
  if (!cleanRoomId) {
    return res.status(400).json({ ok: false, error: 'Código de sala inválido.', code: 'INVALID_ROOM_CODE' });
  }

  let room = activeRooms.get(cleanRoomId);
  const now = Date.now();

  if (!room) {
    const dbRes = await fetchRoomFromDb(cleanRoomId);
    if (dbRes?.room && !dbRes.isClosed && !dbRes.isExpired) {
      room = dbRes.room;
      activeRooms.set(cleanRoomId, room);
    }
  }

  if (!room || now - room.updatedAt > ROOM_TIMEOUT_MS) {
    return res.status(404).json({
      ok: false,
      error: 'Sala não encontrada ou encerrada.',
      code: 'ROOM_NOT_FOUND'
    });
  }

  const { peerId, nickname, status } = req.body || {};
  if (!peerId || typeof peerId !== 'string' || peerId.length > 128) {
    return res.status(400).json({ ok: false, code: 'INVALID_PEER' });
  }
  const claimedHost = peerId === room.hostPeerId;
  if (claimedHost && !hasHostAuthority(room, req.header('authorization'))) {
    return res.status(403).json({ ok: false, code: 'HOST_AUTH_REQUIRED' });
  }
  if (!room.participants.has(peerId) && room.participants.size >= 6) {
    return res.status(403).json({ ok: false, code: 'ROOM_FULL' });
  }

  if (claimedHost) {
    room.updatedAt = now;
  }

  if (peerId) {
    const existing = room.participants.get(peerId);
    room.participants.set(peerId, {
      peerId,
      nickname: nickname || existing?.nickname || (claimedHost ? room.hostNickname : 'Convidado'),
      isHost: claimedHost,
      status: status || existing?.status || 'ready',
      lastSeen: now
    });
  }

  syncRoomToDb(room, 0).catch(() => {});

  res.json({
    ok: true,
    room: {
      roomId: room.roomId,
      hostPeerId: room.hostPeerId,
      hostNickname: room.hostNickname,
      media: room.media,
      transmissionMode: room.transmissionMode,
      lifecycleState: room.lifecycleState,
      participants: Array.from(room.participants.values())
    }
  });
});

// 4. Envio de Sinais (Fallback e Presença em Tempo Real)
watchPartyRouter.post('/room/:roomId/signal', async (req, res) => {
  const cleanRoomId = sanitizeRoomId(req.params.roomId);
  if (!cleanRoomId) {
    return res.status(400).json({ ok: false, error: 'Código de sala inválido.', code: 'INVALID_ROOM_CODE' });
  }

  const { senderPeerId, targetPeerId, type, data } = req.body || {};

  if (typeof senderPeerId !== 'string' || !senderPeerId || senderPeerId.length > 128 ||
      typeof type !== 'string' || !type || type.length > 64) {
    return res.status(400).json({ ok: false, error: 'senderPeerId e type são obrigatórios.' });
  }

  let room = activeRooms.get(cleanRoomId);
  if (!room) {
    const dbRes = await fetchRoomFromDb(cleanRoomId);
    if (dbRes?.room && !dbRes.isClosed && !dbRes.isExpired) room = dbRes.room;
  }
  if (!room) return res.status(404).json({ ok: false, code: 'ROOM_NOT_FOUND' });
  if (type === 'join' && !room.participants.has(senderPeerId) && room.participants.size >= 6) {
    return res.status(403).json({ ok: false, code: 'ROOM_FULL' });
  }
  if (senderPeerId === room.hostPeerId && !hasHostAuthority(room, req.header('authorization'))) {
    return res.status(403).json({ ok: false, code: 'HOST_AUTH_REQUIRED' });
  }

  let signals = roomSignals.get(cleanRoomId);
  if (!signals) {
    signals = [];
    roomSignals.set(cleanRoomId, signals);
  }

  const sig: StoredSignal = {
    id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    senderPeerId,
    targetPeerId,
    type,
    data,
    timestamp: Date.now()
  };

  signals.push(sig);
  if (signals.length > 100) signals.shift();

  syncSignalToDb(cleanRoomId, sig).catch(() => {});

  // Se o sinal for um join, registra/atualiza o participante na sala
  activeRooms.set(cleanRoomId, room);

  if (room && type === 'join') {
    if (!room.participants.has(senderPeerId) && room.participants.size >= 6) {
      return res.status(403).json({ ok: false, error: 'A sala atingiu o limite máximo de 6 participantes.', code: 'ROOM_FULL' });
    }
    room.participants.set(senderPeerId, {
      peerId: senderPeerId,
      nickname: data?.nickname || 'Convidado',
      isHost: false,
      status: 'ready',
      lastSeen: Date.now()
    });
    syncRoomToDb(room, 0).catch(() => {});
  }

  res.json({ ok: true, id: sig.id });
});

// 5. Obtenção de Sinais Pendentes
watchPartyRouter.get('/room/:roomId/signals/:peerId', async (req, res) => {
  const cleanRoomId = sanitizeRoomId(req.params.roomId);
  const peerId = req.params.peerId;
  const since = Number(req.query.since) || 0;

  const memSignals = roomSignals.get(cleanRoomId) || [];
  let dbSignals: StoredSignal[] = [];

  const db = getDatabase();
  if (db) {
    dbSignals = await fetchSignalsFromDb(cleanRoomId, peerId, since);
  }

  const signalMap = new Map<string, StoredSignal>();
  for (const s of memSignals) {
    if (s.timestamp > since && s.senderPeerId !== peerId && (!s.targetPeerId || s.targetPeerId === peerId)) {
      signalMap.set(s.id, s);
    }
  }
  for (const s of dbSignals) {
    signalMap.set(s.id, s);
  }

  const combined = Array.from(signalMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  res.json({ ok: true, signals: combined, now: Date.now() });
});

// 6. Encerrar Sala
watchPartyRouter.delete('/room/:roomId', async (req, res) => {
  const cleanRoomId = sanitizeRoomId(req.params.roomId);
  const room = activeRooms.get(cleanRoomId) || (await fetchRoomFromDb(cleanRoomId))?.room;
  if (!room) return res.status(404).json({ ok: false, code: 'ROOM_NOT_FOUND' });
  if (!hasHostAuthority(room, req.header('authorization'))) return res.status(403).json({ ok: false, code: 'HOST_AUTH_REQUIRED' });
  closedRooms.add(cleanRoomId);
  activeRooms.delete(cleanRoomId);
  roomSignals.delete(cleanRoomId);
  await markRoomClosedInDb(cleanRoomId);
  return res.json({ ok: true });
});
