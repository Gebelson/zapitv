/**
 * ZAPITV — ADULT CONTENT CLASSIFICATION & PROTECTION SERVICE
 * 
 * Governa a classificação, isolamento e proteção de conteúdos adultos/pornográficos:
 * 1. Ocultar por padrão de todas as seções públicas (Home, Filmes, Séries, Animes, Destaques, Semelhantes).
 * 2. Classificação precisa: diferencia pornografia/erotismo explícito de obras maduras 18+ convencionais (Dexter, etc.).
 * 3. Proteção e controle parental: bloqueio total para perfis infantis (isChild) e exigência de confirmação (+18).
 * 4. Bloqueio com tolerância zero para conteúdos ilegais ou exploração de menores.
 * 5. Pesquisa intencional: exibe apenas mediante busca direta pelo título e maioridade confirmada.
 */

import { ContentItem, ContentType, Profile } from '../../../types';

const STORAGE_AGE_CONFIRMED_PREFIX = 'zapitv_age_confirmed_';
const ADULT_GENRE_NAMES = new Set([
  'adult',
  'adulto',
  'porn',
  'porno',
  'pornô',
  'pornography',
  'hentai',
  'erotica'
]);

// Termos estritamente ilegais ou de exploração que acionam bloqueio absoluto
const ILLEGAL_EXPLOITATIVE_PATTERNS = [
  /\bcp\b/i,
  /\bcsam\b/i,
  /\bchild\b.*\b(porn|sex|erotic)\b/i,
  /\bpedophil|\bpaedophil/i,
  /\blolita\b|\bloli\b.*\b(porn|sex|hentai)\b/i,
  /\bshota\b.*\b(porn|sex|hentai)\b/i,
  /\bunderage\b.*\b(porn|sex)\b/i,
  /\bmenor\b.*\b(porn|sexo)\b/i,
  /\binfantil\b.*\b(porn|sexo|erot)\b/i,
  /\bestupro\b|\brape\b/i
];

// Obras maduras 18+ conhecidas que JAMAIS devem ser classificadas como pornografia
const KNOWN_MAINSTREAM_MATURE_TITLES = new Set([
  'dexter',
  'dexter: new blood',
  'game of thrones',
  'a casa do dragão',
  'house of the dragon',
  'the boys',
  'breaking bad',
  'better call saul',
  'pulp fiction',
  'euphoria',
  'clube da luta',
  'fight club',
  'laranja mecânica',
  'a clockwork orange',
  'coraline',
  'attack on titan',
  'shingeki no kyojin',
  'berserk',
  'mindhunter',
  'você',
  'you',
  'narcos',
  'peaky blinders',
  'true detective'
]);

export class AdultContentService {
  private static instance: AdultContentService;
  private memoryAgeConfirmed = new Set<string>();

  private constructor() {}

  public static getInstance(): AdultContentService {
    if (!AdultContentService.instance) {
      AdultContentService.instance = new AdultContentService();
    }
    return AdultContentService.instance;
  }

  /**
   * Identifica se um conteúdo é estritamente adulto/pornográfico.
   * Não confunde obras para maiores de 18 anos com pornografia (Regra 4).
   */
  public isAdultContent(item: Partial<ContentItem> | any): boolean {
    if (!item) return false;

    // 1. Obras consagradas para maiores de 18 anos nunca são pornografia
    const title = String(item.title || item.name || '').toLowerCase().trim();
    if (KNOWN_MAINSTREAM_MATURE_TITLES.has(title)) {
      return false;
    }

    // 2. Marcador explícito do modelo
    if (item.isAdult === true) return true;

    // 3. Indicador booleano oficial do TMDB
    if (item.adult === true) return true;

    // 4. Gêneros dedicados a pornografia / erotismo explícito / hentai
    if (Array.isArray(item.genres)) {
      const hasAdultGenre = item.genres.some((g: any) => {
        if (!g) return false;
        const norm = String(g).toLowerCase().trim();
        return ADULT_GENRE_NAMES.has(norm);
      });
      if (hasAdultGenre) return true;
    }

    // 5. Metadados do Cinemeta Stremio
    if (Array.isArray(item.tags)) {
      const hasAdultTag = item.tags.some((t: any) => {
        const norm = String(t).toLowerCase().trim();
        return norm === 'adult' || norm === 'xxx' || norm === 'hentai';
      });
      if (hasAdultTag) return true;
    }

    return false;
  }

