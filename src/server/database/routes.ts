import { Router } from 'express';
import { getDatabase } from './client';
import { authenticateAdmin } from './firebaseAuth';
import { readSetting, SettingVersionConflict, writeSetting } from './settings';
import { issueSourceTicket, listRememberedSources, recordSourceEvidence, validSourceDescriptor, validSourceIdentity } from './sourceMemory';

export const databaseRouter = Router();
const HERO_KEY = 'hero_carousel';
const sourceTicketRates = new Map<string, { count: number; until: number }>();

databaseRouter.get('/source-memory', async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=20');
  const identity = {
    canonicalId: req.query.canonicalId,
    mediaType: req.query.mediaType,
    season: Number(req.query.season),
    episode: Number(req.query.episode),
  };
  if (!validSourceIdentity(identity)) return res.status(400).json({ error: 'Identidade inválida.' });
  const connection = getDatabase();
  if (!connection) return res.json({ sources: [] });
  try { return res.json({ sources: await listRememberedSources(connection, identity) }); }
  catch { return res.status(503).json({ error: 'Memória temporariamente indisponível.' }); }
});

databaseRouter.post('/source-memory/tickets', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!validSourceDescriptor(req.body)) return res.status(400).json({ error: 'Fonte inválida.' });
  const rateKey = `${req.body.canonicalId}|${req.body.providerId}|${req.body.sourceRef}`;
  const now = Date.now();
  const rate = sourceTicketRates.get(rateKey);
  if (rate && rate.until > now && rate.count >= 60) return res.status(429).json({ error: 'Limite temporário de telemetria.' });
  sourceTicketRates.set(rateKey, rate && rate.until > now
    ? { count: rate.count + 1, until: rate.until }
    : { count: 1, until: now + 60_000 });
  if (sourceTicketRates.size > 2_000) {
    for (const [key, entry] of sourceTicketRates) if (entry.until <= now) sourceTicketRates.delete(key);
  }
  const connection = getDatabase();
  if (!connection) return res.status(503).json({ error: 'Banco indisponível.' });
  try { return res.json({ ticket: await issueSourceTicket(connection, req.body) }); }
  catch { return res.status(503).json({ error: 'Não foi possível registrar a tentativa.' }); }
});

databaseRouter.post('/source-memory/evidence', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { ticket, outcome, startupMs, audioLanguage, quality } = req.body || {};
  if (typeof ticket !== 'string' || ticket.length !== 36 ||
      !['success', 'startup_failure', 'playback_failure'].includes(outcome) ||
      JSON.stringify(req.body).length > 1000) return res.status(400).json({ error: 'Evidência inválida.' });
  const connection = getDatabase();
  if (!connection) return res.status(503).json({ error: 'Banco indisponível.' });
  try {
    const result = await recordSourceEvidence(connection, ticket, outcome, { startupMs, audioLanguage, quality });
    return result === 'recorded' ? res.json({ recorded: true }) : res.status(409).json({ error: 'Evidência expirada ou já registrada.' });
  } catch { return res.status(503).json({ error: 'Não foi possível registrar a evidência.' }); }
});

databaseRouter.get('/global-settings/hero-carousel', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const connection = getDatabase();
  if (!connection) return res.json({ configured: false, items: null, version: 0 });
  try {
    const setting = await readSetting(connection, HERO_KEY);
    return res.json({ configured: true, items: setting?.value ?? null, version: setting?.version ?? 0 });
  } catch {
    return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
  }
});

databaseRouter.put('/global-settings/hero-carousel', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const connection = getDatabase();
  if (!connection) return res.status(503).json({ error: 'Banco de dados não configurado.' });

  let actorUid: string | null;
  try {
    actorUid = await authenticateAdmin(req.header('authorization'));
  } catch {
    return res.status(503).json({ error: 'Verificação de autenticação temporariamente indisponível.' });
  }
  if (!actorUid) return res.status(403).json({ error: 'Autenticação administrativa necessária.' });

  const { items, expectedVersion } = req.body || {};
  if (!Array.isArray(items) || items.length < 1 || items.length > 100 ||
      !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
      items.some(item => !item || typeof item.id !== 'string' || !item.id.trim() ||
        typeof item.title !== 'string' || !item.title.trim() || typeof item.type !== 'string') ||
      new Set(items.map(item => item.id)).size !== items.length ||
      JSON.stringify(items).length > 100_000) {
    return res.status(400).json({ error: 'Carrossel inválido.' });
  }

  try {
    const saved = await writeSetting(connection, HERO_KEY, items, expectedVersion, actorUid);
    return res.json({ items: saved.value, version: saved.version });
  } catch (error) {
    if (error instanceof SettingVersionConflict) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(503).json({ error: 'Não foi possível salvar no banco. Tente novamente.' });
  }
});

databaseRouter.get('/global-settings/section-titles', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const connection = getDatabase();
  if (!connection) return res.json({ configured: false, titles: null, version: 0 });
  try {
    const setting = await readSetting(connection, 'section_titles');
    return res.json({ configured: true, titles: setting?.value ?? null, version: setting?.version ?? 0 });
  } catch {
    return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.' });
  }
});

databaseRouter.put('/global-settings/section-titles', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const connection = getDatabase();
  if (!connection) return res.status(503).json({ error: 'Banco de dados não configurado.' });
  let actorUid: string | null;
  try {
    actorUid = await authenticateAdmin(req.header('authorization'));
  } catch {
    return res.status(503).json({ error: 'Verificação de autenticação temporariamente indisponível.' });
  }
  if (!actorUid) return res.status(403).json({ error: 'Autenticação administrativa necessária.' });

  const { titles, expectedVersion } = req.body || {};
  const keys = ['premium', 'recent', 'netflix', 'prime', 'hbo'];
  if (!titles || typeof titles !== 'object' || Array.isArray(titles) ||
      !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
      Object.keys(titles).length !== keys.length ||
      keys.some(key => typeof titles[key] !== 'string' || !titles[key].trim() || titles[key].length > 100)) {
    return res.status(400).json({ error: 'Títulos de seção inválidos.' });
  }
  try {
    const saved = await writeSetting(connection, 'section_titles', titles, expectedVersion, actorUid);
    return res.json({ titles: saved.value, version: saved.version });
  } catch (error) {
    if (error instanceof SettingVersionConflict) return res.status(409).json({ error: error.message });
    return res.status(503).json({ error: 'Não foi possível salvar no banco. Tente novamente.' });
  }
});
