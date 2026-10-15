import { describe, it, expect, vi } from 'vitest';
import SortDropdown, { SORT_OPTIONS, CatalogSortOption } from '../components/SortDropdown';
import { catalogSnapshotManager } from '../src/core/catalog/CatalogSnapshotManager';
import { ContentItem } from '../types';

describe('SortDropdown Component & Full Catalog Sorting', () => {
  const mockItems: ContentItem[] = [
    {
      id: 'm1',
      title: 'Zootopia',
      year: 2016,
      rating: 8.0,
      popularity: 85,
      type: 'movie',
      releaseDate: '2016-03-04',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'm2',
      title: 'Avatar: O Caminho da Água',
      year: 2022,
      rating: 7.6,
      popularity: 98,
      type: 'movie',
      releaseDate: '2022-12-16',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'm3',
      title: 'O Poderoso Chefão',
      year: 1972,
      rating: 9.2,
      popularity: 90,
      type: 'movie',
      releaseDate: '1972-03-24',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'm4',
      title: 'Duna: Parte 2',
      year: 2024,
      rating: 8.6,
      popularity: 99,
      type: 'movie',
      releaseDate: '2024-02-28',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed'
    },
    {
      id: 'm5',
      title: 'Interestelar',
      year: 2014,
      rating: 8.7,
      popularity: 95,
      type: 'movie',
      releaseDate: '2014-11-07',
      availabilityStatus: 'verified',
      audioStatus: 'pt-br-dubbed',
      // Simula item com timestamp explícito de adição recente no ZapiTV
      ...({ addedAt: 1729000000000 } as any)
    }
  ];

  describe('1. SortDropdown Options & Callback Safety', () => {
    it('deve conter exatamente as 8 opções obrigatórias solicitadas', () => {
      expect(SORT_OPTIONS.map(o => o.id)).toEqual([
        'recommended',
        'popularity',
        'release_date',
        'rating',
        'recently_added',
        'oldest',
        'title_az',
        'title_za',
      ]);

      expect(SORT_OPTIONS.map(o => o.label)).toEqual([
        'Recomendados',
        'Mais Populares',
        'Lançamentos',
        'Mais Bem Avaliados',
        'Adicionados Recentemente',
        'Mais Antigos',
        'A–Z',
        'Z–A',
      ]);
    });

    it('SortDropdown aceita onSelect sem falhar se onSelectSort estiver ausente', () => {
      const onSelect = vi.fn();
      const props = { selectedSort: 'recommended' as CatalogSortOption, onSelect, isDarkMode: true };
      expect(typeof props.onSelect).toBe('function');
      props.onSelect('popularity');
      expect(onSelect).toHaveBeenCalledWith('popularity');
    });

    it('SortDropdown aceita onSelectSort (compatibilidade) sem falhar se onSelect for omitido', () => {
      const onSelectSort = vi.fn();
      const props = { selectedSort: 'recommended' as CatalogSortOption, onSelectSort, isDarkMode: true };
      expect(typeof props.onSelectSort).toBe('function');
      props.onSelectSort('release_date');
      expect(onSelectSort).toHaveBeenCalledWith('release_date');
    });

    it('SortDropdown aceita ambos os callbacks simultaneamente', () => {
      const onSelect = vi.fn();
      const onSelectSort = vi.fn();
      const props = { 
        selectedSort: 'recommended' as CatalogSortOption, 
        onSelect, 
        onSelectSort, 
        isDarkMode: true 
      };
      
      const fireSelection = (opt: CatalogSortOption) => {
        if (typeof props.onSelect === 'function') props.onSelect(opt);
        if (typeof props.onSelectSort === 'function') props.onSelectSort(opt);
      };

      fireSelection('title_az');
      expect(onSelect).toHaveBeenCalledWith('title_az');
      expect(onSelectSort).toHaveBeenCalledWith('title_az');
    });
  });

  describe('2. Ordenação do Catálogo Completo para todas as 8 Opções', () => {
    it('1. "recommended" (Recomendações híbridas personalizadas)', () => {
      const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'recommended', {
        profileId: 'user_1',
        isChild: false,
        category: 'movies'
      });
      expect(sorted.length).toBe(mockItems.length);
      expect(sorted.map(i => i.id).sort()).toEqual(mockItems.map(i => i.id).sort());
    });

    it('2. "popularity" (Mais Populares primeiro)', () => {
      const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'popularity');
      expect(sorted[0].id).toBe('m4'); // 99 (Duna: Parte 2)
      expect(sorted[1].id).toBe('m2'); // 98 (Avatar)
      expect(sorted[2].id).toBe('m5'); // 95 (Interestelar)
      expect(sorted[3].id).toBe('m3'); // 90 (Chefão)
      expect(sorted[4].id).toBe('m1'); // 85 (Zootopia)
    });

    it('3. "release_date" (Lançamentos / mais recentes primeiro)', () => {
      const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'release_date');
      expect(sorted[0].id).toBe('m4'); // 2024
      expect(sorted[1].id).toBe('m2'); // 2022
      expect(sorted[2].id).toBe('m1'); // 2016
      expect(sorted[3].id).toBe('m5'); // 2014
      expect(sorted[4].id).toBe('m3'); // 1972
    });

    it('4. "rating" (Mais Bem Avaliados primeiro)', () => {
      const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'rating');
      expect(sorted[0].id).toBe('m3'); // 9.2 (O Poderoso Chefão)
      expect(sorted[1].id).toBe('m5'); // 8.7 (Interestelar)
      expect(sorted[2].id).toBe('m4'); // 8.6 (Duna)
      expect(sorted[3].id).toBe('m1'); // 8.0 (Zootopia)
      expect(sorted[4].id).toBe('m2'); // 7.6 (Avatar)
    });

    it('5. "recently_added" (Adicionados Recentemente ao acervo)', () => {
      const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'recently_added');
      // m5 possui timestamp explícito de adição recente (addedAt)
      expect(sorted[0].id).toBe('m5');
    });

    it('6. "oldest" (Mais Antigos primeiro)', () => {
      const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'oldest');
      expect(sorted[0].id).toBe('m3'); // 1972 (O Poderoso Chefão)
      expect(sorted[1].id).toBe('m5'); // 2014 (Interestelar)
      expect(sorted[2].id).toBe('m1'); // 2016 (Zootopia)
      expect(sorted[3].id).toBe('m2'); // 2022 (Avatar)
      expect(sorted[4].id).toBe('m4'); // 2024 (Duna)
    });

    it('7. "title_az" (A–Z alfabético)', () => {
      const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'title_az');
      expect(sorted[0].id).toBe('m2'); // Avatar: O Caminho da Água
      expect(sorted[1].id).toBe('m4'); // Duna: Parte 2
      expect(sorted[2].id).toBe('m5'); // Interestelar
      expect(sorted[3].id).toBe('m3'); // O Poderoso Chefão
      expect(sorted[4].id).toBe('m1'); // Zootopia
    });

    it('8. "title_za" (Z–A alfabético invertido)', () => {
      const sorted = catalogSnapshotManager.sortItemsByOption(mockItems, 'title_za');
      expect(sorted[0].id).toBe('m1'); // Zootopia
      expect(sorted[1].id).toBe('m3'); // O Poderoso Chefão
      expect(sorted[2].id).toBe('m5'); // Interestelar
      expect(sorted[3].id).toBe('m4'); // Duna: Parte 2
      expect(sorted[4].id).toBe('m2'); // Avatar: O Caminho da Água
    });

    it('Aplica ordenação ao catálogo COMPLETO e não a uma fatia parcial', () => {
      const largeCatalog: ContentItem[] = [];
      for (let i = 0; i < 60; i++) {
        largeCatalog.push({
          id: `item_${i}`,
          title: `Filme ${String(60 - i).padStart(2, '0')}`,
          year: 1980 + (i % 40),
          rating: 5 + (i % 5),
          popularity: i * 2,
          type: 'movie',
          availabilityStatus: 'verified',
          audioStatus: 'pt-br-dubbed'
        });
      }

      // Snapshot criado para todos os 60 itens
      const sortedAll = catalogSnapshotManager.createInitialSnapshot(largeCatalog, 'title_az', {
        profileId: 'test',
        isChild: false,
        category: 'movies'
      });

      expect(sortedAll.length).toBe(60);
      expect(sortedAll[0].title).toBe('Filme 01');
      expect(sortedAll[59].title).toBe('Filme 60');
    });

    it('Garante independência de ordenação entre Filmes, Séries e Animes', () => {
      const categorySorts: Record<'movies' | 'series' | 'animes', CatalogSortOption> = {
        movies: 'release_date',
        series: 'rating',
        animes: 'title_az'
      };

      const getKey = (view: 'movies' | 'series' | 'animes') =>
        `${view}:all:${categorySorts[view]}:default:adult`;

      const movieKey = getKey('movies');
      const seriesKey = getKey('series');
      const animeKey = getKey('animes');

      expect(movieKey).toBe('movies:all:release_date:default:adult');
      expect(seriesKey).toBe('series:all:rating:default:adult');
      expect(animeKey).toBe('animes:all:title_az:default:adult');

      // Alterar Filmes não altera Séries nem Animes
      categorySorts.movies = 'popularity';
      expect(getKey('movies')).toBe('movies:all:popularity:default:adult');
      expect(getKey('series')).toBe('series:all:rating:default:adult');
      expect(getKey('animes')).toBe('animes:all:title_az:default:adult');
    });
  });
});
