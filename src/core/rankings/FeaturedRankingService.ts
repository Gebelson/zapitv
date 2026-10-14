/**
 * ZAPITV — FEATURED RANKING SERVICE (WEEKLY IMDb POPULARITY + REAL AVAILABILITY)
 * 
 * Reestrutura e governa a seleção de títulos da página "Em Destaque".
 * Atualização Semanal Automática baseada na popularidade atual do IMDb
 * (MOVIEmeter e TVmeter) cruzada com o índice de disponibilidade real do ZapiTV.
 * 
 * Regra Definitiva:
 * Popularidade Semanal do IMDb + Disponibilidade Real do ZapiTV = Em Destaque
 */

import { ContentItem, ContentType } from '../../../types';
import { 
  RankingMediaType, 
  ImdbWeeklySnapshot, 
  WeeklyRankingCandidate,
  ConsolidatedMonthlyCandidate, 
  ConsolidatedMonthlyRanking, 
  FeaturedAuditItem, 
  FeaturedSelectionResult 
} from './featuredRankingTypes';
import { OFFICIAL_IMDB_WEEKLY_SNAPSHOTS } from './imdbRankingSnapshots';
import { imdbWeeklyRankingService } from './IMDbWeeklyRankingService';
import { theatricalFilterService } from '../catalog/theatricalFilterService';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { mediaAvailabilityIndex } from '../catalog/MediaAvailabilityIndex';
import { VERIFIED_OPEN_ITEMS } from '../catalog/verifiedCatalog';
import { searchService } from '../search/searchService';
import { filmesData } from '../../../constants';

export const STORAGE_KEY_FEATURED_SELECTION = 'zapitv_featured_ranking_selection_v3';
export const EVENT_FEATURED_RANKING_UPDATED = 'zapitv_featured_ranking_updated';

export interface FeaturedStorageAdapter {
  load(): FeaturedSelectionResult | null;
  save(data: FeaturedSelectionResult): void;
}

class FeaturedRankingService {
  private static instance: FeaturedRankingService;
  private weeklySnapshots: ImdbWeeklySnapshot[] = [...OFFICIAL_IMDB_WEEKLY_SNAPSHOTS];
  private cachedSelection: FeaturedSelectionResult | null = null;
  private storageAdapter: FeaturedStorageAdapter | null = null;
  private isProcessing = false;

  private constructor() {
    this.loadFromStorage();
    if (!this.cachedSelection) {
      this.recomputeFeaturedSelectionSync();
    }
  }

  public static getInstance(): FeaturedRankingService {
    if (!FeaturedRankingService.instance) {
      FeaturedRankingService.instance = new FeaturedRankingService();
    }
    return FeaturedRankingService.instance;
  }

  /**
   * Permite registrar um adaptador de persistência customizado (ex: em disco no Node.js)
   */
  public setStorageAdapter(adapter: FeaturedStorageAdapter): void {
    this.storageAdapter = adapter;
    // Tenta carregar imediatamente do adaptador registrado
    const data = adapter.load();
    if (data) {
      this.cachedSelection = data;
    }
  }

  /**
   * Obtém os snapshots semanais atualmente armazenados
   */
  public getWeeklySnapshots(): ImdbWeeklySnapshot[] {
    return [...this.weeklySnapshots];
  }

  /**
   * Permite importar ou anexar novos snapshots semanais autorizados
   */
  public addWeeklySnapshot(snapshot: ImdbWeeklySnapshot): void {
    const idx = this.weeklySnapshots.findIndex(s => s.id === snapshot.id || (s.weekKey === snapshot.weekKey && s.rankType === snapshot.rankType));
    if (idx !== -1) {
      this.weeklySnapshots[idx] = snapshot;
    } else {
      this.weeklySnapshots.push(snapshot);
    }
  }

