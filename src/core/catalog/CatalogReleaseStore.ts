/**
 * ZapiTV - CatalogReleaseStore
 * Repositório e gerenciador em memória e persistente dos novos lançamentos descobertos
 * e validados pelo sistema automático.
 * 
 * Mantém:
 * - Obras novas adicionadas ao catálogo após validação de fontes
 * - Novos episódios identificados para séries e animes existentes
 * - Fila de títulos pendentes sem fonte (para rechecagem periódica sem sobrecarga)
 */

import { ContentItem, ContentType } from '../../../types';
import { deduplicateContentItems } from './catalogDeduplication';

export interface PendingCandidate {
  id: string;
  imdbId?: string;
  tmdbId?: string;
  title: string;
  type: ContentType;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  firstDiscoveredAt: number;
  lastCheckedAt: number;
  recheckAfter: number;
  attempts: number;
  reasonUnavailable: string;
}

export interface CatalogReleaseSnapshot {
  releases: ContentItem[];
  pending: PendingCandidate[];
}

export class CatalogReleaseStore {
  private static instance: CatalogReleaseStore;
  private releases: ContentItem[] = [];
  private pendingQueue = new Map<string, PendingCandidate>();
  private listeners = new Set<(releases: ContentItem[]) => void>();

  private constructor() {}

  private pendingKey(candidate: Pick<PendingCandidate, 'id' | 'imdbId' | 'type'>): string {
    return `${candidate.type === ContentType.MOVIE ? 'movie' : 'series'}:${candidate.imdbId || candidate.id}`;
  }

  public static getInstance(): CatalogReleaseStore {
    if (!CatalogReleaseStore.instance) {
      CatalogReleaseStore.instance = new CatalogReleaseStore();
    }
    return CatalogReleaseStore.instance;
  }

  /**
   * Retorna todos os novos lançamentos validados e prontos para exibição no catálogo
   */
  public getReleases(): ContentItem[] {
    return [...this.releases];
  }

  /** Snapshot used by the server to restore releases and pending rechecks after a cold start. */
  public getSnapshot(): CatalogReleaseSnapshot {
    return {
      releases: structuredClone(this.releases),
      pending: structuredClone([...this.pendingQueue.values()])
    };
  }

  public restoreSnapshot(snapshot: CatalogReleaseSnapshot | null): void {
    this.releases = snapshot ? deduplicateContentItems(structuredClone(snapshot.releases)) : [];
    this.pendingQueue = new Map(
      (snapshot?.pending || []).map(candidate => [this.pendingKey(candidate), structuredClone(candidate)])
    );
    this.notifyListeners();
  }

  /**
   * Adiciona um novo lançamento ao catálogo com deduplicação canônica
   */
  public addRelease(item: ContentItem): boolean {
    if (!item || !item.id || !item.title) return false;

    const itemFormat = item.mediaFormat || (item.type === ContentType.MOVIE ? 'movie' : 'series');
    const exists = this.releases.some(r => 
      (r.mediaFormat || (r.type === ContentType.MOVIE ? 'movie' : 'series')) === itemFormat && (
      r.id === item.id ||
      (r.imdbId && item.imdbId && r.imdbId.toLowerCase() === item.imdbId.toLowerCase()) ||
      (r.tmdbId && item.tmdbId && String(r.tmdbId) === String(item.tmdbId)))
    );

    if (exists) {
      return false;
    }

    this.releases = deduplicateContentItems([item, ...this.releases]);
    
    // Remove da fila de pendentes se estava aguardando
    const key = this.pendingKey(item);
    this.pendingQueue.delete(key);

    this.notifyListeners();
    return true;
  }

  /**
   * Adiciona um novo episódio a uma série ou anime existente no catálogo
   */
  public addEpisodeToWork(workId: string, episode: {
    id: string;
    number: number;
    title: string;
    description?: string;
    image?: string;
    season?: number;
    videoUrl?: string;
  }, workType?: ContentType): boolean {
    const target = this.releases.find(r =>
      (!workType || r.type === workType) &&
      (r.id === workId || r.imdbId === workId || r.tmdbId === workId));
    if (!target) return false;

    if (!target.episodes) {
      target.episodes = [];
    }

    const epExists = target.episodes.some(e => 
      e.number === episode.number && (e.season ?? 1) === (episode.season ?? 1)
    );

    if (epExists) return false;

    target.episodes.push({ ...episode, description: episode.description || '', image: episode.image || '' });
    target.episodes.sort((a, b) => {
      const sA = a.season ?? 1;
      const sB = b.season ?? 1;
      if (sA !== sB) return sA - sB;
      return a.number - b.number;
    });

    this.notifyListeners();
    return true;
  }

  /**
   * Registra uma obra que não possui fontes válidas no momento na fila de verificação periódica
   */
  public recordPending(candidate: {
    id: string;
    imdbId?: string;
    tmdbId?: string;
    title: string;
    type: ContentType;
    year?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    reason: string;
  }): void {
    const key = this.pendingKey(candidate);
    const existing = this.pendingQueue.get(key);

    const now = Date.now();
    const attempts = existing ? existing.attempts + 1 : 1;
    // Backoff inteligente: 12h, 24h, 48h (sem exceder 72h) para evitar sobrecarga nas APIs gratuitas
    const delayHours = Math.min(72, attempts * 12);
    const recheckAfter = now + delayHours * 60 * 60 * 1000;

    this.pendingQueue.set(key, {
      id: candidate.id,
      imdbId: candidate.imdbId,
      tmdbId: candidate.tmdbId,
      title: candidate.title,
      type: candidate.type,
      year: candidate.year,
      seasonNumber: candidate.seasonNumber,
      episodeNumber: candidate.episodeNumber,
      firstDiscoveredAt: existing ? existing.firstDiscoveredAt : now,
      lastCheckedAt: now,
      recheckAfter,
      attempts,
      reasonUnavailable: candidate.reason
    });
  }

  /**
   * Retorna os itens pendentes que estão prontos para reavaliação periódica
   */
  public getDuePendings(): PendingCandidate[] {
    const now = Date.now();
    const due: PendingCandidate[] = [];
    for (const pending of this.pendingQueue.values()) {
      if (now >= pending.recheckAfter) {
        due.push(pending);
      }
    }
    return due;
  }

  public getPendingCount(): number {
    return this.pendingQueue.size;
  }

  public subscribe(listener: (releases: ContentItem[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const current = [...this.releases];
    this.listeners.forEach(fn => fn(current));
  }
}

export const catalogReleaseStore = CatalogReleaseStore.getInstance();
