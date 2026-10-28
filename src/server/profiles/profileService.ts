/**
 * ZAPITV — SERVIÇO DE MÚLTIPLOS PERFIS POR CONTA (P3.B)
 * 
 * Regras de Negócio e Segurança:
 * - Toda operação exige autenticação e validação estrita de propriedade (user_id).
 * - Uma conta nunca pode visualizar, editar ou excluir perfis de outra conta.
 * - Limite padrão de 5 perfis por conta (configurável via MAX_PROFILES_PER_USER).
 * - Criação automática e idempotente do perfil inicial.
 * - Proibição de exclusão do único perfil da conta.
 */

import crypto from 'crypto';
import { eq, and, asc, count } from 'drizzle-orm';
import { Database } from '../database/client';
import { profiles, users } from '../database/schema';
import { VALID_AVATAR_IDS, DEFAULT_AVATAR_ID } from '../../core/profile/avatarRegistry';

export const MAX_PROFILES_PER_USER = process.env.MAX_PROFILES_PER_USER
  ? parseInt(process.env.MAX_PROFILES_PER_USER, 10)
  : 5;

export interface ProfileRecord {
  id: string;
  userId: string;
  name: string;
  avatarId: string;
  isDefault: number;
  displayOrder: number;
  createdAt: number;
  updatedAt: number;
}

export class ProfileService {
  /**
   * Garante a criação de um perfil inicial de maneira idempotente e segura contra corridas concorrentes.
   */
  static async ensureInitialProfile(
    db: Database,
    userId: string,
    defaultName?: string
  ): Promise<ProfileRecord> {
    const existing = await db.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .orderBy(asc(profiles.displayOrder), asc(profiles.createdAt));

    if (existing.length > 0) {
      return existing[0];
    }

    // Se o nome não foi informado, busca da tabela de usuários
    let rawName = defaultName?.trim();
    if (!rawName) {
      const u = await db.db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      rawName = u[0]?.name ? u[0].name.trim() : 'Principal';
    }

    const firstName = (rawName || 'Principal').split(' ')[0] || 'Principal';
    const safeName = firstName.slice(0, 30);
    const profileId = crypto.randomUUID();
    const now = Date.now();

    try {
      await db.db.insert(profiles).values({
        id: profileId,
        userId,
        name: safeName,
        avatarId: DEFAULT_AVATAR_ID,
        isDefault: 1,
        displayOrder: 0,
        createdAt: now,
        updatedAt: now,
      });

      return {
        id: profileId,
        userId,
        name: safeName,
        avatarId: DEFAULT_AVATAR_ID,
        isDefault: 1,
        displayOrder: 0,
        createdAt: now,
        updatedAt: now,
      };
    } catch {
      // Em caso de colisão ou inserção concorrente em paralelo
      const raceWinner = await db.db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .orderBy(asc(profiles.displayOrder), asc(profiles.createdAt))
        .limit(1);

      if (raceWinner.length > 0) {
        return raceWinner[0];
      }
      throw new Error('Falha ao inicializar perfil da conta.');
    }
  }

  /**
   * Lista todos os perfis pertencentes ao usuário autenticado
   */
  static async listProfiles(
    db: Database,
    userId: string,
    userName?: string
  ): Promise<ProfileRecord[]> {
    let list = await db.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .orderBy(asc(profiles.displayOrder), asc(profiles.createdAt));

    if (list.length === 0) {
      const initial = await this.ensureInitialProfile(db, userId, userName);
      list = [initial];
    }

    return list;
  }

  /**
   * Obtém um perfil específico garantindo que pertença à conta autenticada
   */
  static async getProfileById(
    db: Database,
    userId: string,
    profileId: string
  ): Promise<ProfileRecord | null> {
    const found = await db.db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    return found[0] || null;
  }

