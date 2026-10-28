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
import { eq, and, gt, lt, desc, or, isNull } from 'drizzle-orm';
import { Database } from '../database/client';
import {
  profilePlaybackProgress,
  profileWatchHistory,
  profileMyList,
  profileFavorites,
  processedSyncMutations,
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
  clientSendTime?: number;
  clientMutationId?: string;
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
  clientSendTime?: number;
  clientMutationId?: string;
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
   * Normaliza carimbo de tempo considerando autoridade de tempo do servidor e desvio de relógio (clock skew).
   * Se o cliente fornecer clientSendTime, calcula a idade relativa do evento no cliente (eventAge).
   * Clampa timestamps no futuro (máximo serverNow).
   */
  static normalizeTimestamp(
    rawTimestamp?: number,
    clientSendTime?: number,
    serverNow: number = Date.now()
  ): { effectiveEventTime: number; serverNow: number } {
    if (!rawTimestamp || isNaN(rawTimestamp)) {
      return { effectiveEventTime: serverNow, serverNow };
    }

    // Se o carimbo de tempo fornecido estiver mais de 30s no futuro em relação ao servidor:
    // Clampa para serverNow imediatamente (impede poisoning por relógio adiantado).
    if (rawTimestamp > serverNow + 30_000) {
      return { effectiveEventTime: serverNow, serverNow };
    }

    // Se o cliente informou o momento em que enviou a requisição (clientSendTime):
    if (clientSendTime && !isNaN(clientSendTime) && clientSendTime >= rawTimestamp) {
      // Idade do evento no dispositivo cliente (ms decorridos entre o evento e o envio)
      const eventAgeMs = Math.max(0, clientSendTime - rawTimestamp);
      // Tempo estimado do evento na linha do tempo do servidor
      const estimatedTime = serverNow - eventAgeMs;
      return { effectiveEventTime: Math.min(serverNow, estimatedTime), serverNow };
    }

    return { effectiveEventTime: rawTimestamp, serverNow };
  }

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
   * Salva ou atualiza o progresso de reprodução com resolução determinística de conflito
   * e imunidade a relógios descalibrados.
   */
  static async saveProgress(
    db: Database | any,
    profileId: string,
    input: ProgressInput
  ): Promise<{ record: any; conflictResolved: boolean }> {
    const orm = (db as any).db || db;
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
    const { effectiveEventTime, serverNow } = this.normalizeTimestamp(
      input.updatedAt,
      input.clientSendTime
    );
    const deviceName = input.deviceName ? String(input.deviceName).slice(0, 80) : null;

    // Busca progresso existente
    const existing = await orm
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
      // Se o evento recebido for mais antigo que o estado atual do servidor E a posição recebida não avançou o progresso,
      // preservamos o estado do servidor para evitar que pacotes obsoletos ou atrasados retrocedam a reprodução.
      if (curr.updatedAt > effectiveEventTime && positionSec <= curr.positionSec) {
        return { record: curr, conflictResolved: true };
      }

      // O carimbo gravado no servidor é sempre baseado na autoridade de tempo do servidor,
      // garantindo que nenhum cliente com relógio no futuro trave o banco.
      const nextUpdatedAt = Math.max(serverNow, (curr.updatedAt || 0) + 1);
      const nextVersion = (curr.version || 1) + 1;
      await orm
        .update(profilePlaybackProgress)
        .set({
          contentType,
          positionSec,
          durationSec,
          progressPercent,
          isCompleted,
          version: nextVersion,
          deviceName: deviceName ?? curr.deviceName,
          updatedAt: nextUpdatedAt,
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
        updatedAt: nextUpdatedAt,
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
      updatedAt: serverNow,
    };

    await orm.insert(profilePlaybackProgress).values(newRecord);
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
   * Registra ou atualiza item no histórico com normalização temporal.
   */
  static async recordHistory(
    db: Database | any,
    profileId: string,
    input: HistoryInput
  ): Promise<any> {
    const orm = (db as any).db || db;
    const canonicalId = String(input.canonicalId).trim();
    if (!canonicalId) {
      throw new Error('canonicalId é obrigatório para registrar histórico.');
    }

    const contentType = String(input.contentType || 'movie').trim();
    const season = Number.isInteger(input.season) ? Number(input.season) : 0;
    const episode = Number.isInteger(input.episode) ? Number(input.episode) : 0;
    const { effectiveEventTime, serverNow } = this.normalizeTimestamp(
      input.watchedAt || input.updatedAt,
      input.clientSendTime
    );

    const existing = await orm
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
      const maxWatched = Math.max(curr.watchedAt, effectiveEventTime);
      const nextUpdatedAt = Math.max(serverNow, (curr.updatedAt || 0) + 1);
      const nextVersion = (curr.version || 1) + 1;

      await orm
        .update(profileWatchHistory)
        .set({
          contentType,
          title: input.title ? String(input.title).slice(0, 150) : curr.title,
          posterUrl: input.posterUrl ? String(input.posterUrl).slice(0, 500) : curr.posterUrl,
          year: input.year !== undefined ? Number(input.year) : curr.year,
          watchedAt: maxWatched,
          updatedAt: nextUpdatedAt,
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
        updatedAt: nextUpdatedAt,
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
      watchedAt: effectiveEventTime,
      updatedAt: serverNow,
      version: 1,
    };

    await orm.insert(profileWatchHistory).values(newRecord);
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
  // MINHA LISTA (profile_my_list com tombstones e autoridade do servidor)
  // ==========================================================================

  /**
   * Adiciona ou remove item de Minha Lista usando tombstones com normalização temporal.
   * Se um dispositivo offline tentar adicionar um item que foi removido
   * mais recentemente no servidor, a remoção é preservada.
   */
  static async setMyList(
    db: Database | any,
    profileId: string,
    canonicalId: string,
    isRemoved: boolean,
    timestamp?: number,
    clientSendTime?: number
  ): Promise<{ record: any; conflictResolved: boolean }> {
    const orm = (db as any).db || db;
    const cleanId = String(canonicalId).trim();
    if (!cleanId) {
      throw new Error('canonicalId é obrigatório para Minha Lista.');
    }

    const { effectiveEventTime, serverNow } = this.normalizeTimestamp(timestamp, clientSendTime);

    const existing = await orm
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
      const nextUpdatedAt = Math.max(serverNow, (curr.updatedAt || 0) + 1);
      const nextVersion = (curr.version || 1) + 1;

      if (isRemoved) {
        // Remoção explícita
        await orm
          .update(profileMyList)
          .set({
            isRemoved: 1,
            removedAt: effectiveEventTime,
            updatedAt: nextUpdatedAt,
            version: nextVersion,
          })
          .where(eq(profileMyList.id, curr.id));

        return {
          record: {
            ...curr,
            isRemoved: 1,
            removedAt: effectiveEventTime,
            updatedAt: nextUpdatedAt,
            version: nextVersion,
          },
          conflictResolved: false,
        };
      } else {
        // Tentativa de adicionar
        // Se já estava removido e a data de remoção é posterior ao evento recebido:
        // A remoção mais recente vence!
        if (curr.isRemoved === 1 && curr.removedAt && curr.removedAt > effectiveEventTime) {
          return { record: curr, conflictResolved: true };
        }

        await orm
          .update(profileMyList)
          .set({
            isRemoved: 0,
            removedAt: null,
            addedAt: effectiveEventTime,
            updatedAt: nextUpdatedAt,
            version: nextVersion,
          })
          .where(eq(profileMyList.id, curr.id));

        return {
          record: {
            ...curr,
            isRemoved: 0,
            removedAt: null,
            addedAt: effectiveEventTime,
            updatedAt: nextUpdatedAt,
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
      addedAt: effectiveEventTime,
      isRemoved: isRemoved ? 1 : 0,
      removedAt: isRemoved ? effectiveEventTime : null,
      updatedAt: serverNow,
      version: 1,
    };

    await orm.insert(profileMyList).values(newRecord);
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
  // FAVORITOS (profile_favorites com tombstones e autoridade do servidor)
  // ==========================================================================

  /**
   * Adiciona ou remove favorito usando tombstones com resolução determinística e normalização temporal.
   */
  static async setFavorite(
    db: Database | any,
    profileId: string,
    canonicalId: string,
    isRemoved: boolean,
    timestamp?: number,
    clientSendTime?: number
  ): Promise<{ record: any; conflictResolved: boolean }> {
    const orm = (db as any).db || db;
    const cleanId = String(canonicalId).trim();
    if (!cleanId) {
      throw new Error('canonicalId é obrigatório para Favoritos.');
    }

    const { effectiveEventTime, serverNow } = this.normalizeTimestamp(timestamp, clientSendTime);

    const existing = await orm
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
      const nextUpdatedAt = Math.max(serverNow, (curr.updatedAt || 0) + 1);
      const nextVersion = (curr.version || 1) + 1;

      if (isRemoved) {
        await orm
          .update(profileFavorites)
          .set({
            isRemoved: 1,
            removedAt: effectiveEventTime,
            updatedAt: nextUpdatedAt,
            version: nextVersion,
          })
          .where(eq(profileFavorites.id, curr.id));

        return {
          record: {
            ...curr,
            isRemoved: 1,
            removedAt: effectiveEventTime,
            updatedAt: nextUpdatedAt,
            version: nextVersion,
          },
          conflictResolved: false,
        };
      } else {
        if (curr.isRemoved === 1 && curr.removedAt && curr.removedAt > effectiveEventTime) {
          return { record: curr, conflictResolved: true };
        }

        await orm
          .update(profileFavorites)
          .set({
            isRemoved: 0,
            removedAt: null,
            addedAt: effectiveEventTime,
            updatedAt: nextUpdatedAt,
            version: nextVersion,
          })
          .where(eq(profileFavorites.id, curr.id));

        return {
          record: {
            ...curr,
            isRemoved: 0,
            removedAt: null,
            addedAt: effectiveEventTime,
            updatedAt: nextUpdatedAt,
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
      canonicalId,
      addedAt: effectiveEventTime,
      isRemoved: isRemoved ? 1 : 0,
      removedAt: isRemoved ? effectiveEventTime : null,
      updatedAt: serverNow,
      version: 1,
    };

    await orm.insert(profileFavorites).values(newRecord);
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
  // LOTE DE MUTAÇÕES OFFLINE COM IDEMPOTÊNCIA PERSISTENTE (syncBatch)
  // ==========================================================================

  /**
   * Processa lote de mutações da fila outbox com idempotência persistente no banco
   * e resolução determinística de conflitos imune a clock skew.
   */
  static async processBatch(
    db: Database,
    profileId: string,
    mutations: SyncMutation[],
    clientSendTime?: number
  ): Promise<{ processed: number; results: Array<{ id: string; success: boolean; duplicate?: boolean; conflictResolved?: boolean; error?: string }> }> {
    const results: Array<{ id: string; success: boolean; duplicate?: boolean; conflictResolved?: boolean; error?: string }> = [];

    // Limite máximo de 100 mutações por lote para economia de recursos e evitar DoS
    const safeMutations = mutations.slice(0, 100);

    for (const mut of safeMutations) {
      if (!mut.id || typeof mut.id !== 'string') {
        results.push({ id: mut.id || 'invalid', success: false, error: 'ID de mutação obrigatório.' });
        continue;
      }

      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      // Após a retenção de UUIDs, um replay não pode voltar a ser uma nova escrita.
      // Verificar o evento original antes de normalizar clock skew/rebase de envio.
      if (!Number.isFinite(mut.timestamp) || mut.timestamp <= 0 || now - mut.timestamp >= sevenDays) {
        results.push({ id: mut.id, success: false, error: 'SYNC_MUTATION_EXPIRED_OR_INVALID_TIMESTAMP' });
        continue;
      }
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          // Executa a reserva de idempotência e a mutação correspondente dentro da mesma
          // transação atômica do LibSQL/SQLite. Se qualquer etapa falhar ou o processo for
          // interrompido, a transação inteira sofre rollback automático pelo banco de dados,
          // garantindo que nenhuma reserva órfã exista sem que os dados tenham sido gravados.
          const txOutcome = await db.db.transaction(async (tx) => {
            // 1. Reserva atômica da mutação na tabela processed_sync_mutations via chave primária.
            await tx.insert(processedSyncMutations).values({
              id: mut.id,
              profileId,
              mutationType: mut.type,
              canonicalId: String(mut.data?.canonicalId || mut.data?.id || 'unknown').slice(0, 100),
              processedAt: now,
              expiresAt: now + sevenDays,
            });

            // 2. Aplica os efeitos da mutação dentro da mesma transação
            let conflictResolved = false;
            switch (mut.type) {
              case 'progress': {
                const res = await this.saveProgress(tx, profileId, {
                  ...mut.data,
                  updatedAt: mut.timestamp || mut.data?.updatedAt,
                  clientSendTime,
                });
                conflictResolved = Boolean(res.conflictResolved);
                break;
              }
              case 'history': {
                await this.recordHistory(tx, profileId, {
                  ...mut.data,
                  watchedAt: mut.timestamp || mut.data?.watchedAt,
                  updatedAt: mut.timestamp || mut.data?.updatedAt,
                  clientSendTime,
                });
                break;
              }
              case 'my_list': {
                const isRemoved = mut.action === 'remove' || Boolean(mut.data?.isRemoved);
                const canonicalId = mut.data?.canonicalId || mut.data?.id;
                const res = await this.setMyList(tx, profileId, canonicalId, isRemoved, mut.timestamp, clientSendTime);
                conflictResolved = Boolean(res.conflictResolved);
                break;
              }
              case 'favorites': {
                const isRemoved = mut.action === 'remove' || Boolean(mut.data?.isRemoved);
                const canonicalId = mut.data?.canonicalId || mut.data?.id;
                const res = await this.setFavorite(tx, profileId, canonicalId, isRemoved, mut.timestamp, clientSendTime);
                conflictResolved = Boolean(res.conflictResolved);
                break;
              }
              default:
                throw new Error(`Tipo de mutação desconhecido: ${mut.type}`);
            }

            return { conflictResolved };
          });

          results.push({ id: mut.id, success: true, conflictResolved: txOutcome.conflictResolved });
          break;
        } catch (err: any) {
          const rawErr = err?.cause || err;
          const fullMsg = `${err?.message || ''} ${rawErr?.message || ''} ${err?.code || ''} ${rawErr?.code || ''} ${rawErr?.extendedCode || ''}`;
          const isDuplicate =
            err?.code === 'SQLITE_CONSTRAINT' ||
            err?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
            rawErr?.code === 'SQLITE_CONSTRAINT' ||
            rawErr?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
            rawErr?.extendedCode === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
            fullMsg.includes('UNIQUE constraint failed: processed_sync_mutations.id') ||
            (fullMsg.includes('processed_sync_mutations') && (fullMsg.includes('UNIQUE') || fullMsg.includes('PRIMARY KEY')));

          if (isDuplicate) {
            // A chave primária (UUID) já foi processada anteriormente ou em requisição concorrente.
            // A transação foi revertida pelo motor do banco; deduplica sem efeitos colaterais.
            results.push({ id: mut.id, success: true, duplicate: true });
            break;
          }

          const isBusy =
            fullMsg.includes('SQLITE_BUSY') ||
            fullMsg.includes('database is locked') ||
            err?.code === 'SQLITE_BUSY' ||
            rawErr?.code === 'SQLITE_BUSY';

          if (isBusy && attempts < maxAttempts) {
            await new Promise(res => setTimeout(res, 30 * attempts));
            continue;
          }

          // Falha na mutação ou no banco: transação foi revertida automaticamente pelo LibSQL/SQLite!
          // Nenhuma alteração inconsistente persiste e o UUID fica livre para retentativa legítima.
          results.push({ id: mut.id, success: false, error: err?.message || 'Falha ao aplicar mutação' });
          break;
        }
      }
    }

    return {
      processed: results.length,
      results,
    };
  }

  /**
   * Remove registros de mutações processadas expiradas (retenção > 7 dias).
   */
  static async purgeExpiredMutations(db: Database): Promise<number> {
    const now = Date.now();
    const res = await db.db
      .delete(processedSyncMutations)
      .where(lt(processedSyncMutations.expiresAt, now));
    return Number(res.rowsAffected || 0);
  }
}
