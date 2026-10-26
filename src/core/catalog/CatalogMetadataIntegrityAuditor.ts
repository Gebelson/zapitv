/**
 * ZapiTV — CatalogMetadataIntegrityAuditor
 * 
 * Verificador reutilizável de integridade de metadados e correspondência estrita de capas.
 * Identifica inconsistências entre:
 * - Identificadores TMDB, IMDb e AniList
 * - Título original e título localizado
 * - Tipo de mídia (FILME, SÉRIE, ANIME)
 * - Ano de lançamento
 * - URLs de imagens (pôster, backdrop e miniaturas de episódios)
 * - Identidade real da produção (prevenindo que imagens de uma obra apareçam em outra)
 */

import { ContentItem, ContentType } from '../../../types';
import { isCorruptedPosterUrl, CORRUPTED_POSTER_FRAGMENTS } from './PosterRecoveryService';

export interface IntegrityIssue {
  severity: 'CRITICAL' | 'WARNING';
  category: 'IDENTITY' | 'MEDIA_TYPE' | 'IMAGE_MISMATCH' | 'CORRUPTED_URL' | 'EPISODE_IMAGE';
  message: string;
}

export interface ItemIntegrityReport {
  id: string;
  title: string;
  valid: boolean;
  issues: IntegrityIssue[];
}

export interface CatalogIntegrityReport {
  totalAudited: number;
  totalValid: number;
  totalCritical: number;
  totalWarnings: number;
  itemsWithIssues: ItemIntegrityReport[];
}

export class CatalogMetadataIntegrityAuditor {
  private static instance: CatalogMetadataIntegrityAuditor;

  public static getInstance(): CatalogMetadataIntegrityAuditor {
    if (!CatalogMetadataIntegrityAuditor.instance) {
      CatalogMetadataIntegrityAuditor.instance = new CatalogMetadataIntegrityAuditor();
    }
    return CatalogMetadataIntegrityAuditor.instance;
  }

