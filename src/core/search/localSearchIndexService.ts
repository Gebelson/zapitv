/**
 * ZAPITV — LOCAL SEARCH INDEX SERVICE
 * 
 * Índice de pesquisa local em memória com sub-millisecond lookup para
 * busca instantânea enquanto o usuário digita.
 * 
 * Características:
 * 1. Normalização ultraveloz de termos (remoção de acentos, pontuação e minúsculas).
 * 2. Indexação estruturada e incremental (sem reconstruir a cada renderização React).
 * 3. Priorização rigorosa de relevância:
 *    - 1º: Correspondência exata de título.
 *    - 2º: Título começa com o termo digitado.
 *    - 3º: Palavra do título começa com o termo.
 *    - 4º: Título contém o termo.
 *    - 5º: Título original ou aliases começam ou contêm o termo.
 *    - 6º: Gêneros correspondentes.
 *    - 7º: Atores, elenco e diretor correspondentes.
 * 4. Isolamento estrito por categoria (Filmes, Séries, Animes, Global).
 * 5. Proteção de conteúdo adulto, classificação indicativa e exclusão de itens banidos.
 */

import { ContentItem, ContentType, Profile } from '../../../types';
import { adultContentService } from '../adult/AdultContentService';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';
import { canonicalCatalogMaster } from '../catalog/CanonicalCatalogMaster';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';

export type SearchCategory = 'all' | 'movies' | 'series' | 'animes' | 'live';

export interface IndexedContentItem {
  id: string;
  item: ContentItem;
  canonicalId: string;
  normalizedTitle: string;
  titleWords: string[];
  normalizedOriginalTitle: string;
  originalTitleWords: string[];
  normalizedAliases: string[];
  normalizedGenres: string[];
  normalizedActors: string[];
  normalizedDirector: string;
  type: ContentType;
  year?: number;
  rating: number;
  isFeatured: boolean;
  isAdult: boolean;
}

