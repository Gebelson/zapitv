import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { canonicalCatalogMaster, CanonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
import { aniListClient } from '../src/core/anilist/aniListClient';
import { ContentItem, ContentType } from '../types';
import { deduplicateContentItems, getCanonicalKeysForItem } from '../src/core/catalog/catalogDeduplication';

describe('ETAPA 2 — Catálogo Mestre Unificado (TMDB, IMDb, AniList)', () => {
  let master: CanonicalCatalogMaster;

  beforeEach(() => {
    master = CanonicalCatalogMaster.getInstance();
  });

  afterEach(() => {
    master.dispose();
  });

  describe('1. Identificadores Canônicos Universalmente Qualificados', () => {
    it('deve gerar canonicalId qualificado por categoria e provedor sem colisões', () => {
      const movieImdb = master.buildCanonicalId(ContentType.MOVIE, 'imdb', 'tt0109830');
      const movieTmdb = master.buildCanonicalId(ContentType.MOVIE, 'tmdb', '13');
      const seriesTmdb = master.buildCanonicalId(ContentType.SERIES, 'tmdb', '13');
      const animeAnilist = master.buildCanonicalId(ContentType.ANIME, 'anilist', 20);

      expect(movieImdb).toBe('movie:imdb:tt0109830');
      expect(movieTmdb).toBe('movie:tmdb:13');
      expect(seriesTmdb).toBe('series:tmdb:13');
      expect(animeAnilist).toBe('anime:anilist:20');

      // Prevenção de colisão: Movie ID 13 !== Series ID 13
      expect(movieTmdb).not.toBe(seriesTmdb);
    });

    it('deve gerar e fazer parse de identificadores canônicos de episódios', () => {
      const epCanonical = master.buildCanonicalId(ContentType.SERIES, 'imdb', 'tt0903747', { season: 1, episode: 1 });
      expect(epCanonical).toBe('series:imdb:tt0903747:s01:e01');

      const parsed = master.parseCanonicalId(epCanonical);
      expect(parsed).not.toBeNull();
      expect(parsed?.category).toBe('series');
      expect(parsed?.provider).toBe('imdb');
      expect(parsed?.rawId).toBe('tt0903747');
      expect(parsed?.season).toBe(1);
      expect(parsed?.episode).toBe(1);
    });
  });

  describe('2. Unificação e Resolução Cruzada de Metadados (TMDB, IMDb e AniList)', () => {
    it('deve resolver o canonicalId a partir de IMDb ID, TMDB ID ou AniList ID', () => {
      const forrestGump: ContentItem = {
        id: 'tt0109830',
        imdbId: 'tt0109830',
        tmdbId: '13',
        title: 'Forrest Gump: O Contador de Histórias',
        originalTitle: 'Forrest Gump',
        year: 1994,
        type: ContentType.MOVIE,
        rating: 8.8,
        image: 'https://image.tmdb.org/t/p/w500/saHP97rTPS5eLmrLQEcANmKrsFl.jpg',
        genres: ['Comédia', 'Drama', 'Romance'],
        availabilityStatus: 'verified'
      };

      const registered = master.registerItem(forrestGump);
      expect(registered.canonicalId).toBe('movie:imdb:tt0109830');

      // Resolução cruzada por IMDb
      const byImdb = master.resolveCanonicalId({ imdbId: 'tt0109830' });
      expect(byImdb).toBe('movie:imdb:tt0109830');

      // Resolução cruzada por TMDB
      const byTmdb = master.resolveCanonicalId({ tmdbId: '13', type: ContentType.MOVIE });
      expect(byTmdb).toBe('movie:imdb:tt0109830');

      // Resolução cruzada por Título + Ano
      const byTitle = master.resolveCanonicalId({ title: 'Forrest Gump', year: 1994, type: ContentType.MOVIE });
      expect(byTitle).toBe('movie:imdb:tt0109830');
    });

    it('deve enriquecer metadados existentes quando novos registros forem recebidos', () => {
      const initialItem: ContentItem = {
        id: 'tt0903747',
        imdbId: 'tt0903747',
        title: 'Breaking Bad',
        year: 2008,
        type: ContentType.SERIES,
        rating: 9.5,
        image: 'https://image.tmdb.org/t/p/w500/poster.jpg'
      };

      master.registerItem(initialItem);

      const enrichmentItem: ContentItem = {
        id: 'tmdb-tv-1396',
        imdbId: 'tt0903747',
        tmdbId: '1396',
        title: 'Breaking Bad',
        originalTitle: 'Breaking Bad',
        releaseDate: '2008-01-20',
        year: 2008,
        type: ContentType.SERIES,
        rating: 9.5,
        image: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        backdrop: 'https://image.tmdb.org/t/p/original/backdrop.jpg',
        director: 'Vince Gilligan',
        cast: ['Bryan Cranston', 'Aaron Paul'],
        seasonsCount: 5,
        episodes: [
          { id: 'ep-1-1', number: 1, title: 'Pilot', description: 'Pilot episode', image: '' }
        ]
      };

      const unified = master.registerItem(enrichmentItem);
      expect(unified.tmdbId).toBe('1396');
      expect(unified.director).toBe('Vince Gilligan');
      expect(unified.seasonsCount).toBe(5);
      expect(unified.episodes).toHaveLength(1);
      expect(unified.cast).toContain('Bryan Cranston');
    });
  });

  describe('3. Separação Completa entre Categorias (Filmes, Séries e Animes)', () => {
    it('deve classificar produções de anime (séries e longas) estritamente como ContentType.ANIME', () => {
      const animeSeries: ContentItem = {
        id: 'anilist-20',
        aniListId: 20,
        title: 'Naruto',
        originalTitle: 'NARUTO',
        type: ContentType.SERIES,
        mediaFormat: 'series',
        year: 2002,
        rating: 8.4,
        image: 'https://example.com/naruto.jpg',
        genres: ['Anime', 'Ação', 'Aventura']
      };

      const animeMovie: ContentItem = {
        id: 'tmdb-movie-19995',
        title: 'A Viagem de Chihiro',
        originalTitle: '千と千尋の神隠し',
        type: ContentType.MOVIE,
        mediaFormat: 'movie',
        year: 2001,
        rating: 8.6,
        image: 'https://example.com/chihiro.jpg',
        genres: ['Animação', 'Fantasia']
      };

      const classifiedSeries = master.classifyCategory(animeSeries);
      const classifiedMovie = master.classifyCategory(animeMovie);

      expect(classifiedSeries).toBe(ContentType.ANIME);
      expect(classifiedMovie).toBe(ContentType.ANIME);
    });

    it('deve manter separação estanque entre Filmes e Séries ocidentais/live-action', () => {
      const westernMovie: ContentItem = {
        id: 'tt0137523',
        imdbId: 'tt0137523',
        title: 'Clube da Luta',
        type: ContentType.MOVIE,
        mediaFormat: 'movie',
        year: 1999,
        rating: 8.8,
        image: 'https://example.com/fightclub.jpg'
      };

      const westernSeries: ContentItem = {
        id: 'tt0944947',
        imdbId: 'tt0944947',
        title: 'Game of Thrones',
        type: ContentType.SERIES,
        mediaFormat: 'series',
        year: 2011,
        rating: 9.2,
        image: 'https://example.com/got.jpg'
      };

      expect(master.classifyCategory(westernMovie)).toBe(ContentType.MOVIE);
      expect(master.classifyCategory(westernSeries)).toBe(ContentType.SERIES);
    });
  });

  describe('4. Preservação de Temporadas, Episódios e Metadados Ricos', () => {
    it('deve preservar metadados de episódios sem truncamento ou perda de propriedades', () => {
      const seriesWithEps: ContentItem = {
        id: 'tt1475582',
        imdbId: 'tt1475582',
        title: 'Sherlock',
        originalTitle: 'Sherlock',
        releaseDate: '2010-07-25',
        year: 2010,
        type: ContentType.SERIES,
        rating: 9.1,
        image: 'https://example.com/sherlock.jpg',
        seasonsCount: 4,
        episodes: [
          { id: 's01e01', number: 1, title: 'A Study in Pink', description: 'Sherlock meets John Watson', image: 'https://example.com/s01e01.jpg' },
          { id: 's01e02', number: 2, title: 'The Blind Banker', description: 'Mysterious symbols across London', image: 'https://example.com/s01e02.jpg' }
        ]
      };

      const saved = master.registerItem(seriesWithEps);
      expect(saved.seasonsCount).toBe(4);
      expect(saved.episodes).toHaveLength(2);
      expect(saved.episodes?.[0].title).toBe('A Study in Pink');
      expect(saved.releaseDate).toBe('2010-07-25');
      expect(saved.originalTitle).toBe('Sherlock');
    });
  });

  describe('5. Registro Interno vs Catálogo Público de Reprodução', () => {
    it('deve manter obras não-lançadas (ex: A Odisseia 2026) no registro interno, mas fora do catálogo público', () => {
      const futureTheatricalMovie: ContentItem = {
        id: 'tmdb-movie-odisseia-2026',
        title: 'A Odisseia',
        originalTitle: 'The Odyssey',
        year: 2026,
        type: ContentType.MOVIE,
        rating: 0,
        image: 'https://example.com/odisseia.jpg',
        inTheaters: true,
        availabilityStatus: 'unreleased'
      };

      master.registerItem(futureTheatricalMovie);

      // Presente no registro interno
      const internal = master.getInternalRegistry();
      const hasInInternal = internal.some(e => e.item.title === 'A Odisseia');
      expect(hasInInternal).toBe(true);

      // Oculto do catálogo público de reprodução direta
      const publicMovies = master.getPublicCatalog('movies');
      const hasInPublic = publicMovies.some(m => m.title === 'A Odisseia');
      expect(hasInPublic).toBe(false);
    });
  });

  describe('6. AniList Client & Deduplicação de Chaves Canônicas', () => {
    it('deve converter registro AniList para ContentItem com estrutura padronizada', () => {
      const mockAniListMedia = {
        id: 16498,
        idMal: 16498,
        title: {
          romaji: 'Shingeki no Kyojin',
          english: 'Attack on Titan',
          native: '進撃の巨人'
        },
        format: 'TV' as const,
        episodes: 25,
        seasonYear: 2013,
        coverImage: {
          extraLarge: 'https://example.com/aot_cover.jpg'
        },
        bannerImage: 'https://example.com/aot_banner.jpg',
        genres: ['Action', 'Drama', 'Fantasy', 'Mystery'],
        averageScore: 85,
        description: 'Centuries ago, mankind was slaughtered to near extinction...'
      };

      const converted = aniListClient.convertAniListToContentItem(mockAniListMedia);
      expect(converted.type).toBe(ContentType.ANIME);
      expect(converted.title).toBe('Attack on Titan');
      expect(converted.originalTitle).toBe('進撃の巨人');
      expect(converted.aniListId).toBe(16498);
      expect(converted.malId).toBe(16498);
      expect(converted.canonicalId).toBe('anime:anilist:16498');
      expect(converted.episodes).toHaveLength(25);
    });

    it('deve extrair chaves de deduplicação canônica com anilistId e canonicalId', () => {
      const item: ContentItem = {
        id: 'anilist-16498',
        canonicalId: 'anime:anilist:16498',
        aniListId: 16498,
        malId: 16498,
        title: 'Attack on Titan',
        year: 2013,
        type: ContentType.ANIME,
        rating: 8.5,
        image: 'https://example.com/aot.jpg'
      };

      const keys = getCanonicalKeysForItem(item);
      expect(keys).toContain('anilist:16498');
      expect(keys).toContain('mal:16498');
      expect(keys).toContain('canonical:anime:anilist:16498');

      // Deduplicação com item equivalente
      const duplicate: ContentItem = {
        id: 'tmdb-anime-shingeki',
        aniListId: 16498,
        title: 'Attack on Titan (Dublado)',
        year: 2013,
        type: ContentType.ANIME,
        rating: 8.5,
        image: 'https://example.com/aot2.jpg'
      };

      const deduped = deduplicateContentItems([item, duplicate]);
      expect(deduped).toHaveLength(1);
    });
  });
});
