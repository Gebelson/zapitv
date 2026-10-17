/**
 * ZapiTV — FeedbackClusteringEngine
 * Motor de extração de assinaturas técnicas (fingerprints), deduplicação,
 * detecção de problemas recorrentes em 3 níveis, priorização e detecção de regressões.
 */

import {
  FeedbackCategory,
  FEEDBACK_CATEGORY_LABELS,
  FeedbackReport,
  IssueCluster,
  IssueFingerprintData,
  IssuePriority,
  IssueStatus,
  IssueTrend,
  TechnicalContext
} from './feedbackTypes';

export class FeedbackClusteringEngine {
  /**
   * Gera a assinatura técnica normalizada de um relato (Fingerprint)
   */
  public static generateFingerprint(
    category: FeedbackCategory,
    context: Partial<TechnicalContext>
  ): { fingerprint: string; data: IssueFingerprintData } {
    const isMovie = context.mediaType === 'movie';
    const mediaId = (context.canonicalMediaId || context.tmdbId || context.imdbId || 'global')
      .toLowerCase()
      .trim();
    const season = !isMovie ? (context.season || 0) : 0;
    const episode = !isMovie ? (context.episode || 0) : 0;
    const provider = (context.providerId || 'unknown').toLowerCase().trim();
    const failureStage = context.failureStage || 'none';
    const errorCode = context.errorCode ? context.errorCode.toUpperCase().trim() : 'NONE';

    // Determina o host da fonte sem expor URLs completas ou tokens
    let sourceHost = 'unknown';
    if (context.streamUrlHost) {
      sourceHost = context.streamUrlHost.toLowerCase();
    } else if (context.sourceId) {
      sourceHost = context.sourceId.toLowerCase();
    }

    // Assinatura Level 1: Específica por obra, episódio e componente
    const isEpisodeSpecific = !isMovie && (season > 0 && episode > 0);
    const epKey = isEpisodeSpecific ? `S${season}E${episode}` : 'ALL';
    const errKey = errorCode !== 'NONE' ? errorCode : failureStage;

    const rawKey = `${category}|${mediaId}|${epKey}|${provider}|${errKey}`;
    const cleanHash = this.hashString(rawKey);
    const fingerprint = `fp_l1_${cleanHash}`;

    const data: IssueFingerprintData = {
      category,
      canonicalMediaId: mediaId !== 'global' ? mediaId : undefined,
      season: (!isMovie && season > 0 && episode > 0) ? season : undefined,
      episode: (!isMovie && season > 0 && episode > 0) ? episode : undefined,
      providerId: provider !== 'unknown' ? provider : undefined,
      sourceHost: sourceHost !== 'unknown' ? sourceHost : undefined,
      errorCode: errorCode !== 'NONE' ? errorCode : undefined,
      failureStage: failureStage !== 'none' ? failureStage : undefined,
      level: 1
    };

    return { fingerprint, data };
  }

  /**
   * Gera título normalizado e profissional para o cluster
   */
  public static generateClusterTitle(
    category: FeedbackCategory,
    context: Partial<TechnicalContext>
  ): string {
    const categoryName = FEEDBACK_CATEGORY_LABELS[category] || 'Problema de Reprodução';
    const mediaName = context.mediaTitle ? context.mediaTitle.trim() : null;
    const isMovie = context.mediaType === 'movie';
    const isEpisode = !isMovie && (context.season || 0) > 0 && (context.episode || 0) > 0;

    if (mediaName) {
      if (isEpisode) {
        return `${mediaName} (T${context.season}:E${context.episode}) — ${categoryName}`;
      }
      return `${mediaName} — ${categoryName}`;
    }

    if (context.providerId && context.providerId !== 'unknown') {
      return `Provedor ${context.providerId.toUpperCase()} — ${categoryName}`;
    }

    if (category === 'live_channel_unavailable') {
      return `TV ao Vivo — ${context.mediaTitle || 'Canal'} Indisponível`;
    }

    if (category === 'search_problem') {
      return `Busca e Catálogo — Inconsistência nos Resultados`;
    }

    return `Sistema — ${categoryName}`;
  }

  /**
   * Extrai dados normalizados de fingerprint de forma descritiva
   */
  public static extractFingerprint(
    category: FeedbackCategory,
    context: Partial<TechnicalContext>
  ): {
    canonicalMediaId?: string;
    mediaTitle?: string;
    mediaType?: string;
    season?: number;
    episode?: number;
    providerId?: string;
    errorCode?: string;
    category: FeedbackCategory;
    component: string;
    failureStage?: string;
  } {
    const canonicalMediaId = context.canonicalMediaId 
      ? context.canonicalMediaId.toLowerCase().trim() 
      : undefined;
    const mediaTitle = context.mediaTitle ? context.mediaTitle.trim() : undefined;
    const providerId = context.providerId ? context.providerId.toLowerCase().trim() : undefined;
    const errorCode = context.errorCode ? context.errorCode.toUpperCase().trim() : undefined;

    return {
      canonicalMediaId,
      mediaTitle,
      mediaType: context.mediaType,
      season: context.season,
      episode: context.episode,
      providerId,
      errorCode,
      category,
      component: this.getComponentByCategory(category),
      failureStage: context.failureStage
    };
  }

