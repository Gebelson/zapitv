/**
 * ZapiTV — OfflineStorageDriver
 * Abstração de armazenamento local privado para mídia offline.
 * Utiliza Origin Private File System (OPFS) primariamente, com fallback transparente para IndexedDB.
 * NENHUM arquivo é exportado para a pasta Downloads ou fora da sandbox da origem.
 */

import { StorageDriverType } from './offlineTypes';

const OPFS_MEDIA_DIR = 'zapitv_offline_vault';
const IDB_NAME = 'zapitv_offline_media_db';
const IDB_STORE = 'media_chunks';
const IDB_VERSION = 1;

export class OfflineStorageDriver {
  private opfsRoot: FileSystemDirectoryHandle | null = null;
  private isOpfsSupported: boolean | null = null;
  private idbInstance: IDBDatabase | null = null;

  /**
   * Detecta se o Origin Private File System (OPFS) é suportado no ambiente atual.
   */
  public async checkOpfsSupport(): Promise<boolean> {
    if (this.isOpfsSupported !== null) return this.isOpfsSupported;

    if (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    ) {
      try {
        const root = await navigator.storage.getDirectory();
        // Testa se consegue criar e deletar arquivo de teste
        const testFile = await root.getFileHandle('__opfs_probe__', { create: true });
        await root.removeEntry('__opfs_probe__');
        this.opfsRoot = root;
        this.isOpfsSupported = true;
        return true;
      } catch (e) {
        console.warn('[OfflineStorage] OPFS probe falhou, utilizando fallback IndexedDB:', e);
      }
    }

    this.isOpfsSupported = false;
    return false;
  }

  /**
   * Obtém a pasta de mídia privada dentro do OPFS.
   */
  private async getMediaDir(): Promise<FileSystemDirectoryHandle> {
    if (!this.opfsRoot) {
      if (!navigator.storage || !navigator.storage.getDirectory) {
        throw new Error('OPFS não suportado neste navegador.');
      }
      this.opfsRoot = await navigator.storage.getDirectory();
    }
    return await this.opfsRoot.getDirectoryHandle(OPFS_MEDIA_DIR, { create: true });
  }

  /**
   * Inicializa o banco IndexedDB para fallback quando OPFS não estiver disponível.
   */
  private async getIdb(): Promise<IDBDatabase> {
    if (this.idbInstance) return this.idbInstance;

    const factory = typeof indexedDB !== 'undefined'
      ? indexedDB
      : (typeof window !== 'undefined' && window.indexedDB)
      ? window.indexedDB
      : (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB)
      ? (globalThis as any).indexedDB
      : null;

    if (!factory) {
      throw new Error('IndexedDB não suportado neste ambiente.');
    }

    return new Promise((resolve, reject) => {
      const req = factory.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        this.idbInstance = req.result;
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Abre um writer de stream para gravação progressiva (chunk por chunk) sem estourar memória.
   */
  public async createWriter(storagePath: string, driver: StorageDriverType): Promise<{
    write: (chunk: Uint8Array) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }> {
    const isOpfs = driver === 'opfs' && (await this.checkOpfsSupport());

    if (isOpfs) {
      const mediaDir = await this.getMediaDir();
      const fileHandle = await mediaDir.getFileHandle(storagePath, { create: true });
      const writable = await fileHandle.createWritable({ keepExistingData: true });

      return {
        write: async (chunk: Uint8Array) => {
          await writable.write(chunk);
        },
        close: async () => {
          await writable.close();
        },
        abort: async () => {
          try {
            await writable.abort();
          } catch {}
        }
      };
    } else {
      // Fallback IndexedDB: acumula chunks como Blobs parciais
      const chunks: BlobPart[] = [];
      const db = await this.getIdb();

      return {
        write: async (chunk: Uint8Array) => {
          chunks.push(chunk);
        },
        close: async () => {
          const finalBlob = new Blob(chunks, { type: 'video/mp4' });
          return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            const req = store.put(finalBlob, storagePath);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        },
        abort: async () => {
          chunks.length = 0;
        }
      };
    }
  }

  /**
   * Recupera o arquivo de mídia salvo para reprodução local.
   * Retorna um Blob/File pronto para createObjectURL ou range streaming.
   */
  public async getFile(storagePath: string, driver: StorageDriverType): Promise<Blob> {
    const isOpfs = driver === 'opfs' && (await this.checkOpfsSupport());

    if (isOpfs) {
      const mediaDir = await this.getMediaDir();
      const fileHandle = await mediaDir.getFileHandle(storagePath);
      return await fileHandle.getFile();
    } else {
      const db = await this.getIdb();
      return new Promise<Blob>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(storagePath);
        req.onsuccess = () => {
          if (req.result) {
            resolve(req.result as Blob);
          } else {
            reject(new Error(`Arquivo offline não encontrado no IndexedDB: ${storagePath}`));
          }
        };
        req.onerror = () => reject(req.error);
      });
    }
  }

  /**
   * Remove o arquivo do armazenamento privado.
   */
  public async deleteFile(storagePath: string, driver: StorageDriverType): Promise<void> {
    try {
      const isOpfs = driver === 'opfs' && (await this.checkOpfsSupport());
      if (isOpfs) {
        const mediaDir = await this.getMediaDir();
        await mediaDir.removeEntry(storagePath);
      } else {
        const db = await this.getIdb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          const req = store.delete(storagePath);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    } catch (e) {
      console.warn('[OfflineStorage] Erro ao remover arquivo offline:', storagePath, e);
    }
  }

  /**
   * Calcula o espaço em disco total ocupado pelos arquivos de mídia offline.
   */
  public async getDownloadedBytesTotal(): Promise<number> {
    let total = 0;
    try {
      if (await this.checkOpfsSupport()) {
        const mediaDir = await this.getMediaDir();
        // @ts-ignore
        for await (const [_, handle] of mediaDir.entries()) {
          if (handle.kind === 'file') {
            const f = await (handle as FileSystemFileHandle).getFile();
            total += f.size;
          }
        }
      }
    } catch (e) {
      console.warn('[OfflineStorage] Erro ao calcular bytes no OPFS:', e);
    }

    return total;
  }
}

export const offlineStorageDriver = new OfflineStorageDriver();