  /**
   * Obtém o snapshot mais recente para o tipo de mídia (Filme ou Série)
   */
  public getLatestWeeklySnapshot(rankType: RankingMediaType): ImdbWeeklySnapshot {
    const matching = this.weeklySnapshots.filter(s => s.rankType === rankType);
    if (matching.length === 0) {
      throw new Error(`Nenhum snapshot semanal encontrado para ${rankType}`);
    }
    return matching.sort((a, b) => {
      if (b.referenceDate !== a.referenceDate) {
        return b.referenceDate.localeCompare(a.referenceDate);
      }
      return b.capturedAt - a.capturedAt;
    })[0];
  }

  /**
   * Calcula o ranking da semana diretamente do snapshot semanal mais recente da Fonte Única da Verdade
   */
  public computeWeeklyRanking(rankType: RankingMediaType): {
    snapshot: ImdbWeeklySnapshot;
    candidates: WeeklyRankingCandidate[];
  } {
    try {
      const { snapshot, ranking } = imdbWeeklyRankingService.getLatestRanking(rankType);
      const candidates: WeeklyRankingCandidate[] = ranking.map(it => ({
        imdbId: it.imdbId,
        position: it.position,
        title: it.title,
        originalTitle: it.originalTitle,
        year: it.year,
        rankType,
        referenceDate: it.referenceDate || snapshot.referenceDate
      }));
      return { snapshot: snapshot as any, candidates };
    } catch {
      const snapshot = this.getLatestWeeklySnapshot(rankType);
      const sortedItems = [...snapshot.items].sort((a, b) => a.position - b.position);
      const candidates: WeeklyRankingCandidate[] = sortedItems.map(it => ({
        imdbId: it.imdbId,
        position: it.position,
        title: it.title,
        originalTitle: it.originalTitle,
        year: it.year,
        rankType,
        referenceDate: it.referenceDate || snapshot.referenceDate
      }));
      return { snapshot, candidates };
    }
  }

  /**
   * Calcula a data/hora da próxima segunda-feira às 06:00 (Horário de Brasília / UTC-3 -> 09:00 UTC)
   */
  public getNextMonday6AMBRT(fromTime: Date = new Date()): Date {
    const d = new Date(fromTime.getTime());
    const currentDay = d.getUTCDay();
    const currentHour = d.getUTCHours();
    const currentMinute = d.getUTCMinutes();

    let daysUntilMonday = (1 - currentDay + 7) % 7;
    if (daysUntilMonday === 0) {
      // Se hoje for segunda-feira mas já passou de 09:00 UTC (06:00 BRT), próxima em 7 dias
      if (currentHour > 9 || (currentHour === 9 && currentMinute > 0)) {
        daysUntilMonday = 7;
      }
    }

    const target = new Date(d.getTime());
    target.setUTCDate(d.getUTCDate() + daysUntilMonday);
    target.setUTCHours(9, 0, 0, 0);
    return target;
  }

  /**
   * Formata a próxima execução em texto legível amigável (horário de Brasília)
   */
  public formatNextScheduledRun(target: Date): string {
    const brtTime = new Date(target.getTime() - (3 * 60 * 60 * 1000));
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayName = days[target.getUTCDay()];
    const day = String(brtTime.getUTCDate()).padStart(2, '0');
    const month = String(brtTime.getUTCMonth() + 1).padStart(2, '0');
    const year = brtTime.getUTCFullYear();
    const hour = String(brtTime.getUTCHours()).padStart(2, '0');
    const minute = String(brtTime.getUTCMinutes()).padStart(2, '0');

    return `${dayName}, ${day}/${month}/${year} às ${hour}:${minute} (BRT)`;
  }

