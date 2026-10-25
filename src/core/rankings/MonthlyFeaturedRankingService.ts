/**
 * ZAPITV — MONTHLY FEATURED RANKING SERVICE
 * 
 * Serviço Unificado de Curadoria e Ranqueamento Mensal de Alta Fidelidade.
 * Governa os três rankings mensais independentes da ZapiTV:
 * 1. Top 10 Filmes do Mês (IMDb MOVIEmeter consolidado mensal + Disponibilidade Real)
 * 2. Top 10 Séries do Mês (IMDb TVmeter consolidado mensal + Disponibilidade Real)
 * 3. Top 10 Animes do Mês (AniList Trending/Popularity mensal + Disponibilidade Real)
 * 
 * Regras Obrigatórias:
 * - Calendário dinâmico no fuso America/Sao_Paulo (sem monthKey estático).
 * - "Mês de AAAA · Parcial" para mês em andamento e "Mês de AAAA" para consolidado.
 * - Pontuação mensal autêntica calculada a partir de frequência e posições semanais.
 * - Prioridade rigorosa a metadados canônicos validados (evitando sobreposição legada).
 * - Exclusão de conteúdos futuros, CAM/HDCAM/HDTC e respeito à data de disponibilização
 *   de A Odisseia (2026) até 20/11/2026 às 00:00 BRT.
 * - Resolução contínua de candidatos até atingir 10 posições ou esgotar candidatos elegíveis.
 */

import { ContentItem, ContentType } from '../../../types';
import {
  RankingMediaType,
  MonthlyRankedItem,
  MonthlyRankingSnapshot,
  FeaturedAuditItem,
  FeaturedSelectionResult,
  ConsolidatedMonthlyCandidate,
  ImdbWeeklySnapshot
} from './featuredRankingTypes';
import { OFFICIAL_IMDB_WEEKLY_SNAPSHOTS } from './imdbRankingSnapshots';
import { OFFICIAL_ANILIST_MONTHLY_SNAPSHOTS, AniListMonthlySnapshot } from './anilistRankingSnapshots';
import { canonicalCatalogMaster } from '../catalog/CanonicalCatalogMaster';
import { theatricalFilterService } from '../catalog/theatricalFilterService';
import { catalogEligibilityService } from '../catalog/CatalogEligibilityService';
import { mediaAvailabilityIndex } from '../catalog/MediaAvailabilityIndex';
import { FEATURED_CATALOG_ITEMS } from '../catalog/featuredCatalogItems';
import { VERIFIED_OPEN_ITEMS } from '../catalog/verifiedCatalog';
import { filmesData } from '../../../constants';
import { searchService } from '../search/searchService';
import { aniListClient } from '../anilist/aniListClient';
import { isCorruptedPosterUrl } from '../catalog/PosterRecoveryService';

export const STORAGE_KEY_MONTHLY_RANKINGS = 'zapitv_monthly_featured_rankings_v1';
export const EVENT_MONTHLY_RANKING_UPDATED = 'zapitv_monthly_ranking_updated';

export interface MonthlyStorageAdapter {
  load(): MonthlyRankingSnapshot | null;
  save(snapshot: MonthlyRankingSnapshot): void;
}

export interface SaoPauloCalendarInfo {
  year: number;
  month: number;               // 1..12
  day: number;
  hour: number;
  minute: number;
  monthKey: string;            // 'YYYY-MM'
  monthName: string;           // 'Outubro'
  monthLabel: string;          // 'Outubro de 2026'
  statusLabel: string;         // 'Outubro de 2026 · Parcial' ou 'Outubro de 2026'
  isCurrentMonth: boolean;
}

export class MonthlyFeaturedRankingService {
  private static instance: MonthlyFeaturedRankingService;

  private imdbWeeklySnapshots: ImdbWeeklySnapshot[] = [...OFFICIAL_IMDB_WEEKLY_SNAPSHOTS];
  private anilistMonthlySnapshots: AniListMonthlySnapshot[] = [...OFFICIAL_ANILIST_MONTHLY_SNAPSHOTS];
  private cachedMonthlySnapshot: MonthlyRankingSnapshot | null = null;
  private storageAdapter: MonthlyStorageAdapter | null = null;
  private isProcessing = false;

  private constructor() {
    this.loadFromStorage();
    if (!this.cachedMonthlySnapshot) {
      this.recomputeMonthlyRankingsSync();
    }
  }

