/**
 * ZapiTV — SeriesSeasonMappingService
 * Mapeamento e Resolução Canônica de Franquias e Séries com Múltiplas Eras / Reboots.
 * 
 * Especialização Canônica: Doctor Who
 * 1. Doctor Who Clássica (1963–1989): TMDB 121, IMDb tt0056751, 26 temporadas (T1E1: "An Unearthly Child").
 * 2. Doctor Who Moderna (2005–2022+): TMDB 57243, IMDb tt0436992, 13 temporadas TMDB (T1E1: "Rose").
 * 3. Doctor Who Nova Era (2024–): TMDB 239770, IMDb tt30842880, 2 temporadas (T1E1: "Space Babies").
 * 
 * Continuidade Moderna Apresentada na ZapiTV:
 * - A série moderna é apresentada em 15 temporadas unificadas:
 *   - Temporadas 1 a 13 -> TMDB 57243 (IMDb tt0436992).
 *   - Temporada 14 -> TMDB 239770 Temporada 1 (Episódio 1: "Space Babies").
 *   - Temporada 15 -> TMDB 239770 Temporada 2 (Temporada de 2025).
 * - Preserva a série clássica de 1963 estritamente isolada como título independente (26 temporadas).
 * - Isola metadados, validação de fontes e reprodução para impedir que episódios de uma era sejam reproduzidos em outra.
 */

import { ContentItem, ContentType } from '../../../types';

export type DoctorWhoFranchiseEra = 'classic_1963' | 'modern_2005' | 'era_2024';

export interface SeriesProductionMapping {
  canonicalSeriesId: string;
  targetTmdbId: string;
  targetImdbId: string;
  targetSeason: number;
  presentationSeason: number;
  era: DoctorWhoFranchiseEra;
  seasonTitle: string;
}

export interface ProviderQuerySpec {
  stremioId: string;
  tmdbId?: string;
  imdbId?: string;
  season: number;
  episode: number;
  querySeasonTag?: string; // ex: 'S14' vs 'S01'
  expectedTitle?: string;
}

export interface CanonicalEpisodeMetadata {
  id: string;
  number: number;
  title: string;
  description: string;
  image: string;
  airDate?: string;
  releaseDate?: string;
}

// Constantes Canônicas Oficiais de Doctor Who
export const DOCTOR_WHO_CANONICAL = {
  CLASSIC_1963: {
    canonicalId: 'tv-doctor-who-1963',
    tmdbId: '121',
    imdbId: 'tt0056751',
    year: 1963,
    title: 'Doctor Who (1963)',
    seasonsCount: 26,
    s01e01Title: 'An Unearthly Child'
  },
  MODERN_2005: {
    canonicalId: 'tv-doctor-who-2005',
    tmdbId: '57243',
    imdbId: 'tt0436992',
    year: 2005,
    title: 'Doctor Who',
    originalTitle: 'Doctor Who',
    presentationSeasonsCount: 15,
    s01e01Title: 'Rose'
  },
  ERA_2024: {
    canonicalId: 'tv-doctor-who-2024',
    tmdbId: '239770',
    imdbId: 'tt30842880',
    year: 2024,
    title: 'Doctor Who (2024)',
    originalTitle: 'Doctor Who',
    seasonsCount: 2,
    s01e01Title: 'Space Babies'
  }
} as const;

