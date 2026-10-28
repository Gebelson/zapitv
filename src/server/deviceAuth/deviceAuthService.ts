/**
 * ZAPITV — SERVIÇO DE VINCULAÇÃO DE SMART TVS POR QR CODE (P3.C)
 * 
 * Adaptação segura da RFC 8628 (OAuth 2.0 Device Authorization Grant).
 * 
 * - Device Code: 256 bits criptográficos, armazenado exclusivamente como SHA-256 no banco.
 * - User Code: Código alfanumérico curto legível (sem 0/O ou 1/I), com máscara visual XXXX-XXXX.
 * - Expiração padrão: 10 minutos (600 segundos).
 * - Intervalo de polling: mínimo 5s, com desaceleração (slow_down) para 10s se consultado em excesso.
 * - Sessão independente: TV recebe sessão própria revogável, desvinculada dos cookies do celular.
 */

import crypto from 'crypto';
import { eq, and, isNull, gt, sql } from 'drizzle-orm';
import { Database } from '../database/client';
import { deviceLinkChallenges, linkedDevices, sessions, users } from '../database/schema';
import { createSession } from '../auth/sessionService';
import { RateLimitService } from '../auth/rateLimitService';

export const CHALLENGE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutos
export const DEFAULT_POLL_INTERVAL_SEC = 5;
export const SLOW_DOWN_INTERVAL_SEC = 10;
export const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXYZ23456789'; // Sem caracteres ambíguos (0, O, 1, I)

// Rate limiting persistido no banco + memória via RateLimitService (anti-força-bruta cross-instance)
export async function checkValidationRateLimit(db: Database | null, ip: string): Promise<boolean> {
  const identifier = `code_val:${ip}`;
  const status = await RateLimitService.isLocked(db, identifier);
  return !status.locked;
}

export async function recordFailedValidationAttempt(db: Database | null, ip: string): Promise<void> {
  const identifier = `code_val:${ip}`;
  await RateLimitService.recordFailure(db, identifier, ip);
}

export async function clearValidationAttempts(db: Database | null, ip: string): Promise<void> {
  const identifier = `code_val:${ip}`;
  await RateLimitService.recordSuccess(db, identifier, ip);
}

export function hashDeviceCode(deviceCode: string): string {
  return crypto.createHash('sha256').update(deviceCode).digest('hex');
}

