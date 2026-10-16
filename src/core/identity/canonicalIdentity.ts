/**
 * ZapiTV — CanonicalMediaIdentity
 * Estabelece a identidade canônica obrigatória para qualquer mídia (filme, série ou anime)
 * antes da busca e seleção de fontes de reprodução.
 */

import { ContentItem, ContentType } from '../../../types';
import { theatricalFilterService } from '../catalog/theatricalFilterService';

export interface CanonicalMediaIdentity {
  id: string;
  tmdbId?: string;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  year: number;
  type: ContentType;
  season?: number;
  episode?: number;
  genres: string[];
  isChildFriendly: boolean;
  isTheatricalUnreleased: boolean;
  approximateDurationMinutes?: number;
  knownAliases: string[];
}

/**
 * Palavras irrelevantes que não devem ser usadas isoladamente para validar títulos
 */
const STOP_WORDS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na',
  'por', 'para', 'com', 'sem', 'sob', 'sobre',
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with'
]);

export class CanonicalIdentityService {
  public isSameWork(
    expected: Pick<ContentItem, 'title' | 'originalTitle' | 'year' | 'type'>,
    candidate: Pick<ContentItem, 'title' | 'originalTitle' | 'year' | 'type'>
  ): boolean {
    if (expected.type !== candidate.type) return false;
    if (expected.year && candidate.year && Math.abs(expected.year - candidate.year) > 1) return false;
    const titles = [expected.title, expected.originalTitle].filter(Boolean).map(value => this.normalizeTitle(value!));
    const candidates = [candidate.title, candidate.originalTitle].filter(Boolean).map(value => this.normalizeTitle(value!));
    return titles.some(title => title.length >= 3 && candidates.includes(title));
  }
  /**
   * Constrói a identidade canônica a partir de um ContentItem e parâmetros de episódio
   */
  public buildIdentity(
    item: ContentItem,
    epParams?: { season: number; episode: number } | null
  ): CanonicalMediaIdentity {
    const genres = (item.genres || []).map(g => g.toLowerCase());
    
    // Identifica se é conteúdo estritamente infantil ou familiar (ex: Doraemon, Ben 10, Peppa Pig)
    const isChildFriendly = (
      genres.some(g => /infantil|fam[ií]lia|kids|children|desenho|crian[çc]a/i.test(g)) ||
      /doraemon|peppa|galinha pintadinha|patrulha canina|pocoyo|chaves/i.test(item.title)
    );

    // Identifica apenas filmes cuja estreia ainda está no futuro.
    const currentYear = new Date().getFullYear();
    const isTheatricalUnreleased = (
      theatricalFilterService.isKnownUnreleasedOrTheatrical(item) ||
      Boolean(item.year && item.year > currentYear)
    );

    const aliases: string[] = [item.title.toLowerCase()];
    if (item.originalTitle) {
      aliases.push(item.originalTitle.toLowerCase());
      if (item.originalTitle.includes(':')) {
        item.originalTitle.split(':').forEach(p => {
          const clean = p.trim().toLowerCase();
          if (clean.length >= 3) aliases.push(clean);
        });
      }
    }
    if (item.title.includes(':')) {
      const parts = item.title.split(':');
      parts.forEach(p => {
        const clean = p.trim().toLowerCase();
        if (clean.length >= 3) aliases.push(clean);
      });
    }

    // Aliases específicos conhecidos
    if (/doraemon/i.test(item.title)) {
      aliases.push('doraemon', 'gato do futuro', 'ドラえもん');
    }
    if (/hope.*primeiro.*impacto/i.test(item.title)) {
      aliases.push('hope', 'hopeu', '호프');
    }
    if (/bleach.*thousand|bleach.*sennen/i.test(item.title) || /bleach.*thousand|bleach.*sennen/i.test(item.originalTitle || '')) {
      aliases.push('bleach sennen kessen hen', 'bleach sennen kessen-hen', 'bleach thousand-year blood war', 'bleach: sennen kessen-hen', 'bleach: thousand-year blood war');
    }

    return {
      id: item.id,
      tmdbId: item.tmdbId ? String(item.tmdbId) : undefined,
      imdbId: item.imdbId,
      title: item.title,
      year: item.year || currentYear,
      type: item.type,
      season: epParams?.season,
      episode: epParams?.episode,
      genres: item.genres || [],
      isChildFriendly,
      isTheatricalUnreleased,
      knownAliases: Array.from(new Set(aliases))
    };
  }

  /**
   * Normaliza um título removendo pontuações, anos e tags de qualidade
   */
  public normalizeTitle(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/\[[^\]]*\]/g, ' ')      // remove [1080p], [Dual], etc.
      .replace(/\([^\)]*\)/g, ' ')      // remove (2026), etc.
      .replace(/[^\w\s]/g, ' ')         // remove pontuações
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extrai palavras-chave significativas para comparação
   */
  public extractSignificantTokens(title: string): string[] {
    const normalized = this.normalizeTitle(title);
    return normalized
      .split(' ')
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  }
}

export const canonicalIdentityService = new CanonicalIdentityService();
