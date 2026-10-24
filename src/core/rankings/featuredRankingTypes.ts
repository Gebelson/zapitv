/**
 * ZAPITV — TIPOS DO SISTEMA DE RANKINGS EM DESTAQUE (IMDb + ANILIST + DISPONIBILIDADE REAL)
 * Suporte a Rankings Mensais Independentes: Filmes, Séries e Animes
 */

import { ContentItem } from '../../../types';

export type RankingMediaType = 'movie' | 'series' | 'anime';

export interface ImdbRankItem {
  rankType: RankingMediaType;
  position: number;           // Posição no ranking IMDb (1..100)
  imdbId: string;             // ID canônico do IMDb (tt...)
  title: string;              // Título de exibição internacional / português
  originalTitle?: string;     // Título original
  year?: number;              // Ano de lançamento
  referenceDate: string;      // Data de referência do ranking (YYYY-MM-DD)
  capturedAt: number;         // Timestamp da captura do snapshot
  source: 'imdb-moviemeter' | 'imdb-tvmeter' | 'anilist' | 'admin-import';
}

export interface ImdbWeeklySnapshot {
  id: string;                 // ex: 'snapshot-movie-2026-w42'
  weekKey: string;            // ex: '2026-W42'
  weekLabel: string;          // ex: 'Semana 42 (Outubro de 2026)'
  monthKey: string;           // ex: '2026-10' (retrocompatibilidade)
  rankType: RankingMediaType;
  referenceDate: string;      // YYYY-MM-DD
  capturedAt: number;
  items: ImdbRankItem[];
}

export interface WeeklyRankingCandidate {
  imdbId: string;
  position: number;           // Posição no ranking da semana
  title: string;
  originalTitle?: string;
  year?: number;
  rankType: RankingMediaType;
  referenceDate: string;
}

export interface ConsolidatedMonthlyCandidate {
  imdbId: string;
  title: string;
  originalTitle?: string;
  year?: number;
  rankType: RankingMediaType;
  cumulativeScore: number;     // Soma ponderada das pontuações semanais do mês
  bestPosition: number;        // Melhor posição atingida no mês
  appearancesCount: number;    // Quantidade de snapshots semanais em que o título apareceu
  originalPositions: number[]; // Posições registradas em cada snapshot do mês
  source?: string;
  aniListId?: number;
  tmdbId?: string;
}

export interface ConsolidatedMonthlyRanking {
  monthKey: string;            // ex: '2026-10'
  monthLabel: string;          // ex: 'Outubro de 2026'
  rankType: RankingMediaType;
  isProvisionalWeekly: boolean;// true se gerado a partir de dados semanais parciais/provisórios
  snapshotsIncluded: string[]; // IDs dos snapshots semanais consolidados
  candidates: ConsolidatedMonthlyCandidate[];
}

export interface FeaturedAuditItem {
  imdbId?: string;
  aniListId?: number;
  tmdbId?: string;
  title: string;
  imdbTitle?: string;
  canonicalTitle?: string;
  year?: number;
  mediaType: RankingMediaType;
  imdbRank?: number;           // Posição original no ranking IMDb/AniList
  displayRank?: number;        // Posição final atribuída no Top 10 (#1 a #10)
  rankPosition: number;        // Posição de origem no ranking avaliado
  finalPosition?: number;      // Posição final (#1 a #10)
  status: 'APPROVED' | 'REJECTED';
  isIncluded: boolean;         // true se incluído no Top 10
  rejectionReason?: string;    // Motivo explícito de exclusão conforme regras de elegibilidade
  canonicalId?: string;        // ID canônico no catálogo do ZapiTV
  availabilityStatus?: string; // Status de disponibilidade real
  hasAudioPtBr?: boolean;      // Disponibilidade de áudio PT-BR (não obrigatório para aprovação)
  audioStatus?: string;        // 'pt-br-dubbed' | 'pt-br-original' | 'other'
  verifiedSourcesCount?: number;
  score?: number;
}

export type FeaturedUpdateStatus = 'SUCCESS' | 'IDLE' | 'UP_TO_DATE' | 'FALLBACK_RETAINED' | 'ERROR';

