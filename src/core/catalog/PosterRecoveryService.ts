import { ContentItem, ContentType } from '../../../types';
import { tmdbService, sameCatalogWork, TMDB_IMAGE_BASE } from '../tmdb/tmdbClient';
import { LruCache } from '../cache/LruCache';
import { tvPerformanceProfileService } from '../tv/tvPerformanceProfileService';
import { tvImagePreloaderService } from '../tv/tvImagePreloaderService';

const POSTER_CACHE_KEY_V3 = 'zapitv_poster_recovery_cache_v3';
const POSTER_CACHE_KEY_V2 = 'zapitv_poster_recovery_cache_v2';
export const NO_IMAGE_SENTINEL = '__NO_IMAGE__';

export const CORRUPTED_POSTER_FRAGMENTS = [
  'iigTJJskR1PcjjXqxdyJwVB3BoU', // Death Note poster associado indevidamente
  'z8IPicmEKXUO4I2UDdMEqw7RqOE', // Death Note backdrop associado indevidamente
  'bnTXjwOwdUz8MKFyQCNf0hG4fdL', // The Glory / A Lição poster associado indevidamente
  'AjwoDj77HLlqcpwEGqsnvMXm5my', // The Glory / A Lição backdrop associado indevidamente
  'dqZENchTd7lp5zht7BdlqM7RBPd', // Spider-Man poster associado indevidamente a Frieren
  '4HodYYKEIsGOdinkGi2Ucz6X9i0'  // Spider-Man backdrop associado indevidamente a Frieren
];

export function isCorruptedPosterUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return CORRUPTED_POSTER_FRAGMENTS.some(frag => url.includes(frag));
}

// TTLs de segurança para o cache de recuperação de capas
const NEGATIVE_TTL_MS = 3 * 60 * 1000; // 3 minutos para indisponibilidade temporária (nunca bloqueia para sempre)
const VERIFIED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias para URLs verificadas

export type RecoveryDiagnosticCause =
  | 'MISSING_URL'
  | 'HTTP_404_OR_403'
  | 'NETWORK_ERROR'
  | 'DECODE_FAILURE'
  | 'INVALID_CACHE'
  | 'NEGATIVE_SENTINEL_BLOCKED'
  | 'NO_MATCH_TMDB_ANILIST'
  | 'PRELOAD_TIMEOUT'
  | 'UNMOUNTED_BEFORE_COMPLETE';

export interface PosterCacheEntry {
  url: string;
  status: 'verified' | 'stored' | 'negative';
  timestamp: number;
  source?: string;
  failureCount?: number;
}

export interface RecoveryDiagnosticLog {
  id: string;
  title: string;
  originalUrl: string;
  optimizedUrl?: string;
  failedUrls?: string[];
  attempts: string[];
  recoveredSource: string | null;
  recoveredUrl: string | null;
  finalResult: 'SUCCESS' | 'FAILED';
  failureReason?: string;
  diagnosticCause?: RecoveryDiagnosticCause;
}

