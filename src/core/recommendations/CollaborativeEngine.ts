/**
 * ZapiTV - CollaborativeEngine
 * Motor de Inferência Colaborativa do Cliente:
 * 1. Sincroniza periodicamente o modelo colaborativo Item-Item agregado do backend
 * 2. Pontua candidatos com base nas correlações coletivas de usuários com gostos semelhantes
 * 3. Determina o peso dinâmico alpha [0.0 a 0.35] com base na ativação e confiança estatística
 * 4. Despacha eventos consentidos pseudonimizados de forma assíncrona
 */

import { ContentItem } from '../../../types';
import {
  CollaborativeModel,
  DEFAULT_ACTIVATION_CRITERIA
} from './collaborativeTypes';
import { consentManager } from './consentManager';
import { userPreferenceStore } from './userPreferenceStore';

export class CollaborativeEngine {
  private model: CollaborativeModel | null = null;
  private lastSyncTimestamp = 0;
  private readonly SYNC_INTERVAL_MS = 20 * 60 * 1000; // 20 minutos de cache
  private isSyncing = false;

  constructor() {
    this.hydrateFromStorageSync();
    this.syncModel().catch(() => {});
  }

  private hydrateFromStorageSync(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem('zapitv_cached_collab_model');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.model = parsed;
        }
      }
    } catch {}
  }

  /**
   * Sincroniza o modelo colaborativo do backend de forma silenciosa e em segundo plano.
   */
  public async syncModel(): Promise<CollaborativeModel | null> {
    if (this.isSyncing) return this.model;
    if (Date.now() - this.lastSyncTimestamp < this.SYNC_INTERVAL_MS && this.model) {
      return this.model;
    }

    this.isSyncing = true;
    try {
      const res = await fetch('/api/recommendations/model', { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data: CollaborativeModel = await res.json();
        if (data && typeof data === 'object') {
          this.model = data;
          this.lastSyncTimestamp = Date.now();
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem('zapitv_cached_collab_model', JSON.stringify(data));
            } catch {}
          }
        }
      }
    } catch {
      // Falha silenciosa: opera com modelo local em cache ou fallback de cold-start
    } finally {
      this.isSyncing = false;
    }

    return this.model;
  }

  /**
   * Permite definir o modelo diretamente (útil para testes unitários ou hidratação direta).
   */
  public setModel(model: CollaborativeModel): void {
    this.model = model;
    this.lastSyncTimestamp = Date.now();
  }

  /**
   * Retorna o modelo ativo ou nulo.
   */
  public getModel(): CollaborativeModel | null {
    return this.model;
  }

  /**
   * Despacha um evento pseudonimizado de consumo para o backend,
   * SOMENTE se o consentimento voluntário estiver ativo e o item NÃO for adulto.
   */
  public async dispatchConsentedEvent(item: ContentItem, weight: number): Promise<void> {
    if (!consentManager.canSendEvent(item)) return;

    const anonymousId = consentManager.getAnonymousClientId();
    const payload = {
      anonymousId,
      contentId: item.id,
      weight: Math.min(1.0, Math.max(0.1, weight)),
      timestamp: Date.now(),
      category: item.type
    };

    try {
      await fetch('/api/recommendations/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2500)
      });
    } catch {
      // Falha silenciosa tolerada em offline
    }
  }

  /**
   * Calcula a pontuação colaborativa para um candidato e o peso dinâmico alpha.
   */
  public scoreCandidate(
    candidate: ContentItem,
    profileId: string = 'default'
  ): { score: number; alpha: number; confidence: number; isCoOccurrent: boolean } {
    const fallback = { score: 0, alpha: 0, confidence: 0, isCoOccurrent: false };

    // Se o modelo não estiver ativado ou ausente, alpha é 0 (puro Content-Based)
    if (!this.model || !this.model.isActivated) {
      return fallback;
    }

    const profile = userPreferenceStore.getPreferencesSync(profileId);
    const userSeedIds = [
      ...profile.favoriteContentIds,
      ...profile.completedContentIds,
      ...profile.watchedContentIds.slice(-4)
    ];

    if (userSeedIds.length === 0) {
      return fallback;
    }

    const candidateId = candidate.id;
    let weightedSimSum = 0;
    let totalWeight = 0;
    let matchCount = 0;

    for (const seedId of userSeedIds) {
      // Verificar se o modelo conhece correlações a partir do item seed
      const similarTargets = this.model.itemSimilarities[seedId];
      if (similarTargets && Array.isArray(similarTargets)) {
        const link = similarTargets.find(t => t.targetId === candidateId);
        if (link) {
          const seedWeight = profile.favoriteContentIds.includes(seedId) ? 1.0 : 0.8;
          weightedSimSum += link.score * seedWeight;
          totalWeight += seedWeight;
          matchCount++;
        }
      }
    }

    if (totalWeight === 0 || matchCount === 0) {
      return fallback;
    }

    const rawCollabScore = weightedSimSum / totalWeight;
    const modelConfidence = this.model.confidenceScore || 0.5;

    // Alpha dinâmico: cresce suavemente até o teto (padrão: 0.35) conforme a confiança
    const maxAlpha = DEFAULT_ACTIVATION_CRITERIA.maxCollaborativeWeight;
    const userEngagementFactor = Math.min(1.0, userSeedIds.length / 3);
    const dynamicAlpha = Math.min(
      maxAlpha,
      Math.round((maxAlpha * modelConfidence * userEngagementFactor) * 1000) / 1000
    );

    return {
      score: Math.min(1.0, Math.round(rawCollabScore * 1000) / 1000),
      alpha: dynamicAlpha,
      confidence: modelConfidence,
      isCoOccurrent: true
    };
  }
}

export const collaborativeEngine = new CollaborativeEngine();
