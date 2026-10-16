/**
 * ZapiTV — OfflineDownloadManager
 * Motor orquestrador de downloads offline.
 * - Gerenciamento de fila com concorrência limitada (máx 2 downloads simultâneos)
 * - Escrita direta em chunks no OPFS sem estourar memória RAM
 * - Estimativa e proteção de quota de disco (navigator.storage.estimate)
 * - Pausar, retomar e cancelar com liberação atômica de espaço
 * - Validação obrigatória de áudio antes de marcar como concluído
 * - Armazenamento de metadados de capa e legendas offline
 */

import { offlineDb } from './offlineDb';
import { offlineStorageDriver } from './offlineStorageDriver';
import { offlineSourceInspector } from './offlineSourceInspector';
import { browserCompatibilityService } from './browserCompatibilityService';
import { hlsDownloadService } from './hlsDownloadService';
import {
  OfflineDownload,
  StorageEstimateResult,
  OfflineSubtitleTrack,
  DownloadStatus
} from './offlineTypes';
import { ContentItem } from '../../../types';
import { StremioStream } from '../stremio/stremioTypes';

const MAX_CONCURRENT_DOWNLOADS = 2;

export class OfflineDownloadManager {
  private activeControllers: Map<string, AbortController> = new Map();
  private speedTrackers: Map<string, { lastBytes: number; lastTime: number }> = new Map();
  private isProcessingQueue = false;

  constructor() {
    // Inicializa o banco de metadados
    offlineDb.init().then(() => {
      this.processQueue();
    });
  }

