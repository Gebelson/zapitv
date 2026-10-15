import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { searchService } from '../src/core/search/searchService';
import { getActorRoute } from '../src/core/routes/navigationRoutes';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { ContentType, ContentItem } from '../types';

describe('ZapiTV — Pesquisa por Atores e Atrizes & Filmografia Oficial', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    searchService.clearCache();
  });

  describe('1. Rota Canônica e Identificação de Artistas', () => {
    it('deve formatar a rota oficial /atores/:id usando o ID numérico do TMDB', () => {
      expect(getActorRoute(500)).toBe('/atores/500');
      expect(getActorRoute('2037')).toBe('/atores/2037');
      expect(getActorRoute('tmdb-actor-12345')).toBe('/atores/12345');
    });
  });

  describe('2. Busca de Pessoas no TMDB (search/person)', () => {
    it('deve mapear resultados de pessoas com foto oficial, nome e departamento', async () => {
      const mockTmdbResponse = {
        results: [
          {
            id: 2037,
            name: 'Cillian Murphy',
            original_name: 'Cillian Murphy',
            profile_path: '/360HfO2ukF36zW7i0y2L9y0b76z.jpg',
            known_for_department: 'Acting',
            popularity: 88.4,
            known_for: [
              { title: 'Oppenheimer' },
              { name: 'Peaky Blinders' }
            ]
          },
          {
            id: 99999,
            name: 'Another Artist',
            profile_path: null,
            known_for_department: 'Directing',
            popularity: 12.0,
            known_for: []
          }
        ]
      };

      vi.spyOn(tmdbService as any, 'request').mockResolvedValueOnce(mockTmdbResponse);

      const actors = await tmdbService.searchPersons('Cillian Murphy');
      expect(actors.length).toBe(2);

      const cillian = actors[0];
      expect(cillian.id).toBe(2037);
      expect(cillian.name).toBe('Cillian Murphy');
      expect(cillian.knownForDepartment).toBe('Atuação');
      expect(cillian.image).toContain('360HfO2ukF36zW7i0y2L9y0b76z.jpg');
      expect(cillian.knownForTitles).toEqual(['Oppenheimer', 'Peaky Blinders']);

      // Deve ordenar por popularidade decrescente
      expect(actors[0].popularity).toBeGreaterThan(actors[1].popularity || 0);
    });

    it('deve usar imagem de fallback de alta qualidade se profile_path for nulo', async () => {
      vi.spyOn(tmdbService as any, 'request').mockResolvedValueOnce({
        results: [
          {
            id: 111,
            name: 'Ator Sem Foto',
            profile_path: null,
            known_for_department: 'Acting',
            popularity: 10
          }
        ]
      });

      const actors = await tmdbService.searchPersons('Ator Sem Foto');
      expect(actors[0].image).toBeTruthy();
      expect(actors[0].image).toContain('unsplash.com');
    });
  });

  describe('3. Detalhes do Artista (person/{id})', () => {
    it('deve obter biografia, data e local de nascimento do artista oficial', async () => {
      const mockDetails = {
        id: 500,
        name: 'Tom Cruise',
        biography: 'Thomas Cruise Mapother IV é um renomado ator americano.',
        birthday: '1962-07-03',
        place_of_birth: 'Syracuse, New York, USA',
        profile_path: '/gThaFcB4vukU6oqAhIOpeq90ZaP.jpg',
        known_for_department: 'Acting',
        popularity: 95.2
      };

      vi.spyOn(tmdbService as any, 'request').mockResolvedValueOnce(mockDetails);

      const details = await tmdbService.getPersonDetails(500);
      expect(details).not.toBeNull();
      expect(details?.name).toBe('Tom Cruise');
      expect(details?.biography).toContain('Thomas Cruise');
      expect(details?.birthday).toBe('1962-07-03');
      expect(details?.placeOfBirth).toContain('Syracuse');
    });
  });

  describe('4. Filmografia Oficial (person/{id}/combined_credits)', () => {
    it('deve separar filmes e séries e estruturar como ContentItems válidos', async () => {
      const mockCredits = {
        cast: [
          {
            id: 872585,
            media_type: 'movie',
            title: 'Oppenheimer',
            overview: 'A história do Projeto Manhattan.',
            poster_path: '/c053y993.jpg',
            backdrop_path: '/b053y993.jpg',
            release_date: '2023-07-21',
            vote_average: 8.9,
            genre_ids: [18, 36]
          },
          {
            id: 60574,
            media_type: 'tv',
            name: 'Peaky Blinders',
            overview: 'Uma família de gângsteres na Inglaterra.',
            poster_path: '/p053y993.jpg',
            backdrop_path: '/bp053y993.jpg',
            first_air_date: '2013-09-12',
            vote_average: 8.6,
            genre_ids: [18, 80]
          }
        ]
      };

      vi.spyOn(tmdbService as any, 'request').mockResolvedValueOnce(mockCredits);

      const filmography = await tmdbService.getPersonCombinedCredits(2037);

      expect(filmography.all.length).toBe(2);
      expect(filmography.movies.length).toBe(1);
      expect(filmography.series.length).toBe(1);

      const oppenheimer = filmography.movies[0];
      expect(oppenheimer.title).toBe('Oppenheimer');
      expect(oppenheimer.type).toBe(ContentType.MOVIE);
      expect(oppenheimer.year).toBe(2023);

      const peaky = filmography.series[0];
      expect(peaky.title).toBe('Peaky Blinders');
      expect(peaky.type).toBe(ContentType.SERIES);
      expect(peaky.year).toBe(2013);
    });

    it('deve deduplicar itens com o mesmo ID na filmografia', async () => {
      const mockCredits = {
        cast: [
          { id: 101, media_type: 'movie', title: 'Filme Repetido', release_date: '2020-01-01' },
          { id: 101, media_type: 'movie', title: 'Filme Repetido', release_date: '2020-01-01' }
        ]
      };

      vi.spyOn(tmdbService as any, 'request').mockResolvedValueOnce(mockCredits);

      const filmography = await tmdbService.getPersonCombinedCredits(999);
      expect(filmography.all.length).toBe(1);
    });
  });

  describe('5. Integração com a Barra de Busca (Sugestões Combinadas)', () => {
    it('deve fornecer produções e atores simultaneamente no getSearchSuggestionsWithActors', async () => {
      vi.spyOn(tmdbService, 'searchMulti').mockResolvedValueOnce([
        {
          id: 'tmdb-872585',
          title: 'Oppenheimer',
          type: ContentType.MOVIE,
          rating: 8.9,
          year: 2023,
          image: 'https://image.tmdb.org/t/p/w500/opp.jpg'
        } as ContentItem
      ]);

      vi.spyOn(tmdbService, 'searchPersons').mockResolvedValueOnce([
        {
          id: 2037,
          name: 'Cillian Murphy',
          image: 'https://image.tmdb.org/t/p/w500/cm.jpg',
          knownForDepartment: 'Atuação',
          knownForTitles: ['Oppenheimer']
        }
      ]);

      const suggestions = await searchService.getSearchSuggestionsWithActors('Cillian', 'all');

      expect(suggestions.actors.length).toBe(1);
      expect(suggestions.actors[0].name).toBe('Cillian Murphy');
      expect(suggestions.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Filtros de Elegibilidade e Validação de Catálogo', () => {
    it('deve bloquear produções em cartaz nos cinemas brasileiros e títulos indisponíveis', () => {
      const testItems: ContentItem[] = [
        {
          id: 'tmdb-valid-1',
          title: 'Filme Disponível 2023',
          type: ContentType.MOVIE,
          year: 2023,
          rating: 8.0,
          image: 'https://example.com/poster.jpg'
        },
        {
          id: 'tmdb-theatrical-2026',
          title: 'Filme em Cartaz Cinemas 2026',
          type: ContentType.MOVIE,
          year: 2026,
          inTheaters: true,
          rating: 8.5,
          image: 'https://example.com/theatrical.jpg'
        }
      ];

      const approved = catalogEligibilityService.filterEligibleItemsSync(testItems);
      expect(approved.some(i => i.title.includes('2023'))).toBe(true);
      // O filme em cartaz nos cinemas não deve ser aprovado
      expect(approved.some(i => i.inTheaters === true)).toBe(false);
    });
  });
});
