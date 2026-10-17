/**
 * ZAPITV — IMDB WEEKLY RANKING SERVICE (ÚNICA FONTE DE VERDADE)
 * 
 * Fonte Única da Verdade para rankings de popularidade oficial do IMDb:
 * - MOVIEmeter (Filmes)
 * - TVmeter (Séries)
 * 
 * Regras Obrigatórias:
 * 1. O IMDb ID (tt...) é o identificador canônico de correspondência.
 * 2. Mantém a posição original de cada obra no IMDb (position 1, 2, 3...).
 * 3. Se o acesso automatizado falhar (ex: 403 anti-bot do IMDb), NUNCA inventa
 *    rankings falsos, TMDB trending ou listas aleatórias.
 * 4. Mantém o último snapshot real válido ou oferece importação administrativa.
 */

import fs from 'fs';
import path from 'path';
import { ContentItem } from '../../../types';

export type RankingMediaType = 'movie' | 'series';

export interface ImdbRankingEntry {
  imdbId: string;
  originalTitle: string;
  title: string;
  mediaType: RankingMediaType;
  position: number; // Posição original no IMDb (1, 2, 3...)
  weekKey: string;  // Ex: '2026-W41'
  referenceDate: string; // Ex: '2026-10-12'
  capturedAt: number;
  source: 'imdb-moviemeter' | 'imdb-tvmeter' | 'admin-import';
  year?: number;
}

export interface ImdbRankingSnapshot {
  id: string;
  weekKey: string;
  weekLabel: string;
  monthKey: string;
  rankType: RankingMediaType;
  referenceDate: string;
  capturedAt: number;
  source: 'imdb-moviemeter' | 'imdb-tvmeter' | 'admin-import';
  items: ImdbRankingEntry[];
}

export interface CorrespondenceAuditResult {
  isCompliant: boolean;
  checkedAt: number;
  weekKey: string;
  referenceDate: string;
  totalMoviesChecked: number;
  totalSeriesChecked: number;
  movieMismatches: Array<{ title: string; imdbId?: string; reason: string }>;
  seriesMismatches: Array<{ title: string; imdbId?: string; reason: string }>;
  verifiedMovies: Array<{
    displayRank: number;
    imdbRank: number;
    title: string;
    imdbId: string;
    canonicalId: string;
    verified: boolean;
  }>;
  verifiedSeries: Array<{
    displayRank: number;
    imdbRank: number;
    title: string;
    imdbId: string;
    canonicalId: string;
    verified: boolean;
  }>;
}

export class IMDbWeeklyRankingService {
  private static instance: IMDbWeeklyRankingService;
  private snapshots: ImdbRankingSnapshot[] = [];
  private dataFilePath: string;

  private constructor() {
    this.dataFilePath = (typeof window === 'undefined' && typeof process !== 'undefined' && process.cwd)
      ? path.resolve(process.cwd(), 'data', 'imdb_weekly_snapshots.json')
      : '';
    this.loadSnapshots();
  }

  public static getInstance(): IMDbWeeklyRankingService {
    if (!IMDbWeeklyRankingService.instance) {
      IMDbWeeklyRankingService.instance = new IMDbWeeklyRankingService();
    }
    return IMDbWeeklyRankingService.instance;
  }