/**
 * Item individual classificado em um dos Top 10 Mensais Oficiais
 */
export interface MonthlyRankedItem {
  position: number;            // Posição oficial no Top 10 da ZapiTV (1..10)
  canonicalId: string;
  mediaType: RankingMediaType;
  title: string;
  originalTitle?: string;
  year?: number;
  poster: string;
  backdrop?: string;
  rating?: number;
  item: ContentItem;
  calculatedScore: number;     // Pontuação mensal calculada pela fórmula oficial
  source: string;              // 'imdb-moviemeter' | 'imdb-tvmeter' | 'anilist' | 'tmdb'
  originalPosition?: number;   // Posição de origem no provedor
  monthKey: string;            // '2026-10'
  monthLabel: string;          // 'Outubro de 2026'
  isPartial: boolean;          // true se o mês está em andamento ("Outubro de 2026 · Parcial")
  validationStatus: string;
  updatedAt: number;
}

/**
 * Snapshot oficial de ranking mensal consolidado
 */
export interface MonthlyRankingSnapshot {
  monthKey: string;            // '2026-10'
  monthLabel: string;          // 'Outubro de 2026'
  year: number;
  month: number;               // 1..12
  isCurrentMonth: boolean;
  statusLabel: string;         // 'Outubro de 2026 · Parcial' ou 'Outubro de 2026'
  lastUpdatedAt: number;
  nextScheduledUpdate: number;
  nextScheduledUpdateFormatted: string;
  movies: MonthlyRankedItem[];
  series: MonthlyRankedItem[];
  animes: MonthlyRankedItem[];
  totalCandidatesEvaluated: {
    movies: number;
    series: number;
    animes: number;
  };
  auditTrail: {
    approvedMovies: FeaturedAuditItem[];
    rejectedMovies: FeaturedAuditItem[];
    approvedSeries: FeaturedAuditItem[];
    rejectedSeries: FeaturedAuditItem[];
    approvedAnimes: FeaturedAuditItem[];
    rejectedAnimes: FeaturedAuditItem[];
  };
}

export interface FeaturedSelectionResult {
  weekKey: string;                           // ex: '2026-W42'
  weekLabel: string;                         // ex: 'Semana 42 (Outubro de 2026)'
  monthKey: string;                          // '2026-10' (derivado automaticamente)
  monthLabel: string;                        // 'Outubro de 2026'
  monthlyStatusLabel?: string;               // 'Outubro de 2026 · Parcial' ou 'Outubro de 2026'
  isPartialMonth?: boolean;                  // true se mês em andamento
  referenceDate: string;                     // ex: '2026-10-12'
  lastUpdatedAt: number;                     // Timestamp ms da última publicação bem-sucedida
  lastCheckedAt?: number;                    // Timestamp ms da última verificação executada
  nextScheduledUpdate: number;               // Timestamp ms da próxima execução agendada (segunda 06:00 BRT)
  nextScheduledUpdateFormatted: string;      // ex: 'Segunda-feira, 19/10/2026 às 06:00 (BRT)'
  sourceReference: string;                   // 'IMDb MOVIEmeter & TVmeter (Mensal Consolidado) + AniList'
  updateStatus: FeaturedUpdateStatus;        // Status da última operação de atualização
  lastErrorReason?: string;                  // Detalhe de erro caso tenha ocorrido fallback
  isProvisionalWeekly: boolean;
  featuredMovies: ContentItem[];
  featuredSeries: ContentItem[];
  featuredAnimes: ContentItem[];
  monthlyRanking?: MonthlyRankingSnapshot;
  totalCandidatesEvaluated: {
    movies: number;
    series: number;
    animes?: number;
  };
  auditTrail: {
    approvedMovies: FeaturedAuditItem[];
    rejectedMovies: FeaturedAuditItem[];
    approvedSeries: FeaturedAuditItem[];
    rejectedSeries: FeaturedAuditItem[];
    approvedAnimes?: FeaturedAuditItem[];
    rejectedAnimes?: FeaturedAuditItem[];
  };
}
