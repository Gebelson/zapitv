import { StremioStream } from '../stremio/stremioTypes';
import { ContentItem, ContentType } from '../../../types';
import { providerRegistry, ProviderConfig, type ProviderAttemptOutcome, type ProviderAttemptDetail } from './providerRegistry';
import { tmdbService } from '../tmdb/tmdbClient';
import { canonicalIdentityService } from '../identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../identity/sourceConfidenceEngine';
import { streamValidator } from './streamValidator';
import { sourceSelectionService } from '../selection/sourceSelectionService';
import { isSourcePlayableHere } from './sourceReadiness';

export type VerificationDetailedState =
  | 'SOURCE_FOUND'
  | 'NO_SOURCE_RETURNED'
  | 'SOURCE_REJECTED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'AUTH_REQUIRED'
  | 'MEDIA_INCOMPATIBLE'
  | 'PLAYBACK_FAILED'
  | 'PLAYBACK_CONFIRMED';

export type VerificationState =
  | 'IDLE'
  | 'SEARCHING'       // Primeira verificação em andamento
  | 'RETRYING'        // Segunda verificação automática em andamento
  | 'AVAILABLE'       // Fonte válida e reproduzível confirmada
  | 'UNAVAILABLE'     // Ausência comprovada em todos os provedores elegíveis consultados
  | 'INCONCLUSIVE'    // Falhas de rede, limites ou timeouts impediram verificação conclusiva
  | 'PLAYBACK_ERROR'; // Fonte encontrada falhou na reprodução

