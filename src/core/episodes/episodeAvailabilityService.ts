import { ContentItem, ContentType } from '../../../types';
import { providerRegistry } from '../providers/providerRegistry';
import { streamValidator } from '../providers/streamValidator';
import { tmdbService } from '../tmdb/tmdbClient';
import { VERIFIED_OPEN_ITEMS } from '../catalog/verifiedCatalog';

export interface EpisodeItem {
  id: string;
  number: number;
  season?: number;
  title: string;
  description: string;
  image: string;
  airDate?: string;
  releaseDate?: string;
  stillPath?: string;
  videoUrl?: string;
}

export interface EpisodeSourceCacheEntry {
  hasValidSource: boolean;
  isConfirmedUnavailable: boolean;
  isTemporaryError: boolean;
  sourceCount: number;
  lastChecked: number;
  expiresAt: number;
}

const STORAGE_CACHE_KEY = 'zapitv_episode_availability_v2';
const TTL_AVAILABLE_MS = 24 * 60 * 60 * 1000;    // 24 horas para episódios confirmados com fonte
const TTL_UNAVAILABLE_MS = 6 * 60 * 60 * 1000;   // 6 horas para episódios confirmados sem fonte
const TTL_RECENT_UNAVAILABLE_MS = 60 * 60 * 1000;// 1 hora para episódios recentes (estrearam nos últimos 7 dias)
const TTL_ERROR_MS = 15 * 60 * 1000;             // 15 minutos para erros temporários de conexão/timeout

