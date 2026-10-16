import { ContentItem, ContentType } from '../../../types';
import { TMDB_API_KEY, TMDB_BASE_URL } from '../tmdb/tmdbClient';

export type TheatricalStatus = 
  | 'UPCOMING'                  // Ainda não lançado comercialmente no Brasil ou mundialmente
  | 'IN_THEATERS'                // Em cartaz nos cinemas brasileiros (janela exclusiva ativa)
  | 'THEATRICAL_STATUS_UNKNOWN'  // Sem dados suficientes para confirmação segura (submetido a trava de segurança)
  | 'POST_THEATRICAL'            // Período de exibição nos cinemas encerrado
  | 'DIGITAL_RELEASED'           // Lançamento digital oficial confirmado (VOD / Streaming / Mídia física)
  | 'NOT_APPLICABLE';            // Séries de TV, animes seriais, clássicos de domínio público

export interface TheatricalEvaluation {
  id: string;
  tmdbId?: string;
  region: string; // 'BR'
  title: string;
  status: TheatricalStatus;
  allowed: boolean;
  reason: string;
  evidence: string[];
  theatricalDate?: string;
  digitalDate?: string;
  evaluatedAt: number;
  expiresAt: number;
}

// A versão anterior persistia bloqueios por estar em cartaz.
const STORAGE_KEY = 'zapitv_theatrical_evaluations_v3';

