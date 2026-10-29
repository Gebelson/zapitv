import { and, eq } from 'drizzle-orm';
import { FeedbackStore, type FeedbackSnapshot } from '../../core/feedback/FeedbackStore';
import { getDatabase, type Database } from '../database/client';
import { globalSettings } from '../database/schema';

const FEEDBACK_KEY = 'feedback_store_v1';
const MAX_SNAPSHOT_BYTES = 2_000_000;

export class FeedbackStorageUnavailable extends Error {}

export async function withFeedbackStore<T>(
  operation: (store: FeedbackStore) => T | Promise<T>,
  options: { write?: boolean; actor?: string; shouldPersist?: (result: T) => boolean } = {}
): Promise<T> {
  const connection = getDatabase();
  if (!connection) {
    if (process.env.VERCEL) throw new FeedbackStorageUnavailable('Banco de feedback indisponível.');
    return operation(FeedbackStore.getInstance());
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt > 0) {
      // Backoff exponencial com jitter para mitigar contenção em concorrência
      await new Promise(resolve => setTimeout(resolve, Math.min(250, 15 * Math.pow(1.5, attempt) + Math.random() * 20)));
    }

    let row: typeof globalSettings.$inferSelect | undefined;
    try {
      [row] = await connection.db.select().from(globalSettings)
        .where(eq(globalSettings.key, FEEDBACK_KEY)).limit(1);
    } catch {
      throw new FeedbackStorageUnavailable('Não foi possível ler o banco de feedback.');
    }
    const store = new FeedbackStore(false);
    try {
      store.restoreSnapshot(row ? JSON.parse(row.valueJson) as FeedbackSnapshot : null);
    } catch {
      throw new FeedbackStorageUnavailable('Estado de feedback inválido no banco.');
    }
    const result = await operation(store);
    if (!options.write || (options.shouldPersist && !options.shouldPersist(result))) return result;
    try {
      const saved = await saveSnapshot(connection, store.getSnapshot(), row?.version ?? 0, options.actor || 'feedback', store);
      if (saved) return result;
    } catch (error) {
      if (error instanceof FeedbackStorageUnavailable) throw error;
      throw new FeedbackStorageUnavailable('Não foi possível gravar no banco de feedback.');
    }
  }
  throw new FeedbackStorageUnavailable('O feedback foi alterado simultaneamente. Tente novamente.');
}

async function saveSnapshot(connection: Database, snapshot: FeedbackSnapshot, version: number, actor: string, store?: FeedbackStore): Promise<boolean> {
  let valueJson = JSON.stringify(snapshot);
  if (Buffer.byteLength(valueJson, 'utf8') > MAX_SNAPSHOT_BYTES) {
    if (store) {
      store.compactSnapshot();
      valueJson = JSON.stringify(store.getSnapshot());
    }
    if (Buffer.byteLength(valueJson, 'utf8') > MAX_SNAPSHOT_BYTES) {
      throw new FeedbackStorageUnavailable('Capacidade atual de feedback atingida.');
    }
  }
  const updatedAt = Date.now();
  if (version === 0) {
    const inserted = await connection.db.insert(globalSettings).values({
      key: FEEDBACK_KEY, valueJson, version: 1, updatedAt, updatedBy: actor
    }).onConflictDoNothing().returning({ version: globalSettings.version });
    return inserted.length === 1;
  }
  const updated = await connection.db.update(globalSettings).set({
    valueJson, version: version + 1, updatedAt, updatedBy: actor
  }).where(and(eq(globalSettings.key, FEEDBACK_KEY), eq(globalSettings.version, version)))
    .returning({ version: globalSettings.version });
  return updated.length === 1;
}
