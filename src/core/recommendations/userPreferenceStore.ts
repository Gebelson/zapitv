/**
 * ZapiTV - UserPreferenceStore
 * Armazenamento local e aprendizado contínuo de preferências do usuário:
 * 1. Persistência local no IndexedDB (via db.keyValueStore) sem exigir login nem enviar dados a servidores
 * 2. Registro ponderado de reproduções, % assistido, conclusão, favoritos e interações
 * 3. Decaimento temporal: preferências recentes têm maior peso através de meia-vida exponencial
 * 4. Filtragem de ruído: erros de player NÃO são tratados como abandono; cliques acidentais (< 25s) são ignorados
 * 5. Re-hidratação com histórico existente (Continuar Assistindo, Favoritos, Minha Lista)
 * 6. Função de limpeza total de preferências personalizadas
 */

import { db } from '../../../db';
import { ContentItem, ContentType } from '../../../types';
import {
  UserInteraction,
  UserPreferenceProfile,
  InteractionType
} from './recommendationTypes';

// Meia-vida para decaimento temporal: 14 dias em milissegundos
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
const LAMBDA_DECAY = Math.LN2 / HALF_LIFE_MS;

// Palavras-chave temáticas prioritárias para perfil semântico
const COMMON_THEMES = [
  'stop motion', 'dark fantasy', 'serial killer', 'investigação', 'investigation',
  'psicológico', 'psychological', 'detetive', 'detective', 'sobrenatural', 'supernatural',
  'magia', 'magic', 'bruxa', 'witch', 'vampiro', 'vampire', 'viagem no tempo', 'time travel',
  'multiverso', 'multiverse', 'cyberpunk', 'inteligência artificial', 'sci-fi', 'ficção científica',
  'apocalipse', 'post-apocalyptic', 'zumbi', 'zombie', 'super-herói', 'superhero',
  'espaço', 'alien', 'máfia', 'crime', 'policial', 'vingança', 'suspense', 'terror', 'horror',
  'comédia', 'romance', 'drama', 'ação', 'aventura', 'shounen', 'seinen', 'isekai'
];

export class UserPreferenceStore {
  private inMemoryProfiles: Map<string, UserPreferenceProfile> = new Map();
  private interactionHistory: Map<string, UserInteraction[]> = new Map();
  private hydratedProfiles = new Set<string>();
  private checkedDatabase = new Set<string>();
  private readonly STORAGE_PREFIX = 'zapitv_user_prefs_';
  private readonly INTERACTIONS_PREFIX = 'zapitv_user_interactions_';

  constructor() {
    this.hydrateFromLocalSync();
    this.persistProfile = this.persistProfile.bind(this);
    this.setProfileMetadata = this.setProfileMetadata.bind(this);
    this.getPreferences = this.getPreferences.bind(this);
    this.getPreferencesSync = this.getPreferencesSync.bind(this);
    this.recordDetailView = this.recordDetailView.bind(this);
    this.recordPlayback = this.recordPlayback.bind(this);
    this.recordFavorite = this.recordFavorite.bind(this);
    this.computeProfileFromHistory = this.computeProfileFromHistory.bind(this);
    this.seedFromExistingContinuity = this.seedFromExistingContinuity.bind(this);
  }