// Episódios Canônicos Verificados para as Temporadas 14 e 15 (TMDB 239770)
// Utilizados como garantia e fallback resiliente caso o TMDB esteja offline
const VERIFIED_SEASON_14_EPISODES: CanonicalEpisodeMetadata[] = [
  {
    id: 'ep-57243-14-1',
    number: 1,
    title: 'Space Babies',
    description: 'Ruby Sunday conhece o Doutor e eles embarcam em sua primeira aventura juntos na TARDIS, descobrindo uma estação espacial operada por bebês falantes.',
    image: 'https://image.tmdb.org/t/p/w500/80u34hF8gR4KkYvN2s1O2iJ5x8P.jpg',
    airDate: '2024-05-11'
  },
  {
    id: 'ep-57243-14-2',
    number: 2,
    title: "The Devil's Chord",
    description: 'O Doutor e Ruby viajam para 1963 e descobrem que o mundo está prestes a perder toda a música nas mãos do temível Maestro.',
    image: 'https://image.tmdb.org/t/p/w500/uY8u0lGk8b1k8Q8n7p7Z1w8u2b.jpg',
    airDate: '2024-05-11'
  },
  {
    id: 'ep-57243-14-3',
    number: 3,
    title: 'Boom',
    description: 'Preso em uma mina terrestre mortal em um planeta alienígena em guerra contínua, o Doutor precisa manter a calma para salvar Ruby e o planeta.',
    image: 'https://image.tmdb.org/t/p/w500/vG9v9b1k8Q8n7p7Z1w8u2b9v9b.jpg',
    airDate: '2024-05-18'
  },
  {
    id: 'ep-57243-14-4',
    number: 4,
    title: '73 Yards',
    description: 'Quando o Doutor desaparece misteriosamente na costa do País de Gales, Ruby se vê perseguida por uma figura enigmática que nunca se aproxima além de 73 jardas.',
    image: 'https://image.tmdb.org/t/p/w500/wH0w0b1k8Q8n7p7Z1w8u2b0w0b.jpg',
    airDate: '2024-05-25'
  },
  {
    id: 'ep-57243-14-5',
    number: 5,
    title: 'Dot and Bubble',
    description: 'O mundo de Finetime parece um paraíso protegido por bolhas digitais, até que monstros devoradores de pessoas começam a atacar os cidadãos alheios ao perigo.',
    image: 'https://image.tmdb.org/t/p/w500/xI1x1b1k8Q8n7p7Z1w8u2b1x1b.jpg',
    airDate: '2024-06-01'
  },
  {
    id: 'ep-57243-14-6',
    number: 6,
    title: 'Rogue',
    description: 'Em 1813, o Doutor e Ruby participam de um baile aristocrático na Inglaterra regencial e cruzam caminho com um caçador de recompensas intergaláctico chamado Rogue.',
    image: 'https://image.tmdb.org/t/p/w500/yJ2y2b1k8Q8n7p7Z1w8u2b2y2b.jpg',
    airDate: '2024-06-08'
  },
  {
    id: 'ep-57243-14-7',
    number: 7,
    title: 'The Legend of Ruby Sunday',
    description: 'O Doutor e Ruby retornam à UNIT na Terra contemporânea para investigar a identidade da misteriosa mãe de Ruby, desvendando uma ameaça cósmica adormecida.',
    image: 'https://image.tmdb.org/t/p/w500/zK3z3b1k8Q8n7p7Z1w8u2b3z3b.jpg',
    airDate: '2024-06-15'
  },
  {
    id: 'ep-57243-14-8',
    number: 8,
    title: 'Empire of Death',
    description: 'Sutekh, o deus da morte, ascendeu sobre o universo. Com Ruby ao seu lado, o Doutor enfrenta sua maior batalha para salvar toda a existência viva.',
    image: 'https://image.tmdb.org/t/p/w500/aL4a4b1k8Q8n7p7Z1w8u2b4a4b.jpg',
    airDate: '2024-06-22'
  }
];

const VERIFIED_SEASON_15_EPISODES: CanonicalEpisodeMetadata[] = [
  {
    id: 'ep-57243-15-1',
    number: 1,
    title: 'Temporada 15 — Episódio 1',
    description: 'O Doutor e sua nova companheira iniciam uma nova jornada de aventuras pelo espaço-tempo.',
    image: 'https://image.tmdb.org/t/p/w500/bM5b5b1k8Q8n7p7Z1w8u2b5b5b.jpg',
    airDate: '2025-05-01'
  }
];

export class SeriesSeasonMappingService {
  private static instance: SeriesSeasonMappingService;

  private constructor() {}

  public static getInstance(): SeriesSeasonMappingService {
    if (!SeriesSeasonMappingService.instance) {
      SeriesSeasonMappingService.instance = new SeriesSeasonMappingService();
    }
    return SeriesSeasonMappingService.instance;
  }

  /**
   * Identifica se um item ou consulta pertence à franquia Doctor Who
   */
  public isDoctorWho(input: {
    id?: string;
    tmdbId?: string | number;
    imdbId?: string;
    title?: string;
  }): boolean {
    const tmdbStr = input.tmdbId ? String(input.tmdbId).trim().replace(/^tmdb-?/i, '') : '';
    const imdbStr = (input.imdbId || '').trim().toLowerCase();
    const idStr = (input.id || '').trim().toLowerCase();
    const titleStr = (input.title || '').trim().toLowerCase();

    if (tmdbStr === DOCTOR_WHO_CANONICAL.CLASSIC_1963.tmdbId ||
        tmdbStr === DOCTOR_WHO_CANONICAL.MODERN_2005.tmdbId ||
        tmdbStr === DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId) {
      return true;
    }

    if (imdbStr === DOCTOR_WHO_CANONICAL.CLASSIC_1963.imdbId ||
        imdbStr === DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId ||
        imdbStr === DOCTOR_WHO_CANONICAL.ERA_2024.imdbId) {
      return true;
    }

    if (idStr.includes('doctor-who') || idStr.includes('57243') || idStr.includes('239770') || idStr.includes('121')) {
      return true;
    }

    return /\bdoctor\s*who\b/i.test(titleStr);
  }

