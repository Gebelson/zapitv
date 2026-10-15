/**
 * ZapiTV - AutoReleaseService
 * Sistema Automático de Descoberta e Atualização de Lançamentos do Catálogo.
 * 
 * Funcionalidades:
 * 1. Descoberta Diária: Varre TMDB e AniList por filmes em lançamento digital, novas séries e animes da temporada.
 * 2. Bloqueio Rigoroso de CAM: Rejeita gravações de sala de cinema via CamBlockerEngine.
 * 3. Janela Cinematográfica: Obedece theatricalFilterService (sem filmes em cartaz).
 * 4. Validação Prévia de Reprodução: NUNCA adiciona uma obra sem fonte confirmada, compatível e autorizada.
 * 5. Novos Episódios: Atualiza séries e animes já catalogados com episódios recém-disponibilizados.
 * 6. Priorização de Áudio PT-BR: Identifica dublagens e versões em português.
 * 7. Fila de Pendentes: Obras sem fontes válidas aguardam reavaliação periódica sem poluir o catálogo.
 * 8. Sincronização e Desempenho: Execução incremental no backend, com cache e compatibilidade com Vercel Crons.
 */

import { ContentItem, ContentType } from '../../../types';
import { tmdbService, TMDBRawItem, formatCinemetaItem } from '../tmdb/tmdbClient';
import { CamBlockerEngine } from './CamBlockerEngine';
import { theatricalFilterService } from './theatricalFilterService';
import { providerRegistry } from '../providers/providerRegistry';
import { mediaAvailabilityIndex } from './MediaAvailabilityIndex';
import { catalogReleaseStore } from './CatalogReleaseStore';
import { searchService } from '../search/searchService';
import { audioPreferenceService } from '../audio/audioPreferenceService';
import { catalogEligibilityService } from './CatalogEligibilityService';

export interface AutoReleaseSyncResult {
  timestamp: number;
  newMoviesAdded: number;
  newSeriesAdded: number;
  newAnimesAdded: number;
  newEpisodesAdded: number;
  camSourcesBlocked: number;
  theatricalBlocked: number;
  pendingUnavailables: number;
  errors: string[];
}

export class AutoReleaseService {
  private static instance: AutoReleaseService;
  private isSyncing = false;

  private constructor() {}

  public static getInstance(): AutoReleaseService {
    if (!AutoReleaseService.instance) {
      AutoReleaseService.instance = new AutoReleaseService();
    }
    return AutoReleaseService.instance;
  }