  /**
   * Cria um novo perfil na conta autenticada
   */
  static async createProfile(
    db: Database,
    userId: string,
    data: { name: string; avatarId?: string }
  ): Promise<ProfileRecord> {
    const cleanName = typeof data.name === 'string' ? data.name.trim() : '';
    if (!cleanName || cleanName.length < 2 || cleanName.length > 30) {
      throw new Error('O nome do perfil deve ter entre 2 e 30 caracteres.');
    }

    // Validação de caracteres inválidos de controle
    if (/[\u0000-\u001F\u007F]/.test(cleanName)) {
      throw new Error('O nome do perfil contém caracteres inválidos.');
    }

    let avatarId = data.avatarId ? String(data.avatarId).trim() : DEFAULT_AVATAR_ID;
    if (!VALID_AVATAR_IDS.includes(avatarId)) {
      avatarId = DEFAULT_AVATAR_ID;
    }

    // Verifica limite configurável de perfis por conta
    const existing = await db.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .orderBy(asc(profiles.displayOrder), asc(profiles.createdAt));

    if (existing.length >= MAX_PROFILES_PER_USER) {
      throw new Error(`Limite máximo de ${MAX_PROFILES_PER_USER} perfis por conta atingido.`);
    }

    const profileId = crypto.randomUUID();
    const now = Date.now();
    const nextOrder = existing.length;
    const isDefault = existing.length === 0 ? 1 : 0;

    await db.db.insert(profiles).values({
      id: profileId,
      userId,
      name: cleanName,
      avatarId,
      isDefault,
      displayOrder: nextOrder,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: profileId,
      userId,
      name: cleanName,
      avatarId,
      isDefault,
      displayOrder: nextOrder,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Edita o nome e/ou avatar de um perfil pertencente à conta autenticada
   */
  static async updateProfile(
    db: Database,
    userId: string,
    profileId: string,
    data: { name?: string; avatarId?: string }
  ): Promise<ProfileRecord> {
    const existing = await this.getProfileById(db, userId, profileId);
    if (!existing) {
      throw new Error('Perfil não encontrado ou não pertence a esta conta.');
    }

    const updates: Partial<typeof profiles.$inferInsert> = {
      updatedAt: Date.now(),
    };

    if (data.name !== undefined) {
      const cleanName = typeof data.name === 'string' ? data.name.trim() : '';
      if (!cleanName || cleanName.length < 2 || cleanName.length > 30) {
        throw new Error('O nome do perfil deve ter entre 2 e 30 caracteres.');
      }
      if (/[\u0000-\u001F\u007F]/.test(cleanName)) {
        throw new Error('O nome do perfil contém caracteres inválidos.');
      }
      updates.name = cleanName;
    }

    if (data.avatarId !== undefined) {
      const cleanAvatar = String(data.avatarId).trim();
      if (!VALID_AVATAR_IDS.includes(cleanAvatar)) {
        throw new Error('Identificador de avatar inválido.');
      }
      updates.avatarId = cleanAvatar;
    }

    await db.db
      .update(profiles)
      .set(updates)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));

    const updated = await this.getProfileById(db, userId, profileId);
    return updated!;
  }

  /**
   * Exclui um perfil com confirmação, impedindo a exclusão do último perfil da conta
   */
  static async deleteProfile(
    db: Database,
    userId: string,
    profileId: string
  ): Promise<{ success: boolean; nextActiveProfileId: string }> {
    const currentList = await db.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .orderBy(asc(profiles.displayOrder), asc(profiles.createdAt));

    const targetIndex = currentList.findIndex((p) => p.id === profileId);
    if (targetIndex === -1) {
      throw new Error('Perfil não encontrado ou não pertence a esta conta.');
    }

    if (currentList.length <= 1) {
      throw new Error('Não é possível excluir o único perfil da conta. Crie outro perfil antes de excluir este.');
    }

    const targetProfile = currentList[targetIndex];
    const remaining = currentList.filter((p) => p.id !== profileId);
    let nextActiveProfileId = remaining[0].id;

    // Se o perfil excluído era o padrão, promove o primeiro remanescente a padrão
    if (targetProfile.isDefault === 1) {
      await db.db
        .update(profiles)
        .set({ isDefault: 1, updatedAt: Date.now() })
        .where(eq(profiles.id, remaining[0].id));
      nextActiveProfileId = remaining[0].id;
    } else {
      const defaultProfile = remaining.find((p) => p.isDefault === 1);
      if (defaultProfile) {
        nextActiveProfileId = defaultProfile.id;
      }
    }

    // Exclui o perfil
    await db.db
      .delete(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));

    return {
      success: true,
      nextActiveProfileId,
    };
  }

  /**
   * Resolve o perfil ativo para a requisição com base no cookie ou padrão da conta
   */
  static async resolveActiveProfile(
    db: Database,
    userId: string,
    requestedProfileId?: string | null
  ): Promise<ProfileRecord | null> {
    const userProfiles = await this.listProfiles(db, userId);
    if (userProfiles.length === 0) return null;

    if (requestedProfileId) {
      const matched = userProfiles.find((p) => p.id === requestedProfileId);
      if (matched) return matched;
    }

    // Fallback: perfil padrão ou primeiro da lista
    const defaultProfile = userProfiles.find((p) => p.isDefault === 1) || userProfiles[0];
    return defaultProfile;
  }
}