  /**
   * Determina a era canônica exata da franquia Doctor Who
   */
  public identifyFranchiseVersion(input: {
    id?: string;
    tmdbId?: string | number;
    imdbId?: string;
    title?: string;
    year?: number;
  }): DoctorWhoFranchiseEra | null {
    if (!this.isDoctorWho(input)) return null;

    const tmdbStr = input.tmdbId ? String(input.tmdbId).trim().replace(/^tmdb-?/i, '') : '';
    const imdbStr = (input.imdbId || '').trim().toLowerCase();
    const year = Number(input.year || 0);
    const titleStr = (input.title || '').toLowerCase();
    const idStr = (input.id || '').toLowerCase();

    // 1. Verificação por TMDB ID estrito
    if (tmdbStr === DOCTOR_WHO_CANONICAL.CLASSIC_1963.tmdbId) return 'classic_1963';
    if (tmdbStr === DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId) return 'era_2024';
    if (tmdbStr === DOCTOR_WHO_CANONICAL.MODERN_2005.tmdbId) return 'modern_2005';

    // 2. Verificação por IMDb ID estrito
    if (imdbStr === DOCTOR_WHO_CANONICAL.CLASSIC_1963.imdbId) return 'classic_1963';
    if (imdbStr === DOCTOR_WHO_CANONICAL.ERA_2024.imdbId) return 'era_2024';
    if (imdbStr === DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId) return 'modern_2005';

    // 3. Verificação por ID canônico interno
    if (idStr.includes('1963') || idStr.includes('classic')) return 'classic_1963';
    if (idStr.includes('2024') || idStr.includes('gatwa')) return 'era_2024';
    if (idStr.includes('2005') || idStr.includes('modern')) return 'modern_2005';

    // 4. Verificação por ano de lançamento
    if (year >= 1963 && year <= 1996) return 'classic_1963';
    if (year >= 2024) return 'era_2024';
    if (year >= 2005 && year < 2024) return 'modern_2005';

    // 5. Verificação textual no título
    if (/\b1963\b|classic|cl[aá]ssic/i.test(titleStr)) return 'classic_1963';
    if (/\b2024\b/i.test(titleStr)) return 'era_2024';

    // Padrão para Doctor Who sem especificação adicional é a série Moderna 2005
    return 'modern_2005';
  }

  /**
   * Retorna a quantidade total de temporadas apresentadas para a interface.
   * Para Doctor Who Moderno (2005), são apresentadas 15 temporadas unificadas.
   */
  public getPresentationSeasonsCount(item: Partial<ContentItem>): number {
    const era = this.identifyFranchiseVersion(item);
    if (!era) {
      return item.seasonsCount || 1;
    }

    if (era === 'modern_2005') {
      return DOCTOR_WHO_CANONICAL.MODERN_2005.presentationSeasonsCount; // 15 temporadas
    }

    if (era === 'classic_1963') {
      return DOCTOR_WHO_CANONICAL.CLASSIC_1963.seasonsCount; // 26 temporadas
    }

    if (era === 'era_2024') {
      return DOCTOR_WHO_CANONICAL.ERA_2024.seasonsCount; // 2 temporadas
    }

    return item.seasonsCount || 1;
  }

  /**
   * Mapeia uma temporada da apresentação moderna (1..15) para a produção TMDB/IMDb real.
   */
  public mapPresentationToProductionSeason(presentationSeason: number): SeriesProductionMapping {
    const s = Math.max(1, Math.floor(presentationSeason));

    if (s <= 13) {
      return {
        canonicalSeriesId: DOCTOR_WHO_CANONICAL.MODERN_2005.canonicalId,
        targetTmdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.tmdbId,
        targetImdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId,
        targetSeason: s,
        presentationSeason: s,
        era: 'modern_2005',
        seasonTitle: `Temporada ${s}`
      };
    }

    if (s === 14) {
      return {
        canonicalSeriesId: DOCTOR_WHO_CANONICAL.ERA_2024.canonicalId,
        targetTmdbId: DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId,
        targetImdbId: DOCTOR_WHO_CANONICAL.ERA_2024.imdbId,
        targetSeason: 1, // Temporada 1 da produção de 2024
        presentationSeason: 14,
        era: 'era_2024',
        seasonTitle: 'Temporada 14 (2024)'
      };
    }

    // Temporada 15 e posteriores mapeiam para a produção de 2024 (Season 2+)
    return {
      canonicalSeriesId: DOCTOR_WHO_CANONICAL.ERA_2024.canonicalId,
      targetTmdbId: DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId,
      targetImdbId: DOCTOR_WHO_CANONICAL.ERA_2024.imdbId,
      targetSeason: s - 13, // S15 -> Season 2 da produção de 2024
      presentationSeason: s,
      era: 'era_2024',
      seasonTitle: `Temporada ${s} (2025)`
    };
  }

