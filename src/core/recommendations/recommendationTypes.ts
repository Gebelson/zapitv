import { ContentItem, ContentType } from '../../../types';

export type InteractionType =
  | 'playback_start'
  | 'progress_update'
  | 'completed'
  | 'favorite_add'
  | 'favorite_remove'
  | 'watchlist_add'
  | 'watchlist_remove'
  | 'detail_view';

export interface UserInteraction {
  id: string;
  profileId: string;
  contentId: string;
  type: InteractionType;
  timestamp: number;
  watchPercentage?: number; // 0 a 100
  duration?: number;        // segundos
  currentTime?: number;     // segundos
  isError?: boolean;        // Se a sessão encerrou com erro no player (não penalizar!)
  genres?: string[];
  title?: string;
  contentType?: ContentType;
  audioLanguage?: string;
}

export interface UserPreferenceProfile {
  profileId: string;
  isChild?: boolean;
  genreAffinities: Record<string, number>;      // Gênero -> afinidade [0, 1]
  themeAffinities: Record<string, number>;      // Tema / keyword -> afinidade [0, 1]
  directorAffinities: Record<string, number>;   // Diretor / criador -> peso
  castAffinities: Record<string, number>;       // Ator -> peso
  typeAffinities: Record<string, number>;       // FILME, SÉRIE, ANIME -> peso relativo
  completedContentIds: string[];                // IDs de obras concluídas (>= 85%)
  watchedContentIds: string[];                  // IDs de obras assistidas significativamente (>= 25%)
  favoriteContentIds: string[];                 // IDs em favoritos / minha lista
  preferredAudioLanguage?: string;              // 'pt-BR' | 'ja' | 'en' | etc.
  totalEngagementScore: number;                 // Soma ponderada de engajamento
  lastUpdated: number;
  interactionCount: number;
}

export interface RankingWeights {
  affinity: number;       // Padrão: 0.40 (40%)
  similarity: number;     // Padrão: 0.20 (20%)
  popularity: number;     // Padrão: 0.15 (15%)
  novelty: number;        // Padrão: 0.10 (10%)
  rating: number;         // Padrão: 0.10 (10%)
  audioPreference: number;// Padrão: 0.05 (5%)
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  affinity: 0.40,
  similarity: 0.20,
  popularity: 0.15,
  novelty: 0.10,
  rating: 0.10,
  audioPreference: 0.05
};

export interface ScoredCandidate {
  item: ContentItem;
  finalScore: number;
  breakdown: {
    affinity: number;
    similarity: number;
    popularity: number;
    novelty: number;
    rating: number;
    audio: number;
  };
  isDiscovery?: boolean;
  matchReasons?: string[];
}

export interface CandidateGenerationOptions {
  category?: ContentType | 'all';
  genreFilter?: string;
  excludeContentIds?: string[];
  limit?: number;
  allowAdult?: boolean;
}

export interface RankingOptions {
  isChild?: boolean;
  isExplicitAnimationFilter?: boolean;
  category?: 'movies' | 'series' | 'animes' | 'all';
}

export interface DiversityOptions {
  maxConsecutiveSameGenre?: number; // Padrão: 2
  maxSameFranchiseTopN?: number;    // Padrão: 1 nos primeiros 5
  discoveryRatio?: number;          // Padrão: 0.15 (15% reservado para descobertas)
  isChildProfile?: boolean;
  isExplicitAnimationFilter?: boolean;
  category?: string;
  topLiveActionSlots?: number;      // Número de posições iniciais reservadas prioritariamente para live-action
}

export interface PersonalizedRow {
  id: string;
  title: string;
  subtitle?: string;
  items: ContentItem[];
  reasonType:
    | 'continue_watching'
    | 'top_recommendations'
    | 'because_you_watched'
    | 'genre_affinity'
    | 'critically_acclaimed'
    | 'trending'
    | 'new_releases'
    | 'custom'
    | 'platform_exclusives';
  sourceTitle?: string;
}
