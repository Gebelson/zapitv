/**
 * ZapiTV - LRU (Least Recently Used) Memory-Bounded Cache
 *
 * Previne vazamentos de memória e crescimento descontrolado de Maps globais
 * durante longas sessões de navegação e uso contínuo.
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number | null;
}

export class LruCache<K, V> {
  private map: Map<K, CacheEntry<V>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;

  constructor(maxSize: number = 100, defaultTtlMs: number = 0) {
    this.maxSize = Math.max(1, maxSize);
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    // Refresh LRU order: delete and re-insert
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest entry (first key in Map iterator)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    const ttl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    const expiresAt = ttl > 0 ? Date.now() + ttl : null;

    this.map.set(key, { value, expiresAt });
  }

  has(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  pruneExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.map.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.map.delete(key);
        count++;
      }
    }
    return count;
  }

  forEach(callback: (value: V, key: K) => void): void {
    const now = Date.now();
    for (const [key, entry] of this.map.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.map.delete(key);
      } else {
        callback(entry.value, key);
      }
    }
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): V[] {
    const now = Date.now();
    const result: V[] = [];
    for (const [key, entry] of this.map.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.map.delete(key);
      } else {
        result.push(entry.value);
      }
    }
    return result;
  }
}
