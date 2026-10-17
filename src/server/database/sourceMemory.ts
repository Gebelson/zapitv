import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import type { Database } from './client';
import { sourceEvidenceTickets, sourceReliability } from './schema';

export type SourceIdentity = { canonicalId: string; mediaType: 'movie' | 'series' | 'anime'; season: number; episode: number };
export type SourceDescriptor = SourceIdentity & { providerId: string; sourceRef: string; format: string };
export type SourceOutcome = 'success' | 'startup_failure' | 'playback_failure';

const permittedProviders = new Set([
  'zapitv-show-subtitle-pt-br', 'zapitv-mico-leao-dublado', 'froststream-http',
  'fenixflix-animes', 'torrentio-brazuca', 'torrentio-global', 'magnetflix-animes',
  'zapitv-cinema-aberto', 'zapitv-public-domain', 'stremio-public-domain-web',
  'zapitv-verified', 'zapitv-series', 'zapitv-catalog',
]);

export function validSourceIdentity(value: any): value is SourceIdentity {
  if (!value || !['movie', 'series', 'anime'].includes(value.mediaType) ||
      !Number.isInteger(value.season) || !Number.isInteger(value.episode) ||
      value.season < 0 || value.season > 99 || value.episode < 0 || value.episode > 999 ||
      typeof value.canonicalId !== 'string' || value.canonicalId.length > 160) return false;
  const match = value.canonicalId.match(/^(movie|series|anime):(imdb|tmdb|anilist|local):([a-z0-9._-]+)(?::s(\d{2,3}):e(\d{2,3}))?$/);
  if (!match || match[1] !== value.mediaType) return false;
  if (match[4] || match[5]) return Number(match[4]) === value.season && Number(match[5]) === value.episode;
  return value.season === 0 && value.episode === 0;
}

export function validSourceDescriptor(value: any): value is SourceDescriptor {
  if (!validSourceIdentity(value)) return false;
  const descriptor = value as SourceDescriptor;
  return permittedProviders.has(descriptor.providerId) &&
    typeof descriptor.sourceRef === 'string' && descriptor.sourceRef.length >= 4 && descriptor.sourceRef.length <= 450 &&
    descriptor.sourceRef.split('|').length === 4 && !/https?:\/\/|(?:token|auth|signature)\s*[:=]/i.test(descriptor.sourceRef) &&
    ['hls', 'mp4', 'dash', 'webm'].includes(descriptor.format);
}

export function reliabilityScore(row: typeof sourceReliability.$inferSelect, now = Date.now()): number {
  if (row.successes < 1 || row.expiresAt <= now || !row.lastSuccessAt) return 0;
  const failures = row.startupFailures + row.playbackFailures * 1.5;
  const successRate = row.successes / (row.successes + failures + 2);
  const ageDays = Math.max(0, now - row.lastSuccessAt) / 86_400_000;
  const freshness = Math.pow(0.5, ageDays / 7);
  const progressiveTrust = Math.min(1, 0.25 + row.successes * 0.075);
  const recentFailurePenalty = row.lastFailureAt && now - row.lastFailureAt < 86_400_000 ? 0.45 : 1;
  const speed = row.averageStartupMs ? Math.max(0, 12 - row.averageStartupMs / 1000) : 0;
  const language = row.audioLanguage === 'pt-BR' ? 12 : 0;
  const quality = row.quality === '4K' ? 4 : row.quality === '1080p' ? 3 : 0;
  return Math.max(0, Math.round((100 * successRate * freshness * progressiveTrust * recentFailurePenalty + speed + language + quality) * 10) / 10);
}

export async function listRememberedSources(connection: Database, identity: SourceIdentity) {
  const now = Date.now();
  const rows = await connection.db.select().from(sourceReliability).where(and(
    eq(sourceReliability.canonicalId, identity.canonicalId),
    eq(sourceReliability.mediaType, identity.mediaType),
    eq(sourceReliability.season, identity.season),
    eq(sourceReliability.episode, identity.episode),
    gt(sourceReliability.expiresAt, now),
    gt(sourceReliability.successes, 0),
  )).orderBy(desc(sourceReliability.lastSuccessAt)).limit(30);
  return rows.map(row => ({
    providerId: row.providerId, sourceRef: row.sourceRef,
    audioLanguage: row.audioLanguage, quality: row.quality,
    trusted: row.successes >= 3,
    score: reliabilityScore(row, now),
  })).filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
}

let ticketInsertions = 0;
export async function issueSourceTicket(connection: Database, descriptor: SourceDescriptor): Promise<string> {
  const now = Date.now();
  const ticket = randomUUID();
  await connection.db.insert(sourceEvidenceTickets).values({ ...descriptor, id: ticket, issuedAt: now, outcome: null });
  if (++ticketInsertions % 50 === 0) {
    connection.db.delete(sourceEvidenceTickets).where(lt(sourceEvidenceTickets.issuedAt, now - 86_400_000)).catch(() => {});
  }
  return ticket;
}