export interface PipelineTraceStep {
  providerId: string;
  providerName: string;
  httpStatus?: number;
  outcome: ProviderAttemptOutcome;
  streamsReceived: number;
  filteredOutCount: number;
  filterReasons: string[];
  approvedCount: number;
  playerState?: 'NOT_REACHED' | 'LOADING' | 'FIRST_FRAME_DECODED' | 'PLAYBACK_ERROR';
  dropReason?: string;
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
  rejectedStreamsCount?: number;
  rejectedStreams: { title: string; providerId?: string; reason: string }[];
  pipelineTraces?: PipelineTraceStep[];
  timeouts: string[];
  networkErrors: { providerId: string; error: string }[];
  phase1DurationMs: number;
  phase2DurationMs?: number;
  totalDurationMs: number;
  finalState: VerificationState;
  detailedState?: VerificationDetailedState;
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
  detailedState?: VerificationDetailedState;
  streams: StremioStream[];
  errorMessage?: string;
  inconclusiveReason?: string;
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
    const latestProviderOutcome = new Map<string, ProviderAttemptDetail>();
    const pipelineTraces: PipelineTraceStep[] = [];

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
      pipelineTraces,
      timeouts: [],
      networkErrors: [],
      phase1DurationMs: 0,
      totalDurationMs: 0,
      finalState: 'SEARCHING',
      timestamp: new Date().toISOString()
    };

    // Callback para coletar telemetria detalhada de cada tentativa de provedor
    const handleProviderAttempt = (detail: ProviderAttemptDetail) => {
      if (detail.isTimeout && !detail.outcome) {
        detail.outcome = 'TIMEOUT';
      }
      latestProviderOutcome.set(detail.providerId, detail);
      if (!diagnostic.queriedProviders.includes(detail.providerId)) {
        diagnostic.queriedProviders.push(detail.providerId);
      }
      if (detail.isTimeout || detail.outcome === 'TIMEOUT') {
        if (!diagnostic.timeouts.includes(detail.providerId)) {
          diagnostic.timeouts.push(detail.providerId);
        }
      }
      if ((detail.outcome === 'NETWORK_FAILURE' || detail.outcome === 'HTTP_FAILURE' || detail.outcome === 'INVALID_RESPONSE') && detail.error) {
        diagnostic.networkErrors.push({ providerId: detail.providerId, error: detail.error });
      }
      diagnostic.returnedStreamsCount += detail.streamCount;

      let trace = pipelineTraces.find(t => t.providerId === detail.providerId);
      if (!trace) {
        trace = {
          providerId: detail.providerId,
          providerName: detail.providerName,
          httpStatus: detail.httpStatus,
          outcome: detail.outcome,
          streamsReceived: detail.streamCount,
          filteredOutCount: 0,
          filterReasons: [],
          approvedCount: 0,
          playerState: 'NOT_REACHED',
          dropReason: detail.streamCount === 0 ? 'Provedor confirmou ausência de fontes (0 streams)' : undefined
        };
        pipelineTraces.push(trace);
      } else {
        trace.outcome = detail.outcome;
        trace.streamsReceived += detail.streamCount;
        trace.httpStatus = detail.httpStatus || trace.httpStatus;
        if (detail.streamCount === 0 && !trace.dropReason) {
          trace.dropReason = 'Provedor confirmou ausência de fontes (0 streams)';
        }
      }
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

    // Resolução canônica de títulos alternativos (ex: "Em Busca de Jade" para "Pursuit of Jade")
    const itemAlternateTitles: string[] = [
      ...((item as any).alternateTitles || []),
      ...((item as any).knownAliases || [])
    ];
    if (itemAlternateTitles.length <= 1 && (resolvedTmdbId || resolvedImdbId || item.id)) {
      try {
        const tId = resolvedTmdbId || (resolvedImdbId ? resolvedImdbId : item.id.replace(/^tmdb-?/i, ''));
        const fetchedAlt = await Promise.race([
          tmdbService.getAlternativeTitles(tId, streamType),
          new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 3000))
        ]);
        for (const fa of fetchedAlt) {
          if (!itemAlternateTitles.includes(fa)) itemAlternateTitles.push(fa);
        }
      } catch {}
    }

    const targetPayload = {
      alternateTitles: itemAlternateTitles,
      knownAliases: itemAlternateTitles,
      tmdbId: resolvedTmdbId,
      imdbId: resolvedImdbId,
      id: item.id,
      title: targetTitle,
      originalTitle: item.originalTitle,
      year: item.year
    };

    let phase1Streams: StremioStream[] = [];
    const collectedProgressivePlayable: StremioStream[] = [];
    let canonicalIdentity = canonicalIdentityService.buildIdentity({
      ...item,
      imdbId: resolvedImdbId || item.imdbId,
      tmdbId: resolvedTmdbId || item.tmdbId,
      alternateTitles: itemAlternateTitles,
      knownAliases: itemAlternateTitles
    }, episode);



    // Validação estrita de compatibilidade técnica e correspondência canônica de identidade
    const isPlayableAndCanonicallyVerified = (s: StremioStream): boolean => {
      if (!isSourcePlayableHere(s)) {
        diagnostic.rejectedStreams.push({
          title: s.title || s.name || 'Stream sem título',
          providerId: s.providerId,
          reason: 'Incompatível com o ambiente de reprodução / dependência de Stremio Engine local'
        });
        return false;
      }
      const evaluation = sourceConfidenceEngine.evaluate(s, canonicalIdentity);
      if (!evaluation.isMatch || evaluation.confidence === 'REJECTED' || evaluation.confidence === 'QUARANTINED') {
        diagnostic.rejectedStreams.push({
          title: s.title || s.name || 'Stream sem título',
          providerId: s.providerId,
          reason: evaluation.reasons.join(', ') || ('Confiança: ' + evaluation.confidence) 
        });
        return false;
      }
      return true;
    };

    // 0. Se o item já possui verifiedStreams pré-validadas de acervo oficial ou teste, aproveita-as imediatamente
    if (item.verifiedStreams && Array.isArray(item.verifiedStreams) && item.verifiedStreams.length > 0) {
      const verifiedPlayable = item.verifiedStreams.filter(isPlayableAndCanonicallyVerified);
      if (verifiedPlayable.length > 0) {
        diagnostic.finalState = 'AVAILABLE';
        diagnostic.approvedStreamsCount = verifiedPlayable.length;
        diagnostic.totalDurationMs = Date.now() - overallStart;
        this.recordLog(diagnostic, verifiedPlayable);
        options?.onProgressiveStreams?.(verifiedPlayable);
        options?.onStateChange?.('AVAILABLE');
        return {
          state: 'AVAILABLE',
          streams: verifiedPlayable,
          diagnosticLog: diagnostic
        };
      }
    }

    try {
      phase1Streams = await providerRegistry.resolveStreams(
        streamType,
        targetPayload,
        episode,
        {
          signal: options?.signal,
          onProgressiveStreams: (progressive) => {
            if (options?.signal?.aborted) return;
            const playable = progressive?.filter(isPlayableAndCanonicallyVerified) || [];
            if (playable.length > 0) {
              for (const p of playable) {
                if (!collectedProgressivePlayable.some(c => c.url === p.url)) {
                  collectedProgressivePlayable.push(p);
                }
              }
              diagnostic.approvedStreamsCount = collectedProgressivePlayable.length;
              options?.onProgressiveStreams?.(collectedProgressivePlayable);
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
    const phase1Candidates = phase1Streams.length > 0 ? phase1Streams : collectedProgressivePlayable;
    const phase1Playable = phase1Candidates.filter(isPlayableAndCanonicallyVerified);
    diagnostic.approvedStreamsCount = phase1Playable.length;

    // Se a primeira verificação encontrou fontes válidas, FINALIZA IMEDIATAMENTE (Requisito 3 e 9)
    if (phase1Playable.length > 0) {
      diagnostic.finalState = 'AVAILABLE';
      diagnostic.totalDurationMs = Date.now() - overallStart;
      this.recordLog(diagnostic, phase1Playable);
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

    if (resolvedImdbId || resolvedTmdbId) {
      canonicalIdentity = canonicalIdentityService.buildIdentity({
        ...item,
        imdbId: resolvedImdbId || item.imdbId,
        tmdbId: resolvedTmdbId || item.tmdbId,
        alternateTitles: itemAlternateTitles,
        knownAliases: itemAlternateTitles
      }, episode);

    }

    const phase2Payload = {
      alternateTitles: itemAlternateTitles,
      knownAliases: itemAlternateTitles,
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
            const playable = progressive?.filter(isPlayableAndCanonicallyVerified) || [];
            if (playable.length > 0) {
              for (const p of playable) {
                if (!collectedProgressivePlayable.some(c => c.url === p.url)) {
                  collectedProgressivePlayable.push(p);
                }
              }
              diagnostic.approvedStreamsCount = collectedProgressivePlayable.length;
              options?.onProgressiveStreams?.(collectedProgressivePlayable);
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

    // Se encontrou fontes em qualquer fase que atendam à validação canônica, retorna AVAILABLE
    const finalCandidates = phase2Streams.length > 0 ? phase2Streams : collectedProgressivePlayable;
    const finalStreams = finalCandidates.filter(isPlayableAndCanonicallyVerified);
    if (finalStreams.length > 0) {
      diagnostic.approvedStreamsCount = finalStreams.length;
      diagnostic.finalState = 'AVAILABLE';
      this.recordLog(diagnostic, finalStreams);
      options?.onStateChange?.('AVAILABLE');
      return {
        state: 'AVAILABLE',
        streams: finalStreams,
        diagnosticLog: diagnostic
      };
    }

    // Coleta fontes candidatas de ambas as fases verificando estritamente a identidade canônica
    // REGRA MANDATÓRIA: Nenhum fallback pode contornar a validação canônica de identidade
    const candidatePool = [...phase2Streams, ...phase1Streams, ...collectedProgressivePlayable];
    const webReadyCandidates: StremioStream[] = [];
    const seenCandidateKeys = new Set<string>();

    for (const s of candidatePool) {
      if (!s.url) continue;
      const key = s.url || s.infoHash || `${s.name}-${s.title}`;
      if (seenCandidateKeys.has(key)) continue;
      seenCandidateKeys.add(key);

      // Descarta torrents e loopbacks sem motor local ativo
      const u = s.url.toLowerCase();
      if (s.isTorrent || u.includes('127.0.0.1:11470') || u.includes('localhost:11470')) {
        continue;
      }

      // Validação canônica estrita para qualquer candidato de fallback
      if (!isPlayableAndCanonicallyVerified(s)) {
        continue;
      }
      webReadyCandidates.push(s);
    }

    if (webReadyCandidates.length > 0) {
      diagnostic.approvedStreamsCount = webReadyCandidates.length;
      diagnostic.finalState = 'AVAILABLE';
      this.recordLog(diagnostic, webReadyCandidates);
      options?.onStateChange?.('AVAILABLE');
      return {
        state: 'AVAILABLE',
        streams: webReadyCandidates,
        diagnosticLog: diagnostic
      };
    }

    const torrentCandidates = candidatePool.filter(s =>
      s.isTorrent || (s.url && (s.url.toLowerCase().includes('127.0.0.1:11470') || s.url.toLowerCase().includes('localhost:11470')))
    );
    const nonTorrentCandidates = candidatePool.filter(s => !torrentCandidates.includes(s));

    if (torrentCandidates.length > 0 && nonTorrentCandidates.length === 0) {
      // Exclusivamente torrents que dependem de motor local foram encontrados, mas o motor não está ativo
      diagnostic.finalState = 'UNAVAILABLE';
      diagnostic.inconclusiveReason = 'As fontes encontradas dependem de motor P2P/Stremio Engine não disponível neste dispositivo';
      this.recordLog(diagnostic);
      options?.onStateChange?.('UNAVAILABLE', MSG_UNAVAILABLE);
      return { state: 'UNAVAILABLE', streams: [], errorMessage: MSG_UNAVAILABLE, diagnosticLog: diagnostic };
    }

    if (candidatePool.length > 0) {
      diagnostic.rejectedStreamsCount = candidatePool.length;
    }

    // =========================================================================
    // ETAPA 3: CLASSIFICAÇÃO RIGOROSA DO RESULTADO (Requisitos 3 e 5)
    // =========================================================================
    const technicalFailures = Array.from(latestProviderOutcome.values()).filter(d =>
      d.outcome === 'TIMEOUT' ||
      d.isTimeout === true ||
      d.outcome === 'NETWORK_FAILURE' ||
      d.outcome === 'HTTP_FAILURE' ||
      d.outcome === 'INVALID_RESPONSE'
    );
    const hasTimeouts = diagnostic.timeouts.length > 0;
    const registryFailed = diagnostic.networkErrors.some(e => e.providerId.startsWith('registry-'));

    if (technicalFailures.length > 0 || hasTimeouts || registryFailed) {
      const hasAuth = Array.from(latestProviderOutcome.values()).some(d => d.httpStatus === 401 || d.httpStatus === 403);
      diagnostic.detailedState = hasAuth
        ? 'AUTH_REQUIRED'
        : (hasTimeouts || technicalFailures.some(d => d.outcome === 'TIMEOUT' || d.isTimeout) ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR');
      diagnostic.finalState = 'INCONCLUSIVE';
      diagnostic.inconclusiveReason = technicalFailures.length > 0
        ? `Provedores com falha técnica: ${technicalFailures.map(f => `${f.providerName} (${f.outcome})`).join(', ')}`
        : 'Falha no registro de provedores';
      this.recordLog(diagnostic);
      options?.onStateChange?.('INCONCLUSIVE', MSG_INCONCLUSIVE);
      return {
        state: 'INCONCLUSIVE',
        streams: [],
        errorMessage: MSG_INCONCLUSIVE,
        diagnosticLog: diagnostic
      };
    }

    // Ausência confirmada: todos os provedores elegíveis responderam conclusivamente com ausência de fontes
    diagnostic.finalState = 'UNAVAILABLE';
    diagnostic.detailedState = (candidatePool.length > 0 || diagnostic.rejectedStreams.length > 0) ? 'SOURCE_REJECTED' : 'NO_SOURCE_RETURNED';
    diagnostic.inconclusiveReason = 'Ausência de fontes comprovada em todos os provedores elegíveis';
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

  private recordLog(log: VerificationDiagnosticLog, approvedStreams: StremioStream[] = []): void {
    if (log.pipelineTraces) {
      const approvedByProvider = new Map<string, number>();
      for (const s of approvedStreams) {
        if (s.providerId) {
          approvedByProvider.set(s.providerId, (approvedByProvider.get(s.providerId) || 0) + 1);
        }
      }
      for (const trace of log.pipelineTraces) {
        const approved = approvedByProvider.get(trace.providerId) || 0;
        trace.approvedCount = approved;
        trace.filteredOutCount = Math.max(0, trace.streamsReceived - approved);
        if (approved > 0) {
          trace.dropReason = undefined;
        } else if (trace.streamsReceived > 0 && !trace.dropReason) {
          trace.dropReason = 'Fontes descartadas por filtro de integridade/compatibilidade';
        }
        if (trace.filteredOutCount > 0 && log.rejectedStreams.length === 0) {
          log.rejectedStreams.push({
            title: 'Streams descartados (' + trace.providerName + ')',
            providerId: trace.providerId,
            reason: trace.dropReason || 'Rejeitado por incompatibilidade ou filtro de integridade'
          });
        }
      }
    }
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
