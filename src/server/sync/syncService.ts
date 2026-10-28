/**
 * ZAPITV — SERVIÇO DE SINCRONIZAÇÃO ENTRE DISPOSITIVOS (P3.D)
 * 
 * Regras de Negócio e Segurança:
 * - Validação estrita de posse de perfil: apenas perfis pertencentes à conta autenticada
 *   podem ter dados lidos ou alterados.
 * - Resolução determinística de conflitos (Last-Write-Wins ponderado e tombstones).
 * - Tombstones para 'my_list' e 'favorites': deleções mais recentes nunca são
 *   ressuscitadas por adições com carimbo de tempo mais antigo (ex: dispositivo que estava offline).
 * - Idempotência em lotes e proteção contra retrocesso de progresso recente.
 */

import crypto from 'crypto';
import { eq, and, gt, desc, or, isNull } from 'drizzle-orm';
import { Database } from '../database/client';
import {
  profilePlaybackProgress,
  profileWatchHistory,
  profileMyList,
  profileFavorites,
} from '../database/schema';
import { ProfileService, ProfileRecord } from '../profiles/profileService';

export interface ProgressInput {
  canonicalId: string;
  contentType: string; // 'movie' | 'series' | 'anime'
  season?: number;
  episode?: number;
  positionSec: number;
  durationSec: number;
  progressPercent?: number;
  isCompleted?: boolean | number;
  deviceName?: string;
  updatedAt?: number;
}

export interface HistoryInput {
  canonicalId: string;
  contentType: string;
  season?: number;
  episode?: number;
  title?: string;
  posterUrl?: string;
  year?: number;
  watchedAt?: number;
  updatedAt?: number;
}

export interface SyncMutation {
  id: string; // UUID da mutação gerado no cliente
  type: 'progress' | 'history' | 'my_list' | 'favorites';
  action: 'save' | 'set' | 'remove';
  data: any;
  timestamp: number;
}

export class SyncService {
  /**
   * Valida se o perfil existe e pertence ao usuário autenticado.
   * Lança erro com status apropriado se a validação falhar.
   */
  static async verifyProfileOwnership(
    db: Database,
    userId: string,
    profileId: string
  ): Promise<ProfileRecord> {
    if (!profileId || typeof profileId !== 'string') {
      const err: any = new Error('ID de perfil inválido ou não informado.');
      err.statusCode = 400;
      throw err;
    }

    const profile = await ProfileService.getProfileById(db, userId, profileId);
    if (!profile) {
      const err: any = new Error('Perfil não encontrado ou não pertence à conta autenticada.');
      err.statusCode = 403;
      throw err;
    }

    return profile;
  }

  // ==========================================================================
  // PROGRESSO DE REPRODUÇÃO (profile_playback_progress)
  // ==========================================================================

