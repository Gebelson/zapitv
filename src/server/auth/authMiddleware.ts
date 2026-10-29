/**
 * ZAPITV — MIDDLEWARES DE AUTENTICAÇÃO E SEGURANÇA (P3.A)
 * 
 * 1. authenticateUser: Exige sessão ativa e válida.
 * 2. optionalUser: Identifica usuário se logado, permitindo navegação anônima se ausente.
 * 3. requireAdmin: Exige conta autenticada com permissão administrativa (role: admin).
 * 4. requireCsrfProtection: Valida cabeçalhos Origin / Referer contra Host em requisições mutativas.
 */

import express from 'express';
import { getDatabase, ensureAuthTables, type Database } from '../database/client';
import { extractCookie, validateSession, SESSION_COOKIE_NAME } from './sessionService';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  status: string;
  role: 'admin' | 'user';
  createdAt: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
      sessionId?: string;
    }
  }
}

let authTablesEnsured = false;
let testDatabaseInstance: Database | null = null;

export function setTestDatabase(db: Database | null) {
  testDatabaseInstance = db;
}

export async function getValidDatabase() {
  if (testDatabaseInstance) {
    return testDatabaseInstance;
  }
  const db = getDatabase();
  if (db && !authTablesEnsured) {
    try {
      await ensureAuthTables(db);
      authTablesEnsured = true;
    } catch {
      // Ignora erro se tabelas já existem
    }
  }
  return db;
}

/**
 * Validação centralizada e determinística de permissão administrativa
 */
export function isUserAdmin(user: { id?: string; email?: string } | null | undefined): boolean {
  if (!user) return false;
  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS || 'graficadfuturo@gmail.com')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
  );
  const adminUids = new Set(
    (process.env.ADMIN_FIREBASE_UIDS || '')
      .split(',')
      .map(u => u.trim())
      .filter(Boolean)
  );

  const email = (user.email || '').trim().toLowerCase();
  const id = (user.id || '').trim();

  return (email !== '' && adminEmails.has(email)) || (id !== '' && adminUids.has(id));
}

export function extractSessionToken(req: express.Request): string | null {
  // 1. Prioriza Cookie HttpOnly
  const cookieHeader = req.headers.cookie;
  const fromCookie = extractCookie(cookieHeader, SESSION_COOKIE_NAME);
  if (fromCookie) return fromCookie;

  // 2. Alternativa por cabeçalho Authorization: Bearer <token> (compatibilidade API/mobile)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function optionalUser(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
) {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    const db = await getValidDatabase();
    if (!db) {
      req.user = null;
      return next();
    }

    const sessionData = await validateSession(db, token);
    if (sessionData) {
      req.user = {
        ...sessionData.user,
        role: isUserAdmin(sessionData.user) ? 'admin' : 'user',
      };
      req.sessionId = sessionData.sessionId;
    } else {
      req.user = null;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

export async function authenticateUser(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Autenticação necessária. Faça login para continuar.' });
    }

    const db = await getValidDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Serviço de autenticação temporariamente indisponível.' });
    }

    const sessionData = await validateSession(db, token);
    if (!sessionData) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    req.user = {
      ...sessionData.user,
      role: isUserAdmin(sessionData.user) ? 'admin' : 'user',
    };
    req.sessionId = sessionData.sessionId;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao validar autenticação.' });
  }
}

/**
 * Middleware de autorização estrita para endpoints administrativos
 * Retorna HTTP 403 para usuários comuns ou anônimos, sem expor dados internos.
 */
export async function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // 1. Verificação via Cookie de Sessão HttpOnly ou Bearer Session Token
    const token = extractSessionToken(req);
    if (token) {
      const db = await getValidDatabase();
      if (db) {
        const sessionData = await validateSession(db, token);
        if (sessionData && isUserAdmin(sessionData.user)) {
          req.user = {
            ...sessionData.user,
            role: 'admin',
          };
          req.sessionId = sessionData.sessionId;
          res.locals.actorUid = sessionData.user.email || sessionData.user.id || 'admin';
          return next();
        }
      }
    }

    // 2. Verificação complementar via Firebase ID Token (manutenção / scripts legados)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const { authenticateAdmin } = await import('../database/firebaseAuth');
        const actorUid = await authenticateAdmin(authHeader);
        if (actorUid) {
          req.user = {
            id: actorUid,
            name: 'Admin Firebase',
            email: '',
            status: 'active',
            role: 'admin',
            createdAt: Date.now(),
          };
          res.locals.actorUid = actorUid;
          return next();
        }
      } catch {}
    }

    return res.status(403).json({ error: 'Acesso negado. Apenas administradores autorizados.' });
  } catch {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores autorizados.' });
  }
}

/**
 * Blindagem CSRF para requisições de formulário e mutações com cookies
 */
export function requireCsrfProtection(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  // Apenas métodos de mutação necessitam de verificação de origem
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const hasCookie = Boolean(req.headers.cookie);

  const sourceUrl = origin || referer;

  if (sourceUrl && host) {
    try {
      const sourceHost = new URL(sourceUrl).host;
      if (sourceHost !== host) {
        return res.status(403).json({ error: 'Origem da requisição não autorizada (CSRF bloqueado).' });
      }
    } catch {
      return res.status(403).json({ error: 'Origem inválida detectada.' });
    }
  } else if (!sourceUrl && hasCookie && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Origem da requisição não confiável (CSRF bloqueado).' });
  }

  next();
}
