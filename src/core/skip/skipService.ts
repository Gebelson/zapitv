import { ContentItem, ContentType } from '../../../types';
import { tmdbService } from '../tmdb/tmdbClient';

export type SkipType = 'op' | 'recap' | 'ed';

export interface SkipInterval {
  startTime: number;      // Tempo de início ajustado em segundos
  endTime: number;        // Tempo de término ajustado em segundos
  rawStartTime: number;   // Tempo original retornado pela API
  rawEndTime: number;     // Tempo original retornado pela API
  type: SkipType;
  label: string;          // 'Pular Abertura' | 'Pular Recapitulação' | 'Pular Encerramento'
  confidence?: number;
  source: 'aniskip' | 'introdb' | 'manual';
  skipId?: string;
}

interface SkipCacheEntry {
  intervals: SkipInterval[];
  timestamp: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const API_TIMEOUT_MS = 5000; // 5 segundos de timeout

class SkipService {
  private memoryCache = new Map<string, SkipInterval[]>();
  private malIdCache = new Map<string, number | null>();
  private imdbIdCache = new Map<string, string | null>();

  /**
   * Verifica se o recurso de auto-skip está habilitado nas configurações do usuário
   */
  public isAutoSkipEnabled(): boolean {
    try {
      return localStorage.getItem('zapitv_auto_skip') === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Salva a preferência de auto-skip do usuário
   */
  public setAutoSkipEnabled(enabled: boolean): void {
    try {
      localStorage.setItem('zapitv_auto_skip', enabled ? 'true' : 'false');
    } catch {}
  }

  /**
   * Obtém o offset de ajuste manual de sincronização para o conteúdo (em segundos)
   */
  public getSkipOffset(contentId: string): number {
    try {
      const saved = localStorage.getItem(`zapitv_skip_offset_${contentId}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) return parsed;
      }
    } catch {}
    return 0;
  }

  /**
   * Salva o offset de ajuste manual para o conteúdo
   */
  public setSkipOffset(contentId: string, offsetSeconds: number): void {
    try {
      localStorage.setItem(`zapitv_skip_offset_${contentId}`, offsetSeconds.toString());
    } catch {}
  }

  /**
   * Obtém intervalos manuais customizados pelo usuário para um episódio específico
   */
  public getManualIntervals(contentId: string, season = 1, episode = 1): SkipInterval[] | null {
    try {
      const key = `zapitv_custom_skip_${contentId}_s${season}_e${episode}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Salva um intervalo de skip manual customizado pelo usuário
   */
  public saveManualInterval(
    contentId: string,
    season = 1,
    episode = 1,
    interval: { startTime: number; endTime: number; type: SkipType }
  ): void {
    try {
      const key = `zapitv_custom_skip_${contentId}_s${season}_e${episode}`;
      const existing = this.getManualIntervals(contentId, season, episode) || [];
      const updated: SkipInterval[] = [
        ...existing.filter(i => i.type !== interval.type),
        {
          startTime: interval.startTime,
          endTime: interval.endTime,
          rawStartTime: interval.startTime,
          rawEndTime: interval.endTime,
          type: interval.type,
          label: this.getLabelForType(interval.type),
          confidence: 1,
          source: 'manual'
        }
      ];
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
  }

  /**
   * Remove intervalos de skip manuais salvos pelo usuário
   */
  public clearManualInterval(contentId: string, season = 1, episode = 1): void {
    try {
      const key = `zapitv_custom_skip_${contentId}_s${season}_e${episode}`;
      localStorage.removeItem(key);
    } catch {}
  }

  /**
   * Função principal para obter os intervalos de skip para qualquer item (Anime ou Série)
   */
  public async getSkipTimes(
    item: ContentItem,
    season = 1,
    episode = 1,
    duration = 0
  ): Promise<SkipInterval[]> {
    const offset = this.getSkipOffset(item.id);

    // Se for filme e não tiver marcação manual, não consulta APIs de episódios
    if (item.type === ContentType.MOVIE) {
      const manual = this.getManualIntervals(item.id, 1, 1);
      return manual ? this.applyOffsetAndValidate(manual, offset, duration) : [];
    }

    const isAnime =
      item.type === ContentType.ANIME ||
      item.genres?.some(g => /anime|animação japonesa/i.test(g)) ||
      false;

    const cacheKey = `zapitv_skip_cache_${item.id}_s${season}_e${episode}`;

    // 1. Verifica se há intervalo manual customizado pelo usuário
    const manualIntervals = this.getManualIntervals(item.id, season, episode);
    if (manualIntervals && manualIntervals.length > 0) {
      return this.applyOffsetAndValidate(manualIntervals, offset, duration);
    }

    // 2. Verifica cache em memória
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      return this.applyOffsetAndValidate(cached, offset, duration);
    }

    // 3. Verifica cache persistente (localStorage)
    try {
      const savedCache = localStorage.getItem(cacheKey);
      if (savedCache) {
        const entry: SkipCacheEntry = JSON.parse(savedCache);
        if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
          this.memoryCache.set(cacheKey, entry.intervals);
          return this.applyOffsetAndValidate(entry.intervals, offset, duration);
        }
      }
    } catch {}

    let intervals: SkipInterval[] = [];

    // 4. Se for Anime: Prioriza AniSkip via MyAnimeList ID
    if (isAnime) {
      intervals = await this.fetchAnimeSkipTimes(item, season, episode, duration);
      // Se AniSkip não encontrar, tenta IntroDB como fallback se tiver IMDb ID
      if (intervals.length === 0) {
        intervals = await this.fetchSeriesSkipTimes(item, season, episode, duration);
      }
    } else {
      // 5. Se for Série: Prioriza IntroDB via IMDb ID
      intervals = await this.fetchSeriesSkipTimes(item, season, episode, duration);
    }

    // Salva em cache
    this.memoryCache.set(cacheKey, intervals);
    try {
      const entry: SkipCacheEntry = {
        intervals,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch {}

    return this.applyOffsetAndValidate(intervals, offset, duration);
  }

  /**
   * Busca timestamps no AniSkip v2 usando AniList GraphQL para resolver MAL ID
   */
  public async fetchAnimeSkipTimes(
    item: ContentItem,
    season = 1,
    episode = 1,
    duration = 0
  ): Promise<SkipInterval[]> {
    try {
      // Resolve MAL ID
      const malId = await this.resolveMalId(item, season);
      if (!malId) {
        console.warn(`[ZapiSkip] Não foi possível resolver MAL ID para anime: ${item.title}`);
        return [];
      }

      const types = ['op', 'ed', 'mixed-op', 'mixed-ed', 'recap'];
      const queryParams = new URLSearchParams();
      types.forEach(t => queryParams.append('types[]', t));
      // Usar 0 garante que o AniSkip não descarte intervalos por diferenças de segundos entre rips
      queryParams.set('episodeLength', '0');

      const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episode}?${queryParams.toString()}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status !== 404) {
          console.warn(`[ZapiSkip] AniSkip respondeu com status ${res.status}`);
        }
        return [];
      }

      const data = await res.json() as any;
      if (!data || !data.found || !Array.isArray(data.results)) {
        return [];
      }

      const intervals: SkipInterval[] = [];
      for (const r of data.results) {
        if (!r.interval || typeof r.interval.startTime !== 'number' || typeof r.interval.endTime !== 'number') {
          continue;
        }

        const skipType = this.mapAniSkipType(r.skipType);
        if (!skipType) continue;

        intervals.push({
          startTime: r.interval.startTime,
          endTime: r.interval.endTime,
          rawStartTime: r.interval.startTime,
          rawEndTime: r.interval.endTime,
          type: skipType,
          label: this.getLabelForType(skipType),
          confidence: 1,
          source: 'aniskip',
          skipId: r.skipId
        });
      }

      return this.deduplicateIntervals(intervals);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[ZapiSkip] Erro ao consultar AniSkip:', err);
      }
      return [];
    }
  }

  /**
   * Busca timestamps no IntroDB API (/segments e fallback /intro)
   */
  public async fetchSeriesSkipTimes(
    item: ContentItem,
    season = 1,
    episode = 1,
    duration = 0
  ): Promise<SkipInterval[]> {
    try {
      const imdbId = await this.resolveImdbId(item);
      if (!imdbId || !/^tt\d+$/i.test(imdbId)) {
        console.warn(`[ZapiSkip] IMDb ID não encontrado ou inválido para: ${item.title}`);
        return [];
      }

      const intervals: SkipInterval[] = [];

      // 1. Tenta endpoint completo /segments
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        const url = `https://api.introdb.app/segments?imdb_id=${imdbId}&season=${season}&episode=${episode}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json() as any;
          if (data) {
            // Abertura (Intro)
            if (data.intro && typeof data.intro.start_sec === 'number' && typeof data.intro.end_sec === 'number') {
              intervals.push({
                startTime: data.intro.start_sec,
                endTime: data.intro.end_sec,
                rawStartTime: data.intro.start_sec,
                rawEndTime: data.intro.end_sec,
                type: 'op',
                label: 'Pular Abertura',
                confidence: data.intro.confidence ?? 1,
                source: 'introdb'
              });
            }

            // Recapitulação (Recap)
            if (data.recap && typeof data.recap.start_sec === 'number' && typeof data.recap.end_sec === 'number') {
              intervals.push({
                startTime: data.recap.start_sec,
                endTime: data.recap.end_sec,
                rawStartTime: data.recap.start_sec,
                rawEndTime: data.recap.end_sec,
                type: 'recap',
                label: 'Pular Recapitulação',
                confidence: data.recap.confidence ?? 1,
                source: 'introdb'
              });
            }

            // Encerramento (Outro)
            if (data.outro && typeof data.outro.start_sec === 'number' && typeof data.outro.end_sec === 'number') {
              intervals.push({
                startTime: data.outro.start_sec,
                endTime: data.outro.end_sec,
                rawStartTime: data.outro.start_sec,
                rawEndTime: data.outro.end_sec,
                type: 'ed',
                label: 'Pular Encerramento',
                confidence: data.outro.confidence ?? 1,
                source: 'introdb'
              });
            }
          }
        }
      } catch (segErr) {
        console.warn('[ZapiSkip] Falha no endpoint /segments do IntroDB:', segErr);
      }

      // 2. Se não retornou nada do /segments, tenta fallback no /intro
      if (intervals.length === 0) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

          const url = `https://api.introdb.app/intro?imdb_id=${imdbId}&season=${season}&episode=${episode}`;
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json() as any;
            if (data && typeof data.start_sec === 'number' && typeof data.end_sec === 'number') {
              intervals.push({
                startTime: data.start_sec,
                endTime: data.end_sec,
                rawStartTime: data.start_sec,
                rawEndTime: data.end_sec,
                type: 'op',
                label: 'Pular Abertura',
                confidence: data.confidence ?? 1,
                source: 'introdb'
              });
            }
          }
        } catch {}
      }

      return this.deduplicateIntervals(intervals);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[ZapiSkip] Erro ao consultar IntroDB:', err);
      }
      return [];
    }
  }

  /**
   * Resolve o ID do MyAnimeList para o item através do AniList GraphQL
   */
  public async resolveMalId(item: ContentItem, season = 1): Promise<number | null> {
    const rawId = (item as any).malId || (item as any).idMal;
    if (typeof rawId === 'number' && rawId > 0) return rawId;
    if (typeof rawId === 'string' && /^\d+$/.test(rawId)) return parseInt(rawId, 10);

    const cacheKey = `${item.title}_s${season}`.toLowerCase().trim();
    if (this.malIdCache.has(cacheKey)) {
      return this.malIdCache.get(cacheKey)!;
    }

    // Limpa o título de caracteres desnecessários
    const cleanTitle = item.title
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .replace(/\s*temporada\s*\d+/i, '')
      .replace(/\s*season\s*\d+/i, '')
      .trim();

    const searchQueries: string[] = [];
    if (season > 1) {
      searchQueries.push(`${cleanTitle} Season ${season}`);
      searchQueries.push(`${cleanTitle} ${season}`);
    }
    searchQueries.push(cleanTitle);

    for (const queryTerm of searchQueries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        const gql = `
          query ($search: String) {
            Page(page: 1, perPage: 3) {
              media(search: $search, type: ANIME) {
                id
                idMal
                title {
                  romaji
                  english
                  native
                }
                format
                episodes
              }
            }
          }
        `;

        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: gql,
            variables: { search: queryTerm }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json() as any;
          const mediaList = json?.data?.Page?.media;
          if (Array.isArray(mediaList) && mediaList.length > 0) {
            const firstWithMal = mediaList.find((m: any) => m.idMal && m.idMal > 0);
            if (firstWithMal) {
              const idMal = Number(firstWithMal.idMal);
              this.malIdCache.set(cacheKey, idMal);
              return idMal;
            }
          }
        }
      } catch (err) {
        console.warn(`[ZapiSkip] Falha na consulta AniList para "${queryTerm}":`, err);
      }
    }

    this.malIdCache.set(cacheKey, null);
    return null;
  }

  /**
   * Resolve o IMDb ID da série (item.imdbId, TMDB details ou Cinemeta)
   */
  public async resolveImdbId(item: ContentItem): Promise<string | null> {
    if (item.imdbId && /^tt\d+$/i.test(item.imdbId)) {
      return item.imdbId;
    }
    if (item.id && /^tt\d+$/i.test(item.id)) {
      return item.id;
    }

    const cacheKey = (item.tmdbId || item.title).toLowerCase().trim();
    if (this.imdbIdCache.has(cacheKey)) {
      return this.imdbIdCache.get(cacheKey)!;
    }

    // 1. Tenta buscar detalhes completos via TMDB
    if (item.tmdbId) {
      try {
        const details = await tmdbService.getDetails(item.tmdbId, item.type);
        if (details?.imdbId && /^tt\d+$/i.test(details.imdbId)) {
          this.imdbIdCache.set(cacheKey, details.imdbId);
          item.imdbId = details.imdbId;
          return details.imdbId;
        }
      } catch {}
    }

    // 2. Tenta buscar no Cinemeta pelo título
    try {
      const cleanTitle = item.title
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s*\[[^\]]*\]/g, '')
        .trim();

      const type = item.type === ContentType.MOVIE ? 'movie' : 'series';
      const searchUrl = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(cleanTitle)}.json`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const res = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json() as any;
        if (data?.metas && Array.isArray(data.metas) && data.metas.length > 0) {
          const match = data.metas.find((m: any) => m.id && /^tt\d+$/i.test(m.id));
          if (match) {
            const foundImdb = match.id;
            this.imdbIdCache.set(cacheKey, foundImdb);
            item.imdbId = foundImdb;
            return foundImdb;
          }
        }
      }
    } catch {}

    this.imdbIdCache.set(cacheKey, null);
    return null;
  }

  /**
   * Mapeia os tipos do AniSkip para os tipos internos padronizados
   */
  private mapAniSkipType(type: string): SkipType | null {
    switch (type) {
      case 'op':
      case 'mixed-op':
        return 'op';
      case 'recap':
        return 'recap';
      case 'ed':
      case 'mixed-ed':
        return 'ed';
      default:
        return null;
    }
  }

  /**
   * Retorna o texto formatado para o botão de acordo com o tipo
   */
  public getLabelForType(type: SkipType): string {
    switch (type) {
      case 'op':
        return 'Pular Abertura';
      case 'recap':
        return 'Pular Recapitulação';
      case 'ed':
        return 'Pular Encerramento';
    }
  }

  /**
   * Aplica offset manual salvo e valida limites de tempo e duração
   */
  private applyOffsetAndValidate(
    intervals: SkipInterval[],
    offset: number,
    duration: number
  ): SkipInterval[] {
    const validated: SkipInterval[] = [];

    for (const interval of intervals) {
      const start = Math.max(0, interval.rawStartTime + offset);
      const end = Math.max(0, interval.rawEndTime + offset);

      // Validação 1: O término deve ser estritamente posterior ao início
      if (end <= start) continue;

      // Validação 2: Duração razoável para o tipo de intervalo
      const diff = end - start;
      if (diff < 5) continue; // Pelo menos 5 segundos de intervalo

      if (interval.type === 'op' || interval.type === 'recap') {
        if (diff > 360) continue; // Abertura / recapitulação não dura mais de 6 minutos
      } else if (interval.type === 'ed') {
        if (diff > 480) continue; // Encerramento não dura mais de 8 minutos
      }

      // Validação 3: Se a duração do vídeo for conhecida
      if (duration > 60) {
        if (start > duration) continue;
        if (end > duration + 10) continue;

        // Aberturas não iniciam nos últimos 30% do vídeo
        if (interval.type === 'op' && start > duration * 0.7) {
          continue;
        }

        // Encerramentos não iniciam nos primeiros 40% do vídeo
        if (interval.type === 'ed' && start < duration * 0.4) {
          continue;
        }
      }

      validated.push({
        ...interval,
        startTime: Number(start.toFixed(2)),
        endTime: Number(end.toFixed(2))
      });
    }

    return this.deduplicateIntervals(validated);
  }

  /**
   * Remove intervalos duplicados ou sobrepostos, priorizando o de maior confiança
   */
  private deduplicateIntervals(intervals: SkipInterval[]): SkipInterval[] {
    if (intervals.length <= 1) return intervals;

    // Ordena por início ascendente
    const sorted = [...intervals].sort((a, b) => a.startTime - b.startTime);
    const result: SkipInterval[] = [];

    for (const cur of sorted) {
      const existing = result.find(r => r.type === cur.type);
      if (!existing) {
        result.push(cur);
      } else {
        // Se já existe do mesmo tipo e há sobreposição ou proximidade (< 10s), mantém o de maior confiança
        const overlap = Math.min(existing.endTime, cur.endTime) - Math.max(existing.startTime, cur.startTime);
        if (overlap > 0 || Math.abs(existing.startTime - cur.startTime) < 10) {
          if ((cur.confidence ?? 0) > (existing.confidence ?? 0)) {
            const idx = result.indexOf(existing);
            result[idx] = cur;
          }
        } else {
          result.push(cur);
        }
      }
    }

    return result;
  }
}

export const skipService = new SkipService();