  public static getInstance(): MonthlyFeaturedRankingService {
    if (!MonthlyFeaturedRankingService.instance) {
      MonthlyFeaturedRankingService.instance = new MonthlyFeaturedRankingService();
    }
    return MonthlyFeaturedRankingService.instance;
  }

  /**
   * Registra adaptador de persistência customizado (ex: em disco no Node.js)
   */
  public setStorageAdapter(adapter: MonthlyStorageAdapter): void {
    this.storageAdapter = adapter;
    const loaded = adapter.load();
    if (loaded) {
      this.cachedMonthlySnapshot = loaded;
    }
  }

  /**
   * Converte uma data de calendário para o fuso oficial de Brasília (America/Sao_Paulo)
   * Derivação 100% dinâmica sem valores fixos de monthKey.
   */
  public getSaoPauloCalendar(targetDate: Date = new Date(), queryMonthKey?: string): SaoPauloCalendarInfo {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(targetDate);
    let year = targetDate.getFullYear();
    let month = targetDate.getMonth() + 1;
    let day = targetDate.getDate();
    let hour = targetDate.getHours();
    let minute = targetDate.getMinutes();

    for (const p of parts) {
      if (p.type === 'year') year = parseInt(p.value, 10);
      else if (p.type === 'month') month = parseInt(p.value, 10);
      else if (p.type === 'day') day = parseInt(p.value, 10);
      else if (p.type === 'hour') hour = parseInt(p.value, 10);
      else if (p.type === 'minute') minute = parseInt(p.value, 10);
    }

    const currentRealMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    const effectiveMonthKey = queryMonthKey || currentRealMonthKey;

    let targetYear = year;
    let targetMonth = month;
    if (queryMonthKey && /^\d{4}-\d{2}$/.test(queryMonthKey)) {
      const [y, m] = queryMonthKey.split('-').map(Number);
      targetYear = y;
      targetMonth = m;
    }

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = monthNames[Math.max(0, Math.min(11, targetMonth - 1))];
    const monthLabel = `${monthName} de ${targetYear}`;

    const isCurrentMonth = effectiveMonthKey === currentRealMonthKey;
    const statusLabel = isCurrentMonth ? `${monthLabel} · Parcial` : monthLabel;

    return {
      year: targetYear,
      month: targetMonth,
      day,
      hour,
      minute,
      monthKey: effectiveMonthKey,
      monthName,
      monthLabel,
      statusLabel,
      isCurrentMonth
    };
  }

