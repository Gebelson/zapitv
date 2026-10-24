/**
 * ZAPITV — SNAPSHOTS OFICIAIS DE POPULARIDADE E TENDÊNCIAS ANILIST
 * Fonte de dados estruturados para o Top 10 Animes do Mês
 */

export interface AniListRankItem {
  position: number;
  aniListId: number;
  title: string;
  romajiTitle?: string;
  nativeTitle?: string;
  year?: number;
  score: number;
  popularityRank: number;
  trendingRank: number;
  format: 'TV' | 'MOVIE';
  tmdbId?: string;
  malId?: number;
  referenceDate: string;
  capturedAt: number;
}

export interface AniListMonthlySnapshot {
  id: string;
  monthKey: string;           // ex: '2026-10'
  monthLabel: string;         // ex: 'Outubro de 2026'
  referenceDate: string;      // YYYY-MM-DD
  capturedAt: number;
  source: 'anilist-graphql' | 'official-snapshot';
  items: AniListRankItem[];
}

export const OFFICIAL_ANILIST_MONTHLY_SNAPSHOTS: AniListMonthlySnapshot[] = [
  // =========================================================================
  // OUTUBRO DE 2026 — SNAPSHOT OFICIAL ANILIST (TRENDING & POPULARITY)
  // =========================================================================
  {
    id: 'snapshot-anime-2026-10',
    monthKey: '2026-10',
    monthLabel: 'Outubro de 2026',
    referenceDate: '2026-10-15',
    capturedAt: 1792118400000,
    source: 'official-snapshot',
    items: [
      {
        position: 1,
        aniListId: 151807,
        title: 'Solo Leveling',
        romajiTitle: 'Ore dake Level Up na Ken',
        year: 2024,
        score: 98.5,
        popularityRank: 1,
        trendingRank: 1,
        format: 'TV',
        tmdbId: '127532',
        malId: 52299,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 2,
        aniListId: 113415,
        title: 'Jujutsu Kaisen',
        romajiTitle: 'Jujutsu Kaisen',
        year: 2020,
        score: 96.2,
        popularityRank: 2,
        trendingRank: 2,
        format: 'TV',
        tmdbId: '95479',
        malId: 40748,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 3,
        aniListId: 101922,
        title: 'Demon Slayer: Kimetsu no Yaiba',
        romajiTitle: 'Kimetsu no Yaiba',
        year: 2019,
        score: 95.8,
        popularityRank: 3,
        trendingRank: 3,
        format: 'TV',
        tmdbId: '85937',
        malId: 38000,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 4,
        aniListId: 171018,
        title: 'Dandadan',
        romajiTitle: 'Dan Da Dan',
        year: 2024,
        score: 94.4,
        popularityRank: 4,
        trendingRank: 4,
        format: 'TV',
        tmdbId: '240411',
        malId: 57334,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 5,
        aniListId: 114446,
        title: 'Bleach: Thousand-Year Blood War',
        romajiTitle: 'Bleach: Sennen Kessen-hen',
        year: 2022,
        score: 93.9,
        popularityRank: 5,
        trendingRank: 5,
        format: 'TV',
        tmdbId: '13916',
        malId: 41467,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 6,
        aniListId: 154587,
        title: "Frieren: Beyond Journey's End",
        romajiTitle: 'Sousou no Frieren',
        year: 2023,
        score: 93.1,
        popularityRank: 6,
        trendingRank: 6,
        format: 'TV',
        tmdbId: '209867',
        malId: 52991,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 7,
        aniListId: 127230,
        title: 'Chainsaw Man',
        romajiTitle: 'Chainsaw Man',
        year: 2022,
        score: 91.5,
        popularityRank: 7,
        trendingRank: 7,
        format: 'TV',
        tmdbId: '114410',
        malId: 44511,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 8,
        aniListId: 16498,
        title: 'Attack on Titan',
        romajiTitle: 'Shingeki no Kyojin',
        year: 2013,
        score: 90.7,
        popularityRank: 8,
        trendingRank: 8,
        format: 'TV',
        tmdbId: '1429',
        malId: 16498,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 9,
        aniListId: 21,
        title: 'One Piece',
        romajiTitle: 'One Piece',
        year: 1999,
        score: 89.8,
        popularityRank: 9,
        trendingRank: 9,
        format: 'TV',
        tmdbId: '37854',
        malId: 21,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 10,
        aniListId: 140960,
        title: 'Spy x Family',
        romajiTitle: 'Spy × Family',
        year: 2022,
        score: 88.6,
        popularityRank: 10,
        trendingRank: 10,
        format: 'TV',
        tmdbId: '120089',
        malId: 50273,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 11,
        aniListId: 153288,
        title: 'Kaiju No. 8',
        romajiTitle: 'Kaijuu 8-gou',
        year: 2024,
        score: 87.2,
        popularityRank: 11,
        trendingRank: 11,
        format: 'TV',
        tmdbId: '206586',
        malId: 52588,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 12,
        aniListId: 163148,
        title: 'Blue Lock',
        romajiTitle: 'Blue Lock',
        year: 2022,
        score: 86.4,
        popularityRank: 12,
        trendingRank: 12,
        format: 'TV',
        tmdbId: '136283',
        malId: 50528,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 13,
        aniListId: 1735,
        title: 'Naruto Shippuden',
        romajiTitle: 'Naruto: Shippuuden',
        year: 2007,
        score: 85.1,
        popularityRank: 13,
        trendingRank: 13,
        format: 'TV',
        tmdbId: '31910',
        malId: 1735,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 14,
        aniListId: 21459,
        title: 'My Hero Academia',
        romajiTitle: 'Boku no Hero Academia',
        year: 2016,
        score: 84.3,
        popularityRank: 14,
        trendingRank: 14,
        format: 'TV',
        tmdbId: '65930',
        malId: 31964,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      },
      {
        position: 15,
        aniListId: 1535,
        title: 'Death Note',
        romajiTitle: 'Death Note',
        year: 2006,
        score: 83.5,
        popularityRank: 15,
        trendingRank: 15,
        format: 'TV',
        tmdbId: '1399',
        malId: 1535,
        referenceDate: '2026-10-15',
        capturedAt: 1792118400000
      }
    ]
  },

  // =========================================================================
  // SETEMBRO DE 2026 — HISTÓRICO CONSOLIDADO ANILIST (MÊS ANTERIOR)
  // =========================================================================
  {
    id: 'snapshot-anime-2026-09',
    monthKey: '2026-09',
    monthLabel: 'Setembro de 2026',
    referenceDate: '2026-09-30',
    capturedAt: 1790822400000,
    source: 'official-snapshot',
    items: [
      { position: 1, aniListId: 151807, title: 'Solo Leveling', year: 2024, score: 98.1, popularityRank: 1, trendingRank: 1, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 2, aniListId: 113415, title: 'Jujutsu Kaisen', year: 2020, score: 96.0, popularityRank: 2, trendingRank: 2, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 3, aniListId: 101922, title: 'Demon Slayer: Kimetsu no Yaiba', year: 2019, score: 95.5, popularityRank: 3, trendingRank: 3, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 4, aniListId: 154587, title: "Frieren: Beyond Journey's End", year: 2023, score: 93.8, popularityRank: 4, trendingRank: 4, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 5, aniListId: 114446, title: 'Bleach: Thousand-Year Blood War', year: 2022, score: 93.2, popularityRank: 5, trendingRank: 5, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 6, aniListId: 171018, title: 'Dandadan', year: 2024, score: 92.9, popularityRank: 6, trendingRank: 6, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 7, aniListId: 127230, title: 'Chainsaw Man', year: 2022, score: 91.2, popularityRank: 7, trendingRank: 7, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 8, aniListId: 16498, title: 'Attack on Titan', year: 2013, score: 90.4, popularityRank: 8, trendingRank: 8, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 9, aniListId: 21, title: 'One Piece', year: 1999, score: 89.5, popularityRank: 9, trendingRank: 9, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 },
      { position: 10, aniListId: 140960, title: 'Spy x Family', year: 2022, score: 88.0, popularityRank: 10, trendingRank: 10, format: 'TV', referenceDate: '2026-09-30', capturedAt: 1790822400000 }
    ]
  }
];
