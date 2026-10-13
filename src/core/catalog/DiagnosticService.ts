import { mediaAvailabilityIndex, MediaAvailability, AvailabilityStats } from './MediaAvailabilityIndex';
import { providerRegistry } from '../providers/providerRegistry';

export interface ProviderDiagnostic {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'checking' | 'error';
  queryCount: number;
  successCount: number;
  errorCount: number;
  averageLatencyMs: number;
  lastChecked?: string;
  lastError?: string;
}

export interface RejectionStats {
  parkedOrAdDomain: number;
  unreleasedMedia: number;
  identityMismatch: number;
  camOrTelesync: number;
  invalidMediaFormat: number;
  other: number;
}

export interface CatalogDiagnosticReport {
  timestamp: string;
  discovery: {
    totalDiscovered: number;
    moviesCount: number;
    seriesCount: number;
    animesCount: number;
  };
  availability: AvailabilityStats;
  sources: {
    totalFound: number;
    totalValid: number;
    totalRejected: number;
    dubbedPtBrCount: number;
    originalAudioCount: number;
  };
  providers: ProviderDiagnostic[];
  rejections: RejectionStats;
}

export interface CanonicalTraceResult {
  query: string;
  canonicalKey: string;
  status: string;
  record?: MediaAvailability;
  isPlayable: boolean;
  explanation: string;
  providersChecked: string[];
  recommendation: string;
}

export class DiagnosticService {
  private static instance: DiagnosticService;
  private discoveredMovies = new Set<string>();
  private discoveredSeries = new Set<string>();
  private discoveredAnimes = new Set<string>();

  private totalSourcesFound = 0;
  private totalSourcesValid = 0;
  private totalSourcesRejected = 0;
  private sourcesPtBr = 0;
  private sourcesOriginal = 0;

  private rejections: RejectionStats = {
    parkedOrAdDomain: 0,
    unreleasedMedia: 0,
    identityMismatch: 0,
    camOrTelesync: 0,
    invalidMediaFormat: 0,
    other: 0
  };

  private providerMetrics = new Map<string, { queryCount: number; successCount: number; errorCount: number; latencies: number[] }>();

  public static getInstance(): DiagnosticService {
    if (!DiagnosticService.instance) {
      DiagnosticService.instance = new DiagnosticService();
    }
    return DiagnosticService.instance;
  }

  public recordDiscovered(canonicalId: string, type: 'movie' | 'series' | 'anime'): void {
    if (type === 'movie') this.discoveredMovies.add(canonicalId);
    else if (type === 'series') this.discoveredSeries.add(canonicalId);
    else if (type === 'anime') this.discoveredAnimes.add(canonicalId);
  }

  public recordSourceFound(isPtBr: boolean, isValid: boolean): void {
    this.totalSourcesFound++;
    if (isValid) {
      this.totalSourcesValid++;
      if (isPtBr) this.sourcesPtBr++;
      else this.sourcesOriginal++;
    } else {
      this.totalSourcesRejected++;
    }
  }

  public recordRejection(reason: keyof RejectionStats): void {
    this.totalSourcesRejected++;
    if (this.rejections[reason] !== undefined) {
      this.rejections[reason]++;
    } else {
      this.rejections.other++;
    }
  }

  public recordProviderQuery(providerId: string, latencyMs: number, success: boolean): void {
    let metric = this.providerMetrics.get(providerId);
    if (!metric) {
      metric = { queryCount: 0, successCount: 0, errorCount: 0, latencies: [] };
      this.providerMetrics.set(providerId, metric);
    }
    metric.queryCount++;
    if (success) {
      metric.successCount++;
      metric.latencies.push(latencyMs);
      if (metric.latencies.length > 50) metric.latencies.shift();
    } else {
      metric.errorCount++;
    }
  }