  /**
   * Consolida e pontua os candidatos de Filmes ou Séries a partir dos snapshots semanais do mês
   */
  public consolidateWeeklySnapshots(
    monthKey: string,
    rankType: RankingMediaType
  ): ConsolidatedMonthlyCandidate[] {
    const relevantSnapshots = this.imdbWeeklySnapshots.filter(
      s => s.monthKey === monthKey && s.rankType === rankType
    );

    const candidatesMap = new Map<string, ConsolidatedMonthlyCandidate>();

    // Ordena snapshots por data crescente para registrar progressão cronológica
    const sortedSnapshots = [...relevantSnapshots].sort((a, b) => a.capturedAt - b.capturedAt);

    for (const snapshot of sortedSnapshots) {
      for (const item of snapshot.items) {
        const cleanId = String(item.imdbId || '').trim().toLowerCase();
        if (!cleanId) continue;

        // Fórmula Oficial da ZapiTV:
        // Cada aparição em snapshot semanal pontua inversamente à posição: (101 - posição)
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
            originalPositions: [item.position],
            source: item.source
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

    // Se não houver snapshots para o mês solicitado, busca no snapshot mais próximo disponível
    if (candidatesMap.size === 0) {
      const fallbackSnapshots = this.imdbWeeklySnapshots
        .filter(s => s.rankType === rankType)
        .sort((a, b) => b.capturedAt - a.capturedAt);

      if (fallbackSnapshots.length > 0) {
        const latest = fallbackSnapshots[0];
        for (const item of latest.items) {
          const cleanId = String(item.imdbId || '').trim().toLowerCase();
          if (!cleanId) continue;
          const points = Math.max(1, 101 - item.position);
          candidatesMap.set(cleanId, {
            imdbId: item.imdbId,
            title: item.title,
            originalTitle: item.originalTitle,
            year: item.year,
            rankType,
            cumulativeScore: points,
            bestPosition: item.position,
            appearancesCount: 1,
            originalPositions: [item.position],
            source: item.source
          });
        }
      }
    }

    // Critérios Oficiais de Desempate:
    // 1. Maior pontuação cumulativa no mês (b.cumulativeScore - a.cumulativeScore)
    // 2. Melhor posição única alcançada no mês (a.bestPosition - b.bestPosition)
    // 3. Maior quantidade de aparições semanais (b.appearancesCount - a.appearancesCount)
    // 4. Posição no snapshot mais recente (último elemento de originalPositions)
    return Array.from(candidatesMap.values()).sort((a, b) => {
      if (b.cumulativeScore !== a.cumulativeScore) {
        return b.cumulativeScore - a.cumulativeScore;
      }
      if (a.bestPosition !== b.bestPosition) {
        return a.bestPosition - b.bestPosition;
      }
      if (b.appearancesCount !== a.appearancesCount) {
        return b.appearancesCount - a.appearancesCount;
      }
      const lastA = a.originalPositions[a.originalPositions.length - 1] ?? 100;
      const lastB = b.originalPositions[b.originalPositions.length - 1] ?? 100;
      return lastA - lastB;
    });
  }

  /**
   * Consolida e pontua os candidatos de Animes a partir dos dados e tendências do AniList
   */
  public consolidateAniListCandidates(monthKey: string): ConsolidatedMonthlyCandidate[] {
    const relevantSnapshot = this.anilistMonthlySnapshots.find(s => s.monthKey === monthKey) ||
      this.anilistMonthlySnapshots[0];

    const candidates: ConsolidatedMonthlyCandidate[] = [];

    if (relevantSnapshot) {
      for (const it of relevantSnapshot.items) {
        // Fórmula Oficial AniList ZapiTV:
        // score = (100 - trendingRank * 3) + (score * 10)
        const calcScore = Math.round(it.score * 10 + Math.max(1, 100 - it.trendingRank * 3));
        candidates.push({
          imdbId: `anilist-${it.aniListId}`,
          aniListId: it.aniListId,
          tmdbId: it.tmdbId,
          title: it.title,
          originalTitle: it.romajiTitle || it.nativeTitle,
          year: it.year,
          rankType: 'anime',
          cumulativeScore: calcScore,
          bestPosition: it.position,
          appearancesCount: 1,
          originalPositions: [it.position],
          source: 'anilist'
        });
      }
    }

    // Ordenação por pontuação mensal calculada
    return candidates.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  }

  /**
   * Encontra a correspondência canônica de uma obra no catálogo unificado
   * Prioridade rigorosa a identificadores exatos (IMDb ID, AniList ID, TMDB ID),
   * nunca permitindo correspondências vagas de títulos ou remakes de anos divergentes.
   */
  public findCanonicalItem(
    candidate: ConsolidatedMonthlyCandidate,
    catalog: ContentItem[]
  ): ContentItem | null {
    const candImdb = (candidate.imdbId || '').trim().toLowerCase();
    const candAniList = candidate.aniListId;
    const candTmdb = candidate.tmdbId ? String(candidate.tmdbId).trim() : undefined;
    const candYear = candidate.year;
    const candType = candidate.rankType;

    // 1. Prioridade Absoluta: AniList ID para animes
    if (candType === 'anime' && candAniList) {
      const matchAni = catalog.find(c => {
        if (c.aniListId && c.aniListId === candAniList) return true;
        if (c.id && (c.id === `anime-anilist-${candAniList}` || c.id === `anilist-${candAniList}` || c.id === `anime:${candAniList}`)) return true;
        if (c.canonicalId && c.canonicalId.includes(`anilist:${candAniList}`)) return true;
        return false;
      });
      if (matchAni) return matchAni;
    }

    // 2. Prioridade Absoluta: IMDb ID exato (tt...)
    if (candImdb && candImdb.startsWith('tt')) {
      const matchImdb = catalog.find(c => {
        const itemImdb = (c.imdbId || '').trim().toLowerCase();
        if (itemImdb && itemImdb === candImdb) return true;
        if (c.id && c.id.toLowerCase().includes(candImdb)) return true;
        if (c.canonicalId && c.canonicalId.toLowerCase().includes(candImdb)) return true;
        return false;
      });
      if (matchImdb) return matchImdb;
    }

    // 3. TMDB ID Exato
    if (candTmdb) {
      const matchTmdb = catalog.find(c => {
        if (c.tmdbId && String(c.tmdbId).trim() === candTmdb) return true;
        if (c.id && c.id.includes(`tmdb-${candTmdb}`)) return true;
        return false;
      });
      if (matchTmdb) return matchTmdb;
    }

    // 4. Busca Estrita por Título Normalizado + Ano + Tipo
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();

    const normCandTitle = normalize(candidate.title);
    const normCandOrig = candidate.originalTitle ? normalize(candidate.originalTitle) : '';

    const textMatch = catalog.find(c => {
      // Validação estrita de tipo de mídia: filmes nunca combinam com séries e animes nunca combinam com séries
      if (candType === 'movie' && !searchService.isMovieItem(c)) return false;
      if (candType === 'series' && (!searchService.isSeriesItem(c) || searchService.isAnimeItem(c))) return false;
      if (candType === 'anime' && !searchService.isAnimeItem(c)) return false;

      // Validação de ano: tolerância máxima de 1 ano para diferenças de lançamento internacional
      if (candYear && c.year && Math.abs(c.year - candYear) > 1) {
        return false;
      }

      const normTitle = normalize(c.title);
      const normOrig = c.originalTitle ? normalize(c.originalTitle) : '';

      const matches =
        normTitle === normCandTitle ||
        (normCandOrig && normTitle === normCandOrig) ||
        (normOrig && normOrig === normCandTitle) ||
        (normCandOrig && normOrig && normOrig === normCandOrig);

      return matches;
    });

    return textMatch || null;
  }

  /**
   * Resolve o Top 10 Mensal Oficial de uma categoria com verificação estrita de elegibilidade.
   * Se um candidato for rejeitado, avança para o próximo da classificação mensal até completar 10.
   */
  public resolveTop10Category(
    candidates: ConsolidatedMonthlyCandidate[],
    category: RankingMediaType,
    catalog: ContentItem[],
    calendar: SaoPauloCalendarInfo
  ): { rankedItems: MonthlyRankedItem[]; audit: FeaturedAuditItem[] } {
    const rankedItems: MonthlyRankedItem[] = [];
    const audit: FeaturedAuditItem[] = [];
    const targetCount = 10;
    const currentYear = calendar.year;
    const todayStr = `${calendar.year}-${String(calendar.month).padStart(2, '0')}-${String(calendar.day).padStart(2, '0')}`;
    const seenIds = new Set<string>();

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const rankPosition = cand.bestPosition || (i + 1);

      const catalogItem = this.findCanonicalItem(cand, catalog);

      // CASO 1: Não encontrado no catálogo
      if (!catalogItem) {
        audit.push({
          imdbId: cand.imdbId,
          aniListId: cand.aniListId,
          tmdbId: cand.tmdbId,
          title: cand.title,
          imdbTitle: cand.title,
          year: cand.year,
          mediaType: category,
          rankPosition,
          status: 'REJECTED',
          isIncluded: false,
          availabilityStatus: 'not_in_catalog',
          rejectionReason: 'Obra não indexada no catálogo da ZapiTV',
          score: cand.cumulativeScore
        });
        continue;
      }

      // Evita duplicatas da mesma obra no ranking
      if (seenIds.has(catalogItem.id) || (catalogItem.canonicalId && seenIds.has(catalogItem.canonicalId))) {
        continue;
      }

      // CASO 2: Separação estanque de categorias (Filmes vs Séries vs Animes)
      if (category === 'movie') {
        if (!searchService.isMovieItem(catalogItem)) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'movie',
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            rejectionReason: 'Conteúdo não é um longa-metragem convencional',
            score: cand.cumulativeScore
          });
          continue;
        }
      } else if (category === 'series') {
        if (searchService.isAnimeItem(catalogItem)) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'series',
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            rejectionReason: 'Anime excluído do ranking de Séries (alocado no Top 10 Animes)',
            score: cand.cumulativeScore
          });
          continue;
        }
        if (!searchService.isSeriesItem(catalogItem)) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'series',
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            rejectionReason: 'Conteúdo não é uma série seriada de televisão',
            score: cand.cumulativeScore
          });
          continue;
        }
      } else if (category === 'anime') {
        if (!searchService.isAnimeItem(catalogItem)) {
          audit.push({
            aniListId: cand.aniListId,
            imdbId: cand.imdbId,
            title: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'anime',
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            rejectionReason: 'Conteúdo não é uma produção de animação japonesa (Anime)',
            score: cand.cumulativeScore
          });
          continue;
        }
      }

      // CASO 3: Ocultação Temporária Programada (A Odisseia 2026, Resident Evil 2026, etc.)
      const lockedRelease = catalogEligibilityService.getTemporarilyLockedRelease(catalogItem);
      if (lockedRelease) {
        const isCurrentlyVisible = catalogEligibilityService.isCatalogVisibleNow(catalogItem);
        if (!isCurrentlyVisible) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: category,
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            rejectionReason: lockedRelease.noticeMessage || 'Conteúdo temporariamente oculto no catálogo público até 20/11/2026 às 00:00 (Horário de Brasília).',
            score: cand.cumulativeScore
          });
          continue;
        }
      }

      // CASO 4: Obras não lançadas / Theatrical Window
      const itemYear = Number(catalogItem.year || cand.year) || currentYear;
      const isFuture = itemYear > currentYear || (catalogItem.releaseDate && catalogItem.releaseDate > todayStr);
      if (isFuture) {
        audit.push({
          imdbId: cand.imdbId,
          title: cand.title,
          canonicalTitle: catalogItem.title,
          year: cand.year,
          mediaType: category,
          rankPosition,
          status: 'REJECTED',
          isIncluded: false,
          canonicalId: catalogItem.id,
          rejectionReason: 'Título ainda não lançado comercialmente (data de estreia futura)',
          score: cand.cumulativeScore
        });
        continue;
      }

      if (category === 'movie') {
        const isTheatricallyAllowed = theatricalFilterService.isMovieAllowedSync(catalogItem);
        if (!isTheatricallyAllowed) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: 'movie',
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            rejectionReason: 'Filme em cartaz nos cinemas sem janela de streaming liberada',
            score: cand.cumulativeScore
          });
          continue;
        }
      }

      // CASO 5: Verificação de Disponibilidade e Fontes Reais
      const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(catalogItem);
      const availKey = catalogEligibilityService.getCanonicalKey(catalogItem);
      const availRec = mediaAvailabilityIndex.getRecord(availKey);

      const isExplicitlyUnavailable =
        catalogItem.availabilityStatus === 'unavailable' ||
        catalogItem.availabilityStatus === 'unreleased' ||
        (availRec && availRec.status === 'UNAVAILABLE_CONFIRMED');

      const hasConfirmedSources = Boolean(
        catalogItem.id.startsWith('open-') ||
        catalogItem.id.startsWith('anime-') ||
        catalogItem.availabilityStatus === 'verified' ||
        (catalogItem.verifiedStreams && catalogItem.verifiedStreams.length > 0) ||
        (catalogItem.videoUrl && catalogItem.videoUrl.trim().length > 0) ||
        (availRec && availRec.status === 'AVAILABLE' && availRec.validatedSourceCount > 0)
      );

      if (!isPlayable || isExplicitlyUnavailable || !hasConfirmedSources) {
        audit.push({
          imdbId: cand.imdbId,
          title: cand.title,
          canonicalTitle: catalogItem.title,
          year: cand.year,
          mediaType: category,
          rankPosition,
          status: 'REJECTED',
          isIncluded: false,
          canonicalId: catalogItem.id,
          rejectionReason: 'Sem fontes válidas ou reproduzíveis disponíveis na ZapiTV',
          score: cand.cumulativeScore
        });
        continue;
      }

      // CASO 6: Para Séries e Animes seriados: ao menos 1 episódio válido
      if (category === 'series' || (category === 'anime' && catalogItem.mediaFormat !== 'movie')) {
        const hasEpisodes =
          (catalogItem.episodes && catalogItem.episodes.length > 0) ||
          catalogItem.availabilityStatus === 'verified' ||
          (availRec && (availRec.availableEpisodeCount ?? 0) > 0);

        if (!hasEpisodes) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: category,
            rankPosition,
            status: 'REJECTED',
            isIncluded: false,
            canonicalId: catalogItem.id,
            rejectionReason: 'Série sem episódios disponíveis e reproduzíveis',
            score: cand.cumulativeScore
          });
          continue;
        }
      }

      // APROVADO! O título cumpre rigorosamente todos os critérios
      const finalRank = rankedItems.length + 1;
      seenIds.add(catalogItem.id);
      if (catalogItem.canonicalId) seenIds.add(catalogItem.canonicalId);

      const enrichedContentItem: ContentItem = {
        ...catalogItem,
        imdbId: cand.imdbId || catalogItem.imdbId,
        isFeatured: true,
        imdbRank: rankPosition,
        displayRank: finalRank,
        heroTags: [
          ...(catalogItem.heroTags || []),
          {
            id: `rank-${finalRank}`,
            text: `#${finalRank} Em Destaque (${calendar.monthLabel})`,
            color: category === 'movie' ? '#007df7' : category === 'series' ? '#c084fc' : '#06b6d4',
            style: 'solid'
          }
        ]
      };

      const rankedItem: MonthlyRankedItem = {
        position: finalRank,
        canonicalId: catalogItem.canonicalId || catalogItem.id,
        mediaType: category,
        title: catalogItem.title,
        originalTitle: catalogItem.originalTitle || cand.originalTitle,
        year: catalogItem.year || cand.year,
        poster: catalogItem.image,
        backdrop: catalogItem.backdrop,
        rating: catalogItem.rating,
        item: enrichedContentItem,
        calculatedScore: cand.cumulativeScore,
        source: cand.source || (category === 'anime' ? 'anilist' : 'imdb-consolidated'),
        originalPosition: rankPosition,
        monthKey: calendar.monthKey,
        monthLabel: calendar.monthLabel,
        isPartial: calendar.isCurrentMonth,
        validationStatus: 'verified',
        updatedAt: Date.now()
      };

      rankedItems.push(rankedItem);

      audit.push({
        imdbId: cand.imdbId,
        aniListId: cand.aniListId,
        tmdbId: cand.tmdbId,
        title: catalogItem.title,
        imdbTitle: cand.title,
        canonicalTitle: catalogItem.title,
        year: catalogItem.year,
        mediaType: category,
        imdbRank: rankPosition,
        displayRank: finalRank,
        rankPosition,
        finalPosition: finalRank,
        status: 'APPROVED',
        isIncluded: true,
        canonicalId: catalogItem.id,
        availabilityStatus: catalogItem.availabilityStatus || 'verified',
        hasAudioPtBr: catalogItem.audioStatus === 'pt-br-dubbed' || catalogItem.audioStatus === 'pt-br-original',
        audioStatus: catalogItem.audioStatus || 'other',
        verifiedSourcesCount: (catalogItem.verifiedStreams || []).length || 1,
        score: cand.cumulativeScore
      });

      if (rankedItems.length >= targetCount) {
        break;
      }
    }

    return { rankedItems, audit };
  }

  /**
   * Constrói o catálogo mestre ordenado garantindo que metadados canônicos validados
   * tenham estrita prioridade sobre entradas estáticas legadas.
   */
  public buildUnifiedCatalog(customCatalog?: ContentItem[]): ContentItem[] {
    const catalogMap = new Map<string, ContentItem>();

    // 1. Base Canônica Mestre (TMDB / IMDb / AniList unificados com mais alta prioridade)
    const masterItems = canonicalCatalogMaster.getAllItemsSync ? canonicalCatalogMaster.getAllItemsSync() : [];
    masterItems.forEach(it => {
      if (it && it.id) catalogMap.set(it.id, it);
    });

    // 2. Custom Catalog / Catálogo em tempo de execução
    if (customCatalog && Array.isArray(customCatalog)) {
      customCatalog.forEach(it => {
        if (it && it.id && !catalogMap.has(it.id)) catalogMap.set(it.id, it);
      });
    }

    // 3. Verified Open Items
    VERIFIED_OPEN_ITEMS.forEach(it => {
      if (it && it.id && !catalogMap.has(it.id)) catalogMap.set(it.id, it);
    });

    // 4. Filmes Base
    filmesData.forEach(it => {
      if (it && it.id && !catalogMap.has(it.id)) catalogMap.set(it.id, it);
    });

    // 5. Featured Catalog Items (apenas para complementar o que ainda não foi mapeado)
    FEATURED_CATALOG_ITEMS.forEach(it => {
      if (it && it.id && !catalogMap.has(it.id)) {
        catalogMap.set(it.id, it);
      }
    });

    return Array.from(catalogMap.values());
  }

  /**
   * Recalcula sincronicamente os 3 Rankings Mensais (Filmes, Séries e Animes)
   */
  public recomputeMonthlyRankingsSync(
    queryMonthKey?: string,
    customCatalog?: ContentItem[]
  ): MonthlyRankingSnapshot {
    const calendar = this.getSaoPauloCalendar(new Date(), queryMonthKey);
    const fullCatalog = this.buildUnifiedCatalog(customCatalog);

    // 1. FILMES: Consolidado mensal IMDb MOVIEmeter
    const movieCandidates = this.consolidateWeeklySnapshots(calendar.monthKey, 'movie');
    const moviesResult = this.resolveTop10Category(movieCandidates, 'movie', fullCatalog, calendar);

    // 2. SÉRIES: Consolidado mensal IMDb TVmeter com busca aprofundada
    const seriesCandidates = this.consolidateWeeklySnapshots(calendar.monthKey, 'series');
    const seriesResult = this.resolveTop10Category(seriesCandidates, 'series', fullCatalog, calendar);

    // 3. ANIMES: Consolidado mensal AniList (tendências + popularidade)
    const animeCandidates = this.consolidateAniListCandidates(calendar.monthKey);
    const animesResult = this.resolveTop10Category(animeCandidates, 'anime', fullCatalog, calendar);

    const nextDate = this.getNextScheduledUpdateDate();

    const snapshot: MonthlyRankingSnapshot = {
      monthKey: calendar.monthKey,
      monthLabel: calendar.monthLabel,
      year: calendar.year,
      month: calendar.month,
      isCurrentMonth: calendar.isCurrentMonth,
      statusLabel: calendar.statusLabel,
      lastUpdatedAt: Date.now(),
      nextScheduledUpdate: nextDate.getTime(),
      nextScheduledUpdateFormatted: this.formatNextScheduledRun(nextDate),
      movies: moviesResult.rankedItems,
      series: seriesResult.rankedItems,
      animes: animesResult.rankedItems,
      totalCandidatesEvaluated: {
        movies: movieCandidates.length,
        series: seriesCandidates.length,
        animes: animeCandidates.length
      },
      auditTrail: {
        approvedMovies: moviesResult.audit.filter(a => a.status === 'APPROVED'),
        rejectedMovies: moviesResult.audit.filter(a => a.status === 'REJECTED'),
        approvedSeries: seriesResult.audit.filter(a => a.status === 'APPROVED'),
        rejectedSeries: seriesResult.audit.filter(a => a.status === 'REJECTED'),
        approvedAnimes: animesResult.audit.filter(a => a.status === 'APPROVED'),
        rejectedAnimes: animesResult.audit.filter(a => a.status === 'REJECTED')
      }
    };

    this.cachedMonthlySnapshot = snapshot;
    this.saveToStorage(snapshot);
    this.dispatchUpdateEvent(snapshot);

    return snapshot;
  }

  /**
   * Obtém a data da próxima atualização semanal ou mensal agendada (segunda-feira ou dia 1 às 06:00 BRT)
   */
  public getNextScheduledUpdateDate(fromTime: Date = new Date()): Date {
    const d = new Date(fromTime.getTime());
    const currentDay = d.getUTCDay();
    const currentHour = d.getUTCHours();
    const currentMinute = d.getUTCMinutes();

    let daysUntilMonday = (1 - currentDay + 7) % 7;
    if (daysUntilMonday === 0) {
      if (currentHour > 9 || (currentHour === 9 && currentMinute > 0)) {
        daysUntilMonday = 7;
      }
    }

    const target = new Date(d.getTime());
    target.setUTCDate(d.getUTCDate() + daysUntilMonday);
    target.setUTCHours(9, 0, 0, 0); // 09:00 UTC = 06:00 BRT
    return target;
  }

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
   * Obtém o snapshot mensal atual de forma síncrona
   */
  public getMonthlyRankingSync(queryMonthKey?: string): MonthlyRankingSnapshot {
    if (!this.cachedMonthlySnapshot || (queryMonthKey && this.cachedMonthlySnapshot.monthKey !== queryMonthKey)) {
      return this.recomputeMonthlyRankingsSync(queryMonthKey);
    }
    return this.cachedMonthlySnapshot;
  }

  /**
   * Atualização assíncrona enriquecendo com AniList online se disponível
   */
  public async refreshMonthlyRankings(queryMonthKey?: string): Promise<MonthlyRankingSnapshot> {
    if (this.isProcessing) {
      return this.getMonthlyRankingSync(queryMonthKey);
    }
    this.isProcessing = true;

    try {
      // Tenta buscar atualizações recentes do AniList em segundo plano
      try {
        const liveAnimes = await aniListClient.getPopularAnimes(1, 20);
        if (liveAnimes && liveAnimes.length > 0) {
          liveAnimes.forEach(anime => {
            canonicalCatalogMaster.registerItem(anime);
          });
        }
      } catch (e) {
        console.warn('[MonthlyFeaturedRankingService] AniList live fetch skipped:', e);
      }

      return this.recomputeMonthlyRankingsSync(queryMonthKey);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Converte o snapshot mensal em formato compatível com FeaturedSelectionResult
   */
  public toFeaturedSelectionResult(snapshot: MonthlyRankingSnapshot): FeaturedSelectionResult {
    return {
      weekKey: `M-${snapshot.monthKey}`,
      weekLabel: snapshot.monthLabel,
      monthKey: snapshot.monthKey,
      monthLabel: snapshot.monthLabel,
      monthlyStatusLabel: snapshot.statusLabel,
      isPartialMonth: snapshot.isCurrentMonth,
      referenceDate: new Date(snapshot.lastUpdatedAt).toISOString().slice(0, 10),
      lastUpdatedAt: snapshot.lastUpdatedAt,
      lastCheckedAt: Date.now(),
      nextScheduledUpdate: snapshot.nextScheduledUpdate,
      nextScheduledUpdateFormatted: snapshot.nextScheduledUpdateFormatted,
      sourceReference: 'IMDb MOVIEmeter & TVmeter (Mensal Consolidado) + AniList',
      updateStatus: 'SUCCESS',
      isProvisionalWeekly: false,
      featuredMovies: snapshot.movies.map(m => m.item),
      featuredSeries: snapshot.series.map(s => s.item),
      featuredAnimes: snapshot.animes.map(a => a.item),
      monthlyRanking: snapshot,
      totalCandidatesEvaluated: {
        movies: snapshot.totalCandidatesEvaluated.movies,
        series: snapshot.totalCandidatesEvaluated.series,
        animes: snapshot.totalCandidatesEvaluated.animes
      },
      auditTrail: {
        approvedMovies: snapshot.auditTrail.approvedMovies,
        rejectedMovies: snapshot.auditTrail.rejectedMovies,
        approvedSeries: snapshot.auditTrail.approvedSeries,
        rejectedSeries: snapshot.auditTrail.rejectedSeries,
        approvedAnimes: snapshot.auditTrail.approvedAnimes,
        rejectedAnimes: snapshot.auditTrail.rejectedAnimes
      }
    };
  }

  private loadFromStorage(): void {
    if (this.storageAdapter) {
      const data = this.storageAdapter.load();
      if (data) {
        this.sanitizeSnapshot(data);
        this.cachedMonthlySnapshot = data;
        return;
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_MONTHLY_RANKINGS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.sanitizeSnapshot(parsed);
            this.cachedMonthlySnapshot = parsed;
          }
        }
      } catch (e) {
        console.warn('[MonthlyFeaturedRankingService] Falha ao ler cache do localStorage:', e);
      }
    }
  }

  private sanitizeSnapshot(snapshot: MonthlyRankingSnapshot): void {
    if (!snapshot || typeof snapshot !== 'object') return;
    const cleanList = (list: any[]) => {
      if (!Array.isArray(list)) return;
      list.forEach((ranked: MonthlyRankedItem) => {
        if (!ranked) return;
        const it = ranked.item || (ranked as any);
        if (it && (it.id === 'anime-frieren' || isCorruptedPosterUrl(it.image) || isCorruptedPosterUrl(ranked.poster))) {
          const fresh = FEATURED_CATALOG_ITEMS.find(f => f.id === (it.id || 'anime-frieren'));
          if (fresh) {
            if (ranked.poster && isCorruptedPosterUrl(ranked.poster)) ranked.poster = fresh.image || '';
            if (ranked.backdrop && isCorruptedPosterUrl(ranked.backdrop)) ranked.backdrop = fresh.backdrop || '';
            if (ranked.item) {
              ranked.item.image = fresh.image || '';
              ranked.item.backdrop = fresh.backdrop || '';
              ranked.item.episodes = fresh.episodes;
            }
          }
        }
      });
    };
    cleanList(snapshot.movies);
    cleanList(snapshot.series);
    cleanList(snapshot.animes);
  }

  private saveToStorage(snapshot: MonthlyRankingSnapshot): void {
    if (this.storageAdapter) {
      this.storageAdapter.save(snapshot);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_MONTHLY_RANKINGS, JSON.stringify(snapshot));
      } catch (e) {
        console.warn('[MonthlyFeaturedRankingService] Falha ao persistir no localStorage:', e);
      }
    }
  }

  private dispatchUpdateEvent(snapshot: MonthlyRankingSnapshot): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_MONTHLY_RANKING_UPDATED, { detail: snapshot }));
    }
  }

  public subscribe(listener: (snapshot: MonthlyRankingSnapshot) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const handler = (e: Event) => {
      const custom = e as CustomEvent<MonthlyRankingSnapshot>;
      if (custom.detail) {
        listener(custom.detail);
      } else if (this.cachedMonthlySnapshot) {
        listener(this.cachedMonthlySnapshot);
      }
    };

    window.addEventListener(EVENT_MONTHLY_RANKING_UPDATED, handler);
    return () => {
      window.removeEventListener(EVENT_MONTHLY_RANKING_UPDATED, handler);
    };
  }
}

export const monthlyFeaturedRankingService = MonthlyFeaturedRankingService.getInstance();