  /**
   * Consolida os snapshots semanais do mês utilizando a fórmula ponderada de popularidade
   * (Mantido para retrocompatibilidade analítica)
   */
  public computeMonthlyConsolidatedRanking(
    monthKey: string = '2026-10',
    rankType: RankingMediaType = 'movie'
  ): ConsolidatedMonthlyRanking {
    const relevantSnapshots = this.weeklySnapshots.filter(
      s => s.monthKey === monthKey && s.rankType === rankType
    );

    const isProvisionalWeekly = relevantSnapshots.length <= 1;
    const candidatesMap = new Map<string, ConsolidatedMonthlyCandidate>();

    for (const snapshot of relevantSnapshots) {
      for (const item of snapshot.items) {
        const cleanId = String(item.imdbId || '').trim().toLowerCase();
        if (!cleanId) continue;

        const points = Math.max(1, 101 - item.position);

        let candidate = candidatesMap.get(cleanId);
        if (!candidate) {
          candidate = {
            imdbId: item.imdbId,
            title: item.title,
            originalTitle: item.originalTitle,
            year: item.year,
            rankType,
            cumulativeScore: points,
            bestPosition: item.position,
            appearancesCount: 1,
            originalPositions: [item.position]
          };
          candidatesMap.set(cleanId, candidate);
        } else {
          candidate.cumulativeScore += points;
          candidate.appearancesCount += 1;
          candidate.originalPositions.push(item.position);
          if (item.position < candidate.bestPosition) {
            candidate.bestPosition = item.position;
          }
        }
      }
    }

    const sortedCandidates = Array.from(candidatesMap.values()).sort((a, b) => {
      if (b.cumulativeScore !== a.cumulativeScore) {
        return b.cumulativeScore - a.cumulativeScore;
      }
      return a.bestPosition - b.bestPosition;
    });

    const monthNames: Record<string, string> = {
      '2026-10': 'Outubro de 2026',
      '2026-09': 'Setembro de 2026',
      '2026-11': 'Novembro de 2026',
      '2026-12': 'Dezembro de 2026'
    };

    return {
      monthKey,
      monthLabel: monthNames[monthKey] || `Mês ${monthKey}`,
      rankType,
      isProvisionalWeekly,
      snapshotsIncluded: relevantSnapshots.map(s => s.id),
      candidates: sortedCandidates
    };
  }

  /**
   * Encontra a correspondência canônica de um item IMDb no catálogo do ZapiTV
   */
  public findCanonicalCatalogItem(
    candidate: { imdbId?: string; title?: string; originalTitle?: string; year?: number },
    catalog: ContentItem[]
  ): ContentItem | null {
    const candImdb = (candidate.imdbId || '').trim().toLowerCase();
    const candTitle = (candidate.title || '').trim().toLowerCase();
    const candOrigTitle = (candidate.originalTitle || '').trim().toLowerCase();
    const candYear = candidate.year;

    // 1. Busca exata por IMDb ID (tt...)
    if (candImdb) {
      const match = catalog.find(c => {
        const itemImdb = (c.imdbId || '').trim().toLowerCase();
        if (itemImdb && itemImdb === candImdb) return true;
        if (c.id && c.id.toLowerCase().includes(candImdb)) return true;
        if (c.videoUrl && c.videoUrl.toLowerCase().includes(candImdb)) return true;
        return false;
      });
      if (match) return match;
    }

    // 2. Busca estrita por Título + Ano (evitando conflito entre remakes de mesmo nome)
    const normalizeStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const normCandTitle = normalizeStr(candTitle);
    const normCandOrigTitle = candOrigTitle ? normalizeStr(candOrigTitle) : '';

    const textMatch = catalog.find(c => {
      const normTitle = normalizeStr(c.title);
      const normOrig = c.originalTitle ? normalizeStr(c.originalTitle) : '';
      const yearMatches = !candYear || !c.year || Math.abs(c.year - candYear) <= 1;

      const titleMatches = (normTitle === normCandTitle) ||
        (normCandOrigTitle && normTitle === normCandOrigTitle) ||
        (normOrig && normOrig === normCandTitle) ||
        (normCandOrigTitle && normOrig && normOrig === normCandOrigTitle);

      return titleMatches && yearMatches;
    });

    return textMatch || null;
  }

