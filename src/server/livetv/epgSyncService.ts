import fs from 'fs';
import path from 'path';
import { OfficialChannelProvider } from '../../core/livetv/OfficialChannelProvider';
import { EPG_SEED_SNAPSHOT, ChannelScheduleDays, EpgProgramItem } from '../../core/livetv/epgSeedSnapshot';
import { CurrentEpgState } from '../../core/livetv/types';

export interface EpgSourceConfig {
  id: string;
  name: string;
  url: string;
  fallbackUrl?: string;
  priority: number;
  enabled: boolean;
  type: 'xmltv' | 'm3u-tvg' | 'custom';
}

export interface EpgSourceStatus {
  id: string;
  name: string;
  url: string;
  accessible: boolean;
  httpStatus?: number;
  lastChecked: number;
  lastSuccess?: number;
  programmesCount: number;
  channelsMatched: number;
  errorMessage?: string;
}

export class EpgSyncService {
  private static instance: EpgSyncService;
  private cachePath: string;
  private schedules: Record<string, ChannelScheduleDays> = {};
  private sourcesStatus: Map<string, EpgSourceStatus> = new Map();
  private lastSyncTimestamp = 0;
  private isSyncing = false;
  private SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 horas

  private sources: EpgSourceConfig[] = [
    {
      id: 'braziltvepg',
      name: 'BrazilTVEPG',
      url: 'https://raw.githubusercontent.com/limaalef/BrazilTVEPG/main/epg.xml',
      priority: 1,
      enabled: true,
      type: 'xmltv'
    },
    {
      id: 'plutotv-br',
      name: 'Pluto TV Brasil XMLTV',
      url: 'https://i.mjh.nz/PlutoTV/br.xml',
      fallbackUrl: 'https://raw.githubusercontent.com/matthuisman/i.mjh.nz/master/PlutoTV/br.xml',
      priority: 1,
      enabled: true,
      type: 'xmltv'
    },
    {
      id: 'iptv-com',
      name: 'IPTV-com EPG Brazil',
      url: 'https://raw.githubusercontent.com/iptv-com/epg/main/guides/brazil.xml',
      priority: 2,
      enabled: true,
      type: 'xmltv'
    }
  ];

  public static getInstance(): EpgSyncService {
    if (!EpgSyncService.instance) {
      EpgSyncService.instance = new EpgSyncService();
    }
    return EpgSyncService.instance;
  }

  private constructor() {
    this.cachePath = path.resolve(process.cwd(), 'data', 'epg_cache.json');
    this.loadFromCacheOrSeed();
  }

