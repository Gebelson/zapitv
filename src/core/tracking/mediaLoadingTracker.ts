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

export type PlaybackEvent =
  | 'MEDIA_SELECTED' | 'CANONICAL_ID_RESOLVED' | 'DISCOVERY_STARTED'
  | 'ADDON_RESPONSE_RECEIVED' | 'SOURCES_NORMALIZED' | 'CANDIDATES_FILTERED'
  | 'SOURCE_VALIDATION' | 'SOURCE_SELECTED' | 'PLAYER_INITIALIZED'
  | 'MANIFEST_OR_METADATA_LOADED' | 'INTRO_COMPLETED' | 'CONTENT_PLAYING'
  | 'PLAYBACK_CONFIRMED' | 'PLAYBACK_FAILED';

export type PlaybackErrorCode =
  | 'SOURCE_DISCOVERY_FAILED' | 'NO_CANDIDATES' | 'SOURCE_VALIDATION_INCONCLUSIVE'
  | 'AUTH_REQUIRED' | 'SOURCE_UNSUPPORTED' | 'MEDIA_NETWORK_ERROR'
  | 'MEDIA_DECODE_ERROR' | 'MANIFEST_ERROR' | 'PLAYBACK_START_FAILED'
  | 'PLAYBACK_TIMEOUT' | 'SOURCE_EXPIRED' | 'PLAYER_RUNTIME_ERROR';

export interface PlaybackEventTrace {
  event: PlaybackEvent;
  at: number;
  durationMs: number;
  service: string;
  result: 'STARTED' | 'OK' | 'FAILED' | 'INCONCLUSIVE';
  previous?: PlaybackEvent;
  next?: PlaybackEvent;
  errorCode?: PlaybackErrorCode;
  reason?: string;
  details?: Record<string, string | number | boolean>;
}

