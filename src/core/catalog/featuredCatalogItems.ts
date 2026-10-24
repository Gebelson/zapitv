import { ContentItem, ContentType } from '../../../types';

/**
 * Catálogo Canônico de Mídias Populares do ZapiTV
 * 
 * Contém metadados oficiais e fontes legítimas dos títulos que compõem
 * os rankings de popularidade semanal do IMDb (MOVIEmeter e TVmeter)
 * correspondentes com rigor absoluto às capturas fornecidas:
 * - Filmes: https://www.imdb.com/pt/chart/moviemeter/ (Imagem 1)
 * - Séries: https://www.imdb.com/pt/chart/tvmeter/ (Imagem 2)
 */
export const FEATURED_CATALOG_ITEMS: ContentItem[] = [
  // =========================================================================
  // FILMES — IMDB MOVIEMETER (IMAGEM 1 DE REFERÊNCIA)
  // =========================================================================

  // 1. SOBREVIVÊNCIA (2026 - tt29971038) — Em cartaz no cinema (Theatrical Window)
  {
    id: 'movie-sobrevivencia-2026',
    title: 'Sobrevivência',
    originalTitle: 'Animals',
    type: ContentType.MOVIE,
    rating: 7.9,
    year: 2026,
    image: 'https://images.metahub.space/poster/medium/tt29971038/img',
    backdrop: 'https://images.metahub.space/background/medium/tt29971038/img',
    description: 'Um thriller eletrizante sobre sobrevivência e dilemas morais em uma situação extrema.',
    genres: ['Drama', 'Suspense'],
    imdbId: 'tt29971038',
    isFeatured: true,
    inTheaters: true,
    availabilityStatus: 'unavailable',
    audioStatus: 'other',
    verifiedStreams: []
  },

  // 2. DIGGER (2026 - tt31454558) — Disponível
  {
    id: 'movie-digger-2026',
    title: 'Digger',
    originalTitle: 'Digger',
    type: ContentType.MOVIE,
    rating: 7.8,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/1ATXKrIPJyKNwnJ6lcG088Sa6zi.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/b7t3r39Oll5qPxBKzLZ8eHMBD7l.jpg',
    description: 'Em uma região montanhosa e remota, um homem solitário se vê diante de conflitos do passado quando seu filho reaparece inesperadamente.',
    genres: ['Aventura', 'Drama', 'Ação'],
    imdbId: 'tt31454558',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 3. OUTRA MAMÃE (2026 - tt21440780) — Disponível
  {
    id: 'movie-outra-mamae-2026',
    title: 'Outra Mamãe',
    originalTitle: 'Another Mother',
    type: ContentType.MOVIE,
    rating: 7.4,
    year: 2026,
    image: 'https://images.metahub.space/poster/medium/tt21440780/img',
    backdrop: 'https://images.metahub.space/background/medium/tt21440780/img',
    description: 'Após uma perda devastadora, uma mulher descobre verdades perturbadoras sobre a nova família que tenta acolhê-la.',
    genres: ['Suspense', 'Mistério', 'Drama'],
    imdbId: 'tt21440780',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 4. VERITY (2026 - tt32261958) — disponibilidade e áudio dependem das fontes resolvidas
  {
    id: 'movie-verity-2026',
    title: 'Verity',
    originalTitle: 'Verity',
    type: ContentType.MOVIE,
    rating: 8.1,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/6Qf3sylInJeyK0fFTfjprnGIXCF.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/6Qf3sylInJeyK0fFTfjprnGIXCF.jpg',
    description: 'Uma escritora em dificuldades financeiras aceita a proposta de concluir a série de sucesso de uma famosa autora incapacitada, descobrindo segredos aterrorizantes em seus manuscritos.',
    genres: ['Romance', 'Mistério', 'Drama'],
    imdbId: 'tt32261958',
    tmdbId: '1283515',
    isFeatured: true
  },

  // 5. O EXORCISTA: MÁRTIRES (2026 - tt28704204) — Disponível
  {
    id: 'movie-exorcista-martires-2026',
    title: 'O Exorcista: Mártires',
    originalTitle: 'The Exorcist: Martyrs',
    type: ContentType.MOVIE,
    rating: 7.2,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/i3kvS445sWWIhuxgXywPuUcsoP0.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/ePIY6b8TlIjqFzK1JKANPhxUIPn.jpg',
    description: 'Capítulo aterrorizante da saga onde padres e especialistas espirituais enfrentam manifestações demoníacas em comunidades isoladas.',
    genres: ['Terror', 'Mistério'],
    imdbId: 'tt28704204',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 6. MATCHBOX: O FILME (2026 - tt31828574) — Disponível
  {
    id: 'movie-matchbox-2026',
    title: 'Matchbox: O Filme',
    originalTitle: 'Matchbox',
    type: ContentType.MOVIE,
    rating: 7.5,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/lFKA4GMz36dImEy3DQPdPF7G4V9.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/y6RIuwuxLG3Nsb37KUj5yatnTIp.jpg',
    description: 'Ação em alta velocidade inspirada na lendária linha de veículos e pistas radicais, com perseguições cinematográficas alucinantes.',
    genres: ['Ação', 'Aventura'],
    imdbId: 'tt31828574',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 7. RESIDENT EVIL (2026 - tt13000574) — Disponível
  {
    id: 'movie-resident-evil-2026',
    title: 'Resident Evil',
    originalTitle: 'Resident Evil',
    type: ContentType.MOVIE,
    rating: 7.6,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/gQ76UL64RQe3oHwiwHwODTC23g4.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/3icyRAqgakNcQn6aDVz9libFmBA.jpg',
    description: 'Nova adaptação cinematográfica da icônica franquia de terror e sobrevivência da Capcom com fidelidade máxima à atmosfera sombria.',
    genres: ['Ação', 'Terror', 'Ficção Científica'],
    tmdbId: '1423191',
    imdbId: 'tt13000574',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 8. HOMEM-ARANHA: UM NOVO DIA (2026 - tt20221436) — Indisponível / Não lançado
  {
    id: 'movie-spiderman-new-day-2026',
    title: 'Homem-Aranha: Um Novo Dia',
    originalTitle: 'Spider-Man: Brand New Day',
    type: ContentType.MOVIE,
    rating: 8.3,
    year: 2026,
    image: 'https://images.metahub.space/poster/medium/tt20221436/img',
    backdrop: 'https://images.metahub.space/background/medium/tt20221436/img',
    description: 'Peter Parker tenta reconstruir sua vida anônima nas ruas de Nova York enquanto novos vigilantes e ameaças emergem.',
    genres: ['Ação', 'Aventura', 'Ficção Científica'],
    imdbId: 'tt20221436',
    isFeatured: false,
    availabilityStatus: 'unavailable'
  },

  // 9. CORAÇÃO SELVAGEM (1990 - tt0100935) — Disponível
  {
    id: 'movie-wild-at-heart-1990',
    title: 'Coração Selvagem',
    originalTitle: 'Wild at Heart',
    type: ContentType.MOVIE,
    rating: 7.2,
    year: 1990,
    image: 'https://images.metahub.space/poster/medium/tt0100935/img',
    backdrop: 'https://images.metahub.space/background/medium/tt0100935/img',
    description: 'Jovens amantes fogem pela estrada enquanto a mãe controladora da garota contrata assassinos e detetives para caçá-los. Clássico cult de David Lynch com Nicolas Cage e Laura Dern.',
    genres: ['Crime', 'Drama', 'Romance'],
    imdbId: 'tt0100935',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 10. O OUTRO LADO DAS REDES (2020 - tt11464826) — Disponível
  {
    id: 'movie-social-dilemma-2020',
    title: 'O Outro Lado das Redes',
    originalTitle: 'The Social Dilemma',
    type: ContentType.MOVIE,
    rating: 7.6,
    year: 2020,
    image: 'https://images.metahub.space/poster/medium/tt11464826/img',
    backdrop: 'https://images.metahub.space/background/medium/tt11464826/img',
    description: 'Especialistas em tecnologia e ex-executivos do Vale do Silício revelam o impacto perigoso e manipulador das redes sociais sobre a psicologia humana e a sociedade.',
    genres: ['Documentário', 'Drama'],
    imdbId: 'tt11464826',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 11. UNABOMBER (2026 - tt1392796) — Disponível
  {
    id: 'movie-unabomber-2026',
    title: 'Unabomber',
    originalTitle: 'Unabomber',
    type: ContentType.MOVIE,
    rating: 7.7,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/39aMkR8Y5vhCG9dTkjiqRl8AVqp.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/58D9nalUYW5L5K0guw7hcpsEJBH.jpg',
    description: 'A história real da caçada do FBI ao terrorista matemático Ted Kaczynski e a revolução dos métodos de análise linguística forense.',
    genres: ['Biografia', 'Crime', 'Drama'],
    imdbId: 'tt1392796',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 12. DIA D (2026 - tt11576182) — Disponível
  {
    id: 'movie-dia-d-2026',
    title: 'Dia D',
    originalTitle: 'D-Day',
    type: ContentType.MOVIE,
    rating: 7.5,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/2EjUTEnnoC0sK5j5FS7dC3vOZcl.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/2EjUTEnnoC0sK5j5FS7dC3vOZcl.jpg',
    description: 'A reconstituição cinematográfica da Operação Overlord e o desembarque dos aliados na Normandia durante a Segunda Guerra Mundial.',
    genres: ['Guerra', 'História', 'Drama'],
    imdbId: 'tt11576182',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 13. A ODISSEIA (2026 - tt33764258) — disponibilidade e áudio dependem das fontes resolvidas
  {
    id: 'movie-a-odisseia-2026',
    title: 'A Odisseia',
    originalTitle: 'The Odyssey',
    type: ContentType.MOVIE,
    rating: 8.0,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/muMwJAiMtReEHLKpKMWt2rMkYF7.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/muMwJAiMtReEHLKpKMWt2rMkYF7.jpg',
    description: 'A épica jornada de Ulisses narrada em uma superprodução visual, enfrentando monstros mitológicos e a ira dos deuses gregos para retornar a Ítaca.',
    genres: ['Aventura', 'Fantasia', 'Drama'],
    imdbId: 'tt33764258',
    tmdbId: '1368337',
    isFeatured: true,
    catalogVisibleFrom: '2026-11-20T00:00:00-03:00'
  },

  // 14. OBSESSÃO (1976 - tt0074991) — Disponível
  {
    id: 'movie-obsession-1976',
    title: 'Obsessão',
    originalTitle: 'Obsession',
    type: ContentType.MOVIE,
    rating: 7.0,
    year: 1976,
    image: 'https://images.metahub.space/poster/medium/tt0074991/img',
    backdrop: 'https://images.metahub.space/background/medium/tt0074991/img',
    description: 'Um empresário assombrado pelo sequestro e morte de sua esposa conhece uma mulher idêntica anos depois na Itália. Obra-prima de suspense dirigida por Brian De Palma.',
    genres: ['Mistério', 'Drama', 'Suspense'],
    imdbId: 'tt0074991',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 15. PRISIONEIRO (2026 - tt11897478)
  {
    id: 'movie-prisioneiro-2026',
    title: 'Prisioneiro',
    originalTitle: 'Prisoner',
    type: ContentType.MOVIE,
    rating: 7.3,
    year: 2026,
    image: 'https://images.metahub.space/poster/medium/tt11897478/img',
    backdrop: 'https://images.metahub.space/background/medium/tt11897478/img',
    description: 'Um homem aprisionado injustamente em um complexo de segurança máxima descobre uma conspiração de alto nível.',
    genres: ['Ação', 'Suspense'],
    imdbId: 'tt11897478',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 16. BACKROOMS: UM NÃO-LUGAR (2026 - tt26657236)
  {
    id: 'movie-backrooms-2026',
    title: 'Backrooms: Um Não-Lugar',
    originalTitle: 'The Backrooms',
    type: ContentType.MOVIE,
    rating: 7.1,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/rhGx6E3qRNMgj3i5su2oukNHwIQ.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/dqmMWNWfLnExDRpMtIMqI97GQFR.jpg',
    description: 'Ao cair fora da realidade, um jovem se encontra em um labirinto infinito de salas vazias e carpete úmido com entidades à espreita.',
    genres: ['Terror', 'Ficção Científica'],
    imdbId: 'tt26657236',
    tmdbId: '1083381',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 17. THE UPRISING: RISE OF ROBIN HOOD (2026 - tt27546684)
  {
    id: 'movie-the-uprising-2026',
    title: 'The Uprising: Rise of Robin Hood',
    originalTitle: 'The Uprising',
    type: ContentType.MOVIE,
    rating: 7.0,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/7TUl15TOsIvndKlgMWTtLgtEzZP.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/y0reRTsewsPh0ePtgvDeLIsb5Wk.jpg',
    description: 'As origens sombrias e sangrentas da rebelião de Robin dos Bosques contra a corrupção da monarquia britânica.',
    genres: ['Ação', 'Aventura', 'Histórico'],
    imdbId: 'tt27546684',
    tmdbId: '977942',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 23. CARRIE, A ESTRANHA (1976 - tt0074285)
  {
    id: 'movie-carrie-1976',
    title: 'Carrie, a Estranha',
    originalTitle: 'Carrie',
    type: ContentType.MOVIE,
    rating: 7.4,
    year: 1976,
    image: 'https://image.tmdb.org/t/p/w500/8tT1rqlsTguyfUBMrbHR9cv1rxM.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/jyrqiT3BaUQVcGnLRkCwopnkyKj.jpg',
    description: 'Carrie White, uma adolescente tímida e marginalizada com poderes telecinéticos, liberta sua fúria após uma humilhação traumática no baile escolar.',
    genres: ['Terror', 'Drama'],
    imdbId: 'tt0074285',
    tmdbId: '7340',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // =========================================================================
  // SÉRIES — IMDB TVMETER (IMAGEM 2 DE REFERÊNCIA)
  // =========================================================================

  // 1. CARRIE: A ESTRANHA (2026- - tt30147890) — Ainda não lançada
  {
    id: 'series-carrie-2026',
    title: 'Carrie: A Estranha',
    originalTitle: 'Carrie',
    type: ContentType.SERIES,
    rating: 7.5,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/kloXz9qwO23z9Kbt3z3MgnjF4xO.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/pmJDMH2YX9YrIwiawqPrgpRiZXb.jpg',
    description: 'Nova adaptação seriada da obra-prima de Stephen King sobre Carrie White e os segredos da sua pacata cidade.',
    genres: ['Terror', 'Drama'],
    imdbId: 'tt30147890',
    isFeatured: true,
    availabilityStatus: 'unreleased',
    audioStatus: 'other',
    episodes: []
  },

  // 2. PROFUNDEZAS (2026- - tt32159846) — Ainda não lançada
  {
    id: 'series-profundezas-2026',
    title: 'Profundezas',
    originalTitle: 'The Deep',
    type: ContentType.SERIES,
    rating: 7.6,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/3aoRvpHjuRmn76P2AVXZIBDoCdg.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/ixSG9hAB54A1dlmBOW8qTExOyzw.jpg',
    description: 'Uma expedição submarina a uma fossa abissal revela segredos que deveriam ter permanecido ocultos sob as ondas.',
    genres: ['Mistério', 'Ficção Científica'],
    imdbId: 'tt32159846',
    isFeatured: true,
    availabilityStatus: 'unreleased',
    audioStatus: 'other',
    episodes: []
  },

  // 3. A LESTE DO ÉDEN (2026- - tt21097264) — DISPONÍVEL (TVmeter #3)
  {
    id: 'series-a-leste-do-eden-2026',
    title: 'A Leste do Éden',
    originalTitle: 'East of Eden',
    type: ContentType.SERIES,
    rating: 7.8,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/axdUor6gLMTrrB1UF4Qfy0TTSyX.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/70RZX7kNjA0Qjn6HigB1oMvFJ8R.jpg',
    description: 'Adaptação do épico clássico de John Steinbeck sobre duas famílias cujas histórias se entrelaçam no vale de Salinas.',
    genres: ['Drama', 'Histórico'],
    imdbId: 'tt21097264',
    tmdbId: '258165',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    seasonsCount: 1,
    episodes: [
      {
        id: 'eden-s1e1',
        number: 1,
        title: 'Irmãos',
        description: 'Depois que o acaso coloca Cathy Ames na vida dos irmãos Trask, todos precisam lidar com uma batalha interna entre o bem e o mal.',
        image: 'https://images.metahub.space/poster/medium/tt21097264/img'
      }
    ]
  },

  // 4. LANTERNAS (2026- - tt26540670) — Ainda não lançada
  {
    id: 'series-lanternas-2026',
    title: 'Lanternas',
    originalTitle: 'Lanterns',
    type: ContentType.SERIES,
    rating: 8.0,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/gpC7h43xPMEV3goYMQShfJbTtLq.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/6gqezQJ2mkm4jreWwLyOZy2Vf6i.jpg',
    description: 'Os policiais intergalácticos Hal Jordan e John Stewart investigam um mistério sombrio no coração dos Estados Unidos.',
    genres: ['Ação', 'Aventura', 'Ficção Científica'],
    imdbId: 'tt26540670',
    tmdbId: '95350',
    isFeatured: true,
    availabilityStatus: 'unreleased',
    audioStatus: 'other',
    episodes: []
  },

  // 5. TED LASSO (2020- - tt10986410) — DISPONÍVEL (TVmeter #5)
  {
    id: 'series-ted-lasso',
    title: 'Ted Lasso',
    originalTitle: 'Ted Lasso',
    type: ContentType.SERIES,
    rating: 8.8,
    year: 2020,
    image: 'https://images.metahub.space/poster/medium/tt10986410/img',
    backdrop: 'https://images.metahub.space/background/medium/tt10986410/img',
    description: 'O treinador de futebol americano Ted Lasso é contratado para comandar um time de futebol britânico na Premier League com muito otimismo e empatia.',
    genres: ['Comédia', 'Drama', 'Esporte'],
    imdbId: 'tt10986410',
    seasonsCount: 3,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'ted-lasso-s1e1',
        number: 1,
        title: 'Piloto',
        description: 'Ted Lasso chega à Inglaterra para treinar o AFC Richmond, surpreendendo os torcedores e a mídia cética.',
        image: 'https://images.metahub.space/poster/medium/tt10986410/img'
      },
      {
        id: 'ted-lasso-s1e2',
        number: 2,
        title: 'Biscoitos',
        description: 'Ted tenta conquistar Rebecca com doces caseiros enquanto resolve conflitos no vestiário.',
        image: 'https://images.metahub.space/poster/medium/tt10986410/img'
      }
    ]
  },

  // 6. TERRA DE MÁFIA (2026- - tt28289508) — Ainda não lançada
  {
    id: 'series-terra-de-mafia-2026',
    title: 'Terra de Máfia',
    originalTitle: 'MobLand',
    type: ContentType.SERIES,
    rating: 7.7,
    year: 2026,
    image: 'https://images.metahub.space/poster/medium/tt28289508/img',
    backdrop: 'https://images.metahub.space/background/medium/tt28289508/img',
    description: 'Conflitos territoriais sangrentos entre famílias rivais em uma cidade fronteiriça dominada pelo crime organizado.',
    genres: ['Crime', 'Drama'],
    imdbId: 'tt28289508',
    isFeatured: true,
    availabilityStatus: 'unreleased',
    audioStatus: 'other',
    episodes: []
  },

  // 7. SLOW HORSES (2022- - tt5875444) — DISPONÍVEL (TVmeter #7)
  {
    id: 'series-slow-horses',
    title: 'Slow Horses',
    originalTitle: 'Slow Horses',
    type: ContentType.SERIES,
    rating: 8.3,
    year: 2022,
    image: 'https://images.metahub.space/poster/medium/tt5875444/img',
    backdrop: 'https://images.metahub.space/background/medium/tt5875444/img',
    description: 'Uma equipe disfuncional de agentes do MI5 que cometeram erros em suas carreiras tenta proteger o Reino Unido sob a liderança do beberrão e brilhante Jackson Lamb.',
    genres: ['Suspense', 'Drama', 'Crime'],
    imdbId: 'tt5875444',
    seasonsCount: 4,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'slow-horses-s1e1',
        number: 1,
        title: 'Slough House',
        description: 'Após um exercício de treinamento fracassado, River Cartwright é banido para a Slough House.',
        image: 'https://images.metahub.space/poster/medium/tt5875444/img'
      },
      {
        id: 'slow-horses-s1e2',
        number: 2,
        title: 'Work Drinks',
        description: 'A equipe se envolve no caso do sequestro de um estudante universitário.',
        image: 'https://images.metahub.space/poster/medium/tt5875444/img'
      }
    ]
  },

  // 8. WAR (2026- - tt29458920) — Ainda não lançada
  {
    id: 'series-war-2026',
    title: 'War',
    originalTitle: 'War',
    type: ContentType.SERIES,
    rating: 7.9,
    year: 2026,
    image: 'https://images.metahub.space/poster/medium/tt29458920/img',
    backdrop: 'https://images.metahub.space/background/medium/tt29458920/img',
    description: 'Crônica visceral das tensões geopolíticas e operações táticas em um conflito global em larga escala.',
    genres: ['Guerra', 'Ação', 'Drama'],
    imdbId: 'tt29458920',
    isFeatured: true,
    availabilityStatus: 'unreleased',
    audioStatus: 'other',
    episodes: []
  },

  // 9. MONSTROS (2022- - tt13207736) — DISPONÍVEL (TVmeter #9)
  {
    id: 'series-monstros',
    title: 'Monstros',
    originalTitle: 'Monsters',
    type: ContentType.SERIES,
    rating: 7.9,
    year: 2022,
    image: 'https://images.metahub.space/poster/medium/tt13207736/img',
    backdrop: 'https://images.metahub.space/background/medium/tt13207736/img',
    description: 'Série antológica sobre crimes reais que chocaram a sociedade, explorando a psicologia e a dinâmica dos julgamentos.',
    genres: ['Biografia', 'Crime', 'Drama'],
    imdbId: 'tt13207736',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'monsters-s1e1',
        number: 1,
        title: 'Episódio 1',
        description: 'O início das investigações de um caso que paralisou a opinião pública.',
        image: 'https://images.metahub.space/poster/medium/tt13207736/img'
      }
    ]
  },

  // 10. HISTÓRIA DE HORROR AMERICANA (2011- - tt1844624) — DISPONÍVEL (TVmeter #10)
  {
    id: 'series-ahs',
    title: 'História de Horror Americana',
    originalTitle: 'American Horror Story',
    type: ContentType.SERIES,
    rating: 8.0,
    year: 2011,
    image: 'https://images.metahub.space/poster/medium/tt1844624/img',
    backdrop: 'https://images.metahub.space/background/medium/tt1844624/img',
    description: 'Série antológica criada por Ryan Murphy que explora diferentes mitos, casas assombradas, asilos, covens e lendas urbanas de horror.',
    genres: ['Terror', 'Drama', 'Mistério'],
    imdbId: 'tt1844624',
    seasonsCount: 12,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'ahs-s1e1',
        number: 1,
        title: 'Piloto: Murder House',
        description: 'A família Harmon muda-se de Boston para Los Angeles para recomeçar suas vidas em uma mansão com passado macabro.',
        image: 'https://images.metahub.space/poster/medium/tt1844624/img'
      }
    ]
  },

  // 11. MAGNATAS DO CRIME (2024- - tt13210838) — DISPONÍVEL (TVmeter #11)
  {
    id: 'series-the-gentlemen',
    title: 'Magnatas do Crime',
    originalTitle: 'The Gentlemen',
    type: ContentType.SERIES,
    rating: 8.1,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/e5enRsAImbGcsT0BksqwurjA6CZ.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/l6PSAWVLyaZzwviMwBgYQOPVJ6Y.jpg',
    description: 'Eddie Horniman herda inesperadamente a vasta propriedade rural do pai, descobrindo que ela faz parte de um império bilionário da cannabis.',
    genres: ['Ação', 'Comédia', 'Crime'],
    imdbId: 'tt13210838',
    tmdbId: '125244',
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'gentlemen-s1e1',
        number: 1,
        title: 'Refinado e Perigoso',
        description: 'Eddie descobre que o negócio secreto da família vem acompanhado de gângsteres excêntricos e perigosos.',
        image: 'https://image.tmdb.org/t/p/w500/e5enRsAImbGcsT0BksqwurjA6CZ.jpg'
      }
    ]
  },

  // 12. AVATAR: OS SETE REFÚGIOS (2026- - tt32567812) — Ainda não lançada
  {
    id: 'series-avatar-sete-refugios-2026',
    title: 'Avatar: Os Sete Refúgios',
    originalTitle: 'Avatar: The Seven Havens',
    type: ContentType.SERIES,
    rating: 8.2,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/u62d0BPqsdv2TUDifcMmoePbHPL.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/t2KFGH07Al4XuIZLHRlF1Hj9IJB.jpg',
    description: 'Uma nova jornada épica no mundo da dobra elemental onde jovens dominadores protegem os antigos santuários sagrados.',
    genres: ['Ação', 'Aventura', 'Fantasia'],
    imdbId: 'tt32567812',
    tmdbId: '284833',
    isFeatured: true,
    availabilityStatus: 'unreleased',
    audioStatus: 'other',
    episodes: []
  },

  // 13. NEAGLEY: DETETIVE PARTICULAR (2026- - tt33314545) — Ainda não lançada
  {
    id: 'series-neagley-2026',
    title: 'Neagley: Detetive Particular',
    originalTitle: 'Neagley',
    type: ContentType.SERIES,
    rating: 7.9,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/lKOPmO0ah17ogQ9hWg7lSd40kIr.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/uYOYLFQ4q7asuhdiKXCqGaeAQUH.jpg',
    description: 'Spin-off de Reacher focado na investigadora de elite Frances Neagley resolvendo casos complexos em Chicago.',
    genres: ['Ação', 'Crime', 'Drama'],
    imdbId: 'tt33314545',
    tmdbId: '273207',
    isFeatured: true,
    availabilityStatus: 'unreleased',
    audioStatus: 'other',
    episodes: []
  },

  // 14. O MENTALISTA (2008-2015 - tt1196946) — DISPONÍVEL (TVmeter #14)
  {
    id: 'series-the-mentalist',
    title: 'O Mentalista',
    originalTitle: 'The Mentalist',
    type: ContentType.SERIES,
    rating: 8.2,
    year: 2008,
    image: 'https://images.metahub.space/poster/medium/tt1196946/img',
    backdrop: 'https://images.metahub.space/background/medium/tt1196946/img',
    description: 'Patrick Jane, um ex-falso médium com impressionante poder de observação e dedução, atua como consultor do CBI enquanto busca vingança contra o serial killer Red John.',
    genres: ['Crime', 'Drama', 'Mistério'],
    imdbId: 'tt1196946',
    seasonsCount: 7,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'mentalist-s1e1',
        number: 1,
        title: 'Piloto',
        description: 'Patrick Jane ajuda a equipe do CBI liderada por Teresa Lisbon a investigar o homicídio da esposa de um jogador de golfe.',
        image: 'https://images.metahub.space/poster/medium/tt1196946/img'
      }
    ]
  },

  // 15. GAME OF THRONES (2011-2019 - tt0944947) — DISPONÍVEL (TVmeter #15)
  {
    id: 'series-game-of-thrones-2011',
    title: 'Game of Thrones',
    originalTitle: 'Game of Thrones',
    type: ContentType.SERIES,
    rating: 9.2,
    year: 2011,
    image: 'https://images.metahub.space/poster/medium/tt0944947/img',
    backdrop: 'https://images.metahub.space/background/medium/tt0944947/img',
    description: 'Nove famílias nobres lutam pelo controle do Trono de Ferro de Westeros enquanto um inimigo ancestral desperta além da Muralha.',
    genres: ['Ação', 'Aventura', 'Drama', 'Fantasia'],
    imdbId: 'tt0944947',
    seasonsCount: 8,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'got-s1e1',
        number: 1,
        title: 'O Inverno Está Chegando',
        description: 'Lorde Ned Stark recebe a visita do Rei Robert Baratheon em Winterfell para assumir o cargo de Mão do Rei.',
        image: 'https://images.metahub.space/poster/medium/tt0944947/img'
      }
    ]
  },

  // 16. REACHER (2022- - tt9288030) — DISPONÍVEL (TVmeter #16)
  {
    id: 'series-reacher',
    title: 'Reacher',
    originalTitle: 'Reacher',
    type: ContentType.SERIES,
    rating: 8.1,
    year: 2022,
    image: 'https://images.metahub.space/poster/medium/tt9288030/img',
    backdrop: 'https://images.metahub.space/background/medium/tt9288030/img',
    description: 'O veterano da polícia militar Jack Reacher viaja sem rumo pelos Estados Unidos e resolve mistérios violentos usando inteligência e força bruta.',
    genres: ['Ação', 'Crime', 'Drama'],
    imdbId: 'tt9288030',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'reacher-s1e1',
        number: 1,
        title: 'Bem-vindo a Margrave',
        description: 'Reacher é preso logo após desembarcar em uma pacata cidade da Geórgia acusado de um assassinato brutal.',
        image: 'https://images.metahub.space/poster/medium/tt9288030/img'
      }
    ]
  },

  // 17. O SEGREDO DE WIDOW'S BAY (2026- - tt31854290) — Ainda não lançada
  {
    id: 'series-widows-bay-2026',
    title: "O Segredo de Widow's Bay",
    originalTitle: "The Secret of Widow's Bay",
    type: ContentType.SERIES,
    rating: 7.7,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/hazWZ75ml5Er3MQsFetIzoeWs99.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/hazWZ75ml5Er3MQsFetIzoeWs99.jpg',
    description: 'Uma comunidade costeira é abalada pelo ressurgimento de lendas sombrias e corpos na praia após uma tempestade.',
    genres: ['Mistério', 'Drama', 'Suspense'],
    imdbId: 'tt31854290',
    isFeatured: true,
    availabilityStatus: 'unreleased',
    audioStatus: 'other',
    episodes: []
  },

  // 18. OPERAÇÃO LIONESS (2023- - tt13111078) — DISPONÍVEL (TVmeter #18)
  {
    id: 'series-lioness',
    title: 'Operação Lioness',
    originalTitle: 'Special Ops: Lioness',
    type: ContentType.SERIES,
    rating: 7.8,
    year: 2023,
    image: 'https://images.metahub.space/poster/medium/tt13111078/img',
    backdrop: 'https://images.metahub.space/background/medium/tt13111078/img',
    description: 'Criada por Taylor Sheridan, a série acompanha o programa de agentes secretas da CIA que se infiltram em círculos terroristas globais.',
    genres: ['Ação', 'Drama', 'Suspense'],
    imdbId: 'tt13111078',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'lioness-s1e1',
        number: 1,
        title: 'Soldados Sacrificiais',
        description: 'Joe recruta uma jovem fuzileira naval para se aproximar da filha de um financista do terrorismo.',
        image: 'https://images.metahub.space/poster/medium/tt13111078/img'
      }
    ]
  },

  // 19. SILO (2023- - tt14688458) — DISPONÍVEL (TVmeter #19)
  {
    id: 'series-silo',
    title: 'Silo',
    originalTitle: 'Silo',
    type: ContentType.SERIES,
    rating: 8.1,
    year: 2023,
    image: 'https://images.metahub.space/poster/medium/tt14688458/img',
    backdrop: 'https://images.metahub.space/background/medium/tt14688458/img',
    description: 'Em um futuro tóxico e devastado, uma comunidade de milhares de pessoas vive em um gigantesco silo subterrâneo de 144 andares com regras rigorosas.',
    genres: ['Ficção Científica', 'Drama', 'Mistério'],
    imdbId: 'tt14688458',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'silo-s1e1',
        number: 1,
        title: 'Dia da Liberdade',
        description: 'O xerife Holston toma uma decisão fatídica após anos desconfiando das narrativas oficiais sobre a superfície.',
        image: 'https://images.metahub.space/poster/medium/tt14688458/img'
      }
    ]
  },

  // 22. BREAKING BAD (2008-2013 - tt0903747) — DISPONÍVEL (TVmeter #22)
  {
    id: 'series-breaking-bad-2008',
    title: 'Breaking Bad',
    originalTitle: 'Breaking Bad',
    type: ContentType.SERIES,
    rating: 9.5,
    year: 2008,
    image: 'https://images.metahub.space/poster/medium/tt0903747/img',
    backdrop: 'https://images.metahub.space/background/medium/tt0903747/img',
    description: 'Um professor de química do ensino médio com câncer terminal se associa a um ex-aluno para produzir metanfetamina para garantir o futuro financeiro de sua família.',
    genres: ['Crime', 'Drama', 'Suspense'],
    imdbId: 'tt0903747',
    seasonsCount: 5,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'bb-s1e1',
        number: 1,
        title: 'Piloto',
        description: 'Walter White descobre que tem câncer e decide usar suas habilidades em química para entrar no submundo das drogas com Jesse Pinkman.',
        image: 'https://images.metahub.space/poster/medium/tt0903747/img'
      }
    ]
  },

  // 23. MATÉRIA ESCURA (2024- - tt19231492) — DISPONÍVEL (TVmeter #23)
  {
    id: 'series-dark-matter',
    title: 'Matéria Escura',
    originalTitle: 'Dark Matter',
    type: ContentType.SERIES,
    rating: 7.7,
    year: 2024,
    image: 'https://images.metahub.space/poster/medium/tt19231492/img',
    backdrop: 'https://images.metahub.space/background/medium/tt19231492/img',
    description: 'O físico Jason Dessen é sequestrado e acorda em uma versão alternativa de sua vida, lutando para retornar à sua verdadeira família através de realidades paralelas.',
    genres: ['Ficção Científica', 'Drama', 'Mistério'],
    imdbId: 'tt19231492',
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'dark-matter-s1e1',
        number: 1,
        title: 'Você É Feliz na Sua Vida?',
        description: 'Jason é atacado por um estranho mascarado e acorda em um laboratório cercado de pessoas que o tratam como um gênio recluso.',
        image: 'https://images.metahub.space/poster/medium/tt19231492/img'
      }
    ]
  },

  // 26. O DONO DE KINGSTOWN (2021- - tt11712058) — DISPONÍVEL (TVmeter #26)
  {
    id: 'series-mayor-kingstown',
    title: 'O Dono de Kingstown',
    originalTitle: 'Mayor of Kingstown',
    type: ContentType.SERIES,
    rating: 8.2,
    year: 2021,
    image: 'https://images.metahub.space/poster/medium/tt11712058/img',
    backdrop: 'https://images.metahub.space/background/medium/tt11712058/img',
    description: 'A família McLusky comanda os bastidores da cidade de Kingstown, Michigan, onde a única indústria lucrativa é o complexo penitenciário.',
    genres: ['Crime', 'Drama', 'Suspense'],
    imdbId: 'tt11712058',
    seasonsCount: 3,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'kingstown-s1e1',
        number: 1,
        title: 'O Prefeito',
        description: 'Mike McLusky tenta mediar acordos precários entre policiais, guardas e facções criminosas dentro e fora das prisões.',
        image: 'https://images.metahub.space/poster/medium/tt11712058/img'
      }
    ]
  },

  // 29. THE ROOKIE (2018- - tt7587890) — DISPONÍVEL (TVmeter #29)
  {
    id: 'series-the-rookie',
    title: 'The Rookie',
    originalTitle: 'The Rookie',
    type: ContentType.SERIES,
    rating: 8.0,
    year: 2018,
    image: 'https://images.metahub.space/poster/medium/tt7587890/img',
    backdrop: 'https://images.metahub.space/background/medium/tt7587890/img',
    description: 'John Nolan se torna o calouro mais velho da polícia de Los Angeles após um incidente que muda sua vida.',
    genres: ['Crime', 'Drama', 'Ação'],
    imdbId: 'tt7587890',
    seasonsCount: 6,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'rookie-s1e1',
        number: 1,
        title: 'Piloto',
        description: 'Nolan inicia seu primeiro dia como recruta na divisão de patrulha do LAPD.',
        image: 'https://images.metahub.space/poster/medium/tt7587890/img'
      }
    ]
  }
];
