/**
 * ZAPITV — WEEKLY FEATURED SCHEDULER (BACKEND TASK RUNNER)
 * 
 * Tarefa agendada no backend para verificar e atualizar os rankings do
 * Em Destaque uma vez por semana.
 * 
 * Horário Padrão Configurável: Toda segunda-feira, às 6h, horário de Brasília (09:00 UTC).
 */

import { featuredRankingService } from './FeaturedRankingService';

export interface SchedulerStatus {
  isRunning: boolean;
  targetDayOfWeek: number;      // 1 = Segunda-feira
  targetHourBRT: number;        // 6 = 06:00 BRT
  nextRunDate: string;
  nextRunTimestamp: number;
  lastRunTimestamp: number | null;
  lastRunStatus: string | null;
}

export class WeeklyFeaturedScheduler {
  private static instance: WeeklyFeaturedScheduler;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private targetDayOfWeek = 1;  // Segunda-feira (0 = Domingo, 1 = Segunda)
  private targetHourBRT = 6;    // 06:00 Horário de Brasília (UTC-3 -> 09:00 UTC)
  private lastRunTimestamp: number | null = null;
  private lastRunStatus: string | null = null;

  private constructor() {
    if (process.env.FEATURED_SCHEDULE_DAY) {
      const parsedDay = parseInt(process.env.FEATURED_SCHEDULE_DAY, 10);
      if (!isNaN(parsedDay) && parsedDay >= 0 && parsedDay <= 6) {
        this.targetDayOfWeek = parsedDay;
      }
    }
    if (process.env.FEATURED_SCHEDULE_HOUR_BRT) {
      const parsedHour = parseInt(process.env.FEATURED_SCHEDULE_HOUR_BRT, 10);
      if (!isNaN(parsedHour) && parsedHour >= 0 && parsedHour <= 23) {
        this.targetHourBRT = parsedHour;
      }
    }
  }

  public static getInstance(): WeeklyFeaturedScheduler {
    if (!WeeklyFeaturedScheduler.instance) {
      WeeklyFeaturedScheduler.instance = new WeeklyFeaturedScheduler();
    }
    return WeeklyFeaturedScheduler.instance;
  }

  /**
   * Inicia o agendador semanal em segundo plano
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(
      `[WeeklyFeaturedScheduler] Agendador semanal ativado. Horário padrão: Segunda-feira às ${this.targetHourBRT}h BRT (09:00 UTC).`
    );

    // Agenda checagem periódica a cada 15 minutos para avaliar se o momento de disparo chegou
    this.timer = setInterval(() => {
      this.checkAndExecuteScheduledRun();
    }, 15 * 60 * 1000);

    // Avalia também na inicialização
    this.checkAndExecuteScheduledRun();
  }

  /**
   * Para o agendador
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  /**
   * Calcula a data/hora da próxima execução semanal em UTC
   */
  public getNextRunDate(from: Date = new Date()): Date {
    const targetUtcHour = (this.targetHourBRT + 3) % 24; // Converte BRT (UTC-3) para UTC
    const d = new Date(from.getTime());
    const currentDay = d.getUTCDay();
    const currentHour = d.getUTCHours();
    const currentMinute = d.getUTCMinutes();

    let daysUntilTarget = (this.targetDayOfWeek - currentDay + 7) % 7;
    if (daysUntilTarget === 0) {
      if (currentHour > targetUtcHour || (currentHour === targetUtcHour && currentMinute > 0)) {
        daysUntilTarget = 7;
      }
    }

    const next = new Date(d.getTime());
    next.setUTCDate(d.getUTCDate() + daysUntilTarget);
    next.setUTCHours(targetUtcHour, 0, 0, 0);
    return next;
  }

  /**
   * Verifica se o momento de execução da semana chegou e dispara atomicamente
   */
  public async checkAndExecuteScheduledRun(force = false): Promise<boolean> {
    const now = new Date();
    const targetUtcHour = (this.targetHourBRT + 3) % 24;

    const isTargetDay = now.getUTCDay() === this.targetDayOfWeek;
    const isTargetHour = now.getUTCHours() === targetUtcHour;

    // Evita executar duas vezes na mesma hora
    const oneHourMs = 60 * 60 * 1000;
    const alreadyRunRecently = this.lastRunTimestamp && (now.getTime() - this.lastRunTimestamp) < oneHourMs;

    if (force || (isTargetDay && isTargetHour && !alreadyRunRecently)) {
      console.log(`[WeeklyFeaturedScheduler] Disparando atualização semanal do Em Destaque...`);
      try {
        const result = await featuredRankingService.runWeeklyScheduledUpdate({ force });
        this.lastRunTimestamp = Date.now();
        this.lastRunStatus = `Sucesso: ${result.weekLabel} (${result.featuredMovies.length} filmes, ${result.featuredSeries.length} séries)`;
        console.log(`[WeeklyFeaturedScheduler] ${this.lastRunStatus}`);
        return true;
      } catch (err: any) {
        this.lastRunStatus = `Erro: ${err?.message || 'Falha ao atualizar'}`;
        console.error(`[WeeklyFeaturedScheduler] Falha na execução semanal:`, err);
        return false;
      }
    }

    return false;
  }

  /**
   * Força uma execução manual imediata
   */
  public async triggerManualRun(): Promise<any> {
    return this.checkAndExecuteScheduledRun(true);
  }

  /**
   * Retorna o status do agendador para o painel administrativo
   */
  public getStatus(): SchedulerStatus {
    const nextDate = this.getNextRunDate();
    return {
      isRunning: this.isRunning,
      targetDayOfWeek: this.targetDayOfWeek,
      targetHourBRT: this.targetHourBRT,
      nextRunDate: featuredRankingService.formatNextScheduledRun(nextDate),
      nextRunTimestamp: nextDate.getTime(),
      lastRunTimestamp: this.lastRunTimestamp,
      lastRunStatus: this.lastRunStatus
    };
  }
}

export const weeklyFeaturedScheduler = WeeklyFeaturedScheduler.getInstance();