export function generateDeviceCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateUserCode(): string {
  // 8 caracteres criptograficamente aleatórios da base restrita
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
  }
  // Formato XXXX-XXXX para facilidade de leitura e digitação
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeUserCode(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatUserCodeDisplay(normalized: string): string {
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}

export function detectDeviceFromUserAgent(userAgent?: string): { deviceName: string; deviceType: string } {
  if (!userAgent) {
    return { deviceName: 'Smart TV', deviceType: 'smart_tv' };
  }

  const ua = userAgent.toLowerCase();

  if (ua.includes('silk') || ua.includes('aft') || ua.includes('firetv')) {
    return { deviceName: 'Amazon Fire TV', deviceType: 'firetv' };
  }
  if (ua.includes('tizen') || ua.includes('samsungbrowser')) {
    return { deviceName: 'Samsung Smart TV', deviceType: 'tizen' };
  }
  if (ua.includes('webos') || ua.includes('web0s') || ua.includes('netcast')) {
    return { deviceName: 'LG Smart TV', deviceType: 'webos' };
  }
  if (ua.includes('msx') || ua.includes('mediastationx')) {
    return { deviceName: 'Media Station X', deviceType: 'msx' };
  }
  if (ua.includes('smarttv') || ua.includes('hbbtv') || ua.includes('appletv') || ua.includes('roku')) {
    return { deviceName: 'Smart TV', deviceType: 'smart_tv' };
  }

  return { deviceName: 'Smart TV', deviceType: 'smart_tv' };
}

export function getPublicBaseUrl(req?: { headers?: Record<string, any>; protocol?: string }): string {
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Origem pública oficial configurada explicitamente no servidor (prioridade absoluta sobre VERCEL_URL)
  const envUrl = process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl && envUrl.trim()) {
    let parsed: URL;
    try {
      parsed = new URL(envUrl.trim());
    } catch {
      throw new Error('Variável APP_URL contém uma URL inválida.');
    }

    if (isProduction && parsed.protocol !== 'https:') {
      throw new Error('Origem de produção em APP_URL deve utilizar obrigatoriamente HTTPS.');
    }

    return parsed.origin;
  }

  // 2. Validação estrita de cabeçalhos Host / X-Forwarded-Host contra injeção e envenenamento
  const rawHostHeader = (req?.headers?.['x-forwarded-host'] as string) || req?.headers?.host;
  if (rawHostHeader && typeof rawHostHeader === 'string' && rawHostHeader.trim()) {
    const cleanHost = rawHostHeader.split(',')[0].trim();
    const hostname = cleanHost.replace(/:\d+$/, '').toLowerCase();

    // Whitelist de validação de domínios permitidos:
    const isLocalDevHost = !isProduction && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local'));
    const isVercelApp = /^[a-z0-9][a-z0-9-_]*\.vercel\.app$/i.test(hostname);
    const vercelEnvHost = process.env.VERCEL_URL ? process.env.VERCEL_URL.trim().replace(/:\d+$/, '').toLowerCase() : null;
    const isVercelEnvMatch = Boolean(vercelEnvHost && hostname === vercelEnvHost);
    const isOfficialDomain = hostname === 'zapitv.vercel.app';

    if (isLocalDevHost) {
      const proto = (req?.headers?.['x-forwarded-proto'] as string) || req?.protocol || 'http';
      return `${proto}://${cleanHost}`.replace(/\/+$/, '');
    }

    if (isVercelApp || isVercelEnvMatch || isOfficialDomain) {
      // Fora de desenvolvimento local, exige obrigatoriamente HTTPS
      return `https://${cleanHost}`.replace(/\/+$/, '');
    }

    // Host arbitrário ou malicioso detectado: bloqueia geração com erro seguro
    throw new Error(`Origem ou host não autorizado para geração de QR Code: ${hostname}`);
  }

  // 3. Fallback para domínio do deployment atual na Vercel (Preview / Branch Deployment)
  if (process.env.VERCEL_URL && process.env.VERCEL_URL.trim()) {
    const rawVercel = process.env.VERCEL_URL.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const vHostname = rawVercel.replace(/:\d+$/, '').toLowerCase();
    if (/^[a-z0-9][a-z0-9-_]*\.vercel\.app$/i.test(vHostname) || vHostname === 'zapitv.vercel.app') {
      return `https://${rawVercel}`;
    }
  }

  // 4. Fallback padrão seguro para o domínio oficial de produção
  return 'https://zapitv.vercel.app';
}

export interface CreateChallengeResult {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
  deviceName: string;
  deviceType: string;
}

export async function createDeviceLinkChallenge(
  db: Database,
  options: { userAgent?: string; clientIp?: string; baseUrl?: string }
): Promise<CreateChallengeResult> {
  const deviceCode = generateDeviceCode();
  const deviceCodeHash = hashDeviceCode(deviceCode);
  const userCode = generateUserCode();
  const { deviceName, deviceType } = detectDeviceFromUserAgent(options.userAgent);

  const now = Date.now();
  const expiresAt = now + CHALLENGE_EXPIRY_MS;
  const challengeId = crypto.randomUUID();

  await db.db.insert(deviceLinkChallenges).values({
    id: challengeId,
    deviceCodeHash,
    userCode,
    status: 'pending',
    userId: null,
    deviceName,
    deviceType,
    clientIp: options.clientIp?.slice(0, 45) || null,
    userAgent: options.userAgent?.slice(0, 255) || null,
    pollCount: 0,
    lastPolledAt: null,
    expiresAt,
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    consumedAt: null,
  });

  const baseUrl = options.baseUrl || 'https://zapitv.vercel.app';
  const verificationUrl = `${baseUrl}/tv/ativar?code=${userCode}`;

  return {
    deviceCode,
    userCode,
    verificationUrl,
    expiresIn: Math.floor(CHALLENGE_EXPIRY_MS / 1000),
    interval: DEFAULT_POLL_INTERVAL_SEC,
    deviceName,
    deviceType,
  };
}

