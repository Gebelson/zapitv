/**
 * ZapiTV - Collaborative Recommendation Types
 * Tipos e interfaces para o sistema de Filtragem Colaborativa Item-Item e Ranking Híbrido
 */

export interface AnonymousInteractionEvent {
  anonymousId: string;     // Identificador pseudonimizado (UUID v4 sem PII ou fingerprinting)
  contentId: string;       // ID do conteúdo assistido/favoritado
  weight: number;          // Peso implícito [0.1 a 1.0]
  timestamp: number;       // Timestamp do evento
  category?: string;       // Categoria para validação
}

export interface ItemItemSimilarity {
  targetId: string;        // ID do item co-recorrente
  score: number;           // Similaridade ajustada [0, 1]
  coOccurrenceCount: number; // Quantidade de usuários que consumiram ambos
}

export interface CollaborativeModel {
  version: number;
  trainedAt: string;
  totalInteractions: number;
  uniqueUsersCount: number;
  catalogCoverage: number; // Porcentagem do catálogo com conexões colaborativas
  isActivated: boolean;    // Se atingiu os critérios estatísticos de ativação
  confidenceScore: number; // Confiança estatística global [0, 1]
  itemSimilarities: Record<string, ItemItemSimilarity[]>; // itemId -> lista de itens similares
}

export interface CollaborativeActivationCriteria {
  minUniqueUsers: number;    // Mínimo de usuários únicos (padrão: 5 para ativação inicial)
  minInteractions: number;   // Mínimo de eventos agregados (padrão: 20)
  minCatalogCoverage: number;// Mínimo de cobertura de catálogo (padrão: 0.05 = 5%)
  maxCollaborativeWeight: number; // Teto do peso colaborativo alpha (padrão: 0.35)
}

export const DEFAULT_ACTIVATION_CRITERIA: CollaborativeActivationCriteria = {
  minUniqueUsers: 5,
  minInteractions: 20,
  minCatalogCoverage: 0.05,
  maxCollaborativeWeight: 0.35
};

export interface HybridScoreBreakdown {
  contentScore: number;
  collaborativeScore: number;
  collaborativeWeight: number; // alpha efetivo
  finalScore: number;
  isCollaborativeActive: boolean;
  matchReasons: string[];
}
