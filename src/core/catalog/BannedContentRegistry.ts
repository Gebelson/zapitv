/**
 * ZapiTV - BannedContentRegistry
 * Registro centralizado de conteúdos proibidos/banidos (vídeos de demonstração, placeholders e testes).
 * Garante que obras como Big Buck Bunny e Caminandes nunca apareçam na interface,
 * buscas, índices, rotas, catálogos, caches ou fallbacks de reprodução.
 */

export const BANNED_PATTERNS = [
  // 1. Big Buck Bunny (todas as variações, versões e formatos)
  /\bbig[-_ ]?buck[-_ ]?bunny\b/i,
  /\bbuck[-_ ]?bunny\b/i,
  /^open-big-buck-bunny$/i,
  /^tt1285241$/i,

  // 2. Caminandes (todas as variações e temporadas)
  /\bcaminandes\b/i,
  /^open-caminandes/i,

  // 3. URLs e streams de demonstração conhecidos
  /x36xhzz\.m3u8/i,
  /big_buck_bunny/i
];

export class BannedContentRegistry {
  private static instance: BannedContentRegistry;

  private constructor() {}

  public static getInstance(): BannedContentRegistry {
    if (!BannedContentRegistry.instance) {
      BannedContentRegistry.instance = new BannedContentRegistry();
    }
    return BannedContentRegistry.instance;
  }

  /**
   * Verifica se um conteúdo (objeto ou parcial) pertence à lista de banidos
   */
  public isBanned(item?: { id?: string; title?: string; originalTitle?: string; imdbId?: string; videoUrl?: string } | null): boolean {
    if (!item) return false;

    if (item.id && this.isBannedKeyOrId(item.id)) return true;
    if (item.imdbId && this.isBannedKeyOrId(item.imdbId)) return true;
    if (item.title && this.isBannedTitle(item.title)) return true;
    if (item.originalTitle && this.isBannedTitle(item.originalTitle)) return true;
    if (item.videoUrl && this.isBannedUrl(item.videoUrl)) return true;

    return false;
  }

  /**
   * Verifica se uma chave ou ID está banido
   */
  public isBannedKeyOrId(keyOrId?: string | null): boolean {
    if (!keyOrId) return false;
    const clean = String(keyOrId).trim().toLowerCase();
    return BANNED_PATTERNS.some(pat => pat.test(clean));
  }

  /**
   * Verifica se um título está banido
   */
  public isBannedTitle(title?: string | null): boolean {
    if (!title) return false;
    const clean = String(title).trim().toLowerCase();
    return BANNED_PATTERNS.some(pat => pat.test(clean));
  }

  /**
   * Verifica se uma URL de stream ou arquivo está banida
   */
  public isBannedUrl(url?: string | null): boolean {
    if (!url) return false;
    const clean = String(url).trim().toLowerCase();
    return BANNED_PATTERNS.some(pat => pat.test(clean));
  }

  /**
   * Verifica se um stream do Stremio ou player é de demonstração banida
   */
  public isBannedStream(stream?: { url?: string; title?: string; name?: string } | null): boolean {
    if (!stream) return false;
    if (stream.url && this.isBannedUrl(stream.url)) return true;
    if (stream.title && this.isBannedTitle(stream.title)) return true;
    if (stream.name && this.isBannedTitle(stream.name)) return true;
    return false;
  }

  /**
   * Filtra uma lista de itens removendo qualquer conteúdo banido
   */
  public filterCleanItems<T extends { id?: string; title?: string; originalTitle?: string; imdbId?: string; videoUrl?: string }>(items: T[]): T[] {
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.filter(it => !this.isBanned(it));
  }

  /**
   * Purga itens banidos de todos os armazenamentos persistentes do navegador
   */
  public purgeStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const keysToCheck: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) keysToCheck.push(k);
      }

      for (const k of keysToCheck) {
        if (this.isBannedKeyOrId(k)) {
          localStorage.removeItem(k);
          continue;
        }

        const raw = localStorage.getItem(k);
        if (!raw) continue;

        if (/big[-_ ]?buck[-_ ]?bunny|caminandes|x36xhzz/i.test(raw)) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const clean = parsed.filter(it => {
                if (typeof it === 'string') return !this.isBannedKeyOrId(it) && !this.isBannedTitle(it);
                if (it && typeof it === 'object') return !this.isBanned(it);
                return true;
              });
              localStorage.setItem(k, JSON.stringify(clean));
            } else if (parsed && typeof parsed === 'object') {
              if (this.isBanned(parsed)) {
                localStorage.removeItem(k);
              }
            }
          } catch {
            if (this.isBannedTitle(raw) || this.isBannedKeyOrId(raw)) {
              localStorage.removeItem(k);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao purgar itens banidos do localStorage:', e);
    }
  }
}

export const bannedContentRegistry = BannedContentRegistry.getInstance();
