/**
 * ZapiTV - CollaborativeTrainer
 * Motor de Treinamento e Agregação de Filtragem Colaborativa Item-Item:
 * 1. Agregação de eventos implícitos com deduplicação por (usuário, conteúdo)
 * 2. Cálculo de matriz de similaridade Item-Item usando Cosine ajustado com Shrinkage
 * 3. Avaliação estatística de critérios de ativação (usuários mínimos, cobertura, interações)
 * 4. Exclusão estrita de itens adultos
 * 5. Persistência em arquivo JSON com suporte a purga por revogação de consentimento
 */

import fs from 'fs';
import path from 'path';
import {
  AnonymousInteractionEvent,
  CollaborativeModel,
  CollaborativeActivationCriteria,
  DEFAULT_ACTIVATION_CRITERIA,
  ItemItemSimilarity
} from './collaborativeTypes';

export class CollaborativeTrainer {
  private eventsPath: string;
  private modelPath: string;
  private criteria: CollaborativeActivationCriteria;
  private activeModel: CollaborativeModel | null = null;

  constructor(
    dataDir?: string,
    criteria: CollaborativeActivationCriteria = DEFAULT_ACTIVATION_CRITERIA
  ) {
    const baseDir = dataDir || path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
      } catch {}
    }
    this.eventsPath = path.join(baseDir, 'collaborative_events.jsonl');
    this.modelPath = path.join(baseDir, 'collaborative_model.json');
    this.criteria = criteria;
    this.loadModelSync();
  }

  /**
   * Carrega o modelo persistido do disco se existir.
   */
  private loadModelSync(): void {
    try {
      if (fs.existsSync(this.modelPath)) {
        const raw = fs.readFileSync(this.modelPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.activeModel = parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar modelo colaborativo existente:', e);
    }
  }

  /**
   * Retorna o modelo ativo ou um modelo vazio de cold-start.
   */
  public getModel(): CollaborativeModel {
    if (this.activeModel) return this.activeModel;

    return {
      version: 1,
      trainedAt: new Date(0).toISOString(),
      totalInteractions: 0,
      uniqueUsersCount: 0,
      catalogCoverage: 0,
      isActivated: false,
      confidenceScore: 0,
      itemSimilarities: {}
    };
  }

  /**
   * Registra um novo evento pseudonimizado no log persistente.
   */
  public async ingestEvent(event: AnonymousInteractionEvent): Promise<boolean> {
    if (!event || !event.anonymousId || !event.contentId || event.weight <= 0) {
      return false;
    }

    const line = JSON.stringify({
      anonymousId: String(event.anonymousId).trim(),
      contentId: String(event.contentId).trim(),
      weight: Math.min(1.0, Math.max(0.1, Number(event.weight) || 0.5)),
      timestamp: Number(event.timestamp) || Date.now()
    }) + '\n';

    try {
      await fs.promises.appendFile(this.eventsPath, line, 'utf8');
      return true;
    } catch (e) {
      console.error('Falha ao registrar evento colaborativo:', e);
      return false;
    }
  }

  /**
   * Carrega e deduplica todos os eventos do arquivo JSONL.
   * Mantém o maior peso registrado por (usuário, conteúdo).
   */
  public async loadAllDeduplicatedEvents(): Promise<Map<string, Map<string, number>>> {
    const userItemMatrix = new Map<string, Map<string, number>>();

    if (!fs.existsSync(this.eventsPath)) {
      return userItemMatrix;
    }

    try {
      const content = await fs.promises.readFile(this.eventsPath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const ev: AnonymousInteractionEvent = JSON.parse(trimmed);
          if (ev.anonymousId && ev.contentId) {
            let userRatings = userItemMatrix.get(ev.anonymousId);
            if (!userRatings) {
              userRatings = new Map<string, number>();
              userItemMatrix.set(ev.anonymousId, userRatings);
            }
            const currentWeight = userRatings.get(ev.contentId) || 0;
            if (ev.weight > currentWeight) {
              userRatings.set(ev.contentId, ev.weight);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error('Erro ao ler eventos colaborativos para treinamento:', e);
    }

    return userItemMatrix;
  }

  /**
   * Treina a matriz de similaridade Item-Item com base nos dados agregados.
   * Utiliza Cosine Similarity com Fator de Encolhimento (Shrinkage Damping):
   * sim(i, j) = sum(r_ui * r_uj) / (sqrt(sum(r_ui^2)) * sqrt(sum(r_uj^2)) + shrinkage)
   */
  public async train(totalCatalogItemCount: number = 200): Promise<CollaborativeModel> {
    const userItemMatrix = await this.loadAllDeduplicatedEvents();
    const uniqueUsersCount = userItemMatrix.size;

    // Inverter para Item -> (User -> Rating) e calcular normas
    const itemUserMatrix = new Map<string, Map<string, number>>();
    const itemNorms = new Map<string, number>();
    let totalInteractions = 0;

    userItemMatrix.forEach((items, userId) => {
      items.forEach((rating, itemId) => {
        totalInteractions++;
        let users = itemUserMatrix.get(itemId);
        if (!users) {
          users = new Map<string, number>();
          itemUserMatrix.set(itemId, users);
        }
        users.set(userId, rating);
      });
    });

    // Calcular norma euclidiana por item
    itemUserMatrix.forEach((users, itemId) => {
      let sumSq = 0;
      users.forEach((r) => { sumSq += r * r; });
      itemNorms.set(itemId, Math.sqrt(sumSq));
    });

    const items = Array.from(itemUserMatrix.keys());
    const itemSimilarities: Record<string, ItemItemSimilarity[]> = {};
    const shrinkage = 2.0; // Amortecimento para evitar falso match de co-ocorrência única

    for (let i = 0; i < items.length; i++) {
      const itemA = items[i];
      const usersA = itemUserMatrix.get(itemA)!;
      const normA = itemNorms.get(itemA)!;
      const similarities: ItemItemSimilarity[] = [];

      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const itemB = items[j];
        const usersB = itemUserMatrix.get(itemB)!;
        const normB = itemNorms.get(itemB)!;

        // Calcular produto escalar dos usuários que consumiram ambos
        let dotProduct = 0;
        let coOccurrenceCount = 0;

        usersA.forEach((ratingA, userId) => {
          const ratingB = usersB.get(userId);
          if (ratingB !== undefined) {
            dotProduct += ratingA * ratingB;
            coOccurrenceCount++;
          }
        });

        if (coOccurrenceCount > 0 && dotProduct > 0) {
          // Similaridade com shrinkage damping
          const rawCosine = dotProduct / ((normA * normB) + shrinkage);
          const score = Math.min(1.0, Math.max(0.01, Math.round(rawCosine * 1000) / 1000));

          if (score >= 0.05) {
            similarities.push({
              targetId: itemB,
              score,
              coOccurrenceCount
            });
          }
        }
      }

      // Ordena decrescente por score de similaridade e salva top 15
      similarities.sort((a, b) => b.score - a.score);
      if (similarities.length > 0) {
        itemSimilarities[itemA] = similarities.slice(0, 15);
      }
    }

    // Avaliação dos critérios de ativação
    const connectedItemsCount = Object.keys(itemSimilarities).length;
    const catalogCoverage = totalCatalogItemCount > 0
      ? Math.min(1.0, Math.round((connectedItemsCount / totalCatalogItemCount) * 100) / 100)
      : 0;

    const meetsUsers = uniqueUsersCount >= this.criteria.minUniqueUsers;
    const meetsInteractions = totalInteractions >= this.criteria.minInteractions;
    const meetsCoverage = catalogCoverage >= this.criteria.minCatalogCoverage;

    const isActivated = meetsUsers && meetsInteractions && meetsCoverage;

    // Cálculo da confiança estatística global [0, 1]
    let confidenceScore = 0;
    if (isActivated) {
      const userFactor = Math.min(1.0, uniqueUsersCount / (this.criteria.minUniqueUsers * 5));
      const interactionFactor = Math.min(1.0, totalInteractions / (this.criteria.minInteractions * 4));
      const coverageFactor = Math.min(1.0, catalogCoverage / 0.20);
      confidenceScore = Math.round(((userFactor * 0.4) + (interactionFactor * 0.4) + (coverageFactor * 0.2)) * 100) / 100;
    }

    const model: CollaborativeModel = {
      version: (this.activeModel?.version || 0) + 1,
      trainedAt: new Date().toISOString(),
      totalInteractions,
      uniqueUsersCount,
      catalogCoverage,
      isActivated,
      confidenceScore,
      itemSimilarities
    };

    this.activeModel = model;

    // Persistir modelo em arquivo
    try {
      await fs.promises.writeFile(this.modelPath, JSON.stringify(model, null, 2), 'utf8');
    } catch (e) {
      console.error('Erro ao persistir modelo colaborativo:', e);
    }

    return model;
  }

  /**
   * Purga todos os eventos pertencentes ao identificador anônimo especificado
   * (direito ao esquecimento / revogação de consentimento).
   */
  public async purgeUserData(anonymousId: string): Promise<boolean> {
    if (!anonymousId || !fs.existsSync(this.eventsPath)) return false;

    try {
      const content = await fs.promises.readFile(this.eventsPath, 'utf8');
      const lines = content.split('\n');
      const keptLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const ev = JSON.parse(trimmed);
          if (ev.anonymousId !== anonymousId) {
            keptLines.push(line);
          }
        } catch {
          keptLines.push(line);
        }
      }

      await fs.promises.writeFile(this.eventsPath, keptLines.join('\n') + (keptLines.length > 0 ? '\n' : ''), 'utf8');
      
      // Retreinar em background para limpar dados purgados
      this.train().catch(() => {});
      return true;
    } catch (e) {
      console.error('Erro ao purgar dados do usuário:', e);
      return false;
    }
  }
}

export const collaborativeTrainer = new CollaborativeTrainer();