  private loadFromCacheOrSeed(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        const raw = fs.readFileSync(this.cachePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schedules && typeof parsed.schedules === 'object') {
          this.schedules = parsed.schedules;
          this.lastSyncTimestamp = parsed.generatedAt || Date.now();
          console.log(`[EpgSyncService] Cache carregado com sucesso (${Object.keys(this.schedules).length} canais).`);
          return;
        }
      }
    } catch (err: any) {
      console.warn('[EpgSyncService] Falha ao carregar data/epg_cache.json, utilizando seed embutido:', err.message);
    }

    // Fallback: seed embutido
    this.schedules = { ...EPG_SEED_SNAPSHOT };
    this.lastSyncTimestamp = Date.now();
  }

  public getSources(): EpgSourceConfig[] {
    return this.sources;
  }

  public getSourcesStatus(): EpgSourceStatus[] {
    return Array.from(this.sourcesStatus.values());
  }

  public addM3uSource(url: string, name = 'M3U Provider EPG'): void {
    if (!url || this.sources.some(s => s.url === url)) return;
    this.sources.push({
      id: `m3u-${Math.random().toString(36).substring(2, 7)}`,
      name,
      url,
      priority: 3,
      enabled: true,
      type: 'm3u-tvg'
    });
  }

  /**
   * Executa a sincronização de todas as fontes EPG configuradas
   */
  public async syncAllSources(force = false): Promise<{ success: boolean; channelsCount: number; error?: string }> {
    const now = Date.now();
    if (!force && this.lastSyncTimestamp && (now - this.lastSyncTimestamp) < this.SYNC_INTERVAL_MS && Object.keys(this.schedules).length > 0) {
      return { success: true, channelsCount: Object.keys(this.schedules).length };
    }

    if (this.isSyncing) {
      return { success: true, channelsCount: Object.keys(this.schedules).length };
    }

    this.isSyncing = true;
    try {
      console.log('[EpgSyncService] Iniciando atualização de fontes XMLTV...');
      const officialChannels = OfficialChannelProvider.getOfficialChannels();

      const downloadedPrograms = new Map<string, Array<{ start: string; stop: string; title: string; desc?: string; category?: string }>>();

      for (const src of this.sources) {
        if (!src.enabled) continue;
        const statusEntry: EpgSourceStatus = {
          id: src.id,
          name: src.name,
          url: src.url,
          accessible: false,
          lastChecked: now,
          programmesCount: 0,
          channelsMatched: 0
        };

        try {
          let text = '';
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);

          let res: Response | null = null;
          try {
            res = await fetch(src.url, { signal: controller.signal });
          } catch {
            if (src.fallbackUrl) {
              res = await fetch(src.fallbackUrl, { signal: controller.signal });
            }
          } finally {
            clearTimeout(timeout);
          }

          if (res && res.ok) {
            statusEntry.accessible = true;
            statusEntry.httpStatus = res.status;
            statusEntry.lastSuccess = now;
            text = await res.text();

            if (text && text.includes('<programme')) {
              const parsed = this.parseXmltv(text);
              statusEntry.programmesCount = parsed.totalProgrammes;
              let matchedForSource = 0;

              for (const [chId, progs] of parsed.channels.entries()) {
                downloadedPrograms.set(chId, progs);
              }

              for (const ch of officialChannels) {
                if (this.channelMatchesSource(ch, parsed.channels)) {
                  matchedForSource++;
                }
              }
              statusEntry.channelsMatched = matchedForSource;
            } else {
              statusEntry.errorMessage = 'Arquivo vazio ou sem tags de programa válidas.';
            }
          } else {
            statusEntry.httpStatus = res?.status || 0;
            statusEntry.errorMessage = `HTTP ${res?.status || 'Inacessível'} ao baixar EPG`;
          }
        } catch (err: any) {
          statusEntry.errorMessage = err.message || 'Falha de conexão com a fonte EPG';
        }

        this.sourcesStatus.set(src.id, statusEntry);
      }

      // Constrói novo mapa consolidado de programações por canal
      const newSchedules: Record<string, ChannelScheduleDays> = {};

      for (const ch of officialChannels) {
        const rawList = this.resolveProgrammesForChannel(ch, downloadedPrograms);
        if (rawList.length === 0) continue;

        const datesMap: Record<string, EpgProgramItem[]> = {};

        for (let i = 0; i < rawList.length; i++) {
          const item = rawList[i];
          const startParsed = this.parseXmltvTimestamp(item.start);
          const stopParsed = this.parseXmltvTimestamp(item.stop);
          if (!startParsed || !stopParsed) continue;

          const dateStr = this.formatBrasiliaDate(startParsed.date);
          const startTime = this.formatBrasiliaTime(startParsed.date);
          const endTime = this.formatBrasiliaTime(stopParsed.date);
          const startMinutes = Math.round(this.getBrasiliaMinutes(startParsed.date));
          let endMinutes = Math.round(this.getBrasiliaMinutes(stopParsed.date));
          if (endMinutes <= startMinutes) endMinutes += 1440;

          const durationMinutes = Math.max(5, Math.round((stopParsed.date.getTime() - startParsed.date.getTime()) / 60000));
          const sports = this.parseSportsDetails(item.title, item.desc);

          const prog: EpgProgramItem = {
            id: `${ch.id}-${dateStr}-${i}`,
            title: item.title,
            description: item.desc || undefined,
            startTime,
            endTime,
            startIso: startParsed.iso,
            endIso: stopParsed.iso,
            startUtcMs: startParsed.date.getTime(),
            endUtcMs: stopParsed.date.getTime(),
            startMinutes,
            endMinutes,
            durationMinutes,
            category: item.category || ch.groupTitle || ch.category,
            isLive: sports.isLive,
            competition: sports.competition,
            teams: sports.teams
          };

          if (!datesMap[dateStr]) datesMap[dateStr] = [];
          datesMap[dateStr].push(prog);
        }

        for (const d of Object.keys(datesMap)) {
          datesMap[d].sort((a, b) => a.startUtcMs - b.startUtcMs);
        }

        newSchedules[ch.id] = {
          channelId: ch.id,
          channelName: ch.name,
          dates: datesMap
        };
      }

      if (Object.keys(newSchedules).length > 0) {
        this.schedules = newSchedules;
        this.lastSyncTimestamp = now;
        this.persistCache();
      }

      console.log(`[EpgSyncService] Sincronização concluída: ${Object.keys(this.schedules).length} canais com EPG real.`);
      return { success: true, channelsCount: Object.keys(this.schedules).length };
    } catch (err: any) {
      console.error('[EpgSyncService] Erro ao sincronizar fontes EPG:', err);
      return { success: false, channelsCount: Object.keys(this.schedules).length, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  private persistCache(): void {
    try {
      const cacheDir = path.dirname(this.cachePath);
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

      const payload = {
        generatedAt: this.lastSyncTimestamp,
        channelsCount: Object.keys(this.schedules).length,
        schedules: this.schedules
      };
      fs.writeFileSync(this.cachePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[EpgSyncService] Não foi possível salvar data/epg_cache.json:', err.message);
    }
  }

  private channelMatchesSource(ch: any, channelsMap: Map<string, any[]>): boolean {
    const plutoMatch = ch.url?.match(/plu-([a-f0-9]+)\.m3u8/);
    if (plutoMatch && channelsMap.has(plutoMatch[1])) return true;
    if (ch.id === 'tv-brasil' && channelsMap.has('TV BRASIL')) return true;
    if (ch.id === 'tv-cultura' && channelsMap.has('TV Cultura SP_local')) return true;
    if (ch.id === 'sbt-news' && channelsMap.has('SBT News')) return true;
    if (ch.id === 'rede-brasil' && channelsMap.has('Rede Brasil HD')) return true;
    if (ch.id === 'pluto-tv-canal-uol' && channelsMap.has('Canal UOL')) return true;
    if (ch.id === 'globo-oficial' && channelsMap.has('Globo SP_local')) return true;
    if (ch.id === 'band-nacional' && channelsMap.has('Band SP_local')) return true;
    if (ch.id === 'record-tv-oficial' && channelsMap.has('Record SP_local')) return true;
    if (ch.id === 'sbt-nacional' && channelsMap.has('SBT')) return true;
    if (ch.id === 'sportv-oficial' && channelsMap.has('sportv')) return true;
    if (ch.id === 'sportv-2-oficial' && channelsMap.has('sportv-2')) return true;
    if (ch.id === 'sportv-3-oficial' && channelsMap.has('sportv-3')) return true;
    if (ch.id === 'espn-oficial' && channelsMap.has('ESPN')) return true;
    return false;
  }

  private resolveProgrammesForChannel(ch: any, map: Map<string, any[]>): any[] {
    const plutoMatch = ch.url?.match(/plu-([a-f0-9]+)\.m3u8/);
    if (plutoMatch && map.has(plutoMatch[1])) return map.get(plutoMatch[1])!;
    if (ch.id === 'tv-brasil' && map.has('TV BRASIL')) return map.get('TV BRASIL')!;
    if (ch.id === 'tv-cultura' && map.has('TV Cultura SP_local')) return map.get('TV Cultura SP_local')!;
    if (ch.id === 'sbt-news' && map.has('SBT News')) return map.get('SBT News')!;
    if (ch.id === 'rede-brasil' && map.has('Rede Brasil HD')) return map.get('Rede Brasil HD')!;
    if (ch.id === 'pluto-tv-canal-uol' && map.has('Canal UOL')) return map.get('Canal UOL')!;
    if (ch.id === 'globo-oficial' && map.has('Globo SP_local')) return map.get('Globo SP_local')!;
    if (ch.id === 'band-nacional' && map.has('Band SP_local')) return map.get('Band SP_local')!;
    if (ch.id === 'record-tv-oficial' && map.has('Record SP_local')) return map.get('Record SP_local')!;
    if (ch.id === 'sbt-nacional' && map.has('SBT')) return map.get('SBT')!;
    if (ch.id === 'sportv-oficial' && map.has('sportv')) return map.get('sportv')!;
    if (ch.id === 'sportv-2-oficial' && map.has('sportv-2')) return map.get('sportv-2')!;
    if (ch.id === 'sportv-3-oficial' && map.has('sportv-3')) return map.get('sportv-3')!;
    if (ch.id === 'espn-oficial' && map.has('ESPN')) return map.get('ESPN')!;
    return [];
  }

  private parseXmltv(xml: string): { totalProgrammes: number; channels: Map<string, any[]> } {
    const map = new Map<string, any[]>();
    const progRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/g;
    let count = 0;

    for (const match of xml.matchAll(progRegex)) {
      const attrs = match[1];
      const body = match[2];

      const chMatch = attrs.match(/channel="([^"]+)"/);
      const startMatch = attrs.match(/start="([^"]+)"/);
      const stopMatch = attrs.match(/stop="([^"]+)"/);

      if (!chMatch || !startMatch || !stopMatch) continue;

      const ch = chMatch[1];
      const start = startMatch[1];
      const stop = stopMatch[1];

      const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/);
      const descMatch = body.match(/<desc[^>]*>([^<]+)<\/desc>/);
      const catMatch = body.match(/<category[^>]*>([^<]+)<\/category>/);

      const title = titleMatch ? titleMatch[1].trim() : 'Sem título';
      const desc = descMatch ? descMatch[1].trim() : '';
      const category = catMatch ? catMatch[1].trim() : undefined;

      if (!map.has(ch)) map.set(ch, []);
      map.get(ch)!.push({ start, stop, title, desc, category });
      count++;
    }

    return { totalProgrammes: count, channels: map };
  }

  public parseXmltvTimestamp(raw: string): { iso: string; date: Date } | null {
    if (!raw) return null;
    const match = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
    if (!match) return null;
    const [_, y, m, d, h, min, s, tz] = match;
    let iso = `${y}-${m}-${d}T${h}:${min}:${s}`;
    if (tz) {
      iso += `${tz[0]}${tz.slice(1, 3)}:${tz.slice(3, 5)}`;
    } else {
      iso += '-03:00';
    }
    const date = new Date(iso);
    return isNaN(date.getTime()) ? null : { iso, date };
  }

  public formatBrasiliaTime(date: Date): string {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);
    const h = parts.find(p => p.type === 'hour')?.value || '00';
    const m = parts.find(p => p.type === 'minute')?.value || '00';
    return `${h}:${m}`;
  }

  public formatBrasiliaDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value || '2026';
    const m = parts.find(p => p.type === 'month')?.value || '10';
    const d = parts.find(p => p.type === 'day')?.value || '25';
    return `${y}-${m}-${d}`;
  }

  public getBrasiliaMinutes(date: Date): number {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    }).formatToParts(date);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const s = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
    return h * 60 + m + (s / 60);
  }

  public parseSportsDetails(title: string, desc?: string): { isLive?: boolean; competition?: string; teams?: string } {
    const full = `${title} ${desc || ''}`.toLowerCase();
    const isLive = full.includes('ao vivo') || full.includes('ao-vivo') || full.includes('live');
    const isReplay = full.includes('reprise') || full.includes(' vt ') || full.includes('melhores momentos');

    let competition: string | undefined;
    let teams: string | undefined;

    const compPatterns = [
      /brasileir[ãa]o\s*(s[ée]rie\s*[a-c])?/i,
      /copa\s*do\s*brasil/i,
      /libertadores/i,
      /sul-americana/i,
      /premier\s*league/i,
      /champions\s*league/i,
      /superliga(\s*de\s*v[ôo]lei)?/i,
      /f[óo]rmula\s*1/i,
      /nba/i,
      /nfl/i
    ];

    for (const pat of compPatterns) {
      const m = full.match(pat);
      if (m) {
        competition = m[0].toUpperCase();
        break;
      }
    }

    const matchPattern = /([A-Za-zÀ-ÖØ-öø-ÿ\s]+)\s+x\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)/i;
    const matchResult = title.match(matchPattern) || (desc && desc.match(matchPattern));
    if (matchResult) {
      teams = `${matchResult[1].trim()} x ${matchResult[2].trim()}`;
    }

    return {
      isLive: isLive && !isReplay,
      competition,
      teams
    };
  }

  public getChannelSchedule(channelId: string, dateStr?: string): EpgProgramItem[] {
    const entry = this.schedules[channelId];
    if (!entry || !entry.dates) return [];

    const targetDate = dateStr || this.formatBrasiliaDate(new Date());
    return entry.dates[targetDate] || [];
  }

  public getChannelAvailableDates(channelId: string): string[] {
    const entry = this.schedules[channelId];
    if (!entry || !entry.dates) return [];
    return Object.keys(entry.dates).sort();
  }

  public hasRealEpg(channelId: string): boolean {
    const entry = this.schedules[channelId];
    return Boolean(entry && entry.dates && Object.keys(entry.dates).length > 0);
  }

  public getAllSchedules(): Record<string, ChannelScheduleDays> {
    return this.schedules;
  }
}

export const epgSyncService = EpgSyncService.getInstance();
