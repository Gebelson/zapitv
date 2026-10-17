/**
 * ZapiTV — Central Inteligente de Feedbacks e Gestão de Problemas
 * Tipos e interfaces para relatos, agrupamento automático (clustering),
 * assinaturas técnicas (fingerprints), priorização e prompts técnicos de correção.
 */

export type FeedbackCategory =
  | 'video_not_loading'             // Vídeo não carrega
  | 'infinite_loading'              // Carregamento infinito
  | 'video_stuttering'              // Vídeo travando
  | 'wrong_movie_series'           // Filme ou série incorreta
  | 'wrong_episode'                // Episódio incorreto
  | 'wrong_dubbing'                // Dublagem incorreta
  | 'missing_dubbing_ptbr'         // Dublagem brasileira indisponível
  | 'subtitles_wrong_language'     // Legenda em outro idioma
  | 'subtitles_out_of_sync'        // Legenda fora de sincronia
  | 'no_sound'                     // Vídeo sem som
  | 'unstable_volume'              // Volume instável
  | 'wrong_quality'                // Qualidade de vídeo incorreta
  | 'search_problem'               // Problema na busca
  | 'catalog_problem'              // Problema no catálogo
  | 'live_channel_unavailable'     // Canal ao vivo indisponível
  | 'broken_interface'             // Interface com defeito
  | 'other_problem';               // Outro problema

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  video_not_loading: 'Vídeo não carrega',
  infinite_loading: 'Carregamento infinito',
  video_stuttering: 'Vídeo travando',
  wrong_movie_series: 'Filme ou série incorreta',
  wrong_episode: 'Episódio incorreto',
  wrong_dubbing: 'Dublagem incorreta',
  missing_dubbing_ptbr: 'Dublagem brasileira indisponível',
  subtitles_wrong_language: 'Legenda em outro idioma',
  subtitles_out_of_sync: 'Legenda fora de sincronia',
  no_sound: 'Vídeo sem som',
  unstable_volume: 'Volume instável',
  wrong_quality: 'Qualidade de vídeo incorreta',
  search_problem: 'Problema na busca',
  catalog_problem: 'Problema no catálogo',
  live_channel_unavailable: 'Canal ao vivo indisponível',
  broken_interface: 'Interface com defeito',
  other_problem: 'Outro problema'
};

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export type IssueStatus = 'new' | 'investigating' | 'fixing' | 'resolved' | 'reopened';

export type IssueTrend = 'increasing' | 'stable' | 'decreasing' | 'reappeared';

export type ClusterLevel = 1 | 2 | 3; // 1: Mesmo problema confirmado; 2: Possivelmente relacionado; 3: Problema sistêmico

export interface TechnicalContext {
  // Mídia
  canonicalMediaId?: string;
  mediaTitle?: string;
  mediaType?: 'movie' | 'series' | 'anime' | 'live' | 'app';
  season?: number;
  episode?: number;
  year?: number;
  tmdbId?: string;
  imdbId?: string;
  malId?: string;

  // Reprodução
  sourceId?: string;
  providerId?: string;
  streamName?: string;
  streamUrlHost?: string;
  streamType?: 'hls' | 'mp4' | 'direct' | 'webtorrent' | 'unknown';
  requestedLanguage?: string;
  declaredLanguage?: string;
  activeAudioTrack?: string;
  selectedQuality?: string;
  detectedResolution?: string;
  selectedSubtitleId?: string;
  playerState?: 'playing' | 'paused' | 'buffering' | 'idle' | 'error' | 'intro';
  currentTimeSeconds?: number;
  durationSeconds?: number;
  lastPlaybackAttemptTimestamp?: number;

  // Diagnóstico
  lastErrorMessage?: string;
  errorCode?: string;
  failureStage?: 'source_discovery' | 'hls_manifest' | 'decoding' | 'playback_stall' | 'audio_sync' | 'subtitle_fetch' | 'none';
  isStalling?: boolean;
  stallDurationMs?: number;
  isCorsRestricted?: boolean;
  streamAttemptsCount?: number;

