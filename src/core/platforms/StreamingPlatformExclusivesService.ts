/**
 * ZapiTV - StreamingPlatformExclusivesService
 * 
 * Serviço inteligente para identificação e curadoria de carrosséis de exclusivos
 * das grandes plataformas de streaming (Netflix, Disney+, Prime Video, HBO Max,
 * Apple TV+, Paramount+, Globoplay, Crunchyroll).
 * 
 * Requisitos atendidos:
 * 1. Diferenciação explícita entre originalPlatform e currentExclusivePlatform.
 * 2. Correspondência confiável por TMDB ID, IMDb ID e identificadores canônicos.
 * 3. Integração com o catálogo existente sem duplicatas e sem alterar IDs.
 * 4. Respeito estrito à elegibilidade (apenas produções já lançadas com fontes válidas).
 * 5. Ocultação automática de plataformas com acervo insuficiente (< minItemsToDisplay).
 * 6. Cache otimizado com renovação periódica (TTL de 15 minutos e invalidação sob demanda).
 * 7. Sem subtítulos nem logotipos sobre as capas.
 */

import { ContentItem, ContentType } from '../../../types';
import { PersonalizedRow } from '../recommendations/recommendationTypes';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { deduplicateContentItems, normalizeCatalogText } from '../catalog/catalogDeduplication';
import { bannedContentRegistry } from '../catalog/BannedContentRegistry';
import {
  StreamingPlatformId,
  PlatformMetadataEntry,
  PLATFORM_CONFIGS
} from './streamingExclusivesTypes';
import { VERIFIED_STREAMING_EXCLUSIVES } from './streamingExclusivesData';

export class StreamingPlatformExclusivesService {
  private static instance: StreamingPlatformExclusivesService;

  // Índices rápidos em memória para busca O(1)
  private tmdbIndex = new Map<string, PlatformMetadataEntry>();
  private imdbIndex = new Map<string, PlatformMetadataEntry>();
  private titleYearIndex = new Map<string, PlatformMetadataEntry>();

  // Cache de fileiras geradas com TTL de 15 minutos e controle de revisão
  private rowsCache = new Map<string, { timestamp: number; rows: PersonalizedRow[] }>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private cacheRevision = 0;

  private constructor() {
    this.buildIndices();
  }

  public static getInstance(): StreamingPlatformExclusivesService {
    if (!StreamingPlatformExclusivesService.instance) {
      StreamingPlatformExclusivesService.instance = new StreamingPlatformExclusivesService();
    }
    return StreamingPlatformExclusivesService.instance;
  }

  public invalidateCache(): void {
    this.cacheRevision++;
    this.rowsCache.clear();
  }

  /**
   * Calcula fingerprint determinístico profundo do catálogo
   * Não depende apenas do tamanho ou das pontas da lista
   */
  private computeCatalogFingerprint(catalog: ContentItem[], isChild: boolean): string {
    if (!catalog || catalog.length === 0) {
      return `empty_${isChild ? 'child' : 'adult'}_rev${this.cacheRevision}`;
    }

    let hash = 0x811c9dc5;
    const len = catalog.length;
    for (let i = 0; i < len; i++) {
      const item = catalog[i];
      if (!item) continue;
      const str = `${item.id}:${item.availabilityStatus || ''}:${item.rating || 0};`;
      for (let j = 0; j < str.length; j++) {
        hash ^= str.charCodeAt(j);
        hash = (hash * 0x01000193) >>> 0;
      }
    }

    return `rev${this.cacheRevision}_${len}_${isChild ? 'child' : 'adult'}_${hash.toString(16)}`;
  }

  private buildIndices(): void {
    for (const entry of VERIFIED_STREAMING_EXCLUSIVES) {
      if (entry.tmdbId) {
        this.tmdbIndex.set(String(entry.tmdbId).trim(), entry);
      }
      if (entry.imdbId) {
        this.imdbIndex.set(entry.imdbId.trim().toLowerCase(), entry);
      }
      const normTitle = normalizeCatalogText(entry.title);
      if (normTitle) {
        if (entry.year) {
          this.titleYearIndex.set(`${normTitle}_${entry.year}`, entry);
        }
        this.titleYearIndex.set(normTitle, entry);
      }
    }
  }