  /**
   * Algoritmo Principal de Preenchimento e Substituição Progressiva do Top 10
   * 
   * Percorre o ranking semanal na ordem exata de popularidade do IMDb.
   * Se um título for inelegível, registra o motivo explícito e AVANÇA para o próximo candidato.
   * Preenche até 10 vagas por categoria sem duplicatas e sem inventar dados.
   */
  public resolveEligibleTop10(
    rankingOrCandidates: ConsolidatedMonthlyRanking | Array<{ imdbId: string; title: string; originalTitle?: string; year?: number; position?: number }>,
    rankTypeOrCatalog: RankingMediaType | ContentItem[],
    maybeCatalog?: ContentItem[]
  ): { approvedItems: ContentItem[]; audit: FeaturedAuditItem[] } {
    let candidates: Array<{ imdbId: string; title: string; originalTitle?: string; year?: number; position?: number }>;
    let rankType: RankingMediaType;
    let catalog: ContentItem[];

    if ('candidates' in rankingOrCandidates && 'rankType' in rankingOrCandidates) {
      candidates = (rankingOrCandidates as ConsolidatedMonthlyRanking).candidates;
      rankType = (rankingOrCandidates as ConsolidatedMonthlyRanking).rankType;
      catalog = rankTypeOrCatalog as ContentItem[];
    } else {
      candidates = rankingOrCandidates as Array<{ imdbId: string; title: string; originalTitle?: string; year?: number; position?: number }>;
      rankType = rankTypeOrCatalog as RankingMediaType;
      catalog = maybeCatalog || [];
    }

    const approvedItems: ContentItem[] = [];
    const audit: FeaturedAuditItem[] = [];
    const targetCount = 10;
    const currentYear = new Date().getFullYear();
    const todayStr = new Date().toISOString().slice(0, 10);
    const seenIds = new Set<string>();

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const rankPosition = cand.position ?? (i + 1);

      const catalogItem = this.findCanonicalCatalogItem(cand, catalog);

      // CASO 1: Título não encontrado no catálogo do ZapiTV
      if (!catalogItem) {
        audit.push({
          imdbId: cand.imdbId,
          title: cand.title,
          imdbTitle: cand.title,
          year: cand.year,
          mediaType: rankType,
          imdbRank: rankPosition,
          rankPosition,
          status: 'REJECTED',
          isIncluded: false,
          availabilityStatus: 'not_in_catalog',
          rejectionReason: 'Identificador não encontrado no acervo do ZapiTV'
        });
        continue;
      }

      // Evita duplicatas de cards na seleção
      if (seenIds.has(catalogItem.id)) {
        continue;
      }

      // CASO 2: Separação estrita de categorias (Filmes vs Séries vs Animes)
      if (rankType === 'movie') {
        if (catalogItem.type !== ContentType.MOVIE) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'movie',
            imdbRank: rankPosition,
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: catalogItem.availabilityStatus || 'declared',
            rejectionReason: 'Conteúdo não é um filme de longa-metragem (tipo divergente no acervo)'
          });
          continue;
        }
      } else {
        // Categoria Séries: Animes devem ser rigorosamente excluídos da seção de séries convencionais
        if (catalogItem.type === ContentType.ANIME || searchService.isAnimeItem(catalogItem)) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'series',
            imdbRank: rankPosition,
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: catalogItem.availabilityStatus || 'declared',
            rejectionReason: 'Anime excluído da categoria Séries (destinado exclusivamente à página Animes)'
          });
          continue;
        }
        if (catalogItem.type !== ContentType.SERIES) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'series',
            imdbRank: rankPosition,
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: catalogItem.availabilityStatus || 'declared',
            rejectionReason: 'Conteúdo não é uma série de televisão'
          });
          continue;
        }
      }

      // CASO 3: Título ainda não lançado comercialmente (data de estreia futura)
      const itemYear = Number(catalogItem.year || cand.year) || currentYear;
      if (itemYear > currentYear || (catalogItem.releaseDate && catalogItem.releaseDate > todayStr)) {
        audit.push({
          imdbId: cand.imdbId,
          title: cand.title,
          imdbTitle: cand.title,
          canonicalTitle: catalogItem.title,
          year: cand.year,
          mediaType: rankType,
          imdbRank: rankPosition,
          rankPosition,
          status: 'REJECTED',
          isIncluded: false,
          canonicalId: catalogItem.id,
          availabilityStatus: catalogItem.availabilityStatus || 'unreleased',
          rejectionReason: 'Título ainda não lançado comercialmente (data de estreia futura)'
        });
        continue;
      }

      // CASO 4: Restrição cinematográfica (Filmes em cartaz nos cinemas brasileiros)
      if (rankType === 'movie') {
        const isTheatricallyAllowed = theatricalFilterService.isMovieAllowedSync(catalogItem);
        if (!isTheatricallyAllowed) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'movie',
            imdbRank: rankPosition,
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: 'theatrical_window',
            rejectionReason: 'Filme em cartaz nos cinemas brasileiros ou aguarda lançamento digital oficial'
          });
          continue;
        }
      }

      // CASO 5: Verificação estrita de disponibilidade real de fontes
      const key = catalogEligibilityService.getCanonicalKey(catalogItem);
      const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(catalogItem);
      const availRec = mediaAvailabilityIndex.getRecord(key);

      const isExplicitlyUnavailable = catalogItem.availabilityStatus === 'unavailable' || 
        (availRec && availRec.status === 'UNAVAILABLE_CONFIRMED');

      const hasConfirmedSource = Boolean(
        catalogItem.id.startsWith('open-') ||
        catalogItem.availabilityStatus === 'verified' ||
        (catalogItem.verifiedStreams && catalogItem.verifiedStreams.length > 0) ||
        (catalogItem.videoUrl && catalogItem.videoUrl.trim().length > 0) ||
        (availRec && availRec.status === 'AVAILABLE' && availRec.validatedSourceCount > 0)
      );

      if (!isPlayable || isExplicitlyUnavailable || !hasConfirmedSource) {
        audit.push({
          imdbId: cand.imdbId,
          title: cand.title,
          imdbTitle: cand.title,
          canonicalTitle: catalogItem.title,
          year: cand.year,
          mediaType: rankType,
          imdbRank: rankPosition,
          rankPosition,
          status: 'REJECTED',
          isIncluded: false,
          canonicalId: catalogItem.id,
          availabilityStatus: 'no_source',
          rejectionReason: 'Sem fontes válidas ou reproduzíveis disponíveis no ZapiTV'
        });
        continue;
      }

      // CASO 6: Para séries: exigir ao menos um episódio válido e reproduzível
      if (rankType === 'series') {
        const hasEpisodes = (catalogItem.episodes && catalogItem.episodes.length > 0) || 
          catalogItem.availabilityStatus === 'verified' ||
          (availRec && (availRec.availableEpisodeCount ?? 0) > 0);
        
        if (!hasEpisodes) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'series',
            imdbRank: rankPosition,
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: 'no_episodes',
            rejectionReason: 'Série sem episódios disponíveis e reproduzíveis no catálogo'
          });
          continue;
        }
      }

      // APROVADO! O título cumpre rigorosamente todos os critérios de elegibilidade real
      const finalPosition = approvedItems.length + 1;
      seenIds.add(catalogItem.id);
      
      const featuredItem: ContentItem = {
        ...catalogItem,
        imdbId: catalogItem.imdbId || cand.imdbId,
        isFeatured: true,
        imdbRank: rankPosition,
        displayRank: finalPosition,
        heroTags: [
          ...(catalogItem.heroTags || []),
          {
            id: `rank-${finalPosition}`,
            text: `#${finalPosition} Em Destaque (IMDb #${rankPosition})`,
            color: '#007df7',
            style: 'solid'
          }
        ]
      };

      approvedItems.push(featuredItem);

      audit.push({
        imdbId: cand.imdbId,
        title: catalogItem.title,
        imdbTitle: cand.title,
        canonicalTitle: catalogItem.title,
        year: catalogItem.year,
        mediaType: rankType,
        imdbRank: rankPosition,
        displayRank: finalPosition,
        rankPosition,
        finalPosition,
        status: 'APPROVED',
        isIncluded: true,
        canonicalId: catalogItem.id,
        availabilityStatus: catalogItem.availabilityStatus || 'verified',
        hasAudioPtBr: catalogItem.audioStatus === 'pt-br-dubbed' || catalogItem.audioStatus === 'pt-br-original',
        audioStatus: catalogItem.audioStatus || 'other',
        verifiedSourcesCount: (catalogItem.verifiedStreams || []).length || 1
      });

      if (approvedItems.length >= targetCount) {
        break;
      }
    }

    return { approvedItems, audit };
  }

  /**
   * Recalcula a seleção semanal de Em Destaque com o catálogo completo disponível
   */
  public recomputeFeaturedSelectionSync(customCatalog?: ContentItem[]): FeaturedSelectionResult {
    const catalogMap = new Map<string, ContentItem>();
    VERIFIED_OPEN_ITEMS.forEach(it => catalogMap.set(it.id, it));
    filmesData.forEach(it => {
      if (!catalogMap.has(it.id)) catalogMap.set(it.id, it);
    });
    if (customCatalog && Array.isArray(customCatalog)) {
      customCatalog.forEach(it => {
        if (!catalogMap.has(it.id)) catalogMap.set(it.id, it);
      });
    }
    const fullCatalog = Array.from(catalogMap.values());

    // Obtém o ranking semanal mais recente
    const moviesWeekly = this.computeWeeklyRanking('movie');
    const seriesWeekly = this.computeWeeklyRanking('series');

    const moviesResult = this.resolveEligibleTop10(moviesWeekly.candidates, 'movie', fullCatalog);
    const seriesResult = this.resolveEligibleTop10(seriesWeekly.candidates, 'series', fullCatalog);

    // =========================================================================
    // ASSERTIVAS OBRIGATÓRIAS (Seção 14 da Especificação Oficial)
    // =========================================================================
    const movieRankingIds = new Set(moviesWeekly.candidates.map(c => c.imdbId.toLowerCase()));
    for (const item of moviesResult.approvedItems) {
      if (!item.imdbId || !movieRankingIds.has(item.imdbId.toLowerCase())) {
        throw new Error(`[Assertiva Falhou] Filme '${item.title}' (${item.imdbId}) fora do ranking IMDb MOVIEmeter`);
      }
    }

    const tvRankingIds = new Set(seriesWeekly.candidates.map(c => c.imdbId.toLowerCase()));
    for (const item of seriesResult.approvedItems) {
      if (!item.imdbId || !tvRankingIds.has(item.imdbId.toLowerCase())) {
        throw new Error(`[Assertiva Falhou] Série '${item.title}' (${item.imdbId}) fora do ranking IMDb TVmeter`);
      }
    }

    const approvedMovies = moviesResult.audit.filter(a => a.status === 'APPROVED');
    const rejectedMovies = moviesResult.audit.filter(a => a.status === 'REJECTED');
    const approvedSeries = seriesResult.audit.filter(a => a.status === 'APPROVED');
    const rejectedSeries = seriesResult.audit.filter(a => a.status === 'REJECTED');

    const nextDate = this.getNextMonday6AMBRT();

    const result: FeaturedSelectionResult = {
      weekKey: moviesWeekly.snapshot.weekKey || '2026-W41',
      weekLabel: moviesWeekly.snapshot.weekLabel || 'Semana 41 (Outubro de 2026)',
      monthKey: moviesWeekly.snapshot.monthKey || '2026-10',
      monthLabel: 'Outubro de 2026',
      referenceDate: moviesWeekly.snapshot.referenceDate,
      lastUpdatedAt: Date.now(),
      lastCheckedAt: Date.now(),
      nextScheduledUpdate: nextDate.getTime(),
      nextScheduledUpdateFormatted: this.formatNextScheduledRun(nextDate),
      sourceReference: 'IMDb MOVIEmeter & TVmeter (Ranking Semanal)',
      updateStatus: 'SUCCESS',
      isProvisionalWeekly: false,
      featuredMovies: moviesResult.approvedItems,
      featuredSeries: seriesResult.approvedItems,
      totalCandidatesEvaluated: {
        movies: moviesWeekly.candidates.length,
        series: seriesWeekly.candidates.length
      },
      auditTrail: {
        approvedMovies,
        rejectedMovies,
        approvedSeries,
        rejectedSeries
      }
    };

    // Publicação atômica em memória e persistência
    this.cachedSelection = result;
    this.saveToStorage();
    this.dispatchUpdateEvent();

    return result;
  }

  /**
   * Executa a tarefa de atualização semanal programada com verificação de novos dados,
   * publicação atômica e proteção contra falhas (mantendo a seleção anterior)
   */
  public async runWeeklyScheduledUpdate(options: { 
    force?: boolean; 
    customCatalog?: ContentItem[];
    incomingSnapshots?: ImdbWeeklySnapshot[];
  } = {}): Promise<FeaturedSelectionResult> {
    if (this.isProcessing) {
      return this.getFeaturedSelectionSync();
    }
    this.isProcessing = true;

    try {
      if (options.incomingSnapshots && options.incomingSnapshots.length > 0) {
        for (const snap of options.incomingSnapshots) {
          this.addWeeklySnapshot(snap);
          if (Array.isArray(snap.items)) {
            try {
              imdbWeeklyRankingService.importAuthorizedSnapshot({
                ...snap,
                source: 'admin-import',
                items: snap.items.map(it => ({
                  ...it,
                  originalTitle: it.originalTitle || it.title,
                  mediaType: snap.rankType,
                  weekKey: snap.weekKey,
                  referenceDate: snap.referenceDate,
                  capturedAt: snap.capturedAt,
                  source: 'admin-import'
                }))
              });
            } catch (e: any) {
              console.warn('[FeaturedRankingService] Falha ao importar snapshot:', e?.message || e);
            }
          }
        }
      }

      const latestMovieSnap = this.getLatestWeeklySnapshot('movie');
      const latestSeriesSnap = this.getLatestWeeklySnapshot('series');

      // 1. Identificar se existem dados novos do IMDb em relação ao que está publicado
      const currentRef = this.cachedSelection?.referenceDate;
      const currentWeek = this.cachedSelection?.weekKey;
      const isNewData = !currentRef || 
        latestMovieSnap.referenceDate > currentRef || 
        latestSeriesSnap.referenceDate > currentRef ||
        (latestMovieSnap.weekKey && latestMovieSnap.weekKey !== currentWeek);

      if (!isNewData && !options.force && this.cachedSelection) {
        // Dados continuam os mesmos do ranking atual: mantém seleção e registra verificação
        const nextDate = this.getNextMonday6AMBRT();
        this.cachedSelection.lastCheckedAt = Date.now();
        this.cachedSelection.updateStatus = 'UP_TO_DATE';
        this.cachedSelection.nextScheduledUpdate = nextDate.getTime();
        this.cachedSelection.nextScheduledUpdateFormatted = this.formatNextScheduledRun(nextDate);
        this.saveToStorage();
        return this.cachedSelection;
      }

      // 2. Executa cálculo atômico
      const newSelection = this.recomputeFeaturedSelectionSync(options.customCatalog);
      newSelection.updateStatus = 'SUCCESS';
      return newSelection;
    } catch (error: any) {
      console.error('[FeaturedRankingService] Erro na rotina semanal de atualização:', error);
      // 3. Em caso de falha: preserva rigorosamente a seleção anterior (NÃO deixa página vazia)
      if (this.cachedSelection) {
        const nextDate = this.getNextMonday6AMBRT();
        this.cachedSelection.lastCheckedAt = Date.now();
        this.cachedSelection.updateStatus = 'FALLBACK_RETAINED';
        this.cachedSelection.lastErrorReason = error?.message || 'Falha na obtenção do ranking semanal do IMDb';
        this.cachedSelection.nextScheduledUpdate = nextDate.getTime();
        this.cachedSelection.nextScheduledUpdateFormatted = this.formatNextScheduledRun(nextDate);
        this.saveToStorage();
        return this.cachedSelection;
      }
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Verifica se algum título atualmente em destaque perdeu disponibilidade no acervo,
   * substituindo-o imediatamente pelo próximo candidato elegível da semana
   */
  public validateAndReplaceUnavailableItems(catalog?: ContentItem[]): FeaturedSelectionResult {
    if (!this.cachedSelection) {
      return this.recomputeFeaturedSelectionSync(catalog);
    }

    const currentSelection = this.cachedSelection;
    let needsUpdate = false;

    // Checa filmes
    for (const m of currentSelection.featuredMovies) {
      if (!catalogEligibilityService.isItemPubliclyPlayableSync(m)) {
        needsUpdate = true;
        break;
      }
    }

    // Checa séries
    if (!needsUpdate) {
      for (const s of currentSelection.featuredSeries) {
        if (!catalogEligibilityService.isItemPubliclyPlayableSync(s)) {
          needsUpdate = true;
          break;
        }
      }
    }

    if (needsUpdate) {
      return this.recomputeFeaturedSelectionSync(catalog);
    }

    return currentSelection;
  }

  /**
   * Retorna a seleção de Em Destaque em cache (0ms síncrono para renderização instantânea)
   */
  public getFeaturedSelectionSync(): FeaturedSelectionResult {
    if (!this.cachedSelection) {
      return this.recomputeFeaturedSelectionSync();
    }
    return this.cachedSelection;
  }

  /**
   * Força uma atualização assíncrona desacoplada da UI
   */
  public async refreshFeaturedSelection(customCatalog?: ContentItem[]): Promise<FeaturedSelectionResult> {
    return this.runWeeklyScheduledUpdate({ force: true, customCatalog });
  }

  private loadFromStorage(): void {
    if (this.storageAdapter) {
      const data = this.storageAdapter.load();
      if (data) {
        this.cachedSelection = data;
        return;
      }
    }
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // Limpeza de versões anteriores obsoletas para impedir descompasso com os rankings do IMDb
      localStorage.removeItem('zapitv_featured_ranking_selection_v1');
      localStorage.removeItem('zapitv_featured_ranking_selection_v2');

      const raw = localStorage.getItem(STORAGE_KEY_FEATURED_SELECTION);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.referenceDate === '2026-10-12' &&
          Array.isArray(parsed.featuredMovies) &&
          parsed.featuredMovies.length === 10 &&
          Array.isArray(parsed.featuredSeries) &&
          parsed.featuredSeries.length === 10
        ) {
          const hasOutdatedSeries = parsed.featuredSeries.some((s: any) => 
            s.title === 'Pinguim' || s.title === 'Disclaimer' || s.title === 'The Pitt' || s.title === 'O Urso'
          );
          if (!hasOutdatedSeries) {
            this.cachedSelection = parsed;
            return;
          }
        }
        localStorage.removeItem(STORAGE_KEY_FEATURED_SELECTION);
      }
    } catch (e) {
      console.warn('[FeaturedRankingService] Falha ao carregar cache do localStorage:', e);
    }
  }

  private saveToStorage(): void {
    if (!this.cachedSelection) return;
    if (this.storageAdapter) {
      try {
        this.storageAdapter.save(this.cachedSelection);
      } catch (err) {
        console.warn('[FeaturedRankingService] Falha no storageAdapter:', err);
      }
    }
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY_FEATURED_SELECTION, JSON.stringify(this.cachedSelection));
    } catch (e) {
      console.warn('[FeaturedRankingService] Falha ao persistir cache no localStorage:', e);
    }
  }

  private dispatchUpdateEvent(): void {
    if (typeof window !== 'undefined' && this.cachedSelection) {
      window.dispatchEvent(new CustomEvent(EVENT_FEATURED_RANKING_UPDATED, { detail: this.cachedSelection }));
    }
  }

  /**
   * Inscreve um ouvinte para alterações no ranking em destaque
   */
  public subscribe(listener: (result: FeaturedSelectionResult) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const handler = (e: Event) => {
      const custom = e as CustomEvent<FeaturedSelectionResult>;
      if (custom.detail) {
        listener(custom.detail);
      } else {
        listener(this.getFeaturedSelectionSync());
      }
    };

    window.addEventListener(EVENT_FEATURED_RANKING_UPDATED, handler);
    return () => {
      window.removeEventListener(EVENT_FEATURED_RANKING_UPDATED, handler);
    };
  }
}

export const featuredRankingService = FeaturedRankingService.getInstance();
