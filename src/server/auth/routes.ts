/**
 * ZAPITV — ROTAS DE AUTENTICAÇÃO E CONTAS REAIS (P3.A)
 * 
 * Endpoints:
 * - POST /api/auth/register : Cadastro com validação estrita, normalização e hash Argon2id
 * - POST /api/auth/login    : Autenticação segura, proteção contra força bruta e cookie HttpOnly
 * - POST /api/auth/logout   : Revogação de sessão no banco e limpeza de cookie
 * - GET  /api/auth/me       : Consulta do estado da sessão do usuário atual
 * - GET  /api/auth/user/:id : Rota protegida com isolamento estrito entre usuários
 */

import express from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { getValidDatabase, authenticateUser, optionalUser, requireCsrfProtection, extractSessionToken } from './authMiddleware';
import { users } from '../database/schema';
import { hashPassword, verifyPassword } from './passwordService';
import { createSession, revokeSession, formatSetCookie } from './sessionService';
import { RateLimitService } from './rateLimitService';

export const authRouter = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isProduction = process.env.NODE_ENV === 'production';

// Aplica proteção CSRF nas mutações de autenticação
authRouter.use(requireCsrfProtection);

/**
 * 1. CADASTRO DE NOVO USUÁRIO
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password, passwordConfirm, termsAccepted } = req.body || {};

    // Validação de Nome
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ error: 'O nome deve conter entre 2 e 100 caracteres.' });
    }

    // Validação e normalização de E-mail
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 255) {
      return res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
    }

    // Validação de Senha
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'A senha deve conter no mínimo 8 caracteres.' });
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: 'A senha deve conter pelo menos uma letra e um número.' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'A confirmação de senha não confere.' });
    }

    // Aceitação explícita dos Termos (LGPD)
    if (termsAccepted !== true) {
      return res.status(400).json({ error: 'É necessário concordar com os Termos de Uso e Política de Privacidade.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados de autenticação temporariamente indisponível.' });
    }

    // Prevenção de e-mails duplicados
    const existing = await db.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado na ZapiTV.' });
    }

    // Geração de Hash Argon2id
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const now = Date.now();

    await db.db.insert(users).values({
      id: userId,
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      status: 'active',
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Criação imediata de sessão autenticada pós-cadastro
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const session = await createSession(db, userId, { ipAddress: clientIp, userAgent });

    // Configura Cookie HttpOnly Seguro
    res.setHeader('Set-Cookie', formatSetCookie(session.token, { expiresAt: session.expiresAt, isProduction }));

    return res.status(201).json({
      message: 'Conta criada com sucesso!',
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        status: 'active',
        createdAt: now,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Ocorreu um erro interno ao processar o cadastro.' });
  }
});

/**
 * 2. LOGIN DE USUÁRIO
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Banco de dados de autenticação temporariamente indisponível.' });
    }

    // 1. Verificação de Bloqueio por Força Bruta (persistente e compartilhado via banco de dados)
    const emailLock = await RateLimitService.isLocked(db, cleanEmail);
    const ipLock = await RateLimitService.isLocked(db, clientIp);

    if (emailLock.locked || ipLock.locked) {
      const waitSeconds = Math.max(emailLock.remainingSeconds, ipLock.remainingSeconds);
      return res.status(429).json({
        error: 'Muitas tentativas de login com falha. Por segurança, tente novamente mais tarde.',
        retryAfterSeconds: waitSeconds,
      });
    }

    // 2. Busca de Usuário
    const foundUsers = await db.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (foundUsers.length === 0) {
      // Registra falha e retorna mensagem genérica (impede enumeração de usuários)
      await RateLimitService.recordFailure(db, cleanEmail, clientIp);
      await RateLimitService.recordFailure(db, clientIp, clientIp);
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const user = foundUsers[0];

    // Verifica status da conta
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Esta conta encontra-se suspensa ou desativada.' });
    }

    // 3. Verificação de Senha com Argon2id
    const isPasswordValid = await verifyPassword(user.passwordHash, password);
    if (!isPasswordValid) {
      await RateLimitService.recordFailure(db, cleanEmail, clientIp);
      await RateLimitService.recordFailure(db, clientIp, clientIp);
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // 4. Sucesso: limpa tentativas e gera sessão
    await RateLimitService.recordSuccess(db, cleanEmail, clientIp);
    await RateLimitService.recordSuccess(db, clientIp, clientIp);

    const userAgent = req.headers['user-agent'];
    const session = await createSession(db, user.id, { ipAddress: clientIp, userAgent });

    // Define Cookie HttpOnly
    res.setHeader('Set-Cookie', formatSetCookie(session.token, { expiresAt: session.expiresAt, isProduction }));

    return res.status(200).json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ocorreu um erro interno ao processar o login.' });
  }
});

/**
 * 3. LOGOUT E REVOGAÇÃO DE SESSÃO
 */
authRouter.post('/logout', async (req, res) => {
  try {
    const token = extractSessionToken(req);
    const db = await getValidDatabase();

    if (token && db) {
      await revokeSession(db, token);
    }

    // Limpa o cookie HttpOnly
    res.setHeader('Set-Cookie', formatSetCookie('', { clear: true, isProduction }));

    return res.status(200).json({
      success: true,
      message: 'Sessão encerrada com sucesso.',
    });
  } catch (err) {
    // Mesmo em falha interna, garante limpeza do cookie no cliente
    res.setHeader('Set-Cookie', formatSetCookie('', { clear: true, isProduction }));
    return res.status(200).json({ success: true });
  }
});

/**
 * 4. CONSULTA DO ESTADO DA SESSÃO ATUAL (/me)
 */
authRouter.get('/me', optionalUser, (req, res) => {
  if (req.user) {
    return res.status(200).json({
      authenticated: true,
      user: req.user,
    });
  }

  return res.status(200).json({
    authenticated: false,
    user: null,
  });
});

/**
 * 5. CONSULTA DE DADOS DE USUÁRIO COM ISOLAMENTO DE ACESSO
 */
authRouter.get('/user/:id', authenticateUser, (req, res) => {
  const requestedId = req.params.id;

  // Garantia de isolamento estrito: um usuário só acessa seus próprios dados
  if (req.user?.id !== requestedId) {
    return res.status(403).json({ error: 'Acesso negado aos dados de outro usuário.' });
  }

  return res.status(200).json({ user: req.user });
});