  /**
   * Executa a rotina diária incremental de descoberta e atualização de lançamentos
   */
  public async runDailyReleaseSync(): Promise<AutoReleaseSyncResult> {
    if (this.isSyncing) {
      console.log('[AutoReleaseService] Sincronização já em andamento. Aguardando...');
      return {
        timestamp: Date.now(),
        newMoviesAdded: 0,
        newSeriesAdded: 0,
        newAnimesAdded: 0,
        newEpisodesAdded: 0,
        camSourcesBlocked: 0,
        theatricalBlocked: 0,
        pendingUnavailables: 0,
        errors: ['Sync already in progress']
      };
    }

    this.isSyncing = true;
    console.log('[AutoReleaseService] Iniciando varredura diária de lançamentos...');

    const result: AutoReleaseSyncResult = {
      timestamp: Date.now(),
      newMoviesAdded: 0,
      newSeriesAdded: 0,
      newAnimesAdded: 0,
      newEpisodesAdded: 0,
      camSourcesBlocked: 0,
      theatricalBlocked: 0,
      pendingUnavailables: 0,
      errors: []
    };

    try {
      // 1. DESCOBERTA DE FILMES RECÉM-LANÇADOS EM MÍDIA DIGITAL (VOD / STREAMING)
      await this.discoverNewMovies(result);

      // 2. DESCOBERTA DE NOVAS SÉRIES DE TV
      await this.discoverNewSeries(result);

      // 3. DESCOBERTA DE NOVOS ANIMES DA TEMPORADA ATUAL
      await this.discoverNewAnimes(result);

      // 4. VERIFICAÇÃO DE NOVOS EPISÓDIOS PARA SÉRIES E ANIMES EXISTENTES
      await this.checkNewEpisodes(result);

      // 5. REAVALIAÇÃO INCREMENTAL DE TÍTULOS PENDENTES NA FILA
      await this.recheckPendingQueue(result);

      console.log('[AutoReleaseService] Varredura diária concluída com sucesso:', result);
    } catch (err: any) {
      console.error('[AutoReleaseService] Erro durante a varredura de lançamentos:', err);
      result.errors.push(err.message || String(err));
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Descobre filmes recentemente disponibilizados em digital e verifica fontes válidas
   */
  private async discoverNewMovies(result: AutoReleaseSyncResult): Promise<void> {
    try {
      // Consulta os filmes populares recentes do TMDB
      const moviesData = await tmdbService.getPopularMoviesWithMeta(1);
      const candidates = moviesData.items.slice(0, 15);

      for (const candidate of candidates) {
        // Regra 1: Janela de cinema e lançamentos futuros
        const isTheatrical = theatricalFilterService.isKnownUnreleasedOrTheatrical(candidate) || !theatricalFilterService.isMovieAllowedSync(candidate);
        if (isTheatrical) {
          result.theatricalBlocked++;
          continue;
        }

        // Regra 2: Verifica fontes de reprodução e bloqueio de CAM
        const streams = await providerRegistry.resolveStreams('movie', {
          id: candidate.id,
          imdbId: candidate.imdbId,
          tmdbId: candidate.tmdbId,
          title: candidate.title,
          originalTitle: candidate.originalTitle,
          year: candidate.year
        });

        // Filtra fontes válidas sem CAM
        const cleanStreams = streams.filter(s => {
          const camEval = CamBlockerEngine.evaluateStream(s, candidate);
          if (camEval.isCam) {
            result.camSourcesBlocked++;
            return false;
          }
          return true;
        });

        if (cleanStreams.length > 0) {
          // Identifica dublagem PT-BR
          const hasPtBr = cleanStreams.some(s => audioPreferenceService.analyzeAudio(s).isPtBr || s.isPtBr);
          if (hasPtBr) {
            candidate.audioStatus = 'pt-br-dubbed';
          }

          // Adiciona ao catálogo de lançamentos
          const added = catalogReleaseStore.addRelease(candidate);
          if (added) {
            result.newMoviesAdded++;
            mediaAvailabilityIndex.markAvailable(candidate.imdbId || candidate.id, 'movie', {
              title: candidate.title,
              sourceCount: cleanStreams.length,
              providersChecked: ['ZapiTV AutoRelease'],
              hasPtBrAudio: hasPtBr,
              bestQuality: cleanStreams[0].quality || '1080p'
            });
          }
        } else {
          // Registra na fila de pendentes sem anunciar como reproduzível
          catalogReleaseStore.recordPending({
            id: candidate.id,
            imdbId: candidate.imdbId,
            tmdbId: candidate.tmdbId,
            title: candidate.title,
            type: ContentType.MOVIE,
            year: candidate.year,
            reason: 'Aguardando liberação de fontes limpas sem CAM'
          });
          result.pendingUnavailables++;
        }
      }
    } catch (e: any) {
      result.errors.push(`Erro ao descobrir filmes: ${e.message}`);
    }
  }

  /**
   * Processa uma candidata a série: enriquece IDs, identifica episódios lançados,
   * valida streams (sem CAM) e adiciona ao catálogo apenas com episódios reais e comprovados.
   */
  public async processSeriesCandidate(candidate: ContentItem): Promise<{ added: boolean; episodesAdded: number; reason?: string }> {
    if (!searchService.isSeriesItem(candidate)) {
      return { added: false, episodesAdded: 0, reason: 'Item não é série de TV' };
    }

    // 1. Resolução e enriquecimento de IDs (IMDb ID e TMDB ID)
    if (!candidate.imdbId && candidate.tmdbId) {
      const resolved = await tmdbService.getImdbId(String(candidate.tmdbId), 'series');
      if (resolved) candidate.imdbId = resolved;
    }
    if (!candidate.imdbId && candidate.id.startsWith('tt')) {
      candidate.imdbId = candidate.id;
    }

    // Se ainda não tiver IMDb ID, tenta buscar pelo título no Cinemeta
    if (!candidate.imdbId && candidate.title) {
      try {
        const cineSearchUrl = `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(candidate.title)}.json`;
        const cRes = await fetch(cineSearchUrl, { signal: AbortSignal.timeout(3000) });
        if (cRes.ok) {
          const cData = await cRes.json();
          const match = cData.metas?.find((m: any) => m.name?.toLowerCase() === candidate.title.toLowerCase()) || cData.metas?.[0];
          if (match?.id?.startsWith('tt')) {
            candidate.imdbId = match.id;
          }
        }
      } catch {}
    }

    // 2. Consulta episódios reais e datas de exibição via Cinemeta
    let cinemetaVideos: any[] = [];
    if (candidate.imdbId) {
      try {
        const metaUrl = `https://v3-cinemeta.strem.io/meta/series/${candidate.imdbId}.json`;
        const metaRes = await fetch(metaUrl, { signal: AbortSignal.timeout(10000) });
        if (metaRes.ok) {
          const metaJson = await metaRes.json();
          if (Array.isArray(metaJson.meta?.videos)) {
            cinemetaVideos = metaJson.meta.videos;
          }
        }
      } catch {}
    }

    // Filtra apenas episódios com data de lançamento comprovadamente já ocorrida (hoje ou passado)
    const todayStr = new Date().toISOString().slice(0, 10);
    const releasedVideos = cinemetaVideos.filter((v: any) => {
      const airDate = (v.released || v.firstAired || '').slice(0, 10);
      return airDate && airDate <= todayStr;
    });

    // Se não encontrou vídeos com data no Cinemeta, assume pelo menos episódio 1 se ano <= ano atual
    const epNumbersToCheck: number[] = releasedVideos.length > 0 
      ? releasedVideos.map((v: any) => v.number || v.episode || 1)
      : [1];

    // 3. Validação prévia de fontes para os episódios estreados (sem CAM, sem fontes fraudulentas)
    const validEpisodes: any[] = [];
    let hasPtBrAudio = false;

    for (const epNum of epNumbersToCheck) {
      const vInfo = releasedVideos.find((v: any) => (v.number || v.episode) === epNum);
      const streams = await providerRegistry.resolveStreams('series', {
        id: candidate.id,
        imdbId: candidate.imdbId,
        tmdbId: candidate.tmdbId,
        title: candidate.title,
        originalTitle: candidate.originalTitle,
        year: candidate.year
      }, { season: 1, episode: epNum });

      const cleanStreams = streams.filter(s => !CamBlockerEngine.isCamStream(s, candidate));

      if (cleanStreams.length > 0) {
        if (!hasPtBrAudio && cleanStreams.some(s => audioPreferenceService.analyzeAudio(s).isPtBr || s.isPtBr)) {
          hasPtBrAudio = true;
        }

        validEpisodes.push({
          id: `${candidate.id}-s1-e${epNum}`,
          season: 1,
          number: epNum,
          title: vInfo?.name || vInfo?.title || `Episódio ${epNum}`,
          description: vInfo?.overview || vInfo?.description || `Episódio ${epNum} da série ${candidate.title}`,
          image: vInfo?.thumbnail || candidate.backdrop || candidate.image,
          videoUrl: cleanStreams[0].url,
          releaseDate: (vInfo?.released || vInfo?.firstAired || '').slice(0, 10) || todayStr
        });
      }
    }

    if (validEpisodes.length > 0) {
      if (hasPtBrAudio) candidate.audioStatus = 'pt-br-dubbed';
      candidate.episodes = validEpisodes;

      const added = catalogReleaseStore.addRelease(candidate);
      if (added) {
        mediaAvailabilityIndex.markAvailable(candidate.imdbId || candidate.id, 'series', {
          title: candidate.title,
          sourceCount: validEpisodes.length,
          providersChecked: ['ZapiTV AutoRelease'],
          hasPtBrAudio,
          episodeCount: validEpisodes.length
        });
        catalogEligibilityService.evaluateItem(candidate).catch(() => {});
      }
      return { added, episodesAdded: validEpisodes.length };
    } else {
      catalogReleaseStore.recordPending({
        id: candidate.id,
        imdbId: candidate.imdbId,
        tmdbId: candidate.tmdbId,
        title: candidate.title,
        type: ContentType.SERIES,
        year: candidate.year,
        seasonNumber: 1,
        episodeNumber: 1,
        reason: 'Episódios estreados ainda sem fontes limpas e autorizadas nos provedores'
      });
      return { added: false, episodesAdded: 0, reason: 'Sem fontes válidas' };
    }
  }

  /**
   * Descobre novas séries de TV recentemente lançadas consultando estreias recentes e séries no ar
   */
  private async discoverNewSeries(result: AutoReleaseSyncResult): Promise<void> {
    try {
      const [recentData, onAirData, popularData] = await Promise.allSettled([
        tmdbService.getRecentSeriesWithMeta(1),
        tmdbService.getOnTheAirSeriesWithMeta(1),
        tmdbService.getPopularSeriesWithMeta(1)
      ]);

      const candidateMap = new Map<string, ContentItem>();
      const addCandidate = (item: ContentItem) => {
        if (!item || !item.title) return;
        const key = (item.imdbId || item.id || item.title).toLowerCase();
        if (!candidateMap.has(key)) candidateMap.set(key, item);
      };

      if (recentData.status === 'fulfilled') recentData.value.items.forEach(addCandidate);
      if (onAirData.status === 'fulfilled') onAirData.value.items.forEach(addCandidate);
      if (popularData.status === 'fulfilled') popularData.value.items.slice(0, 10).forEach(addCandidate);

      const candidates = Array.from(candidateMap.values()).slice(0, 15);

      for (const candidate of candidates) {
        const res = await this.processSeriesCandidate(candidate);
        if (res.added) {
          result.newSeriesAdded++;
          result.newEpisodesAdded += res.episodesAdded;
        } else if (res.reason === 'Sem fontes válidas') {
          result.pendingUnavailables++;
        }
      }
    } catch (e: any) {
      result.errors.push(`Erro ao descobrir séries: ${e.message}`);
    }
  }

  /**
   * Avalia e adiciona uma obra específica pelo título ou IMDb ID.
   * Usado para reavaliações manuais, testes de homologação ou buscas diretas.
   */
  public async evaluateAndAddSeries(titleOrImdb: string): Promise<{ success: boolean; item?: ContentItem; reason?: string }> {
    const isImdb = titleOrImdb.startsWith('tt');
    let candidate: ContentItem | null = null;

    if (isImdb) {
      const fromTmdb = await tmdbService.findByImdb(titleOrImdb);
      if (fromTmdb) candidate = fromTmdb;
      if (!candidate) {
        const cineMeta = await tmdbService.getCinemetaMeta('series', titleOrImdb);
        if (cineMeta) candidate = formatCinemetaItem(cineMeta);
      }
    }

    if (!candidate) {
      const searchRes = await tmdbService.searchSeries(titleOrImdb);
      if (searchRes && searchRes.length > 0) {
        candidate = searchRes[0];
      }
    }

    if (!candidate) {
      return { success: false, reason: `Obra não encontrada: ${titleOrImdb}` };
    }

    const res = await this.processSeriesCandidate(candidate);
    return {
      success: res.added,
      item: candidate,
      reason: res.reason
    };
  }

  /**
   * Descobre novos animes da temporada atual via AniList GraphQL
   */
  private async discoverNewAnimes(result: AutoReleaseSyncResult): Promise<void> {
    try {
      const query = `
        query {
          Page(page: 1, perPage: 8) {
            media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
              id
              title { romaji english userPreferred native }
              format
              episodes
              genres
              description
              coverImage { extraLarge }
              bannerImage
              startDate { year }
            }
          }
        }
      `;

      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(5000)
      });

      if (!res.ok) return;
      const json: any = await res.json();
      const animeNodes = json.data?.Page?.media || [];

      for (const node of animeNodes) {
        const title = node.title?.userPreferred || node.title?.english || node.title?.romaji || 'Anime';
        const candidate: ContentItem = {
          id: `anilist-${node.id}`,
          title,
          originalTitle: node.title?.romaji || node.title?.native,
          type: ContentType.ANIME,
          mediaFormat: node.format === 'MOVIE' ? 'movie' : 'series',
          year: node.startDate?.year || 2024,
          image: node.coverImage?.extraLarge || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500',
          backdrop: node.bannerImage || node.coverImage?.extraLarge,
          genres: [...(node.genres || []), 'Anime'],
          description: (node.description || '').replace(/<[^>]*>?/gm, '')
        };

        const streams = await providerRegistry.resolveStreams('anime', {
          id: candidate.id,
          title: candidate.title,
          originalTitle: candidate.originalTitle,
          year: candidate.year
        }, { season: 1, episode: 1 });

        const cleanStreams = streams.filter(s => !CamBlockerEngine.isCamStream(s, candidate));

        if (cleanStreams.length > 0) {
          const added = catalogReleaseStore.addRelease(candidate);
          if (added) {
            result.newAnimesAdded++;
            mediaAvailabilityIndex.markAvailable(candidate.id, 'anime', {
              title: candidate.title,
              sourceCount: cleanStreams.length,
              providersChecked: ['AniList + ZapiStream']
            });
          }
        } else {
          catalogReleaseStore.recordPending({
            id: candidate.id,
            title: candidate.title,
            type: ContentType.ANIME,
            year: candidate.year,
            reason: 'Anime da temporada aguardando disponibilização de streams'
          });
          result.pendingUnavailables++;
        }
      }
    } catch (e: any) {
      result.errors.push(`Erro ao descobrir animes: ${e.message}`);
    }
  }

