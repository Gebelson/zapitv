import { and, eq } from 'drizzle-orm';
import { ContentType, type ContentItem } from '../../../types';
import { catalogReleaseStore, type CatalogReleaseSnapshot, type PendingCandidate } from '../../core/catalog/CatalogReleaseStore';
import { deduplicateContentItems, getCanonicalKeysForItem } from '../../core/catalog/catalogDeduplication';
import type { AutoReleaseSyncResult } from '../../core/catalog/AutoReleaseService';
import { getDatabase, type Database } from '../database/client';
import { globalSettings } from '../database/schema';

const RELEASE_KEY = 'catalog_releases_v1';
const MAX_SNAPSHOT_BYTES = 2_000_000;
const EMPTY_SNAPSHOT: CatalogReleaseSnapshot = { releases: [], pending: [] };

export class CatalogReleaseStorageUnavailable extends Error {}

interface StoredSnapshot {
  snapshot: CatalogReleaseSnapshot;
  version: number;
}

let activeSync: Promise<AutoReleaseSyncResult> | null = null;

/** Read the saved releases for a fresh serverless invocation. */
export async function getPersistedReleases(): Promise<ContentItem[]> {
  const connection = getDatabase();
  if (!connection) {
    if (process.env.VERCEL) throw new CatalogReleaseStorageUnavailable('Banco de lançamentos indisponível.');
    return catalogReleaseStore.getReleases();
  }
  return (await readSnapshot(connection)).snapshot.releases;
}

/** Load the pending queue before scanning, then commit the result before responding. */
export function runPersistedReleaseSync(execute?: () => Promise<AutoReleaseSyncResult>): Promise<AutoReleaseSyncResult> {
  if (activeSync) return activeSync;
  activeSync = performSync(execute).finally(() => { activeSync = null; });
  return activeSync;
}

async function performSync(execute?: () => Promise<AutoReleaseSyncResult>): Promise<AutoReleaseSyncResult> {
  const run = execute || (async () => (await import('../../core/catalog/CatalogReleaseScheduler')).catalogReleaseScheduler.executeManualSync());
  const connection = getDatabase();
  if (!connection) {
    if (process.env.VERCEL) throw new CatalogReleaseStorageUnavailable('Banco de lançamentos indisponível.');
    return run();
  }

  const original = await readSnapshot(connection);
  catalogReleaseStore.restoreSnapshot(original.snapshot);
  const result = await run();
  const scanned = catalogReleaseStore.getSnapshot();
  if (JSON.stringify(scanned) === JSON.stringify(original.snapshot)) return result;

  let candidate = scanned;
  let version = original.version;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (await saveSnapshot(connection, candidate, version)) {
      catalogReleaseStore.restoreSnapshot(candidate);
      return result;
    }
    const latest = await readSnapshot(connection);
    candidate = mergeSnapshots(latest.snapshot, scanned);
    version = latest.version;
    if (JSON.stringify(candidate) === JSON.stringify(latest.snapshot)) {
      catalogReleaseStore.restoreSnapshot(candidate);
      return result;
    }
  }
  throw new CatalogReleaseStorageUnavailable('Os lançamentos foram alterados simultaneamente. Tente novamente.');
}

async function readSnapshot(connection: Database): Promise<StoredSnapshot> {
  try {
    const [row] = await connection.db.select().from(globalSettings)
      .where(eq(globalSettings.key, RELEASE_KEY)).limit(1);
    if (!row) return { snapshot: EMPTY_SNAPSHOT, version: 0 };
    return { snapshot: parseSnapshot(row.valueJson), version: row.version };
  } catch (error) {
    if (error instanceof CatalogReleaseStorageUnavailable) throw error;
    throw new CatalogReleaseStorageUnavailable('Não foi possível ler o banco de lançamentos.');
  }
}