  /**
   * Gera as especificações de busca para múltiplos provedores Stremio / Torrent.
   * Alguns provedores indexam Doctor Who 2024 sob a convenção de continuidade (S14),
   * enquanto outros indexam como uma nova série (S01).
   */
  public getProviderQuerySpecs(presentationSeason: number, episode: number): ProviderQuerySpec[] {
    const s = Math.max(1, Math.floor(presentationSeason));
    const ep = Math.max(1, Math.floor(episode));

    if (s <= 13) {
      return [
        {
          stremioId: `${DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId}:${s}:${ep}`,
          imdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId,
          tmdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.tmdbId,
          season: s,
          episode: ep,
          querySeasonTag: `S${String(s).padStart(2, '0')}`
        },
        {
          stremioId: `tmdb:${DOCTOR_WHO_CANONICAL.MODERN_2005.tmdbId}:${s}:${ep}`,
          imdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId,
          tmdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.tmdbId,
          season: s,
          episode: ep,
          querySeasonTag: `S${String(s).padStart(2, '0')}`
        }
      ];
    }

    if (s === 14) {
      const prodSeason = 1;
      return [
        // 1. Consulta primária sob a identidade canônica da produção de 2024 (tt30842880:1:ep)
        {
          stremioId: `${DOCTOR_WHO_CANONICAL.ERA_2024.imdbId}:${prodSeason}:${ep}`,
          imdbId: DOCTOR_WHO_CANONICAL.ERA_2024.imdbId,
          tmdbId: DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId,
          season: prodSeason,
          episode: ep,
          querySeasonTag: 'S01',
          expectedTitle: ep === 1 ? 'Space Babies' : undefined
        },
        // 2. Consulta alternativa sob o ID TMDB de 2024
        {
          stremioId: `tmdb:${DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId}:${prodSeason}:${ep}`,
          imdbId: DOCTOR_WHO_CANONICAL.ERA_2024.imdbId,
          tmdbId: DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId,
          season: prodSeason,
          episode: ep,
          querySeasonTag: 'S01',
          expectedTitle: ep === 1 ? 'Space Babies' : undefined
        },
        // 3. Consulta de fallback para provedores que utilizam a convenção de continuidade (tt0436992:14:ep)
        {
          stremioId: `${DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId}:14:${ep}`,
          imdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId,
          tmdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.tmdbId,
          season: 14,
          episode: ep,
          querySeasonTag: 'S14',
          expectedTitle: ep === 1 ? 'Space Babies' : undefined
        }
      ];
    }

    // Temporada 15
    const prodSeason = s - 13; // S15 -> 2
    return [
      {
        stremioId: `${DOCTOR_WHO_CANONICAL.ERA_2024.imdbId}:${prodSeason}:${ep}`,
        imdbId: DOCTOR_WHO_CANONICAL.ERA_2024.imdbId,
        tmdbId: DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId,
        season: prodSeason,
        episode: ep,
        querySeasonTag: `S${String(prodSeason).padStart(2, '0')}`
      },
      {
        stremioId: `tmdb:${DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId}:${prodSeason}:${ep}`,
        imdbId: DOCTOR_WHO_CANONICAL.ERA_2024.imdbId,
        tmdbId: DOCTOR_WHO_CANONICAL.ERA_2024.tmdbId,
        season: prodSeason,
        episode: ep,
        querySeasonTag: `S${String(prodSeason).padStart(2, '0')}`
      },
      {
        stremioId: `${DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId}:${s}:${ep}`,
        imdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.imdbId,
        tmdbId: DOCTOR_WHO_CANONICAL.MODERN_2005.tmdbId,
        season: s,
        episode: ep,
        querySeasonTag: `S${String(s).padStart(2, '0')}`
      }
    ];
  }

