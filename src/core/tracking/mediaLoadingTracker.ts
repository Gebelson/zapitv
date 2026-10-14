export type LoadingState =
  | 'LOADING_METADATA'
  | 'CHECKING_ELIGIBILITY'
  | 'RESOLVING_MEDIA_ID'
  | 'SEARCHING_SOURCES'
  | 'VALIDATING_SOURCES'
  | 'SELECTING_AUDIO'
  | 'PREPARING_PLAYER'
  | 'BUFFERING'
  | 'READY'
  | 'PLAYING'
  | 'UNAVAILABLE'
  | 'ERROR'
  | 'TIMEOUT';

export interface StepTrace {
  step: LoadingState;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  details?: Record<string, any>;
  error?: string;
}

export interface MediaLoadingTrace {
  traceId: string;
  title: string;
  canonicalId: string;
  mediaType: string;
  season?: number;
  episode?: number;
  currentStep: LoadingState;
  startedAt: number;
  endedAt?: number;
  totalDurationMs?: number;
  history: StepTrace[];
  providerAttempts: Array<{
    providerId: string;
    providerName: string;
    durationMs: number;
    success: boolean;
    streamCount: number;
    error?: string;
  }>;
  finalStatus?: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE' | 'TIMEOUT';
  errorDetails?: string;
}

class MediaLoadingTracker {
  private static instance: MediaLoadingTracker;
  private traces = new Map<string, MediaLoadingTrace>();
  private activeTraces = new Map<string, string>(); // canonicalId -> traceId
  private listeners = new Set<(trace: MediaLoadingTrace) => void>();

  public static getInstance(): MediaLoadingTracker {
    if (!MediaLoadingTracker.instance) {
      MediaLoadingTracker.instance = new MediaLoadingTracker();
    }
    return MediaLoadingTracker.instance;
  }

  public startTrace(
    canonicalId: string,
    title: string,
    mediaType: string,
    season?: number,
    episode?: number
  ): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const trace: MediaLoadingTrace = {
      traceId,
      title,
      canonicalId,
      mediaType,
      season,
      episode,
      currentStep: 'LOADING_METADATA',
      startedAt: Date.now(),
      history: [
        {
          step: 'LOADING_METADATA',
          startedAt: Date.now()
        }
      ],
      providerAttempts: []
    };

    this.traces.set(traceId, trace);
    this.activeTraces.set(canonicalId, traceId);
    this.logDebug(trace, 'INÍCIO', `Iniciando rastreamento de [${title}] (ID: ${canonicalId})`);
    this.notify(trace);
    return traceId;
  }

  public getActiveTrace(canonicalId: string): MediaLoadingTrace | undefined {
    const traceId = this.activeTraces.get(canonicalId);
    return traceId ? this.traces.get(traceId) : undefined;
  }

  public getTrace(traceId: string): MediaLoadingTrace | undefined {
    return this.traces.get(traceId);
  }

  public transition(
    traceIdOrCanonicalId: string,
    nextStep: LoadingState,
    details?: Record<string, any>,
    error?: string
  ): void {
    let trace = this.traces.get(traceIdOrCanonicalId);
    if (!trace) {
      const traceId = this.activeTraces.get(traceIdOrCanonicalId);
      if (traceId) trace = this.traces.get(traceId);
    }
    if (!trace) return;

    const now = Date.now();
    // Fecha o step anterior
    const currentStepTrace = trace.history[trace.history.length - 1];
    if (currentStepTrace && !currentStepTrace.endedAt) {
      currentStepTrace.endedAt = now;
      currentStepTrace.durationMs = now - currentStepTrace.startedAt;
    }

    // Registra novo step
    trace.currentStep = nextStep;
    trace.history.push({
      step: nextStep,
      startedAt: now,
      details,
      error
    });

    if (nextStep === 'PLAYING' || nextStep === 'READY') {
      trace.finalStatus = 'SUCCESS';
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    } else if (nextStep === 'ERROR') {
      trace.finalStatus = 'ERROR';
      trace.errorDetails = error || details?.message;
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    } else if (nextStep === 'UNAVAILABLE') {
      trace.finalStatus = 'UNAVAILABLE';
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    } else if (nextStep === 'TIMEOUT') {
      trace.finalStatus = 'TIMEOUT';
      trace.errorDetails = error || 'Operação excedeu o tempo limite configurado';
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    }

    this.logDebug(trace, nextStep, `Transição para [${nextStep}] (${currentStepTrace ? currentStepTrace.durationMs + 'ms' : '0ms'})`, details);
    this.notify(trace);
  }

  public recordProviderAttempt(
    traceIdOrCanonicalId: string,
    attempt: {
      providerId: string;
      providerName: string;
      durationMs: number;
      success: boolean;
      streamCount: number;
      error?: string;
    }
  ): void {
    let trace = this.traces.get(traceIdOrCanonicalId);
    if (!trace) {
      const traceId = this.activeTraces.get(traceIdOrCanonicalId);
      if (traceId) trace = this.traces.get(traceId);
    }
    if (!trace) return;

    trace.providerAttempts.push(attempt);
    this.notify(trace);
  }

  public endTrace(traceIdOrCanonicalId: string, status?: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE' | 'TIMEOUT'): void {
    let trace = this.traces.get(traceIdOrCanonicalId);
    if (!trace) {
      const traceId = this.activeTraces.get(traceIdOrCanonicalId);
      if (traceId) trace = this.traces.get(traceId);
    }
    if (!trace) return;

    const now = Date.now();
    if (!trace.endedAt) {
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    }
    if (status) trace.finalStatus = status;

    const lastStep = trace.history[trace.history.length - 1];
    if (lastStep && !lastStep.endedAt) {
      lastStep.endedAt = now;
      lastStep.durationMs = now - lastStep.startedAt;
    }

    this.activeTraces.delete(trace.canonicalId);
    this.logDebug(trace, 'FINALIZADO', `Trace encerrado com status [${trace.finalStatus || 'CONCLUÍDO'}] em ${trace.totalDurationMs}ms`);
    this.notify(trace);
  }

  private logDebug(trace: MediaLoadingTrace, step: string, msg: string, details?: any) {
    if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
      const epStr = trace.episode ? ` S${trace.season || 1}E${trace.episode}` : '';
      console.log(
        `%c[ZapiTV-Tracker]%c [${trace.title}${epStr}] ${step}: ${msg}`,
        'background: #ff5500; color: white; padding: 2px 4px; border-radius: 4px; font-weight: bold;',
        'color: #38bdf8;',
        details || ''
      );
    }
  }

  public subscribe(listener: (trace: MediaLoadingTrace) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(trace: MediaLoadingTrace) {
    for (const listener of this.listeners) {
      try {
        listener(trace);
      } catch {}
    }
  }

  public getRecentTraces(limit = 20): MediaLoadingTrace[] {
    return Array.from(this.traces.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }
}

export const mediaLoadingTracker = MediaLoadingTracker.getInstance();
