import { Router } from "express";

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

const activeRooms = new Map<string, StoredRoom>();
const roomSignals = new Map<string, StoredSignal[]>();

function pruneStaleState() {
  const now = Date.now();
  for (const [roomId, room] of activeRooms.entries()) {
    // Sala sem atualização por mais de 60 segundos é considerada encerrada
    if (now - room.updatedAt > 60000) {
      activeRooms.delete(roomId);
      roomSignals.delete(roomId);
    } else {
      // Participantes não vistos por mais de 30 segundos são removidos (exceto o host)
      for (const [peerId, p] of room.participants.entries()) {
        if (!p.isHost && now - p.lastSeen > 30000) {
          room.participants.delete(peerId);
        }
      }
    }
  }

  for (const [roomId, signals] of roomSignals.entries()) {
    const recent = signals.filter(s => now - s.timestamp < 35000);
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
  const timer = setInterval(pruneStaleState, 10000);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
}

// 1. Registrar / Anunciar Sala
watchPartyRouter.post('/room/announce', (req, res) => {
  pruneStaleState();
  const {
    roomId,
    hostPeerId,
    hostNickname,
    media,
    transmissionMode,
    lifecycleState,
    introStartTimestamp,
    introDuration
  } = req.body || {};

  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({ ok: false, error: 'roomId é obrigatório.' });
  }

  const now = Date.now();
  let room = activeRooms.get(roomId);

  if (!room) {
    room = {
      roomId,
      hostPeerId: hostPeerId || '',
      hostNickname: hostNickname || 'Anfitrião',
      media: media || null,
      transmissionMode: transmissionMode || 'host_broadcast',
      lifecycleState: lifecycleState || 'LOBBY',
      introStartTimestamp,
      introDuration,
      createdAt: now,
      updatedAt: now,
      participants: new Map()
    };
    activeRooms.set(roomId, room);
  } else {
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

// 2. Consultar Estado Autoritativo da Sala
watchPartyRouter.get('/room/:roomId', (req, res) => {
  pruneStaleState();
  const roomId = req.params.roomId;
  const room = activeRooms.get(roomId);

  if (!room || Date.now() - room.updatedAt > 60000) {
    return res.status(404).json({
      ok: false,
      error: 'Sala não encontrada ou encerrada pelo anfitrião.'
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
watchPartyRouter.post('/room/:roomId/heartbeat', (req, res) => {
  const roomId = req.params.roomId;
  const room = activeRooms.get(roomId);

  if (!room || Date.now() - room.updatedAt > 60000) {
    return res.status(404).json({
      ok: false,
      error: 'Sala não encontrada ou encerrada.'
    });
  }

  const { peerId, nickname, isHost, status } = req.body || {};
  const now = Date.now();

  if (isHost || peerId === room.hostPeerId) {
    room.updatedAt = now;
  }

  if (peerId) {
    const existing = room.participants.get(peerId);
    room.participants.set(peerId, {
      peerId,
      nickname: nickname || existing?.nickname || (isHost ? room.hostNickname : 'Convidado'),
      isHost: Boolean(isHost || peerId === room.hostPeerId),
      status: status || existing?.status || 'ready',
      lastSeen: now
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
      participants: Array.from(room.participants.values())
    }
  });
});

// 4. Envio de Sinais (Fallback e Presença em Tempo Real)
watchPartyRouter.post('/room/:roomId/signal', (req, res) => {
  const roomId = req.params.roomId;
  const { senderPeerId, targetPeerId, type, data } = req.body || {};

  if (!senderPeerId || !type) {
    return res.status(400).json({ ok: false, error: 'senderPeerId e type são obrigatórios.' });
  }

  let signals = roomSignals.get(roomId);
  if (!signals) {
    signals = [];
    roomSignals.set(roomId, signals);
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

  // Se o sinal for um join, registra/atualiza o participante na sala
  const room = activeRooms.get(roomId);
  if (room && type === 'join') {
    room.participants.set(senderPeerId, {
      peerId: senderPeerId,
      nickname: data?.nickname || 'Convidado',
      isHost: false,
      status: 'ready',
      lastSeen: Date.now()
    });
  }

  res.json({ ok: true, id: sig.id });
});

// 5. Obtenção de Sinais Pendentes
watchPartyRouter.get('/room/:roomId/signals/:peerId', (req, res) => {
  const { roomId, peerId } = req.params;
  const since = Number(req.query.since) || 0;
  const signals = roomSignals.get(roomId) || [];

  const filtered = signals.filter(s => 
    s.timestamp > since &&
    s.senderPeerId !== peerId &&
    (!s.targetPeerId || s.targetPeerId === peerId)
  );

  res.json({ ok: true, signals: filtered, now: Date.now() });
});

// 6. Encerrar Sala
watchPartyRouter.delete('/room/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const { peerId } = req.body || req.query || {};
  const room = activeRooms.get(roomId);

  if (room && (!peerId || peerId === room.hostPeerId)) {
    activeRooms.delete(roomId);
    roomSignals.delete(roomId);
  }

  res.json({ ok: true });
});
