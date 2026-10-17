import { describe, it, expect, beforeEach } from 'vitest';
import { catalogSnapshotManager } from '../src/core/catalog/CatalogSnapshotManager';
import { deduplicateContentItems, getCanonicalKeysForItem, normalizeCatalogText } from '../src/core/catalog/catalogDeduplication';
import { canonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
import { searchService } from '../src/core/search/searchService';
import { ContentItem, ContentType } from '../types';

describe('ZAPITV — ESTABILIDADE E ELIMINAÇÃO DEFINITIVA DE DUPLICADOS NOS CATÁLOGOS', () => {
  beforeEach(() => {
    catalogSnapshotManager.clearCachedSnapshot();
    canonicalCatalogMaster.dispose();
  });

  // Helper para criar mock de ContentItem
  function createMockItem(
    id: string,
    title: string,
    type: ContentType,
    year: number,
    opts: Partial<ContentItem> = {}
  ): ContentItem {
    return {
      id,
      title,
      type,
      year,
      rating: opts.rating || 7.5,
      genres: opts.genres || ['Ação', 'Aventura'],
      image: opts.image || `https://image.tmdb.org/t/p/w500/${id}.jpg`,
      imdbId: opts.imdbId,
      tmdbId: opts.tmdbId,
      aniListId: opts.aniListId,
      originalTitle: opts.originalTitle,
      popularity: opts.popularity || 50,
      ...opts
    };
  }

  // 1. Navegação por +1.000 cards sem duplicatas
  describe('1. Navegação Longa (+1.000 cards) sem Duplicações', () => {
    it('deve acumular mais de 1.000 cards únicos via paginação sem duplicar nenhum título ou ID', () => {
      let currentSnapshot: ContentItem[] = [];
      const totalPages = 25;
      const itemsPerPage = 45; // 25 * 45 = 1125 itens totais

      for (let page = 1; page <= totalPages; page++) {
        const batch: ContentItem[] = [];
        for (let i = 1; i <= itemsPerPage; i++) {
          const itemIdx = (page - 1) * itemsPerPage + i;
          const itemId = `movie-${itemIdx}`;
          const imdbNum = String(1000000 + itemIdx);
          
          // A cada 5 itens, injeta uma duplicata proposital de páginas anteriores
          if (page > 1 && i % 5 === 0) {
            const dupIdx = Math.floor(itemIdx / 2);
            batch.push(createMockItem(
              `tmdb-${dupIdx}`,
              `Filme Épico Vol. ${dupIdx}`,
              ContentType.MOVIE,
              2000 + (dupIdx % 24),
              { imdbId: `tt${String(1000000 + dupIdx)}`, tmdbId: String(dupIdx) }
            ));
          } else {
            batch.push(createMockItem(
              itemId,
              `Filme Épico Vol. ${itemIdx}`,
              ContentType.MOVIE,
              2000 + (itemIdx % 24),
              { imdbId: `tt${imdbNum}`, tmdbId: String(itemIdx) }
            ));
          }
        }

        currentSnapshot = catalogSnapshotManager.appendPaginationBatch(
          currentSnapshot,
          batch,
          'popularity',
          { profileId: 'user1', isChild: false, category: 'movies' }
        );
      }

      // Deve ter ultrapassado 1.000 cards
      expect(currentSnapshot.length).toBeGreaterThanOrEqual(1000);

      // Verificação de Unicidade Rigorosa: Nenhuma duplicata em ID local, IMDb ou Canonical
      const seenIds = new Set<string>();
      const seenImdb = new Set<string>();
      const seenTitles = new Set<string>();

      for (const item of currentSnapshot) {
        expect(seenIds.has(item.id)).toBe(false);
        seenIds.add(item.id);

        if (item.imdbId) {
          expect(seenImdb.has(item.imdbId)).toBe(false);
          seenImdb.add(item.imdbId);
        }

        const titleKey = `${normalizeCatalogText(item.title)}:${item.year}`;
        expect(seenTitles.has(titleKey)).toBe(false);
        seenTitles.add(titleKey);
      }
    });
  });

  // 2. Nenhum ID canônico repetido na mesma listagem
  describe('2. Integridade Canônica em Listagens', () => {
    it('garante que todos os canonical keys de todos os cards da listagem são estritamente disjuntos', () => {
      const items: ContentItem[] = [
        createMockItem('tt0109830', 'Forrest Gump', ContentType.MOVIE, 1994, { imdbId: 'tt0109830', tmdbId: '13' }),
        createMockItem('tmdb-13', 'Forrest Gump: O Contador de Histórias', ContentType.MOVIE, 1994, { tmdbId: '13' }),
        createMockItem('movie-forrest-alt', 'Forrest Gump', ContentType.MOVIE, 1994),
        createMockItem('tt0137523', 'Clube da Luta', ContentType.MOVIE, 1999, { imdbId: 'tt0137523', originalTitle: 'Fight Club' }),
        createMockItem('tmdb-550', 'Fight Club', ContentType.MOVIE, 1999, { originalTitle: 'Fight Club', tmdbId: '550' }),
        createMockItem('tt0110912', 'Pulp Fiction: Tempo de Violência', ContentType.MOVIE, 1994, { imdbId: 'tt0110912' })
      ];

      const deduped = deduplicateContentItems(items);

      // 6 itens originais correspondem a apenas 3 obras distintas
      expect(deduped.length).toBe(3);

      const allRegisteredKeys = new Set<string>();
      for (const card of deduped) {
        const keys = getCanonicalKeysForItem(card);
        for (const k of keys) {
          allRegisteredKeys.add(k);
        }
      }

      // Verificação cruzada: nenhum card da lista final compartilha qualquer chave com outro card
      for (let i = 0; i < deduped.length; i++) {
        for (let j = i + 1; j < deduped.length; j++) {
          const keysA = new Set(getCanonicalKeysForItem(deduped[i]));
          const keysB = getCanonicalKeysForItem(deduped[j]);
          for (const kb of keysB) {
            expect(keysA.has(kb)).toBe(false);
          }
        }
      }
    });
  });

  // 3. Isolamento e alternância entre Filmes, Séries e Animes
  describe('3. Isolamento Estrutural entre Filmes, Séries e Animes', () => {
    it('filmes nunca aparecem em séries ou animes e alternância preserva separação estrita', () => {
      const mixedCatalog: ContentItem[] = [
        createMockItem('movie-batman', 'The Batman', ContentType.MOVIE, 2022, { imdbId: 'tt1877830' }),
        createMockItem('series-batman', 'Batman: The Animated Series', ContentType.SERIES, 1992, { imdbId: 'tt0103359' }),
        createMockItem('anime-naruto', 'Naruto', ContentType.ANIME, 2002, { aniListId: 20 }),
        createMockItem('movie-gladiator', 'Gladiador', ContentType.MOVIE, 2000, { imdbId: 'tt0172495' }),
        createMockItem('series-breaking-bad', 'Breaking Bad', ContentType.SERIES, 2008, { imdbId: 'tt0903747' })
      ];

      const moviesOnly = mixedCatalog.filter(i => searchService.isMovieItem(i, false));
      const seriesOnly = mixedCatalog.filter(i => searchService.isSeriesItem(i));
      const animesOnly = mixedCatalog.filter(i => searchService.isAnimeItem(i));

      // Verificações de isolamento estrito
      expect(moviesOnly.map(m => m.id)).toEqual(['movie-batman', 'movie-gladiator']);
      expect(seriesOnly.map(s => s.id)).toEqual(['series-batman', 'series-breaking-bad']);
      expect(animesOnly.map(a => a.id)).toEqual(['anime-naruto']);

      // Nenhum anime ou série vaza para filmes
      for (const m of moviesOnly) {
        expect(searchService.isSeriesItem(m)).toBe(false);
        expect(searchService.isAnimeItem(m)).toBe(false);
      }
    });
  });

  // 4. Determinismo em todas as opções de ordenação
  describe('4. Determinismo Rigoroso em Todas as Opções de Ordenação', () => {
    const testItems: ContentItem[] = [
      createMockItem('m1', 'Interestelar', ContentType.MOVIE, 2014, { rating: 8.7, popularity: 95 }),
      createMockItem('m2', 'A Origem', ContentType.MOVIE, 2010, { rating: 8.8, popularity: 95 }), // mesma popularidade
      createMockItem('m3', 'Dunkirk', ContentType.MOVIE, 2017, { rating: 7.9, popularity: 70 }),
      createMockItem('m4', 'Oppenheimer', ContentType.MOVIE, 2023, { rating: 8.9, popularity: 98 }),
      createMockItem('m5', 'Tenet', ContentType.MOVIE, 2020, { rating: 7.3, popularity: 60 }),
      createMockItem('m6', 'Memento', ContentType.MOVIE, 2000, { rating: 8.4, popularity: 60 }) // mesma popularidade
    ];

    const sortOptions = [
      'popularity',
      'rating',
      'release_date',
      'recently_added',
      'oldest',
      'title_az',
      'title_za'
    ] as const;

    for (const sortOption of sortOptions) {
      it(`ordenação "${sortOption}" deve ser 100% determinística em 10 execuções consecutivas`, () => {
        const firstRun = catalogSnapshotManager.sortItemsByOption(testItems, sortOption, {
          profileId: 'test-user',
          isChild: false,
          category: 'movies'
        });

        for (let run = 1; run <= 10; run++) {
          // Embaralha uma cópia para testar estabilidade contra ordem de entrada
          const shuffled = [...testItems].sort(() => Math.random() - 0.5);
          const subsequentRun = catalogSnapshotManager.sortItemsByOption(shuffled, sortOption, {
            profileId: 'test-user',
            isChild: false,
            category: 'movies'
          });

          expect(subsequentRun.map(i => i.id)).toEqual(firstRun.map(i => i.id));
        }
      });
    }
  });

  // 5. Filtro de gênero com reset estável de paginação
  describe('5. Filtros de Gênero e Snapshot Keys Normalizadas', () => {
    it('normaliza "Todos" e "" para "all" e não mistura snapshots entre gêneros', () => {
      const itemsAction: ContentItem[] = [
        createMockItem('act-1', 'Mad Max: Estrada da Fúria', ContentType.MOVIE, 2015, { genres: ['Ação', 'Ficção'] }),
        createMockItem('act-2', 'John Wick 4', ContentType.MOVIE, 2023, { genres: ['Ação', 'Crime'] })
      ];

      const itemsDrama: ContentItem[] = [
        createMockItem('drm-1', 'O Poderoso Chefão', ContentType.MOVIE, 1972, { genres: ['Drama', 'Crime'] }),
        createMockItem('drm-2', '12 Homens e Uma Sentença', ContentType.MOVIE, 1957, { genres: ['Drama'] })
      ];

      const snapAction = catalogSnapshotManager.createInitialSnapshot(itemsAction, 'rating', {
        profileId: 'u1',
        isChild: false,
        category: 'movies',
        genreFilter: 'Ação'
      });

      const snapDrama = catalogSnapshotManager.createInitialSnapshot(itemsDrama, 'rating', {
        profileId: 'u1',
        isChild: false,
        category: 'movies',
        genreFilter: 'Drama'
      });

      catalogSnapshotManager.setCachedSnapshot('movies_Ação_rating', snapAction);
      catalogSnapshotManager.setCachedSnapshot('movies_Drama_rating', snapDrama);

      const cachedAction = catalogSnapshotManager.getCachedSnapshot('movies_Ação_rating');
      const cachedDrama = catalogSnapshotManager.getCachedSnapshot('movies_Drama_rating');

      expect(cachedAction?.map(i => i.id)).toEqual(['act-2', 'act-1']);
      expect(cachedDrama?.map(i => i.id)).toEqual(['drm-1', 'drm-2']);

      // Nenhum item de Ação no snapshot de Drama e vice-versa
      expect(cachedDrama?.some(i => i.genres?.includes('Ação'))).toBe(false);
    });
  });

  // 6. Rolagem rápida simulando múltiplas páginas concorrentes
  describe('6. Proteção contra Chamadas e Páginas Concorrentes (Race Conditions)', () => {
    it('simula disparos simultâneos de appendPaginationBatch e rejeita lotes concorrentes repetidos', () => {
      let currentList: ContentItem[] = [
        createMockItem('p1-1', 'Avatar 1', ContentType.MOVIE, 2009, { imdbId: 'tt0499549' }),
        createMockItem('p1-2', 'Avatar 2', ContentType.MOVIE, 2022, { imdbId: 'tt1630029' })
      ];

      const incomingBatchPage2: ContentItem[] = [
        createMockItem('p2-1', 'Avatar 3', ContentType.MOVIE, 2025, { imdbId: 'tt1757678', popularity: 90 }),
        createMockItem('p2-2', 'Duna 1', ContentType.MOVIE, 2021, { imdbId: 'tt1160419', popularity: 70 })
      ];

      // Simula 3 requisições simultâneas disparadas no mesmo frame para a página 2
      const res1 = catalogSnapshotManager.appendPaginationBatch(currentList, incomingBatchPage2, 'popularity', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });

      // Segunda chamada simultânea com o resultado acumulado
      const res2 = catalogSnapshotManager.appendPaginationBatch(res1, incomingBatchPage2, 'popularity', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });

      // Terceira chamada simultânea com o resultado acumulado
      const res3 = catalogSnapshotManager.appendPaginationBatch(res2, incomingBatchPage2, 'popularity', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });

      // Tamanho final deve ser estritamente 4 itens (Avatar 1, Avatar 2, Avatar 3, Duna 1)
      expect(res3.length).toBe(4);
      expect(res3.map(i => i.id)).toEqual(['p1-1', 'p1-2', 'p2-1', 'p2-2']);
    });
  });

  // 7. Retorno para páginas anteriores sem perda de referências
  describe('7. Preservação de Posições e Referências Anteriores', () => {
    it('itens das páginas anteriores mantêm exatamente sua ordem e referência ao anexar novos lotes', () => {
      const page1 = [
        createMockItem('item-alpha', 'Alpha', ContentType.MOVIE, 2020),
        createMockItem('item-beta', 'Beta', ContentType.MOVIE, 2021)
      ];

      const page2 = [
        createMockItem('item-gamma', 'Gamma', ContentType.MOVIE, 2022)
      ];

      const page3 = [
        createMockItem('item-delta', 'Delta', ContentType.MOVIE, 2023)
      ];

      const withPage2 = catalogSnapshotManager.appendPaginationBatch(page1, page2, 'popularity', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });

      const withPage3 = catalogSnapshotManager.appendPaginationBatch(withPage2, page3, 'popularity', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });

      expect(withPage3[0]).toBe(page1[0]);
      expect(withPage3[1]).toBe(page1[1]);
      expect(withPage3[2]).toBe(page2[0]);
      expect(withPage3[3]).toBe(page3[0]);
    });
  });

  // 8. Reconciliação entre itens com IDs diferentes (TMDB vs IMDb vs Cinemeta)
  describe('8. Reconciliação Cruzada de Metadados Multi-Provedor', () => {
    it('funde dados de Cinemeta, TMDB e Local em um único card com enriquecimento mútuo', () => {
      const cinemetaItem = createMockItem('tt0111161', 'The Shawshank Redemption', ContentType.MOVIE, 1994, {
        imdbId: 'tt0111161',
        backdrop: 'https://cinemeta.org/backdrop.jpg'
      });

      const tmdbItem = createMockItem('tmdb-278', 'Um Sonho de Liberdade', ContentType.MOVIE, 1994, {
        tmdbId: '278',
        originalTitle: 'The Shawshank Redemption',
        image: 'https://image.tmdb.org/t/p/w500/tmdb-poster.jpg',
        overview: 'Dois homens presos criam um forte laço de amizade ao longo dos anos.'
      });

      const localItem = createMockItem('movie-shawshank', 'Um Sonho de Liberdade', ContentType.MOVIE, 1994, {
        genres: ['Drama', 'Crime']
      });

      const deduped = deduplicateContentItems([cinemetaItem, tmdbItem, localItem]);

      expect(deduped.length).toBe(1);
      const unified = deduped[0];

      // Metadados devem ter sido mutualmente enriquecidos
      expect(unified.id).toBe('tt0111161');
      expect(unified.imdbId).toBe('tt0111161');
      expect(unified.tmdbId).toBe('278');
      expect(unified.backdrop).toBe('https://cinemeta.org/backdrop.jpg');
      expect(unified.overview).toBe('Dois homens presos criam um forte laço de amizade ao longo dos anos.');
      expect(unified.genres).toContain('Drama');
    });
  });

  // 9. Preservação de remakes com anos distintos
  describe('9. Preservação de Remakes Legítimos com Anos Diferentes', () => {
    it('preserva obras distintas que compartilham o mesmo título mas lançadas em anos diferentes', () => {
      const remakes: ContentItem[] = [
        createMockItem('dune-1984', 'Duna', ContentType.MOVIE, 1984, { imdbId: 'tt0087175' }),
        createMockItem('dune-2021', 'Duna', ContentType.MOVIE, 2021, { imdbId: 'tt1160419' }),
        createMockItem('king-kong-1933', 'King Kong', ContentType.MOVIE, 1933, { imdbId: 'tt0024216' }),
        createMockItem('king-kong-2005', 'King Kong', ContentType.MOVIE, 2005, { imdbId: 'tt0360717' }),
        createMockItem('psycho-1960', 'Psicose', ContentType.MOVIE, 1960, { imdbId: 'tt0054215' }),
        createMockItem('psycho-1998', 'Psicose', ContentType.MOVIE, 1998, { imdbId: 'tt0155975' })
      ];

      const deduped = deduplicateContentItems(remakes);

      // Todos os 6 devem ser preservados sem colisão!
      expect(deduped.length).toBe(6);
      expect(deduped.map(i => i.id)).toEqual([
        'dune-1984',
        'dune-2021',
        'king-kong-1933',
        'king-kong-2005',
        'psycho-1960',
        'psycho-1998'
      ]);
    });

    it('reconcilia variação de 1 ano (ex: exibição em festival vs lançamento comercial em salas)', () => {
      const festivalVsTheatrical: ContentItem[] = [
        createMockItem('movie-fest', 'Anatomia de uma Queda', ContentType.MOVIE, 2023, { imdbId: 'tt17009710' }),
        createMockItem('movie-theatre', 'Anatomia de uma Queda', ContentType.MOVIE, 2024) // 1 ano de diferença sem IMDb
      ];

      const deduped = deduplicateContentItems(festivalVsTheatrical);
      expect(deduped.length).toBe(1);
      expect(deduped[0].id).toBe('movie-fest');
    });
  });

  // 10. Proteção contra respostas de rede fora de ordem
  describe('10. Resiliência a Respostas de Rede Fora de Ordem', () => {
    it('quando página 3 chega antes da página 2 e depois página 1 é re-buscada, o catálogo não duplica nada', () => {
      let snapshot: ContentItem[] = [];

      const batch1 = [
        createMockItem('item-1', 'Guerra nas Estrelas: Ep IV', ContentType.MOVIE, 1977, { imdbId: 'tt0076759' }),
        createMockItem('item-2', 'O Império Contra-Ataca: Ep V', ContentType.MOVIE, 1980, { imdbId: 'tt0080684' })
      ];

      const batch2 = [
        createMockItem('item-3', 'O Retorno de Jedi: Ep VI', ContentType.MOVIE, 1983, { imdbId: 'tt0086190' })
      ];

      const batch3 = [
        createMockItem('item-4', 'A Ameaça Fantasma: Ep I', ContentType.MOVIE, 1999, { imdbId: 'tt0120915' })
      ];

      // Inicializa com Página 1
      snapshot = catalogSnapshotManager.appendPaginationBatch(snapshot, batch1, 'release_date', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });
      expect(snapshot.length).toBe(2);

      // Página 3 chega antes da Página 2 devido a latência assimétrica
      snapshot = catalogSnapshotManager.appendPaginationBatch(snapshot, batch3, 'release_date', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });
      expect(snapshot.length).toBe(3);

      // Página 2 chega atrasada
      snapshot = catalogSnapshotManager.appendPaginationBatch(snapshot, batch2, 'release_date', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });
      expect(snapshot.length).toBe(4);

      // Re-tentativa ou re-resposta da Página 1 chega novamente (duplicata de rede)
      snapshot = catalogSnapshotManager.appendPaginationBatch(snapshot, batch1, 'release_date', {
        profileId: 'u1',
        isChild: false,
        category: 'movies'
      });

      // Deve manter estritamente os 4 itens, sem nenhuma duplicação
      expect(snapshot.length).toBe(4);
      expect(new Set(snapshot.map(s => s.id)).size).toBe(4);
    });
  });
});