  /**
   * Valida compatibilidade estrita entre o item do catálogo e a entrada de metadados
   * Impede falsos positivos causados por títulos idênticos em anos ou formatos diferentes
   */
  private isEntryCompatible(entry: PlatformMetadataEntry, item: ContentItem): boolean {
    if (!entry || !item) return false;

    // Se ambos possuem ano registrado, exige proximidade (máximo 1 ano de diferença para janelas internacionais)
    if (entry.year && item.year) {
      if (Math.abs(entry.year - item.year) > 1) {
        return false;
      }
    }

    // Compatibilidade de tipo de mídia
    if (entry.mediaType) {
      if (entry.mediaType === 'movie' && item.type === ContentType.SERIES) return false;
      if (entry.mediaType === 'series' && item.type === ContentType.MOVIE) return false;
      if (entry.mediaType === 'anime' && item.type !== ContentType.ANIME) {
        const hasAnimeGenre = item.genres?.some(g => /anime/i.test(g));
        if (!hasAnimeGenre) return false;
      }
    }

    return true;
  }

  /**
   * Identifica metadados de exclusividade de um conteúdo do catálogo
   */
  public getExclusivityMetadata(item: ContentItem): PlatformMetadataEntry | null {
    if (!item) return null;

    // 1. Correspondência prioritária por TMDB ID
    if (item.tmdbId) {
      const match = this.tmdbIndex.get(String(item.tmdbId).trim());
      if (match) return match;
    }

    // 2. Correspondência por IMDb ID
    if (item.imdbId) {
      const match = this.imdbIndex.get(item.imdbId.trim().toLowerCase());
      if (match) return match;
    }

    // 3. Correspondência por Título Normalizado + Ano (estrito)
    const normTitle = normalizeCatalogText(item.title);
    if (normTitle) {
      if (item.year) {
        const matchYear = this.titleYearIndex.get(`${normTitle}_${item.year}`);
        if (matchYear && this.isEntryCompatible(matchYear, item)) return matchYear;
        const matchPrev = this.titleYearIndex.get(`${normTitle}_${item.year - 1}`);
        if (matchPrev && this.isEntryCompatible(matchPrev, item)) return matchPrev;
        const matchNext = this.titleYearIndex.get(`${normTitle}_${item.year + 1}`);
        if (matchNext && this.isEntryCompatible(matchNext, item)) return matchNext;
      }
      const matchTitle = this.titleYearIndex.get(normTitle);
      if (matchTitle && this.isEntryCompatible(matchTitle, item)) return matchTitle;
    }

    // 4. Verificação de originalTitle se disponível
    if (item.originalTitle) {
      const normOrig = normalizeCatalogText(item.originalTitle);
      if (normOrig) {
        if (item.year) {
          const matchYear = this.titleYearIndex.get(`${normOrig}_${item.year}`);
          if (matchYear && this.isEntryCompatible(matchYear, item)) return matchYear;
          const matchPrev = this.titleYearIndex.get(`${normOrig}_${item.year - 1}`);
          if (matchPrev && this.isEntryCompatible(matchPrev, item)) return matchPrev;
          const matchNext = this.titleYearIndex.get(`${normOrig}_${item.year + 1}`);
          if (matchNext && this.isEntryCompatible(matchNext, item)) return matchNext;
        }
        const matchOrig = this.titleYearIndex.get(normOrig);
        if (matchOrig && this.isEntryCompatible(matchOrig, item)) return matchOrig;
      }
    }

    return null;
  }

  /**
   * Verifica se o item pertence com exclusividade comprovada a uma plataforma específica
   */
  public isExclusiveToPlatform(item: ContentItem, platformId: StreamingPlatformId): boolean {
    const meta = this.getExclusivityMetadata(item);
    if (!meta) return false;
    return meta.currentExclusivePlatform === platformId && meta.brazilExclusive === true;
  }

