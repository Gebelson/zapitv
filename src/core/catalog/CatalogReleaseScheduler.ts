/**
 * ZapiTV - CatalogReleaseScheduler
 * Agendador diário no backend para descoberta e atualização automática de lançamentos.
 * 
 * Horário padrão: Diariamente às 06:00 UTC (03:00 Horário de Brasília).
 */

import { autoReleaseService, AutoReleaseSyncResult } from './AutoReleaseService';

export interface ReleaseSchedulerStatus {
  isRunning: boolean;
  targetHourUTC: number;
  nextRunDate: string;
  nextRunTimestamp: number;
  lastRunTimestamp: number | null;
  lastRunResult: AutoReleaseSyncResult | null;
}

export class CatalogReleaseScheduler {
  private static instance: CatalogReleaseScheduler;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private targetHourUTC = 6; // 06:00 UTC (03:00 BRT)
  private lastRunTimestamp: number | null = null;
  private lastRunResult: AutoReleaseSyncResult | null = null;

  private constructor() {
    if (process.env.RELEASE_SCHEDULE_HOUR_UTC) {
      const parsed = parseInt(process.env.RELEASE_SCHEDULE_HOUR_UTC, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
        this.targetHourUTC = parsed;
      }
    }
  }

  public static getInstance(): CatalogReleaseScheduler {
    if (!CatalogReleaseScheduler.instance) {
      CatalogReleaseScheduler.instance = new CatalogReleaseScheduler();
    }
    return CatalogReleaseScheduler.instance;
  }

  /**
   * Inicia o agendador diário em segundo plano
   */
  public start(runSync: () => Promise<AutoReleaseSyncResult> = () => this.executeManualSync()): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[CatalogReleaseScheduler] Agendador diário ativado. Horário padrão: ${this.targetHourUTC}:00 UTC.`);

    // Checa a cada 30 minutos se o momento de disparo diário chegou
    this.timer = setInterval(() => {
      this.checkAndExecuteScheduledRun(runSync);
    }, 30 * 60 * 1000);

    // Avalia também na inicialização
    this.checkAndExecuteScheduledRun(runSync);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  public getNextRunDate(from: Date = new Date()): Date {
    const d = new Date(from.getTime());
    const currentHour = d.getUTCHours();
    const currentMin = d.getUTCMinutes();

    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), this.targetHourUTC, 0, 0, 0));
    if (currentHour > this.targetHourUTC || (currentHour === this.targetHourUTC && currentMin > 0)) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  public async checkAndExecuteScheduledRun(runSync: () => Promise<AutoReleaseSyncResult> = () => this.executeManualSync()): Promise<void> {
    const now = Date.now();
    const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;

    // Se já rodou nas últimas 20 horas, não executa novamente no mesmo dia
    if (this.lastRunTimestamp && (now - this.lastRunTimestamp) < TWENTY_HOURS_MS) {
      return;
    }

    const currentUtcHour = new Date().getUTCHours();
    if (currentUtcHour === this.targetHourUTC) {
      await runSync();
    }
  }

  public async executeManualSync(): Promise<AutoReleaseSyncResult> {
    console.log('[CatalogReleaseScheduler] Executando sincronização de lançamentos...');
    const result = await autoReleaseService.runDailyReleaseSync();
    this.lastRunTimestamp = Date.now();
    this.lastRunResult = result;
    return result;
  }

  public getStatus(): ReleaseSchedulerStatus {
    const nextDate = this.getNextRunDate();
    return {
      isRunning: this.isRunning,
      targetHourUTC: this.targetHourUTC,
      nextRunDate: nextDate.toISOString(),
      nextRunTimestamp: nextDate.getTime(),
      lastRunTimestamp: this.lastRunTimestamp,
      lastRunResult: this.lastRunResult
    };
  }
}

export const catalogReleaseScheduler = CatalogReleaseScheduler.getInstance();