  public getFullReport(): CatalogDiagnosticReport {
    const rawProviders = providerRegistry.getProviders();
    const providersReport: ProviderDiagnostic[] = rawProviders.map(p => {
      const metric = this.providerMetrics.get(p.id) || { queryCount: 0, successCount: 0, errorCount: 0, latencies: [] };
      const avgLatency = metric.latencies.length > 0 
        ? Math.round(metric.latencies.reduce((a, b) => a + b, 0) / metric.latencies.length) 
        : (p.latencyMs || 0);

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        queryCount: metric.queryCount,
        successCount: metric.successCount,
        errorCount: metric.errorCount,
        averageLatencyMs: avgLatency,
        lastChecked: p.lastChecked,
        lastError: p.errorMessage
      };
    });

    return {
      timestamp: new Date().toISOString(),
      discovery: {
        totalDiscovered: this.discoveredMovies.size + this.discoveredSeries.size + this.discoveredAnimes.size,
        moviesCount: this.discoveredMovies.size,
        seriesCount: this.discoveredSeries.size,
        animesCount: this.discoveredAnimes.size
      },
      availability: mediaAvailabilityIndex.getStats(),
      sources: {
        totalFound: this.totalSourcesFound,
        totalValid: this.totalSourcesValid,
        totalRejected: this.totalSourcesRejected,
        dubbedPtBrCount: this.sourcesPtBr,
        originalAudioCount: this.sourcesOriginal
      },
      providers: providersReport,
      rejections: { ...this.rejections }
    };
  }

  /**
   * Rastreia a decisão de disponibilidade e filtragem para um identificador ou título específico
   */
  public traceItem(queryOrId: string): CanonicalTraceResult {
    const clean = queryOrId.trim();
    const canonicalKey = mediaAvailabilityIndex.getCanonicalKey({
      id: clean,
      imdbId: clean.startsWith('tt') ? clean : undefined,
      title: clean
    });

    const record = mediaAvailabilityIndex.getRecord(canonicalKey);
    const isPlayable = mediaAvailabilityIndex.isPubliclyPlayable(canonicalKey);

    let explanation = '';
    let recommendation = '';

    if (!record) {
      explanation = `O título '${clean}' ainda não foi submetido à fila de verificação de disponibilidade ou foi descoberto recentemente sem cache salvo.`;
      recommendation = `Submeter à fila assíncrona CatalogAvailabilityQueue.`;
    } else {
      switch (record.status) {
        case 'AVAILABLE':
          explanation = `Título confirmado como DISPONÍVEL com ${record.validatedSourceCount} fonte(s) válida(s). Áudio PT-BR: ${record.hasPtBrAudio ? 'Sim (🔊)' : 'Não (Áudio Original)'}. Legendas PT-BR: ${record.hasPtSubtitles ? 'Sim (💬)' : 'Não'}.`;
          recommendation = `Elegível para exibição pública e reprodução imediata.`;
          break;
        case 'CHECKING':
          explanation = `O título está atualmente sendo verificado nos provedores ativos em segundo plano.`;
          recommendation = `Aguardar conclusão do worker sem bloquear interface.`;
          break;
        case 'TEMPORARY_ERROR':
          explanation = `Ocorreu uma falha temporária de rede ou timeout durante a consulta: ${record.lastError || 'Timeout'}. Não classificado como sem fonte.`;
          recommendation = `Será revalidado automaticamente em 15 minutos.`;
          break;
        case 'UNAVAILABLE_CONFIRMED':
          explanation = `Todos os provedores habilitados foram consultados com sucesso e confirmaram ausência de streams válidos para este título.`;
          recommendation = `Permanece oculto do catálogo público até nova revalidação periódica.`;
          break;
        case 'EXPIRED':
          explanation = `Registro de disponibilidade anterior expirou o tempo limite de cache (TTL).`;
          recommendation = `Necessita revalidação sob demanda.`;
          break;
        case 'DISCOVERED':
          explanation = `Título descoberto no catálogo de metadados, mas a verificação de streams ainda não foi concluída.`;
          recommendation = `Priorizar na fila de disponibilidade.`;
          break;
      }
    }

    return {
      query: clean,
      canonicalKey,
      status: record?.status || 'DISCOVERED',
      record,
      isPlayable,
      explanation,
      providersChecked: record?.providersChecked || [],
      recommendation
    };
  }
}

export const diagnosticService = DiagnosticService.getInstance();
