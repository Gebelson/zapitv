/**
 * ZAPITV — ROTAS DE VINCULAÇÃO DE SMART TV E GERENCIAMENTO DE DISPOSITIVOS (P3.C)
 * 
 * Endpoints:
 * - POST   /api/device-auth/challenge   (TV: cria desafio de vinculação)
 * - POST   /api/device-auth/poll        (TV: consulta status e recebe sessão)
 * - GET    /api/device-auth/validate    (Celular: valida código curto da TV)
 * - POST   /api/device-auth/approve     (Celular: confirma autorização com login e CSRF)
 * - POST   /api/device-auth/reject      (Celular: recusa vinculação)
 * - GET    /api/devices                 (Configurações: lista dispositivos vinculados)
 * - DELETE /api/devices/:id             (Configurações: desvincula e revoga sessão)
 */

import { Router } from 'express';
import { getValidDatabase, authenticateUser, requireCsrfProtection } from '../auth/authMiddleware';
import { formatSetCookie } from '../auth/sessionService';
import {
  createDeviceLinkChallenge,
  pollDeviceLinkChallenge,
  validateDeviceUserCode,
  approveDeviceLink,
  rejectDeviceLink,
  listUserLinkedDevices,
  revokeUserLinkedDevice,
  getPublicBaseUrl,
} from './deviceAuthService';

export const deviceAuthRouter = Router();

// ============================================================================
// ENDPOINTS DO FLUXO TV (RFC 8628)
// ============================================================================

/**
 * TV solicita a criação de um novo desafio temporário (10 minutos)
 */
deviceAuthRouter.post('/challenge', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Serviço de autenticação de dispositivos temporariamente indisponível.' });
    }

    const userAgent = (req.headers['user-agent'] as string) || '';
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const baseUrl = getPublicBaseUrl(req);

    const challenge = await createDeviceLinkChallenge(db, {
      userAgent,
      clientIp,
      baseUrl,
    });

    return res.status(201).json(challenge);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar desafio de vinculação.' });
  }
});

/**
 * TV consulta periodicamente o status do desafio (polling)
 */
deviceAuthRouter.post('/poll', async (req, res) => {
  try {
    const { deviceCode } = req.body || {};
    if (!deviceCode || typeof deviceCode !== 'string') {
      return res.status(400).json({ error: 'Código de dispositivo (deviceCode) obrigatório.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
    }

    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const userAgent = (req.headers['user-agent'] as string) || '';

    const pollResult = await pollDeviceLinkChallenge(db, deviceCode, {
      clientIp,
      userAgent,
    });

    // Se o desafio foi aprovado com sucesso, emite o cookie HttpOnly na resposta para a TV
    if (pollResult.status === 'approved' && pollResult.token) {
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieHeader = formatSetCookie(pollResult.token, {
        expiresAt: pollResult.expiresAt,
        isProduction,
      });
      res.setHeader('Set-Cookie', cookieHeader);
    }

    // Mapeamento de status HTTP conforme RFC 8628
    if (pollResult.status === 'slow_down') {
      return res.status(400).json(pollResult);
    }
    if (pollResult.status === 'expired' || pollResult.status === 'consumed') {
      return res.status(400).json(pollResult);
    }
    if (pollResult.status === 'rejected') {
      return res.status(403).json(pollResult);
    }

    return res.status(200).json(pollResult);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao consultar status da vinculação.' });
  }
});

// ============================================================================
// ENDPOINTS DO FLUXO CELULAR / ATIVAÇÃO WEB
// ============================================================================

/**
 * Valida o código curto digitado ou passado via QR Code na página de ativação
 */
deviceAuthRouter.get('/validate', async (req, res) => {
  try {
    const code = (req.query.code as string) || '';
    if (!code) {
      return res.status(400).json({ valid: false, error: 'Código de vinculação obrigatório.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ valid: false, error: 'Serviço temporariamente indisponível.' });
    }

    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    const validation = await validateDeviceUserCode(db, code, clientIp);

    if (!validation.valid) {
      return res.status(400).json(validation);
    }

    return res.status(200).json(validation);
  } catch (err) {
    return res.status(500).json({ valid: false, error: 'Erro ao validar código.' });
  }
});

/**
 * Confirma e aprova a vinculação da Smart TV à conta do usuário autenticado
 * Requer sessão válida e proteção CSRF
 */
deviceAuthRouter.post('/approve', requireCsrfProtection, authenticateUser, async (req, res) => {
  try {
    const { userCode } = req.body || {};
    if (!userCode || typeof userCode !== 'string') {
      return res.status(400).json({ error: 'Código de usuário (userCode) obrigatório.' });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
    }

    const result = await approveDeviceLink(db, userCode, req.user.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao aprovar vinculação do dispositivo.' });
  }
});

/**
 * Recusa explicitamente a solicitação de vinculação
 */
deviceAuthRouter.post('/reject', requireCsrfProtection, async (req, res) => {
  try {
    const { userCode } = req.body || {};
    if (!userCode || typeof userCode !== 'string') {
      return res.status(400).json({ error: 'Código de usuário (userCode) obrigatório.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
    }

    const result = await rejectDeviceLink(db, userCode);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao recusar vinculação.' });
  }
});

// ============================================================================
// GERENCIAMENTO DE DISPOSITIVOS CONECTADOS (CONFIGURAÇÕES)
// ============================================================================

export const linkedDevicesRouter = Router();

/**
 * Lista todos os dispositivos Smart TV vinculados à conta do usuário
 */
linkedDevicesRouter.get('/', authenticateUser, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
    }

    const devices = await listUserLinkedDevices(db, req.user.id, req.sessionId);
    return res.status(200).json({ devices });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar dispositivos conectados.' });
  }
});

/**
 * Desvincula e revoga imediatamente o acesso da TV
 */
linkedDevicesRouter.delete('/:id', requireCsrfProtection, authenticateUser, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }

    const deviceId = req.params.id as string;
    if (!deviceId) {
      return res.status(400).json({ error: 'ID do dispositivo obrigatório.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
    }

    const result = await revokeUserLinkedDevice(db, req.user.id, deviceId);
    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json({ success: true, message: 'Dispositivo desvinculado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao desvincular dispositivo.' });
  }
});
