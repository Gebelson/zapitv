import { describe, it, expect, beforeEach, vi } from 'vitest';
import { episodeAvailabilityService } from '../src/core/episodes/episodeAvailabilityService';
import { ContentItem, ContentType } from '../types';

describe('ZapiTV — Episode Availability & Release Verification System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Validação Rigorosa de Data e Horário de Lançamento (Air Date)', () => {
    it('deve ocultar episódios com data de lançamento futura (YYYY-MM-DD)', () => {
      // Simula episódio marcado para o ano seguinte ou semana que vem
      const futureAirDate = '2030-05-20';
      const isAired = episodeAvailabilityService.isEpisodeOfficiallyAired(futureAirDate);
      expect(isAired).toBe(false);
    });

    it('deve aprovar episódios com data de lançamento passada', () => {
      const pastAirDate = '2022-04-15';
      const isAired = episodeAvailabilityService.isEpisodeOfficiallyAired(pastAirDate);
      expect(isAired).toBe(true);
    });

    it('deve avaliar horário com precisão quando fornecido timestamp ISO (YYYY-MM-DDTHH:mm:ssZ)', () => {
      const futureTimestamp = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // +2 horas no futuro
      const pastTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();   // -2 horas no passado

      expect(episodeAvailabilityService.isEpisodeOfficiallyAired(futureTimestamp)).toBe(false);
      expect(episodeAvailabilityService.isEpisodeOfficiallyAired(pastTimestamp)).toBe(true);
    });

    it('deve ocultar episódios sem data de lançamento ou com data nula/indefinida', () => {
      expect(episodeAvailabilityService.isEpisodeOfficiallyAired(null)).toBe(false);
      expect(episodeAvailabilityService.isEpisodeOfficiallyAired(undefined)).toBe(false);
      expect(episodeAvailabilityService.isEpisodeOfficiallyAired('')).toBe(false);
      expect(episodeAvailabilityService.isEpisodeOfficiallyAired('   ')).toBe(false);
    });
  });

  describe('2. Filtragem de Episódios e Preservação Estrita da Numeração Original', () => {
    it('deve ocultar episódios futuros e manter a numeração original dos episódios restantes', () => {
      const mockRawEpisodes = [
        {
          id: 'ep-1',
          number: 1,
          title: 'O Começo',
          description: 'Primeiro episódio exibido',
          airDate: '2024-01-10'
        },
        {
          id: 'ep-2',
          number: 2,
          title: 'A Revelação',
          description: 'Segundo episódio exibido',
          airDate: '2024-01-17'
        },
        {
          id: 'ep-3',
          number: 3,
          title: 'O Futuro Inédito',
          description: 'Episódio que ainda não estreou',
          airDate: '2035-12-01' // Data no futuro
        },
        {
          id: 'ep-4',
          number: 4,
          title: 'Outro Episódio Futuro',
          description: 'Episódio sem data confirmada',
          airDate: undefined
        }
      ];

      const filtered = episodeAvailabilityService.filterAiredEpisodes(mockRawEpisodes);

      // Apenas os episódios 1 e 2 devem ser exibidos
      expect(filtered.length).toBe(2);
      expect(filtered[0].number).toBe(1);
      expect(filtered[0].title).toBe('O Começo');
      expect(filtered[1].number).toBe(2);
      expect(filtered[1].title).toBe('A Revelação');

      // Episódio 3 e 4 devem estar totalmente ocultos
      expect(filtered.some(e => e.number === 3)).toBe(false);
      expect(filtered.some(e => e.number === 4)).toBe(false);
    });

    it('não deve reenumerar os episódios quando houver lacunas por episódios indisponíveis', () => {
      // Cenário: Temporada onde o episódio 2 não estreou ou foi pulado na exibição oficial,
      // mas os episódios 1 e 3 já foram lançados.
      const mockEpisodesWithGaps = [
        { id: 'ep-1', number: 1, title: 'Parte 1', airDate: '2024-01-01' },
        { id: 'ep-3', number: 3, title: 'Parte 3', airDate: '2024-01-15' }
      ];

      const filtered = episodeAvailabilityService.filterAiredEpisodes(mockEpisodesWithGaps);

      expect(filtered.length).toBe(2);
      expect(filtered[0].number).toBe(1);
      // O segundo episódio na lista DEVE manter o número 3 original, e NÃO ser rebatizado como 2!
      expect(filtered[1].number).toBe(3);
    });

    it('deve eliminar episódios com numeração inválida ou placeholders fictícios', () => {
      const mockEpisodesWithFakes = [
        { id: 'ep-0', number: 0, title: 'Episódio Zero Fictício', airDate: '2024-01-01' },
        { id: 'ep-neg', number: -1, title: 'Negativo Inválido', airDate: '2024-01-01' },
        { id: 'ep-real', number: 1, title: 'Episódio Oficial 1', airDate: '2024-01-01' }
      ];

      const filtered = episodeAvailabilityService.filterAiredEpisodes(mockEpisodesWithFakes);
      expect(filtered.length).toBe(1);
      expect(filtered[0].number).toBe(1);
      expect(filtered[0].title).toBe('Episódio Oficial 1');
    });
  });

  describe('3. Filtragem de Temporadas Futuras ou Vazias', () => {
    it('deve excluir temporadas futuras e especiais (Temporada 0)', () => {
      const rawSeasons = [
        { season_number: 0, air_date: '2020-01-01', episode_count: 5 }, // Especiais
        { season_number: 1, air_date: '2021-01-01', episode_count: 10 }, // Temporada 1 (Passada)
        { season_number: 2, air_date: '2023-01-01', episode_count: 8 },  // Temporada 2 (Passada)
        { season_number: 3, air_date: '2032-05-10', episode_count: 10 }, // Temporada 3 (Futura)
        { season_number: 4, air_date: '2024-01-01', episode_count: 0 }   // Temporada vazia sem episódios
      ];

      const validSeasons = episodeAvailabilityService.getAvailableSeasons(rawSeasons, 4);

      expect(validSeasons).toEqual([1, 2]);
      expect(validSeasons.includes(0)).toBe(false); // Sem temporada 0
      expect(validSeasons.includes(3)).toBe(false); // Sem temporada futura
      expect(validSeasons.includes(4)).toBe(false); // Sem temporada com 0 episódios
    });
  });

  describe('4. Navegação Inteligente (Próximo Episódio e Autoplay)', () => {
    it('deve avançar para o próximo episódio disponível na mesma temporada', () => {
      const seasonEpisodes = [
        { id: 'e1', number: 1, title: 'Episódio 1', description: '', image: '' },
        { id: 'e2', number: 2, title: 'Episódio 2', description: '', image: '' },
        { id: 'e3', number: 3, title: 'Episódio 3', description: '', image: '' }
      ];

      const next = episodeAvailabilityService.getNextAvailableEpisode(
        1, // Season 1
        1, // Current: Episode 1
        seasonEpisodes,
        [1, 2]
      );

      expect(next).not.toBeNull();
      expect(next?.season).toBe(1);
      expect(next?.episode).toBe(2);
      expect(next?.title).toBe('Episódio 2');
    });

    it('deve pular episódios ausentes ou indisponíveis e navegar para o próximo disponível', () => {
      // Episódio 2 indisponível ou excluído por falta de fontes
      const seasonEpisodesWithGap = [
        { id: 'e1', number: 1, title: 'Episódio 1', description: '', image: '' },
        { id: 'e3', number: 3, title: 'Episódio 3', description: '', image: '' }
      ];

      const next = episodeAvailabilityService.getNextAvailableEpisode(
        1,
        1, // Current: Episode 1
        seasonEpisodesWithGap,
        [1, 2]
      );

      // Deve pular o 2 e ir diretamente para o 3
      expect(next?.episode).toBe(3);
    });

    it('deve avançar para a próxima temporada disponível ao concluir a atual', () => {
      const season1Episodes = [
        { id: 's1e1', number: 1, title: 'S1 E1', description: '', image: '' },
        { id: 's1e2', number: 2, title: 'S1 E2 (Final de Temporada)', description: '', image: '' }
      ];

      const season2Episodes = [
        { id: 's2e1', number: 1, title: 'S2 E1 (Estreia)', description: '', image: '' }
      ];

      const next = episodeAvailabilityService.getNextAvailableEpisode(
        1,
        2, // Último episódio da T1
        season1Episodes,
        [1, 2],
        season2Episodes
      );

      expect(next?.season).toBe(2);
      expect(next?.episode).toBe(1);
      expect(next?.title).toBe('S2 E1 (Estreia)');
    });

    it('deve retornar null quando o último episódio disponível de toda a série for alcançado', () => {
      const season1Episodes = [
        { id: 's1e1', number: 1, title: 'S1 E1', description: '', image: '' },
        { id: 's1e2', number: 2, title: 'S1 E2', description: '', image: '' }
      ];

      const next = episodeAvailabilityService.getNextAvailableEpisode(
        1,
        2, // Último episódio
        season1Episodes,
        [1] // Apenas Temporada 1 disponível
      );

      expect(next).toBeNull();
    });
  });

  describe('5. Diferenciação entre Falhas Temporárias e Indisponibilidade Confirmada', () => {
    it('deve registrar e manter no cache episódios confirmados com fontes', () => {
      episodeAvailabilityService.recordEpisodeSourceFound('series-test-1', 1, 1, 3);
      const status = episodeAvailabilityService.getCachedAvailability('series-test-1', 1, 1);

      expect(status.checked).toBe(true);
      expect(status.hasSource).toBe(true);
      expect(status.isTemporaryError).toBe(false);
    });

    it('não deve banir permanentemente episódios que sofreram falha temporária de timeout/rede', () => {
      // Registra erro transitório
      episodeAvailabilityService.recordEpisodeSourceFailed('series-test-2', 1, 1, true);
      const status = episodeAvailabilityService.getCachedAvailability('series-test-2', 1, 1);

      expect(status.checked).toBe(true);
      expect(status.hasSource).toBe(false);
      expect(status.isTemporaryError).toBe(true); // Marcado explicitamente como temporário
    });
  });
});
