import { ContentItem, ContentType } from '../../../types';
import { tmdbService } from '../tmdb/tmdbClient';

export type SkipType = 'op' | 'recap' | 'ed';

export interface SkipInterval {
  startTime: number;      // Tempo de início ajustado em segundos
  endTime: number;        // Tempo de término ajustado em segundos
  rawStartTime: number;   // Tempo original retornado pela API ou cadastro
  rawEndTime: number;     // Tempo original retornado pela API ou cadastro
  type: SkipType;
  label: string;          // 'Pular Abertura' | 'Pular Recapitulação' | 'Pular Créditos'
  confidence?: number;
  source: 'aniskip' | 'introdb' | 'manual' | 'admin' | 'verified';
  skipId?: string;
}

export interface AdminSkipEntry {
  id: string;             // Identificador único (ex: 'dexter_s1_e1_op')
  contentId: string;      // ID da obra, TMDB ID, IMDb ID ou slug
  contentTitle?: string;  // Título amigável da série
  season: number;
  episode: number;
  type: SkipType;
  startTime: number;
  endTime: number;
  label?: string;
  source: 'admin' | 'verified';
  createdAt?: number;
}

export interface VerifiedSeriesConfig {
  ids: string[];          // Ex: ['1405', 'tt0773262', 'dexter']
  title: string;
  seasons: {
    [seasonNum: number]: {
      [episodeNum: number]: Array<{
        type: SkipType;
        startTime: number;
        endTime: number;
      }>;
    };
  };
}

/**
 * Converte strings nos formatos "mm:ss", "hh:mm:ss" ou segundos numéricos para segundos
 */
export function parseTimeToSeconds(input: string | number): number {
  if (typeof input === 'number') return isNaN(input) ? 0 : Math.max(0, input);
  if (!input || typeof input !== 'string') return 0;
  const trimmed = input.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, parseFloat(trimmed));
  }
  const parts = trimmed.split(':').map(p => parseFloat(p.trim()));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) {
    return Math.max(0, parts[0] * 60 + parts[1]);
  } else if (parts.length === 3) {
    return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  return 0;
}

/**
 * Converte segundos numéricos para o formato legível "mm:ss" ou "hh:mm:ss"
 */
export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Catálogo canônico de intervalos verificados para séries clássicas
 * com calibração precisa da versão de streaming real (ex: Dexter Piloto S01E01 com cold open até 07:30 e abertura de 450s a 555s)
 */
