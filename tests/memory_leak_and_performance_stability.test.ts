import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LruCache } from '../src/core/cache/LruCache';
import { pipService } from '../src/core/pip/pipService';

describe('Memory Leak Prevention and Performance Stability Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. LruCache bounded memory behavior under long continuous sessions', () => {
    it('strictly enforces maxSize and prevents unbounded memory growth across 1000 items', () => {
      const cache = new LruCache<string, { data: string }>(50);

      // Simulate 1000 distinct items being cached during extended browsing
      for (let i = 0; i < 1000; i++) {
        cache.set(`item-${i}`, { data: `content-${i}` });
      }

      // Size must never exceed maxSize (50)
      expect(cache.size).toBe(50);

      // Earliest items must be evicted
      expect(cache.get('item-0')).toBeUndefined();
      expect(cache.get('item-900')).toBeUndefined();

      // Recent items must be present
      expect(cache.get('item-999')?.data).toBe('content-999');
      expect(cache.get('item-950')?.data).toBe('content-950');
    });

    it('correctly refreshes access order on get() so frequently viewed items survive eviction', () => {
      const cache = new LruCache<string, string>(3);
      cache.set('movie-1', 'Movie 1');
      cache.set('movie-2', 'Movie 2');
      cache.set('movie-3', 'Movie 3');

      // User revisits movie-1
      cache.get('movie-1');

      // New movie inserted, should evict movie-2 (least recently used)
      cache.set('movie-4', 'Movie 4');

      expect(cache.get('movie-1')).toBe('Movie 1');
      expect(cache.get('movie-2')).toBeUndefined();
      expect(cache.get('movie-3')).toBe('Movie 3');
      expect(cache.get('movie-4')).toBe('Movie 4');
    });

    it('prunes expired items without retaining dead memory', async () => {
      const cache = new LruCache<string, string>(100, 25); // 25ms TTL
      for (let i = 0; i < 20; i++) {
        cache.set(`temp-${i}`, `val-${i}`);
      }
      expect(cache.size).toBe(20);

      await new Promise(r => setTimeout(r, 35));

      const pruned = cache.pruneExpired();
      expect(pruned).toBe(20);
      expect(cache.size).toBe(0);
    });
  });

  describe('2. MediaSession & Global Handlers Teardown', () => {
    it('clearMediaSession() resets metadata, playbackState, and action handlers', () => {
      const mockSetActionHandler = vi.fn();
      const mockSetPositionState = vi.fn();

      // Mock navigator.mediaSession
      const fakeMediaSession = {
        metadata: { title: 'Test' } as any,
        playbackState: 'playing' as MediaSessionPlaybackState,
        setActionHandler: mockSetActionHandler,
        setPositionState: mockSetPositionState
      };

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaSession: fakeMediaSession
        },
        writable: true,
        configurable: true
      });

      pipService.clearMediaSession();

      expect(fakeMediaSession.metadata).toBeNull();
      expect(fakeMediaSession.playbackState).toBe('none');
      // All action handlers ('play', 'pause', 'seekto', etc.) must be set to null
      expect(mockSetActionHandler).toHaveBeenCalledWith('play', null);
      expect(mockSetActionHandler).toHaveBeenCalledWith('pause', null);
      expect(mockSetActionHandler).toHaveBeenCalledWith('seekto', null);
    });
  });

  describe('3. AbortController signal propagation during rapid navigation', () => {
    it('aborts previous pending fetch controller when new navigation occurs', () => {
      let activeController: AbortController | null = null;
      const abortSpy = vi.fn();

      const triggerNavigation = () => {
        if (activeController) {
          activeController.signal.addEventListener('abort', abortSpy);
          activeController.abort();
        }
        activeController = new AbortController();
      };

      // User rapidly clicks 5 different movies
      triggerNavigation();
      const firstController = activeController;
      triggerNavigation();
      triggerNavigation();
      triggerNavigation();
      triggerNavigation();

      expect(firstController?.signal.aborted).toBe(true);
      expect(abortSpy).toHaveBeenCalled();
      expect(activeController?.signal.aborted).toBe(false);
    });
  });
});
