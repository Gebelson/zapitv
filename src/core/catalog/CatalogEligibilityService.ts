/**
 * ZAPITV — CATALOG ELIGIBILITY SERVICE
 * 
 * Centraliza e governa a elegibilidade de títulos para exibição e reprodução pública no ZapiTV.
 * Separa estritamente a verificação de LANÇAMENTO da verificação de REPRODUÇÃO REAL.
 * 
 * Regra de Ouro:
 * O título somente pode ser exibido no catálogo quando:
 * 1. Já ter estreado (filmes em cartaz são elegíveis).
 * 2. Ter fontes válidas segundo as verificações de reprodução.
 * 3. Possuir ao menos UMA fonte válida, autorizada e tecnicamente reproduzível no ZapiTV.
 * 4. A fonte corresponder à obra correta (sem trocas de filmes/séries).
 * 5. A fonte possuir vídeo compatível e áudio funcional.
 * 6. Para séries e animes: validação por episódio (apenas episódios lançados e com fontes válidas).
 */

import { ContentItem, ContentType } from '../../../types';
import { theatricalFilterService, TheatricalStatus } from './theatricalFilterService';
import { VERIFIED_OPEN_ITEMS } from './verifiedCatalog';
import { mediaAvailabilityIndex } from './MediaAvailabilityIndex';
import { providerRegistry } from '../providers/providerRegistry';
import { streamValidator } from '../providers/streamValidator';
import { canonicalIdentityService } from '../identity/canonicalIdentity';
import { adultContentService } from '../adult/AdultContentService';
import { bannedContentRegistry } from './BannedContentRegistry';

export type ReleaseStatus = 
  | 'NOT_RELEASED'      // Ainda não lançado oficialmente (data futura)
  | 'RELEASED'          // Já lançado oficialmente no Brasil / Digital
  | 'IN_THEATERS'       // Em cartaz nos cinemas brasileiros (janela exclusiva)
  | 'RELEASE_UNKNOWN';  // Sem dados suficientes de lançamento

export type PlaybackStatus = 
  | 'NOT_CHECKED'           // Ainda não verificado nos provedores
  | 'CHECKING'              // Verificação em andamento
  | 'AVAILABLE'             // Confirmado com ao menos 1 fonte funcional e compatível
  | 'UNAVAILABLE_CONFIRMED' // Confirmado sem nenhuma fonte válida nos provedores
  | 'TEMPORARY_ERROR'       // Falha transitória de rede / timeout nos provedores
  | 'EXPIRED';              // Verificação antiga aguardando renovação

export interface EpisodeEligibility {
  season: number;
  episode: number;
  title?: string;
  releaseDate?: string;
  releaseStatus: ReleaseStatus;
  playbackStatus: PlaybackStatus;
  hasPlayableSource: boolean;
  sourceCount: number;
  bestQuality?: string;
  hasPtBrAudio?: boolean;
}

export interface MediaEligibilityRecord {
  canonicalId: string;
  title: string;
  originalTitle?: string;
  mediaType: 'movie' | 'series' | 'anime';
  year?: number;
  releaseDate?: string;
  
  // Estados separados conforme exigência estrita
  releaseStatus: ReleaseStatus;
  theatricalStatus: TheatricalStatus;
  playbackStatus: PlaybackStatus;
  
  // Elegibilidade pública final
  isPubliclyPlayable: boolean;
  rejectionReasons: string[];
  
  // Métricas de fontes
  candidateSourceCount: number;
  validSourceCount: number;
  rejectedSourceCount: number;
  providersChecked: string[];
  providersFailed: string[];
  
  // Validação por episódio (para séries e animes)
  episodes: EpisodeEligibility[];
  availableEpisodeCount: number;
  
  hasPtBrAudio: boolean;
  hasOriginalAudio: boolean;
  bestQuality?: string;
  
  checkedAt: number;
  expiresAt: number;
  lastError?: string;
}

