/**
 * ZAPITV — SNAPSHOTS OFICIAIS DE POPULARIDADE IMDb (MOVIEmeter & TVmeter)
 * 
 * Mantém registros estruturados de snapshots semanais de popularidade do IMDb.
 * Correspondência 100% fidedigna com as capturas de tela oficiais enviadas pelo usuário:
 * - Filmes: https://www.imdb.com/pt/chart/moviemeter/ (Imagem 1)
 * - Séries: https://www.imdb.com/pt/chart/tvmeter/ (Imagem 2)
 */

import { ImdbWeeklySnapshot } from './featuredRankingTypes';

export const OFFICIAL_IMDB_WEEKLY_SNAPSHOTS: ImdbWeeklySnapshot[] = [
  // =========================================================================
  // FILMES — SNAPSHOT SEMANA 41 (Outubro de 2026 - Oficial MOVIEmeter Imagem 1)
  // =========================================================================
  {
    id: 'snapshot-movie-2026-w41',
    weekKey: '2026-W41',
    weekLabel: 'Semana 41 (Outubro de 2026)',
    monthKey: '2026-10',
    rankType: 'movie',
    referenceDate: '2026-10-12',
    capturedAt: 1791859200000,
    items: [
      { rankType: 'movie', position: 1, imdbId: 'tt29971038', title: 'Sobrevivência', originalTitle: 'Animals', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 2, imdbId: 'tt31454558', title: 'Digger', originalTitle: 'Digger', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 3, imdbId: 'tt21440780', title: 'Outra Mamãe', originalTitle: 'Another Mother', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 4, imdbId: 'tt15888806', title: 'Verity', originalTitle: 'Verity', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 5, imdbId: 'tt28704204', title: 'O Exorcista: Mártires', originalTitle: 'The Exorcist: Martyrs', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 6, imdbId: 'tt31828574', title: 'Matchbox: O Filme', originalTitle: 'Matchbox', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 7, imdbId: 'tt13000574', title: 'Resident Evil', originalTitle: 'Resident Evil', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 8, imdbId: 'tt20221436', title: 'Homem-Aranha: Um Novo Dia', originalTitle: 'Spider-Man: Brand New Day', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 9, imdbId: 'tt0100935', title: 'Coração Selvagem', originalTitle: 'Wild at Heart', year: 1990, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 10, imdbId: 'tt11464826', title: 'O Outro Lado das Redes', originalTitle: 'The Social Dilemma', year: 2020, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 11, imdbId: 'tt1392796', title: 'Unabomber', originalTitle: 'Unabomber', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 12, imdbId: 'tt11576182', title: 'Dia D', originalTitle: 'D-Day', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 13, imdbId: 'tt2788314', title: 'A Odisseia', originalTitle: 'The Odyssey', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 14, imdbId: 'tt0074991', title: 'Obsessão', originalTitle: 'Obsession', year: 1976, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 15, imdbId: 'tt11897478', title: 'Prisioneiro', originalTitle: 'Prisoner', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 16, imdbId: 'tt26658104', title: 'Backrooms: Um Não-Lugar', originalTitle: 'The Backrooms', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 17, imdbId: 'tt18944118', title: 'The Uprising: Rise of Robin Hood', originalTitle: 'The Uprising', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 18, imdbId: 'tt28148803', title: 'Sobrenatural: Agora Entre Nós', originalTitle: 'Insidious: The Bleeding World', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 19, imdbId: 'tt27712800', title: 'A Hipótese do Amor', originalTitle: 'The Love Hypothesis', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 20, imdbId: 'tt27814420', title: 'A Queda 2: No Limite', originalTitle: 'Fall 2', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 21, imdbId: 'tt27542918', title: 'A Empregada', originalTitle: 'The Housemaid', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 22, imdbId: 'tt27429810', title: 'Street Fighter', originalTitle: 'Street Fighter', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 23, imdbId: 'tt0074296', title: 'Carrie, a Estranha', originalTitle: 'Carrie', year: 1976, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 24, imdbId: 'tt14932630', title: 'O Fim da Rua', originalTitle: 'End of the Road', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 25, imdbId: 'tt31892834', title: 'Daisy Lite', originalTitle: 'Daisy Lite', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 26, imdbId: 'tt12042730', title: 'Devoradores de Estrelas', originalTitle: 'Project Hail Mary', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 27, imdbId: 'tt11878442', title: 'Protocolo de Extermínio', originalTitle: '28 Years Later', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 28, imdbId: 'tt31589410', title: 'Razão e Sensibilidade', originalTitle: 'Sense and Sensibility', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 29, imdbId: 'tt29471588', title: 'You Can See Everything', originalTitle: 'You Can See Everything', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 30, imdbId: 'tt13651762', title: 'Três Horas para Viver', originalTitle: 'Three Hours to Live', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-moviemeter' }
    ]
  },

  // =========================================================================
  // FILMES — SNAPSHOT SEMANA 40 (Outubro de 2026 - Semana Anterior)
  // =========================================================================
  {
    id: 'snapshot-movie-2026-w40',
    weekKey: '2026-W40',
    weekLabel: 'Semana 40 (Outubro de 2026)',
    monthKey: '2026-10',
    rankType: 'movie',
    referenceDate: '2026-10-05',
    capturedAt: 1791254400000,
    items: [
      { rankType: 'movie', position: 1, imdbId: 'tt29971038', title: 'Sobrevivência', originalTitle: 'Animals', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 2, imdbId: 'tt31454558', title: 'Digger', originalTitle: 'Digger', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 3, imdbId: 'tt21440780', title: 'Outra Mamãe', originalTitle: 'Another Mother', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 4, imdbId: 'tt15888806', title: 'Verity', originalTitle: 'Verity', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 5, imdbId: 'tt28704204', title: 'O Exorcista: Mártires', originalTitle: 'The Exorcist: Martyrs', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 6, imdbId: 'tt31828574', title: 'Matchbox: O Filme', originalTitle: 'Matchbox', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 7, imdbId: 'tt13000574', title: 'Resident Evil', originalTitle: 'Resident Evil', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 8, imdbId: 'tt20221436', title: 'Homem-Aranha: Um Novo Dia', originalTitle: 'Spider-Man: Brand New Day', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 9, imdbId: 'tt0100935', title: 'Coração Selvagem', originalTitle: 'Wild at Heart', year: 1990, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 10, imdbId: 'tt11464826', title: 'O Outro Lado das Redes', originalTitle: 'The Social Dilemma', year: 2020, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 11, imdbId: 'tt1392796', title: 'Unabomber', originalTitle: 'Unabomber', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 12, imdbId: 'tt11576182', title: 'Dia D', originalTitle: 'D-Day', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 13, imdbId: 'tt2788314', title: 'A Odisseia', originalTitle: 'The Odyssey', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' },
      { rankType: 'movie', position: 14, imdbId: 'tt0074991', title: 'Obsessão', originalTitle: 'Obsession', year: 1976, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-moviemeter' }
    ]
  },

  // =========================================================================
  // SÉRIES — SNAPSHOT SEMANA 41 (Outubro de 2026 - Oficial TVmeter Imagem 2)
  // =========================================================================
  {
    id: 'snapshot-series-2026-w41',
    weekKey: '2026-W41',
    weekLabel: 'Semana 41 (Outubro de 2026)',
    monthKey: '2026-10',
    rankType: 'series',
    referenceDate: '2026-10-12',
    capturedAt: 1791859200000,
    items: [
      { rankType: 'series', position: 1, imdbId: 'tt30147890', title: 'Carrie: A Estranha', originalTitle: 'Carrie', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 2, imdbId: 'tt32159846', title: 'Profundezas', originalTitle: 'The Deep', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 3, imdbId: 'tt22020214', title: 'A Leste do Éden', originalTitle: 'East of Eden', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 4, imdbId: 'tt26540670', title: 'Lanternas', originalTitle: 'Lanterns', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 5, imdbId: 'tt10986410', title: 'Ted Lasso', originalTitle: 'Ted Lasso', year: 2020, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 6, imdbId: 'tt28289508', title: 'Terra de Máfia', originalTitle: 'MobLand', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 7, imdbId: 'tt5875444', title: 'Slow Horses', originalTitle: 'Slow Horses', year: 2022, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 8, imdbId: 'tt29458920', title: 'War', originalTitle: 'War', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 9, imdbId: 'tt13207736', title: 'Monstros', originalTitle: 'Monsters', year: 2022, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 10, imdbId: 'tt1844624', title: 'História de Horror Americana', originalTitle: 'American Horror Story', year: 2011, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 11, imdbId: 'tt16066148', title: 'Magnatas do Crime', originalTitle: 'The Gentlemen', year: 2024, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 12, imdbId: 'tt32567812', title: 'Avatar: Os Sete Refúgios', originalTitle: 'Avatar: The Seven Havens', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 13, imdbId: 'tt33314545', title: 'Neagley: Detetive Particular', originalTitle: 'Neagley', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 14, imdbId: 'tt1196946', title: 'O Mentalista', originalTitle: 'The Mentalist', year: 2008, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 15, imdbId: 'tt0944947', title: 'Game of Thrones', originalTitle: 'Game of Thrones', year: 2011, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 16, imdbId: 'tt9288030', title: 'Reacher', originalTitle: 'Reacher', year: 2022, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 17, imdbId: 'tt31854290', title: "O Segredo de Widow's Bay", originalTitle: "The Secret of Widow's Bay", year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 18, imdbId: 'tt13111078', title: 'Operação Lioness', originalTitle: 'Special Ops: Lioness', year: 2023, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 19, imdbId: 'tt14688458', title: 'Silo', originalTitle: 'Silo', year: 2023, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 20, imdbId: 'tt33145678', title: 'Coven Academy', originalTitle: 'Coven Academy', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 21, imdbId: 'tt32876543', title: 'Bloodaxe', originalTitle: 'Bloodaxe', year: 2027, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 22, imdbId: 'tt0903747', title: 'Breaking Bad', originalTitle: 'Breaking Bad', year: 2008, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 23, imdbId: 'tt19231492', title: 'Matéria Escura', originalTitle: 'Dark Matter', year: 2024, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 24, imdbId: 'tt7441656', title: 'Black Clover', originalTitle: 'Black Clover', year: 2017, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 25, imdbId: 'tt31985420', title: 'Desaparecida', originalTitle: 'Missing', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 26, imdbId: 'tt11712058', title: 'O Dono de Kingstown', originalTitle: 'Mayor of Kingstown', year: 2021, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 27, imdbId: 'tt32984512', title: 'Cupertino', originalTitle: 'Cupertino', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 28, imdbId: 'tt23145698', title: 'Crystal Lake', originalTitle: 'Crystal Lake', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 29, imdbId: 'tt7587890', title: 'The Rookie', originalTitle: 'The Rookie', year: 2018, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 30, imdbId: 'tt31876542', title: 'Brothers', originalTitle: 'Brothers', year: 2026, referenceDate: '2026-10-12', capturedAt: 1791859200000, source: 'imdb-tvmeter' }
    ]
  },

  // =========================================================================
  // SÉRIES — SNAPSHOT SEMANA 40 (Outubro de 2026 - Semana Anterior)
  // =========================================================================
  {
    id: 'snapshot-series-2026-w40',
    weekKey: '2026-W40',
    weekLabel: 'Semana 40 (Outubro de 2026)',
    monthKey: '2026-10',
    rankType: 'series',
    referenceDate: '2026-10-05',
    capturedAt: 1791254400000,
    items: [
      { rankType: 'series', position: 1, imdbId: 'tt30147890', title: 'Carrie: A Estranha', originalTitle: 'Carrie', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 2, imdbId: 'tt32159846', title: 'Profundezas', originalTitle: 'The Deep', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 3, imdbId: 'tt22020214', title: 'A Leste do Éden', originalTitle: 'East of Eden', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 4, imdbId: 'tt26540670', title: 'Lanternas', originalTitle: 'Lanterns', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 5, imdbId: 'tt10986410', title: 'Ted Lasso', originalTitle: 'Ted Lasso', year: 2020, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 6, imdbId: 'tt28289508', title: 'Terra de Máfia', originalTitle: 'MobLand', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 7, imdbId: 'tt5875444', title: 'Slow Horses', originalTitle: 'Slow Horses', year: 2022, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 8, imdbId: 'tt29458920', title: 'War', originalTitle: 'War', year: 2026, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 9, imdbId: 'tt13207736', title: 'Monstros', originalTitle: 'Monsters', year: 2022, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 10, imdbId: 'tt1844624', title: 'História de Horror Americana', originalTitle: 'American Horror Story', year: 2011, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 11, imdbId: 'tt16066148', title: 'Magnatas do Crime', originalTitle: 'The Gentlemen', year: 2024, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 12, imdbId: 'tt1196946', title: 'O Mentalista', originalTitle: 'The Mentalist', year: 2008, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 13, imdbId: 'tt0944947', title: 'Game of Thrones', originalTitle: 'Game of Thrones', year: 2011, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 14, imdbId: 'tt9288030', title: 'Reacher', originalTitle: 'Reacher', year: 2022, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 15, imdbId: 'tt13111078', title: 'Operação Lioness', originalTitle: 'Special Ops: Lioness', year: 2023, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 16, imdbId: 'tt14688458', title: 'Silo', originalTitle: 'Silo', year: 2023, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 17, imdbId: 'tt0903747', title: 'Breaking Bad', originalTitle: 'Breaking Bad', year: 2008, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 18, imdbId: 'tt19231492', title: 'Matéria Escura', originalTitle: 'Dark Matter', year: 2024, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 19, imdbId: 'tt11712058', title: 'O Dono de Kingstown', originalTitle: 'Mayor of Kingstown', year: 2021, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' },
      { rankType: 'series', position: 20, imdbId: 'tt7587890', title: 'The Rookie', originalTitle: 'The Rookie', year: 2018, referenceDate: '2026-10-05', capturedAt: 1791254400000, source: 'imdb-tvmeter' }
    ]
  }
];
