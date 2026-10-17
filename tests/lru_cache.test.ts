import { describe, it, expect } from 'vitest';
import { LruCache } from '../src/core/cache/LruCache';

describe('LruCache', () => {
  it('should store and retrieve values correctly', () => {
    const cache = new LruCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  it('should evict the least recently used item when maxSize is exceeded', () => {
    const cache = new LruCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' so 'b' becomes least recently used
    cache.get('a');

    // Insert 'd', which should evict 'b'
    cache.set('d', 4);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  it('should expire entries after TTL', async () => {
    const cache = new LruCache<string, string>(10, 50); // 50ms TTL
    cache.set('key', 'value');

    expect(cache.get('key')).toBe('value');
    expect(cache.has('key')).toBe(true);

    await new Promise((r) => setTimeout(r, 60));

    expect(cache.get('key')).toBeUndefined();
    expect(cache.has('key')).toBe(false);
  });

  it('should prune expired items correctly', async () => {
    const cache = new LruCache<string, string>(10);
    cache.set('fast', 'val', 20);
    cache.set('slow', 'val', 2000);

    await new Promise((r) => setTimeout(r, 30));

    const pruned = cache.pruneExpired();
    expect(pruned).toBe(1);
    expect(cache.has('fast')).toBe(false);
    expect(cache.has('slow')).toBe(true);
  });
});
