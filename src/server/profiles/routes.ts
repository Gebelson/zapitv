/**
 * ZAPITV — ROTAS DE MÚLTIPLOS PERFIS (P3.B)
 * 
 * Endpoints:
 * - GET    /api/profiles           : Listagem de perfis da conta
 * - POST   /api/profiles           : Criação de novo perfil (limite configurável)
 * - PUT    /api/profiles/:id       : Edição de perfil (nome/avatar)
 * - DELETE /api/profiles/:id       : Exclusão com confirmação (mínimo 1 perfil)
 * - POST   /api/profiles/:id/select: Seleção do perfil ativo (define cookie zapitv_active_profile)
 * - GET    /api/profiles/active    : Consulta do perfil atualmente ativo
 * - GET    /api/profiles/avatars   : Lista de avatares oficiais disponíveis
 */

import express from 'express';
import { getValidDatabase, authenticateUser, requireCsrfProtection } from '../auth/authMiddleware';
import { extractCookie } from '../auth/sessionService';
import { ProfileService } from './profileService';
import { OFFICIAL_AVATARS } from '../../core/profile/avatarRegistry';

export const profilesRouter = express.Router();

const ACTIVE_PROFILE_COOKIE = 'zapitv_active_profile';
const isProduction = process.env.NODE_ENV === 'production';

// Todas as rotas de perfis exigem usuário autenticado
profilesRouter.use(authenticateUser);

// Aplica blindagem CSRF a mutações
profilesRouter.use(requireCsrfProtection);

function formatActiveProfileCookie(profileId: string, clear: boolean = false): string {
  if (clear) {
    return `${ACTIVE_PROFILE_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`;
  }
  // 30 dias de expiração, alinhado com a sessão
  const maxAge = 30 * 24 * 60 * 60;
  return `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(profileId)}; Path=/; SameSite=Lax; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`;
}

/**
 * 1. LISTAR PERFIS DA CONTA
 */
profilesRouter.get('/', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const userId = req.user!.id;
    const userName = req.user!.name;
    const list = await ProfileService.listProfiles(db, userId, userName);

    return res.status(200).json({ profiles: list });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao carregar perfis.' });
  }
});

/**
 * 2. CONSULTAR PERFIL ATIVO
 */
profilesRouter.get('/active', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const userId = req.user!.id;
    const cookieProfileId = extractCookie(req.headers.cookie, ACTIVE_PROFILE_COOKIE);
    const active = await ProfileService.resolveActiveProfile(db, userId, cookieProfileId);

    if (!active) {
      return res.status(404).json({ error: 'Nenhum perfil encontrado para esta conta.' });
    }

    return res.status(200).json({ profile: active });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao identificar perfil ativo.' });
  }
});

/**
 * 3. BIBLIOTECA DE AVATARES DISPONÍVEIS
 */
profilesRouter.get('/avatars', (_req, res) => {
  return res.status(200).json({
    avatars: OFFICIAL_AVATARS.map((a) => ({
      id: a.id,
      name: a.name,
      primaryColor: a.primaryColor,
      secondaryColor: a.secondaryColor,
      gradient: a.gradient,
      dataUri: a.dataUri,
    })),
  });
});

/**
 * 4. CRIAR NOVO PERFIL
 */
profilesRouter.post('/', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const userId = req.user!.id;
    const { name, avatarId } = req.body || {};

    const created = await ProfileService.createProfile(db, userId, { name, avatarId });

    return res.status(201).json({
      message: 'Perfil criado com sucesso!',
      profile: created,
    });
  } catch (err: any) {
    const status = err?.message?.includes('Limite máximo') || err?.message?.includes('caracteres') || err?.message?.includes('inválido') ? 400 : 500;
    return res.status(status).json({ error: err?.message || 'Erro ao criar perfil.' });
  }
});

/**
 * 5. SELECIONAR PERFIL ATIVO
 */
profilesRouter.post('/:id/select', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const userId = req.user!.id;
    const profileId = req.params.id;

    const profile = await ProfileService.getProfileById(db, userId, profileId);
    if (!profile) {
      return res.status(403).json({ error: 'Perfil não encontrado ou não pertence a esta conta.' });
    }

    // Persiste seleção no cookie seguro
    res.setHeader('Set-Cookie', formatActiveProfileCookie(profile.id));

    return res.status(200).json({
      message: 'Perfil ativado com sucesso!',
      profile,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao selecionar perfil.' });
  }
});

/**
 * 6. EDITAR PERFIL
 */
profilesRouter.put('/:id', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const userId = req.user!.id;
    const profileId = req.params.id;
    const { name, avatarId } = req.body || {};

    const updated = await ProfileService.updateProfile(db, userId, profileId, { name, avatarId });

    return res.status(200).json({
      message: 'Perfil atualizado com sucesso!',
      profile: updated,
    });
  } catch (err: any) {
    const msg = err?.message || '';
    const status = msg.includes('não pertence') ? 403 : msg.includes('caracteres') || msg.includes('inválido') ? 400 : 500;
    return res.status(status).json({ error: msg || 'Erro ao atualizar perfil.' });
  }
});

/**
 * 7. EXCLUIR PERFIL
 */
profilesRouter.delete('/:id', async (req, res) => {
  try {
    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
    }

    const userId = req.user!.id;
    const profileId = req.params.id;

    const result = await ProfileService.deleteProfile(db, userId, profileId);

    // Se o perfil excluído era o perfil que estava no cookie, atualiza para o próximo
    const currentActiveCookie = extractCookie(req.headers.cookie, ACTIVE_PROFILE_COOKIE);
    if (currentActiveCookie === profileId) {
      res.setHeader('Set-Cookie', formatActiveProfileCookie(result.nextActiveProfileId));
    }

    return res.status(200).json({
      message: 'Perfil excluído com sucesso.',
      success: true,
      nextActiveProfileId: result.nextActiveProfileId,
    });
  } catch (err: any) {
    const msg = err?.message || '';
    const status = msg.includes('não pertence') ? 403 : msg.includes('único perfil') ? 400 : 500;
    return res.status(status).json({ error: msg || 'Erro ao excluir perfil.' });
  }
});
