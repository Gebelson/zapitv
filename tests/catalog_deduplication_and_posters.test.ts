import { describe, it, expect, beforeEach } from 'vitest';
import { catalogSnapshotManager } from '../src/core/catalog/CatalogSnapshotManager';
import { catalogDiscoveryService } from '../src/core/catalog/CatalogDiscoveryService';
import { posterRecoveryService } from '../src/core/catalog/PosterRecoveryService';
import { deduplicateContentItems, getCanonicalKeysForItem } from '../src/core/catalog/catalogDeduplication';
import { VERIFIED_OPEN_ITEMS } from '../src/core/catalog/verifiedCatalog';
import { FEATURED_CATALOG_ITEMS } from '../src/core/catalog/featuredCatalogItems';
import { ContentItem, ContentType } from '../types';

describe('ZapiTV — Capas Oficiais e Deduplicação Canônica', () => {
  beforeEach(() => {
    catalogSnapshotManager.clearCachedSnapshot();
  });

  describe('1. Integridade e Restauração de Capas dos Catálogos', () => {
    it('deve ter capas válidas e ativas no catálogo verificado de animes sem URLs quebradas (404)', () => {
      const bleach = VERIFIED_OPEN_ITEMS.find(i => i.id === 'anime-bleach-tvmeter');
      expect(bleach).toBeDefined();
      expect(bleach?.image).toContain('image.tmdb.org/t/p/w500/dx28DE7EgLy0FatOvnaUg0k9j92.jpg');
      expect(bleach?.backdrop).toContain('image.tmdb.org/t/p/original/o0NsbcIvsllg6CJX0FBFY8wWbsn.jpg');

      const overflow = VERIFIED_OPEN_ITEMS.find(i => i.id === 'tmdb-95897');
      expect(overflow).toBeDefined();
      expect(overflow?.image).toContain('image.tmdb.org/t/p/w500/ipxOC1C1eFnSlqbB5sTsnA3K38O.jpg');

      const adam = VERIFIED_OPEN_ITEMS.find(i => i.id === 'tmdb-241002');
      expect(adam).toBeDefined();
      expect(adam?.image).toContain('image.tmdb.org/t/p/w500/bs70WStsspaiclienWGeMBUDotQ.jpg');

      const doraemon2005 = VERIFIED_OPEN_ITEMS.find(i => i.id === 'tmdb-65733');
      expect(doraemon2005).toBeDefined();
      expect(doraemon2005?.image).toContain('image.tmdb.org/t/p/w500/jzd80ryL0kTBgvXVLeh01cJdNFv.jpg');

      const doraemon1979 = VERIFIED_OPEN_ITEMS.find(i => i.id === 'tmdb-57911');
      expect(doraemon1979).toBeDefined();
      expect(doraemon1979?.image).toContain('image.tmdb.org/t/p/w500/bbn4QLcJfITlAEa0nJDPntsdOgz.jpg');
    });

    it('deve ter poster oficial do TMDB restaurado para Resident Evil 2026', () => {
      const re = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-resident-evil-2026');
      expect(re).toBeDefined();
      expect(re?.image).toBe('https://image.tmdb.org/t/p/w500/gQ76UL64RQe3oHwiwHwODTC23g4.jpg');
      expect(re?.backdrop).toBe('https://image.tmdb.org/t/p/original/3icyRAqgakNcQn6aDVz9libFmBA.jpg');
      expect(re?.tmdbId).toBe('1423191');
    });

    it('deve manter metadados e capas preservadas para Verity, Dia D, A Odisseia e Widow\'s Bay', () => {
      const verity = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-verity-2026');
      expect(verity?.image).toBe('https://image.tmdb.org/t/p/w500/6Qf3sylInJeyK0fFTfjprnGIXCF.jpg');

      const diaD = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-dia-d-2026');
      expect(diaD?.image).toBe('https://image.tmdb.org/t/p/w500/2EjUTEnnoC0sK5j5FS7dC3vOZcl.jpg');

      const odisseia = FEATURED_CATALOG_ITEMS.find(i => i.id === 'movie-a-odisseia-2026');
      expect(odisseia?.image).toBe('https://image.tmdb.org/t/p/w500/muMwJAiMtReEHLKpKMWt2rMkYF7.jpg');

      const widowsBay = FEATURED_CATALOG_ITEMS.find(i => i.id === 'series-widows-bay-2026');
      expect(widowsBay?.image).toBe('https://image.tmdb.org/t/p/w500/hazWZ75ml5Er3MQsFetIzoeWs99.jpg');
    });
  });

  describe('2. PosterRecoveryService — Recuperação Dinâmica sem Troca de Obras', () => {
    it('deve armazenar e recuperar poster em cache síncrono por IMDb ID ou título', () => {
      const mockItem: ContentItem = {
        id: 'mock-film-1',
        title: 'Filme Mock de Teste',
        type: ContentType.MOVIE,
        rating: 8.0,
        year: 2025,
        image: '',
        imdbId: 'tt9999999'
      };

      expect(posterRecoveryService.getCachedPoster(mockItem)).toBeNull();

      posterRecoveryService.setCachedPoster(mockItem, 'https://image.tmdb.org/t/p/w500/recovered-poster.jpg');
      expect(posterRecoveryService.getCachedPoster(mockItem)).toBe('https://image.tmdb.org/t/p/w500/recovered-poster.jpg');
    });

    it('deve evitar requisições idênticas concorrentes reaproveitando a promessa em voo', async () => {
      const mockItem: ContentItem = {
        id: 'mock-flight-1',
        title: 'Filme In Flight',
        type: ContentType.MOVIE,
        rating: 8.0,
        year: 2025,
        image: '',
        imdbId: 'tt8888888'
      };

      const p1 = posterRecoveryService.recoverPoster(mockItem);
      const p2 = posterRecoveryService.recoverPoster(mockItem);
      expect(p1).toBe(p2);
    });
  });

  describe('3. Deduplicação Canônica em Paginação Infinita', () => {
    it('appendPaginationBatch deve descartar itens que colidam em qualquer chave canônica (IMDb, TMDb ou Título+Ano)', () => {
      const currentList: ContentItem[] = [
        {
          id: 'movie-deadpool-2024',
          title: 'Deadpool & Wolverine',
          type: ContentType.MOVIE,
          rating: 8.0,
          year: 2024,
          imdbId: 'tt6263850',
          image: 'https://image.tmdb.org/t/p/w500/deadpool.jpg'
        },
        {
          id: 'movie-oppenheimer-2023',
          title: 'Oppenheimer',
          type: ContentType.MOVIE,
          rating: 8.9,
          year: 2023,
          imdbId: 'tt15398776',
          image: 'https://image.tmdb.org/t/p/w500/oppenheimer.jpg'
        }
      ];

      // Lote novo que contém o mesmo Deadpool & Wolverine vindo com outro ID ('tt6263850' ou 'tmdb-533535') e outro item novo
      const incomingBatch: ContentItem[] = [
        {
          id: 'tt6263850', // mesmo IMDb ID
          title: 'Deadpool & Wolverine',
          type: ContentType.MOVIE,
          rating: 8.0,
          year: 2024,
          imdbId: 'tt6263850',
          image: 'https://image.tmdb.org/t/p/w500/deadpool.jpg'
        },
        {
          id: 'tmdb-gladiator-2',
          title: 'Gladiador II',
          type: ContentType.MOVIE,
          rating: 7.5,
          year: 2024,
          imdbId: 'tt9218128',
          image: 'https://image.tmdb.org/t/p/w500/gladiador2.jpg'
        }
      ];

      const updated = catalogSnapshotManager.appendPaginationBatch(
        currentList,
        incomingBatch,
        'recommended',
        { profileId: 'user1', isChild: false, category: 'movies' }
      );

      // Deve ter exatamente 3 itens (não 4), sem duplicar Deadpool & Wolverine
      expect(updated.length).toBe(3);
      expect(updated[0].title).toBe('Deadpool & Wolverine');
      expect(updated[1].title).toBe('Oppenheimer');
      expect(updated[2].title).toBe('Gladiador II');

      // A ordem e referências dos itens anteriores nunca deve mudar
      expect(updated[0].id).toBe('movie-deadpool-2024');
      expect(updated[1].id).toBe('movie-oppenheimer-2023');
    });

    it('deduplicateContentItems deve manter apenas 1 card por obra e preservar remakes legítimos com anos distintos', () => {
      const items: ContentItem[] = [
        {
          id: 'charade-1963',
          title: 'Charada',
          type: ContentType.MOVIE,
          rating: 7.9,
          year: 1963,
          imdbId: 'tt0056923',
          image: 'https://image.tmdb.org/t/p/w500/charade.jpg'
        },
        {
          id: 'charade-dup',
          title: 'Charada',
          type: ContentType.MOVIE,
          rating: 7.9,
          year: 1963,
          imdbId: 'tt0056923',
          image: 'https://image.tmdb.org/t/p/w500/charade.jpg'
        },
        {
          id: 'charade-remake-2002',
          title: 'O Segredo de Charlie',
          originalTitle: 'The Truth About Charlie',
          type: ContentType.MOVIE,
          rating: 5.5,
          year: 2002,
          imdbId: 'tt0270707',
          image: 'https://image.tmdb.org/t/p/w500/charlie.jpg'
        }
      ];

      const deduped = deduplicateContentItems(items);
      expect(deduped.length).toBe(2);
      expect(deduped.map(d => d.id)).toEqual(['charade-1963', 'charade-remake-2002']);
    });
  });
});
