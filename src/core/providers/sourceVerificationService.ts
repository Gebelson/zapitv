import { StremioStream } from '../stremio/stremioTypes';
import { ContentItem, ContentType } from '../../../types';
import { providerRegistry, ProviderConfig } from './providerRegistry';
import { tmdbService } from '../tmdb/tmdbClient';
import { canonicalIdentityService } from '../identity/canonicalIdentity';
import { streamValidator } from './streamValidator';
import { sourceSelectionService } from '../selection/sourceSelectionService';
import { isSourcePlayableHere } from './sourceReadiness';

export type VerificationState =
  | 'IDLE'
  | 'SEARCHING'       // Primeira verificação em andamento
  | 'RETRYING'        // Segunda verificação automática em andamento
  | 'AVAILABLE'       // Fonte válida e reproduzível confirmada
  | 'UNAVAILABLE'     // Ausência comprovada em todos os provedores elegíveis consultados
  | 'INCONCLUSIVE'    // Falhas de rede, limites ou timeouts impediram verificação conclusiva
  | 'PLAYBACK_ERROR'; // Fonte encontrada falhou na reprodução

export interface ProviderAttemptDetail {
  providerId: string;
  providerName: string;
  durationMs: number;
  success: boolean;
  streamCount: number;
  isTimeout?: boolean;
  error?: string;
}

export interface VerificationDiagnosticLog {
  contentTitle: string;
  canonicalId: string;
  season?: number;
  episode?: number;
  eligibleProviders: string[];
  queryOrder: string[];
  queriedProviders: string[];
  ignoredProviders: { id: string; name: string; reason: string }[];
  returnedStreamsCount: number;
  approvedStreamsCount: number;
  rejectedStreams: { title: string; providerId?: string; reason: string }[];
  timeouts: string[];
  networkErrors: { providerId: string; error: string }[];
  phase1DurationMs: number;
  phase2DurationMs?: number;
  totalDurationMs: number;
  finalState: VerificationState;
  inconclusiveReason?: string;
  timestamp: string;
}

export interface VerifySourcesOptions {
  signal?: AbortSignal;
  onStateChange?: (state: VerificationState, message?: string) => void;
  onProgressiveStreams?: (streams: StremioStream[]) => void;
  forceRefresh?: boolean;
  bypassNegativeCache?: boolean;
}

export interface VerificationResult {
  state: VerificationState;
  streams: StremioStream[];
  errorMessage?: string;
  diagnosticLog: VerificationDiagnosticLog;
}

export const MSG_INCONCLUSIVE = 'Não foi possível verificar a disponibilidade agora. Tente novamente.';
export const MSG_UNAVAILABLE = 'Conteúdo indisponível no momento. Não foi possível encontrar uma fonte verificada agora. Tente novamente.';

class SourceVerificationService {
  private diagnosticLogs: VerificationDiagnosticLog[] = [];
  private lastLog: VerificationDiagnosticLog | null = null;
  private readonly MAX_LOG_HISTORY = 50;