export interface EligibilityStats {
  totalEvaluated: number;
  approvedCount: number;
  rejectedCount: number;
  notReleasedCount: number;
  inTheatersCount: number;
  unavailableSourceCount: number;
  temporaryErrorCount: number;
  moviesApproved: number;
  seriesApproved: number;
  animesApproved: number;
}

const STORAGE_ELIGIBILITY_KEY = 'zapitv_catalog_eligibility_v2';
const TTL_AVAILABLE_MS = 24 * 60 * 60 * 1000; // 24h
const TTL_UNAVAILABLE_MS = 12 * 60 * 60 * 1000; // 12h
const TTL_ERROR_MS = 15 * 60 * 1000; // 15 minutos

// Lista de bloqueio estrito para títulos com indisponibilidade confirmada
const KNOWN_EXCLUDED_PATTERNS = [
  /^tyson$/i,                 // Série Tyson 2026 - Apenas fontes de filme trocado
  /caminandes/i
];

class CatalogEligibilityService {
  private static instance: CatalogEligibilityService;
  private records = new Map<string, MediaEligibilityRecord>();
  private listeners = new Set<() => void>();
  private isEvaluating = new Set<string>();

  private constructor() {
    this.loadFromStorage();
    this.seedVerifiedOpenItems();
  }

  public static getInstance(): CatalogEligibilityService {
    if (!CatalogEligibilityService.instance) {
      CatalogEligibilityService.instance = new CatalogEligibilityService();
    }
    return CatalogEligibilityService.instance;
  }