export class EpisodeAvailabilityService {
  private static instance: EpisodeAvailabilityService;
  private cache = new Map<string, EpisodeSourceCacheEntry>();
  private inFlightVerifications = new Map<string, Promise<boolean>>();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): EpisodeAvailabilityService {
    if (!EpisodeAvailabilityService.instance) {
      EpisodeAvailabilityService.instance = new EpisodeAvailabilityService();
    }
    return EpisodeAvailabilityService.instance;
  }

  /**
   * Valida rigorosamente se o episódio já estreou oficialmente na data/horário oficial.
   * Oculta completamente episódios futuros ou sem data confirmada de lançamento.
   */
  public isEpisodeOfficiallyAired(airDate?: string | null, releaseDate?: string | null): boolean {
    const raw = airDate || releaseDate;
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      // Sem data de lançamento oficial = ainda não estreou / não confirmado
      return false;
    }

    const trimmed = raw.trim();
    const now = new Date();

    // Se possui timestamp completo ISO com horário (ex: 2026-10-15T20:00:00Z)
    if (trimmed.includes('T')) {
      const releaseTime = new Date(trimmed).getTime();
      if (!isNaN(releaseTime)) {
        return releaseTime <= now.getTime();
      }
    }

    // Se é formato de data apenas (YYYY-MM-DD)
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-indexed no JS
      const day = parseInt(match[3], 10);

      const todayYear = now.getFullYear();
      const todayMonth = now.getMonth();
      const todayDay = now.getDate();

      const epNumber = year * 10000 + (month + 1) * 100 + day;
      const todayNumber = todayYear * 10000 + (todayMonth + 1) * 100 + todayDay;

      // Se a data do episódio for estritamente superior a hoje, é futuro
      if (epNumber > todayNumber) {
        return false;
      }
      return true;
    }

    // Fallback para outros formatos de string de data
    const parsed = new Date(trimmed).getTime();
    if (isNaN(parsed)) return false;
    return parsed <= now.getTime();
  }

  /**
   * Filtra uma lista de episódios brutos preservando rigorosamente a numeração original,
   * removendo episódios que ainda não estrearam e placeholders fictícios.
   */
  public filterAiredEpisodes<T extends { number: number; airDate?: string; releaseDate?: string; title?: string }>(episodes: T[]): T[] {
    if (!Array.isArray(episodes) || episodes.length === 0) return [];

    return episodes.filter(ep => {
      // 1. Rejeita números de episódio inválidos ou fictícios
      if (!Number.isInteger(ep.number) || ep.number < 1) {
        return false;
      }

      // 2. Valida data oficial de estreia
      const isAired = this.isEpisodeOfficiallyAired(ep.airDate, ep.releaseDate);
      if (!isAired) {
        return false;
      }

      return true;
    });
  }

  /**
   * Gera a chave única de identificação canônica do episódio no cache
   */
  public getEpisodeCacheKey(seriesId: string, season: number, episode: number): string {
    const cleanId = String(seriesId).toLowerCase().trim();
    return `${cleanId}_s${season}_e${episode}`;
  }

  /**
   * Consulta rápida em memória/storage se o episódio tem fonte confirmada
   */
  public getCachedAvailability(seriesId: string, season: number, episode: number): {
    checked: boolean;
    hasSource: boolean;
    isTemporaryError: boolean;
  } {
    const key = this.getEpisodeCacheKey(seriesId, season, episode);
    const cached = this.cache.get(key);
    if (!cached || Date.now() > cached.expiresAt) {
      return { checked: false, hasSource: false, isTemporaryError: false };
    }
    return {
      checked: true,
      hasSource: cached.hasValidSource,
      isTemporaryError: cached.isTemporaryError
    };
  }

  /**
   * Registra manualmente que uma fonte foi encontrada para o episódio (ex: durante prefetch ou reprodução)
   */
  public recordEpisodeSourceFound(seriesId: string, season: number, episode: number, sourceCount = 1): void {
    const key = this.getEpisodeCacheKey(seriesId, season, episode);
    const now = Date.now();
    this.cache.set(key, {
      hasValidSource: true,
      isConfirmedUnavailable: false,
      isTemporaryError: false,
      sourceCount: Math.max(1, sourceCount),
      lastChecked: now,
      expiresAt: now + TTL_AVAILABLE_MS
    });
    this.saveToStorage();
  }

  /**
   * Registra que o episódio não possui fontes válidas ou sofreu erro temporário
   */
  public recordEpisodeSourceFailed(
    seriesId: string,
    season: number,
    episode: number,
    isTemporaryError = false,
    isRecentAirDate = false
  ): void {
    const key = this.getEpisodeCacheKey(seriesId, season, episode);
    const now = Date.now();
    const ttl = isTemporaryError
      ? TTL_ERROR_MS
      : (isRecentAirDate ? TTL_RECENT_UNAVAILABLE_MS : TTL_UNAVAILABLE_MS);

    this.cache.set(key, {
      hasValidSource: false,
      isConfirmedUnavailable: !isTemporaryError,
      isTemporaryError,
      sourceCount: 0,
      lastChecked: now,
      expiresAt: now + ttl
    });
    this.saveToStorage();
  }

  /**
   * Verifica se um episódio específico possui ao menos uma fonte válida de reprodução.
   * Utiliza deduplicação de requisições em voo (inFlightVerifications) e cache inteligente.
   */
  public async verifyEpisodeAvailability(
    item: ContentItem,
    season: number,
    episode: number,
    airDate?: string
  ): Promise<boolean> {
    const seriesId = item.id || item.imdbId || item.tmdbId || '';
    const key = this.getEpisodeCacheKey(seriesId, season, episode);

    // 1. Acervo verificado: verifica se existe stream oficial direto cadastrado
    const verifiedItem = VERIFIED_OPEN_ITEMS.find(it => it.id === item.id || (it.imdbId && it.imdbId === item.imdbId));
    if (verifiedItem?.episodes && verifiedItem.episodes.length > 0) {
      const hasVerifiedEp = verifiedItem.episodes.some((e: any) => 
        (e.season ?? 1) === season && e.number === episode && Boolean(e.videoUrl)
      );
      if (hasVerifiedEp) {
        this.recordEpisodeSourceFound(seriesId, season, episode, 1);
        return true;
      }
    }

    // 2. Consulta de cache vigente
    const cached = this.cache.get(key);
    const now = Date.now();
    if (cached && now < cached.expiresAt) {
      if (cached.hasValidSource) return true;
      if (cached.isConfirmedUnavailable) return false;
      // Se for erro temporário, podemos tentar novamente se não houver verificação em voo
    }

    // 3. Reutiliza promessa em andamento para o mesmo episódio
    if (this.inFlightVerifications.has(key)) {
      return this.inFlightVerifications.get(key)!;
    }

    const verificationPromise = (async () => {
      try {
        const mediaType = item.type === ContentType.ANIME ? 'anime' : 'series';
        let targetImdbId = item.imdbId;
        if (!targetImdbId && (item.tmdbId || item.id)) {
          const candidateTmdb = String(item.tmdbId || item.id).replace(/^tmdb-?/i, '');
          if (/^\d+$/.test(candidateTmdb)) {
            try {
              const res = await Promise.race([
                tmdbService.getImdbId(candidateTmdb, mediaType),
                new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000))
              ]);
              if (res) targetImdbId = res;
            } catch {}
          }
        }

        // Timeout seguro (12000ms) para acomodar consulta real de múltiplos provedores de streaming
        const streams = await Promise.race([
          providerRegistry.resolveStreams(
            mediaType,
            { id: item.id, imdbId: targetImdbId, tmdbId: item.tmdbId, title: item.title, originalTitle: item.originalTitle },
            { season, episode }
          ),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_EP_CHECK')), 12000))
        ]);

        const cleanStreams = streamValidator.filterCleanStreams(streams, item.title, item.originalTitle);
        const hasValidSource = cleanStreams.length > 0;

        const isRecent = this.isAiredRecently(airDate);
        if (hasValidSource) {
          this.recordEpisodeSourceFound(seriesId, season, episode, cleanStreams.length);
          return true;
        } else {
          // Marca como erro transitório (isTemporaryError = true) para não banir o episódio da lista no modal
          // caso os provedores externos sofram lentidão ou timeout na primeira busca
          this.recordEpisodeSourceFailed(seriesId, season, episode, true, isRecent);
          return false;
        }
      } catch (err: any) {
        // Se for falha de rede/timeout, registra como erro transitório (NÃO exclui permanentemente)
        this.recordEpisodeSourceFailed(seriesId, season, episode, true, false);
        // Se já tínhamos confirmação anterior de fonte, mantém temporariamente
        return cached?.hasValidSource || false;
      } finally {
        this.inFlightVerifications.delete(key);
      }
    })();

    this.inFlightVerifications.set(key, verificationPromise);
    return verificationPromise;
  }

  /**
   * Filtra temporadas oficiais disponíveis:
   * Oculta temporadas futuras, temporadas com 0 episódios ou que ainda não estrearam.
   */
  public getAvailableSeasons(
    rawSeasons?: Array<{ season_number: number; air_date?: string; episode_count?: number }>,
    fallbackCount = 1
  ): number[] {
    if (Array.isArray(rawSeasons) && rawSeasons.length > 0) {
      const now = new Date();
      const todayNumber = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

      const validSeasons = rawSeasons.filter(s => {
        // Ignora especiais (Temporada 0) por padrão
        if (s.season_number <= 0) return false;
        // Ignora temporadas sem nenhum episódio informado
        if (typeof s.episode_count === 'number' && s.episode_count <= 0) return false;

        // Se tem data de lançamento, valida se não é futura
        if (s.air_date) {
          const match = s.air_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            const y = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const d = parseInt(match[3], 10);
            const sDateNum = y * 10000 + m * 100 + d;
            if (sDateNum > todayNumber) return false;
          }
        }
        return true;
      }).map(s => s.season_number).sort((a, b) => a - b);

      if (validSeasons.length > 0) {
        return Array.from(new Set(validSeasons));
      }
    }

    const count = Math.max(1, fallbackCount);
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  /**
   * Determina o próximo episódio disponível e lançado para navegação e autoplay contínuo.
   * Respeita a ordem original dos episódios e ignora episódios indisponíveis ou futuros.
   */
  public getNextAvailableEpisode(
    currentSeason: number,
    currentEpisode: number,
    currentSeasonEpisodes: EpisodeItem[],
    availableSeasons: number[],
    nextSeasonEpisodes?: EpisodeItem[]
  ): { season: number; episode: number; title: string } | null {
    if (!currentSeasonEpisodes || currentSeasonEpisodes.length === 0) return null;

    // 1. Procura o próximo episódio dentro da temporada atual
    const sortedCurrent = [...currentSeasonEpisodes].sort((a, b) => a.number - b.number);
    const currentIndex = sortedCurrent.findIndex(e => e.number === currentEpisode);

    if (currentIndex !== -1 && currentIndex + 1 < sortedCurrent.length) {
      const nextEp = sortedCurrent[currentIndex + 1];
      return {
        season: currentSeason,
        episode: nextEp.number,
        title: nextEp.title
      };
    } else if (currentIndex === -1) {
      // Se o episódio atual não estiver na lista (ex: estava indisponível), procura o primeiro com número maior
      const nextEp = sortedCurrent.find(e => e.number > currentEpisode);
      if (nextEp) {
        return {
          season: currentSeason,
          episode: nextEp.number,
          title: nextEp.title
        };
      }
    }

    // 2. Se a temporada atual terminou, procura a próxima temporada válida
    const sortedSeasons = [...availableSeasons].sort((a, b) => a - b);
    const nextSeason = sortedSeasons.find(s => s > currentSeason);

    if (nextSeason !== undefined) {
      // Se os episódios da próxima temporada foram fornecidos
      if (nextSeasonEpisodes && nextSeasonEpisodes.length > 0) {
        const sortedNext = [...nextSeasonEpisodes].sort((a, b) => a.number - b.number);
        const firstEp = sortedNext[0];
        return {
          season: nextSeason,
          episode: firstEp.number,
          title: firstEp.title
        };
      }

      // Se a próxima temporada é conhecida como disponível, aponta para o primeiro episódio
      return {
        season: nextSeason,
        episode: 1,
        title: `Temporada ${nextSeason} • Episódio 1`
      };
    }

    // Fim da série alcançado
    return null;
  }

  /**
   * Helper para verificar se a estreia ocorreu nos últimos 7 dias
   */
  private isAiredRecently(airDate?: string): boolean {
    if (!airDate) return false;
    const parsed = new Date(airDate).getTime();
    if (isNaN(parsed)) return false;
    const diffDays = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }

  public purgeNegativeCache(): void {
    for (const [k, entry] of this.cache.entries()) {
      if (!entry.hasValidSource) {
        this.cache.delete(k);
      }
    }
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed)) {
        const entry = v as EpisodeSourceCacheEntry;
        if (entry && entry.expiresAt > now) {
          // Purga automaticamente caches negativos de obras que sofreram regressão
          if (!entry.hasValidSource) {
            const lowerK = k.toLowerCase();
            if (
              lowerK.includes('63247') ||
              lowerK.includes('westworld') ||
              lowerK.includes('tt0475784') ||
              lowerK.includes('258165') ||
              lowerK.includes('eden') ||
              lowerK.includes('éden') ||
              lowerK.includes('tt21097264') ||
              lowerK.includes('tt22020214')
            ) {
              continue;
            }
          }
          this.cache.set(k, entry);
        }
      }
    } catch {
      // Fallback silencioso caso storage esteja corrompido ou inacessível
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const obj: Record<string, EpisodeSourceCacheEntry> = {};
      const now = Date.now();
      // Salva apenas registros válidos não expirados (máx 500 para proteger cota)
      let count = 0;
      for (const [k, v] of this.cache.entries()) {
        if (v.expiresAt > now && count < 500) {
          obj[k] = v;
          count++;
        }
      }
      localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(obj));
    } catch {}
  }

  /**
   * Invalida o cache de disponibilidade de um episódio ou temporada específica.
   */
  public invalidateEpisode(seriesId: string, season?: number, episode?: number): void {
    if (season !== undefined && episode !== undefined) {
      const key = this.getEpisodeCacheKey(seriesId, season, episode);
      this.cache.delete(key);
      this.inFlightVerifications.delete(key);
    } else {
      const prefix = `${seriesId.toLowerCase()}_`;
      for (const k of Array.from(this.cache.keys())) {
        if (k.startsWith(prefix)) {
          this.cache.delete(k);
          this.inFlightVerifications.delete(k);
        }
      }
    }
    this.saveToStorage();
  }

  /**
   * Limpa integralmente o cache de episódios.
   */
  public clearCache(): void {
    this.cache.clear();
    this.inFlightVerifications.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try { localStorage.removeItem(STORAGE_CACHE_KEY); } catch {}
    }
  }
}

export const episodeAvailabilityService = EpisodeAvailabilityService.getInstance();