export type PollStatus = 'pending' | 'slow_down' | 'approved' | 'rejected' | 'expired' | 'consumed';

export interface PollResult {
  status: PollStatus;
  interval?: number;
  error?: string;
  cookieToken?: string; // Utilizado internamente pelo servidor para Set-Cookie HttpOnly; NUNCA no JSON
  expiresAt?: number;
  sessionId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export async function pollDeviceLinkChallenge(
  db: Database,
  deviceCode: string,
  options?: { clientIp?: string; userAgent?: string }
): Promise<PollResult> {
  if (!deviceCode || typeof deviceCode !== 'string' || deviceCode.length < 32) {
    return { status: 'expired', error: 'invalid_grant' };
  }

  const deviceCodeHash = hashDeviceCode(deviceCode);
  const now = Date.now();

  const found = await db.db
    .select()
    .from(deviceLinkChallenges)
    .where(eq(deviceLinkChallenges.deviceCodeHash, deviceCodeHash))
    .limit(1);

  if (!found || found.length === 0) {
    return { status: 'expired', error: 'invalid_grant' };
  }

  const challenge = found[0];

  // Desafio já consumido previamente (uso único garantido)
  if (challenge.status === 'consumed') {
    return { status: 'consumed', error: 'invalid_grant' };
  }

  // Desafio expirado
  if (challenge.status === 'expired' || challenge.expiresAt < now) {
    if (challenge.status !== 'expired') {
      await db.db
        .update(deviceLinkChallenges)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(deviceLinkChallenges.id, challenge.id));
    }
    return { status: 'expired', error: 'expired_token' };
  }

  // Desafio recusado pelo usuário
  if (challenge.status === 'rejected') {
    return { status: 'rejected', error: 'access_denied' };
  }

  // Controle de frequência de polling (slow_down se polling muito agressivo < 4 segundos)
  if (challenge.lastPolledAt && now - challenge.lastPolledAt < 4000) {
    await db.db
      .update(deviceLinkChallenges)
      .set({
        pollCount: challenge.pollCount + 1,
        lastPolledAt: now,
        updatedAt: now,
      })
      .where(eq(deviceLinkChallenges.id, challenge.id));
    return { status: 'slow_down', error: 'slow_down', interval: SLOW_DOWN_INTERVAL_SEC };
  }

  // Atualiza lastPolledAt e pollCount
  await db.db
    .update(deviceLinkChallenges)
    .set({
      pollCount: challenge.pollCount + 1,
      lastPolledAt: now,
      updatedAt: now,
    })
    .where(eq(deviceLinkChallenges.id, challenge.id));

  // Desafio ainda pendente de autorização
  if (challenge.status === 'pending') {
    return { status: 'pending', interval: DEFAULT_POLL_INTERVAL_SEC };
  }

