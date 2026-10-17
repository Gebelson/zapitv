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
  public async createWriter(storagePath: string, driver: StorageDriverType, fileHandle?: FileSystemFileHandle): Promise<{
    write: (chunk: Uint8Array) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }> {
    if (driver === 'file') {
      if (!fileHandle) throw new Error('A permissão para salvar o arquivo não está disponível. Selecione o destino novamente.');
      const writable = await fileHandle.createWritable({ keepExistingData: false });
      return {
        write: async (chunk: Uint8Array) => { await writable.write(chunk); },
        close: async () => { await writable.close(); },
        abort: async () => { await writable.abort(); }
      };
    }
    const isOpfs = driver === 'opfs' && (await this.checkOpfsSupport());

    if (isOpfs) {
      const mediaDir = await this.getMediaDir();
      const fileHandle = await mediaDir.getFileHandle(storagePath, { create: true });
      const writable = await fileHandle.createWritable({ keepExistingData: false });

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
      // Fallback IndexedDB: persiste cada parte imediatamente; não mantém
      // um filme inteiro em RAM enquanto a transferência está em andamento.
      const db = await this.getIdb();
      await this.deleteFile(storagePath, 'idb');
      let chunkCount = 0;
      const prefix = `${storagePath}::chunk::`;

      return {
        write: async (chunk: Uint8Array) => {
          const key = `${prefix}${String(chunkCount).padStart(8, '0')}`;
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(new Blob([chunk]), key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          });
          chunkCount++;
        },
        close: async () => {
          return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put({ kind: 'chunked', count: chunkCount }, storagePath);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          });
        },
        abort: async () => {
          await this.deleteFile(storagePath, 'idb');
        }
      };
    }
  }

  /**
   * Recupera o arquivo de mídia salvo para reprodução local.
   * Retorna um Blob/File pronto para createObjectURL ou range streaming.
   */
  public async getFile(storagePath: string, driver: StorageDriverType, fileHandle?: FileSystemFileHandle, allowPermissionPrompt = false): Promise<Blob> {
    if (driver === 'file') {
      if (!fileHandle) throw new Error('Arquivo salvo fora do navegador. Selecione ou importe o arquivo novamente.');
      const permissionHandle = fileHandle as FileSystemFileHandle & {
        queryPermission?: (options: { mode: 'read' }) => Promise<PermissionState>;
        requestPermission?: (options: { mode: 'read' }) => Promise<PermissionState>;
      };
      if (permissionHandle.queryPermission && await permissionHandle.queryPermission({ mode: 'read' }) !== 'granted') {
        if (!allowPermissionPrompt || !permissionHandle.requestPermission || await permissionHandle.requestPermission({ mode: 'read' }) !== 'granted') {
          throw new Error('Permita novamente o acesso ao arquivo salvo para reproduzi-lo.');
        }
      }
      return fileHandle.getFile();
    }
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
          if (req.result instanceof Blob) {
            resolve(req.result); // Formato legado: preservar downloads já concluídos.
          } else if (req.result?.kind === 'chunked') {
            const count = req.result.count as number;
            const parts: Blob[] = [];
            if (count === 0) { reject(new Error('Arquivo offline vazio.')); return; }
            const readTx = db.transaction(IDB_STORE, 'readonly');
            const readStore = readTx.objectStore(IDB_STORE);
            for (let i = 0; i < count; i++) {
              const part = readStore.get(`${storagePath}::chunk::${String(i).padStart(8, '0')}`);
              part.onsuccess = () => {
                if (!(part.result instanceof Blob)) readTx.abort();
                else parts[i] = part.result;
              };
            }
            readTx.oncomplete = () => resolve(new Blob(parts, { type: storagePath.endsWith('.webm') ? 'video/webm' : 'video/mp4' }));
            readTx.onerror = () => reject(readTx.error || new Error('Arquivo offline incompleto.'));
            readTx.onabort = () => reject(new Error('Arquivo offline incompleto.'));
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
    // Um arquivo escolhido pelo usuário não deve ser apagado automaticamente.
    if (driver === 'file') return;
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
          store.delete(storagePath);
          const range = IDBKeyRange.bound(`${storagePath}::chunk::`, `${storagePath}::chunk::\uffff`);
          const cursor = store.openKeyCursor(range);
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (current) { store.delete(current.primaryKey); current.continue(); }
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
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

    try {
      const db = await this.getIdb();
      total += await new Promise<number>((resolve, reject) => {
        let bytes = 0;
        const request = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) { resolve(bytes); return; }
          bytes += (cursor.value as Blob)?.size || 0;
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[OfflineStorage] Erro ao calcular bytes no IndexedDB:', e);
    }

    return total;
  }
}

export const offlineStorageDriver = new OfflineStorageDriver();