  // Ambiente
  appVersion: string;
  deploymentId?: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'tv';
  currentRoute: string;
  timestamp: number;
}

export interface IssueFingerprintData {
  category: FeedbackCategory;
  canonicalMediaId?: string;
  season?: number;
  episode?: number;
  providerId?: string;
  sourceHost?: string;
  errorCode?: string;
  failureStage?: string;
  level: ClusterLevel;
}

export interface FeedbackReport {
  id: string;
  clusterId?: string;
  category: FeedbackCategory;
  categoryLabel: string;
  userDescription?: string;
  technicalContext: TechnicalContext;
  fingerprint: string;
  fingerprintData: IssueFingerprintData;
  submissionTimestamp: number;
  clientSubmissionToken: string;
  status: 'active' | 'archived';
  isDuplicateSuppressed?: boolean;
}

export interface IssueOccurrence {
  id: string;
  reportId: string;
  timestamp: number;
  version: string;
  providerId?: string;
  sourceId?: string;
}

export interface IssueHistoryEntry {
  id: string;
  timestamp: number;
  action:
    | 'created'
    | 'report_added'
    | 'priority_changed'
    | 'status_changed'
    | 'prompt_generated'
    | 'prompt_edited'
    | 'manual_merge'
    | 'manual_split'
    | 'reopened_regression'
    | 'admin_note';
  performedBy: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface GeneratedFixPrompt {
  id: string;
  clusterId: string;
  type: 'individual' | 'consolidated';
  version: number;
  markdownContent: string;
  generatedAt: number;
  isAiRefined: boolean;
  isManuallyEdited: boolean;
  feedbackIds: string[];
  variablesUsed: Record<string, any>;
}

export interface IssueCluster {
  id: string;
  title: string;
  category: FeedbackCategory;
  categoryLabel: string;
  priority: IssuePriority;
  status: IssueStatus;
  trend: IssueTrend;
  fingerprint: string;
  fingerprintData: IssueFingerprintData;
  
  // Contadores
  totalReports: number;
  estimatedDistinctUsers: number;
  recentReportsCount: number; // últimas 24h
  firstOccurrenceAt: number;
  lastOccurrenceAt: number;

  // Contexto consolidado
  affectedMedia: Array<{ id: string; title: string; type: string }>;
  affectedEpisodes: Array<{ season: number; episode: number }>;
  affectedSources: string[];
  affectedProviders: string[];
  affectedVersions: string[];
  errorCodes: string[];
  languagesInvolved: string[];

  // Prompts e Histórico
  activePromptId?: string;
  activePromptMarkdown?: string;
  promptVersion: number;
  isPromptOutdated: boolean;
  
  // Relações e Regressão
  relatedClusterIds: string[];
  isRegression: boolean;
  regressionDetails?: {
    previousResolvedAt: number;
    resolvedInVersion?: string;
    reopenedAt: number;
  };

  adminNotes?: string;
  history: IssueHistoryEntry[];
}

export interface FeedbackSubmissionRequest {
  category: FeedbackCategory;
  userDescription?: string;
  technicalContext: Partial<TechnicalContext>;
  clientSubmissionToken: string;
}

export interface FeedbackSubmissionResponse {
  success: boolean;
  reportId: string;
  clusterId: string;
  message: string;
  isNewCluster: boolean;
  isDuplicateIgnored?: boolean;
}

export interface FeedbackDashboardStats {
  newIssuesCount: number;
  criticalIssuesCount: number;
  recurrentIssuesCount: number;
  investigatingCount: number;
  fixingCount: number;
  resolvedCount: number;
  reopenedCount: number;
  totalFeedbacksReceived: number;
  totalUniqueClusters: number;
  topReportedClusters: IssueCluster[];
  priorityRankedClusters: IssueCluster[];
}