function parseSnapshot(valueJson: string): CatalogReleaseSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(valueJson);
  } catch {
    throw new CatalogReleaseStorageUnavailable('Estado de lançamentos inválido no banco.');
  }
  if (!value || typeof value !== 'object') {
    throw new CatalogReleaseStorageUnavailable('Estado de lançamentos inválido no banco.');
  }
  const snapshot = value as Partial<CatalogReleaseSnapshot>;
  if (!Array.isArray(snapshot.releases) || !Array.isArray(snapshot.pending) ||
      !snapshot.releases.every(item => item && typeof item.id === 'string' && typeof item.title === 'string') ||
      !snapshot.pending.every(candidate => candidate && typeof candidate.id === 'string' &&
        typeof candidate.title === 'string' && typeof candidate.recheckAfter === 'number' &&
        typeof candidate.lastCheckedAt === 'number' && typeof candidate.attempts === 'number')) {
    throw new CatalogReleaseStorageUnavailable('Estado de lançamentos inválido no banco.');
  }
  return snapshot as CatalogReleaseSnapshot;
}

async function saveSnapshot(connection: Database, snapshot: CatalogReleaseSnapshot, version: number): Promise<boolean> {
  const valueJson = JSON.stringify(snapshot);
  if (Buffer.byteLength(valueJson, 'utf8') > MAX_SNAPSHOT_BYTES) {
    throw new CatalogReleaseStorageUnavailable('Capacidade atual de lançamentos atingida.');
  }
  const updatedAt = Date.now();
  try {
    if (version === 0) {
      const inserted = await connection.db.insert(globalSettings).values({
        key: RELEASE_KEY, valueJson, version: 1, updatedAt, updatedBy: 'release-cron'
      }).onConflictDoNothing().returning({ version: globalSettings.version });
      return inserted.length === 1;
    }
    const updated = await connection.db.update(globalSettings).set({
      valueJson, version: version + 1, updatedAt, updatedBy: 'release-cron'
    }).where(and(eq(globalSettings.key, RELEASE_KEY), eq(globalSettings.version, version)))
      .returning({ version: globalSettings.version });
    return updated.length === 1;
  } catch {
    throw new CatalogReleaseStorageUnavailable('Não foi possível gravar no banco de lançamentos.');
  }
}

/** Concurrent scans only add releases, episodes and pending rechecks; keep both results. */
function mergeSnapshots(latest: CatalogReleaseSnapshot, scanned: CatalogReleaseSnapshot): CatalogReleaseSnapshot {
  const inputs = [...scanned.releases, ...latest.releases];
  const releases = deduplicateContentItems(structuredClone(inputs));
  for (const release of releases) {
    const keys = new Set(getCanonicalKeysForItem(release));
    const episodes = new Map<string, NonNullable<ContentItem['episodes']>[number]>();
    for (const item of [...latest.releases, ...scanned.releases]) {
      if (!getCanonicalKeysForItem(item).some(key => keys.has(key))) continue;
      for (const episode of item.episodes || []) {
        episodes.set(`${episode.season ?? 1}:${episode.number}`, episode);
      }
    }
    if (episodes.size > 0) {
      release.episodes = [...episodes.values()].sort((a, b) =>
        (a.season ?? 1) - (b.season ?? 1) || a.number - b.number);
    }
  }

  const pending = new Map<string, PendingCandidate>();
  for (const candidate of [...latest.pending, ...scanned.pending]) {
    const key = `${candidate.type === ContentType.MOVIE ? 'movie' : 'series'}:${candidate.imdbId || candidate.id}`;
    const current = pending.get(key);
    if (!current || candidate.lastCheckedAt > current.lastCheckedAt ||
        (candidate.lastCheckedAt === current.lastCheckedAt && candidate.attempts > current.attempts)) {
      pending.set(key, candidate);
    }
  }
  const releaseKeys = new Set(releases.flatMap(item => [
    `id:${item.mediaFormat === 'movie' || item.type === ContentType.MOVIE ? 'movie' : 'series'}:${item.id}`,
    item.imdbId && `imdb:${item.imdbId.toLowerCase()}`,
    item.tmdbId && `tmdb:${item.type}:${item.tmdbId}`
  ].filter(Boolean)));
  return {
    releases,
    pending: [...pending.values()].filter(candidate => ![
      `id:${candidate.type === ContentType.MOVIE ? 'movie' : 'series'}:${candidate.id}`,
      candidate.imdbId && `imdb:${candidate.imdbId.toLowerCase()}`,
      candidate.tmdbId && `tmdb:${candidate.type}:${candidate.tmdbId}`
    ].some(key => key && releaseKeys.has(key)))
  };
}
