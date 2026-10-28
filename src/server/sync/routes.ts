/**
 * ZAPITV — ROTAS DE SINCRONIZAÇÃO ENTRE DISPOSITIVOS (P3.D)
 * 
 * Endpoints:
 * - GET  /api/sync/pull      : Recupera estado agregado sincronizado do perfil
 * - GET  /api/sync/progress  : Consulta progresso de reprodução
 * - POST /api/sync/progress  : Salva/atualiza progresso de reprodução com LWW
 * - GET  /api/sync/history   : Consulta histórico do perfil
 * - POST /api/sync/history   : Registra atividade no histórico
 * - GET  /api/sync/list      : Consulta Minha Lista
 * - POST /api/sync/list      : Adiciona/remove item de Minha Lista (com tombstone)
 * - GET  /api/sync/favorites : Consulta Favoritos
 * - POST /api/sync/favorites : Adiciona/remove favorito (com tombstone)
 * - POST /api/sync/batch     : Processa fila outbox de mutações offline
 */

import express from 'express';
import { getValidDatabase, authenticateUser, requireCsrfProtection } from '../auth/authMiddleware';
import { extractCookie } from '../auth/sessionService';
import { SyncService, ProgressInput, HistoryInput, SyncMutation } from './syncService';

export const syncRouter = express.Router();

// Todas as rotas de sincronização exigem usuário autenticado
syncRouter.use(authenticateUser);

// Aplica proteção CSRF a todas as mutações
syncRouter.use(requireCsrfProtection);

function resolveProfileId(req: express.Request): string | undefined {
  if (req.body && typeof req.body.profileId === 'string' && req.body.profileId.trim()) {
    return req.body.profileId.trim();
  }
  if (req.query && typeof req.query.profileId === 'string' && req.query.profileId.trim()) {
    return (req.query.profileId as string).trim();
  }
  const cookieProfile = extractCookie(req.headers.cookie, 'zapitv_active_profile');
  if (cookieProfile) {
    try {
      return decodeURIComponent(cookieProfile).trim();
    } catch {
      return cookieProfile.trim();
    }
  }
  return undefined;
}

/**
 * 1. PULL AGREGADO DO ESTADO DO PERFIL
 */
syncRouter.get('/pull', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const since = req.query.since ? Number(req.query.since) : undefined;
    const data = await SyncService.pullProfileState(db, profileId, since);

    return res.status(200).json(data);
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao puxar dados de sincronização.' });
  }
});

/**
 * 2. PROGRESSO DE REPRODUÇÃO
 */
syncRouter.get('/progress', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const canonicalId = typeof req.query.canonicalId === 'string' ? req.query.canonicalId.trim() : undefined;
    if (canonicalId) {
      const season = req.query.season ? Number(req.query.season) : 0;
      const episode = req.query.episode ? Number(req.query.episode) : 0;
      const item = await SyncService.getProgressItem(db, profileId, canonicalId, season, episode);
      return res.status(200).json({ progress: item });
    }

    const since = req.query.since ? Number(req.query.since) : undefined;
    const list = await SyncService.getProgressList(db, profileId, since);

    return res.status(200).json({ progress: list });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao consultar progresso.' });
  }
});

syncRouter.post('/progress', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const input: ProgressInput = {
      canonicalId: req.body.canonicalId,
      contentType: req.body.contentType || 'movie',
      season: req.body.season,
      episode: req.body.episode,
      positionSec: req.body.positionSec,
      durationSec: req.body.durationSec,
      progressPercent: req.body.progressPercent,
      isCompleted: req.body.isCompleted,
      deviceName: req.body.deviceName,
      updatedAt: req.body.updatedAt,
      clientSendTime: req.body.clientSendTime ? Number(req.body.clientSendTime) : undefined,
      clientMutationId: req.body.clientMutationId,
    };

    const result = await SyncService.saveProgress(db, profileId, input);

    return res.status(200).json({
      success: true,
      progress: result.record,
      conflictResolved: result.conflictResolved,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao salvar progresso.' });
  }
});