export const VERIFIED_SERIES_INTERVALS: VerifiedSeriesConfig[] = [
  {
    ids: ['1405', 'tt0773262', 'dexter'],
    title: 'Dexter',
    seasons: {
      1: {
        // S01E01 (Pilot): Cold open icônico até 07:30 (450s), abertura de 07:30 a 09:15 (450s a 555s), créditos finais aos 51:28 (3088s a 3190s)
        1: [
          { type: 'op', startTime: 450, endTime: 555 },
          { type: 'ed', startTime: 3088, endTime: 3190 }
        ],
        // S01E02 (Crocodile): Recap 00:01 a 02:05 (1s a 125s), Abertura 02:06 a 03:48 (126s a 228s), Créditos 3232s a 3285s
        2: [
          { type: 'recap', startTime: 1, endTime: 125 },
          { type: 'op', startTime: 126, endTime: 228 },
          { type: 'ed', startTime: 3232, endTime: 3285 }
        ],
        // S01E03 (Popping Cherry): Recap 1s a 110s, Abertura 110s a 217s (01:50 a 03:37), Créditos 3010s a 3062s
        3: [
          { type: 'recap', startTime: 1, endTime: 110 },
          { type: 'op', startTime: 110, endTime: 217 },
          { type: 'ed', startTime: 3010, endTime: 3062 }
        ],
        // S01E04 (Let's Give the Boy a Hand): Recap 1s a 97s, Abertura 98s a 205s (01:38 a 03:25), Créditos 3418s a 3470s
        4: [
          { type: 'recap', startTime: 1, endTime: 97 },
          { type: 'op', startTime: 98, endTime: 205 },
          { type: 'ed', startTime: 3418, endTime: 3470 }
        ],
        // S01E05 (Love American Style): Recap 1s a 80s, Abertura 106s a 209s (01:46 a 03:29), Créditos 3291s a 3343s
        5: [
          { type: 'recap', startTime: 1, endTime: 80 },
          { type: 'op', startTime: 106, endTime: 209 },
          { type: 'ed', startTime: 3291, endTime: 3343 }
        ],
        // S01E06 (Return to Sender): Recap 1s a 75s, Abertura 76s a 180s, Créditos 3120s a 3175s
        6: [
          { type: 'recap', startTime: 1, endTime: 75 },
          { type: 'op', startTime: 76, endTime: 180 },
          { type: 'ed', startTime: 3120, endTime: 3175 }
        ],
        // S01E07 (Circle of Friends): Recap 1s a 65s, Abertura 66s a 170s, Créditos 3080s a 3135s
        7: [
          { type: 'recap', startTime: 1, endTime: 65 },
          { type: 'op', startTime: 66, endTime: 170 },
          { type: 'ed', startTime: 3080, endTime: 3135 }
        ],
        // S01E08 (Shrink Wrap): Recap 1s a 70s, Abertura 71s a 175s, Créditos 3150s a 3205s
        8: [
          { type: 'recap', startTime: 1, endTime: 70 },
          { type: 'op', startTime: 71, endTime: 175 },
          { type: 'ed', startTime: 3150, endTime: 3205 }
        ],
        // S01E09 (Father Knows Best): Recap 1s a 85s, Abertura 86s a 190s, Créditos 3200s a 3255s
        9: [
          { type: 'recap', startTime: 1, endTime: 85 },
          { type: 'op', startTime: 86, endTime: 190 },
          { type: 'ed', startTime: 3200, endTime: 3255 }
        ],
        // S01E10 (Seeing Red): Recap 1s a 90s, Abertura 91s a 195s, Créditos 3180s a 3235s
        10: [
          { type: 'recap', startTime: 1, endTime: 90 },
          { type: 'op', startTime: 91, endTime: 195 },
          { type: 'ed', startTime: 3180, endTime: 3235 }
        ],
        // S01E11 (Truth Be Told): Recap 1s a 88s, Abertura 89s a 193s, Créditos 3220s a 3275s
        11: [
          { type: 'recap', startTime: 1, endTime: 88 },
          { type: 'op', startTime: 89, endTime: 193 },
          { type: 'ed', startTime: 3220, endTime: 3275 }
        ],
        // S01E12 (Born Free): Recap 1s a 95s, Abertura 96s a 200s, Créditos 3340s a 3395s
        12: [
          { type: 'recap', startTime: 1, endTime: 95 },
          { type: 'op', startTime: 96, endTime: 200 },
          { type: 'ed', startTime: 3340, endTime: 3395 }
        ]
      }
    }
  }
];

