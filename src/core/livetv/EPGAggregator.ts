import { LiveChannel, EpgProgram, CurrentEpgState } from './types';
import { EPG_SEED_SNAPSHOT, ChannelScheduleDays, EpgProgramItem } from './epgSeedSnapshot';

export interface EpgDateOption {
  dateStr: string; // YYYY-MM-DD
  label: string;   // 'Hoje', 'Amanhã', 'Segunda-feira', etc.
  offset: number;
}

export class EPGAggregator {
  private static instance: EPGAggregator;
  private schedules: Record<string, ChannelScheduleDays> = {};
  private fetchedChannels = new Set<string>();
  private isClient = typeof window !== 'undefined';

  public static getInstance(): EPGAggregator {
    if (!EPGAggregator.instance) {
      EPGAggregator.instance = new EPGAggregator();
    }
    return EPGAggregator.instance;
  }

  private constructor() {
    // Inicialização instantânea (0ms) a partir do snapshot verificado das fontes XMLTV
    this.schedules = { ...EPG_SEED_SNAPSHOT };
    if (this.isClient) {
      this.rehydrateFromLocalStorage();
    }
  }

  private rehydrateFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem('zapitv_epg_cache_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.schedules = { ...this.schedules, ...parsed };
        }
      }
    } catch {}
  }

  private persistToLocalStorage(): void {
    if (!this.isClient) return;
    try {
      localStorage.setItem('zapitv_epg_cache_v2', JSON.stringify(this.schedules));
    } catch {}
  }

  /**
   * Data atual formatada em YYYY-MM-DD no fuso horário oficial de Brasília
   */
  public getBrasiliaDateString(date = new Date()): string {
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

  /**
   * Minutos decorridos hoje no fuso horário oficial do Brasil (America/Sao_Paulo - UTC-3)
   */
  public getCurrentBrazilMinutes(): number {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

    return hour * 60 + minute + (second / 60);
  }

  /**
   * Verifica se o canal possui grade de programação real confirmada
   */
  public hasRealEpg(channelId: string): boolean {
    const entry = this.schedules[channelId];
    return Boolean(entry && entry.dates && Object.keys(entry.dates).length > 0);
  }

  /**
   * Obtém as datas disponíveis com programação confirmada para o canal (removendo dias passados)
   */
  public getAvailableDates(channel: LiveChannel): EpgDateOption[] {
    const entry = this.schedules[channel.id] || this.schedules[channel.canonicalId || ''];
    const todayStr = this.getBrasiliaDateString();
    if (!entry || !entry.dates) {
      return [{ dateStr: todayStr, label: 'Hoje', offset: 0 }];
    }

    // Filtra hoje e datas futuras (remove datas passadas/expiradas)
    let availableDateStrings = Object.keys(entry.dates).filter(d => d >= todayStr).sort();
    if (availableDateStrings.length === 0) {
      // Se a fonte contiver apenas datas anteriores, mantém as mais recentes
      availableDateStrings = Object.keys(entry.dates).sort().slice(-2);
    }

    if (availableDateStrings.length === 0) {
      return [{ dateStr: todayStr, label: 'Hoje', offset: 0 }];
    }

    // Se tiver apenas hoje disponível, projeta amanhã para navegação contínua no guia de TV
    if (availableDateStrings.length === 1) {
      try {
        const [y, m, d] = availableDateStrings[0].split('-').map(Number);
        const nextDt = new Date(Date.UTC(y, m - 1, d + 1));
        const nextStr = nextDt.toISOString().split('T')[0];
        if (!availableDateStrings.includes(nextStr)) {
          availableDateStrings.push(nextStr);
        }
      } catch {}
    }

    const todayIndex = availableDateStrings.indexOf(todayStr);

    return availableDateStrings.map((dStr) => {
      let label = dStr;
      if (dStr === todayStr) {
        label = 'Hoje';
      } else {
        try {
          const [y, m, d] = dStr.split('-').map(Number);
          const dt = new Date(y, m - 1, d);
          const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).format(dt);
          label = `${weekday}, ${d}/${m}`;
        } catch {}
      }

      const diffDays = todayIndex !== -1 ? availableDateStrings.indexOf(dStr) - todayIndex : 0;
      return {
        dateStr: dStr,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        offset: diffDays
      };
    });
  }

  /**
   * Obtém a grade completa do dia para o canal especificado
   */
  public getDailySchedule(channel: LiveChannel, dateOffset = 0): EpgProgram[] {
    // 1. Se o canal já possuir programas carregados dinamicamente no objeto
    if (channel.programs && channel.programs.length > 0 && dateOffset === 0) {
      return channel.programs;
    }

    const entry = this.schedules[channel.id] || this.schedules[channel.canonicalId || ''];
    if (!entry || !entry.dates) {
      return [this.createUnavailableFallback(channel)];
    }

    const todayStr = this.getBrasiliaDateString();
    const availableDates = Object.keys(entry.dates).filter(d => d >= todayStr).sort();
    const fallbackDates = Object.keys(entry.dates).sort();

    let targetDate = todayStr;
    if (availableDates.length > 0) {
      if (dateOffset < availableDates.length) {
        targetDate = availableDates[dateOffset];
      } else {
        targetDate = availableDates[availableDates.length - 1];
      }
    } else if (fallbackDates.length > 0) {
      targetDate = fallbackDates[fallbackDates.length - 1];
    }

    let list = entry.dates[targetDate];
    if ((!list || list.length === 0) && availableDates.length > 0) {
      list = entry.dates[availableDates[0]];
    }

    if (!list || list.length === 0) {
      return [this.createUnavailableFallback(channel)];
    }

    return list.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      startTime: item.startTime,
      endTime: item.endTime,
      startMinutes: item.startMinutes,
      endMinutes: item.endMinutes,
      category: item.category || channel.categoryLabel,
      isLive: item.isLive,
      competition: item.competition,
      teams: item.teams,
      startUtcMs: item.startUtcMs,
      endUtcMs: item.endUtcMs,
      durationMinutes: item.durationMinutes
    }));
  }

  private createUnavailableFallback(channel: LiveChannel): EpgProgram {
    return {
      id: `${channel.id}-unavailable`,
      title: 'Programação não disponível',
      description: 'Informações de grade não fornecidas pela emissora.',
      startTime: '--:--',
      endTime: '--:--',
      startMinutes: 0,
      endMinutes: 1440,
      category: channel.categoryLabel,
      isFallback: true
    };
  }

  /**
   * Calcula o estado EPG em tempo real com dados reais no fuso America/Sao_Paulo
   */
  public getCurrentEpgState(channel: LiveChannel): CurrentEpgState {
    const hasReal = this.hasRealEpg(channel.id) || this.hasRealEpg(channel.canonicalId || '') || Boolean(channel.programs && channel.programs.length > 0);

    if (!hasReal) {
      const fallbackProg = this.createUnavailableFallback(channel);
      return {
        currentProgram: fallbackProg,
        nextProgram: undefined,
        progressPercent: 0,
        elapsedMinutes: 0,
        remainingMinutes: 0,
        formattedStartTime: '--:--',
        formattedEndTime: '--:--',
        hasVerifiedSchedule: false
      };
    }

    const schedule = this.getDailySchedule(channel, 0);
    if (!schedule || schedule.length === 0 || schedule[0].isFallback) {
      const fallbackProg = this.createUnavailableFallback(channel);
      return {
        currentProgram: fallbackProg,
        nextProgram: undefined,
        progressPercent: 0,
        elapsedMinutes: 0,
        remainingMinutes: 0,
        formattedStartTime: '--:--',
        formattedEndTime: '--:--',
        hasVerifiedSchedule: false
      };
    }

    const nowUtc = Date.now();
    const nowMinutes = this.getCurrentBrazilMinutes();

    let currentIdx = -1;

    // 1. Tenta correspondência precisa por timestamp UTC se disponível
    for (let i = 0; i < schedule.length; i++) {
      const p = schedule[i];
      if (p.startUtcMs && p.endUtcMs) {
        if (p.startUtcMs <= nowUtc && nowUtc < p.endUtcMs) {
          currentIdx = i;
          break;
        }
      }
    }

    // 2. Se não encontrou por UTC ou não possui UTC, usa minutos de Brasília
    if (currentIdx === -1) {
      for (let i = 0; i < schedule.length; i++) {
        const p = schedule[i];
        if (p.startMinutes <= nowMinutes && nowMinutes < p.endMinutes) {
          currentIdx = i;
          break;
        }
        if (p.endMinutes > 1440 && (nowMinutes < (p.endMinutes - 1440) || nowMinutes >= p.startMinutes)) {
          currentIdx = i;
          break;
        }
      }
    }

    // 3. Fallback inteligente para o programa mais próximo do horário atual
    if (currentIdx === -1) {
      let minDiff = Infinity;
      for (let i = 0; i < schedule.length; i++) {
        const diff = Math.abs(schedule[i].startMinutes - nowMinutes);
        if (diff < minDiff) {
          minDiff = diff;
          currentIdx = i;
        }
      }
    }

    if (currentIdx === -1) currentIdx = 0;

    const currentProgram = schedule[currentIdx] || schedule[0];
    const nextProgram = schedule[(currentIdx + 1) % schedule.length];

    let totalDuration = currentProgram.durationMinutes || (currentProgram.endMinutes - currentProgram.startMinutes);
    if (totalDuration <= 0) totalDuration = 60;

    let elapsed = 0;
    if (currentProgram.startUtcMs && currentProgram.endUtcMs && nowUtc >= currentProgram.startUtcMs) {
      elapsed = Math.max(0, Math.floor((nowUtc - currentProgram.startUtcMs) / 60000));
    } else {
      elapsed = nowMinutes - currentProgram.startMinutes;
      if (elapsed < 0) elapsed += 1440;
    }

    const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const remaining = Math.max(0, totalDuration - elapsed);

    return {
      currentProgram,
      nextProgram: nextProgram && nextProgram.id !== currentProgram.id ? nextProgram : undefined,
      progressPercent: Math.round(progressPercent),
      elapsedMinutes: Math.floor(elapsed),
      remainingMinutes: Math.ceil(remaining),
      formattedStartTime: currentProgram.startTime,
      formattedEndTime: currentProgram.endTime,
      hasVerifiedSchedule: true
    };
  }

  /**
   * Atualiza ou injeta grade confirmada para um canal
   */
  public updateChannelSchedule(channelId: string, days: ChannelScheduleDays): void {
    this.schedules[channelId] = days;
    this.persistToLocalStorage();
  }

  /**
   * Busca e atualiza a programação real do servidor assincronamente (em segundo plano)
   */
  public async fetchServerEpg(channelId?: string): Promise<void> {
    if (!this.isClient) return;
    try {
      const url = channelId ? `/api/livetv/epg/${channelId}` : '/api/livetv/epg';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (channelId && data && data.dates) {
          this.schedules[channelId] = data;
        } else if (!channelId && data && typeof data === 'object') {
          this.schedules = { ...this.schedules, ...data };
        }
        this.persistToLocalStorage();
      }
    } catch {}
  }
}

export const epgAggregator = EPGAggregator.getInstance();