/**
 * 3. HISTÓRICO DE REPRODUÇÃO
 */
syncRouter.get('/history', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const since = req.query.since ? Number(req.query.since) : undefined;

    const list = await SyncService.getHistory(db, profileId, limit, offset, since);

    return res.status(200).json({ history: list });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao consultar histórico.' });
  }
});

syncRouter.post('/history', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const input: HistoryInput = {
      canonicalId: req.body.canonicalId,
      contentType: req.body.contentType || 'movie',
      season: req.body.season,
      episode: req.body.episode,
      title: req.body.title,
      posterUrl: req.body.posterUrl,
      year: req.body.year,
      watchedAt: req.body.watchedAt,
      updatedAt: req.body.updatedAt,
      clientSendTime: req.body.clientSendTime ? Number(req.body.clientSendTime) : undefined,
      clientMutationId: req.body.clientMutationId,
    };

    const record = await SyncService.recordHistory(db, profileId, input);

    return res.status(200).json({ success: true, history: record });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao registrar histórico.' });
  }
});

/**
 * 4. MINHA LISTA
 */
syncRouter.get('/list', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const includeRemoved = req.query.includeRemoved === 'true';
    const since = req.query.since ? Number(req.query.since) : undefined;

    const list = await SyncService.getMyList(db, profileId, includeRemoved, since);

    return res.status(200).json({ myList: list });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao consultar Minha Lista.' });
  }
});

syncRouter.post('/list', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const canonicalId = req.body.canonicalId;
    const isRemoved = Boolean(req.body.isRemoved);
    const timestamp = req.body.timestamp ? Number(req.body.timestamp) : undefined;
    const clientSendTime = req.body.clientSendTime ? Number(req.body.clientSendTime) : undefined;

    const result = await SyncService.setMyList(db, profileId, canonicalId, isRemoved, timestamp, clientSendTime);

    return res.status(200).json({
      success: true,
      item: result.record,
      conflictResolved: result.conflictResolved,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao alterar Minha Lista.' });
  }
});

/**
 * 5. FAVORITOS
 */
syncRouter.get('/favorites', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const includeRemoved = req.query.includeRemoved === 'true';
    const since = req.query.since ? Number(req.query.since) : undefined;

    const list = await SyncService.getFavorites(db, profileId, includeRemoved, since);

    return res.status(200).json({ favorites: list });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao consultar favoritos.' });
  }
});

syncRouter.post('/favorites', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const canonicalId = req.body.canonicalId;
    const isRemoved = Boolean(req.body.isRemoved);
    const timestamp = req.body.timestamp ? Number(req.body.timestamp) : undefined;
    const clientSendTime = req.body.clientSendTime ? Number(req.body.clientSendTime) : undefined;

    const result = await SyncService.setFavorite(db, profileId, canonicalId, isRemoved, timestamp, clientSendTime);

    return res.status(200).json({
      success: true,
      item: result.record,
      conflictResolved: result.conflictResolved,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao alterar favoritos.' });
  }
});

/**
 * 6. PROCESSAMENTO DE LOTE OFFLINE (BATCH) COM IDEMPOTÊNCIA PERSISTENTE
 */
syncRouter.post('/batch', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const profileId = resolveProfileId(req);
    if (!profileId) {
      return res.status(400).json({ error: 'Nenhum perfil informado ou ativo.' });
    }

    await SyncService.verifyProfileOwnership(db, req.user!.id, profileId);

    const clientSendTime = req.body.clientSendTime ? Number(req.body.clientSendTime) : undefined;
    const mutations: SyncMutation[] = Array.isArray(req.body.mutations) ? req.body.mutations : [];
    const outcome = await SyncService.processBatch(db, profileId, mutations, clientSendTime);

    return res.status(200).json({
      success: true,
      processed: outcome.processed,
      results: outcome.results,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err?.message || 'Erro ao processar lote de sincronização.' });
  }
});