  // Desafio aprovado: transiciona para consumed e emite sessão exclusiva para a Smart TV
  if (challenge.status === 'approved' && challenge.userId) {
    // Transição atômica para evitar race conditions em polling simultâneo
    const updateResult = await db.db
      .update(deviceLinkChallenges)
      .set({
        status: 'consumed',
        consumedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(deviceLinkChallenges.id, challenge.id),
          eq(deviceLinkChallenges.status, 'approved')
        )
      );

    // Se nenhuma linha foi alterada, outro consumidor já finalizou
    // (Verificação de idempotência / proteção de concorrência)
    const refreshed = await db.db
      .select()
      .from(deviceLinkChallenges)
      .where(eq(deviceLinkChallenges.id, challenge.id))
      .limit(1);

    if (!refreshed || refreshed[0].status !== 'consumed' || refreshed[0].consumedAt !== now) {
      // Já foi consumido em outra requisição simultânea
      return { status: 'consumed', error: 'invalid_grant' };
    }

    // Busca dados do usuário vinculado
    const userRows = await db.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, challenge.userId))
      .limit(1);

    if (!userRows || userRows.length === 0 || userRows[0].status !== 'active') {
      return { status: 'rejected', error: 'access_denied' };
    }

    const linkedUser = userRows[0];

    // Cria uma sessão NOVA e INDEPENDENTE exclusivamente para a Smart TV
    const newSession = await createSession(db, linkedUser.id, {
      ipAddress: options?.clientIp || challenge.clientIp || undefined,
      userAgent: options?.userAgent || challenge.userAgent || undefined,
    });

    // Registra a TV em linked_devices
    const linkedDeviceId = crypto.randomUUID();
    await db.db.insert(linkedDevices).values({
      id: linkedDeviceId,
      userId: linkedUser.id,
      sessionId: newSession.sessionId,
      deviceName: challenge.deviceName,
      deviceType: challenge.deviceType,
      clientIp: options?.clientIp || challenge.clientIp || null,
      userAgent: options?.userAgent || challenge.userAgent || null,
      lastActiveAt: now,
      createdAt: now,
      revokedAt: null,
    });

    return {
      status: 'approved',
      cookieToken: newSession.token,
      expiresAt: newSession.expiresAt,
      sessionId: newSession.sessionId,
      user: {
        id: linkedUser.id,
        name: linkedUser.name,
        email: linkedUser.email,
      },
    };
  }

  return { status: 'pending', interval: DEFAULT_POLL_INTERVAL_SEC };
}

export async function validateDeviceUserCode(
  db: Database,
  rawUserCode: string,
  clientIp?: string
): Promise<{
  valid: boolean;
  error?: string;
  challenge?: {
    userCode: string;
    deviceName: string;
    deviceType: string;
    expiresAt: number;
    createdAt: number;
  };
}> {
  if (clientIp) {
    const isAllowed = await checkValidationRateLimit(db, clientIp);
    if (!isAllowed) {
      return {
        valid: false,
        error: 'Muitas tentativas inválidas. Aguarde alguns minutos antes de tentar novamente.',
      };
    }
  }

  const cleanCode = normalizeUserCode(rawUserCode);
  if (!cleanCode || cleanCode.length < 6) {
    if (clientIp) await recordFailedValidationAttempt(db, clientIp);
    return { valid: false, error: 'Código inválido. Digite os 8 caracteres exibidos na TV.' };
  }

  const formatted = formatUserCodeDisplay(cleanCode);
  const now = Date.now();

  const found = await db.db
    .select()
    .from(deviceLinkChallenges)
    .where(
      and(
        sql`REPLACE(${deviceLinkChallenges.userCode}, '-', '') = ${cleanCode}`,
        gt(deviceLinkChallenges.expiresAt, now),
        eq(deviceLinkChallenges.status, 'pending')
      )
    )
    .limit(1);

  if (!found || found.length === 0) {
    if (clientIp) await recordFailedValidationAttempt(db, clientIp);
    return { valid: false, error: 'Código não encontrado ou já expirado. Gere um novo código na TV.' };
  }

  const challenge = found[0];
  if (clientIp) await clearValidationAttempts(db, clientIp);

  return {
    valid: true,
    challenge: {
      userCode: challenge.userCode,
      deviceName: challenge.deviceName,
      deviceType: challenge.deviceType,
      expiresAt: challenge.expiresAt,
      createdAt: challenge.createdAt,
    },
  };
}