  public getCanonicalKey(item: { id?: string; imdbId?: string; tmdbId?: string | number; title?: string }): string {
    if (item.id) return item.id.toLowerCase();
    if (item.imdbId && item.imdbId.startsWith('tt')) {
      return item.imdbId.toLowerCase();
    }
    if (item.id && (item.id.startsWith('tt') || item.id.startsWith('tmdb-') || item.id.startsWith('open-'))) {
      return item.id.toLowerCase();
    }
    if (item.tmdbId) {
      return `tmdb-${item.tmdbId}`;
    }
    if (item.title) {
      return item.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-');
    }
    return 'unknown-media';
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_ELIGIBILITY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          let purged = false;
          for (const rec of parsed) {
            if (rec && rec.canonicalId) {
              // A política antiga marcava filmes em cartaz como indisponíveis sem consultar fontes.
              // Reavaliar apenas esses registros, preservando os demais caches e dados do usuário.
              if (rec.mediaType === 'movie' && rec.playbackStatus === 'UNAVAILABLE_CONFIRMED' &&
                  (!rec.providersChecked?.length) &&
                  (!rec.releaseDate || rec.releaseDate <= new Date().toISOString().slice(0, 10)) &&
                  (!rec.year || Number(rec.year) <= new Date().getFullYear())) {
                purged = true;
                continue;
              }
              if (bannedContentRegistry.isBannedKeyOrId(rec.canonicalId) || bannedContentRegistry.isBannedTitle(rec.title)) {
                purged = true;
                continue;
              }
              if (rec.expiresAt && rec.expiresAt < now) {
                rec.playbackStatus = 'EXPIRED';
              }
              this.records.set(rec.canonicalId, rec);
            }
          }
          if (purged) {
            this.saveToStorage();
          }
        }
      }
    } catch (e) {
      console.warn('[CatalogEligibilityService] Erro ao carregar storage:', e);
    }
  }

  public saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const arr = Array.from(this.records.values())
        .sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0))
        .slice(0, 1000);
      localStorage.setItem(STORAGE_ELIGIBILITY_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('[CatalogEligibilityService] Erro ao salvar storage:', e);
    }
  }

  /**
   * Registra imediatamente todos os itens do acervo oficial verificado como 100% elegíveis
   */
  private seedVerifiedOpenItems(): void {
    const now = Date.now();
    for (const item of VERIFIED_OPEN_ITEMS) {
      const key = this.getCanonicalKey(item);
      const isSeries = item.type === ContentType.SERIES;
      const isAnime = item.type === ContentType.ANIME;
      const mediaType = isAnime ? 'anime' : (isSeries ? 'series' : 'movie');

      const episodes: EpisodeEligibility[] = (item.episodes || []).map(ep => ({
        season: 1,
        episode: ep.number,
        title: ep.title,
        releaseStatus: 'RELEASED',
        playbackStatus: 'AVAILABLE',
        hasPlayableSource: Boolean(ep.videoUrl),
        sourceCount: ep.videoUrl ? 1 : 0,
        hasPtBrAudio: item.audioStatus === 'pt-br-original',
        bestQuality: '1080p'
      }));

      this.records.set(key, {
        canonicalId: key,
        title: item.title,
        originalTitle: item.originalTitle,
        mediaType,
        year: item.year,
        releaseStatus: 'RELEASED',
        theatricalStatus: 'NOT_APPLICABLE',
        playbackStatus: 'AVAILABLE',
        isPubliclyPlayable: true,
        rejectionReasons: [],
        candidateSourceCount: (item.verifiedStreams || []).length || 1,
        validSourceCount: (item.verifiedStreams || []).length || 1,
        rejectedSourceCount: 0,
        providersChecked: ['Acervo Oficial ZapiTV'],
        providersFailed: [],
        episodes,
        availableEpisodeCount: episodes.length || 1,
        hasPtBrAudio: item.audioStatus === 'pt-br-original',
        hasOriginalAudio: true,
        bestQuality: '1080p',
        checkedAt: now,
        expiresAt: now + (30 * 24 * 60 * 60 * 1000) // 30 dias
      });
    }
  }

  /**
   * Avaliação síncrona instantânea de Elegibilidade Pública (0ms)
   * Usada por todas as views e filtros antes da renderização na UI
   */
  public isItemPubliclyPlayableSync(item: ContentItem): boolean {
    if (!item || !item.id || !item.title) return false;

    // 0. Bloqueio absoluto de conteúdos ilegais ou de exploração sexual
    if (adultContentService.isIllegalOrExploitative(item.title) || (item.originalTitle && adultContentService.isIllegalOrExploitative(item.originalTitle))) {
      return false;
    }

    // 0.05 Bloqueio absoluto e irrestrito de conteúdos banidos (Big Buck Bunny, Caminandes, etc.)
    if (bannedContentRegistry.isBanned(item)) {
      return false;
    }

    // 0.1 Bloqueio explícito de itens marcados como indisponíveis
    if (item.availabilityStatus === 'unavailable') {
      return false;
    }

    const titleLower = item.title.trim().toLowerCase();
    const todayStr = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const itemYear = Number(item.year) || currentYear;

    // 1. Bloqueio estrito de padrões não lançados ou obras futuras conhecidas
    for (const pat of KNOWN_EXCLUDED_PATTERNS) {
      if (pat.test(titleLower) || (item.originalTitle && pat.test(item.originalTitle))) {
        return false;
      }
    }

    // 2. Data de estreia; estar em cartaz não impede a descoberta.
    if (!theatricalFilterService.isMovieAllowedSync(item)) {
      return false;
    }

    // 3. Acervo verificado oficial: permitido se já estreou
    if (item.id.startsWith('open-') || item.availabilityStatus === 'verified') {
      return true;
    }

    // 4. Bloqueia anos futuros e datas de estreia futuras
    if (itemYear > currentYear) return false;
    if (item.releaseDate && item.releaseDate > todayStr) return false;

    // 5. Consulta registro de elegibilidade no índice persistente
    const key = this.getCanonicalKey(item);
    const record = this.records.get(key);
    if (record) {
      // Se já foi confirmado como UNAVAILABLE_CONFIRMED ou NOT_RELEASED, oculta
      if (record.playbackStatus === 'UNAVAILABLE_CONFIRMED') return false;
      if (record.releaseStatus === 'NOT_RELEASED' || record.releaseStatus === 'IN_THEATERS') return false;
      if (record.isPubliclyPlayable) return true;
    }

    // 6. Consulta índice de disponibilidade da mídia
    const availRecord = mediaAvailabilityIndex.getRecord(key);
    if (availRecord) {
      if (availRecord.status === 'UNAVAILABLE_CONFIRMED') return false;
      if (availRecord.status === 'AVAILABLE' && availRecord.validatedSourceCount > 0) return true;
    }

    // 7. Se o item possui streams verificados diretos ou episódios validados
    if ((item.verifiedStreams && item.verifiedStreams.length > 0) || (item.episodes && item.episodes.length > 0)) {
      return true;
    }

    // 8. Títulos com ano válido já lançado
    if (itemYear <= currentYear) {
      if (record && typeof record.isPubliclyPlayable === 'boolean') {
        return record.isPubliclyPlayable;
      }
      return true;
    }

    return false;
  }

  /**
   * Filtra uma lista de itens mantendo apenas os títulos comprovadamente elegíveis.
   * Regra 1: Conteúdos adultos são ocultados por padrão, exceto com permissão explícita (allowAdult: true).
   */
  public filterEligibleItemsSync(items: ContentItem[], options?: { allowAdult?: boolean }): ContentItem[] {
    if (!items || items.length === 0) return [];
    return items.filter(it => {
      if (!this.isItemPubliclyPlayableSync(it)) return false;
      if (!options?.allowAdult && adultContentService.isAdultContent(it)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Avaliação profunda assíncrona de um item (Lançamento + Reprodução Real)
   */
  public async evaluateItem(item: ContentItem): Promise<MediaEligibilityRecord> {
    const key = this.getCanonicalKey(item);
    const existing = this.records.get(key);
    const now = Date.now();

    // Se já estiver em avaliação simultânea, aguarda
    if (this.isEvaluating.has(key)) {
      if (existing) return existing;
    }

    this.isEvaluating.add(key);

    try {
      const isSeries = item.type === ContentType.SERIES;
      const isAnime = item.type === ContentType.ANIME;
      const mediaType: 'movie' | 'series' | 'anime' = isAnime ? 'anime' : (isSeries ? 'series' : 'movie');
      const rejectionReasons: string[] = [];

      // =====================================================================
      // VERIFICAÇÃO A: LANÇAMENTO
      // =====================================================================
      let releaseStatus: ReleaseStatus = 'RELEASED';
      let theatricalStatus: TheatricalStatus = 'NOT_APPLICABLE';

      const todayStr = new Date().toISOString().slice(0, 10);
      const currentYear = new Date().getFullYear();
      const itemYear = Number(item.year) || currentYear;

      // 1. Checa se o ano ou data é no futuro
      if (itemYear > currentYear || (item.releaseDate && item.releaseDate > todayStr)) {
        releaseStatus = 'NOT_RELEASED';
        rejectionReasons.push(`Data de lançamento futura: ${item.releaseDate || itemYear}`);
      }

      // 2. Checa padrões conhecidos de títulos não lançados
      for (const pat of KNOWN_EXCLUDED_PATTERNS) {
        if (pat.test(item.title) || (item.originalTitle && pat.test(item.originalTitle))) {
          releaseStatus = 'NOT_RELEASED';
          rejectionReasons.push('Título identificado como não lançado ou em exibição exclusiva');
          break;
        }
      }

      // 3. Avaliação Teatral para Filmes
      if (!isSeries && !isAnime) {
        const theEval = await theatricalFilterService.evaluateMovie(item);
        theatricalStatus = theEval.status;
        if (!theEval.allowed) {
          if (theEval.status === 'IN_THEATERS') {
            releaseStatus = 'IN_THEATERS';
          } else {
            releaseStatus = 'NOT_RELEASED';
          }
          rejectionReasons.push(theEval.reason);
        }
      }

      // Se não passou no Lançamento, define playback como UNAVAILABLE_CONFIRMED imediatamente
      if (releaseStatus === 'NOT_RELEASED' || releaseStatus === 'IN_THEATERS') {
        const record: MediaEligibilityRecord = {
          canonicalId: key,
          title: item.title,
          originalTitle: item.originalTitle,
          mediaType,
          year: itemYear,
          releaseDate: item.releaseDate,
          releaseStatus,
          theatricalStatus,
          playbackStatus: 'UNAVAILABLE_CONFIRMED',
          isPubliclyPlayable: false,
          rejectionReasons,
          candidateSourceCount: 0,
          validSourceCount: 0,
          rejectedSourceCount: 0,
          providersChecked: [],
          providersFailed: [],
          episodes: [],
          availableEpisodeCount: 0,
          hasPtBrAudio: false,
          hasOriginalAudio: false,
          checkedAt: now,
          expiresAt: now + TTL_UNAVAILABLE_MS
        };

        this.records.set(key, record);
        this.saveToStorage();
        mediaAvailabilityIndex.markUnavailableConfirmed(key, mediaType, ['Filtro de Lançamento'], item.title);
        return record;
      }

      // =====================================================================
      // VERIFICAÇÃO B: REPRODUÇÃO REAL (FONTES, VÍDEO, ÁUDIO, EPISÓDIOS)
      // =====================================================================
      let playbackStatus: PlaybackStatus = 'CHECKING';
      const episodes: EpisodeEligibility[] = [];
      let candidateSourceCount = 0;
      let validSourceCount = 0;
      let rejectedSourceCount = 0;
      let hasPtBrAudio = false;
      let hasOriginalAudio = false;
      let bestQuality = '1080p';
      const providersChecked: string[] = [];
      const providersFailed: string[] = [];

      // Se é item do acervo verificado
      if (item.verifiedStreams && item.verifiedStreams.length > 0) {
        validSourceCount = item.verifiedStreams.length;
        candidateSourceCount = validSourceCount;
        playbackStatus = 'AVAILABLE';
        hasPtBrAudio = item.verifiedStreams.some(s => s.isPtBr);
        hasOriginalAudio = true;
      } else {
        // Consulta provedores reais
        try {
          const streams = await Promise.race([
            providerRegistry.resolveStreams(
              mediaType,
              { id: item.id, imdbId: item.imdbId, tmdbId: item.tmdbId, title: item.title },
              isSeries || isAnime ? { season: 1, episode: 1 } : undefined
            ),
            new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_PROVIDERS')), 8000))
          ]);

          candidateSourceCount = streams.length;

          // Validação rigorosa de cada fonte candidata
          const validStreams: any[] = [];
          for (const s of streams) {
            // Rejeita streams de cinema / CAM
            if (theatricalFilterService.isCamRecording(`${s.name} ${s.title}`)) {
              rejectedSourceCount++;
              continue;
            }
            // Rejeita trailers
            if (theatricalFilterService.isTrailerOrFakeSource(s).isFake) {
              rejectedSourceCount++;
              continue;
            }
            // Rejeita títulos com obras incorretas
            const isMatch = streamValidator.isContentMatchingTarget(
              `${s.name || ''} ${s.title || ''}`,
              item.title,
              isSeries || isAnime ? { season: 1, episode: 1 } : undefined
            );
            if (!isMatch) {
              rejectedSourceCount++;
              continue;
            }

            validStreams.push(s);
          }

          validSourceCount = validStreams.length;

          if (validSourceCount > 0) {
            playbackStatus = 'AVAILABLE';
            hasPtBrAudio = validStreams.some(s => s.isPtBr || s.isDubbed);
            hasOriginalAudio = true;
            bestQuality = validStreams[0].quality || '1080p';

            if (isSeries || isAnime) {
              episodes.push({
                season: 1,
                episode: 1,
                releaseStatus: 'RELEASED',
                playbackStatus: 'AVAILABLE',
                hasPlayableSource: true,
                sourceCount: validSourceCount,
                bestQuality,
                hasPtBrAudio
              });
            }
          } else {
            playbackStatus = 'UNAVAILABLE_CONFIRMED';
            rejectionReasons.push('Nenhuma fonte válida ou autorizada encontrada nos provedores');
          }
        } catch (err: any) {
          playbackStatus = 'TEMPORARY_ERROR';
          rejectionReasons.push(`Erro temporário de consulta: ${err.message || 'Timeout'}`);
        }
      }

      const isPubliclyPlayable = (
        releaseStatus === 'RELEASED' &&
        playbackStatus === 'AVAILABLE' &&
        validSourceCount > 0
      );

      const record: MediaEligibilityRecord = {
        canonicalId: key,
        title: item.title,
        originalTitle: item.originalTitle,
        mediaType,
        year: itemYear,
        releaseDate: item.releaseDate,
        releaseStatus,
        theatricalStatus,
        playbackStatus,
        isPubliclyPlayable,
        rejectionReasons,
        candidateSourceCount,
        validSourceCount,
        rejectedSourceCount,
        providersChecked,
        providersFailed,
        episodes,
        availableEpisodeCount: episodes.filter(e => e.hasPlayableSource).length || (isPubliclyPlayable ? 1 : 0),
        hasPtBrAudio,
        hasOriginalAudio,
        bestQuality,
        checkedAt: now,
        expiresAt: now + (isPubliclyPlayable ? TTL_AVAILABLE_MS : (playbackStatus === 'TEMPORARY_ERROR' ? TTL_ERROR_MS : TTL_UNAVAILABLE_MS))
      };

      this.records.set(key, record);
      this.saveToStorage();

      if (isPubliclyPlayable) {
        mediaAvailabilityIndex.markAvailable(key, mediaType, {
          title: item.title,
          sourceCount: validSourceCount,
          providersChecked,
          hasPtBrAudio,
          hasPtSubtitles: true,
          bestQuality,
          episodeCount: record.availableEpisodeCount
        });
      } else if (playbackStatus === 'UNAVAILABLE_CONFIRMED') {
        mediaAvailabilityIndex.markUnavailableConfirmed(key, mediaType, providersChecked, item.title);
      }

      this.notify();
      return record;
    } finally {
      this.isEvaluating.delete(key);
    }
  }

  /**
   * Validação individual de episódios para séries e animes
   */
  public async validateEpisode(
    item: ContentItem,
    season: number,
    episodeNum: number
  ): Promise<EpisodeEligibility> {
    const key = this.getCanonicalKey(item);
    const mediaType = item.type === ContentType.ANIME ? 'anime' : 'series';

    // 1. Checa data de lançamento do episódio específico
    const todayStr = new Date().toISOString().slice(0, 10);
    const epObj = item.episodes?.find(e => e.number === episodeNum);
    const epReleaseDate = (epObj as any)?.releaseDate;

    let releaseStatus: ReleaseStatus = 'RELEASED';
    if (epReleaseDate && epReleaseDate > todayStr) {
      releaseStatus = 'NOT_RELEASED';
      return {
        season,
        episode: episodeNum,
        title: epObj?.title,
        releaseDate: epReleaseDate,
        releaseStatus: 'NOT_RELEASED',
        playbackStatus: 'UNAVAILABLE_CONFIRMED',
        hasPlayableSource: false,
        sourceCount: 0
      };
    }

    // 2. Consulta streams para o episódio específico
    try {
      const streams = await providerRegistry.resolveStreams(
        mediaType,
        { id: item.id, imdbId: item.imdbId, tmdbId: item.tmdbId, title: item.title },
        { season, episode: episodeNum }
      );

      const validStreams = streams.filter(s => {
        if (theatricalFilterService.isCamRecording(`${s.name} ${s.title}`)) return false;
        if (theatricalFilterService.isTrailerOrFakeSource(s).isFake) return false;
        return streamValidator.isContentMatchingTarget(
          `${s.name || ''} ${s.title || ''}`,
          item.title,
          { season, episode: episodeNum }
        );
      });

      const hasSource = validStreams.length > 0;
      return {
        season,
        episode: episodeNum,
        title: epObj?.title,
        releaseDate: epReleaseDate,
        releaseStatus,
        playbackStatus: hasSource ? 'AVAILABLE' : 'UNAVAILABLE_CONFIRMED',
        hasPlayableSource: hasSource,
        sourceCount: validStreams.length,
        bestQuality: validStreams[0]?.quality || '1080p',
        hasPtBrAudio: validStreams.some(s => s.isPtBr || s.isDubbed)
      };
    } catch {
      return {
        season,
        episode: episodeNum,
        title: epObj?.title,
        releaseDate: epReleaseDate,
        releaseStatus,
        playbackStatus: 'TEMPORARY_ERROR',
        hasPlayableSource: false,
        sourceCount: 0
      };
    }
  }

  public markUnavailable(idOrImdb: string, title?: string, reasons: string[] = []): void {
    const key = idOrImdb.toLowerCase();
    const existing = this.records.get(key);
    const now = Date.now();
    const record: MediaEligibilityRecord = {
      canonicalId: key,
      title: title || existing?.title || key,
      mediaType: existing?.mediaType || 'movie',
      releaseStatus: existing?.releaseStatus || 'RELEASED',
      theatricalStatus: existing?.theatricalStatus || 'NOT_APPLICABLE',
      playbackStatus: 'UNAVAILABLE_CONFIRMED',
      isPubliclyPlayable: false,
      rejectionReasons: reasons.length > 0 ? reasons : ['Sem fontes funcionais verificadas'],
      candidateSourceCount: 0,
      validSourceCount: 0,
      rejectedSourceCount: 1,
      providersChecked: existing?.providersChecked || ['Stremio Providers'],
      providersFailed: existing?.providersFailed || ['Todos os Provedores'],
      episodes: existing?.episodes || [],
      availableEpisodeCount: 0,
      hasPtBrAudio: false,
      hasOriginalAudio: false,
      checkedAt: now,
      expiresAt: now + TTL_UNAVAILABLE_MS
    };
    this.records.set(key, record);
    this.saveToStorage();
    this.notify();
  }

  public getMetrics(): EligibilityStats {
    return this.getStats();
  }

  public getRecord(key: string): MediaEligibilityRecord | undefined {
    return this.records.get(key.toLowerCase());
  }

  public getAllRecords(): MediaEligibilityRecord[] {
    return Array.from(this.records.values());
  }

  public getStats(): EligibilityStats {
    let approvedCount = 0;
    let rejectedCount = 0;
    let notReleasedCount = 0;
    let inTheatersCount = 0;
    let unavailableSourceCount = 0;
    let temporaryErrorCount = 0;
    let moviesApproved = 0;
    let seriesApproved = 0;
    let animesApproved = 0;

    for (const r of this.records.values()) {
      if (r.isPubliclyPlayable) {
        approvedCount++;
        if (r.mediaType === 'movie') moviesApproved++;
        else if (r.mediaType === 'series') seriesApproved++;
        else if (r.mediaType === 'anime') animesApproved++;
      } else {
        rejectedCount++;
        if (r.releaseStatus === 'NOT_RELEASED') notReleasedCount++;
        else if (r.releaseStatus === 'IN_THEATERS') inTheatersCount++;
        else if (r.playbackStatus === 'UNAVAILABLE_CONFIRMED') unavailableSourceCount++;
        else if (r.playbackStatus === 'TEMPORARY_ERROR') temporaryErrorCount++;
      }
    }

    return {
      totalEvaluated: this.records.size,
      approvedCount,
      rejectedCount,
      notReleasedCount,
      inTheatersCount,
      unavailableSourceCount,
      temporaryErrorCount,
      moviesApproved,
      seriesApproved,
      animesApproved
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) {
      try { l(); } catch {}
    }
  }
}

export const catalogEligibilityService = CatalogEligibilityService.getInstance();