export function normalizeSearchQuery(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class LocalSearchIndexService {
  private static instance: LocalSearchIndexService;
  private indexedMap = new Map<string, IndexedContentItem>();
  private lastCatalogCount = 0;
  private lastCatalogFingerprint = '';

  private constructor() {}

  public static getInstance(): LocalSearchIndexService {
    if (!LocalSearchIndexService.instance) {
      LocalSearchIndexService.instance = new LocalSearchIndexService();
    }
    return LocalSearchIndexService.instance;
  }

  /**
   * Sincroniza o acervo em memória com o índice incrementalmente.
   * Não reprocessa itens já indexados, garantindo custo O(novos_itens).
   */
  public syncCatalog(items: ContentItem[]): void {
    if (!items || items.length === 0) return;

    // Checagem rápida de fingerprint para pular sincronização se nada mudou
    if (items.length === this.lastCatalogCount) {
      const sample = `${items[0]?.id}_${items[Math.floor(items.length / 2)]?.id}_${items[items.length - 1]?.id}_${items.length}`;
      if (sample === this.lastCatalogFingerprint) {
        return;
      }
      this.lastCatalogFingerprint = sample;
    } else {
      this.lastCatalogCount = items.length;
      this.lastCatalogFingerprint = `${items[0]?.id}_${items[Math.floor(items.length / 2)]?.id}_${items[items.length - 1]?.id}_${items.length}`;
    }

    for (const item of items) {
      if (!item || !item.id || !item.title) continue;
      if (this.indexedMap.has(item.id)) continue;

      const normTitle = normalizeSearchQuery(item.title);
      const titleWords = normTitle.split(' ').filter(w => w.length > 0);

      const normOrig = item.originalTitle ? normalizeSearchQuery(item.originalTitle) : '';
      const origWords = normOrig ? normOrig.split(' ').filter(w => w.length > 0) : [];

      const aliases: string[] = [];
      if (item.canonicalId) aliases.push(normalizeSearchQuery(item.canonicalId));
      if (item.imdbId) aliases.push(normalizeSearchQuery(item.imdbId));
      if (item.tmdbId) aliases.push(normalizeSearchQuery(item.tmdbId));

      const genres = (item.genres || []).map(g => normalizeSearchQuery(g)).filter(Boolean);
      const actors = (item.cast || []).map(a => normalizeSearchQuery(a)).filter(Boolean);
      const director = item.director ? normalizeSearchQuery(item.director) : '';

      let canonicalId = item.canonicalId || item.imdbId || item.id;
      try {
        const resolved = canonicalCatalogMaster.resolveCanonicalId(item);
        if (resolved) canonicalId = resolved;
      } catch {}

      this.indexedMap.set(item.id, {
        id: item.id,
        item,
        canonicalId,
        normalizedTitle: normTitle,
        titleWords,
        normalizedOriginalTitle: normOrig,
        originalTitleWords: origWords,
        normalizedAliases: aliases,
        normalizedGenres: genres,
        normalizedActors: actors,
        normalizedDirector: director,
        type: item.type,
        year: item.year,
        rating: item.rating || 0,
        isFeatured: item.isFeatured === true,
        isAdult: adultContentService.isAdultContent(item)
      });
    }
  }

  /**
   * Executa busca local instantânea em memória com pontuação hierárquica e filtros de categoria.
   */
  public searchInstant(
    query: string,
    category: SearchCategory,
    options?: {
      limit?: number;
      userProfile?: Profile | null;
      isMovieCheck?: (item: ContentItem) => boolean;
      isSeriesCheck?: (item: ContentItem) => boolean;
      isAnimeCheck?: (item: ContentItem) => boolean;
    }
  ): ContentItem[] {
    const rawQuery = (query || '').trim();
    if (rawQuery.length < 2) return [];

    // Bloqueio de termos ilegais ou banidos
    if (adultContentService.isIllegalOrExploitative(rawQuery)) return [];
    if (bannedContentRegistry.isBannedTitle(rawQuery) || bannedContentRegistry.isBannedKeyOrId(rawQuery)) return [];

    const normQuery = normalizeSearchQuery(rawQuery);
    if (normQuery.length < 2) return [];

    const queryWords = normQuery.split(' ').filter(w => w.length > 0);
    const limit = options?.limit || 10;
    const userProfile = options?.userProfile;

    // Resolução de segurança adulta
    const isIntentionalAdult = adultContentService.isIntentionalAdultSearch(normQuery);
    const isChildProfile = userProfile ? userProfile.isChild === true : false;
    const allowAdult = isIntentionalAdult && !isChildProfile && adultContentService.isAgeConfirmed(userProfile?.id);

    const scoredMatches: Array<{ item: ContentItem; score: number }> = [];

    for (const indexed of this.indexedMap.values()) {
      // 1. Filtros de segurança e banimento
      if (bannedContentRegistry.isBanned(indexed.item)) continue;
      if (!catalogEligibilityService.isItemPubliclyPlayableSync(indexed.item)) continue;
      if (indexed.isAdult && !allowAdult) continue;

      // 2. Filtro estrito de categoria
      if (category !== 'all') {
        if (category === 'movies') {
          const match = options?.isMovieCheck ? options.isMovieCheck(indexed.item) : indexed.type === ContentType.MOVIE;
          if (!match) continue;
        } else if (category === 'series') {
          const match = options?.isSeriesCheck ? options.isSeriesCheck(indexed.item) : indexed.type === ContentType.SERIES;
          if (!match) continue;
        } else if (category === 'animes') {
          const match = options?.isAnimeCheck ? options.isAnimeCheck(indexed.item) : indexed.type === ContentType.ANIME;
          if (!match) continue;
        } else if (category === 'live') {
          if (!String(indexed.item.type || '').toLowerCase().includes('live')) continue;
        }
      }

      // 3. Pontuação de correspondência hierárquica
      let matchScore = 0;

      // --- Nível 1: Título Primário ---
      if (indexed.normalizedTitle === normQuery) {
        matchScore = 1200; // Correspondência exata absoluta
      } else if (indexed.normalizedTitle.startsWith(normQuery)) {
        matchScore = 900; // Começa com o termo
      } else if (indexed.titleWords.some(w => w.startsWith(normQuery))) {
        matchScore = 700; // Alguma palavra começa com o termo
      } else if (indexed.normalizedTitle.includes(normQuery)) {
        matchScore = 500; // Contém o termo contínuo
      } else if (queryWords.length > 1 && queryWords.every(qw => indexed.normalizedTitle.includes(qw))) {
        matchScore = 400; // Contém todas as palavras separadas
      }

      // --- Nível 2: Título Original ---
      if (matchScore === 0 && indexed.normalizedOriginalTitle) {
        if (indexed.normalizedOriginalTitle === normQuery) {
          matchScore = 1000;
        } else if (indexed.normalizedOriginalTitle.startsWith(normQuery)) {
          matchScore = 800;
        } else if (indexed.originalTitleWords.some(w => w.startsWith(normQuery))) {
          matchScore = 650;
        } else if (indexed.normalizedOriginalTitle.includes(normQuery)) {
          matchScore = 450;
        }
      }

      // --- Nível 3: Aliases Oficiais / IDs Canônicos ---
      if (matchScore === 0) {
        if (indexed.normalizedAliases.some(a => a.startsWith(normQuery) || a.includes(normQuery))) {
          matchScore = 350;
        }
      }

      // --- Nível 4: Gêneros ---
      if (matchScore === 0) {
        const matchingGenre = indexed.normalizedGenres.find(g => g === normQuery || g.startsWith(normQuery));
        if (matchingGenre) {
          matchScore = 300;
        }
      }

      // --- Nível 5: Atores / Elenco ---
      if (matchScore === 0 && indexed.normalizedActors.length > 0) {
        const actorMatch = indexed.normalizedActors.find(a => a === normQuery || a.startsWith(normQuery) || a.includes(normQuery));
        if (actorMatch) {
          matchScore = 250;
        }
      }

      // --- Nível 6: Diretor ---
      if (matchScore === 0 && indexed.normalizedDirector) {
        if (indexed.normalizedDirector.includes(normQuery)) {
          matchScore = 200;
        }
      }

      if (matchScore > 0) {
        // Tie-breakers de qualidade e relevância
        matchScore += Math.min(25, indexed.rating * 2.5);
        if (indexed.isFeatured) matchScore += 20;

        scoredMatches.push({
          item: indexed.item,
          score: matchScore
        });
      }
    }

    if (scoredMatches.length === 0) return [];

    // Ordenação decrescente pela pontuação de relevância
    scoredMatches.sort((a, b) => b.score - a.score);

    return scoredMatches.slice(0, limit).map(m => m.item);
  }

  /**
   * Limpa o índice local em memória
   */
  public clear(): void {
    this.indexedMap.clear();
    this.lastCatalogCount = 0;
    this.lastCatalogFingerprint = '';
  }

  /**
   * Retorna o total de itens indexados
   */
  public size(): number {
    return this.indexedMap.size;
  }
}

export const localSearchIndexService = LocalSearchIndexService.getInstance();