  /**
   * Mapeia categoria para o componente técnico responsável
   */
  public static getComponentByCategory(category: FeedbackCategory): string {
    switch (category) {
      case 'video_not_loading':
      case 'infinite_loading':
      case 'video_stuttering':
      case 'wrong_quality':
        return 'playback';
      case 'wrong_dubbing':
      case 'missing_dubbing_ptbr':
      case 'no_sound':
      case 'unstable_volume':
        return 'audio';
      case 'subtitles_wrong_language':
      case 'subtitles_out_of_sync':
        return 'subtitles';
      case 'search_problem':
      case 'catalog_problem':
        return 'catalog';
      case 'live_channel_unavailable':
        return 'livetv';
      default:
        return 'general';
    }
  }

  /**
   * Alias de conveniência para matchCluster
   */
  public static findMatchingCluster(
    existingClusters: IssueCluster[],
    report: FeedbackReport
  ): { matchedCluster: IssueCluster | null; matchLevel: 1 | 2 | 3 } | null {
    return this.matchCluster(existingClusters, report);
  }

  /**
   * Avalia a prioridade de um cluster com base em severidade, impacto e frequência
   */
  public static calculatePriority(
    category: FeedbackCategory,
    totalReports: number,
    affectedMediaCountOrErrorCode?: number | string,
    isRegression?: boolean
  ): IssuePriority {
    const isReg = typeof isRegression === 'boolean' ? isRegression : false;
    const mediaCount = typeof affectedMediaCountOrErrorCode === 'number' ? affectedMediaCountOrErrorCode : 1;

    // Regras de Alta Severidade / Crítica
    if (category === 'live_channel_unavailable' && totalReports >= 5) {
      return 'critical';
    }

    if (
      (category === 'video_not_loading' || category === 'infinite_loading' || category === 'no_sound') &&
      (totalReports >= 10 || isReg)
    ) {
      return 'critical';
    }

    const highCategories: FeedbackCategory[] = [
      'video_not_loading',
      'infinite_loading',
      'wrong_movie_series',
      'wrong_episode',
      'wrong_dubbing',
      'no_sound'
    ];

    if (highCategories.includes(category)) {
      if (totalReports >= 10 || isReg) {
        return 'critical';
      }
      return 'high';
    }

    // Casos de Média Prioridade
    const mediumCategories: FeedbackCategory[] = [
      'missing_dubbing_ptbr',
      'subtitles_wrong_language',
      'subtitles_out_of_sync',
      'video_stuttering',
      'unstable_volume',
      'wrong_quality',
      'search_problem',
      'catalog_problem',
      'live_channel_unavailable'
    ];

    if (mediumCategories.includes(category)) {
      if (totalReports === 1 && category === 'catalog_problem') {
        return 'low';
      }
      if (totalReports >= 10 || mediaCount >= 5) {
        return 'high';
      }
      return 'medium';
    }

    // Casos de Baixa Prioridade
    if (totalReports >= 15) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calcula a tendência do problema (Aumentando, Estável, Diminuindo, Reapareceu)
   */
  public static calculateTrend(
    recentCountOrReports: number | FeedbackReport[],
    totalCountOrStatus?: number | string,
    isRegression?: boolean
  ): IssueTrend {
    if (Array.isArray(recentCountOrReports)) {
      const reports = recentCountOrReports;
      const status = typeof totalCountOrStatus === 'string' ? totalCountOrStatus : 'new';
      if (status === 'reopened' || isRegression) {
        return 'reappeared';
      }
      if (reports.length >= 4) {
        return 'increasing';
      }
      return 'stable';
    }

    const recentCount = typeof recentCountOrReports === 'number' ? recentCountOrReports : 0;
    const totalCount = typeof totalCountOrStatus === 'number' ? totalCountOrStatus : 1;

    if (isRegression) {
      return 'reappeared';
    }

    // Se temos mais de 50% dos relatos recentes
    if (recentCount >= 3 && recentCount / Math.max(1, totalCount) >= 0.5) {
      return 'increasing';
    }

    // Se não há relatos recentes mas o total é alto
    if (recentCount === 0 && totalCount >= 5) {
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Verifica se a submissão é uma duplicação rápida acidental ou abusiva do mesmo navegador
   */
  public static isDuplicateSubmission(
    recentReports: FeedbackReport[],
    newToken: string,
    newFingerprint: string,
    windowSeconds: number = 60
  ): boolean {
    const now = Date.now();
    const threshold = now - windowSeconds * 1000;

    return recentReports.some(r => {
      if (r.submissionTimestamp < threshold) return false;
      const isSameToken = r.clientSubmissionToken === newToken;
      const isSameFingerprint = r.fingerprint === newFingerprint;
      return isSameToken && isSameFingerprint;
    });
  }

  /**
   * Encontra o melhor cluster existente para associar o novo relato
   */
  public static matchCluster(
    existingClusters: IssueCluster[],
    report: FeedbackReport
  ): { matchedCluster: IssueCluster | null; matchLevel: 1 | 2 | 3 } {
    const repFp = report.fingerprint || report.fingerprintHash;
    const repFpData = (report.fingerprintData || (report as any).technicalFingerprint || {}) as any;
    const category = report.category;

    // Nível 1: Mesmo problema confirmado (mesmo fingerprint L1 exato)
    const exactMatch = existingClusters.find(c => 
      (c.fingerprint && c.fingerprint === repFp) ||
      ((c as any).fingerprintHash && (c as any).fingerprintHash === repFp)
    );
    if (exactMatch) {
      return { matchedCluster: exactMatch, matchLevel: 1 };
    }

    // Nível 2: Possivelmente relacionado (mesma obra e mesma categoria)
    const repMediaId = repFpData.canonicalMediaId || report.technicalContext?.canonicalMediaId;
    if (repMediaId) {
      const mediaMatch = existingClusters.find(c => {
        const cMediaId = c.fingerprintData?.canonicalMediaId || (c as any).technicalFingerprint?.canonicalMediaId;
        return c.category === category &&
          cMediaId === repMediaId &&
          c.status !== 'resolved';
      });
      if (mediaMatch) {
        return { matchedCluster: mediaMatch, matchLevel: 2 };
      }
    }

    // Nível 3: Problema sistêmico do mesmo provedor com múltiplos relatos
    const repProvider = repFpData.providerId || report.technicalContext?.providerId;
    if (repProvider && repProvider !== 'unknown') {
      const providerSystemic = existingClusters.find(c => {
        const cProvider = c.fingerprintData?.providerId || (c as any).technicalFingerprint?.providerId;
        const total = c.totalReports || (c as any).reportCount || 0;
        return c.category === category &&
          cProvider === repProvider &&
          total >= 5 &&
          c.status !== 'resolved';
      });
      if (providerSystemic) {
        return { matchedCluster: providerSystemic, matchLevel: 3 };
      }
    }

    return { matchedCluster: null, matchLevel: 1 };
  }

  /**
   * Cria um novo IssueCluster a partir do primeiro relato
   */
  public static createClusterFromReport(report: FeedbackReport): IssueCluster {
    const { technicalContext, category, fingerprint, fingerprintData } = report;
    const title = this.generateClusterTitle(category, technicalContext);
    const priority = this.calculatePriority(category, 1, technicalContext.canonicalMediaId ? 1 : 0, false);

    const affectedMedia: Array<{ id: string; title: string; type: string }> = [];
    if (technicalContext.canonicalMediaId) {
      affectedMedia.push({
        id: technicalContext.canonicalMediaId,
        title: technicalContext.mediaTitle || technicalContext.canonicalMediaId,
        type: technicalContext.mediaType || 'movie'
      });
    }

    const isMovie = technicalContext.mediaType === 'movie';
    const affectedEpisodes: Array<{ season: number; episode: number }> = [];
    if (!isMovie && technicalContext.season && technicalContext.episode) {
      affectedEpisodes.push({
        season: technicalContext.season,
        episode: technicalContext.episode
      });
    }

    const now = Date.now();
    const clusterId = `cluster_${this.hashString(`${fingerprint}_${now}`)}`;

    return {
      id: clusterId,
      title,
      category,
      categoryLabel: FEEDBACK_CATEGORY_LABELS[category] || 'Outro',
      priority,
      status: 'new',
      trend: 'increasing',
      fingerprint,
      fingerprintData,
      totalReports: 1,
      estimatedDistinctUsers: 1,
      recentReportsCount: 1,
      firstOccurrenceAt: report.submissionTimestamp || now,
      lastOccurrenceAt: report.submissionTimestamp || now,
      affectedMedia,
      affectedEpisodes,
      affectedSources: technicalContext.sourceId ? [technicalContext.sourceId] : [],
      affectedProviders: technicalContext.providerId ? [technicalContext.providerId] : [],
      affectedVersions: [technicalContext.appVersion || '0.0.0'],
      errorCodes: technicalContext.errorCode ? [technicalContext.errorCode] : [],
      languagesInvolved: technicalContext.requestedLanguage ? [technicalContext.requestedLanguage] : [],
      promptVersion: 1,
      isPromptOutdated: false,
      relatedClusterIds: [],
      isRegression: false,
      history: [
        {
          id: `hist_${now}_init`,
          timestamp: now,
          action: 'created',
          performedBy: 'Sistema (FeedbackClusteringEngine)',
          details: `Cluster inicializado a partir do relato #${report.id}`
        }
      ]
    };
  }

  /**
   * Atualiza um IssueCluster existente ao receber novo relato
   */
  public static mergeReportIntoCluster(
    cluster: IssueCluster,
    report: FeedbackReport
  ): { updatedCluster: IssueCluster; isRegressionDetected: boolean } {
    const { technicalContext } = report;
    const now = Date.now();
    let isRegression = false;

    // Detecção de Regressão: Se o cluster já estava marcado como 'resolved' e recebe novo relato
    let newStatus = cluster.status;
    let regressionDetails = cluster.regressionDetails;
    const history = [...cluster.history];

    if (cluster.status === 'resolved') {
      isRegression = true;
      newStatus = 'reopened';
      regressionDetails = {
        previousResolvedAt: cluster.lastOccurrenceAt,
        resolvedInVersion: cluster.affectedVersions[cluster.affectedVersions.length - 1],
        reopenedAt: now
      };
      history.push({
        id: `hist_${now}_regression`,
        timestamp: now,
        action: 'regression_detected',
        performedBy: 'Sistema (Detecção de Regressão)',
        details: `Problema reapareceu após resolução anterior. Nova ocorrência registrada no app v${technicalContext.appVersion || 'desconhecida'}.`
      });
    }

    // Adiciona nova mídia afetada se não existir
    const affectedMedia = [...cluster.affectedMedia];
    if (technicalContext.canonicalMediaId && !affectedMedia.some(m => m.id === technicalContext.canonicalMediaId)) {
      affectedMedia.push({
        id: technicalContext.canonicalMediaId,
        title: technicalContext.mediaTitle || technicalContext.canonicalMediaId,
        type: technicalContext.mediaType || 'movie'
      });
    }

    // Adiciona novo episódio se não existir e não for filme
    const isMovie = technicalContext.mediaType === 'movie';
    const affectedEpisodes = [...cluster.affectedEpisodes];
    if (!isMovie && technicalContext.season && technicalContext.episode) {
      const epExists = affectedEpisodes.some(
        e => e.season === technicalContext.season && e.episode === technicalContext.episode
      );
      if (!epExists) {
        affectedEpisodes.push({
          season: technicalContext.season,
          episode: technicalContext.episode
        });
      }
    }

    // Atualiza listas únicas
    const affectedSources = Array.from(new Set([
      ...cluster.affectedSources,
      ...(technicalContext.sourceId ? [technicalContext.sourceId] : [])
    ]));

    const affectedProviders = Array.from(new Set([
      ...cluster.affectedProviders,
      ...(technicalContext.providerId ? [technicalContext.providerId] : [])
    ]));

    const affectedVersions = Array.from(new Set([
      ...cluster.affectedVersions,
      ...(technicalContext.appVersion ? [technicalContext.appVersion] : [])
    ]));

    const errorCodes = Array.from(new Set([
      ...cluster.errorCodes,
      ...(technicalContext.errorCode ? [technicalContext.errorCode] : [])
    ]));

    const languagesInvolved = Array.from(new Set([
      ...cluster.languagesInvolved,
      ...(technicalContext.requestedLanguage ? [technicalContext.requestedLanguage] : []),
      ...(technicalContext.declaredLanguage ? [technicalContext.declaredLanguage] : [])
    ]));

    const totalReports = cluster.totalReports + 1;
    const recentReportsCount = cluster.recentReportsCount + 1;
    const priority = this.calculatePriority(cluster.category, totalReports, affectedMedia.length, isRegression);
    const trend = this.calculateTrend(recentReportsCount, totalReports, isRegression);

    history.push({
      id: `hist_${now}_add`,
      timestamp: now,
      action: 'report_added',
      performedBy: 'Sistema (Novo Relato)',
      details: `Relato #${report.id} associado ao cluster. Total de relatos: ${totalReports}.`
    });

    const updatedCluster: IssueCluster = {
      ...cluster,
      totalReports,
      recentReportsCount,
      lastOccurrenceAt: now,
      priority,
      status: newStatus,
      trend,
      affectedMedia,
      affectedEpisodes,
      affectedSources,
      affectedProviders,
      affectedVersions,
      errorCodes,
      languagesInvolved,
      isPromptOutdated: true, // Marca que o prompt precisa ser atualizado com as novas evidências
      isRegression: isRegression || cluster.isRegression,
      regressionDetails,
      history
    };

    return { updatedCluster, isRegressionDetected: isRegression };
  }

  private static hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