  /**
   * Verifica se um termo ou título envolve exploração ilegal de menores ou conteúdo proibido.
   * Tolerância zero com bloqueio imediato (Regra 5).
   */
  public isIllegalOrExploitative(text: string): boolean {
    if (!text || !text.trim()) return false;
    const norm = text.toLowerCase().trim();
    return ILLEGAL_EXPLOITATIVE_PATTERNS.some(pattern => pattern.test(norm));
  }

  /**
   * Determina se a busca digitada é intencionalmente direcionada a conteúdos adultos.
   * Evita exibir conteúdos adultos em buscas genéricas como "ação", "drama", "filme", etc. (Regra 2).
   */
  public isIntentionalAdultSearch(query: string, availableAdultTitles: string[] = []): boolean {
    if (!query || !query.trim()) return false;
    const clean = query.toLowerCase().trim();

    // Bloqueia termos ilegais
    if (this.isIllegalOrExploitative(clean)) return false;

    // Termos genéricos comuns nunca ativam busca adulta
    const genericTerms = new Set([
      'a', 'o', 'os', 'as', 'de', 'do', 'da', 'e', 'em', 'um', 'uma',
      'filme', 'filmes', 'serie', 'series', 'série', 'séries',
      'anime', 'animes', 'novo', 'novos', 'top', 'melhor', 'melhores',
      'acao', 'ação', 'comedia', 'comédia', 'drama', 'terror', 'aventura',
      'ficcao', 'ficção', 'romance', 'suspense', 'animacao', 'animação'
    ]);
    if (genericTerms.has(clean) || clean.length < 3) {
      return false;
    }

    // Termos intencionais adultos explícitos
    const explicitAdultSearchTerms = [
      'adulto', 'adultos', 'porn', 'porno', 'pornô', 'xxx', 'hentai',
      'erotico', 'erótico', 'erotica', 'erótica', 'sexo'
    ];
    if (explicitAdultSearchTerms.some(term => clean === term || clean.startsWith(`${term} `) || clean.endsWith(` ${term}`))) {
      return true;
    }

    // Se o usuário digitou o nome específico de uma obra adulta catalogada
    if (availableAdultTitles.length > 0) {
      const match = availableAdultTitles.some(t => {
        const normTitle = t.toLowerCase().trim();
        return normTitle === clean || (clean.length >= 4 && normTitle.includes(clean));
      });
      if (match) return true;
    }

    return false;
  }

  /**
   * Verifica se o perfil tem permissão de acesso a conteúdos adultos.
   * Bloqueia completamente perfis infantis (Regra 5).
   */
  public canAccessAdult(profile?: Profile | { isChild?: boolean } | null): boolean {
    if (!profile) return true; // perfil padrão ou visitante
    if (profile.isChild === true) return false;
    return true;
  }

  /**
   * Verifica se a maioridade (+18) foi confirmada para o perfil atual.
   */
  public isAgeConfirmed(profileId = 'global'): boolean {
    if (this.memoryAgeConfirmed.has(profileId)) return true;
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      const key = `${STORAGE_AGE_CONFIRMED_PREFIX}${profileId}`;
      const val = localStorage.getItem(key);
      if (val === 'confirmed' || val === 'true') {
        this.memoryAgeConfirmed.add(profileId);
        return true;
      }
    } catch {
      // Ignora erro de storage
    }
    return false;
  }

  /**
   * Registra a confirmação de maioridade (+18) do usuário.
   */
  public confirmAge(profileId = 'global'): void {
    this.memoryAgeConfirmed.add(profileId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `${STORAGE_AGE_CONFIRMED_PREFIX}${profileId}`;
        localStorage.setItem(key, 'confirmed');
      } catch {
        // Ignora erro de storage
      }
    }
  }

  /**
   * Revoga a confirmação de maioridade (logout, bloqueio ou troca de perfil).
   */
  public revokeAgeConfirmation(profileId = 'global'): void {
    this.memoryAgeConfirmed.delete(profileId);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `${STORAGE_AGE_CONFIRMED_PREFIX}${profileId}`;
        localStorage.removeItem(key);
      } catch {
        // Ignora erro
      }
    }
  }

  /**
   * Filtra uma lista de conteúdos removendo qualquer título adulto (Ocultar por padrão).
   */
  public filterOutAdult(items: ContentItem[]): ContentItem[] {
    if (!Array.isArray(items)) return [];
    return items.filter(it => !this.isAdultContent(it));
  }

  /**
   * Filtra uma lista mantendo apenas os títulos adultos válidos (Gênero Adulto).
   */
  public filterOnlyAdult(items: ContentItem[]): ContentItem[] {
    if (!Array.isArray(items)) return [];
    return items.filter(it => this.isAdultContent(it));
  }
}

export const adultContentService = AdultContentService.getInstance();