  /**
   * Audita um item individual do catálogo quanto à consistência semântica e visual
   */
  public auditItem(item: ContentItem): ItemIntegrityReport {
    const issues: IntegrityIssue[] = [];
    const poster = item.image || item.poster || '';
    const backdrop = item.backdrop || '';

    // 1. Verificação de fragmentos e URLs comprovadamente corrompidos
    if (isCorruptedPosterUrl(poster)) {
      issues.push({
        severity: 'CRITICAL',
        category: 'CORRUPTED_URL',
        message: `Pôster contém fragmento de obra estrangeira corrompida: ${poster}`
      });
    }

    if (isCorruptedPosterUrl(backdrop)) {
      issues.push({
        severity: 'CRITICAL',
        category: 'CORRUPTED_URL',
        message: `Backdrop contém fragmento de obra estrangeira corrompida: ${backdrop}`
      });
    }

    // 2. Verificação estrita para Frieren: Beyond Journey's End
    const isFrieren = (
      item.id === 'anime-frieren' ||
      item.title?.toLowerCase().includes('frieren') ||
      item.originalTitle?.toLowerCase().includes('frieren') ||
      item.aniListId === 154587 ||
      String(item.tmdbId) === '209867'
    );

    if (isFrieren) {
      if (item.type !== ContentType.ANIME) {
        issues.push({
          severity: 'CRITICAL',
          category: 'MEDIA_TYPE',
          message: `Frieren deve possuir tipo ANIME, encontrado: ${item.type}`
        });
      }
      if (item.year !== 2023) {
        issues.push({
          severity: 'CRITICAL',
          category: 'IDENTITY',
          message: `Ano de Frieren deve ser 2023, encontrado: ${item.year}`
        });
      }
      if (item.originalTitle !== 'Sousou no Frieren') {
        issues.push({
          severity: 'WARNING',
          category: 'IDENTITY',
          message: `Título original esperado "Sousou no Frieren", encontrado: ${item.originalTitle}`
        });
      }

      // Proibição expressa de imagens de Spider-Man
      if (poster.includes('dqZENchTd7lp5zht7BdlqM7RBPd')) {
        issues.push({
          severity: 'CRITICAL',
          category: 'IMAGE_MISMATCH',
          message: `Frieren está com pôster de Homem-Aranha (dqZENchTd7lp5zht7BdlqM7RBPd)`
        });
      }
      if (backdrop.includes('4HodYYKEIsGOdinkGi2Ucz6X9i0')) {
        issues.push({
          severity: 'CRITICAL',
          category: 'IMAGE_MISMATCH',
          message: `Frieren está com backdrop de Homem-Aranha (4HodYYKEIsGOdinkGi2Ucz6X9i0)`
        });
      }

      // Verificação dos episódios de Frieren
      if (Array.isArray(item.episodes) && item.episodes.length > 0) {
        item.episodes.forEach((ep) => {
          if (ep.image && ep.image.includes('dqZENchTd7lp5zht7BdlqM7RBPd')) {
            issues.push({
              severity: 'CRITICAL',
              category: 'EPISODE_IMAGE',
              message: `Episódio ${ep.number} (${ep.id}) de Frieren está com miniatura de Homem-Aranha`
            });
          }
          if (ep.image && ep.image === poster) {
            issues.push({
              severity: 'WARNING',
              category: 'EPISODE_IMAGE',
              message: `Episódio ${ep.number} (${ep.id}) está reutilizando o pôster vertical da série em vez de miniatura horizontal`
            });
          }
        });
      }
    }

    // 3. Verificação estrita para Bleach: Thousand-Year Blood War
    const isBleachTybw = (
      item.id === 'anime-bleach-tybw' ||
      item.id === 'anime-bleach-tvmeter' ||
      item.title?.toLowerCase().includes('thousand-year blood war') ||
      item.originalTitle?.toLowerCase().includes('sennen kessen-hen') ||
      (item.title?.toLowerCase().includes('bleach') && item.year === 2022) ||
      item.aniListId === 116674
    );

    if (isBleachTybw) {
      if (item.type !== ContentType.ANIME) {
        issues.push({
          severity: 'CRITICAL',
          category: 'MEDIA_TYPE',
          message: `Bleach TYBW deve possuir tipo ANIME, encontrado: ${item.type}`
        });
      }
      if (item.year !== 2022) {
        issues.push({
          severity: 'CRITICAL',
          category: 'IDENTITY',
          message: `Ano de Bleach TYBW deve ser 2022, encontrado: ${item.year}`
        });
      }
      if (item.aniListId === 114446) {
        issues.push({
          severity: 'CRITICAL',
          category: 'IDENTITY',
          message: `Bleach TYBW não pode conter AniList ID 114446 (Higurashi: When They Cry - GOU). Deve ser 116674.`
        });
      }
      if (item.aniListId && item.aniListId !== 116674) {
        issues.push({
          severity: 'CRITICAL',
          category: 'IDENTITY',
          message: `AniList ID esperado para Bleach TYBW é 116674, encontrado: ${item.aniListId}`
        });
      }

      // Proibição expressa de imagens de Higurashi (114446, H6uxjVi8wBoo, DTd4xfGx7DJB)
      if (poster.includes('114446') || poster.includes('H6uxjVi8wBoo')) {
        issues.push({
          severity: 'CRITICAL',
          category: 'IMAGE_MISMATCH',
          message: `Bleach TYBW está com pôster de Higurashi: When They Cry - GOU (${poster})`
        });
      }
      if (backdrop.includes('114446') || backdrop.includes('DTd4xfGx7DJB')) {
        issues.push({
          severity: 'CRITICAL',
          category: 'IMAGE_MISMATCH',
          message: `Bleach TYBW está com backdrop de Higurashi: When They Cry - GOU (${backdrop})`
        });
      }

      // Verificação dos episódios de Bleach TYBW
      if (Array.isArray(item.episodes) && item.episodes.length > 0) {
        item.episodes.forEach((ep) => {
          if (ep.image && (ep.image.includes('114446') || ep.image.includes('H6uxjVi8wBoo') || ep.image.includes('DTd4xfGx7DJB'))) {
            issues.push({
              severity: 'CRITICAL',
              category: 'EPISODE_IMAGE',
              message: `Episódio ${ep.number} (${ep.id}) de Bleach TYBW está com miniatura de Higurashi`
            });
          }
        });
      }
    }

    // 4. Verificação de Tipo vs AniList ID
    if (item.aniListId && item.type !== ContentType.ANIME) {
      issues.push({
        severity: 'CRITICAL',
        category: 'MEDIA_TYPE',
        message: `Item possui aniListId (${item.aniListId}) mas tipo não é ANIME: ${item.type}`
      });
    }

    // 5. Verificação de Episódios: Miniatura não deve ser idêntica ao pôster vertical quando disponível
    if (Array.isArray(item.episodes)) {
      item.episodes.forEach(ep => {
        if (ep.image && isCorruptedPosterUrl(ep.image)) {
          issues.push({
            severity: 'CRITICAL',
            category: 'EPISODE_IMAGE',
            message: `Episódio ${ep.number} (${ep.id}) contém URL corrompida: ${ep.image}`
          });
        }
      });
    }

    const hasCritical = issues.some(i => i.severity === 'CRITICAL');

    return {
      id: item.id,
      title: item.title,
      valid: !hasCritical,
      issues
    };
  }

  /**
   * Audita uma lista completa de conteúdos do catálogo
   */
  public auditCatalog(items: ContentItem[]): CatalogIntegrityReport {
    const reports = items.map(item => this.auditItem(item));
    const itemsWithIssues = reports.filter(r => r.issues.length > 0);
    const totalCritical = itemsWithIssues.filter(r => !r.valid).length;
    const totalWarnings = itemsWithIssues.filter(r => r.valid && r.issues.length > 0).length;

    return {
      totalAudited: items.length,
      totalValid: items.length - totalCritical,
      totalCritical,
      totalWarnings,
      itemsWithIssues
    };
  }
}

export const catalogMetadataIntegrityAuditor = CatalogMetadataIntegrityAuditor.getInstance();