  /**
   * Verifica e atualiza novos episódios de séries e animes já catalogados
   */
  private async checkNewEpisodes(result: AutoReleaseSyncResult): Promise<void> {
    try {
      const activeWorks = catalogReleaseStore.getReleases().filter(r => 
        r.type === ContentType.SERIES || (r.type === ContentType.ANIME && r.mediaFormat === 'series')
      );

      // Limita verificação incremental a 5 obras por ciclo para preservar limites de taxa
      const batch = activeWorks.slice(0, 5);

      for (const work of batch) {
        const lastEpNum = (work.episodes && work.episodes.length > 0) 
          ? Math.max(...work.episodes.map(e => e.number))
          : 0;

        const nextEpNum = lastEpNum + 1;
        const streams = await providerRegistry.resolveStreams(
          work.type === ContentType.ANIME ? 'anime' : 'series',
          { id: work.id, imdbId: work.imdbId, tmdbId: work.tmdbId, title: work.title },
          { season: 1, episode: nextEpNum }
        );

        const cleanStreams = streams.filter(s => !CamBlockerEngine.isCamStream(s, work));

        if (cleanStreams.length > 0) {
          const added = catalogReleaseStore.addEpisodeToWork(work.id, {
            id: `${work.id}-s1-e${nextEpNum}`,
            number: nextEpNum,
            season: 1,
            title: `Episódio ${nextEpNum}`,
            videoUrl: cleanStreams[0].url
          });

          if (added) {
            result.newEpisodesAdded++;
          }
        }
      }
    } catch (e: any) {
      result.errors.push(`Erro ao checar novos episódios: ${e.message}`);
    }
  }

