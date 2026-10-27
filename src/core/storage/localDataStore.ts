import { db } from '../../../db';

export interface DataEnvelope<T> {
  version: 2;
  revision: number;
  updatedAt: number;
  data: T;
}

export interface DataCodec<T> {
  key: string;
  legacyKeys: readonly string[];
  isValid(value: unknown): boolean;
  normalize(value: unknown): T;
  migrate(copies: unknown[]): T;
}

/** Small storage boundary. A future backend can implement this contract without changing consumers. */
export interface LocalDataBackend {
  get(key: string): Promise<unknown>;
  remove?(key: string): Promise<void>;
  update(key: string, change: (current: unknown) => Promise<unknown>): Promise<unknown>;
}

const indexedDbBackend: LocalDataBackend = {
  get: async key => (await db.keyValueStore.get(key))?.value,
  remove: key => db.keyValueStore.delete(key),
  update: (key, change) => db.transaction('rw', db.keyValueStore, async () => {
    const current = (await db.keyValueStore.get(key))?.value;
    const next = await change(current);
    if (!current || current.version !== 2 || current.revision !== (next as DataEnvelope<unknown>).revision ||
      current.updatedAt !== (next as DataEnvelope<unknown>).updatedAt) await db.keyValueStore.put({ key, value: next });
    return next;
  })
};

export class LocalDataStore {
  private pending = new Map<string, Promise<unknown>>();
  private memory = new Map<string, DataEnvelope<unknown>>();

  constructor(
    private backend: LocalDataBackend = indexedDbBackend,
    private getLocal: () => Storage | undefined = () => typeof localStorage === 'undefined' ? undefined : localStorage
  ) {}

  private localRead(key: string): unknown {
    try {
      const raw = this.getLocal()?.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
  }

  private envelope<T>(raw: unknown, codec: DataCodec<T>): DataEnvelope<T> | undefined {
    const value = raw as Partial<DataEnvelope<T>> | undefined;
    if (!value || value.version !== 2 || !Number.isSafeInteger(value.revision) ||
      value.revision! < 1 || !Number.isFinite(value.updatedAt) || !('data' in value) || !codec.isValid(value.data)) return;
    return { version: 2, revision: value.revision!, updatedAt: value.updatedAt!, data: codec.normalize(value.data) };
  }

  private latest<T>(codec: DataCodec<T>, ...copies: unknown[]): DataEnvelope<T> | undefined {
    return copies.map(copy => this.envelope(copy, codec)).filter((copy): copy is DataEnvelope<T> => !!copy)
      .sort((a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt)[0];
  }

  readSync<T>(codec: DataCodec<T>): T {
    const current = this.latest(codec, this.memory.get(codec.key), this.localRead(codec.key));
    return current?.data ?? codec.migrate(codec.legacyKeys.map(key => this.localRead(key)));
  }

  private enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const result = (this.pending.get(key) || Promise.resolve()).catch(() => {}).then(operation);
    this.pending.set(key, result);
    void result.finally(() => {
      if (this.pending.get(key) === result) this.pending.delete(key);
    }).catch(() => {});
    return result;
  }

  read<T>(codec: DataCodec<T>): Promise<T> {
    return this.update(codec, value => value, false);
  }

  /** Only for an explicit user deletion; migration itself never removes the legacy backup. */
  async removeLegacy<T>(codec: DataCodec<T>): Promise<void> {
    for (const key of codec.legacyKeys) {
      try { this.getLocal()?.removeItem(key); } catch {}
      try { await this.backend.remove?.(key); } catch {}
    }
  }

  update<T>(codec: DataCodec<T>, change: (value: T) => T, write = true): Promise<T> {
    return this.enqueue(codec.key, async () => {
      // Read legacy values only until a versioned record exists. Old keys remain untouched as backups.
      const known = this.latest(codec, this.memory.get(codec.key), this.localRead(codec.key));
      let legacy: T | undefined;
      if (!known) {
        const copies = await Promise.all(codec.legacyKeys.map(async key => {
          let remote: unknown;
          try { remote = await this.backend.get(key); } catch {}
          return [this.localRead(key), remote];
        }));
        legacy = codec.migrate(copies.flat());
      }
      let next: DataEnvelope<T> | undefined;
      let durable = false;
      const prepare = (raw: unknown) => {
        const current = this.latest(codec, raw, this.memory.get(codec.key), this.localRead(codec.key));
        const base = current?.data ?? legacy ?? codec.migrate([]);
        const changed = change(base);
        const data = codec.normalize(changed);
        next = current && (!write || changed === base) ? current : {
          version: 2, revision: (current?.revision ?? 0) + 1, updatedAt: Date.now(), data
        };
        return next;
      };
      try {
        if (!write && known) {
          let stored: unknown;
          try { stored = await this.backend.get(codec.key); } catch {}
          prepare(stored);
          const persisted = this.envelope(stored, codec);
          if (!persisted || persisted.revision !== next!.revision || persisted.updatedAt !== next!.updatedAt) {
            await this.backend.update(codec.key, async raw => prepare(raw));
          }
          durable = true;
        } else {
          await this.backend.update(codec.key, async raw => prepare(raw));
          durable = true;
        }
      } catch {
        // A failed IndexedDB write must not prevent the independent localStorage fallback.
        if (!next) prepare(undefined);
      }
      if (!next) prepare(undefined);
      this.memory.set(codec.key, next!);
      try {
        const local = this.getLocal();
        const serialized = JSON.stringify(next);
        if (local) {
          if (local.getItem(codec.key) !== serialized) local.setItem(codec.key, serialized);
          durable = true;
        }
      } catch {}
      if (write && !durable) console.warn('[Storage] Dados mantidos apenas nesta sessão; armazenamento persistente indisponível.');
      return next!.data;
    });
  }
}

export const localDataStore = new LocalDataStore();