  /**
   * Carrega perfil síncrono inicial do localStorage para evitar atrasos na primeira renderização.
   */
  private hydrateFromLocalSync(): void {
    if (typeof window === 'undefined') return;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const profileId = key.replace(this.STORAGE_PREFIX, '');
          const raw = localStorage.getItem(key);
          if (raw) {
            let parsed: unknown;
            try { parsed = JSON.parse(raw); } catch { continue; }
            if (this.isStoredProfile(parsed, profileId)) {
              this.inMemoryProfiles.set(profileId, parsed);
              this.hydratedProfiles.add(profileId);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao hidratar preferências locais do ZapiTV:', e);
    }
  }

  private isStoredProfile(value: unknown, profileId: string): value is UserPreferenceProfile {
    const p = value as UserPreferenceProfile | null;
    return !!p && p.profileId === profileId && Number.isFinite(p.lastUpdated) &&
      Number.isFinite(p.interactionCount) && Array.isArray(p.watchedContentIds) &&
      Array.isArray(p.completedContentIds) && Array.isArray(p.favoriteContentIds) &&
      ['genreAffinities', 'themeAffinities', 'directorAffinities', 'castAffinities', 'typeAffinities']
        .every(key => !!(p as unknown as Record<string, unknown>)[key] && typeof (p as unknown as Record<string, unknown>)[key] === 'object');
  }

  /**
   * Retorna o perfil de preferências síncrono (cache em memória).
   */
  public getPreferencesSync(profileId: string = 'default'): UserPreferenceProfile {
    const existing = this.inMemoryProfiles.get(profileId);
    if (existing) return existing;

    const emptyProfile: UserPreferenceProfile = {
      profileId,
      isChild: false,
      genreAffinities: {},
      themeAffinities: {},
      directorAffinities: {},
      castAffinities: {},
      typeAffinities: {},
      completedContentIds: [],
      watchedContentIds: [],
      favoriteContentIds: [],
      totalEngagementScore: 0,
      lastUpdated: Date.now(),
      interactionCount: 0
    };

    this.inMemoryProfiles.set(profileId, emptyProfile);
    return emptyProfile;
  }

  /**
   * Persiste o perfil de preferências localmente (localStorage + IndexedDB).
   * Garante tolerância a falhas e preserva os dados existentes sem exigir login.
   */
  public async persistProfile(profileId: string = 'default', profile?: UserPreferenceProfile): Promise<void> {
    let targetProfile = profile || this.inMemoryProfiles.get(profileId) || this.getPreferencesSync(profileId);
    if (!this.hydratedProfiles.has(profileId) && !this.checkedDatabase.has(profileId) && targetProfile.interactionCount === 0) {
      const isChild = targetProfile.isChild;
      targetProfile = { ...await this.getPreferences(profileId), isChild };
      this.inMemoryProfiles.set(profileId, targetProfile);
    }
    const storageKey = `${this.STORAGE_PREFIX}${profileId}`;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(storageKey, JSON.stringify(targetProfile));
      }
    } catch {}
    try {
      await db.keyValueStore.put({ key: storageKey, value: targetProfile });
    } catch (e) {
      // Falha silenciosa e graciosa em ambientes sem IndexedDB ou storage bloqueado
    }
  }

  /**
   * Atualiza metadados do perfil (ex: se é perfil infantil ou padrão).
   */
  public setProfileMetadata(profileId: string = 'default', metadata: { isChild?: boolean }): void {
    const profile = this.getPreferencesSync(profileId);
    if (metadata.isChild !== undefined) {
      profile.isChild = metadata.isChild;
    }
    this.inMemoryProfiles.set(profileId, profile);
    this.persistProfile(profileId, profile).catch(() => {});
  }

  /**
   * Obtém o perfil de preferências atualizado (IndexedDB + memória).
   */
  public async getPreferences(profileId: string = 'default'): Promise<UserPreferenceProfile> {
    if (this.checkedDatabase.has(profileId)) return this.getPreferencesSync(profileId);
    try {
      const dbRow = await db.keyValueStore.get(`${this.STORAGE_PREFIX}${profileId}`);
      this.checkedDatabase.add(profileId);
      const mem = this.inMemoryProfiles.get(profileId);
      if (dbRow && this.isStoredProfile(dbRow.value, profileId) &&
        (!mem || (!(this.hydratedProfiles.has(profileId) || mem.interactionCount > 0)) || dbRow.value.lastUpdated > mem.lastUpdated)) {
        this.inMemoryProfiles.set(profileId, dbRow.value);
        this.hydratedProfiles.add(profileId);
        return dbRow.value;
      }
    } catch (e) {
      // Fallback gracioso
    }

    return this.getPreferencesSync(profileId);
  }

  /**
   * Registra uma interação de reprodução ou progresso no player.
   * Regras obrigatórias:
   * 1. Erros de player (isError) NÃO são tratados como abandono nem geram penalidade.
   * 2. Cliques rápidos acidentais (< 25s e < 5%) são descartados.
   * 3. >= 85% de conclusão marca como 'completed' com peso máximo.
   */
  public async recordPlayback(
    item: ContentItem,
    currentTime: number,
    duration: number,
    isError: boolean = false,
    profileId: string = 'default',
    audioLanguage?: string
  ): Promise<void> {
    if (!item || !item.id) return;

    // Regra 1: Descartar erros de reprodução sem penalizar o usuário
    if (isError) {
      return;
    }

    const safeDuration = duration > 0 ? duration : (item.duration ? item.duration * 60 : 0);
    const percentage = safeDuration > 0 ? Math.min(100, Math.round((currentTime / safeDuration) * 100)) : 0;

    // Regra 2: Não tratar um único clique rápido (< 25s e < 5%) como preferência forte
    if (currentTime < 25 && percentage < 5) {
      return;
    }

    const isCompleted = percentage >= 85;
    const type: InteractionType = isCompleted ? 'completed' : 'progress_update';

    const interaction: UserInteraction = {
      id: `${item.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      profileId,
      contentId: item.id,
      type,
      timestamp: Date.now(),
      watchPercentage: percentage,
      duration: safeDuration,
      currentTime,
      isError: false,
      genres: item.genres || [],
      title: item.title,
      contentType: item.type,
      audioLanguage
    };

    await this.saveInteraction(interaction, item);
  }

  /**
   * Registra adição ou remoção de favoritos e Minha Lista.
   */
  public async recordFavorite(
    item: ContentItem,
    isFavorite: boolean,
    profileId: string = 'default'
  ): Promise<void> {
    if (!item || !item.id) return;

    const interaction: UserInteraction = {
      id: `${item.id}_fav_${Date.now()}`,
      profileId,
      contentId: item.id,
      type: isFavorite ? 'favorite_add' : 'favorite_remove',
      timestamp: Date.now(),
      genres: item.genres || [],
      title: item.title,
      contentType: item.type
    };

    await this.saveInteraction(interaction, item);
  }

  /**
   * Registra visualização de detalhes (interesse leve exploratório).
   */
  public async recordDetailView(item: ContentItem, profileId: string = 'default'): Promise<void> {
    if (!item || !item.id) return;

    const interaction: UserInteraction = {
      id: `${item.id}_detail_${Date.now()}`,
      profileId,
      contentId: item.id,
      type: 'detail_view',
      timestamp: Date.now(),
      genres: item.genres || [],
      title: item.title,
      contentType: item.type
    };

    await this.saveInteraction(interaction, item);
  }

  /**
   * Salva a interação, atualiza a lista e recalcula os vetores de afinidade com decaimento temporal.
   */
  private async saveInteraction(interaction: UserInteraction, item: ContentItem): Promise<void> {
    const profileId = interaction.profileId || 'default';
    const history = this.interactionHistory.get(profileId) || [];
    history.push(interaction);
    if (history.length > 300) {
      history.shift(); // Manter histórico recente limitado para economizar memória
    }
    this.interactionHistory.set(profileId, history);

    // Recalcular perfil ponderado
    const profile = this.computeProfileFromHistory(profileId, history, item, interaction);
    this.inMemoryProfiles.set(profileId, profile);

    // Persistência assíncrona local (IndexedDB + localStorage)
    await this.persistProfile(profileId, profile);
  }

  /**
   * Calcula o perfil de afinidade aplicando decaimento temporal e pesos de engajamento.
   */
  public computeProfileFromHistory(
    profileId: string,
    history: UserInteraction[],
    currentItem?: ContentItem,
    lastInteraction?: UserInteraction
  ): UserPreferenceProfile {
    const now = Date.now();
    const genreRawScores: Record<string, number> = {};
    const themeRawScores: Record<string, number> = {};
    const directorRawScores: Record<string, number> = {};
    const castRawScores: Record<string, number> = {};
    const typeRawScores: Record<string, number> = {};
    const completedSet = new Set<string>();
    const watchedSet = new Set<string>();
    const favoriteSet = new Set<string>();

    let totalScore = 0;

    for (const inter of history) {
      // 1. Fator de decaimento temporal exponencial: e^(-lambda * deltaT)
      const ageMs = Math.max(0, now - inter.timestamp);
      const temporalDecay = Math.exp(-LAMBDA_DECAY * ageMs);

      // 2. Peso da ação
      let actionWeight = 0.1; // Default
      switch (inter.type) {
        case 'completed':
          actionWeight = 1.0;
          completedSet.add(inter.contentId);
          watchedSet.add(inter.contentId);
          break;
        case 'progress_update':
          const pct = inter.watchPercentage || 0;
          if (pct >= 85) {
            actionWeight = 1.0;
            completedSet.add(inter.contentId);
          } else if (pct >= 50) {
            actionWeight = 0.8;
          } else if (pct >= 25) {
            actionWeight = 0.5;
          } else {
            actionWeight = 0.2;
          }
          watchedSet.add(inter.contentId);
          break;
        case 'favorite_add':
        case 'watchlist_add':
          actionWeight = 0.75;
          favoriteSet.add(inter.contentId);
          break;
        case 'favorite_remove':
        case 'watchlist_remove':
          actionWeight = -0.3; // Leve desinteresse
          favoriteSet.delete(inter.contentId);
          break;
        case 'detail_view':
          actionWeight = 0.12; // Sinal exploratório leve
          break;
        default:
          actionWeight = 0.1;
      }

      const effectiveWeight = actionWeight * temporalDecay;
      totalScore += Math.max(0, effectiveWeight);

      // 3. Acumular afinidade por gênero
      if (inter.genres && Array.isArray(inter.genres)) {
        for (const g of inter.genres) {
          const normG = g.trim();
          if (normG && normG !== 'Adulto') {
            genreRawScores[normG] = (genreRawScores[normG] || 0) + effectiveWeight;
          }
        }
      }

      // 4. Acumular afinidade por tipo de mídia (Filme, Série, Anime)
      if (inter.contentType) {
        typeRawScores[inter.contentType] = (typeRawScores[inter.contentType] || 0) + effectiveWeight;
      }
    }

    // Se temos o item atual, extrair temas e diretores adicionais
    if (currentItem && lastInteraction) {
      const ageMs = Math.max(0, now - lastInteraction.timestamp);
      const decay = Math.exp(-LAMBDA_DECAY * ageMs);
      const currentWeight = 0.8 * decay;

      if (currentItem.director) {
        directorRawScores[currentItem.director] = (directorRawScores[currentItem.director] || 0) + currentWeight;
      }

      if (currentItem.cast && Array.isArray(currentItem.cast)) {
        for (const actor of currentItem.cast.slice(0, 3)) {
          castRawScores[actor] = (castRawScores[actor] || 0) + (currentWeight * 0.5);
        }
      }

      // Extrair temas do texto/descrição
      const text = `${currentItem.title} ${currentItem.description || ''} ${currentItem.overview || ''} ${(currentItem.traits || []).join(' ')}`.toLowerCase();
      for (const theme of COMMON_THEMES) {
        if (text.includes(theme)) {
          themeRawScores[theme] = (themeRawScores[theme] || 0) + currentWeight;
        }
      }
    }

    // Normalizar afinidades para o intervalo [0, 1] com base no maior valor
    const normalizeRecord = (rec: Record<string, number>): Record<string, number> => {
      const maxVal = Math.max(...Object.values(rec), 0.0001);
      const normalized: Record<string, number> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (v > 0) {
          normalized[k] = Math.min(1.0, Math.round((v / maxVal) * 100) / 100);
        }
      }
      return normalized;
    };

    const genreAffinities = normalizeRecord(genreRawScores);
    const themeAffinities = normalizeRecord(themeRawScores);
    const directorAffinities = normalizeRecord(directorRawScores);
    const castAffinities = normalizeRecord(castRawScores);
    const typeAffinities = normalizeRecord(typeRawScores);

    const existing = this.inMemoryProfiles.get(profileId);
    const isChild = existing?.isChild ?? false;

    return {
      profileId,
      isChild,
      genreAffinities,
      themeAffinities,
      directorAffinities,
      castAffinities,
      typeAffinities,
      completedContentIds: Array.from(completedSet),
      watchedContentIds: Array.from(watchedSet),
      favoriteContentIds: Array.from(favoriteSet),
      totalEngagementScore: Math.round(totalScore * 100) / 100,
      lastUpdated: now,
      interactionCount: history.length
    };
  }

  /**
   * Limpa integralmente as preferências personalizadas do usuário,
   * restaurando o estado original de Cold Start sem dados residuais.
   */
  public async clearPreferences(profileId: string = 'default'): Promise<void> {
    this.inMemoryProfiles.delete(profileId);
    this.hydratedProfiles.delete(profileId);
    this.checkedDatabase.delete(profileId);
    this.interactionHistory.delete(profileId);

    const storageKey = `${this.STORAGE_PREFIX}${profileId}`;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(storageKey);
      }
    } catch {}
    try {
      await db.keyValueStore.delete(storageKey);
    } catch (e) {
      // Ignorar
    }
  }

  /**
   * Hidrata o perfil usando os dados de progresso e favoritos já existentes no ZapiTV.
   */
  public seedFromExistingContinuity(
    profileId: string,
    continueWatching: Array<{ item: ContentItem; percentage: number; currentTime: number; duration: number }>,
    favorites: ContentItem[]
  ): void {
    const history: UserInteraction[] = [];

    // Converter continuar assistindo em interações ponderadas
    if (Array.isArray(continueWatching)) {
      continueWatching.forEach((cw, idx) => {
        if (cw?.item) {
          history.push({
            id: `seed_cw_${cw.item.id}_${idx}`,
            profileId,
            contentId: cw.item.id,
            type: cw.percentage >= 85 ? 'completed' : 'progress_update',
            timestamp: Date.now() - (idx * 3600 * 1000), // Espaçamento temporal
            watchPercentage: cw.percentage,
            currentTime: cw.currentTime,
            duration: cw.duration,
            genres: cw.item.genres || [],
            title: cw.item.title,
            contentType: cw.item.type
          });
        }
      });
    }

    // Converter favoritos
    if (Array.isArray(favorites)) {
      favorites.forEach((fav, idx) => {
        if (fav?.id) {
          history.push({
            id: `seed_fav_${fav.id}_${idx}`,
            profileId,
            contentId: fav.id,
            type: 'favorite_add',
            timestamp: Date.now() - (idx * 1800 * 1000),
            genres: fav.genres || [],
            title: fav.title,
            contentType: fav.type
          });
        }
      });
    }

    if (history.length > 0) {
      this.interactionHistory.set(profileId, history);
      const profile = this.computeProfileFromHistory(profileId, history);
      this.inMemoryProfiles.set(profileId, profile);
      this.persistProfile(profileId, profile).catch(() => {});
    }
  }
}

export const userPreferenceStore = new UserPreferenceStore();
