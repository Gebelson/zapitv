/**
 * Stremio Addon Protocol v3 Types
 * Specification: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
 */

export interface StremioManifestCatalog {
  type: string;
  id: string;
  name: string;
  genres?: string[];
  extra?: {
    name: string;
    isRequired?: boolean;
    options?: string[];
  }[];
}

export interface StremioManifestResource {
  name: 'catalog' | 'meta' | 'stream' | 'subtitles';
  types: ('movie' | 'series' | 'anime' | 'other')[];
  idPrefixes?: string[];
}

export interface StremioManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  resources: (string | StremioManifestResource)[];
  types: ('movie' | 'series' | 'anime' | 'channel' | 'tv')[];
  catalogs: StremioManifestCatalog[];
  idPrefixes?: string[];
  icon?: string;
  background?: string;
}

export interface StremioStreamBehaviorHints {
  notWebReady?: boolean;
  bingeGroup?: string;
  proxyHeaders?: {
    request?: Record<string, string>;
    response?: Record<string, string>;
  };
  headers?: Record<string, string>;
}

export interface StremioStream {
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  externalUrl?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  behaviorHints?: StremioStreamBehaviorHints;
  
  // Custom enrichment for ZapiTV audio/video engine
  isPtBr?: boolean;
  isDubbed?: boolean;
  isSubtitled?: boolean;
  badge?: '🔊💬' | '🔊' | '💬' | '❌';
  badgeLabel?: string;
  quality?: '4K' | '1080p' | '720p' | '480p' | 'HD' | 'SD';
  providerName?: string;
  providerId?: string;
  sourceType?: 'hls' | 'mp4' | 'dash' | 'webm';
  isTorrent?: boolean;
  isDirectVideo?: boolean;
  requiresEngine?: boolean;
  imdbId?: string;
  tmdbId?: string | number;
}

export interface StremioMetaVideo {
  id: string;
  title: string;
  season: number;
  episode: number;
  released?: string;
  thumbnail?: string;
  overview?: string;
}

export interface StremioMeta {
  id: string;
  type: 'movie' | 'series' | 'anime';
  name: string;
  genres?: string[];
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  year?: number;
  imdbRating?: string;
  runtime?: string;
  cast?: string[];
  director?: string[];
  videos?: StremioMetaVideo[];
}

export interface StremioCatalogResponse {
  metas: StremioMeta[];
}

export interface StremioMetaResponse {
  meta: StremioMeta;
}

export interface StremioStreamResponse {
  streams: StremioStream[];
}