export function logRecoveryDiagnostic(diag: RecoveryDiagnosticLog): void {
  const isDev = (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') ||
                (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ||
                (typeof window !== 'undefined' && (window as any).__ZAPITV_DEV__);

  if (isDev) {
    if (diag.finalResult === 'SUCCESS') {
      console.info(
        `[PosterRecoveryService][DIAGNOSTIC] ✅ Capa recuperada com sucesso: "${diag.title}" (${diag.id}) | Fonte: ${diag.recoveredSource} | URL: ${diag.recoveredUrl}`
      );
    } else {
      console.warn(
        `[PosterRecoveryService][DIAGNOSTIC] ❌ Falha na recuperação de capa: "${diag.title}" (${diag.id}) | Causa: [${diag.diagnosticCause || 'UNKNOWN'}] ${diag.failureReason || 'Todas as fontes esgotadas'} | Tentativas: ${diag.attempts.join(', ')}`
      );
    }
  }
}

export class PosterRecoveryService {
  private static instance: PosterRecoveryService;
  private memoryCache = new LruCache<string, PosterCacheEntry>(500);
  private inFlight = new Map<string, Promise<string | null>>();
  private queue: Array<{
    item: ContentItem;
    forceRefresh?: boolean;
    resolve: (url: string | null) => void;
  }> = [];
  private activeWorkers = 0;
  private readonly MAX_CONCURRENT_RECOVERIES = 3;
  private listeners = new Set<(itemId: string, url: string) => void>();

  private constructor() {
    this.loadStorageCache();
  }

  public static getInstance(): PosterRecoveryService {
    if (!PosterRecoveryService.instance) {
      PosterRecoveryService.instance = new PosterRecoveryService();
    }
    return PosterRecoveryService.instance;
  }

  /**
   * Registra um listener para atualizações de capas no cache
   */
  public subscribe(callback: (itemId: string, url: string) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(itemId: string, url: string): void {
    this.listeners.forEach(cb => {
      try {
        cb(itemId, url);
      } catch (err) {
        console.error('[PosterRecoveryService] Erro no listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('zapitv_poster_recovered', { detail: { itemId, url } }));
      } catch {}
    }
  }

  private loadStorageCache(): void {
    if (typeof window === 'undefined') return;
    try {
      // 1. Limpa chaves obsoletas da v1
      try {
        window.sessionStorage.removeItem('zapitv_poster_recovery_cache_v1');
        window.localStorage.removeItem('zapitv_poster_recovery_cache_v1');
      } catch {}

      // 2. Lê versão v3 se disponível
      const storedV3 = window.localStorage.getItem(POSTER_CACHE_KEY_V3) || window.sessionStorage.getItem(POSTER_CACHE_KEY_V3);
      if (storedV3) {
        const parsed = JSON.parse(storedV3);
        if (typeof parsed === 'object' && parsed !== null) {
          const now = Date.now();
          Object.entries(parsed).forEach(([k, entry]: [string, any]) => {
            if (entry && typeof entry === 'object') {
              if (entry.status === 'negative') {
                if (now - (entry.timestamp || 0) < NEGATIVE_TTL_MS) {
                  this.memoryCache.set(k, entry);
                }
              } else if (typeof entry.url === 'string' && entry.url.startsWith('http')) {
                if (!entry.url.includes('undefined') && !entry.url.includes('broken_404') && !isCorruptedPosterUrl(entry.url)) {
                  if (!k.includes('13916') && !k.includes('136283')) {
                    this.memoryCache.set(k, {
                      url: entry.url,
                      status: entry.status || 'stored',
                      timestamp: entry.timestamp || now,
                      source: entry.source
                    });
                  }
                }
              }
            } else if (typeof entry === 'string' && entry.startsWith('http')) {
              if (!isCorruptedPosterUrl(entry) && !k.includes('13916') && !k.includes('136283')) {
                this.memoryCache.set(k, {
                  url: entry,
                  status: 'stored',
                  timestamp: now
                });
              }
            }
          });
        }
      }

      // 3. Migração segura da v2 para v3 (sem carregar marcadores negativos da v2 que bloqueavam capas)
      const storedV2 = window.localStorage.getItem(POSTER_CACHE_KEY_V2) || window.sessionStorage.getItem(POSTER_CACHE_KEY_V2);
      if (storedV2) {
        const parsedV2 = JSON.parse(storedV2);
        if (typeof parsedV2 === 'object' && parsedV2 !== null) {
          const now = Date.now();
          Object.entries(parsedV2).forEach(([k, v]) => {
            // NUNCA importar marcadores negativos da v2 (elimina o bloqueio que causava capas com fundo escuro e Play)
            if (v === NO_IMAGE_SENTINEL || v === '__NO_IMAGE__') return;
            if (typeof v === 'string' && v.startsWith('http')) {
              if (v.includes('undefined') || v.includes('broken_404') || isCorruptedPosterUrl(v) || k.includes('13916') || k.includes('136283') || (v.includes('metahub.space') && v.includes('tt31828574'))) return;
              if (!this.memoryCache.has(k)) {
                this.memoryCache.set(k, {
                  url: v,
                  status: 'stored',
                  timestamp: now
                });
              }
            }
          });
        }
        // Remove v2 antiga para evitar re-leitura
        try { window.localStorage.removeItem(POSTER_CACHE_KEY_V2); } catch {}
        try { window.sessionStorage.removeItem(POSTER_CACHE_KEY_V2); } catch {}
      }

      // 4. Executa saneamento ativo das imagens corrompidas conhecidas
      this.sanitizeKnownCorruptedImages();
    } catch {
      // Ignora erro em ambientes restritos
    }
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private saveStorageCache(): void {
    if (typeof window === 'undefined') return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const obj: Record<string, PosterCacheEntry> = {};
        this.memoryCache.forEach((entry, k) => {
          // Requisito 5: Sentinelas negativas nunca são salvas permanentemente no localStorage.
          // Ficam estritamente na memória da sessão com TTL curto de 3 minutos.
          if (entry.status !== 'negative') {
            obj[k] = entry;
          }
        });
        const serialized = JSON.stringify(obj);
        try { window.localStorage.setItem(POSTER_CACHE_KEY_V3, serialized); } catch {}
        try { window.sessionStorage.setItem(POSTER_CACHE_KEY_V3, serialized); } catch {}
      } catch {
        // Ignora erro de quota
      }
    }, 300);
  }

  /**
   * Saneia o cache em memória e storage descartando associações incorretas conhecidas
   */
  public sanitizeKnownCorruptedImages(): void {
    const keysToDelete: string[] = [];
    this.memoryCache.forEach((entry, key) => {
      if (
        isCorruptedPosterUrl(entry.url) ||
        key.includes('13916') ||
        key.includes('136283') ||
        (key.includes('frieren') && isCorruptedPosterUrl(entry.url))
      ) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(k => this.memoryCache.delete(k));
    if (keysToDelete.length > 0) {
      this.saveStorageCache();
    }
  }

  private getCacheKeys(item: ContentItem): string[] {
    const keys: string[] = [];
    if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
      keys.push(`imdb:${item.imdbId.trim().toLowerCase()}`);
    }
    if (item.tmdbId) {
      keys.push(`tmdb:${item.type || 'all'}:${item.tmdbId}`);
    }
    if (item.id) {
      keys.push(`id:${item.id.toLowerCase()}`);
    }
    if (item.aniListId) {
      keys.push(`anilist:${item.aniListId}`);
    }
    if (item.canonicalId) {
      keys.push(`canonical:${item.canonicalId.toLowerCase()}`);
    }
    const cleanTitle = (item.title || item.originalTitle || '').trim().toLowerCase();
    if (cleanTitle) {
      keys.push(`title:${item.type || 'all'}:${cleanTitle}:${item.year || 0}`);
    }
    return keys;
  }

  /**
   * Retorna a URL em cache se disponível e válida.
   * Não considera uma entrada negativa expirada.
   */
  public getCachedPoster(item: ContentItem): string | null {
    if (!item) return null;
    const keys = this.getCacheKeys(item);
    const now = Date.now();

    for (const key of keys) {
      const entry = this.memoryCache.get(key);
      if (entry) {
        if (entry.status === 'negative') {
          if (now - entry.timestamp > NEGATIVE_TTL_MS) {
            this.memoryCache.delete(key);
          } else {
            return null;
          }
        } else if (entry.url && entry.url.startsWith('http')) {
          if (isCorruptedPosterUrl(entry.url)) {
            this.memoryCache.delete(key);
            continue;
          }
          return entry.url;
        }
      }
    }
    return null;
  }

  /**
   * Retorna exclusivamente uma URL que foi testada e confirmada funcional
   */
  public getVerifiedPoster(item: ContentItem): string | null {
    if (!item) return null;
    const keys = this.getCacheKeys(item);
    for (const key of keys) {
      const entry = this.memoryCache.get(key);
      if (entry && entry.status === 'verified' && entry.url && entry.url.startsWith('http')) {
        if (isCorruptedPosterUrl(entry.url)) {
          this.memoryCache.delete(key);
          continue;
        }
        return entry.url;
      }
    }
    return null;
  }

  /**
   * Verifica se houve uma recuperação concluída com sucesso ou sentinela negativa válida recente.
   * Não bloqueia se a tentativa anterior expirou ou se continha apenas dado não verificado.
   */
  public hasAttemptedRecovery(item: ContentItem): boolean {
    if (!item) return false;
    const keys = this.getCacheKeys(item);
    const now = Date.now();
    for (const key of keys) {
      const entry = this.memoryCache.get(key);
      if (entry) {
        if (entry.status === 'negative') {
          if (now - entry.timestamp > NEGATIVE_TTL_MS) {
            this.memoryCache.delete(key);
            return false;
          }
          return true;
        }
        if (entry.status === 'verified') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Registra a falha de uma URL específica reportada pelo componente TvCard16x9.
   * Invalida a entrada no cache imediatamente para que uma nova fonte seja consultada.
   */
  public reportImageFailure(item: ContentItem, failedUrl: string): void {
    if (!item || !failedUrl) return;
    const keys = this.getCacheKeys(item);
    let mutated = false;
    const optFailed = tvPerformanceProfileService.getOptimizedPosterUrl(failedUrl);

    keys.forEach(k => {
      const entry = this.memoryCache.get(k);
      if (entry && (entry.url === failedUrl || entry.url === optFailed || tvPerformanceProfileService.getOptimizedPosterUrl(entry.url) === failedUrl)) {
        this.memoryCache.delete(k);
        mutated = true;
      }
    });

    if (mutated) {
      this.saveStorageCache();
    }
  }

  /**
   * Invalida explicitamente as entradas de um item no cache
   */
  public invalidateCachedPoster(item: ContentItem, failedUrl?: string): void {
    if (!item) return;
    const keys = this.getCacheKeys(item);
    keys.forEach(k => {
      if (failedUrl) {
        const entry = this.memoryCache.get(k);
        if (entry && (entry.url === failedUrl || tvPerformanceProfileService.getOptimizedPosterUrl(entry.url) === failedUrl)) {
          this.memoryCache.delete(k);
        }
      } else {
        this.memoryCache.delete(k);
      }
    });
    this.saveStorageCache();
  }

  /**
   * Salva o poster no cache identificando se é verificado ou apenas armazenado
   */
  public setCachedPoster(item: ContentItem, url: string, status: 'verified' | 'stored' = 'verified', source?: string): void {
    if (!item || !url) return;
    const keys = this.getCacheKeys(item);
    const entry: PosterCacheEntry = {
      url,
      status,
      timestamp: Date.now(),
      source
    };
    keys.forEach(k => this.memoryCache.set(k, entry));
    this.saveStorageCache();

    // Pré-carrega e decodifica imediatamente a imagem otimizada para Smart TV
    const opt = tvPerformanceProfileService.getOptimizedPosterUrl(url);
    if (opt) {
      tvImagePreloaderService.preload(opt, 1);
    }

    // Notifica componentes inscritos (cards ativos na tela)
    this.notify(item.id, url);
  }

  /**
   * Indica se a capa já está decodificada e pronta na memória GPU/RAM
   */
  public isPosterReady(item: ContentItem): boolean {
    const raw = this.getCachedPoster(item) || item?.image || item?.poster || item?.backdrop || '';
    if (!raw) return false;
    const opt = tvPerformanceProfileService.getOptimizedPosterUrl(raw);
    return tvImagePreloaderService.isReady(opt);
  }

  /**
   * Pré-carrega a capa da obra de forma coordenada
   */
  public preloadItemPoster(item: ContentItem, priority: 1 | 2 | 3 = 2): Promise<boolean> {
    const raw = this.getCachedPoster(item) || item?.image || item?.poster || item?.backdrop || '';
    if (!raw) return Promise.resolve(false);
    const opt = tvPerformanceProfileService.getOptimizedPosterUrl(raw);
    return tvImagePreloaderService.preload(opt, priority);
  }

  /**
   * Registra sentinela negativa temporária (TTL de 3 minutos em memória, sem persistência permanente)
   */
  public markNoImageAvailable(item: ContentItem): void {
    if (!item) return;
    const keys = this.getCacheKeys(item);
    const entry: PosterCacheEntry = {
      url: '',
      status: 'negative',
      timestamp: Date.now()
    };
    keys.forEach(k => this.memoryCache.set(k, entry));
    // Nunca persiste marcadores negativos no localStorage
  }

  /**
   * Valida se uma URL candidata carrega com sucesso
   */
  public async validateImageUrl(url: string, timeoutMs = 4500): Promise<boolean> {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;

    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs) });
        return res.ok;
      } catch {
        return false;
      }
    }

    const opt = tvPerformanceProfileService.getOptimizedPosterUrl(url);
    if (tvImagePreloaderService.isReady(opt) || tvImagePreloaderService.isReady(url)) {
      return true;
    }

    try {
      const preloadPromise = tvImagePreloaderService.preload(opt, 1);
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      });
      const ok = await Promise.race([preloadPromise, timeoutPromise]);
      if (ok) return true;

      // Se a versão otimizada falhar, testa a URL original (Requisito 5)
      if (opt !== url) {
        return await tvImagePreloaderService.preload(url, 1);
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Consulta a API oficial do AniList (GraphQL) por ID numérico
   */
  private async queryAniListById(id: number): Promise<string | null> {
    if (!id || id <= 0) return null;
    const query = `
      query ($id: Int) {
        Media (id: $id, type: ANIME) {
          coverImage { extraLarge large medium }
          bannerImage
        }
      }
    `;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { id } }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const media = data?.data?.Media;
      const cover = media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium;
      if (cover && typeof cover === 'string' && cover.startsWith('http')) {
        return cover;
      }
      if (media?.bannerImage && typeof media.bannerImage === 'string' && media.bannerImage.startsWith('http')) {
        return media.bannerImage;
      }
    } catch {
      // Ignora falha de rede do AniList
    }
    return null;
  }

  /**
   * Consulta a API oficial do AniList (GraphQL) por título para animes
   */
  private async queryAniList(title: string): Promise<string | null> {
    if (!title || title.trim().length < 2) return null;
    const cleanSearch = title.replace(/\s*\([^)]*\)/g, '').trim();
    const query = `
      query ($search: String) {
        Media (search: $search, type: ANIME) {
          coverImage { extraLarge large medium }
          bannerImage
        }
      }
    `;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { search: cleanSearch } }),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const media = data?.data?.Media;
      const cover = media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium;
      if (cover && typeof cover === 'string' && cover.startsWith('http')) {
        return cover;
      }
      if (media?.bannerImage && typeof media.bannerImage === 'string' && media.bannerImage.startsWith('http')) {
        return media.bannerImage;
      }
    } catch {
      // Ignora falha de rede do AniList
    }
    return null;
  }

  /**
   * Recupera a capa oficial correta de uma obra cujo pôster falhou ou está ausente.
   * Não associa imagens de outras obras: valida estritamente tipo de mídia e ano.
   * Utiliza fila com controle de concorrência limitada (máx 3 simultâneas) para não sobrecarregar Smart TVs.
   */
  public recoverPoster(item: ContentItem, options?: { forceRefresh?: boolean }): Promise<string | null> {
    if (!item) return Promise.resolve(null);

    // 1. Checa cache se não for forçado refresh e se já tiver tentativa verificada válida
    if (!options?.forceRefresh && this.hasAttemptedRecovery(item)) {
      const verified = this.getVerifiedPoster(item);
      if (verified) return Promise.resolve(verified);
      const cached = this.getCachedPoster(item);
      if (cached) return Promise.resolve(cached);
    }

    const primaryKey = item.imdbId || item.id || item.title;
    if (this.inFlight.has(primaryKey)) {
      return this.inFlight.get(primaryKey)!;
    }

    const task = new Promise<string | null>((resolve) => {
      this.queue.push({
        item,
        forceRefresh: options?.forceRefresh,
        resolve
      });
      this.processQueue();
    }).finally(() => {
      this.inFlight.delete(primaryKey);
    });

    this.inFlight.set(primaryKey, task);
    return task;
  }

  private processQueue(): void {
    if (this.activeWorkers >= this.MAX_CONCURRENT_RECOVERIES || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    this.activeWorkers++;
    this.executeRecovery(next.item)
      .then(url => next.resolve(url))
      .catch(() => next.resolve(null))
      .finally(() => {
        this.activeWorkers--;
        this.processQueue();
      });
  }

  /**
   * Executa a estratégia de recuperação em 7 etapas estritas conforme especificação:
   * 1. Pôster conhecido e previamente validado.
   * 2. URL original do conteúdo.
   * 3. Variação otimizada do pôster.
   * 4. Outra imagem existente nos metadados.
   * 5. Recuperação pelo TMDB utilizando identificadores confiáveis (ID, IMDb, Busca).
   * 6. Recuperação pelo AniList, especialmente para animes.
   * 7. Backdrop oficial como alternativa final.
   */
  private async executeRecovery(item: ContentItem): Promise<string | null> {
    const isMovie = item.type === ContentType.MOVIE || item.mediaFormat === 'movie';
    const isAnime = item.type === ContentType.ANIME || item.genres?.includes('Anime');

    const diag: RecoveryDiagnosticLog = {
      id: item.id,
      title: item.title,
      originalUrl: item.image || item.poster || '',
      attempts: [],
      recoveredSource: null,
      recoveredUrl: null,
      finalResult: 'FAILED'
    };

    try {
      // ETAPA 1: Pôster conhecido e previamente validado
      const verified = this.getVerifiedPoster(item);
      if (verified && !verified.includes('broken_404')) {
        diag.attempts.push(`cached_verified:${verified}`);
        if (await this.validateImageUrl(verified)) {
          diag.recoveredSource = 'cached_verified';
          diag.recoveredUrl = verified;
          diag.finalResult = 'SUCCESS';
          logRecoveryDiagnostic(diag);
          return verified;
        } else {
          diag.diagnosticCause = 'INVALID_CACHE';
        }
      }

      // ETAPA 2: URL original do conteúdo
      const rawPoster = item.image || item.poster;
      if (rawPoster && rawPoster.startsWith('http') && !rawPoster.includes('broken_404') && !isCorruptedPosterUrl(rawPoster)) {
        diag.attempts.push(`original_poster:${rawPoster}`);
        if (await this.validateImageUrl(rawPoster)) {
          this.setCachedPoster(item, rawPoster, 'verified', 'original_poster');
          diag.recoveredSource = 'original_poster';
          diag.recoveredUrl = rawPoster;
          diag.finalResult = 'SUCCESS';
          logRecoveryDiagnostic(diag);
          return rawPoster;
        }
      }

      // ETAPA 3: Variação otimizada do pôster
      if (rawPoster && rawPoster.startsWith('http') && !rawPoster.includes('broken_404') && !isCorruptedPosterUrl(rawPoster)) {
        const optPoster = tvPerformanceProfileService.getOptimizedPosterUrl(rawPoster);
        if (optPoster && optPoster !== rawPoster && !isCorruptedPosterUrl(optPoster)) {
          diag.attempts.push(`optimized_poster:${optPoster}`);
          if (await this.validateImageUrl(optPoster)) {
            this.setCachedPoster(item, optPoster, 'verified', 'optimized_poster');
            diag.recoveredSource = 'optimized_poster';
            diag.recoveredUrl = optPoster;
            diag.finalResult = 'SUCCESS';
            logRecoveryDiagnostic(diag);
            return optPoster;
          }
        }
      }

      // ETAPA 4: Outra imagem existente nos metadados
      const metaCandidates = [
        ...(Array.isArray(item.images) ? item.images : []),
        ...(Array.isArray(item.backdrops) ? item.backdrops : [])
      ].filter((u): u is string => Boolean(u && typeof u === 'string' && u.startsWith('http') && !u.includes('broken_404') && !isCorruptedPosterUrl(u)));

      for (const metaImg of metaCandidates) {
        diag.attempts.push(`metadata_candidate:${metaImg}`);
        if (await this.validateImageUrl(metaImg)) {
          this.setCachedPoster(item, metaImg, 'verified', 'metadata_candidate');
          diag.recoveredSource = 'metadata_candidate';
          diag.recoveredUrl = metaImg;
          diag.finalResult = 'SUCCESS';
          logRecoveryDiagnostic(diag);
          return metaImg;
        }
      }

      // ETAPA 5: Para animes, prioridade absoluta para a base canônica AniList
      if (isAnime) {
        let targetAniListId = item.aniListId;
        if (!targetAniListId && item.canonicalId && item.canonicalId.includes('anilist:')) {
          const match = item.canonicalId.match(/anilist:(\d+)/i);
          if (match) targetAniListId = parseInt(match[1], 10);
        }

        if (targetAniListId) {
          diag.attempts.push(`anilist_id:${targetAniListId}`);
          const anilistCover = await this.queryAniListById(targetAniListId);
          if (anilistCover && !isCorruptedPosterUrl(anilistCover) && await this.validateImageUrl(anilistCover)) {
            this.setCachedPoster(item, anilistCover, 'verified', 'anilist_id');
            diag.recoveredSource = 'anilist_id';
            diag.recoveredUrl = anilistCover;
            diag.finalResult = 'SUCCESS';
            logRecoveryDiagnostic(diag);
            return anilistCover;
          }
        }

        const animeTitle = item.originalTitle || item.title;
        diag.attempts.push(`anilist_title:${animeTitle}`);
        const anilistCoverByTitle = await this.queryAniList(animeTitle);
        if (anilistCoverByTitle && !isCorruptedPosterUrl(anilistCoverByTitle) && await this.validateImageUrl(anilistCoverByTitle)) {
          this.setCachedPoster(item, anilistCoverByTitle, 'verified', 'anilist_title');
          diag.recoveredSource = 'anilist_title';
          diag.recoveredUrl = anilistCoverByTitle;
          diag.finalResult = 'SUCCESS';
          logRecoveryDiagnostic(diag);
          return anilistCoverByTitle;
        }
      }

      // ETAPA 6: Recuperação pelo TMDB utilizando identificadores confiáveis
      // 6A. Se tiver TMDB ID numérico
      if (item.tmdbId && /^\d+$/.test(String(item.tmdbId).trim())) {
        diag.attempts.push(`tmdb_id:${item.tmdbId}`);
        try {
          const data = await tmdbService.getDetails(String(item.tmdbId), isMovie ? ContentType.MOVIE : ContentType.SERIES);
          const detailItem = data?.item;
          // Validação estrita: Rejeita TMDB se a obra retornada não for o mesmo conteúdo do catálogo
          if (detailItem && sameCatalogWork(detailItem, item)) {
            if (detailItem.image && detailItem.image.startsWith('http') && detailItem.image !== rawPoster && !isCorruptedPosterUrl(detailItem.image)) {
              if (await this.validateImageUrl(detailItem.image)) {
                this.setCachedPoster(item, detailItem.image, 'verified', 'tmdb_id_details');
                diag.recoveredSource = 'tmdb_id_details';
                diag.recoveredUrl = detailItem.image;
                diag.finalResult = 'SUCCESS';
                logRecoveryDiagnostic(diag);
                return detailItem.image;
              }
            }

            // Consulta endpoint de imagens do TMDB
            const images = await tmdbService.getImages(item.tmdbId, isMovie);
            for (const poster of images.posters) {
              if (poster && poster.startsWith('http') && poster !== rawPoster && !isCorruptedPosterUrl(poster) && await this.validateImageUrl(poster)) {
                this.setCachedPoster(item, poster, 'verified', 'tmdb_id_images');
                diag.recoveredSource = 'tmdb_id_images';
                diag.recoveredUrl = poster;
                diag.finalResult = 'SUCCESS';
                logRecoveryDiagnostic(diag);
                return poster;
              }
            }
          }
        } catch {
          // Continua
        }
      }

      // 6B. Se tiver IMDb ID (tt...)
      if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
        diag.attempts.push(`tmdb_imdb:${item.imdbId.trim()}`);
        try {
          const tmdbItem = await tmdbService.findByImdb(item.imdbId.trim());
          if (tmdbItem && sameCatalogWork(tmdbItem, item)) {
            if (tmdbItem.image && tmdbItem.image.startsWith('http') && tmdbItem.image !== rawPoster && !isCorruptedPosterUrl(tmdbItem.image)) {
              if (await this.validateImageUrl(tmdbItem.image)) {
                this.setCachedPoster(item, tmdbItem.image, 'verified', 'tmdb_imdb_find');
                diag.recoveredSource = 'tmdb_imdb_find';
                diag.recoveredUrl = tmdbItem.image;
                diag.finalResult = 'SUCCESS';
                logRecoveryDiagnostic(diag);
                return tmdbItem.image;
              }
            }
            if (tmdbItem.tmdbId) {
              const images = await tmdbService.getImages(tmdbItem.tmdbId, isMovie);
              for (const poster of images.posters) {
                if (poster && poster.startsWith('http') && poster !== rawPoster && !isCorruptedPosterUrl(poster) && await this.validateImageUrl(poster)) {
                  this.setCachedPoster(item, poster, 'verified', 'tmdb_imdb_images');
                  diag.recoveredSource = 'tmdb_imdb_images';
                  diag.recoveredUrl = poster;
                  diag.finalResult = 'SUCCESS';
                  logRecoveryDiagnostic(diag);
                  return poster;
                }
              }
            }
          }
        } catch {
          // Continua
        }
      }

      // 6C. Busca rigorosa por título no TMDB (com sameCatalogWork)
      const searchTitle = item.originalTitle || item.title;
      if (searchTitle && searchTitle.trim().length >= 2) {
        diag.attempts.push(`tmdb_search:${searchTitle.trim()}`);
        try {
          const candidates = await tmdbService.searchMulti(searchTitle.trim());
          const match = candidates.find(cand => sameCatalogWork(cand, item) && !isCorruptedPosterUrl(cand.image) && !isCorruptedPosterUrl(cand.backdrop) && ((cand.image && cand.image.startsWith('http')) || (cand.backdrop && cand.backdrop.startsWith('http'))));
          if (match) {
            const resolved = (match.image && match.image.startsWith('http') && match.image !== rawPoster) ? match.image : match.backdrop;
            if (resolved && !isCorruptedPosterUrl(resolved) && await this.validateImageUrl(resolved)) {
              this.setCachedPoster(item, resolved, 'verified', 'tmdb_search_match');
              diag.recoveredSource = 'tmdb_search_match';
              diag.recoveredUrl = resolved;
              diag.finalResult = 'SUCCESS';
              logRecoveryDiagnostic(diag);
              return resolved;
            }
          }
        } catch {
          // Continua
        }
      }

      // Cinemeta fallback seguro apenas se tiver IMDb
      if (item.imdbId && /^tt\d+$/i.test(item.imdbId.trim())) {
        diag.attempts.push(`cinemeta_imdb:${item.imdbId.trim()}`);
        const cinemetaType = isMovie ? 'movie' : 'series';
        try {
          const meta = await tmdbService.getCinemetaMeta(cinemetaType, item.imdbId.trim(), 4000);
          const candidatePoster = meta?.poster || meta?.background;
          if (candidatePoster && candidatePoster.startsWith('http') && !candidatePoster.includes('undefined')) {
            if (await this.validateImageUrl(candidatePoster)) {
              this.setCachedPoster(item, candidatePoster, 'verified', 'cinemeta');
              diag.recoveredSource = 'cinemeta';
              diag.recoveredUrl = candidatePoster;
              diag.finalResult = 'SUCCESS';
              logRecoveryDiagnostic(diag);
              return candidatePoster;
            }
          }
        } catch {
          // Ignora
        }
      }

      // ETAPA 7: Backdrop oficial como alternativa final
      const rawBackdrop = item.backdrop;
      if (rawBackdrop && rawBackdrop.startsWith('http') && !rawBackdrop.includes('broken_404')) {
        diag.attempts.push(`backdrop_fallback:${rawBackdrop}`);
        if (await this.validateImageUrl(rawBackdrop)) {
          this.setCachedPoster(item, rawBackdrop, 'verified', 'backdrop_fallback');
          diag.recoveredSource = 'backdrop_fallback';
          diag.recoveredUrl = rawBackdrop;
          diag.finalResult = 'SUCCESS';
          logRecoveryDiagnostic(diag);
          return rawBackdrop;
        }
      }
    } catch (err: any) {
      diag.failureReason = err?.message || String(err);
      diag.diagnosticCause = 'NETWORK_ERROR';
      console.warn(`[PosterRecoveryService] Erro na recuperação de imagem para ${item.title}:`, err);
    }

    diag.finalResult = 'FAILED';
    diag.failureReason = 'Todas as estratégias (TMDB, AniList, Cinemeta, Backdrop) esgotadas';
    diag.diagnosticCause = diag.diagnosticCause || 'NO_MATCH_TMDB_ANILIST';
    logRecoveryDiagnostic(diag);

    // Registra sentinela negativa temporária (TTL de 3 minutos em memória, sem bloquear para sempre)
    this.markNoImageAvailable(item);
    return null;
  }
}

export const posterRecoveryService = PosterRecoveryService.getInstance();
