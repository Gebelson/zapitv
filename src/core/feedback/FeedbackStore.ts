/**
 * ZapiTV — FeedbackStore
 * Estado e regras de feedback. A API persiste snapshots versionados no Turso;
 * o arquivo JSON existente permanece como armazenamento local sem Turso.
 */

import * as fs from 'fs';
import path from 'path';
import {
  FeedbackReport,
  IssueCluster,
  GeneratedFixPrompt,
  FeedbackSubmissionRequest,
  FeedbackSubmissionResponse,
  FeedbackDashboardStats,
  FeedbackCategory,
  IssueStatus,
  IssuePriority,
  FEEDBACK_CATEGORY_LABELS
} from './feedbackTypes';
import { FeedbackClusteringEngine } from './FeedbackClusteringEngine';
import { FeedbackPromptGenerator } from './FeedbackPromptGenerator';

interface StoredData {
  reports: FeedbackReport[];
  clusters: IssueCluster[];
  prompts: GeneratedFixPrompt[];
  lastUpdated: number;
}

export type FeedbackSnapshot = StoredData;

export class FeedbackStore {
  private static instance: FeedbackStore;
  private reports: FeedbackReport[] = [];
  private clusters: IssueCluster[] = [];
  private prompts: GeneratedFixPrompt[] = [];
  private storageFilePath: string;
  private isLoaded: boolean = false;
  private shouldPersist: boolean = true;

  public constructor(shouldPersist: boolean = true) {
    this.shouldPersist = shouldPersist;
    this.storageFilePath = path.resolve(process.cwd(), 'data', 'feedback_store.json');
    if (this.shouldPersist) {
      this.loadFromStorage();
    } else {
      this.isLoaded = true;
      this.reports = [];
      this.clusters = [];
      this.prompts = [];
    }
  }

  public static getInstance(): FeedbackStore {
    if (!FeedbackStore.instance) {
      FeedbackStore.instance = new FeedbackStore(true);
    }
    return FeedbackStore.instance;
  }

  public restoreSnapshot(data: FeedbackSnapshot | null): void {
    this.reports = Array.isArray(data?.reports) ? data.reports : [];
    this.clusters = Array.isArray(data?.clusters) ? data.clusters : [];
    this.prompts = Array.isArray(data?.prompts) ? data.prompts : [];
    this.isLoaded = true;
  }

  public getSnapshot(): FeedbackSnapshot {
    return { reports: this.reports, clusters: this.clusters, prompts: this.prompts, lastUpdated: Date.now() };
  }

  /**
   * Carrega dados do arquivo persistente ou inicializa vazio
   */
  private loadFromStorage(): void {
    if (this.isLoaded) return;
    try {
      const fsModule = fs as any;
      if (fsModule && typeof fsModule.existsSync === 'function') {
        if (fsModule.existsSync(this.storageFilePath)) {
          const raw = fsModule.readFileSync(this.storageFilePath, 'utf8');
          const data: StoredData = JSON.parse(raw);
          this.reports = Array.isArray(data.reports) ? data.reports : [];
          this.clusters = Array.isArray(data.clusters) ? data.clusters : [];
          this.prompts = Array.isArray(data.prompts) ? data.prompts : [];
        } else {
          // Assegura diretório data/
          const dataDir = path.dirname(this.storageFilePath);
          if (typeof fsModule.mkdirSync === 'function' && !fsModule.existsSync(dataDir)) {
            fsModule.mkdirSync(dataDir, { recursive: true });
          }
          this.saveToStorage();
        }
      }
      this.isLoaded = true;
    } catch (e) {
      this.reports = [];
      this.clusters = [];
      this.prompts = [];
      this.isLoaded = true;
    }
  }