  /**
   * Reavalia títulos pendentes da fila cujo tempo de espera expirou
   */
  private async recheckPendingQueue(result: AutoReleaseSyncResult): Promise<void> {
    const duePendings = catalogReleaseStore.getDuePendings().slice(0, 5);

    for (const pending of duePendings) {
      const streams = await providerRegistry.resolveStreams(
        pending.type === ContentType.MOVIE ? 'movie' : (pending.type === ContentType.ANIME ? 'anime' : 'series'),
        { id: pending.id, imdbId: pending.imdbId, tmdbId: pending.tmdbId, title: pending.title }
      );

      const cleanStreams = streams.filter(s => !CamBlockerEngine.isCamStream(s));

      if (cleanStreams.length > 0) {
        // Título que estava pendente agora tem fonte limpa disponível!
        const item: ContentItem = {
          id: pending.id,
          imdbId: pending.imdbId,
          tmdbId: pending.tmdbId,
          title: pending.title,
          type: pending.type,
          year: pending.year || 2024
        };

        const added = catalogReleaseStore.addRelease(item);
        if (added) {
          if (pending.type === ContentType.MOVIE) result.newMoviesAdded++;
          else if (pending.type === ContentType.SERIES) result.newSeriesAdded++;
          else result.newAnimesAdded++;

          mediaAvailabilityIndex.markAvailable(pending.imdbId || pending.id, pending.type === ContentType.MOVIE ? 'movie' : 'series', {
            title: pending.title,
            sourceCount: cleanStreams.length,
            providersChecked: ['Recheck Pending']
          });
        }
      } else {
        // Continua sem fonte: atualiza tentativa e recalcula recheckAfter
        catalogReleaseStore.recordPending({
          id: pending.id,
          imdbId: pending.imdbId,
          tmdbId: pending.tmdbId,
          title: pending.title,
          type: pending.type,
          year: pending.year,
          reason: 'Ainda sem fontes autorizadas após rechecagem'
        });
      }
    }
  }
}

export const autoReleaseService = AutoReleaseService.getInstance();