export async function approveDeviceLink(
  db: Database,
  rawUserCode: string,
  userId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!userId) {
    return { success: false, error: 'Autenticação necessária.' };
  }

  const cleanCode = normalizeUserCode(rawUserCode);
  if (!cleanCode) {
    return { success: false, error: 'Código de vinculação inválido.' };
  }

  const now = Date.now();

  // Busca desafio pendente
  const found = await db.db
    .select()
    .from(deviceLinkChallenges)
    .where(
      and(
        sql`REPLACE(${deviceLinkChallenges.userCode}, '-', '') = ${cleanCode}`,
        gt(deviceLinkChallenges.expiresAt, now),
        eq(deviceLinkChallenges.status, 'pending')
      )
    )
    .limit(1);

  if (!found || found.length === 0) {
    return { success: false, error: 'Desafio inválido, expirado ou já processado.' };
  }

  const challenge = found[0];

  // Aprova o desafio atomicamente
  await db.db
    .update(deviceLinkChallenges)
    .set({
      status: 'approved',
      userId,
      approvedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(deviceLinkChallenges.id, challenge.id),
        eq(deviceLinkChallenges.status, 'pending')
      )
    );

  return { success: true, message: 'Dispositivo autorizado com sucesso!' };
}

export async function rejectDeviceLink(
  db: Database,
  rawUserCode: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const cleanCode = normalizeUserCode(rawUserCode);
  if (!cleanCode) {
    return { success: false, error: 'Código inválido.' };
  }

  const now = Date.now();

  const found = await db.db
    .select()
    .from(deviceLinkChallenges)
    .where(
      and(
        sql`REPLACE(${deviceLinkChallenges.userCode}, '-', '') = ${cleanCode}`,
        eq(deviceLinkChallenges.status, 'pending')
      )
    )
    .limit(1);

  if (found && found.length > 0) {
    await db.db
      .update(deviceLinkChallenges)
      .set({
        status: 'rejected',
        updatedAt: now,
      })
      .where(eq(deviceLinkChallenges.id, found[0].id));
  }

  return { success: true, message: 'Vinculação recusada.' };
}

export interface LinkedDeviceView {
  id: string;
  deviceName: string;
  deviceType: string;
  clientIp?: string | null;
  userAgent?: string | null;
  lastActiveAt: number;
  createdAt: number;
  isCurrentSession?: boolean;
}

export async function listUserLinkedDevices(
  db: Database,
  userId: string,
  currentSessionId?: string
): Promise<LinkedDeviceView[]> {
  const rows = await db.db
    .select({
      id: linkedDevices.id,
      sessionId: linkedDevices.sessionId,
      deviceName: linkedDevices.deviceName,
      deviceType: linkedDevices.deviceType,
      clientIp: linkedDevices.clientIp,
      userAgent: linkedDevices.userAgent,
      lastActiveAt: linkedDevices.lastActiveAt,
      createdAt: linkedDevices.createdAt,
    })
    .from(linkedDevices)
    .where(
      and(
        eq(linkedDevices.userId, userId),
        isNull(linkedDevices.revokedAt)
      )
    )
    .orderBy(sql`${linkedDevices.lastActiveAt} DESC`);

  return rows.map((r) => ({
    id: r.id,
    deviceName: r.deviceName,
    deviceType: r.deviceType,
    clientIp: r.clientIp,
    userAgent: r.userAgent,
    lastActiveAt: r.lastActiveAt,
    createdAt: r.createdAt,
    isCurrentSession: Boolean(currentSessionId && r.sessionId === currentSessionId),
  }));
}

export async function revokeUserLinkedDevice(
  db: Database,
  userId: string,
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  const found = await db.db
    .select()
    .from(linkedDevices)
    .where(
      and(
        eq(linkedDevices.id, deviceId),
        eq(linkedDevices.userId, userId),
        isNull(linkedDevices.revokedAt)
      )
    )
    .limit(1);

  if (!found || found.length === 0) {
    return { success: false, error: 'Dispositivo não encontrado ou já desvinculado.' };
  }

  const device = found[0];
  const now = Date.now();

  // 1. Marca dispositivo como revogado
  await db.db
    .update(linkedDevices)
    .set({ revokedAt: now })
    .where(eq(linkedDevices.id, device.id));

  // 2. Revoga imediatamente a sessão da Smart TV
  await db.db
    .update(sessions)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(sessions.id, device.sessionId), isNull(sessions.revokedAt)));

  return { success: true };
}
