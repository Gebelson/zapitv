export type LiveChannelCategory = 
  | 'todos'
  | 'favoritos'
  | 'aberta'
  | 'noticias'
  | 'esportes'
  | 'filmes_series'
  | 'infantil'
  | 'cultura'
  | 'educacao'
  | 'musica'
  | 'regionais'
  | 'documentarios';

export interface EpgProgram {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO string ou HH:mm
  endTime: string;   // ISO string ou HH:mm
  startMinutes: number; // Minutos desde 00:00 (fuso America/Sao_Paulo)
  endMinutes: number;   // Minutos desde 00:00 (fuso America/Sao_Paulo)
  category?: string;
  rating?: string;
  isFallback?: boolean;
}

export interface CurrentEpgState {
  currentProgram: EpgProgram;
  nextProgram?: EpgProgram;
  progressPercent: number; // 0 a 100
  elapsedMinutes: number;
  remainingMinutes: number;
  formattedStartTime: string;
  formattedEndTime: string;
  hasVerifiedSchedule: boolean;
}

export type ChannelHealthStatus = 
  | 'AVAILABLE' 
  | 'CHECKING' 
  | 'UNSTABLE'
  | 'UNAVAILABLE' 
  | 'EXTERNAL_ACCESS'
  | 'ERROR' 
  | 'EXPIRED' 
  | 'RESTRICTED'
  | 'INCONCLUSIVE';

export type ChannelAccessType = 'internal' | 'external' | 'restricted';

export interface LiveStreamSource {
  id: string;
  url: string;
  quality: string; // '1080p' | '720p' | '480p' | 'Auto'
  provider: string; // 'Oficial', 'Stremio', 'M3U', 'PlutoTV'
  format?: 'hls' | 'dash' | 'mp4';
  isOfficial?: boolean;
  isBackup?: boolean;
  status?: ChannelHealthStatus;
  resolutionHeight?: number;
  lastChecked?: number;
  failureCount?: number;
}

export interface LiveChannel {
  id: string; // Canonical slug (e.g. 'tv-cultura', 'tv-brasil', 'globo-sp')
  canonicalId?: string;
  number?: number;
  name: string;
  shortName?: string;
  description?: string;
  logo: string;
  fallbackLogo?: string;
  category: LiveChannelCategory;
  categoryLabel: string;
  streamUrl: string; // Primary playable stream
  sources?: LiveStreamSource[]; // All available fallback sources ranked
  backupStreamUrls?: string[];
  accessType?: ChannelAccessType;
  epgId?: string;
  quality: string; // '1080p' | '720p' | '480p' | 'Auto'
  isHd?: boolean;
  isOfficial: boolean;
  requiresExternalAccess?: boolean; // Para canais protegidos/lineares pagos (SporTV, ESPN)
  externalAccessUrl?: string; // Link direto para o serviço oficial
  externalProviderName?: string; // Ex: 'Globoplay Oficial', 'ESPN / Disney+'
  status: ChannelHealthStatus;
  lastChecked?: number;
  programs?: EpgProgram[]; // Grade diária
  country?: string; // 'BR'
  region?: string;
  broadcaster?: string;
  isEnabled?: boolean;
}

export interface RawChannelInput {
  id?: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  groupTitle?: string;
  name: string;
  url: string;
  quality?: string;
  provider: string;
  category?: string;
  isOfficial?: boolean;
  requiresExternalAccess?: boolean;
  externalAccessUrl?: string;
  externalProviderName?: string;
  description?: string;
  country?: string;
  region?: string;
  sources?: LiveStreamSource[];
  backupStreamUrls?: string[];
}

export interface LiveTvPreferencesState {
  favoriteChannelIds: string[];
  lastWatchedChannelId: string | null;
  selectedCategory: LiveChannelCategory;
  preferredQuality: string;
  volume: number;
  isMuted: boolean;
  activeMode: 'programas' | 'televisao';
}

export interface LiveTVProviderConfig {
  id: string;
  name: string;
  type: 'stremio' | 'm3u' | 'official';
  url?: string;
  enabled: boolean;
  channelCount?: number;
  lastSync?: number;
  autoRefreshMinutes?: number;
}

export interface LiveTVProvider {
  id: string;
  name: string;
  type: 'stremio' | 'm3u' | 'official';
  enabled: boolean;
  fetchChannels(): Promise<RawChannelInput[]>;
}