  /**
   * Obtém a estimativa de espaço em disco no dispositivo do usuário.
   */
  public async getStorageEstimate(): Promise<StorageEstimateResult> {
    let usedBytes = 0;
    let quotaBytes = 0;
    let availableBytes = 0;
    let isPersistent = false;

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        usedBytes = estimate.usage || 0;
        quotaBytes = estimate.quota || 0;
        availableBytes = Math.max(0, quotaBytes - usedBytes);
      } catch (e) {
        console.warn('[OfflineDownloadManager] Erro ao estimar storage:', e);
      }
    }

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      try {
        isPersistent = await navigator.storage.persisted();
      } catch {}
    }

    const downloadsBytes = await offlineStorageDriver.getDownloadedBytesTotal();
    const usagePercent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

    return {
      usedBytes,
      quotaBytes,
      availableBytes,
      downloadsBytes,
      usagePercent,
      isPersistent
    };
  }

  /**
   * Solicita persistência de dados para evitar que o navegador limpe o cache automaticamente.
   */
  public async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        return await navigator.storage.persist();
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  /**
   * Converte uma imagem da web para DataURL Base64 para garantir exibição 100% offline.
   */
  private async cacheImageAsDataUrl(imageUrl: string): Promise<string> {
    if (!imageUrl || imageUrl.startsWith('data:')) return imageUrl;
    try {
      const res = await fetch(imageUrl, { cache: 'force-cache', signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        const blob = await res.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string || imageUrl);
          reader.readAsDataURL(blob);
        });
      }
    } catch {}
    return imageUrl;
  }

  /**
   * Inicia o download de um item ou episódio.
   */
  public async startDownload(params: {
    item: ContentItem;
    selectedStream: StremioStream;
    season?: number;
    episode?: number;
    episodeTitle?: string;
    subtitles?: OfflineSubtitleTrack[];
  }): Promise<string> {
    const { item, selectedStream, season, episode, episodeTitle, subtitles = [] } = params;

    const quality = selectedStream.quality || '720p';
    const isDubbed = Boolean(selectedStream.isDubbed || selectedStream.isPtBr);
    const audioLanguage = isDubbed ? 'pt-BR' : 'original';

    const downloadId = `dl_${item.id}_s${season || 0}_e${episode || 0}_${quality}`;

    // Verifica se já existe um download deste mesmo episódio/obra
    const existing = offlineDb.getDownload(downloadId);
    if (existing && existing.status === 'completed') {
      return downloadId;
    }

    // 1. Verifica espaço em disco antes de iniciar
    const estimate = await this.getStorageEstimate();
    const estimatedRequiredBytes = 500 * 1024 * 1024; // 500 MB de margem de segurança mínima
    if (estimate.quotaBytes > 0 && estimate.availableBytes < estimatedRequiredBytes) {
      throw new Error(`Espaço insuficiente no dispositivo. Disponível: ${Math.round(estimate.availableBytes / (1024 * 1024))} MB.`);
    }

    // 2. Prepara imagem local
    const localCover = await this.cacheImageAsDataUrl(item.image);

    // 3. Define driver de armazenamento conforme compatibilidade real do navegador (iOS/Safari -> IDB, Chrome/Edge/Firefox -> OPFS)
    const capabilities = await browserCompatibilityService.getCapabilities();
    const opfsSupported = await offlineStorageDriver.checkOpfsSupport();
    const storageDriver = (opfsSupported && capabilities.recommendedStorageDriver === 'opfs') ? 'opfs' : 'idb';
    const isHls = selectedStream.url.includes('.m3u8') || selectedStream.sourceType === 'hls';
    const format = isHls ? 'mp4' : (selectedStream.url.includes('.webm') ? 'webm' : 'mp4');
    const storagePath = `${downloadId}.${format}`;

    const downloadRecord: OfflineDownload = {
      id: downloadId,
      itemId: item.id,
      title: item.title,
      originalTitle: item.originalTitle,
      type: item.type,
      season,
      episode,
      episodeTitle,
      image: localCover,
      backdrop: item.backdrop,
      genres: item.genres || [],
      quality,
      format: 'mp4',
      sourceUrl: selectedStream.url,
      audioTrack: {
        name: isDubbed ? 'Português (Brasil)' : 'Áudio Original',
        language: audioLanguage,
        isDubbed,
        isOriginal: !isDubbed
      },
      subtitles,
      storagePath,
      storageDriver,
      totalBytes: 0,
      downloadedBytes: 0,
      speedBytesPerSec: 0,
      status: 'pending',
      createdAt: Date.now(),
      lastPlaybackPosition: 0,
      duration: 0
    };

    await offlineDb.saveDownload(downloadRecord);
    this.processQueue();

    return downloadId;
  }

  /**
   * Enfileira todos os episódios disponíveis de uma temporada para download.
   */
  public async downloadSeason(params: {
    item: ContentItem;
    season: number;
    episodes: Array<{ number: number; title: string; stream: StremioStream }>;
    subtitlesMap?: Record<number, OfflineSubtitleTrack[]>;
  }): Promise<string[]> {
    const ids: string[] = [];
    for (const ep of params.episodes) {
      const id = await this.startDownload({
        item: params.item,
        selectedStream: ep.stream,
        season: params.season,
        episode: ep.number,
        episodeTitle: ep.title,
        subtitles: params.subtitlesMap?.[ep.number] || []
      });
      ids.push(id);
    }
    return ids;
  }

  /**
   * Pausa um download em andamento.
   */
  public async pauseDownload(id: string): Promise<void> {
    const controller = this.activeControllers.get(id);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(id);
    }
    this.speedTrackers.delete(id);
    await offlineDb.updateDownload(id, {
      status: 'paused',
      speedBytesPerSec: 0
    });
    this.processQueue();
  }

  /**
   * Retoma um download pausado ou que falhou.
   */
  public async resumeDownload(id: string): Promise<void> {
    const item = offlineDb.getDownload(id);
    if (item && (item.status === 'paused' || item.status === 'error')) {
      await offlineDb.updateDownload(id, {
        status: 'pending',
        errorReason: undefined
      });
      this.processQueue();
    }
  }

  /**
   * Cancela e remove um download, liberando espaço físico no disco.
   */
  public async cancelDownload(id: string): Promise<void> {
    const controller = this.activeControllers.get(id);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(id);
    }
    this.speedTrackers.delete(id);

    const item = offlineDb.getDownload(id);
    if (item) {
      await offlineStorageDriver.deleteFile(item.storagePath, item.storageDriver);
      await offlineDb.deleteDownload(id);
    }
    this.processQueue();
  }

  /**
   * Processador da fila de downloads com controle de concorrência.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      const all = offlineDb.getAllDownloads();
      const downloadingCount = all.filter(d => d.status === 'downloading').length;

      if (downloadingCount < MAX_CONCURRENT_DOWNLOADS) {
        const slotsAvailable = MAX_CONCURRENT_DOWNLOADS - downloadingCount;
        const pendingItems = all.filter(d => d.status === 'pending').slice(0, slotsAvailable);

        for (const item of pendingItems) {
          this.executeDownload(item).catch(err => {
            console.error('[OfflineDownloadManager] Erro no download:', item.id, err);
          });
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Executa a transferência de um download específico em streaming.
   */
  private async executeDownload(download: OfflineDownload): Promise<void> {
    const id = download.id;
    const controller = new AbortController();
    this.activeControllers.set(id, controller);

    await offlineDb.updateDownload(id, {
      status: 'downloading',
      speedBytesPerSec: 0
    });

    try {
      const isHls = download.sourceUrl.includes('.m3u8') || download.format === 'hls';
      let currentDownloaded = download.downloadedBytes;

      if (isHls) {
        const writer = await offlineStorageDriver.createWriter(download.storagePath, download.storageDriver);
        try {
          const total = await hlsDownloadService.downloadHlsStream({
            mediaPlaylistUrl: download.sourceUrl,
            writer,
            signal: controller.signal,
            onProgress: (dlBytes, totBytes, speed) => {
              offlineDb.updateDownload(id, {
                downloadedBytes: dlBytes,
                totalBytes: totBytes,
                speedBytesPerSec: speed
              });
            }
          });
          await writer.close();
          currentDownloaded = total;
        } catch (hlsErr) {
          await writer.abort();
          throw hlsErr;
        }
      } else {
        const headers: Record<string, string> = {};
        if (download.downloadedBytes > 0) {
          headers['Range'] = `bytes=${download.downloadedBytes}-`;
        }

        const response = await fetch(download.sourceUrl, {
          headers,
          signal: controller.signal
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Falha HTTP ao baixar vídeo: status ${response.status}`);
        }

        // Obtém tamanho total do arquivo
        let totalBytes = download.totalBytes;
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)$/);
          if (match) totalBytes = parseInt(match[1], 10);
        } else {
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            totalBytes = (download.downloadedBytes || 0) + parseInt(contentLength, 10);
          }
        }

        await offlineDb.updateDownload(id, { totalBytes });

        const body = response.body;
        if (!body) {
          throw new Error('Corpo de resposta de stream vazio.');
        }

        const reader = body.getReader();
        const writer = await offlineStorageDriver.createWriter(download.storagePath, download.storageDriver);

        this.speedTrackers.set(id, { lastBytes: currentDownloaded, lastTime: Date.now() });

        let lastUiUpdate = Date.now();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value && value.length > 0) {
            await writer.write(value);
            currentDownloaded += value.length;

            // Atualiza velocidade e progresso periodicamente (a cada 400ms para manter UI fluida)
            const now = Date.now();
            if (now - lastUiUpdate > 400) {
              const tracker = this.speedTrackers.get(id);
              let speed = 0;
              if (tracker) {
                const timeDiffSec = (now - tracker.lastTime) / 1000;
                if (timeDiffSec > 0) {
                  speed = Math.round((currentDownloaded - tracker.lastBytes) / timeDiffSec);
                }
                tracker.lastBytes = currentDownloaded;
                tracker.lastTime = now;
              }

              await offlineDb.updateDownload(id, {
                downloadedBytes: currentDownloaded,
                speedBytesPerSec: speed
              });
              lastUiUpdate = now;
            }
          }
        }

        await writer.close();
      }
      this.activeControllers.delete(id);
      this.speedTrackers.delete(id);

      // Validação obrigatória pós-download (confirmar vídeo e áudio intactos)
      const downloadedFile = await offlineStorageDriver.getFile(download.storagePath, download.storageDriver);
      const integrity = await offlineSourceInspector.verifyMediaIntegrity(downloadedFile);

      if (!integrity.isValid || !integrity.hasAudio) {
        await offlineStorageDriver.deleteFile(download.storagePath, download.storageDriver);
        throw new Error(integrity.error || 'Falha de validação: arquivo sem faixa de áudio compatível.');
      }

      // Sucesso total
      await offlineDb.updateDownload(id, {
        downloadedBytes: currentDownloaded,
        totalBytes: currentDownloaded,
        speedBytesPerSec: 0,
        status: 'completed',
        completedAt: Date.now()
      });
    } catch (err: any) {
      this.activeControllers.delete(id);
      this.speedTrackers.delete(id);

      if (err.name === 'AbortError') {
        // Pausado ou cancelado intencionalmente
        return;
      }

      console.warn(`[OfflineDownloadManager] Erro no download ${id}:`, err);
      await offlineDb.updateDownload(id, {
        status: 'error',
        errorReason: err.message || 'Falha na transferência do arquivo',
        speedBytesPerSec: 0
      });
    } finally {
      this.processQueue();
    }
  }
}

export const offlineDownloadManager = new OfflineDownloadManager();
if (typeof window !== 'undefined') {
  (window as any).__zapitv_offlineDownloadManager = offlineDownloadManager;
}
