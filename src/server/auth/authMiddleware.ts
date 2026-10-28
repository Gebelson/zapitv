/**
 * ZAPITV — MIDDLEWARES DE AUTENTICAÇÃO E SEGURANÇA (P3.A)
 * 
 * 1. authenticateUser: Exige sessão ativa e válida.
 * 2. optionalUser: Identifica usuário se logado, permitindo navegação anônima se ausente.
 * 3. requireCsrfProtection: Valida cabeçalhos Origin / Referer contra Host em requisições mutativas.
 */

import express from 'express';
import { getDatabase, ensureAuthTables } from '../database/client';
import { extractCookie, validateSession, SESSION_COOKIE_NAME } from './sessionService';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  status: string;
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

export async function getValidDatabase() {
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
    req.user = sessionData ? sessionData.user : null;
    req.sessionId = sessionData?.sessionId;
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

    req.user = sessionData.user;
    req.sessionId = sessionData.sessionId;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao validar autenticação.' });
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
  }

  next();
}