  /**
   * Salva ou atualiza o progresso de reprodução com resolução determinística de conflito.
   * Se o progresso salvo no servidor possuir timestamp mais recente que o recebido,
   * o registro do servidor é preservado para impedir retrocessos por dispositivos desatualizados.
   */
  static async saveProgress(
    db: Database,
    profileId: string,
    input: ProgressInput
  ): Promise<{ record: any; conflictResolved: boolean }> {
    const canonicalId = String(input.canonicalId).trim();
    if (!canonicalId) {
      throw new Error('canonicalId é obrigatório para registrar progresso.');
    }

    const contentType = String(input.contentType || 'movie').trim();
    const season = Number.isInteger(input.season) ? Number(input.season) : 0;
    const episode = Number.isInteger(input.episode) ? Number(input.episode) : 0;
    const positionSec = Math.max(0, Math.floor(Number(input.positionSec) || 0));
    const durationSec = Math.max(0, Math.floor(Number(input.durationSec) || 0));
    const progressPercent = durationSec > 0
      ? Math.min(100, Math.round((positionSec / durationSec) * 100))
      : (Number(input.progressPercent) || 0);
    const isCompleted = input.isCompleted ? 1 : 0;
    const incomingTime = Number(input.updatedAt) || Date.now();
    const deviceName = input.deviceName ? String(input.deviceName).slice(0, 80) : null;

    // Busca progresso existente
    const existing = await db.db
      .select()
      .from(profilePlaybackProgress)
      .where(
        and(
          eq(profilePlaybackProgress.profileId, profileId),
          eq(profilePlaybackProgress.canonicalId, canonicalId),
          eq(profilePlaybackProgress.season, season),
          eq(profilePlaybackProgress.episode, episode)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const curr = existing[0];
      // Se o servidor possui um estado gravado com timestamp mais recente que o recebido,
      // preservamos o estado do servidor (LWW)
      if (curr.updatedAt > incomingTime) {
        return { record: curr, conflictResolved: true };
      }

      const nextVersion = (curr.version || 1) + 1;
      await db.db
        .update(profilePlaybackProgress)
        .set({
          contentType,
          positionSec,
          durationSec,
          progressPercent,
          isCompleted,
          version: nextVersion,
          deviceName: deviceName ?? curr.deviceName,
          updatedAt: incomingTime,
        })
        .where(eq(profilePlaybackProgress.id, curr.id));

      const updated = {
        ...curr,
        contentType,
        positionSec,
        durationSec,
        progressPercent,
        isCompleted,
        version: nextVersion,
        deviceName: deviceName ?? curr.deviceName,
        updatedAt: incomingTime,
      };

      return { record: updated, conflictResolved: false };
    }

    // Inserção inicial
    const newId = crypto.randomUUID();
    const newRecord = {
      id: newId,
      profileId,
      canonicalId,
      contentType,
      season,
      episode,
      positionSec,
      durationSec,
      progressPercent,
      isCompleted,
      version: 1,
      deviceName,
      updatedAt: incomingTime,
    };

    await db.db.insert(profilePlaybackProgress).values(newRecord);
    return { record: newRecord, conflictResolved: false };
  }

  /**
   * Obtém todo o progresso do perfil (para Continuar Assistindo e hidratação).
   */
  static async getProgressList(
    db: Database,
    profileId: string,
    since?: number
  ): Promise<any[]> {
    const conditions = [eq(profilePlaybackProgress.profileId, profileId)];
    if (since && since > 0) {
      conditions.push(gt(profilePlaybackProgress.updatedAt, since));
    }

    return await db.db
      .select()
      .from(profilePlaybackProgress)
      .where(and(...conditions))
      .orderBy(desc(profilePlaybackProgress.updatedAt));
  }

  /**
   * Obtém progresso de um item específico
   */
  static async getProgressItem(
    db: Database,
    profileId: string,
    canonicalId: string,
    season = 0,
    episode = 0
  ): Promise<any | null> {
    const found = await db.db
      .select()
      .from(profilePlaybackProgress)
      .where(
        and(
          eq(profilePlaybackProgress.profileId, profileId),
          eq(profilePlaybackProgress.canonicalId, canonicalId),
          eq(profilePlaybackProgress.season, season),
          eq(profilePlaybackProgress.episode, episode)
        )
      )
      .limit(1);

    return found[0] || null;
  }

  // ==========================================================================
  // HISTÓRICO DE REPRODUÇÃO (profile_watch_history)
  // ==========================================================================

  /**
   * Registra ou atualiza item no histórico.
   */
  static async recordHistory(
    db: Database,
    profileId: string,
    input: HistoryInput
  ): Promise<any> {
    const canonicalId = String(input.canonicalId).trim();
    if (!canonicalId) {
      throw new Error('canonicalId é obrigatório para registrar histórico.');
    }

    const contentType = String(input.contentType || 'movie').trim();
    const season = Number.isInteger(input.season) ? Number(input.season) : 0;
    const episode = Number.isInteger(input.episode) ? Number(input.episode) : 0;
    const now = Date.now();
    const watchedAt = Number(input.watchedAt) || now;
    const updatedAt = Number(input.updatedAt) || watchedAt;

    const existing = await db.db
      .select()
      .from(profileWatchHistory)
      .where(
        and(
          eq(profileWatchHistory.profileId, profileId),
          eq(profileWatchHistory.canonicalId, canonicalId),
          eq(profileWatchHistory.season, season),
          eq(profileWatchHistory.episode, episode)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const curr = existing[0];
      const maxWatched = Math.max(curr.watchedAt, watchedAt);
      const maxUpdated = Math.max(curr.updatedAt, updatedAt);
      const nextVersion = (curr.version || 1) + 1;

      await db.db
        .update(profileWatchHistory)
        .set({
          contentType,
          title: input.title ? String(input.title).slice(0, 150) : curr.title,
          posterUrl: input.posterUrl ? String(input.posterUrl).slice(0, 500) : curr.posterUrl,
          year: input.year !== undefined ? Number(input.year) : curr.year,
          watchedAt: maxWatched,
          updatedAt: maxUpdated,
          version: nextVersion,
        })
        .where(eq(profileWatchHistory.id, curr.id));

      return {
        ...curr,
        contentType,
        title: input.title ? String(input.title).slice(0, 150) : curr.title,
        posterUrl: input.posterUrl ? String(input.posterUrl).slice(0, 500) : curr.posterUrl,
        year: input.year !== undefined ? Number(input.year) : curr.year,
        watchedAt: maxWatched,
        updatedAt: maxUpdated,
        version: nextVersion,
      };
    }

    const newId = crypto.randomUUID();
    const newRecord = {
      id: newId,
      profileId,
      canonicalId,
      contentType,
      season,
      episode,
      title: input.title ? String(input.title).slice(0, 150) : null,
      posterUrl: input.posterUrl ? String(input.posterUrl).slice(0, 500) : null,
      year: input.year !== undefined ? Number(input.year) : null,
      watchedAt,
      updatedAt,
      version: 1,
    };

    await db.db.insert(profileWatchHistory).values(newRecord);
    return newRecord;
  }

  /**
   * Obtém histórico recente do perfil.
   */
  static async getHistory(
    db: Database,
    profileId: string,
    limit = 50,
    offset = 0,
    since?: number
  ): Promise<any[]> {
    const conditions = [eq(profileWatchHistory.profileId, profileId)];
    if (since && since > 0) {
      conditions.push(gt(profileWatchHistory.updatedAt, since));
    }

    const safeLimit = Math.min(100, Math.max(1, limit));
    const safeOffset = Math.max(0, offset);

    return await db.db
      .select()
      .from(profileWatchHistory)
      .where(and(...conditions))
      .orderBy(desc(profileWatchHistory.watchedAt))
      .limit(safeLimit)
      .offset(safeOffset);
  }

  // ==========================================================================
  // MINHA LISTA (profile_my_list com tombstones)
  // ==========================================================================

  /**
   * Adiciona ou remove item de Minha Lista usando tombstones.
   * Se um dispositivo offline tentar adicionar um item que foi removido
   * mais recentemente no servidor, a remoção é preservada.
   */
  static async setMyList(
    db: Database,
    profileId: string,
    canonicalId: string,
    isRemoved: boolean,
    timestamp?: number
  ): Promise<{ record: any; conflictResolved: boolean }> {
    const cleanId = String(canonicalId).trim();
    if (!cleanId) {
      throw new Error('canonicalId é obrigatório para Minha Lista.');
    }

    const ts = Number(timestamp) || Date.now();

    const existing = await db.db
      .select()
      .from(profileMyList)
      .where(
        and(
          eq(profileMyList.profileId, profileId),
          eq(profileMyList.canonicalId, cleanId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const curr = existing[0];

      if (isRemoved) {
        // Remoção explícita
        const nextVersion = (curr.version || 1) + 1;
        await db.db
          .update(profileMyList)
          .set({
            isRemoved: 1,
            removedAt: ts,
            updatedAt: Math.max(ts, curr.updatedAt + 1),
            version: nextVersion,
          })
          .where(eq(profileMyList.id, curr.id));

        return {
          record: {
            ...curr,
            isRemoved: 1,
            removedAt: ts,
            updatedAt: Math.max(ts, curr.updatedAt + 1),
            version: nextVersion,
          },
          conflictResolved: false,
        };
      } else {
        // Tentativa de adicionar
        // Se já estava removido e a data de remoção no servidor é MAIS RECENTE que o timestamp da adição recebida:
        // Ex: Celular offline tentou adicionar às 10:00, mas o usuário removeu na TV às 10:30.
        // A remoção mais recente vence!
        if (curr.isRemoved === 1 && curr.removedAt && curr.removedAt > ts) {
          return { record: curr, conflictResolved: true };
        }

        const nextVersion = (curr.version || 1) + 1;
        await db.db
          .update(profileMyList)
          .set({
            isRemoved: 0,
            removedAt: null,
            addedAt: ts,
            updatedAt: Math.max(ts, curr.updatedAt + 1),
            version: nextVersion,
          })
          .where(eq(profileMyList.id, curr.id));

        return {
          record: {
            ...curr,
            isRemoved: 0,
            removedAt: null,
            addedAt: ts,
            updatedAt: Math.max(ts, curr.updatedAt + 1),
            version: nextVersion,
          },
          conflictResolved: false,
        };
      }
    }

    // Inserção nova
    const newId = crypto.randomUUID();
    const newRecord = {
      id: newId,
      profileId,
      canonicalId: cleanId,
      addedAt: ts,
      isRemoved: isRemoved ? 1 : 0,
      removedAt: isRemoved ? ts : null,
      updatedAt: ts,
      version: 1,
    };

    await db.db.insert(profileMyList).values(newRecord);
    return { record: newRecord, conflictResolved: false };
  }

  /**
   * Obtém itens de Minha Lista. Por padrão retorna apenas itens ativos (isRemoved = 0).
   */
  static async getMyList(
    db: Database,
    profileId: string,
    includeRemoved = false,
    since?: number
  ): Promise<any[]> {
    const conditions = [eq(profileMyList.profileId, profileId)];
    if (!includeRemoved) {
      conditions.push(eq(profileMyList.isRemoved, 0));
    }
    if (since && since > 0) {
      conditions.push(gt(profileMyList.updatedAt, since));
    }

    return await db.db
      .select()
      .from(profileMyList)
      .where(and(...conditions))
      .orderBy(desc(profileMyList.addedAt));
  }

  // ==========================================================================
  // FAVORITOS (profile_favorites com tombstones)
  // ==========================================================================

  /**
   * Adiciona ou remove favorito usando tombstones com resolução determinística.
   */
  static async setFavorite(
    db: Database,
    profileId: string,
    canonicalId: string,
    isRemoved: boolean,
    timestamp?: number
  ): Promise<{ record: any; conflictResolved: boolean }> {
    const cleanId = String(canonicalId).trim();
    if (!cleanId) {
      throw new Error('canonicalId é obrigatório para Favoritos.');
    }

    const ts = Number(timestamp) || Date.now();

    const existing = await db.db
      .select()
      .from(profileFavorites)
      .where(
        and(
          eq(profileFavorites.profileId, profileId),
          eq(profileFavorites.canonicalId, cleanId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const curr = existing[0];

      if (isRemoved) {
        const nextVersion = (curr.version || 1) + 1;
        await db.db
          .update(profileFavorites)
          .set({
            isRemoved: 1,
            removedAt: ts,
            updatedAt: Math.max(ts, curr.updatedAt + 1),
            version: nextVersion,
          })
          .where(eq(profileFavorites.id, curr.id));

        return {
          record: {
            ...curr,
            isRemoved: 1,
            removedAt: ts,
            updatedAt: Math.max(ts, curr.updatedAt + 1),
            version: nextVersion,
          },
          conflictResolved: false,
        };
      } else {
        if (curr.isRemoved === 1 && curr.removedAt && curr.removedAt > ts) {
          return { record: curr, conflictResolved: true };
        }

        const nextVersion = (curr.version || 1) + 1;
        await db.db
          .update(profileFavorites)
          .set({
            isRemoved: 0,
            removedAt: null,
            addedAt: ts,
            updatedAt: Math.max(ts, curr.updatedAt + 1),
            version: nextVersion,
          })
          .where(eq(profileFavorites.id, curr.id));

        return {
          record: {
            ...curr,
            isRemoved: 0,
            removedAt: null,
            addedAt: ts,
            updatedAt: Math.max(ts, curr.updatedAt + 1),
            version: nextVersion,
          },
          conflictResolved: false,
        };
      }
    }

    const newId = crypto.randomUUID();
    const newRecord = {
      id: newId,
      profileId,
      canonicalId: cleanId,
      addedAt: ts,
      isRemoved: isRemoved ? 1 : 0,
      removedAt: isRemoved ? ts : null,
      updatedAt: ts,
      version: 1,
    };

    await db.db.insert(profileFavorites).values(newRecord);
    return { record: newRecord, conflictResolved: false };
  }

  /**
   * Obtém favoritos do perfil.
   */
  static async getFavorites(
    db: Database,
    profileId: string,
    includeRemoved = false,
    since?: number
  ): Promise<any[]> {
    const conditions = [eq(profileFavorites.profileId, profileId)];
    if (!includeRemoved) {
      conditions.push(eq(profileFavorites.isRemoved, 0));
    }
    if (since && since > 0) {
      conditions.push(gt(profileFavorites.updatedAt, since));
    }

    return await db.db
      .select()
      .from(profileFavorites)
      .where(and(...conditions))
      .orderBy(desc(profileFavorites.addedAt));
  }

  // ==========================================================================
  // PULL COMPLETO DE HIDRATAÇÃO DO PERFIL
  // ==========================================================================

  /**
   * Recupera o estado completo ou incremental sincronizado para o perfil.
   */
  static async pullProfileState(
    db: Database,
    profileId: string,
    since?: number
  ) {
    const serverTime = Date.now();
    const [progress, history, myList, favorites] = await Promise.all([
      this.getProgressList(db, profileId, since),
      this.getHistory(db, profileId, 50, 0, since),
      this.getMyList(db, profileId, Boolean(since), since),
      this.getFavorites(db, profileId, Boolean(since), since),
    ]);

    return {
      profileId,
      serverTime,
      progress,
      history,
      myList,
      favorites,
    };
  }

  // ==========================================================================
  // LOTE DE MUTAÇÕES OFFLINE (syncBatch)
  // ==========================================================================

  /**
   * Processa lote de mutações da fila outbox com idempotência e resolução de conflitos.
   */
  static async processBatch(
    db: Database,
    profileId: string,
    mutations: SyncMutation[]
  ): Promise<{ processed: number; results: Array<{ id: string; success: boolean; conflictResolved?: boolean; error?: string }> }> {
    const results: Array<{ id: string; success: boolean; conflictResolved?: boolean; error?: string }> = [];

    // Limite máximo de 100 mutações por lote para economia de recursos e evitar DoS
    const safeMutations = mutations.slice(0, 100);

    for (const mut of safeMutations) {
      try {
        switch (mut.type) {
          case 'progress': {
            const res = await this.saveProgress(db, profileId, {
              ...mut.data,
              updatedAt: mut.timestamp || mut.data?.updatedAt,
            });
            results.push({ id: mut.id, success: true, conflictResolved: res.conflictResolved });
            break;
          }
          case 'history': {
            await this.recordHistory(db, profileId, {
              ...mut.data,
              watchedAt: mut.timestamp || mut.data?.watchedAt,
              updatedAt: mut.timestamp || mut.data?.updatedAt,
            });
            results.push({ id: mut.id, success: true });
            break;
          }
          case 'my_list': {
            const isRemoved = mut.action === 'remove' || Boolean(mut.data?.isRemoved);
            const canonicalId = mut.data?.canonicalId || mut.data?.id;
            const res = await this.setMyList(db, profileId, canonicalId, isRemoved, mut.timestamp);
            results.push({ id: mut.id, success: true, conflictResolved: res.conflictResolved });
            break;
          }
          case 'favorites': {
            const isRemoved = mut.action === 'remove' || Boolean(mut.data?.isRemoved);
            const canonicalId = mut.data?.canonicalId || mut.data?.id;
            const res = await this.setFavorite(db, profileId, canonicalId, isRemoved, mut.timestamp);
            results.push({ id: mut.id, success: true, conflictResolved: res.conflictResolved });
            break;
          }
          default:
            results.push({ id: mut.id, success: false, error: `Tipo de mutação desconhecido: ${mut.type}` });
        }
      } catch (err: any) {
        results.push({ id: mut.id, success: false, error: err?.message || 'Falha ao aplicar mutação' });
      }
    }

    return {
      processed: results.length,
      results,
    };
  }
}