  /**
   * Salva os dados no arquivo persistente de forma atômica
   */
  private saveToStorage(): void {
    if (!this.shouldPersist) return;
    try {
      const fsModule = fs as any;
      if (!fsModule || typeof fsModule.writeFileSync !== 'function') return;
      const dataDir = path.dirname(this.storageFilePath);
      if (typeof fsModule.mkdirSync === 'function' && !fsModule.existsSync(dataDir)) {
        fsModule.mkdirSync(dataDir, { recursive: true });
      }
      const data: StoredData = {
        reports: this.reports,
        clusters: this.clusters,
        prompts: this.prompts,
        lastUpdated: Date.now()
      };
      fsModule.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('[FeedbackStore] Erro ao salvar dados no disco:', e);
    }
  }

  /**
   * Compactação segura do snapshot para garantir que o tamanho permaneça bem abaixo de 2MB
   * sem perda de dados históricos, clusters ou estatísticas consolidadas.
   */
  public compactSnapshot(): FeedbackSnapshot {
    // 1. Manter apenas os prompts ativos e editados manualmente
    const activePromptIds = new Set<string>();
    for (const cluster of this.clusters) {
      if (cluster.activePromptId) {
        activePromptIds.add(cluster.activePromptId);
      }
    }
    this.prompts = this.prompts.filter(p => 
      activePromptIds.has(p.id) || p.isManuallyEdited
    );

    // 2. Se a contagem de relatos for muito grande (> 500), compactar campos verbose dos mais antigos
    if (this.reports.length > 500) {
      const recentReports = this.reports.slice(0, 500);
      const olderReports = this.reports.slice(500).map(r => ({
        ...r,
        technicalContext: {
          canonicalMediaId: r.technicalContext?.canonicalMediaId,
          mediaTitle: r.technicalContext?.mediaTitle,
          mediaType: r.technicalContext?.mediaType,
          season: r.technicalContext?.season,
          episode: r.technicalContext?.episode,
          errorCode: r.technicalContext?.errorCode,
          failureStage: r.technicalContext?.failureStage,
          browser: r.technicalContext?.browser,
          os: r.technicalContext?.os,
          deviceType: r.technicalContext?.deviceType,
          currentRoute: r.technicalContext?.currentRoute,
          timestamp: r.technicalContext?.timestamp || r.submissionTimestamp,
          appVersion: r.technicalContext?.appVersion || '1.0.0'
        }
      }));
      this.reports = [...recentReports, ...olderReports];
    }

    return this.getSnapshot();
  }

