import { ContentItem, ContentType } from '../../../types';
import { mediaAvailabilityIndex } from './MediaAvailabilityIndex';
import { diagnosticService } from './DiagnosticService';
import { providerRegistry } from '../providers/providerRegistry';
import { VERIFIED_OPEN_ITEMS } from './verifiedCatalog';

export interface QueueItem {
  item: ContentItem;
  priority: number; // Higher number = checked first
  addedAt: number;
}

export class CatalogAvailabilityQueue {
  private static instance: CatalogAvailabilityQueue;
  private queue: QueueItem[] = [];
  private inFlight = new Set<string>();
  private maxConcurrency = 3; // Limite de concorrência simultânea para não sobrecarregar
  private isProcessing = false;
  private listeners = new Set<(completedKey: string) => void>();

  public static getInstance(): CatalogAvailabilityQueue {
    if (!CatalogAvailabilityQueue.instance) {
      CatalogAvailabilityQueue.instance = new CatalogAvailabilityQueue();
    }
    return CatalogAvailabilityQueue.instance;
  }

  /**
   * Enfileira um item para verificação de disponibilidade em segundo plano
   */
  public enqueue(item: ContentItem, priority = 1): void {
    const key = mediaAvailabilityIndex.getCanonicalKey(item);

    // Se já for um item do acervo verificado local, marca como disponível imediatamente
    const isOpenVerified = VERIFIED_OPEN_ITEMS.some(v => 
      v.id === item.id || 
      (v.tmdbId && v.tmdbId === item.tmdbId) || 
      (v.imdbId && v.imdbId === item.imdbId)
    );
    if (isOpenVerified) {
      mediaAvailabilityIndex.markAvailable(key, item.type === ContentType.MOVIE ? 'movie' : (item.type === ContentType.ANIME ? 'anime' : 'series'), {
        title: item.title,
        sourceCount: 2,
        providersChecked: ['Acervo ZapiTV Verificado'],
        hasPtBrAudio: true,
        hasPtSubtitles: true,
        bestQuality: '1080p'
      });
      return;
    }

    // Se já estiver no cache com status AVAILABLE e dentro do prazo, dispensa nova checagem imediata
    const status = mediaAvailabilityIndex.getStatus(key);
    if (status === 'AVAILABLE') {
      return;
    }

    // Se já está na fila ou em processamento, apenas atualiza prioridade se for maior
    const existing = this.queue.find(q => mediaAvailabilityIndex.getCanonicalKey(q.item) === key);
    if (existing) {
      if (priority > existing.priority) {
        existing.priority = priority;
        this.sortQueue();
      }
      return;
    }

    if (this.inFlight.has(key)) {
      return;
    }

    this.queue.push({ item, priority, addedAt: Date.now() });
    this.sortQueue();
    this.processNext();
  }

  /**
   * Enfileira múltiplos itens em lote
   */
  public enqueueBatch(items: ContentItem[], priority = 1): void {
    for (const item of items) {
      this.enqueue(item, priority);
    }
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => b.priority - a.priority || a.addedAt - b.addedAt);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.inFlight.size < this.maxConcurrency) {
        const next = this.queue.shift();
        if (!next) break;

        const key = mediaAvailabilityIndex.getCanonicalKey(next.item);
        if (this.inFlight.has(key)) continue;

        this.inFlight.add(key);
        // Processa individualmente sem bloquear o loop
        this.verifyItem(next.item, key).finally(() => {
          this.inFlight.delete(key);
          this.processNext();
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async verifyItem(item: ContentItem, key: string): Promise<void> {
    const mediaType = item.type === ContentType.MOVIE ? 'movie' : (item.type === ContentType.ANIME ? 'anime' : 'series');
    mediaAvailabilityIndex.markChecking(key, mediaType, item.title);

    const startTime = Date.now();
    try {
      const activeProviders = providerRegistry.getProviders().filter(p => p.enabled);
      const providerNames = activeProviders.map(p => p.name);

      // Consulta de streams com timeout de segurança controlado
      const streams = await Promise.race([
        providerRegistry.resolveStreams(
          mediaType,
          {
            id: item.id,
            imdbId: item.imdbId,
            tmdbId: item.tmdbId,
            title: item.title
          }
        ),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ALL_PROVIDERS')), 10000))
      ]);

      const validStreams = Array.isArray(streams) ? streams : [];
      const latencyMs = Date.now() - startTime;

      if (validStreams.length > 0) {
        const hasPtBr = validStreams.some(s => s.isPtBr || s.isDubbed);
        const hasPtSub = validStreams.some(s => s.hasPtSubtitle || s.isSubtitled);
        const bestQ = validStreams[0].quality || '1080p';

        mediaAvailabilityIndex.markAvailable(key, mediaType, {
          title: item.title,
          sourceCount: validStreams.length,
          providersChecked: providerNames,
          hasPtBrAudio: hasPtBr,
          hasPtSubtitles: hasPtSub,
          bestQuality: bestQ,
          episodeCount: item.episodes?.length || 1
        });

        diagnosticService.recordSourceFound(hasPtBr, true);
        this.notify(key);
      } else {
        // Se todas as consultas retornaram 200/vazio sem erro: UNAVAILABLE_CONFIRMED
        mediaAvailabilityIndex.markUnavailableConfirmed(key, mediaType, providerNames, item.title);
        diagnosticService.recordRejection('other');
        this.notify(key);
      }
    } catch (err: any) {
      // Regra Obrigatória: TIMEOUT NÃO É IGUAL A SEM FONTE!
      // Registra como TEMPORARY_ERROR para revalidação assíncrona
      const errMsg = err?.message || 'Falha temporária de rede';
      mediaAvailabilityIndex.markTemporaryError(key, mediaType, errMsg, ['Provedores em Timeout/Offline']);
      this.notify(key);
    }
  }

  public subscribe(listener: (completedKey: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(completedKey: string): void {
    for (const listener of this.listeners) {
      try {
        listener(completedKey);
      } catch {}
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getInFlightCount(): number {
    return this.inFlight.size;
  }

  public resume(): void {
    this.processNext();
  }
}

export const catalogAvailabilityQueue = CatalogAvailabilityQueue.getInstance();