class TheatricalFilterService {
  private cache = new Map<string, TheatricalEvaluation>();
  private nowPlayingIds = new Set<string>();
  private nowPlayingTitles = new Set<string>();
  private upcomingIds = new Set<string>();
  private upcomingTitles = new Set<string>();
  private theatricalListsLoaded = false;
  private theatricalFetchPromise: Promise<void> | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // Limpa cache legado anterior para evitar retenção de itens bloqueados
      try {
        localStorage.removeItem('zapitv_theatrical_evaluations');
      } catch {}

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, TheatricalEvaluation> = JSON.parse(raw);
        const now = Date.now();
        for (const [k, v] of Object.entries(parsed)) {
          if (now < v.expiresAt) {
            this.cache.set(k, v);
          }
        }
      }
    } catch {
      // Ignora erro de storage
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const obj: Record<string, TheatricalEvaluation> = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignora erro de cota
    }
  }

  /**
   * Identifica se uma fonte ou título é gravação de sala de cinema (CAM / Telesync / HDCAM / Telecine)
   */
  public isCamRecording(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();

    // 1. Termos inequívocos de gravação de sala
    if (/\b(camrip|cam-rip|telesync|hdcam|hd-ts|hdts|telecine|dvdscr|screener)\b/i.test(lower)) {
      return true;
    }

    // 2. Termos em português / descrições de cinema
    if (/grava[çc][ãa]o de cinema|cinema rip|audio de cinema|sala de cinema/i.test(lower)) {
      return true;
    }

    // 3. Palavra isolada "CAM" acompanhada de especificações de vídeo/áudio
    if (/\bcam\b/i.test(lower) && /\b(x264|x265|720p|1080p|rip|vbr|v2|cinema|sala|audio|line)\b/i.test(lower)) {
      return true;
    }

    // 4. TS (Telesync) somente quando acompanhado de release tags, ignorando extensões de URL .ts
    if (/\bts\b/i.test(lower) && !/\.ts(\?|\/|$)/i.test(lower) && /\b(x264|x265|rip|line|clean|hq|hd)\b/i.test(lower)) {
      return true;
    }

    return false;
  }

  /**
   * Identifica se uma fonte retornada por um add-on é na verdade um trailer, teaser ou material promocional
   */
  public isTrailerOrFakeSource(stream: { title?: string; name?: string; duration?: number; url?: string }): { isFake: boolean; reason?: string } {
    if (!stream) return { isFake: false };
    const combined = `${stream.name || ''} ${stream.title || ''} ${stream.url || ''}`.toLowerCase();

    if (/\b(trailer|official trailer|teaser|preview clip|promo video|behind the scenes|making of)\b/i.test(combined)) {
      return { isFake: true, reason: 'Fonte identificada como trailer/teaser promocional e não como filme completo' };
    }

    // Vídeos de longa-metragem nunca possuem duração inferior a 5 minutos (300 segundos)
    if (typeof stream.duration === 'number' && stream.duration > 0 && stream.duration < 300) {
      return { isFake: true, reason: `Duração da mídia (${stream.duration}s) é característica de trailer/amostra e não de filme completo` };
    }

    return { isFake: false };
  }

  /**
   * Carrega os filmes atualmente em cartaz e próximos lançamentos nos cinemas brasileiros direto do TMDB
   */
  public async loadNowPlayingInBrazil(): Promise<void> {
    if (this.theatricalListsLoaded) return;
    if (this.theatricalFetchPromise) return this.theatricalFetchPromise;

    this.theatricalFetchPromise = (async () => {
      try {
        const [npRes, upRes] = await Promise.allSettled([
          fetch(`${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&region=BR&language=pt-BR&page=1`),
          fetch(`${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&region=BR&language=pt-BR&page=1`)
        ]);

        if (npRes.status === 'fulfilled' && npRes.value.ok) {
          const data = await npRes.value.json();
          const results = data.results || [];
          for (const item of results) {
            if (item.id) this.nowPlayingIds.add(String(item.id));
            if (item.title) this.nowPlayingTitles.add(this.normalizeTitle(item.title));
            if (item.original_title) this.nowPlayingTitles.add(this.normalizeTitle(item.original_title));
          }
        }

        if (upRes.status === 'fulfilled' && upRes.value.ok) {
          const data = await upRes.value.json();
          const results = data.results || [];
          for (const item of results) {
            if (item.id) this.upcomingIds.add(String(item.id));
            if (item.title) this.upcomingTitles.add(this.normalizeTitle(item.title));
            if (item.original_title) this.upcomingTitles.add(this.normalizeTitle(item.original_title));
          }
        }

        this.theatricalListsLoaded = true;
      } catch (err) {
        console.warn('[TheatricalFilter] Falha ao carregar listas teatrais BR:', err);
      } finally {
        this.theatricalFetchPromise = null;
      }
    })();

    return this.theatricalFetchPromise;
  }

  private normalizeTitle(t: string): string {
    return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  /**
   * Verifica se o item pertence a obras notoriamente não lançadas ou em cartaz
   */
  public isKnownUnreleasedOrTheatrical(item: ContentItem): boolean {
    if (!item) return false;
    // Listas fixas de títulos envelhecem: um filme pode estrear sem atualização do app.
    // Só a data futura do próprio item é uma restrição síncrona confiável.
    const todayStr = new Date().toISOString().slice(0, 10);
    return Boolean(
      (item.releaseDate && item.releaseDate > todayStr) ||
      (Number(item.year) > new Date().getFullYear())
    );
  }

  /**
   * Verifica se o item está em exibição confirmada nos cinemas
   */
  public isKnownInTheaters(item: ContentItem): boolean {
    if (!item) return false;
    if (item.inTheaters === true) return true;
    if (item.tmdbId && this.nowPlayingIds.has(String(item.tmdbId))) return true;
    const rawTmdbId = item.id?.startsWith('tmdb-') ? item.id.replace('tmdb-', '') : null;
    if (rawTmdbId && this.nowPlayingIds.has(rawTmdbId)) return true;

    const normTitle = this.normalizeTitle(item.title);
    if (this.nowPlayingTitles.has(normTitle)) return true;

    if (item.originalTitle) {
      const normOrig = this.normalizeTitle(item.originalTitle);
      if (this.nowPlayingTitles.has(normOrig)) return true;
    }

    return false;
  }

  /**
   * Verifica se o item está na lista de próximos lançamentos nos cinemas
   */
  public isKnownUpcoming(item: ContentItem): boolean {
    if (!item) return false;
    if (item.tmdbId && this.upcomingIds.has(String(item.tmdbId))) return true;
    const rawTmdbId = item.id?.startsWith('tmdb-') ? item.id.replace('tmdb-', '') : null;
    if (rawTmdbId && this.upcomingIds.has(rawTmdbId)) return true;

    const normTitle = this.normalizeTitle(item.title);
    if (this.upcomingTitles.has(normTitle)) return true;

    if (item.originalTitle) {
      const normOrig = this.normalizeTitle(item.originalTitle);
      if (this.upcomingTitles.has(normOrig)) return true;
    }

    return false;
  }

  /**
   * Avalia de forma assíncrona se um filme pode ou não ser exibido no catálogo público
   */
  public async evaluateMovie(item: ContentItem): Promise<TheatricalEvaluation> {
    if (!item) {
      return {
        id: 'invalid',
        region: 'BR',
        title: 'Desconhecido',
        status: 'UPCOMING',
        allowed: false,
        reason: 'Item inválido ou nulo',
        evidence: ['invalid_item'],
        evaluatedAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      };
    }

    // 1. Séries, programas de TV e animações seriadas não possuem janela de cinema
    if (item.type === ContentType.SERIES) {
      return {
        id: item.id,
        tmdbId: item.tmdbId,
        region: 'BR',
        title: item.title,
        status: 'NOT_APPLICABLE',
        allowed: true,
        reason: 'Série de TV / Episódios — Não possui janela cinematográfica exclusiva',
        evidence: ['content_type_series'],
        evaluatedAt: Date.now(),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 dias
      };
    }

    const cacheKey = item.tmdbId ? `tmdb-${item.tmdbId}` : (item.imdbId || item.id);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && now < cached.expiresAt) {
      if (cached.status === 'IN_THEATERS' || cached.status === 'THEATRICAL_STATUS_UNKNOWN') {
        return { ...cached, allowed: true };
      }
      return cached;
    }

    const currentYear = new Date().getFullYear();
    const todayStr = new Date().toISOString().slice(0, 10);
    const itemYear = Number(item.year) || currentYear;

    // Carrega a lista atual de sessões e lançamentos dos cinemas brasileiros em paralelo
    await this.loadNowPlayingInBrazil();

    // 2. Trava direta por data de lançamento futura (ex: 2026-12-16 > 2026-10-13)
    if (item.releaseDate && item.releaseDate > todayStr) {
      const evaluation: TheatricalEvaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: 'BR',
        title: item.title,
        status: 'UPCOMING',
        allowed: false,
        reason: `Filme ainda não lançado comercialmente (Previsão de estreia: ${item.releaseDate})`,
        evidence: ['future_release_date', `date_${item.releaseDate}`],
        theatricalDate: item.releaseDate,
        evaluatedAt: now,
        expiresAt: now + (12 * 60 * 60 * 1000)
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }

    // 3. Obras cuja data de estreia ainda está no futuro
    if (this.isKnownUnreleasedOrTheatrical(item)) {
      const evaluation: TheatricalEvaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: 'BR',
        title: item.title,
        status: 'UPCOMING',
        allowed: false,
        reason: 'Título confirmado em produção/aguardando lançamento cinematográfico futuro oficial',
        evidence: ['known_unreleased_blockbuster'],
        evaluatedAt: now,
        expiresAt: now + (24 * 60 * 60 * 1000)
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }

    // 4. A presença na lista de em cartaz informa o status, sem impedir o catálogo.
    if (this.isKnownInTheaters(item)) {
      const evaluation: TheatricalEvaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: 'BR',
        title: item.title,
        status: 'IN_THEATERS',
        allowed: true,
        reason: 'Em exibição nos cinemas brasileiros; fontes ainda precisam ser validadas',
        evidence: ['now_playing_brazil_active', 'commercial_theatrical_run'],
        evaluatedAt: now,
        expiresAt: now + (12 * 60 * 60 * 1000)
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }

    if (this.isKnownUpcoming(item)) {
      const evaluation: TheatricalEvaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: 'BR',
        title: item.title,
        status: 'UPCOMING',
        allowed: false,
        reason: 'Presente no calendário oficial de próximas estreias nos cinemas brasileiros',
        evidence: ['upcoming_brazil_active'],
        evaluatedAt: now,
        expiresAt: now + (12 * 60 * 60 * 1000)
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }

    // 5. Filmes com ano futuro: Imediatamente bloqueados como UPCOMING
    if (itemYear > currentYear) {
      const evaluation: TheatricalEvaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: 'BR',
        title: item.title,
        status: 'UPCOMING',
        allowed: false,
        reason: `Filme ainda não lançado comercialmente (Previsão de estreia: ${itemYear})`,
        evidence: ['future_year_release'],
        evaluatedAt: now,
        expiresAt: now + (12 * 60 * 60 * 1000)
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }

    // 6. Filmes de catálogo antigo (> 1 ano de lançamento e fora de now_playing): Liberados
    if (itemYear < currentYear - 1) {
      const evaluation: TheatricalEvaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: 'BR',
        title: item.title,
        status: 'POST_THEATRICAL',
        allowed: true,
        reason: `Catálogo de ano anterior (${itemYear}) — Fora de qualquer janela cinematográfica`,
        evidence: ['back_catalog_movie', 'not_in_theaters'],
        evaluatedAt: now,
        expiresAt: now + (30 * 24 * 60 * 60 * 1000) // 30 dias
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }

    // 7. Consulta detalhada de janelas de exibição (release_dates) no TMDB se houver tmdbId
    const tmdbIdNum = item.tmdbId ? parseInt(item.tmdbId, 10) : (item.id.startsWith('tmdb-') ? parseInt(item.id.replace('tmdb-', ''), 10) : NaN);

    if (!isNaN(tmdbIdNum) && tmdbIdNum > 0) {
      try {
        const [datesRes, detailsRes] = await Promise.allSettled([
          fetch(`${TMDB_BASE_URL}/movie/${tmdbIdNum}/release_dates?api_key=${TMDB_API_KEY}`),
          fetch(`${TMDB_BASE_URL}/movie/${tmdbIdNum}?api_key=${TMDB_API_KEY}&language=pt-BR`)
        ]);

        // Verificação adicional no endpoint de detalhes do TMDB (status e data)
        if (detailsRes.status === 'fulfilled' && detailsRes.value.ok) {
          const detailsData = await detailsRes.value.json();
          if (detailsData.status && detailsData.status !== 'Released') {
            const evaluation: TheatricalEvaluation = {
              id: item.id,
              tmdbId: item.tmdbId,
              region: 'BR',
              title: item.title,
              status: 'UPCOMING',
              allowed: false,
              reason: `Status de produção não lançado no TMDB (${detailsData.status})`,
              evidence: [`tmdb_status_${detailsData.status}`],
              evaluatedAt: now,
              expiresAt: now + (24 * 60 * 60 * 1000)
            };
            this.cache.set(cacheKey, evaluation);
            this.saveToStorage();
            return evaluation;
          }
          if (detailsData.release_date && detailsData.release_date > todayStr) {
            const evaluation: TheatricalEvaluation = {
              id: item.id,
              tmdbId: item.tmdbId,
              region: 'BR',
              title: item.title,
              status: 'UPCOMING',
              allowed: false,
              reason: `Estreia nos cinemas prevista para ${detailsData.release_date}`,
              evidence: [`tmdb_details_future_date_${detailsData.release_date}`],
              theatricalDate: detailsData.release_date,
              evaluatedAt: now,
              expiresAt: now + (24 * 60 * 60 * 1000)
            };
            this.cache.set(cacheKey, evaluation);
            this.saveToStorage();
            return evaluation;
          }
        }

        if (datesRes.status === 'fulfilled' && datesRes.value.ok) {
          const data = await datesRes.value.json();
          const countries: any[] = data.results || [];

          // Prioriza dados regionais do Brasil (BR), depois dados globais (US / WW)
          const brData = countries.find(c => c.iso_3166_1 === 'BR');
          const usData = countries.find(c => c.iso_3166_1 === 'US');

          let theatricalDate: string | undefined;
          let digitalDate: string | undefined;
          const evidence: string[] = [];

          const extractDates = (countryObj: any, countryCode: string) => {
            if (!countryObj?.release_dates) return;
            for (const rd of countryObj.release_dates) {
              const rDate = (rd.release_date || '').slice(0, 10);
              // Type 1 = Premiere, 2 = Theatrical (limited), 3 = Theatrical
              if (rd.type === 1 || rd.type === 2 || rd.type === 3) {
                if (!theatricalDate || rDate < theatricalDate) {
                  theatricalDate = rDate;
                  evidence.push(`theatrical_${countryCode}_${rDate}`);
                }
              }
              // Type 4 = Digital, 5 = Physical, 6 = TV
              if (rd.type === 4 || rd.type === 5 || rd.type === 6) {
                if (!digitalDate || rDate < digitalDate) {
                  digitalDate = rDate;
                  evidence.push(`digital_${countryCode}_${rDate}`);
                }
              }
            }
          };

          if (brData) extractDates(brData, 'BR');
          if (usData && (!digitalDate || !theatricalDate)) extractDates(usData, 'US');

          // Regra A: Estreia teatral futura (ainda não lançado)
          if (theatricalDate && theatricalDate > todayStr) {
            const evaluation: TheatricalEvaluation = {
              id: item.id,
              tmdbId: item.tmdbId,
              region: 'BR',
              title: item.title,
              status: 'UPCOMING',
              allowed: false,
              reason: `Estreia nos cinemas prevista para ${theatricalDate}`,
              evidence: [...evidence, 'theatrical_future_date'],
              theatricalDate,
              digitalDate,
              evaluatedAt: now,
              expiresAt: now + (24 * 60 * 60 * 1000)
            };
            this.cache.set(cacheKey, evaluation);
            this.saveToStorage();
            return evaluation;
          }

          // Regra B: Lançamento digital/físico oficial confirmado
          if (digitalDate && digitalDate <= todayStr) {
            const evaluation: TheatricalEvaluation = {
              id: item.id,
              tmdbId: item.tmdbId,
              region: 'BR',
              title: item.title,
              status: 'DIGITAL_RELEASED',
              allowed: true,
              reason: `Lançamento digital oficial disponível desde ${digitalDate}`,
              evidence: [...evidence, 'digital_release_active'],
              theatricalDate,
              digitalDate,
              evaluatedAt: now,
              expiresAt: now + (7 * 24 * 60 * 60 * 1000) // 7 dias
            };
            this.cache.set(cacheKey, evaluation);
            this.saveToStorage();
            return evaluation;
          }

          // Regra C: Estreou no cinema recentemente e não possui data digital confirmada
          if (theatricalDate) {
            const diffDays = Math.floor((now - new Date(theatricalDate).getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 70) {
              // Menos de 70 dias: em cartaz, mas a fonte é validada separadamente.
              const evaluation: TheatricalEvaluation = {
                id: item.id,
                tmdbId: item.tmdbId,
                region: 'BR',
                title: item.title,
                status: 'IN_THEATERS',
                allowed: true,
                reason: `Em cartaz nos cinemas há ${diffDays} dias; fontes ainda precisam ser validadas`,
                evidence: [...evidence, `${diffDays}_days_theatrical_window`],
                theatricalDate,
                evaluatedAt: now,
                expiresAt: now + (12 * 60 * 60 * 1000)
              };
              this.cache.set(cacheKey, evaluation);
              this.saveToStorage();
              return evaluation;
            } else if (diffDays < 95) {
              // Entre 70 e 95 dias sem confirmação digital: status incerto.
              const evaluation: TheatricalEvaluation = {
                id: item.id,
                tmdbId: item.tmdbId,
                region: 'BR',
                title: item.title,
                status: 'THEATRICAL_STATUS_UNKNOWN',
                allowed: true,
                reason: `Período de transição de cinema (${diffDays} dias); fontes ainda precisam ser validadas`,
                evidence: [...evidence, 'theatrical_status_uncertain'],
                theatricalDate,
                evaluatedAt: now,
                expiresAt: now + (6 * 60 * 60 * 1000)
              };
              this.cache.set(cacheKey, evaluation);
              this.saveToStorage();
              return evaluation;
            } else {
              // Mais de 95 dias: circuito comercial de cinema finalizado
              const evaluation: TheatricalEvaluation = {
                id: item.id,
                tmdbId: item.tmdbId,
                region: 'BR',
                title: item.title,
                status: 'POST_THEATRICAL',
                allowed: true,
                reason: `Janela de exibição nos cinemas finalizada (${diffDays} dias desde o lançamento)`,
                evidence: [...evidence, 'theatrical_circuit_closed'],
                theatricalDate,
                evaluatedAt: now,
                expiresAt: now + (14 * 24 * 60 * 60 * 1000) // 14 dias
              };
              this.cache.set(cacheKey, evaluation);
              this.saveToStorage();
              return evaluation;
            }
          }
        }
      } catch (err) {
        console.warn(`[TheatricalFilter] Falha na API ao consultar datas de ${item.title}:`, err);
      }
    }

    // 8. Fallback Seguro: Se o item é do ano corrente mas não possui datas nem está em now_playing
    const fallbackEvaluation: TheatricalEvaluation = {
      id: item.id,
      tmdbId: item.tmdbId,
      region: 'BR',
      title: item.title,
      status: 'POST_THEATRICAL',
      allowed: true,
      reason: 'Sem indício de exibição cinematográfica ativa no Brasil',
      evidence: ['heuristic_fallback_allowed'],
      evaluatedAt: now,
      expiresAt: now + (24 * 60 * 60 * 1000)
    };
    this.cache.set(cacheKey, fallbackEvaluation);
    this.saveToStorage();
    return fallbackEvaluation;
  }

  /**
   * Avaliação instantânea síncrona com base no cache e heurísticas imediatas.
   * Executa sem requisições para evitar esconder títulos já lançados.
   */
  public isMovieAllowedSync(item: ContentItem): boolean {
    if (!item) return false;
    if (item.type === ContentType.SERIES) return true;

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const itemYear = Number(item.year) || currentYear;

    // 1. Bloqueia imediatamente anos futuros
    if (itemYear > currentYear) return false;

    // 2. Bloqueia imediatamente se a data de lançamento for futura em relação a hoje
    if (item.releaseDate && item.releaseDate > todayStr) return false;

    // 3. Bloqueia somente obras cuja estreia ainda está no futuro
    if (this.isKnownUnreleasedOrTheatrical(item)) return false;

    // 4. Próximos lançamentos continuam bloqueados; filmes já em cartaz podem aparecer.
    if (!this.isKnownInTheaters(item) && this.isKnownUpcoming(item)) {
      return false;
    }

    if (this.isKnownInTheaters(item)) return true;

    // 5. Consulta cache pré-avaliado
    const cacheKey = item.tmdbId ? `tmdb-${item.tmdbId}` : (item.imdbId || item.id);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.status === 'IN_THEATERS' || cached.status === 'THEATRICAL_STATUS_UNKNOWN' || cached.allowed;
    }

    // 6. Libera imediatamente filmes lançados antes do ano anterior
    if (itemYear < currentYear - 1) return true;

    return true;
  }

  /**
   * Avalia de forma assíncrona se o filme é permitido
   */
  public async isMovieAllowed(item: ContentItem): Promise<boolean> {
    const res = await this.evaluateMovie(item);
    return res.allowed;
  }

  /**
   * Filtra uma lista de itens removendo filmes ainda não lançados
   */
  public async filterAllowedMovies(items: ContentItem[]): Promise<ContentItem[]> {
    if (!items || items.length === 0) return [];
    const evaluations = await Promise.all(items.map(it => this.evaluateMovie(it)));
    return items.filter((_, idx) => evaluations[idx].allowed);
  }

  /**
   * Filtro síncrono rápido para views e renderizadores de UI
   */
  public filterAllowedMoviesSync(items: ContentItem[]): ContentItem[] {
    if (!items || items.length === 0) return [];
    return items.filter(it => this.isMovieAllowedSync(it));
  }

  public clearCache(): void {
    this.cache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('zapitv_theatrical_evaluations');
    }
  }

  /**
   * Injeta manualmente uma avaliação no cache (usado para testes ou override de segurança)
   */
  public setMockEvaluation(key: string, evaluation: TheatricalEvaluation): void {
    this.cache.set(key, evaluation);
  }
}

export const theatricalFilterService = new TheatricalFilterService();