// Never persist or expose stream URLs, query strings, signed tokens, or credentials.
const SAFE_DETAIL_KEYS = new Set([
  'streamCount', 'rawStreamCount', 'cleanStreamsCount', 'providerCount',
  'durationMs', 'season', 'episode', 'quality', 'navType', 'prefetched',
  'progressive', 'stremioType', 'hasExternalPtSub', 'mediaSeconds', 'frames',
]);
export function sanitizePlaybackReason(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.replace(/(?:https?:\/\/|magnet:\?)[^\s)]+/gi, '[redacted-url]')
    .replace(/(token|key|secret|signature|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, 160);
}
export function classifyPlaybackError(reason: string, nativeMediaCode?: number): PlaybackErrorCode {
  if (nativeMediaCode === 2) return 'MEDIA_NETWORK_ERROR';
  if (nativeMediaCode === 3) return 'MEDIA_DECODE_ERROR';
  if (nativeMediaCode === 4) return 'SOURCE_UNSUPPORTED';
  if (/HTTP\s*40[13]|autentica|acesso negado/i.test(reason)) return 'AUTH_REQUIRED';
  if (/manifest|m3u8|playlist/i.test(reason)) return 'MANIFEST_ERROR';
  if (/tempo limite|timeout/i.test(reason)) return 'PLAYBACK_TIMEOUT';
  if (/decodific|codec/i.test(reason)) return 'MEDIA_DECODE_ERROR';
  if (/rede|network|fetch|cors/i.test(reason)) return 'MEDIA_NETWORK_ERROR';
  if (/incompatível|não corresponde|bloquead|isolada|blacklist/i.test(reason)) return 'SOURCE_UNSUPPORTED';
  return 'PLAYER_RUNTIME_ERROR';
}
function safeDetails(details?: Record<string, unknown>): Record<string, string | number | boolean> | undefined {
  if (!details) return undefined;
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(details)) {
    if (!SAFE_DETAIL_KEYS.has(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === 'boolean') safe[key] = value;
    else if (typeof value === 'string') safe[key] = sanitizePlaybackReason(value) || '';
  }
  return Object.keys(safe).length ? safe : undefined;
}

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
  events: PlaybackEventTrace[];
  providerAttempts: Array<{
    providerId: string;
    providerName: string;
    durationMs: number;
    success: boolean;
    streamCount: number;
    error?: string;
  }>;
  finalStatus?: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE' | 'TIMEOUT' | 'CANCELLED';
  errorDetails?: string;
  errorCode?: PlaybackErrorCode;
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
    const prior = this.getActiveTrace(canonicalId);
    if (prior && !prior.endedAt) this.endTrace(prior.traceId, 'CANCELLED');
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
      events: [],
      providerAttempts: []
    };

    this.traces.set(traceId, trace);
    if (this.traces.size > 40) {
      const oldest = this.traces.keys().next().value;
      if (oldest) this.traces.delete(oldest);
    }
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

  public recordEvent(
    traceIdOrCanonicalId: string, event: PlaybackEvent,
    service: string, result: PlaybackEventTrace['result'] = 'OK',
    details?: Record<string, unknown>, errorCode?: PlaybackErrorCode, reason?: string
  ): void {
    const trace = this.traces.get(traceIdOrCanonicalId) || this.getActiveTrace(traceIdOrCanonicalId);
    if (!trace || trace.endedAt) return;
    const now = Date.now();
    const previous = trace.events[trace.events.length - 1];
    if (previous?.event === event && previous.result === result && previous.service === service) return;
    if (previous) previous.next = event;
    trace.events.push({ event, at: now, durationMs: now - (previous?.at || trace.startedAt),
      service, result, previous: previous?.event, details: safeDetails(details),
      errorCode, reason: sanitizePlaybackReason(reason) });
    if (trace.events.length > 50) trace.events.shift();
    if (event === 'PLAYBACK_CONFIRMED') this.endTrace(trace.traceId, 'SUCCESS');
    else if (event === 'PLAYBACK_FAILED') {
      trace.errorCode = errorCode || 'PLAYER_RUNTIME_ERROR';
      trace.errorDetails = sanitizePlaybackReason(reason);
      this.endTrace(trace.traceId, 'ERROR');
    } else this.notify(trace);
  }

  public getDiagnostic(traceIdOrCanonicalId: string): { traceId?: string; stage?: PlaybackEvent; errorCode?: PlaybackErrorCode; reason?: string } {
    const trace = this.traces.get(traceIdOrCanonicalId) || this.getActiveTrace(traceIdOrCanonicalId);
    if (!trace) return {};
    return { traceId: trace.traceId, stage: trace.events[trace.events.length - 1]?.event,
      errorCode: trace.errorCode, reason: trace.errorDetails };
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
    if (trace.endedAt) return;

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
      details: safeDetails(details),
      error: sanitizePlaybackReason(error)
    });

    if (nextStep === 'SEARCHING_SOURCES') this.recordEvent(trace.traceId, 'DISCOVERY_STARTED', 'providerRegistry', 'STARTED');
    if (nextStep === 'VALIDATING_SOURCES') this.recordEvent(trace.traceId, 'SOURCES_NORMALIZED', 'providerRegistry', 'OK', details);
    if (nextStep === 'SELECTING_AUDIO') this.recordEvent(trace.traceId, 'CANDIDATES_FILTERED', 'providerRegistry', 'OK', details);

    if (nextStep === 'ERROR') {
      trace.finalStatus = 'ERROR';
      trace.errorDetails = sanitizePlaybackReason(error || details?.message || details?.reason);
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    } else if (nextStep === 'UNAVAILABLE') {
      trace.finalStatus = 'UNAVAILABLE';
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    } else if (nextStep === 'TIMEOUT') {
      trace.finalStatus = 'TIMEOUT';
      trace.errorDetails = sanitizePlaybackReason(error || 'Operação excedeu o tempo limite configurado');
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    }

    this.logDebug(trace, nextStep, `Transição para [${nextStep}] (${currentStepTrace ? currentStepTrace.durationMs + 'ms' : '0ms'})`, safeDetails(details));
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

    trace.providerAttempts.push({ ...attempt, error: sanitizePlaybackReason(attempt.error) });
    this.recordEvent(trace.traceId, 'ADDON_RESPONSE_RECEIVED', attempt.providerId,
      attempt.success ? 'OK' : 'FAILED', { streamCount: attempt.streamCount, durationMs: attempt.durationMs },
      attempt.success ? undefined : 'SOURCE_DISCOVERY_FAILED', attempt.error);
    this.notify(trace);
  }

  public endTrace(traceIdOrCanonicalId: string, status?: 'SUCCESS' | 'ERROR' | 'UNAVAILABLE' | 'TIMEOUT' | 'CANCELLED'): void {
    let trace = this.traces.get(traceIdOrCanonicalId);
    if (!trace) {
      const traceId = this.activeTraces.get(traceIdOrCanonicalId);
      if (traceId) trace = this.traces.get(traceId);
    }
    if (!trace) return;
    if (trace.endedAt) return;

    const now = Date.now();
    if (!trace.endedAt) {
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    }
    if (status && !trace.finalStatus &&
        (status !== 'SUCCESS' || trace.events.some(event => event.event === 'PLAYBACK_CONFIRMED'))) {
      trace.finalStatus = status;
    }

    const lastStep = trace.history[trace.history.length - 1];
    if (lastStep && !lastStep.endedAt) {
      lastStep.endedAt = now;
      lastStep.durationMs = now - lastStep.startedAt;
    }

    if (this.activeTraces.get(trace.canonicalId) === trace.traceId) this.activeTraces.delete(trace.canonicalId);
    this.logDebug(trace, 'FINALIZADO', `Trace encerrado com status [${trace.finalStatus || 'CONCLUÍDO'}] em ${trace.totalDurationMs}ms`);
    this.notify(trace);
  }

  private logDebug(trace: MediaLoadingTrace, step: string, msg: string, details?: any) {
    if (process.env.NODE_ENV !== 'production') {
      const epStr = trace.episode ? ` S${trace.season || 1}E${trace.episode}` : '';
      console.log(
        `%c[ZapiTV-Tracker]%c [${trace.title}${epStr}] ${step}: ${msg}`,
        'background: #ff5500; color: white; padding: 2px 4px; border-radius: 4px; font-weight: bold;',
        'color: #38bdf8;',
        safeDetails(details) || ''
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