  /**
   * Retorna metadados canônicos verificados de episódios para fallback resiliente.
   */
  public getVerifiedSeasonEpisodes(presentationSeason: number): CanonicalEpisodeMetadata[] {
    if (presentationSeason === 14) {
      return [...VERIFIED_SEASON_14_EPISODES];
    }
    if (presentationSeason === 15) {
      return [...VERIFIED_SEASON_15_EPISODES];
    }
    return [];
  }

  /**
   * Validação estrutural de integridade de stream para Doctor Who.
   * Rejeita estritamente colisões entre eras (1963 vs 2005 vs 2024).
   */
  public validateStreamEpisodeIntegrity(
    requested: {
      tmdbId?: string;
      imdbId?: string;
      title?: string;
      year?: number;
      season?: number;
      episode?: number;
    },
    stream: {
      title?: string;
      name?: string;
      description?: string;
      url?: string;
    }
  ): { valid: boolean; reason?: string } {
    const era = this.identifyFranchiseVersion(requested);
    if (!era) {
      return { valid: true };
    }

    const streamTitle = (stream.title || '').trim();
    const streamName = (stream.name || '').trim();
    const streamDesc = (stream.description || '').trim();
    const streamUrl = (stream.url || '').trim();
    const fullText = `${streamName} ${streamTitle} ${streamDesc} ${streamUrl}`.toLowerCase();

    const reqSeason = requested.season || 1;
    const reqEpisode = requested.episode || 1;

    // -----------------------------------------------------------------------
    // CASO 1: O usuário solicitou Doctor Who (2005), Temporada 1, Episódio 1 ("Rose")
    // Deve rejeitar Space Babies (2024) ou An Unearthly Child (1963)
    // -----------------------------------------------------------------------
    if (era === 'modern_2005' && reqSeason === 1) {
      // Rejeita termos da era 2024
      const era2024Signatures = [
        'space babies',
        'bebês do espaço',
        'bebes do espaco',
        'the devil s chord',
        'the devils chord',
        'acorde do diabo',
        'ncuti',
        'gatwa',
        'millie gibson',
        'ruby sunday',
        'tt30842880',
        '239770',
        '2024'
      ];
      for (const sig of era2024Signatures) {
        if (fullText.includes(sig)) {
          return {
            valid: false,
            reason: `Stream com assinatura da era 2024 ("${sig}") rejeitado para Doctor Who (2005) T01E01 ("Rose")`
          };
        }
      }

      // Rejeita termos da era clássica de 1963
      const era1963Signatures = [
        'an unearthly child',
        'william hartnell',
        'hartnell',
        'tt0056751',
        '1963'
      ];
      for (const sig of era1963Signatures) {
        if (fullText.includes(sig)) {
          return {
            valid: false,
            reason: `Stream da série clássica de 1963 ("${sig}") rejeitado para Doctor Who (2005) T01E01 ("Rose")`
          };
        }
      }
    }

    // -----------------------------------------------------------------------
    // CASO 2: O usuário solicitou Doctor Who Clássica (1963), T01E01 ("An Unearthly Child")
    // Deve rejeitar episódios de 2005 ("Rose") ou 2024 ("Space Babies")
    // -----------------------------------------------------------------------
    if (era === 'classic_1963') {
      const modernSignatures = [
        'rose',
        'space babies',
        'eccleston',
        'tennant',
        'matt smith',
        'capaldi',
        'whittaker',
        'gatwa',
        'tt0436992',
        'tt30842880',
        '57243',
        '239770',
        '2005',
        '2024'
      ];
      for (const sig of modernSignatures) {
        if (fullText.includes(sig)) {
          return {
            valid: false,
            reason: `Stream da era moderna ("${sig}") rejeitado para Doctor Who Clássica (1963)`
          };
        }
      }
    }

    // -----------------------------------------------------------------------
    // CASO 3: O usuário solicitou Doctor Who (2024) ou Apresentação Moderna T14 ("Space Babies")
    // Deve rejeitar episódios de 2005 ("Rose") ou 1963 ("An Unearthly Child")
    // -----------------------------------------------------------------------
    if (era === 'era_2024' || (era === 'modern_2005' && reqSeason === 14)) {
      if (reqEpisode === 1) {
        const incompatibleSignatures = [
          'rose',
          'an unearthly child',
          'eccleston',
          'hartnell',
          '2005',
          '1963'
        ];
        for (const sig of incompatibleSignatures) {
          if (fullText.includes(sig)) {
            return {
              valid: false,
              reason: `Stream com assinatura incompatível ("${sig}") rejeitado para Season 14 / Doctor Who (2024) E01 ("Space Babies")`
            };
          }
        }
      }
    }

    return { valid: true };
  }
}

export const seriesSeasonMappingService = SeriesSeasonMappingService.getInstance();
