/**
 * ZapiTV — OfflineDb
 * Gerenciador de metadados, status e progresso dos downloads locais via IndexedDB.
 */

import { OfflineDownload, DownloadStatus } from './offlineTypes';

const DB_NAME = 'zapitv_offline_downloads_db';
const STORE_NAME = 'downloads_registry';
const DB_VERSION = 1;

export class OfflineDb {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<(downloads: OfflineDownload[]) => void> = new Set();
  private cache: Map<string, OfflineDownload> = new Map();
  private isInitialized = false;

  private getIdbFactory(): IDBFactory | null {
    if (typeof indexedDB !== 'undefined') return indexedDB;
    if (typeof window !== 'undefined' && window.indexedDB) return window.indexedDB;
    if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) return (globalThis as any).indexedDB;
    return null;
  }

  private async getDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    const factory = this.getIdbFactory();
    if (!factory) {
      return null;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = factory.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('itemId', 'itemId', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const all = await this.getAllFromDb();
      this.cache.clear();
      all.forEach(item => {
        // Se o download estava 'downloading' no momento em que o app fechou, marca como 'paused'
        if (item.status === 'downloading') {
          item.status = 'paused';
          item.speedBytesPerSec = 0;
          this.putInDb(item);
        }
        this.cache.set(item.id, item);
      });
      this.isInitialized = true;
      this.notifyListeners();
    } catch (e) {
      console.warn('[OfflineDb] Falha ao carregar metadados offline iniciais:', e);
    }
  }

  private async getAllFromDb(): Promise<OfflineDownload[]> {
    const db = await this.getDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as OfflineDownload[]);
      req.onerror = () => reject(req.error);
    });
  }

  private async putInDb(download: OfflineDownload): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(download);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async deleteFromDb(id: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async saveDownload(download: OfflineDownload): Promise<void> {
    this.cache.set(download.id, { ...download });
    await this.putInDb(download);
    this.notifyListeners();
  }

  public async updateDownload(id: string, updates: Partial<OfflineDownload>): Promise<void> {
    const existing = this.cache.get(id);
    if (!existing) return;

    const updated: OfflineDownload = {
      ...existing,
      ...updates
    };
    this.cache.set(id, updated);
    await this.putInDb(updated);
    this.notifyListeners();
  }

  public getDownload(id: string): OfflineDownload | null {
    return this.cache.get(id) || null;
  }

  public getAllDownloads(): OfflineDownload[] {
    return Array.from(this.cache.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getCompletedDownloads(): OfflineDownload[] {
    return this.getAllDownloads().filter(d => d.status === 'completed');
  }

  public getActiveDownloads(): OfflineDownload[] {
    return this.getAllDownloads().filter(d => d.status === 'downloading' || d.status === 'pending');
  }

  public async deleteDownload(id: string): Promise<void> {
    this.cache.delete(id);
    await this.deleteFromDb(id);
    this.notifyListeners();
  }

  public async updatePlaybackPosition(id: string, positionSeconds: number): Promise<void> {
    const item = this.cache.get(id);
    if (item) {
      item.lastPlaybackPosition = positionSeconds;
      await this.putInDb(item);
      this.notifyListeners();
    }
  }

  public subscribe(listener: (downloads: OfflineDownload[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAllDownloads());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const list = this.getAllDownloads();
    this.listeners.forEach(fn => fn(list));
  }
}

export const offlineDb = new OfflineDb();
if (typeof window !== 'undefined') {
  (window as any).__zapitv_offlineDb = offlineDb;
}
