import { ContentItem, ContentType } from '../../../types';

export type DownloadStatus = 
  | 'pending'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled';

export type StorageDriverType = 'opfs' | 'idb' | 'file';

export interface OfflineAudioTrack {
  name: string;
  language: string; // 'pt-BR', 'en', etc.
  isDubbed: boolean;
  isOriginal: boolean;
  codec?: string;
}

export interface OfflineSubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface OfflineSubtitleTrack {
  id: string;
  languageName: string;
  languageCode: string;
  isPtBr: boolean;
  cues: OfflineSubtitleCue[];
  format: 'vtt' | 'srt';
}

export interface OfflineDownload {
  id: string; // Ex: 'dl_item123_s1_e1_720p'
  itemId: string;
  title: string;
  originalTitle?: string;
  type: ContentType;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  image: string; // Imagem em Base64 ou URL local para renderização 100% offline
  backdrop?: string;
  genres: string[];
  quality: string; // '480p' | '720p' | '1080p'
  format: 'mp4' | 'webm' | 'hls';
  sourceUrl: string;
  audioTrack: OfflineAudioTrack;
  subtitles: OfflineSubtitleTrack[];
  storagePath: string; // Nome do arquivo no OPFS ou ID no IDB
  storageDriver: StorageDriverType;
  fileHandle?: FileSystemFileHandle; // Concedido pelo usuário; permanece apenas no IndexedDB local.
  totalBytes: number;
  downloadedBytes: number;
  speedBytesPerSec: number;
  status: DownloadStatus;
  errorReason?: string;
  createdAt: number;
  completedAt?: number;
  lastPlaybackPosition: number;
  duration: number;
}

export interface StorageEstimateResult {
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  downloadsBytes: number;
  usagePercent: number;
  isPersistent: boolean;
}

export interface DownloadQualityOption {
  method?: 'web' | 'helper';
  quality: string; // '480p' | '720p' | '1080p'
  estimatedBytes: number;
  sourceUrl: string;
  sourceType: 'mp4' | 'webm' | 'hls';
  isDubbed: boolean;
  audioLanguage: string;
  isAuthorized: boolean;
  unauthorizedReason?: string;
}