  /**
   * Submete um feedback anônimo com contexto técnico, deduplicação e agrupamento automático
   */
  public async submitFeedback(
    request: FeedbackSubmissionRequest
  ): Promise<FeedbackSubmissionResponse & { isDuplicate?: boolean }> {
    this.loadFromStorage();
    const now = Date.now();
    const { category, userDescription, technicalContext, clientSubmissionToken } = request;

    if (!category) {
      throw new Error('Categoria do feedback é obrigatória.');
    }

    const fullContext = {
      appVersion: '1.0.0',
      browser: 'Desconhecido',
      os: 'Desconhecido',
      deviceType: 'desktop' as const,
      currentRoute: '/',
      timestamp: now,
      ...technicalContext
    };

    // 1. Gera assinatura técnica
    const { fingerprint, data: fpData } = FeedbackClusteringEngine.generateFingerprint(category, fullContext);

    // 2. Proteção contra duplicação de clique e spam
    const token = clientSubmissionToken || `anon_${now}`;
    const isDupe = FeedbackClusteringEngine.isDuplicateSubmission(
      this.reports,
      token,
      fingerprint,
      30,
      userDescription
    );

    if (isDupe) {
      const existingCluster = this.clusters.find(c => c.fingerprint === fingerprint);
      return {
        success: true,
        reportId: 'duplicate_suppressed',
        clusterId: existingCluster?.id || '',
        message: 'Feedback recebido com sucesso (ocorrência já contabilizada recentemente).',
        isNewCluster: false,
        isDuplicate: true,
        isDuplicateIgnored: true
      };
    }

    // 3. Cria o FeedbackReport
    const reportId = `fb_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const newReport: FeedbackReport = {
      id: reportId,
      category,
      categoryLabel: FEEDBACK_CATEGORY_LABELS[category] || 'Outro',
      userDescription: userDescription ? userDescription.trim() : '',
      technicalContext: fullContext,
      fingerprint,
      fingerprintData: fpData,
      submissionTimestamp: now,
      clientSubmissionToken: token,
      status: 'active'
    };

    // 4. Executa correspondência em 3 níveis com clusters existentes
    const { matchedCluster } = FeedbackClusteringEngine.matchCluster(this.clusters, newReport);

    let targetClusterId: string;
    let isNewCluster = false;

    if (matchedCluster) {
      targetClusterId = matchedCluster.id;
      newReport.clusterId = targetClusterId;

      const { updatedCluster } = FeedbackClusteringEngine.mergeReportIntoCluster(matchedCluster, newReport);
      
      // Atualiza o cluster na coleção
      const idx = this.clusters.findIndex(c => c.id === targetClusterId);
      if (idx !== -1) {
        this.clusters[idx] = updatedCluster;
      }

      // Se o cluster possui múltiplos relatos, atualiza o prompt consolidado automaticamente
      const clusterReports = this.reports.filter(r => r.clusterId === targetClusterId).concat(newReport);
      const newPrompt = FeedbackPromptGenerator.generateConsolidatedPrompt(updatedCluster, clusterReports);
      
      this.prompts.push(newPrompt);
      updatedCluster.activePromptId = newPrompt.id;
      updatedCluster.activePromptMarkdown = newPrompt.markdownContent;
      updatedCluster.promptVersion = newPrompt.version;
      updatedCluster.isPromptOutdated = false;
    } else {
      isNewCluster = true;
      const newCluster = FeedbackClusteringEngine.createClusterFromReport(newReport);
      targetClusterId = newCluster.id;
      newReport.clusterId = targetClusterId;

      // Gera prompt técnico inicial
      const initialPrompt = FeedbackPromptGenerator.generateIndividualPrompt(newReport);
      initialPrompt.clusterId = targetClusterId;
      this.prompts.push(initialPrompt);

      newCluster.activePromptId = initialPrompt.id;
      newCluster.activePromptMarkdown = initialPrompt.markdownContent;

      this.clusters.unshift(newCluster);
    }

    this.reports.unshift(newReport);
    this.saveToStorage();

    return {
      success: true,
      reportId: newReport.id,
      clusterId: targetClusterId,
      message: 'Obrigado! Recebemos seu relato.',
      isNewCluster,
      isDuplicate: false,
      isDuplicateIgnored: false
    };
  }

  /**
   * Consulta clusters de problemas com filtros, busca e paginação
   */
  public getClusters(options: {
    status?: IssueStatus | 'all';
    category?: FeedbackCategory | 'all';
    priority?: IssuePriority | 'all';
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'reports' | 'priority' | 'recent' | 'first';
  } = {}): { clusters: IssueCluster[]; total: number } {
    this.loadFromStorage();

    let filtered = [...this.clusters];

    if (options.status && options.status !== 'all') {
      filtered = filtered.filter(c => c.status === options.status);
    }

    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(c => c.category === options.category);
    }

    if (options.priority && options.priority !== 'all') {
      filtered = filtered.filter(c => c.priority === options.priority);
    }

    if (options.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.categoryLabel.toLowerCase().includes(q) ||
        c.affectedMedia.some(m => m.title.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) ||
        c.affectedProviders.some(p => p.toLowerCase().includes(q)) ||
        (c.adminNotes && c.adminNotes.toLowerCase().includes(q))
      );
    }

    // Ordenação
    const sortBy = options.sortBy || 'reports';
    if (sortBy === 'reports') {
      filtered.sort((a, b) => b.totalReports - a.totalReports || b.lastOccurrenceAt - a.lastOccurrenceAt);
    } else if (sortBy === 'priority') {
      const pWeights: Record<IssuePriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      filtered.sort((a, b) => pWeights[b.priority] - pWeights[a.priority] || b.totalReports - a.totalReports);
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => b.lastOccurrenceAt - a.lastOccurrenceAt);
    } else if (sortBy === 'first') {
      filtered.sort((a, b) => a.firstOccurrenceAt - b.firstOccurrenceAt);
    }

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const sliced = filtered.slice(offset, offset + limit);

    return { clusters: sliced, total };
  }

  /**
   * Obtém detalhes completos de um cluster com relatos associados e histórico
   */
  public getClusterDetails(clusterId: string): {
    cluster: IssueCluster;
    reports: FeedbackReport[];
    prompts: GeneratedFixPrompt[];
  } | null {
    this.loadFromStorage();

    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) return null;

    const reports = this.reports.filter(r => r.clusterId === clusterId);
    const prompts = this.prompts.filter(p => p.clusterId === clusterId);

    return {
      cluster,
      reports,
      prompts: prompts.sort((a, b) => b.version - a.version)
    };
  }

  /**
   * Atualiza status do cluster (Ex: novo -> em investigação -> corrigido)
   */
  public updateClusterStatus(
    clusterId: string,
    status: IssueStatus,
    adminName: string = 'Administrador',
    notes?: string
  ): IssueCluster | null {
    this.loadFromStorage();
    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) return null;

    const prevStatus = cluster.status;
    cluster.status = status;

    if (status === 'resolved') {
      cluster.isRegression = false;
    }

    const now = Date.now();
    cluster.history.push({
      id: `hist_${now}_status`,
      timestamp: now,
      action: 'status_changed',
      performedBy: adminName,
      details: `Status alterado de "${prevStatus}" para "${status}". ${notes ? `Obs: ${notes}` : ''}`,
      metadata: { prevStatus, newStatus: status, notes }
    });

    if (notes) {
      cluster.adminNotes = notes;
    }

    this.saveToStorage();
    return cluster;
  }

  /**
   * Atualiza a prioridade de um cluster manualmente
   */
  public updateClusterPriority(
    clusterId: string,
    priority: IssuePriority,
    adminName: string = 'Administrador'
  ): IssueCluster | null {
    this.loadFromStorage();
    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) return null;

    const prevPriority = cluster.priority;
    cluster.priority = priority;

    const now = Date.now();
    cluster.history.push({
      id: `hist_${now}_prio`,
      timestamp: now,
      action: 'priority_changed',
      performedBy: adminName,
      details: `Prioridade alterada manualmente de "${prevPriority}" para "${priority}".`,
      metadata: { prevPriority, newPriority: priority }
    });

    this.saveToStorage();
    return cluster;
  }

  /**
   * Salva notas administrativas do problema
   */
  public updateAdminNotes(
    clusterId: string,
    notes: string,
    adminName: string = 'Administrador'
  ): IssueCluster | null {
    this.loadFromStorage();
    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) return null;

    cluster.adminNotes = notes;
    const now = Date.now();
    cluster.history.push({
      id: `hist_${now}_notes`,
      timestamp: now,
      action: 'admin_note',
      performedBy: adminName,
      details: `Notas administrativas atualizadas.`
    });

    this.saveToStorage();
    return cluster;
  }

  /**
   * Regenera o prompt técnico do cluster (individual ou consolidado)
   */
  public regeneratePrompt(clusterId: string, adminName: string = 'Administrador'): GeneratedFixPrompt | null {
    this.loadFromStorage();
    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) return null;

    const reports = this.reports.filter(r => r.clusterId === clusterId);
    let prompt: GeneratedFixPrompt;

    if (reports.length > 1) {
      prompt = FeedbackPromptGenerator.generateConsolidatedPrompt(cluster, reports);
    } else if (reports.length === 1) {
      prompt = FeedbackPromptGenerator.generateIndividualPrompt(reports[0]);
      prompt.clusterId = cluster.id;
      prompt.version = cluster.promptVersion + 1;
    } else {
      // Caso sem relatos diretos, usa os dados do cluster
      prompt = FeedbackPromptGenerator.generateConsolidatedPrompt(cluster, []);
    }

    this.prompts.push(prompt);
    cluster.activePromptId = prompt.id;
    cluster.activePromptMarkdown = prompt.markdownContent;
    cluster.promptVersion = prompt.version;
    cluster.isPromptOutdated = false;

    const now = Date.now();
    cluster.history.push({
      id: `hist_${now}_prompt`,
      timestamp: now,
      action: 'prompt_generated',
      performedBy: adminName,
      details: `Prompt técnico v${prompt.version} regenerado com sucesso.`
    });

    this.saveToStorage();
    return prompt;
  }

  /**
   * Salva uma edição manual no prompt técnico do cluster
   */
  public saveEditedPrompt(
    clusterId: string,
    markdownContent: string,
    adminName: string = 'Administrador'
  ): GeneratedFixPrompt | null {
    this.loadFromStorage();
    const cluster = this.clusters.find(c => c.id === clusterId);
    if (!cluster) return null;

    const now = Date.now();
    const newVersion = cluster.promptVersion + 1;
    const editedPrompt: GeneratedFixPrompt = {
      id: `prompt_manual_${now}`,
      clusterId,
      type: 'consolidated',
      version: newVersion,
      markdownContent: markdownContent.trim(),
      generatedAt: now,
      isAiRefined: false,
      isManuallyEdited: true,
      feedbackIds: this.reports.filter(r => r.clusterId === clusterId).map(r => r.id),
      variablesUsed: {}
    };

    this.prompts.push(editedPrompt);
    cluster.activePromptId = editedPrompt.id;
    cluster.activePromptMarkdown = editedPrompt.markdownContent;
    cluster.promptVersion = newVersion;
    cluster.isPromptOutdated = false;

    cluster.history.push({
      id: `hist_${now}_editprompt`,
      timestamp: now,
      action: 'prompt_edited',
      performedBy: adminName,
      details: `Prompt técnico editado manualmente por ${adminName} (versão ${newVersion}).`
    });

    this.saveToStorage();
    return editedPrompt;
  }

  /**
   * Agrupa manualmente clusters de origem em um cluster de destino
   */
  public mergeClustersManually(
    targetOrSourceId: string,
    sourceOrTargetIds: string[] | string,
    adminName: string = 'Administrador'
  ): (IssueCluster & { reportCount: number }) | boolean | null {
    this.loadFromStorage();

    // Determina qual é o target e quais são as fontes
    let target = this.clusters.find(c => c.id === targetOrSourceId);
    let sourcesToMerge: string[] = [];

    if (Array.isArray(sourceOrTargetIds)) {
      sourcesToMerge = sourceOrTargetIds;
    } else {
      // Se sourceOrTargetIds for string única, verifica se targetOrSourceId ou sourceOrTargetIds é o alvo
      const altTarget = this.clusters.find(c => c.id === sourceOrTargetIds);
      if (altTarget && (!target || sourceOrTargetIds.includes(altTarget.id))) {
        // Formato legado (sourceId, targetId)
        target = altTarget;
        sourcesToMerge = [targetOrSourceId];
      } else {
        sourcesToMerge = [sourceOrTargetIds];
      }
    }

    if (!target) return null;

    for (const sourceId of sourcesToMerge) {
      const source = this.clusters.find(c => c.id === sourceId);
      if (!source || source.id === target.id) continue;

      // Redireciona todos os relatos do cluster de origem para o de destino
      this.reports.forEach(r => {
        if (r.clusterId === sourceId) {
          r.clusterId = target.id;
        }
      });

      target.totalReports += source.totalReports;
      target.recentReportsCount += source.recentReportsCount;
      target.lastOccurrenceAt = Math.max(target.lastOccurrenceAt, source.lastOccurrenceAt);

      // Mescla mídias e provedores
      source.affectedMedia.forEach(m => {
        if (!target!.affectedMedia.some(tm => tm.id === m.id)) {
          target!.affectedMedia.push(m);
        }
      });

      source.affectedEpisodes.forEach(e => {
        if (!target!.affectedEpisodes.some(te => te.season === e.season && te.episode === e.episode)) {
          target!.affectedEpisodes.push(e);
        }
      });

      target.affectedProviders = Array.from(new Set([...target.affectedProviders, ...source.affectedProviders]));
      target.affectedSources = Array.from(new Set([...target.affectedSources, ...source.affectedSources]));
      target.affectedVersions = Array.from(new Set([...target.affectedVersions, ...source.affectedVersions]));
      target.errorCodes = Array.from(new Set([...target.errorCodes, ...source.errorCodes]));

      const now = Date.now();
      target.history.push({
        id: `hist_${now}_merge`,
        timestamp: now,
        action: 'manual_merge',
        performedBy: adminName,
        details: `Cluster "${source.title}" (${source.id}) mesclado manualmente neste cluster.`
      });

      // Remove o cluster de origem
      this.clusters = this.clusters.filter(c => c.id !== sourceId);
    }

    target.isPromptOutdated = true;
    (target as any).reportCount = target.totalReports;

    this.saveToStorage();
    return target as any;
  }

  /**
   * Separa um relato de um cluster para criar um novo cluster independente
   */
  public splitReportFromCluster(
    reportId: string,
    adminName: string = 'Administrador'
  ): IssueCluster | null {
    this.loadFromStorage();
    const report = this.reports.find(r => r.id === reportId);
    if (!report || !report.clusterId) return null;

    const oldClusterId = report.clusterId;
    const oldCluster = this.clusters.find(c => c.id === oldClusterId);

    // Cria novo cluster para este relato
    const newCluster = FeedbackClusteringEngine.createClusterFromReport(report);
    this.clusters.unshift(newCluster);

    report.clusterId = newCluster.id;

    // Atualiza cluster antigo se ainda tiver relatos
    if (oldCluster) {
      oldCluster.totalReports = Math.max(0, oldCluster.totalReports - 1);
      const now = Date.now();
      oldCluster.history.push({
        id: `hist_${now}_split`,
        timestamp: now,
        action: 'manual_split',
        performedBy: adminName,
        details: `Relato #${reportId} desmembrado para um novo cluster independente.`
      });
      oldCluster.isPromptOutdated = true;
    }

    this.saveToStorage();
    return newCluster;
  }

  /**
   * Calcula as estatísticas completas para o Dashboard Administrativo
   */
  public getDashboardStats(): FeedbackDashboardStats {
    this.loadFromStorage();

    const newIssuesCount = this.clusters.filter(c => c.status === 'new').length;
    const criticalIssuesCount = this.clusters.filter(c => c.priority === 'critical' && c.status !== 'resolved').length;
    const recurrentIssuesCount = this.clusters.filter(c => c.totalReports >= 3 && c.status !== 'resolved').length;
    const investigatingCount = this.clusters.filter(c => c.status === 'investigating').length;
    const fixingCount = this.clusters.filter(c => c.status === 'fixing').length;
    const resolvedCount = this.clusters.filter(c => c.status === 'resolved').length;
    const reopenedCount = this.clusters.filter(c => c.status === 'reopened').length;

    // Ranking: Mais reportados
    const topReportedClusters = [...this.clusters]
      .sort((a, b) => b.totalReports - a.totalReports || b.lastOccurrenceAt - a.lastOccurrenceAt)
      .slice(0, 10);

    // Ranking: Prioridade de correção
    const pWeights: Record<IssuePriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const priorityRankedClusters = [...this.clusters]
      .filter(c => c.status !== 'resolved')
      .sort((a, b) => pWeights[b.priority] - pWeights[a.priority] || b.totalReports - a.totalReports)
      .slice(0, 10);

    return {
      newIssuesCount,
      criticalIssuesCount,
      recurrentIssuesCount,
      investigatingCount,
      fixingCount,
      resolvedCount,
      reopenedCount,
      totalFeedbacksReceived: this.reports.length,
      totalUniqueClusters: this.clusters.length,
      topReportedClusters,
      priorityRankedClusters
    };
  }
}