interface SkipCacheEntry {
  intervals: SkipInterval[];
  timestamp: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const API_TIMEOUT_MS = 5000; // 5 segundos de timeout
const ADMIN_STORAGE_KEY = 'zapitv_admin_skip_intervals';

class SkipService {
  private memoryCache = new Map<string, SkipInterval[]>();
  private malIdCache = new Map<string, number | null>();
  private imdbIdCache = new Map<string, string | null>();
  private manualIntervalsMemory = new Map<string, SkipInterval[]>();
  private skipOffsetsMemory = new Map<string, number>();

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
    if (this.skipOffsetsMemory.has(contentId)) {
      return this.skipOffsetsMemory.get(contentId)!;
    }
    try {
      const saved = this.getStorageItem(`zapitv_skip_offset_${contentId}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed)) {
          this.skipOffsetsMemory.set(contentId, parsed);
          return parsed;
        }
      }
    } catch {}
    return 0;
  }

  /**
   * Salva o offset de ajuste manual para o conteúdo
   */
  public setSkipOffset(contentId: string, offsetSeconds: number): void {
    this.skipOffsetsMemory.set(contentId, offsetSeconds);
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(`zapitv_skip_offset_${contentId}`, offsetSeconds.toString());
      }
    } catch {}
  }

  /**
   * Obtém intervalos manuais customizados pelo usuário para um episódio específico
   */
  public getManualIntervals(contentId: string, season = 1, episode = 1): SkipInterval[] | null {
    const key = `zapitv_custom_skip_${contentId}_s${season}_e${episode}`;
    if (this.manualIntervalsMemory.has(key)) {
      return this.manualIntervalsMemory.get(key)!;
    }
    try {
      const saved = this.getStorageItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.manualIntervalsMemory.set(key, parsed);
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
    this.manualIntervalsMemory.set(key, updated);
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {}
  }

  /**
   * Remove intervalos de skip manuais salvos pelo usuário
   */
  public clearManualInterval(contentId: string, season = 1, episode = 1): void {
    const key = `zapitv_custom_skip_${contentId}_s${season}_e${episode}`;
    this.manualIntervalsMemory.delete(key);
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {}
  }

  private adminIntervalsMemory: AdminSkipEntry[] = [];

  private getStorageItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        return window.localStorage.getItem(key);
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return null;
  }

  private setStorageItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(key, value);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {}
  }

  private removeStorageItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.removeItem(key);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}
  }

  /**
   * Obtém todos os intervalos cadastrados pelo Painel Administrativo
   */
  public getAllAdminIntervals(): AdminSkipEntry[] {
    const raw = this.getStorageItem(ADMIN_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.adminIntervalsMemory = parsed;
          return parsed;
        }
      } catch {}
    }
    return this.adminIntervalsMemory;
  }

  /**
   * Salva ou atualiza um intervalo pelo Painel Administrativo
   */
  public saveAdminInterval(
    entry: Omit<AdminSkipEntry, 'id' | 'createdAt'> & { id?: string }
  ): AdminSkipEntry {
    const all = [...this.getAllAdminIntervals()];
    const cleanContentId = String(entry.contentId).trim().toLowerCase();
    const id = entry.id || `${cleanContentId}_s${entry.season}_e${entry.episode}_${entry.type}`;
    const newEntry: AdminSkipEntry = {
      ...entry,
      id,
      contentId: cleanContentId,
      label: entry.label || this.getLabelForType(entry.type),
      source: 'admin',
      createdAt: Date.now()
    };

    const existingIndex = all.findIndex(e => e.id === id);
    if (existingIndex >= 0) {
      all[existingIndex] = newEntry;
    } else {
      all.push(newEntry);
    }

    this.adminIntervalsMemory = all;
    this.setStorageItem(ADMIN_STORAGE_KEY, JSON.stringify(all));

    // Invalida caches para refletir imediatamente no player
    this.memoryCache.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        const cachePrefix = `zapitv_skip_cache_`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(cachePrefix)) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch {}

    return newEntry;
  }

  /**
   * Remove um intervalo cadastrado pelo Painel Administrativo
   */
  public deleteAdminInterval(id: string): void {
    const all = this.getAllAdminIntervals().filter(e => e.id !== id);
    this.adminIntervalsMemory = all;
    this.setStorageItem(ADMIN_STORAGE_KEY, JSON.stringify(all));
    this.memoryCache.clear();
  }

  /**
   * Busca intervalos cadastrados pelo Admin correspondentes a um item e episódio
   */
  public getAdminIntervals(item: ContentItem, season = 1, episode = 1): SkipInterval[] | null {
    const all = this.getAllAdminIntervals();
    if (all.length === 0) return null;

    const normalizeKey = (val: string) =>
      val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').trim();

    const targetKeys = new Set([
      String(item.id || '').toLowerCase().trim(),
      normalizeKey(String(item.id || '')),
      String(item.tmdbId || '').toLowerCase().trim(),
      normalizeKey(String(item.tmdbId || '')),
      String(item.imdbId || '').toLowerCase().trim(),
      normalizeKey(String(item.imdbId || '')),
      item.title ? normalizeKey(item.title) : '',
      item.originalTitle ? normalizeKey(item.originalTitle) : ''
    ].filter(Boolean));

    const matches = all.filter(e => {
      const eId = String(e.contentId || '').toLowerCase().trim();
      const eIdNorm = normalizeKey(eId);
      const eTitleNorm = e.contentTitle ? normalizeKey(e.contentTitle) : '';

      const matchId = targetKeys.has(eId) || targetKeys.has(eIdNorm) || (eTitleNorm && targetKeys.has(eTitleNorm));
      return matchId && Number(e.season) === Number(season) && Number(e.episode) === Number(episode);
    });

    if (matches.length === 0) return null;

    return matches.map(m => ({
      startTime: m.startTime,
      endTime: m.endTime,
      rawStartTime: m.startTime,
      rawEndTime: m.endTime,
      type: m.type,
      label: m.label || this.getLabelForType(m.type),
      confidence: 1,
      source: 'admin'
    }));
  }

  /**
   * Busca intervalos canônicos verificados correspondentes ao item e episódio
   */
  public getVerifiedIntervals(item: ContentItem, season = 1, episode = 1): SkipInterval[] | null {
    const normalizeKey = (val: string) =>
      val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').trim();

    const targetKeys = new Set([
      String(item.id || '').toLowerCase().trim(),
      normalizeKey(String(item.id || '')),
      String(item.tmdbId || '').toLowerCase().trim(),
      normalizeKey(String(item.tmdbId || '')),
      String(item.imdbId || '').toLowerCase().trim(),
      normalizeKey(String(item.imdbId || '')),
      item.title ? normalizeKey(item.title) : '',
      item.originalTitle ? normalizeKey(item.originalTitle) : ''
    ].filter(Boolean));

    for (const v of VERIFIED_SERIES_INTERVALS) {
      const matchId = v.ids.some(id => targetKeys.has(id.toLowerCase().trim()) || targetKeys.has(normalizeKey(id))) ||
        (v.title && targetKeys.has(normalizeKey(v.title)));
      if (!matchId) continue;

      const seasonData = v.seasons[season];
      if (!seasonData) continue;

      const epData = seasonData[episode];
      if (epData && Array.isArray(epData) && epData.length > 0) {
        return epData.map(e => ({
          startTime: e.startTime,
          endTime: e.endTime,
          rawStartTime: e.startTime,
          rawEndTime: e.endTime,
          type: e.type,
          label: this.getLabelForType(e.type),
          confidence: 1,
          source: 'verified'
        }));
      }
    }

    return null;
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

    // 1. PRIORIDADE 1: Intervalos manuais customizados localmente pelo usuário no player
    const manualIntervals = this.getManualIntervals(item.id, season, episode);
    if (manualIntervals && manualIntervals.length > 0) {
      return this.applyOffsetAndValidate(manualIntervals, offset, duration);
    }

    // 2. PRIORIDADE 2: Intervalos cadastrados pelo Administrador no Painel Dev/Admin
    const adminIntervals = this.getAdminIntervals(item, season, episode);
    if (adminIntervals && adminIntervals.length > 0) {
      return this.applyOffsetAndValidate(adminIntervals, offset, duration);
    }

    // 3. PRIORIDADE 3: Intervalos canônicos verificados (ex: Dexter S01E01 a S01E12)
    const verifiedIntervals = this.getVerifiedIntervals(item, season, episode);
    if (verifiedIntervals && verifiedIntervals.length > 0) {
      return this.applyOffsetAndValidate(verifiedIntervals, offset, duration);
    }

    // 4. Verifica cache em memória (somente se contiver intervalos válidos)
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      if (cached && cached.length > 0) {
        return this.applyOffsetAndValidate(cached, offset, duration);
      }
    }

    // 5. Verifica cache persistente (localStorage)
    try {
      const savedCache = localStorage.getItem(cacheKey);
      if (savedCache) {
        const entry: SkipCacheEntry = JSON.parse(savedCache);
        if (entry.intervals && entry.intervals.length > 0 && Date.now() - entry.timestamp < CACHE_TTL_MS) {
          this.memoryCache.set(cacheKey, entry.intervals);
          return this.applyOffsetAndValidate(entry.intervals, offset, duration);
        } else {
          // Se o cache for vazio ou expirado, remove para permitir nova busca
          localStorage.removeItem(cacheKey);
        }
      }
    } catch {}

    let intervals: SkipInterval[] = [];

    // 6. Se for Anime: Prioriza AniSkip via MyAnimeList ID
    if (isAnime) {
      intervals = await this.fetchAnimeSkipTimes(item, season, episode, duration);
      // Se AniSkip não encontrar, tenta IntroDB como fallback se tiver IMDb ID
      if (intervals.length === 0) {
        intervals = await this.fetchSeriesSkipTimes(item, season, episode, duration);
      }
    } else {
      // 7. Se for Série: Consulta IntroDB via IMDb ID
      intervals = await this.fetchSeriesSkipTimes(item, season, episode, duration);
    }

    // Salva em cache APENAS se houver intervalos encontrados!
    if (intervals.length > 0) {
      this.memoryCache.set(cacheKey, intervals);
      try {
        const entry: SkipCacheEntry = {
          intervals,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(entry));
      } catch {}
    } else {
      // NUNCA salva lista vazia no localStorage por 7 dias!
      this.memoryCache.delete(cacheKey);
      try {
        localStorage.removeItem(cacheKey);
      } catch {}
    }

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
                label: 'Pular Créditos',
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
    if (item.mediaFormat === 'movie') return null;
    const rawId = (item as any).malId || (item as any).idMal;
    if (typeof rawId === 'number' && rawId > 0) return rawId;
    if (typeof rawId === 'string' && /^\d+$/.test(rawId)) return parseInt(rawId, 10);

    const cacheKey = JSON.stringify([item.id, item.imdbId, item.tmdbId, item.title, item.year, season]);
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
                startDate { year }
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
            const normalize = (value: string) => value.toLowerCase().normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
            const expected = (season > 1
              ? [`${cleanTitle} Season ${season}`, `${cleanTitle} ${season}`]
              : [cleanTitle, item.originalTitle])
              .filter(Boolean).map(value => normalize(value!));
            const matching = mediaList.find((m: any) => m.idMal > 0 && m.format !== 'MOVIE' &&
              (season > 1 || !m.startDate?.year || !item.year || Math.abs(m.startDate.year - item.year) <= 1) &&
              [m.title?.romaji, m.title?.english, m.title?.native].some(title => title && expected.includes(normalize(title))));
            if (matching) {
              const idMal = Number(matching.idMal);
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

    const cacheKey = (item.tmdbId || item.id || item.title).toLowerCase().trim();
    if (this.imdbIdCache.has(cacheKey)) {
      return this.imdbIdCache.get(cacheKey)!;
    }

    // 1. Tenta resolver diretamente via external_ids do TMDB
    const rawId = item.tmdbId || item.id;
    const cleanTmdbId = typeof rawId === 'string' ? rawId.replace(/^tmdb-?/i, '') : String(rawId);
    if (cleanTmdbId && /^\d+$/.test(cleanTmdbId)) {
      try {
        const imdbId = await tmdbService.getImdbId(cleanTmdbId, item.type || 'series');
        if (imdbId && /^tt\d+$/i.test(imdbId)) {
          this.imdbIdCache.set(cacheKey, imdbId);
          item.imdbId = imdbId;
          return imdbId;
        }
      } catch {}
    }

    // 2. Tenta buscar detalhes completos via TMDB
    if (item.tmdbId || (cleanTmdbId && /^\d+$/.test(cleanTmdbId))) {
      try {
        const targetId = item.tmdbId || cleanTmdbId;
        const details = await tmdbService.getDetails(targetId, item.type, item.mediaFormat);
        if (details?.imdbId && /^tt\d+$/i.test(details.imdbId)) {
          this.imdbIdCache.set(cacheKey, details.imdbId);
          item.imdbId = details.imdbId;
          return details.imdbId;
        }
      } catch {}
    }

    // 3. Tenta buscar no Cinemeta pelo título
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
        return 'Pular Créditos';
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
      let end = Math.max(0, interval.rawEndTime + offset);

      // Se a duração do vídeo for conhecida, ajusta end aos limites do stream em vez de descartar
      if (duration > 60) {
        if (start >= duration) continue;
        if (end > duration) {
          end = duration;
        }

        // Aberturas não iniciam nos últimos 30% do vídeo
        if (interval.type === 'op' && start > duration * 0.7) {
          continue;
        }

        // Encerramentos/Créditos não iniciam nos primeiros 40% do vídeo
        if (interval.type === 'ed' && start < duration * 0.4) {
          continue;
        }
      }

      // Validação 1: O término deve ser estritamente posterior ao início
      if (end <= start) continue;

      // Validação 2: Duração razoável para o tipo de intervalo
      const diff = end - start;
      if (interval.type === 'ed') {
        if (diff < 2) continue; // Pelo menos 2 segundos para créditos (permite encerramento curto)
        if (diff > 480) continue; // Créditos não duram mais de 8 minutos
      } else {
        if (diff < 5) continue; // Pelo menos 5 segundos para abertura e recapitulação
        if (diff > 360) continue; // Abertura / recapitulação não dura mais de 6 minutos
      }

      validated.push({
        ...interval,
        label: this.getLabelForType(interval.type),
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