  /**
   * Filtra e ordena títulos elegíveis de uma plataforma específica a partir do catálogo fornecido
   */
  public getItemsForPlatform(
    catalog: ContentItem[],
    platformId: StreamingPlatformId,
    isChild: boolean = false
  ): ContentItem[] {
    if (!catalog || catalog.length === 0) return [];

    const matchedItems: ContentItem[] = [];
    const seenIds = new Set<string>();

    for (const item of catalog) {
      if (!item || seenIds.has(item.id)) continue;

      if (this.isExclusiveToPlatform(item, platformId)) {
        if (isChild) {
          const isAnim = item.type === ContentType.ANIME || item.genres?.some(g => /animação|animacao|animation|infantil|desenho|família|familia/i.test(g));
          const isFam = item.genres?.some(g => /família|familia|family|infantil/i.test(g));
          if (!isAnim && !isFam) continue;
        }
        seenIds.add(item.id);
        matchedItems.push(item);
      }
    }

    // Aplica regras de elegibilidade ZapiTV (reprodução autorizada, sem itens banidos, sem não-lançados)
    const cleanItems = bannedContentRegistry.filterCleanItems(matchedItems);
    const eligibleItems = catalogEligibilityService.filterEligibleItemsSync(cleanItems, {
      allowAdult: false
    });

    const deduped = deduplicateContentItems(eligibleItems);

    // Ordena por popularidade e avaliação com critério de qualidade ZapiTV
    return deduped.sort((a, b) => {
      const popA = a.popularity || a.tmdbPopularity || 0;
      const popB = b.popularity || b.tmdbPopularity || 0;
      const ratingA = typeof a.rating === 'number' ? a.rating : 0;
      const ratingB = typeof b.rating === 'number' ? b.rating : 0;

      const scoreA = (ratingA * 10) + Math.min(50, popA);
      const scoreB = (ratingB * 10) + Math.min(50, popB);
      return scoreB - scoreA;
    });
  }

  /**
   * Constrói a fileira personalizada para uma plataforma específica.
   * Se a quantidade de itens for inferior ao limite mínimo configurado, retorna null (oculta automaticamente).
   */
  public getPlatformRow(
    catalog: ContentItem[],
    platformId: StreamingPlatformId,
    isChild: boolean = false
  ): PersonalizedRow | null {
    const config = PLATFORM_CONFIGS[platformId];
    if (!config) return null;

    const items = this.getItemsForPlatform(catalog, platformId, isChild);

    // Ocultação automática caso a plataforma não tenha itens suficientes
    if (items.length < config.minItemsToDisplay) {
      return null;
    }

    return {
      id: `exclusive_${platformId}`,
      title: config.title, // Ex: 'Exclusivos Netflix'
      items,
      reasonType: 'platform_exclusives'
    };
  }

  /**
   * Retorna todas as fileiras de exclusivos disponíveis para o catálogo
   */
  public getAllPlatformRows(catalog: ContentItem[], isChild: boolean = false): PersonalizedRow[] {
    const fingerprint = this.computeCatalogFingerprint(catalog, isChild);
    const cached = this.rowsCache.get(fingerprint);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.rows;
    }

    const platformOrder: StreamingPlatformId[] = [
      'netflix',
      'disney',
      'prime',
      'hbo',
      'apple',
      'paramount',
      'globoplay',
      'crunchyroll'
    ];

    const rows: PersonalizedRow[] = [];
    for (const pid of platformOrder) {
      const row = this.getPlatformRow(catalog, pid, isChild);
      if (row) {
        rows.push(row);
      }
    }

    this.rowsCache.set(fingerprint, {
      timestamp: Date.now(),
      rows
    });

    return rows;
  }
}

export const streamingPlatformExclusivesService = StreamingPlatformExclusivesService.getInstance();