const writeQueues = new WeakMap<Database, Promise<unknown>>();

export function recordSourceEvidence(connection: Database, ticketId: string, outcome: SourceOutcome, detail: {
  startupMs?: number; audioLanguage?: string; quality?: string;
}): Promise<'recorded' | 'invalid'> {
  const previous = writeQueues.get(connection) || Promise.resolve();
  const work = previous.catch(() => {}).then(() => recordSourceEvidenceTransaction(connection, ticketId, outcome, detail));
  writeQueues.set(connection, work.then(() => undefined, () => undefined));
  return work;
}

async function recordSourceEvidenceTransaction(connection: Database, ticketId: string, outcome: SourceOutcome, detail: {
  startupMs?: number; audioLanguage?: string; quality?: string;
}): Promise<'recorded' | 'invalid'> {
  const now = Date.now();
  return connection.db.transaction(async tx => {
    const [ticket] = await tx.select().from(sourceEvidenceTickets).where(and(
      eq(sourceEvidenceTickets.id, ticketId), isNull(sourceEvidenceTickets.outcome),
      gt(sourceEvidenceTickets.issuedAt, now - 120_000),
    )).limit(1);
    if (!ticket || (outcome === 'success' && now - ticket.issuedAt < 5_000)) return 'invalid';
    const claimed = await tx.update(sourceEvidenceTickets).set({ outcome }).where(and(
      eq(sourceEvidenceTickets.id, ticketId), isNull(sourceEvidenceTickets.outcome),
    )).returning({ id: sourceEvidenceTickets.id });
    if (claimed.length !== 1) return 'invalid';

    const identity = {
      canonicalId: ticket.canonicalId, mediaType: ticket.mediaType,
      season: ticket.season, episode: ticket.episode,
      providerId: ticket.providerId, sourceRef: ticket.sourceRef,
    };
    const startupMs = Number.isFinite(detail.startupMs) && detail.startupMs! >= 0 && detail.startupMs! <= 60_000
      ? Math.round(detail.startupMs!) : null;
    const audioLanguage = ['pt-BR', 'en', 'ja', 'es'].includes(detail.audioLanguage || '') ? detail.audioLanguage : null;
    const quality = ['4K', '1080p', '720p', '480p', 'HD', 'SD'].includes(detail.quality || '') ? detail.quality : null;
    const isSuccess = outcome === 'success';
    await tx.insert(sourceReliability).values({
      ...identity, format: ticket.format,
      audioLanguage: isSuccess ? audioLanguage : null,
      quality: isSuccess ? quality : null,
      successes: isSuccess ? 1 : 0,
      startupFailures: outcome === 'startup_failure' ? 1 : 0,
      playbackFailures: outcome === 'playback_failure' ? 1 : 0,
      lastSuccessAt: isSuccess ? now : null,
      lastFailureAt: isSuccess ? null : now,
      averageStartupMs: isSuccess ? startupMs : null,
      status: isSuccess ? 'provisional' : 'degraded',
      expiresAt: now + (isSuccess ? 7 : 1) * 86_400_000,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [sourceReliability.canonicalId, sourceReliability.mediaType, sourceReliability.season,
        sourceReliability.episode, sourceReliability.providerId, sourceReliability.sourceRef],
      set: {
        successes: sql`${sourceReliability.successes} + ${isSuccess ? 1 : 0}`,
        startupFailures: sql`${sourceReliability.startupFailures} + ${outcome === 'startup_failure' ? 1 : 0}`,
        playbackFailures: sql`${sourceReliability.playbackFailures} + ${outcome === 'playback_failure' ? 1 : 0}`,
        lastSuccessAt: isSuccess ? now : sql`${sourceReliability.lastSuccessAt}`,
        lastFailureAt: isSuccess ? sql`${sourceReliability.lastFailureAt}` : now,
        audioLanguage: isSuccess && audioLanguage ? audioLanguage : sql`${sourceReliability.audioLanguage}`,
        quality: isSuccess && quality ? quality : sql`${sourceReliability.quality}`,
        averageStartupMs: isSuccess && startupMs !== null
          ? sql`CASE WHEN ${sourceReliability.averageStartupMs} IS NULL THEN ${startupMs} ELSE CAST((${sourceReliability.averageStartupMs} * ${sourceReliability.successes} + ${startupMs}) / (${sourceReliability.successes} + 1) AS INTEGER) END`
          : sql`${sourceReliability.averageStartupMs}`,
        status: isSuccess ? sql`CASE WHEN ${sourceReliability.successes} >= 1 THEN 'healthy' ELSE 'provisional' END` : 'degraded',
        expiresAt: now + (isSuccess ? 7 : 1) * 86_400_000,
        updatedAt: now,
      },
    });
    return 'recorded';
  });
}