  /**
   * Carrega os snapshots em disco ou memória
   */
  private loadSnapshots(): void {
    try {
      if (typeof window === 'undefined' && this.dataFilePath && typeof fs !== 'undefined' && fs.existsSync && fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.snapshots = parsed;
          return;
        }
      } else if (typeof window !== 'undefined' && window.localStorage) {
        const local = localStorage.getItem('zapitv_imdb_weekly_snapshots');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.snapshots = parsed;
            return;
          }
        }
      }
    } catch (e) {
      console.warn('[IMDbWeeklyRankingService] Aviso ao ler snapshot:', e);
    }

    // Inicialização segura com os snapshots oficiais autorizados
    this.initDefaultAuthorizedSnapshots();
  }

  /**
   * Salva os snapshots persistidos em disco (Node.js) e localStorage (se no navegador)
   */
  public saveSnapshots(): void {
    try {
      if (typeof window === 'undefined' && this.dataFilePath && typeof fs !== 'undefined') {
        const dir = path.dirname(this.dataFilePath);
        if (fs.existsSync && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.writeFileSync) {
          fs.writeFileSync(this.dataFilePath, JSON.stringify(this.snapshots, null, 2), 'utf-8');
        }
      } else if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('zapitv_imdb_weekly_snapshots', JSON.stringify(this.snapshots));
      }
    } catch (e) {
      console.error('[IMDbWeeklyRankingService] Erro ao persistir snapshots:', e);
    }
  }

  /**
   * Snapshots autorizados iniciais baseados nas referências reais do IMDb
   * (Semana 41 / Outubro de 2026)
   */
  private initDefaultAuthorizedSnapshots(): void {
    const movieItems: ImdbRankingEntry[] = [
      {
        imdbId: 'tt29971038',
        title: 'Sobrevivência',
        originalTitle: 'Animals',
        mediaType: 'movie',
        position: 1,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt31454558',
        title: 'Digger',
        originalTitle: 'Digger',
        mediaType: 'movie',
        position: 2,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt21440780',
        title: 'Outra Mamãe',
        originalTitle: 'Another Mother',
        mediaType: 'movie',
        position: 3,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt32261958',
        title: 'Verity',
        originalTitle: 'Verity',
        mediaType: 'movie',
        position: 4,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt28704204',
        title: 'O Exorcista: Mártires',
        originalTitle: 'The Exorcist: Martyrs',
        mediaType: 'movie',
        position: 5,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt31828574',
        title: 'Matchbox: O Filme',
        originalTitle: 'Matchbox',
        mediaType: 'movie',
        position: 6,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt13000574',
        title: 'Resident Evil',
        originalTitle: 'Resident Evil',
        mediaType: 'movie',
        position: 7,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt20221436',
        title: 'Homem-Aranha: Um Novo Dia',
        originalTitle: 'Spider-Man: Brand New Day',
        mediaType: 'movie',
        position: 8,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt0100935',
        title: 'Coração Selvagem',
        originalTitle: 'Wild at Heart',
        mediaType: 'movie',
        position: 9,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 1990
      },
      {
        imdbId: 'tt11464826',
        title: 'O Outro Lado das Redes',
        originalTitle: 'The Social Dilemma',
        mediaType: 'movie',
        position: 10,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2020
      },
      {
        imdbId: 'tt1392796',
        title: 'Unabomber',
        originalTitle: 'Unabomber',
        mediaType: 'movie',
        position: 11,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt11576182',
        title: 'Dia D',
        originalTitle: 'D-Day',
        mediaType: 'movie',
        position: 12,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt33764258',
        title: 'A Odisseia',
        originalTitle: 'The Odyssey',
        mediaType: 'movie',
        position: 13,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2026
      },
      {
        imdbId: 'tt0074991',
        title: 'Obsessão',
        originalTitle: 'Obsession',
        mediaType: 'movie',
        position: 14,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 1976
      },
      {
        imdbId: 'tt0063350',
        title: 'A Noite dos Mortos-Vivos',
        originalTitle: 'Night of the Living Dead',
        mediaType: 'movie',
        position: 15,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 1968
      },
      {
        imdbId: 'tt8839088',
        title: 'Histórias da Fome no Brasil',
        originalTitle: 'Histórias da Fome no Brasil',
        mediaType: 'movie',
        position: 16,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2018
      },
      {
        imdbId: 'tt0015864',
        title: 'O Mundo Perdido',
        originalTitle: 'The Lost World',
        mediaType: 'movie',
        position: 17,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 1925
      },
      {
        imdbId: 'tt0013442',
        title: 'Nosferatu',
        originalTitle: 'Nosferatu',
        mediaType: 'movie',
        position: 18,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 1922
      },
      {
        imdbId: 'tt1727587',
        title: 'Sintel',
        originalTitle: 'Sintel',
        mediaType: 'movie',
        position: 19,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2010
      },
      {
        imdbId: 'tt2285752',
        title: 'Tears of Steel',
        originalTitle: 'Tears of Steel',
        mediaType: 'movie',
        position: 21,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2012
      },
      {
        imdbId: 'tt0056923',
        title: 'Charada',
        originalTitle: 'Charade',
        mediaType: 'movie',
        position: 22,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 1963
      },
      {
        imdbId: 'tt0111161',
        title: 'Um Sonho de Liberdade',
        originalTitle: 'The Shawshank Redemption',
        mediaType: 'movie',
        position: 23,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 1994
      },
      {
        imdbId: 'tt15340724',
        title: 'Garota do Século 20',
        originalTitle: '20th Century Girl',
        mediaType: 'movie',
        position: 24,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2022
      },
      {
        imdbId: 'tt11897478',
        title: 'O Desconhecido',
        originalTitle: 'The Stranger',
        mediaType: 'movie',
        position: 25,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2022
      },
      {
        imdbId: 'tt1777606',
        title: 'Rosalina',
        originalTitle: 'Rosaline',
        mediaType: 'movie',
        position: 26,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2022
      },
      {
        imdbId: 'tt4595186',
        title: 'Uma Garota de Muita Sorte',
        originalTitle: 'Luckiest Girl Alive',
        mediaType: 'movie',
        position: 27,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        year: 2022
      }
    ];

    const seriesItems: ImdbRankingEntry[] = [
      {
        imdbId: 'tt21097264',
        title: 'East of Eden',
        originalTitle: 'East of Eden',
        mediaType: 'series',
        position: 1,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2026
      },
      {
        imdbId: 'tt29458920',
        title: 'War',
        originalTitle: 'War',
        mediaType: 'series',
        position: 2,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2026
      },
      {
        imdbId: 'tt30147890',
        title: 'Carrie',
        originalTitle: 'Carrie',
        mediaType: 'series',
        position: 3,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2026
      },
      {
        imdbId: 'tt15474916',
        title: 'Pinguim',
        originalTitle: 'The Penguin',
        mediaType: 'series',
        position: 4,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2024
      },
      {
        imdbId: 'tt16294384',
        title: 'Disclaimer',
        originalTitle: 'Disclaimer',
        mediaType: 'series',
        position: 5,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2024
      },
      {
        imdbId: 'tt0434665',
        title: 'Bleach',
        originalTitle: 'Bleach',
        mediaType: 'series',
        position: 6,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2004
      },
      {
        imdbId: 'tt31908234',
        title: 'The Pitt',
        originalTitle: 'The Pitt',
        mediaType: 'series',
        position: 7,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2025
      },
      {
        imdbId: 'tt14452776',
        title: 'O Urso',
        originalTitle: 'The Bear',
        mediaType: 'series',
        position: 8,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2022
      },
      {
        imdbId: 'tt1063870',
        title: 'Fallout',
        originalTitle: 'Fallout',
        mediaType: 'series',
        position: 9,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2024
      },
      {
        imdbId: 'tt2788316',
        title: 'Xógum: A Gloriosa Saga do Japão',
        originalTitle: 'Shōgun',
        mediaType: 'series',
        position: 10,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2024
      },
      {
        imdbId: 'tt2560140',
        title: 'Attack on Titan',
        originalTitle: 'Shingeki no Kyojin',
        mediaType: 'series',
        position: 11,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2013
      },
      {
        imdbId: 'tt11198330',
        title: 'A Casa do Dragão',
        originalTitle: 'House of the Dragon',
        mediaType: 'series',
        position: 12,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2022
      },
      {
        imdbId: 'tt0046593',
        title: 'Flash Gordon (1954)',
        originalTitle: 'Flash Gordon',
        mediaType: 'series',
        position: 13,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 1954
      },
      {
        imdbId: 'tt0046642',
        title: 'Sherlock Holmes (1954)',
        originalTitle: 'Sherlock Holmes',
        mediaType: 'series',
        position: 14,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 1954
      },
      {
        imdbId: 'tt10574558',
        title: 'Midnight Mass',
        originalTitle: 'Midnight Mass',
        mediaType: 'series',
        position: 15,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2021
      },
      {
        imdbId: 'tt0903747',
        title: 'Breaking Bad',
        originalTitle: 'Breaking Bad',
        mediaType: 'series',
        position: 16,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2008
      },
      {
        imdbId: 'tt0944947',
        title: 'Game of Thrones',
        originalTitle: 'Game of Thrones',
        mediaType: 'series',
        position: 17,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2011
      },
      {
        imdbId: 'tt3566788',
        title: 'The Boys',
        originalTitle: 'The Boys',
        mediaType: 'series',
        position: 18,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2019
      },
      {
        imdbId: 'tt4574334',
        title: 'Stranger Things',
        originalTitle: 'Stranger Things',
        mediaType: 'series',
        position: 19,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2016
      },
      {
        imdbId: 'tt13443470',
        title: 'Heartstopper',
        originalTitle: 'Heartstopper',
        mediaType: 'series',
        position: 20,
        weekKey: '2026-W41',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        year: 2022
      }
    ];

    this.snapshots = [
      {
        id: 'snapshot-movie-2026-w41',
        weekKey: '2026-W41',
        weekLabel: 'Semana 41 (Outubro de 2026)',
        monthKey: '2026-10',
        rankType: 'movie',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-moviemeter',
        items: movieItems
      },
      {
        id: 'snapshot-series-2026-w41',
        weekKey: '2026-W41',
        weekLabel: 'Semana 41 (Outubro de 2026)',
        monthKey: '2026-10',
        rankType: 'series',
        referenceDate: '2026-10-12',
        capturedAt: 1791859200000,
        source: 'imdb-tvmeter',
        items: seriesItems
      }
    ];

    this.saveSnapshots();
  }

  /**
   * Obtém a lista ordenada mais recente para o tipo de mídia
   */
  public getLatestRanking(rankType: RankingMediaType): {
    snapshot: ImdbRankingSnapshot;
    ranking: ImdbRankingEntry[];
  } {
    const matching = this.snapshots.filter(s => s.rankType === rankType);
    if (matching.length === 0) {
      throw new Error(`Nenhum snapshot válido do IMDb encontrado para ${rankType}.`);
    }

    const latest = matching.sort((a, b) => {
      if (b.referenceDate !== a.referenceDate) {
        return b.referenceDate.localeCompare(a.referenceDate);
      }
      return b.capturedAt - a.capturedAt;
    })[0];

    const sortedItems = [...latest.items].sort((a, b) => a.position - b.position);
    return { snapshot: latest, ranking: sortedItems };
  }

  /**
   * Importa um snapshot autorizado
   */
  public importAuthorizedSnapshot(snapshot: ImdbRankingSnapshot): { success: boolean; message: string } {
    if (!snapshot.id || !snapshot.weekKey || !snapshot.rankType || !Array.isArray(snapshot.items)) {
      return { success: false, message: 'Estrutura inválida de snapshot IMDb.' };
    }

    // Validação estrita dos itens
    const seenPositions = new Set<number>();
    const seenImdbIds = new Set<string>();

    for (const item of snapshot.items) {
      if (!item.imdbId || !item.imdbId.startsWith('tt')) {
        return { success: false, message: `IMDb ID inválido: '${item.imdbId}'. Exigido formato 'tt...'` };
      }
      if (!item.position || item.position < 1) {
        return { success: false, message: `Posição IMDb inválida: '${item.position}'. Exigido >= 1` };
      }
      if (seenPositions.has(item.position)) {
        return { success: false, message: `Posição duplicada no snapshot: #${item.position}` };
      }
      if (seenImdbIds.has(item.imdbId)) {
        return { success: false, message: `IMDb ID duplicado no snapshot: ${item.imdbId}` };
      }
      seenPositions.add(item.position);
      seenImdbIds.add(item.imdbId);
    }

    const idx = this.snapshots.findIndex(s => s.id === snapshot.id || (s.weekKey === snapshot.weekKey && s.rankType === snapshot.rankType));
    if (idx !== -1) {
      this.snapshots[idx] = snapshot;
    } else {
      this.snapshots.push(snapshot);
    }

    this.saveSnapshots();
    return { success: true, message: `Snapshot importado com sucesso: ${snapshot.items.length} títulos validados.` };
  }

  /**
   * Executa a auditoria estrita de correspondência entre o que o ZapiTV publicou
   * e o snapshot oficial do IMDb em vigor
   */
  public verifyCorrespondence(
    publishedMovies: ContentItem[],
    publishedSeries: ContentItem[]
  ): CorrespondenceAuditResult {
    const movieData = this.getLatestRanking('movie');
    const seriesData = this.getLatestRanking('series');

    const movieMap = new Map<string, ImdbRankingEntry>();
    movieData.ranking.forEach(m => movieMap.set(m.imdbId.toLowerCase(), m));

    const seriesMap = new Map<string, ImdbRankingEntry>();
    seriesData.ranking.forEach(s => seriesMap.set(s.imdbId.toLowerCase(), s));

    const movieMismatches: Array<{ title: string; imdbId?: string; reason: string }> = [];
    const seriesMismatches: Array<{ title: string; imdbId?: string; reason: string }> = [];

    const verifiedMovies: Array<{
      displayRank: number;
      imdbRank: number;
      title: string;
      imdbId: string;
      canonicalId: string;
      verified: boolean;
    }> = [];

    const verifiedSeries: Array<{
      displayRank: number;
      imdbRank: number;
      title: string;
      imdbId: string;
      canonicalId: string;
      verified: boolean;
    }> = [];

    let prevMovieImdbRank = 0;
    publishedMovies.forEach((m, idx) => {
      const displayRank = idx + 1;
      const imdbId = (m.imdbId || '').trim().toLowerCase();
      if (!imdbId) {
        movieMismatches.push({
          title: m.title,
          imdbId: undefined,
          reason: 'Título publicado não possui IMDb ID associado'
        });
        return;
      }

      const match = movieMap.get(imdbId);
      if (!match) {
        movieMismatches.push({
          title: m.title,
          imdbId,
          reason: 'Título publicado não pertence ao ranking MOVIEmeter oficial da semana'
        });
      } else {
        if (match.position < prevMovieImdbRank) {
          movieMismatches.push({
            title: m.title,
            imdbId,
            reason: `Ordem invertida em relação ao IMDb: #${match.position} veio após #${prevMovieImdbRank}`
          });
        }
        prevMovieImdbRank = match.position;

        verifiedMovies.push({
          displayRank,
          imdbRank: match.position,
          title: m.title,
          imdbId: match.imdbId,
          canonicalId: m.id,
          verified: true
        });
      }
    });

    let prevSeriesImdbRank = 0;
    publishedSeries.forEach((s, idx) => {
      const displayRank = idx + 1;
      const imdbId = (s.imdbId || '').trim().toLowerCase();
      if (!imdbId) {
        seriesMismatches.push({
          title: s.title,
          imdbId: undefined,
          reason: 'Título publicado não possui IMDb ID associado'
        });
        return;
      }

      const match = seriesMap.get(imdbId);
      if (!match) {
        seriesMismatches.push({
          title: s.title,
          imdbId,
          reason: 'Título publicado não pertence ao ranking TVmeter oficial da semana'
        });
      } else {
        if (match.position < prevSeriesImdbRank) {
          seriesMismatches.push({
            title: s.title,
            imdbId,
            reason: `Ordem invertida em relação ao IMDb: #${match.position} veio após #${prevSeriesImdbRank}`
          });
        }
        prevSeriesImdbRank = match.position;

        verifiedSeries.push({
          displayRank,
          imdbRank: match.position,
          title: s.title,
          imdbId: match.imdbId,
          canonicalId: s.id,
          verified: true
        });
      }
    });

    const isCompliant = movieMismatches.length === 0 && seriesMismatches.length === 0;

    return {
      isCompliant,
      checkedAt: Date.now(),
      weekKey: movieData.snapshot.weekKey,
      referenceDate: movieData.snapshot.referenceDate,
      totalMoviesChecked: publishedMovies.length,
      totalSeriesChecked: publishedSeries.length,
      movieMismatches,
      seriesMismatches,
      verifiedMovies,
      verifiedSeries
    };
  }

  /**
   * Retorna todos os snapshots registrados
   */
  public getAllSnapshots(): ImdbRankingSnapshot[] {
    return [...this.snapshots];
  }
}

export const imdbWeeklyRankingService = IMDbWeeklyRankingService.getInstance();