  /**
   * Executa o Sistema Inteligente de Verificação Dupla de Fontes:
   * 1. Primeira verificação em paralelo com emissão progressiva e interrupção rápida no primeiro stream válido.
   * 2. Segunda verificação automática OBRIGATÓRIA caso a primeira termine sem fontes reproduzíveis.
   * 3. Diferenciação rigorosa entre UNAVAILABLE (ausência comprovada) e INCONCLUSIVE (falha de rede/timeout).
   */
  public async verifySources(
    item: ContentItem,
    episode?: { season: number; episode: number },
    options?: VerifySourcesOptions
  ): Promise<VerificationResult> {
    const overallStart = Date.now();
    const targetTitle = (item.title || item.originalTitle || (item as any).name || 'Conteúdo').trim();
    const isMovie = item.mediaFormat === 'movie' || item.type === ContentType.MOVIE;
    const streamType: 'movie' | 'series' | 'anime' = isMovie
      ? 'movie'
      : (item.type === ContentType.ANIME ? 'anime' : 'series');

    // 1. Identificar todos os provedores habilitados e ordenados pela prioridade configurada
    const allProviders = providerRegistry.getProviders();
    const eligibleProviders = allProviders.filter(p => p.enabled);
    const ignoredProviders = allProviders
      .filter(p => !p.enabled)
      .map(p => ({ id: p.id, name: p.name, reason: 'Desabilitado na configuração de provedores' }));

    // Ordem de consulta pela prioridade configurada (1, 2, 3...)
    const queryOrder = eligibleProviders.map(p => `${p.name} (P${p.priority})`);
    const latestProviderOutcome = new Map<string, boolean>();

    const diagnostic: VerificationDiagnosticLog = {
      contentTitle: targetTitle,
      canonicalId: item.id || item.imdbId || String(item.tmdbId || ''),
      season: episode?.season,
      episode: episode?.episode,
      eligibleProviders: eligibleProviders.map(p => p.id),
      queryOrder,
      queriedProviders: [],
      ignoredProviders,
      returnedStreamsCount: 0,
      approvedStreamsCount: 0,
      rejectedStreams: [],
      timeouts: [],
      networkErrors: [],
      phase1DurationMs: 0,
      totalDurationMs: 0,
      finalState: 'SEARCHING',
      timestamp: new Date().toISOString()
    };

    // Callback para coletar telemetria detalhada de cada tentativa de provedor
    const handleProviderAttempt = (detail: ProviderAttemptDetail) => {
      latestProviderOutcome.set(detail.providerId, detail.success && !detail.isTimeout);
      if (!diagnostic.queriedProviders.includes(detail.providerId)) {
        diagnostic.queriedProviders.push(detail.providerId);
      }
      if (detail.isTimeout) {
        if (!diagnostic.timeouts.includes(detail.providerId)) {
          diagnostic.timeouts.push(detail.providerId);
        }
      }
      if (!detail.success && detail.error && !detail.isTimeout) {
        diagnostic.networkErrors.push({ providerId: detail.providerId, error: detail.error });
      }
      diagnostic.returnedStreamsCount += detail.streamCount;
    };

    // =========================================================================
    // ETAPA 1: PRIMEIRA VERIFICAÇÃO
    // =========================================================================
    options?.onStateChange?.('SEARCHING', 'Buscando fontes disponíveis...');
    diagnostic.finalState = 'SEARCHING';
    const phase1Start = Date.now();

    let resolvedImdbId = item.imdbId;
    let resolvedTmdbId = item.tmdbId;

    // Resolução canônica antecipada: se só temos TMDB ID ou título, busca IMDb ID imediatamente
    if (!resolvedImdbId && (resolvedTmdbId || item.id)) {
      try {
        const candidateTmdb = resolvedTmdbId || item.id.replace(/^tmdb-?/i, '');
        if (/^\d+$/.test(String(candidateTmdb))) {
          const res = await Promise.race([
            tmdbService.getImdbId(candidateTmdb, streamType),
            new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 4000))
          ]);
          if (res) resolvedImdbId = res;
        }
      } catch {}
    }

    const targetPayload = {
      tmdbId: resolvedTmdbId,
      imdbId: resolvedImdbId,
      id: item.id,
      title: targetTitle,
      originalTitle: item.originalTitle,
      year: item.year
    };

    let phase1Streams: StremioStream[] = [];

    try {
      phase1Streams = await providerRegistry.resolveStreams(
        streamType,
        targetPayload,
        episode,
        {
          signal: options?.signal,
          onProgressiveStreams: (progressive) => {
            if (options?.signal?.aborted) return;
            const playable = progressive?.filter(isSourcePlayableHere) || [];
            if (playable.length > 0) {
              diagnostic.approvedStreamsCount = playable.length;
              options?.onProgressiveStreams?.(playable);
              // Notifica imediatamente AVAILABLE para preparar o vídeo sem aguardar os demais provedores.
              options?.onStateChange?.('AVAILABLE');
            }
          },
          forceRefresh: options?.forceRefresh,
          bypassNegativeCache: options?.bypassNegativeCache,
          onProviderResult: handleProviderAttempt
        }
      );
    } catch (err: any) {
      diagnostic.networkErrors.push({ providerId: 'registry-phase1', error: err?.message || 'Erro na fase 1' });
    }

    diagnostic.phase1DurationMs = Date.now() - phase1Start;
    const phase1Playable = phase1Streams.filter(isSourcePlayableHere);
    diagnostic.approvedStreamsCount = phase1Playable.length;

    // Se a primeira verificação encontrou fontes válidas, FINALIZA IMEDIATAMENTE (Requisito 3 e 9)
    if (phase1Playable.length > 0) {
      diagnostic.finalState = 'AVAILABLE';
      diagnostic.totalDurationMs = Date.now() - overallStart;
      this.recordLog(diagnostic);
      options?.onStateChange?.('AVAILABLE');
      return {
        state: 'AVAILABLE',
        streams: phase1Playable,
        diagnosticLog: diagnostic
      };
    }

    // Se o sinal de cancelamento foi disparado, encerra sem segunda verificação
    if (options?.signal?.aborted) {
      diagnostic.finalState = 'INCONCLUSIVE';
      diagnostic.inconclusiveReason = 'Operação cancelada pelo usuário';
      diagnostic.totalDurationMs = Date.now() - overallStart;
      this.recordLog(diagnostic);
      return {
        state: 'INCONCLUSIVE',
        streams: [],
        errorMessage: MSG_INCONCLUSIVE,
        diagnosticLog: diagnostic
      };
    }

    // =========================================================================
    // ETAPA 2: SEGUNDA VERIFICAÇÃO AUTOMÁTICA OBRIGATÓRIA (Requisito 4)
    // =========================================================================
    console.log(`[SourceVerification] 0 fontes na 1ª verificação de "${targetTitle}". Iniciando Segunda Verificação Automática...`);
    options?.onStateChange?.('RETRYING', 'Verificando fontes em provedores adicionais...');
    diagnostic.finalState = 'RETRYING';
    const phase2Start = Date.now();

    // Pequeno intervalo progressivo antes de retentar provedores com erro/timeout transitório
    await new Promise(r => setTimeout(r, 450));
    if (options?.signal?.aborted) {
      diagnostic.finalState = 'INCONCLUSIVE';
      diagnostic.totalDurationMs = Date.now() - overallStart;
      this.recordLog(diagnostic);
      return { state: 'INCONCLUSIVE', streams: [], errorMessage: MSG_INCONCLUSIVE, diagnosticLog: diagnostic };
    }

    // Reavaliação profunda de identificadores canônicos na 2ª verificação
    if (!resolvedImdbId) {
      try {
        if (resolvedTmdbId || /^\d+$/.test(item.id.replace(/^tmdb-?/i, ''))) {
          const tNum = resolvedTmdbId || item.id.replace(/^tmdb-?/i, '');
          const deepImdb = await tmdbService.getImdbId(tNum, streamType);
          if (deepImdb) resolvedImdbId = deepImdb;
        }
        if (!resolvedImdbId && targetTitle) {
          const multi = await tmdbService.searchMulti(targetTitle);
          if (multi && multi.length > 0) {
            const targetYear = item.year || 0;
            const normTarget = canonicalIdentityService.normalizeTitle(targetTitle);
            const typeMatches = multi.filter(r => {
              const rIsMovie = r.type === ContentType.MOVIE || r.mediaFormat === 'movie';
              return streamType === 'movie' ? rIsMovie : !rIsMovie;
            });
            const valid = typeMatches.filter(r => {
              const normTitle = canonicalIdentityService.normalizeTitle(r.title);
              const normOrig = r.originalTitle ? canonicalIdentityService.normalizeTitle(r.originalTitle) : '';
              const titleExact = normTitle === normTarget || normOrig === normTarget;
              if (!titleExact) {
                const tTokens = canonicalIdentityService.extractSignificantTokens(normTarget);
                const rTokens = canonicalIdentityService.extractSignificantTokens(normTitle);
                if (tTokens.length >= 2 && rTokens.length >= 2) {
                  const allMatch = tTokens.every(t => rTokens.includes(t)) && rTokens.every(t => tTokens.includes(t));
                  if (!allMatch) return false;
                } else {
                  return false;
                }
              }
              if (targetYear > 0 && r.year && r.year > 0 && Math.abs(r.year - targetYear) > 1) {
                return false;
              }
              return true;
            });
            const match = valid[0];
            if (match) {
              if (match.imdbId) resolvedImdbId = match.imdbId;
              if (match.tmdbId && !resolvedTmdbId) resolvedTmdbId = match.tmdbId;
            }
          }
        }
      } catch (e: any) {
        diagnostic.networkErrors.push({ providerId: 'canonical-deep-resolution', error: e?.message || 'Falha ao re-resolver IMDb' });
      }
    }

    const phase2Payload = {
      tmdbId: resolvedTmdbId,
      imdbId: resolvedImdbId,
      id: item.id,
      title: targetTitle,
      originalTitle: item.originalTitle,
      year: item.year
    };

    let phase2Streams: StremioStream[] = [];

    try {
      // Força nova requisição real com bypass de qualquer cache negativo
      phase2Streams = await providerRegistry.resolveStreams(
        streamType,
        phase2Payload,
        episode,
        {
          signal: options?.signal,
          onProgressiveStreams: (progressive) => {
            if (options?.signal?.aborted) return;
            const playable = progressive?.filter(isSourcePlayableHere) || [];
            if (playable.length > 0) {
              diagnostic.approvedStreamsCount = playable.length;
              options?.onProgressiveStreams?.(playable);
              options?.onStateChange?.('AVAILABLE');
            }
          },
          forceRefresh: true,
          bypassNegativeCache: true,
          isRetryAttempt: true,
          onProviderResult: handleProviderAttempt
        }
      );
    } catch (err: any) {
      diagnostic.networkErrors.push({ providerId: 'registry-phase2', error: err?.message || 'Erro na fase 2' });
    }

    diagnostic.phase2DurationMs = Date.now() - phase2Start;
    diagnostic.totalDurationMs = Date.now() - overallStart;

    // Se encontrou fontes em qualquer fase, o resultado é obrigatoriamente AVAILABLE
    const finalStreams = phase2Streams.filter(isSourcePlayableHere);
    if (finalStreams.length > 0) {
      diagnostic.approvedStreamsCount = finalStreams.length;
      diagnostic.finalState = 'AVAILABLE';
      this.recordLog(diagnostic);
      options?.onStateChange?.('AVAILABLE');
      return {
        state: 'AVAILABLE',
        streams: finalStreams,
        diagnosticLog: diagnostic
      };
    }

    // Coleta fontes candidatas compatíveis com a web de ambas as fases
    const candidatePool = [...phase2Streams, ...phase1Streams];
    const webReadyCandidates: StremioStream[] = [];
    const seenCandidateKeys = new Set<string>();

    for (const s of candidatePool) {
      if (!s.url) continue;
      const key = s.url || s.infoHash || `${s.name}-${s.title}`;
      if (seenCandidateKeys.has(key)) continue;
      seenCandidateKeys.add(key);

      const u = s.url.toLowerCase();
      // Descarta torrents e loopbacks sem motor local ativo
      if (s.isTorrent || u.includes('127.0.0.1:11470') || u.includes('localhost:11470')) {
        continue;
      }
      webReadyCandidates.push(s);
    }

    if (webReadyCandidates.length > 0) {
      // Fontes candidatas compatíveis encontradas: permite reprodução com fallback controlado
      diagnostic.approvedStreamsCount = webReadyCandidates.length;
      diagnostic.finalState = 'AVAILABLE';
      this.recordLog(diagnostic);
      options?.onStateChange?.('AVAILABLE');
      return {
        state: 'AVAILABLE',
        streams: webReadyCandidates,
        diagnosticLog: diagnostic
      };
    }

    if (candidatePool.length > 0) {
      // Apenas torrents que dependem de motor local foram encontrados
      diagnostic.finalState = 'INCONCLUSIVE';
      diagnostic.inconclusiveReason = 'As fontes retornadas exigem um motor local indisponível neste dispositivo';
      this.recordLog(diagnostic);
      options?.onStateChange?.('INCONCLUSIVE', MSG_INCONCLUSIVE);
      return { state: 'INCONCLUSIVE', streams: [], errorMessage: MSG_INCONCLUSIVE, diagnosticLog: diagnostic };
    }

    // =========================================================================
    // ETAPA 3: CLASSIFICAÇÃO RIGOROSA DO RESULTADO (Requisito 5)
    // =========================================================================
    // Sem fonte, qualquer provedor ainda em erro deixa a conclusão parcial.
    // Respostas vazias simuladas, cache negativo e ausência de provedores consultados
    // também não comprovam indisponibilidade.
    const unresolvedProviders = [...latestProviderOutcome].filter(([, success]) => !success).map(([id]) => id);
    const registryFailed = diagnostic.networkErrors.some(e => e.providerId.startsWith('registry-'));
    if (unresolvedProviders.length > 0 || registryFailed || latestProviderOutcome.size === 0) {
      diagnostic.finalState = 'INCONCLUSIVE';
      diagnostic.inconclusiveReason = unresolvedProviders.length > 0
        ? `Provedores sem resposta conclusiva: ${unresolvedProviders.join(', ')}`
        : registryFailed ? 'Falha no registro de provedores' : 'Nenhum provedor confirmou a ausência de fontes';
      this.recordLog(diagnostic);
      options?.onStateChange?.('INCONCLUSIVE', MSG_INCONCLUSIVE);
      return {
        state: 'INCONCLUSIVE',
        streams: [],
        errorMessage: MSG_INCONCLUSIVE,
        diagnosticLog: diagnostic
      };
    }

    // Ausência confirmada: provedores responderam conclusivamente mas nenhuma fonte válida existe
    diagnostic.finalState = 'UNAVAILABLE';
    this.recordLog(diagnostic);
    options?.onStateChange?.('UNAVAILABLE', MSG_UNAVAILABLE);
    return {
      state: 'UNAVAILABLE',
      streams: [],
      errorMessage: MSG_UNAVAILABLE,
      diagnosticLog: diagnostic
    };
  }

  /**
   * Recuperação automática de reprodução quando uma fonte específica falha em tempo de execução (Requisito 6).
   */
  public getNextFallbackStream(
    currentStreamUrl: string,
    allStreams: StremioStream[],
    preferredAudioTier?: 'dubbed_ptbr' | 'original' | 'unknown'
  ): StremioStream | null {
    if (!allStreams || allStreams.length === 0) return null;

    // Descarta a fonte que falhou
    const candidates = allStreams.filter(s => s.url !== currentStreamUrl && Boolean(s.url));
    if (candidates.length === 0) return null;

    // Preserva o áudio/dublagem preferido se especificado
    if (preferredAudioTier === 'dubbed_ptbr') {
      const dubbed = candidates.find(s => s.isDubbed || s.isPtBr);
      if (dubbed) return dubbed;
    }

    return candidates[0] || null;
  }

  private recordLog(log: VerificationDiagnosticLog): void {
    this.lastLog = log;
    this.diagnosticLogs.unshift(log);
    if (this.diagnosticLogs.length > this.MAX_LOG_HISTORY) {
      this.diagnosticLogs.pop();
    }
  }

  public getLastDiagnosticLog(): VerificationDiagnosticLog | null {
    return this.lastLog;
  }

  public getDiagnosticLogs(): VerificationDiagnosticLog[] {
    return [...this.diagnosticLogs];
  }

  public clearLogs(): void {
    this.diagnosticLogs = [];
    this.lastLog = null;
  }
}

export const sourceVerificationService = new SourceVerificationService();
