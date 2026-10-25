/**
 * Tipos e Interfaces para Exclusividades e Originais de Plataformas de Streaming
 */

export type StreamingPlatformId =
  | 'netflix'
  | 'disney'
  | 'prime'
  | 'hbo'
  | 'apple'
  | 'paramount'
  | 'globoplay'
  | 'crunchyroll';

export interface PlatformMetadataEntry {
  tmdbId?: string | number;
  imdbId?: string;
  canonicalId?: string;
  title: string;
  year?: number;
  mediaType?: 'movie' | 'series' | 'anime';
  
  // Exclusividade e direitos de distribuição
  originalPlatform: StreamingPlatformId; // Produtora/comissionadora original
  currentExclusivePlatform: StreamingPlatformId; // Detentora dos direitos de exclusividade atuais
  brazilExclusive: boolean; // Exclusividade comprovada no território brasileiro
  distributor?: string;
  verifiedOriginal: boolean;
  notes?: string;
}

export interface PlatformCarouselConfig {
  id: StreamingPlatformId;
  title: string;
  minItemsToDisplay: number;
}

export const PLATFORM_CONFIGS: Record<StreamingPlatformId, PlatformCarouselConfig> = {
  netflix: {
    id: 'netflix',
    title: 'Exclusivos Netflix',
    minItemsToDisplay: 3
  },
  disney: {
    id: 'disney',
    title: 'Exclusivos Disney+',
    minItemsToDisplay: 3
  },
  prime: {
    id: 'prime',
    title: 'Exclusivos Prime Video',
    minItemsToDisplay: 3
  },
  hbo: {
    id: 'hbo',
    title: 'Exclusivos HBO Max',
    minItemsToDisplay: 3
  },
  apple: {
    id: 'apple',
    title: 'Exclusivos Apple TV+',
    minItemsToDisplay: 3
  },
  paramount: {
    id: 'paramount',
    title: 'Exclusivos Paramount+',
    minItemsToDisplay: 3
  },
  globoplay: {
    id: 'globoplay',
    title: 'Exclusivos Globoplay',
    minItemsToDisplay: 3
  },
  crunchyroll: {
    id: 'crunchyroll',
    title: 'Exclusivos Crunchyroll',
    minItemsToDisplay: 3
  }
};
