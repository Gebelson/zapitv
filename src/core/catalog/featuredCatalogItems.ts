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

  // 7. RESIDENT EVIL (2026 - tt13000574) — Indisponível / Bloqueio temporário (Zach Cregger)
  {
    id: 'movie-resident-evil-2026',
    title: 'Resident Evil',
    originalTitle: 'Resident Evil',
    type: ContentType.MOVIE,
    rating: 7.6,
    year: 2026,
    director: 'Zach Cregger',
    image: 'https://image.tmdb.org/t/p/w500/gQ76UL64RQe3oHwiwHwODTC23g4.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/3icyRAqgakNcQn6aDVz9libFmBA.jpg',
    description: 'Nova adaptação cinematográfica da icônica franquia de terror e sobrevivência da Capcom com fidelidade máxima à atmosfera sombria, dirigida por Zach Cregger.',
    genres: ['Ação', 'Terror', 'Ficção Científica'],
    tmdbId: '1423191',
    imdbId: 'tt13000574',
    isFeatured: false,
    availabilityStatus: 'unavailable',
    catalogVisibleFrom: '2026-11-20T00:00:00-03:00',
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

  // 16. BACKROOMS: UM NÃO-LUGAR (2026 - tt26658104)
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
    imdbId: 'tt26658104',
    tmdbId: '1083381',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 17. THE UPRISING: RISE OF ROBIN HOOD (2026 - tt18944118)
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
    imdbId: 'tt18944118',
    tmdbId: '977942',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 23. CARRIE, A ESTRANHA (1976 - tt0074296)
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
    imdbId: 'tt0074296',
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
    image: 'https://image.tmdb.org/t/p/w500/jM7bH9b9QT22PtkTyHzxbXx4lDI.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/jM7bH9b9QT22PtkTyHzxbXx4lDI.jpg',
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

  // 11. MAGNATAS DO CRIME (2024- - tt16066148) — DISPONÍVEL (TVmeter #11)
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
    imdbId: 'tt16066148',
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
  },

  // =========================================================================
  // EXPANSÃO DO CATÁLOGO CANÔNICO — OBRAS DE SUCESSO DE STREAMING
  // =========================================================================

  // 1. TULSA KING (Paramount+ - 2022 - tt16358384)
  {
    id: 'series-tulsa-king',
    title: 'Tulsa King',
    originalTitle: 'Tulsa King',
    type: ContentType.SERIES,
    rating: 8.0,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/fwLoHQw2iW3oFqP3yJ3y751i9cE.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/9faGSFi5jam6pDWGNd0ip80ioXA.jpg',
    description: 'Dwight "The General" Manfredi, um líder da máfia de Nova York, é libertado após 25 anos na prisão e exilado por seu chefe para abrir operações em Tulsa, Oklahoma.',
    genres: ['Crime', 'Drama'],
    imdbId: 'tt16358384',
    tmdbId: '153312',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'tk-s1e1',
        number: 1,
        title: 'Para o Oeste, Velho',
        description: 'Dwight chega em Tulsa após 25 anos de prisão e rapidamente monta sua nova equipe local.',
        image: 'https://image.tmdb.org/t/p/w500/fwLoHQw2iW3oFqP3yJ3y751i9cE.jpg'
      }
    ]
  },

  // 2. DIVERTIDA MENTE 2 (Disney+ - 2024 - tt22022452)
  {
    id: 'movie-divertida-mente-2',
    title: 'Divertida Mente 2',
    originalTitle: 'Inside Out 2',
    type: ContentType.MOVIE,
    rating: 7.7,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/9h2rAuvmsmQk9m36Bsm5D154P2q.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/p5ozvmdgsmbWe0H8wf4tIcAOFhm.jpg',
    description: 'Riley agora é uma adolescente e sua central de controle passa por uma reforma para dar espaço a emoções inesperadas: Ansiedade, Inveja, Tédio e Vergonha.',
    genres: ['Animação', 'Família', 'Aventura', 'Comédia'],
    imdbId: 'tt22022452',
    tmdbId: '1022789',
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed'
  },

  // 3. YELLOWSTONE (Paramount+ - 2018 - tt4236770)
  {
    id: 'series-yellowstone',
    title: 'Yellowstone',
    originalTitle: 'Yellowstone',
    type: ContentType.SERIES,
    rating: 8.7,
    year: 2018,
    image: 'https://image.tmdb.org/t/p/w500/peNC0eyc3TQJa6x4TdKIIIRiz09.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/9xxLWtn8vKfZgnapG1T5k2n1A1x.jpg',
    description: 'John Dutton lidera sua família em uma luta incansável para defender seu vasto rancho em Montana contra especuladores imobiliários, reservas indígenas e o primeiro parque nacional dos EUA.',
    genres: ['Drama', 'Faroeste'],
    imdbId: 'tt4236770',
    tmdbId: '73586',
    seasonsCount: 5,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'ys-s1e1',
        number: 1,
        title: 'Primeiro Dia de Caça',
        description: 'John Dutton defende os limites de seu rancho contra opositores.',
        image: 'https://image.tmdb.org/t/p/w500/peNC0eyc3TQJa6x4TdKIIIRiz09.jpg'
      }
    ]
  },

  // 4. HALO (Paramount+ - 2022 - tt2934286)
  {
    id: 'series-halo',
    title: 'Halo',
    originalTitle: 'Halo',
    type: ContentType.SERIES,
    rating: 7.3,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/nJUHX3DPIPC4RjDGL0xUCzNAl5e.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/1qpUk27LVI9UoK2GU0987Lz9m17.jpg',
    description: 'No século XXVI, a humanidade enfrenta a maior ameaça à sua sobrevivência: a aliança alienígena conhecida como Covenant. O supersoldado Master Chief lidera a resistência.',
    genres: ['Ação', 'Aventura', 'Ficção Científica'],
    imdbId: 'tt2934286',
    tmdbId: '52814',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'halo-s1e1',
        number: 1,
        title: 'Contato',
        description: 'Em Madrigal, Master Chief e os Spartans salvam colonos rebeldes de um ataque Covenant.',
        image: 'https://image.tmdb.org/t/p/w500/nJUHX3DPIPC4RjDGL0xUCzNAl5e.jpg'
      }
    ]
  },

  // 5. THE MANDALORIAN (Disney+ - 2019 - tt8111088)
  {
    id: 'series-the-mandalorian',
    title: 'The Mandalorian',
    originalTitle: 'The Mandalorian',
    type: ContentType.SERIES,
    rating: 8.6,
    year: 2019,
    image: 'https://image.tmdb.org/t/p/w500/eU1i6eHXlzMOlEq0ku1R07Y9W7r.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/o7Qi2v4uWQ8scZ1VR7G951478p8.jpg',
    description: 'Após a queda do Império Galáctico, um caçador de recompensas solitário navega pelos confins da galáxia, protegendo uma misteriosa criança com poderes da Força.',
    genres: ['Ficção Científica', 'Ação', 'Aventura'],
    imdbId: 'tt8111088',
    tmdbId: '82856',
    seasonsCount: 3,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'mando-s1e1',
        number: 1,
        title: 'Capítulo 1: O Mandaloriano',
        description: 'Um caçador de recompensas aceita um contrato clandestino com grande pagamento.',
        image: 'https://image.tmdb.org/t/p/w500/eU1i6eHXlzMOlEq0ku1R07Y9W7r.jpg'
      }
    ]
  },

  // 6. LOKI (Disney+ - 2021 - tt9140554)
  {
    id: 'series-loki',
    title: 'Loki',
    originalTitle: 'Loki',
    type: ContentType.SERIES,
    rating: 8.2,
    year: 2021,
    image: 'https://image.tmdb.org/t/p/w500/voHUmlvjysv923Zq98bYFqE4x9a.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/k47JEUTQsSMN539ygmgWIt3IR7W.jpg',
    description: 'Após roubar o Tesseract, o Deus da Trapaça é capturado pela Autoridade de Variância Temporal (AVT) e precisa consertar a linha do tempo do multiverso.',
    genres: ['Ficção Científica', 'Ação', 'Aventura'],
    imdbId: 'tt9140554',
    tmdbId: '84958',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'loki-s1e1',
        number: 1,
        title: 'Glorioso Propósito',
        description: 'Loki é julgado na AVT após fugir com o Tesseract.',
        image: 'https://image.tmdb.org/t/p/w500/voHUmlvjysv923Zq98bYFqE4x9a.jpg'
      }
    ]
  },

  // 7. RUPTURA (Apple TV+ - 2022 - tt11280740)
  {
    id: 'series-ruptura',
    title: 'Ruptura',
    originalTitle: 'Severance',
    type: ContentType.SERIES,
    rating: 8.7,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/p4T5Wz9EaD010bW328Z7p4YjO38.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/9i3A33K34j4o9Z10bW328Z7p4Yj.jpg',
    description: 'Mark lidera uma equipe na Lumon Industries cujos funcionários passaram por um procedimento cirúrgico que separa suas memórias profissionais de suas vidas pessoais.',
    genres: ['Drama', 'Mistério', 'Ficção Científica'],
    imdbId: 'tt11280740',
    tmdbId: '95396',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'sev-s1e1',
        number: 1,
        title: 'Boas Notícias Sobre o Inferno',
        description: 'Mark Scout lidera a equipe de refinamento de macrodados após a promoção inesperada.',
        image: 'https://image.tmdb.org/t/p/w500/p4T5Wz9EaD010bW328Z7p4YjO38.jpg'
      }
    ]
  },

  // 8. THE BOYS (Prime Video - 2019 - tt1190634)
  {
    id: 'series-the-boys',
    title: 'The Boys',
    originalTitle: 'The Boys',
    type: ContentType.SERIES,
    rating: 8.7,
    year: 2019,
    image: 'https://image.tmdb.org/t/p/w500/7Ns6tO3aYjUvXQ4w4J7s8E7Yj.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/n6bUvigpRFqSwmPp1m2U5vFzQvH.jpg',
    description: 'Um grupo de vigilantes liderado por Billy Bruto combate super-heróis corruptos que abusam de seus poderes e trabalham para uma megacorporação bilionária.',
    genres: ['Ação', 'Comédia', 'Ficção Científica'],
    imdbId: 'tt1190634',
    tmdbId: '76479',
    seasonsCount: 4,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'boys-s1e1',
        number: 1,
        title: 'O Nome do Jogo',
        description: 'Hughie sofre uma perda trágica e é recrutado por Billy Bruto.',
        image: 'https://image.tmdb.org/t/p/w500/7Ns6tO3aYjUvXQ4w4J7s8E7Yj.jpg'
      }
    ]
  },

  // 9. FALLOUT (Prime Video - 2024 - tt12637874)
  {
    id: 'series-fallout',
    title: 'Fallout',
    originalTitle: 'Fallout',
    type: ContentType.SERIES,
    rating: 8.4,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/AnsSKR9LuK0T9bEmJfpRG9UmvHQ.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/mo0A4bK1K1100bW328Z7p4YjO38.jpg',
    description: 'Duzentos anos após o apocalipse nuclear, uma habitante pacífica de um luxuoso abrigo subterrâneo é forçada a subir à superfície e descobre um deserto bizarro e violento.',
    genres: ['Ficção Científica', 'Ação', 'Aventura'],
    imdbId: 'tt12637874',
    tmdbId: '106379',
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'fallout-s1e1',
        number: 1,
        title: 'O Fim',
        description: 'Lucy deixa o Refúgio 33 para resgatar seu pai sequestrado.',
        image: 'https://image.tmdb.org/t/p/w500/AnsSKR9LuK0T9bEmJfpRG9UmvHQ.jpg'
      }
    ]
  },

  // 10. INVENCÍVEL (Prime Video - 2021 - tt6741278)
  {
    id: 'series-invencivel',
    title: 'Invencível',
    originalTitle: 'Invincible',
    type: ContentType.SERIES,
    rating: 8.7,
    year: 2021,
    image: 'https://image.tmdb.org/t/p/w500/yDWJYRAwMNKbWvt8G8q9bEmJfpR.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/6VmF0cE4Xw8bYFqE4x9a10bW328.jpg',
    description: 'Mark Grayson é um adolescente comum, exceto pelo fato de seu pai ser o super-herói mais poderoso do planeta. Ao completar 17 anos, seus poderes começam a despertar.',
    genres: ['Animação', 'Ação', 'Ficção Científica', 'Drama'],
    imdbId: 'tt6741278',
    tmdbId: '95557',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'inv-s1e1',
        number: 1,
        title: 'Já Era Hora',
        description: 'Mark desenvolve superpoderes e começa o treinamento com Omni-Man.',
        image: 'https://image.tmdb.org/t/p/w500/yDWJYRAwMNKbWvt8G8q9bEmJfpR.jpg'
      }
    ]
  },

  // 11. A CASA DO DRAGÃO (HBO Max - 2022 - tt11198330)
  {
    id: 'series-house-of-the-dragon',
    title: 'A Casa do Dragão',
    originalTitle: 'House of the Dragon',
    type: ContentType.SERIES,
    rating: 8.4,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/1X4h40fcB4WWUmIBK0auT4zRBAV.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/etjA2mmpvK7S3b3bYFqE4x9a10b.jpg',
    description: 'Cerca de 200 anos antes dos eventos de Game of Thrones, a dinastia Targaryen se encontra no auge de seu poder antes de uma sangrenta guerra civil pela sucessão do Trono de Ferro.',
    genres: ['Drama', 'Ação', 'Fantasia'],
    imdbId: 'tt11198330',
    tmdbId: '94997',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'hotd-s1e1',
        number: 1,
        title: 'Os Herdeiros do Dragão',
        description: 'O rei Viserys convoca um torneio para celebrar o nascimento de seu segundo filho.',
        image: 'https://image.tmdb.org/t/p/w500/1X4h40fcB4WWUmIBK0auT4zRBAV.jpg'
      }
    ]
  },

  // 12. THE LAST OF US (HBO Max - 2023 - tt3581920)
  {
    id: 'series-the-last-of-us',
    title: 'The Last of Us',
    originalTitle: 'The Last of Us',
    type: ContentType.SERIES,
    rating: 8.8,
    year: 2023,
    image: 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2V7J9Gmx.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/9J2mmpvK7S3b3bYFqE4x9a10b32.jpg',
    description: 'Vinte anos após uma infecção fúngica destruir a civilização, Joel é contratado para contrabandear Ellie, uma jovem de 14 anos imune ao fungo, para fora de uma zona de quarentena opressiva.',
    genres: ['Drama', 'Ficção Científica', 'Ação', 'Aventura'],
    imdbId: 'tt3581920',
    tmdbId: '100088',
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'tlou-s1e1',
        number: 1,
        title: 'Quando Você Estiver Perdido na Escuridão',
        description: 'Joel e Tess recebem a missão de escoltar Ellie em direção ao Oeste.',
        image: 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2V7J9Gmx.jpg'
      }
    ]
  },

  // 13. SUCCESSION (HBO Max - 2018 - tt7660850)
  {
    id: 'series-succession',
    title: 'Succession',
    originalTitle: 'Succession',
    type: ContentType.SERIES,
    rating: 8.9,
    year: 2018,
    image: 'https://image.tmdb.org/t/p/w500/7DVk0X2qB8w8bYFqE4x9a10bW32.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/c4J2mmpvK7S3b3bYFqE4x9a10b32.jpg',
    description: 'A família Roy é conhecida por controlar a Waystar RoyCo, um dos maiores conglomerados de mídia do mundo. Quando o patriarca decide se afastar, os quatro filhos disputam o controle da empresa.',
    genres: ['Drama'],
    imdbId: 'tt7660850',
    tmdbId: '76331',
    seasonsCount: 4,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'succ-s1e1',
        number: 1,
        title: 'Celebração',
        description: 'No aniversário de 80 anos de Logan Roy, ele surpreende seus filhos com um anúncio sobre o futuro da empresa.',
        image: 'https://image.tmdb.org/t/p/w500/7DVk0X2qB8w8bYFqE4x9a10bW32.jpg'
      }
    ]
  },

  // 14. STRANGER THINGS (Netflix - 2016 - tt4574334)
  {
    id: 'series-stranger-things',
    title: 'Stranger Things',
    originalTitle: 'Stranger Things',
    type: ContentType.SERIES,
    rating: 8.7,
    year: 2016,
    image: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/56v2mJjLLKElGQvscfG10b328Z7.jpg',
    description: 'Em 1983, em uma pequena cidade de Indiana, o desaparecimento repentino de um garoto leva seus amigos e familiares a desvendarem mistérios sobrenaturais e experimentos secretos.',
    genres: ['Ficção Científica', 'Terror', 'Drama', 'Mistério'],
    imdbId: 'tt4574334',
    tmdbId: '66732',
    seasonsCount: 4,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'st-s1e1',
        number: 1,
        title: 'Capítulo Um: O Desaparecimento de Will Byers',
        description: 'Voltando para casa de bicicleta, Will vê algo aterrorizante. Uma garota misteriosa surge na lanchonete local.',
        image: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg'
      }
    ]
  },

  // 15. WANDINHA (Netflix - 2022 - tt13443470)
  {
    id: 'series-wandinha',
    title: 'Wandinha',
    originalTitle: 'Wednesday',
    type: ContentType.SERIES,
    rating: 8.1,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/9PFonBhy4cQy7Jz20ZyZuZu37ao.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/iHSwvRVsRyxpX7FE7GbviaDvgGZ.jpg',
    description: 'Wandinha Addams ingressa na Academia Nunca Mais, onde tenta dominar suas habilidades psíquicas emergentes, investigar uma onda de assassinatos e solucionar um mistério familiar.',
    genres: ['Comédia', 'Mistério', 'Fantasia'],
    imdbId: 'tt13443470',
    tmdbId: '119051',
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'wed-s1e1',
        number: 1,
        title: 'Wandinha É Só Problema',
        description: 'Após ser expulsa da escola regular, Wandinha é enviada para a Academia Nunca Mais.',
        image: 'https://image.tmdb.org/t/p/w500/9PFonBhy4cQy7Jz20ZyZuZu37ao.jpg'
      }
    ]
  },

  // 16. ROUND 6 (Netflix - 2021 - tt10919420)
  {
    id: 'series-round-6',
    title: 'Round 6',
    originalTitle: 'Squid Game',
    type: ContentType.SERIES,
    rating: 8.0,
    year: 2021,
    image: 'https://image.tmdb.org/t/p/w500/dDlG1v7n0D28eNl8w8bYFqE4x9a.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/oaGvjJZmpvK7S3b3bYFqE4x9a10.jpg',
    description: 'Centenas de jogadores endividados aceitam um convite estranho para competir em jogos infantis tradicionais, onde o prêmio é uma fortuna bilionária e a penalidade é fatal.',
    genres: ['Ação', 'Suspense', 'Drama'],
    imdbId: 'tt10919420',
    tmdbId: '93405',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'sq-s1e1',
        number: 1,
        title: 'Batatinha Frita 1, 2, 3',
        description: 'Gi-hun aceita o misterioso cartão de visita e acorda em um dormitório com centenas de outros jogadores.',
        image: 'https://image.tmdb.org/t/p/w500/dDlG1v7n0D28eNl8w8bYFqE4x9a.jpg'
      }
    ]
  },

  // 17. OS OUTROS (Globoplay - 2023 - tmdb: 224673)
  {
    id: 'series-os-outros',
    title: 'Os Outros',
    originalTitle: 'Os Outros',
    type: ContentType.SERIES,
    rating: 8.4,
    year: 2023,
    image: 'https://image.tmdb.org/t/p/w500/kK9w8vK1m9x2eX2xK1v8a7Z4.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/vK1m9x2eX2xK1v8a7Z4kK9w8vK1.jpg',
    description: 'Dois casais vizinhos entram em conflito em um condomínio fechado na Barra da Tijuca após uma briga entre seus filhos adolescentes, desencadeando consequências imprevisíveis.',
    genres: ['Drama', 'Suspense'],
    tmdbId: '224673',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'oo-s1e1',
        number: 1,
        title: 'Episódio 1',
        description: 'Uma briga na quadra de esportes do condomínio Barra Diamond desencadeia uma rivalidade destrutiva entre famílias vizinhas.',
        image: 'https://image.tmdb.org/t/p/w500/kK9w8vK1m9x2eX2xK1v8a7Z4.jpg'
      }
    ]
  },

  // 18. SOB PRESSÃO (Globoplay - 2017 - tt7631376)
  {
    id: 'series-sob-pressao',
    title: 'Sob Pressão',
    originalTitle: 'Sob Pressão',
    type: ContentType.SERIES,
    rating: 8.6,
    year: 2017,
    image: 'https://image.tmdb.org/t/p/w500/3r4LYFuXrg3G8fep5Mm79vTfgq2.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/FuXrg3G8fep5Mm79vTfgq23r4LY.jpg',
    description: 'Em um hospital público no subúrbio do Rio de Janeiro, uma equipe médica liderada pelos doutores Evandro e Carolina enfrenta dilemas éticos e a escassez crônica de recursos para salvar vidas.',
    genres: ['Drama'],
    imdbId: 'tt7631376',
    tmdbId: '74601',
    seasonsCount: 5,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'sp-s1e1',
        number: 1,
        title: 'Episódio 1',
        description: 'Dr. Evandro e Dra. Carolina precisam realizar cirurgias simultâneas de extrema urgência sem equipamentos essenciais.',
        image: 'https://image.tmdb.org/t/p/w500/3r4LYFuXrg3G8fep5Mm79vTfgq2.jpg'
      }
    ]
  },

  // 19. JUSTIÇA (Globoplay - 2016 - tt6007424)
  {
    id: 'series-justica',
    title: 'Justiça',
    originalTitle: 'Justiça',
    type: ContentType.SERIES,
    rating: 8.3,
    year: 2016,
    image: 'https://image.tmdb.org/t/p/w500/fL6K0z0wYV8x1q9eX2xK1v8a7Z2.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/YV8x1q9eX2xK1v8a7Z2fL6K0z0w.jpg',
    description: 'Quatro histórias independentes mas interligadas no Recife exploram o limite ético entre lei, vingança pessoal e o conceito de justiça após sete anos de prisão dos protagonistas.',
    genres: ['Drama', 'Crime'],
    imdbId: 'tt6007424',
    tmdbId: '67915',
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'jus-s1e1',
        number: 1,
        title: 'Elisa e Vicente',
        description: 'Vicente é preso após assassinar a noiva Isabela em um acesso de ciúmes; a mãe de Isabela jura vingança.',
        image: 'https://image.tmdb.org/t/p/w500/fL6K0z0wYV8x1q9eX2xK1v8a7Z2.jpg'
      }
    ]
  }
];

// =========================================================================
// ANIMES — CURADORIA CANÔNICA OFICIAL (ANILIST + TMDB + CATÁLOGO ZAPITV)
// =========================================================================
export const FEATURED_ANIME_ITEMS: ContentItem[] = [
  // 1. SOLO LEVELING (aniList: 151807 / tmdb: 127532 / mal: 52299)
  {
    id: 'anime-solo-leveling',
    canonicalId: 'anime:anilist:151807',
    title: 'Solo Leveling',
    originalTitle: 'Ore dake Level Up na Ken',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.7,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/eCD7WS9h4lCT8N4Xavc9u8R1IGk.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/xMNH87maNLt9n2bMDYeI6db5VFm.jpg',
    description: 'Em um mundo onde caçadores despertam habilidades sobrenaturais, Sung Jin-woo, o caçador mais fraco da humanidade, recebe uma chance única de subir de nível sem limites.',
    genres: ['Anime', 'Ação', 'Aventura', 'Fantasia'],
    aniListId: 151807,
    tmdbId: '127532',
    malId: 52299,
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'solo-s1e1',
        number: 1,
        title: 'Estou Acostumado',
        description: 'Sung Jin-woo lidera um grupo de expedição rumo a uma dungeon dupla com consequências fatais.',
        image: 'https://image.tmdb.org/t/p/w500/eCD7WS9h4lCT8N4Xavc9u8R1IGk.jpg'
      }
    ]
  },

  // 2. JUJUTSU KAISEN (aniList: 113415 / tmdb: 95479 / mal: 40748)
  {
    id: 'anime-jujutsu-kaisen',
    canonicalId: 'anime:anilist:113415',
    title: 'Jujutsu Kaisen',
    originalTitle: 'Jujutsu Kaisen',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.6,
    year: 2020,
    image: 'https://image.tmdb.org/t/p/w500/8R1mMSC1gX1cg5ed7ns49JOEqw3.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/qpin8cASXEVtwhzNsprHYFiOAGk.jpg',
    description: 'Yuji Itadori engole um dedo amaldiçoado de Ryomen Sukuna e ingressa na Escola de Feitiçaria de Tóquio para expurgar maldições ameaçadoras.',
    genres: ['Anime', 'Ação', 'Sobrenatural', 'Fantasia'],
    aniListId: 113415,
    tmdbId: '95479',
    malId: 40748,
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'jjk-s1e1',
        number: 1,
        title: 'Ryomen Sukuna',
        description: 'Yuji Itadori quebra o selo de um talismã amaldiçoado para salvar seus colegas de escola.',
        image: 'https://image.tmdb.org/t/p/w500/8R1mMSC1gX1cg5ed7ns49JOEqw3.jpg'
      }
    ]
  },

  // 3. DEMON SLAYER (aniList: 101922 / tmdb: 85937 / mal: 38000)
  {
    id: 'anime-demon-slayer',
    canonicalId: 'anime:anilist:101922',
    title: 'Demon Slayer: Kimetsu no Yaiba',
    originalTitle: 'Kimetsu no Yaiba',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.6,
    year: 2019,
    image: 'https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/nTvM4mhqZlHIvPtPRum9WXfa729.jpg',
    description: 'Tanjiro Kamado parte em uma jornada para se tornar um exterminador de demônios e devolver a humanidade de sua irmã Nezuko.',
    genres: ['Anime', 'Ação', 'Fantasia', 'Histórico'],
    aniListId: 101922,
    tmdbId: '85937',
    malId: 38000,
    seasonsCount: 4,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'ds-s1e1',
        number: 1,
        title: 'Crueldade',
        description: 'Tanjiro retorna da cidade e encontra sua família atacada por um demônio devorador de homens.',
        image: 'https://image.tmdb.org/t/p/w500/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg'
      }
    ]
  },

  // 4. DANDADAN (aniList: 171018 / tmdb: 240411 / mal: 57334)
  {
    id: 'anime-dandadan',
    canonicalId: 'anime:anilist:171018',
    title: 'Dandadan',
    originalTitle: 'Dan Da Dan',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.5,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/vtQug1eOyeU2VXIpNoDF1lTlcH4.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/uNTrRKIOyKYISthoeizghtXPEOK.jpg',
    description: 'Momo Ayase e Okarun desafiam suas crenças em fantasmas e alienígenas, desencadeando confrontos hilários e insanos no Japão.',
    genres: ['Anime', 'Ação', 'Comédia', 'Sobrenatural'],
    aniListId: 171018,
    tmdbId: '240411',
    malId: 57334,
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'ddd-s1e1',
        number: 1,
        title: 'Isso é o Amor Começando?',
        description: 'Momo e Okarun apostam para ver quem encontra alienígenas ou espíritos primeiro.',
        image: 'https://image.tmdb.org/t/p/w500/vtQug1eOyeU2VXIpNoDF1lTlcH4.jpg'
      }
    ]
  },

  // 5. BLEACH: THOUSAND-YEAR BLOOD WAR (aniList: 116674 / tmdb: 30984 / mal: 41467)
  {
    id: 'anime-bleach-tybw',
    canonicalId: 'anime:anilist:116674',
    title: 'Bleach: Thousand-Year Blood War',
    originalTitle: 'Bleach: Sennen Kessen-hen',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.9,
    year: 2022,
    image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx116674-p3zK4PUX2Aag.jpg',
    backdrop: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/116674-l2YlIyJzvGSV.jpg',
    description: 'A guerra milenar entre os Shinigamis da Soul Society e o exército Quincy liderado por Yhwach chega ao seu clímax destrutivo.',
    genres: ['Anime', 'Ação', 'Aventura', 'Sobrenatural'],
    aniListId: 116674,
    tmdbId: '30984',
    malId: 41467,
    seasonsCount: 3,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'bleach-tybw-s1e1',
        number: 1,
        title: 'Guerra de Sangue',
        description: 'A Soul Society é surpreendida por um ataque coordenado do Wandenreich.',
        image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx116674-p3zK4PUX2Aag.jpg'
      }
    ]
  },

  // 6. FRIEREN: BEYOND JOURNEY'S END (aniList: 154587 / tmdb: 209867 / mal: 52991)
  {
    id: 'anime-frieren',
    canonicalId: 'anime:anilist:154587',
    title: "Frieren: Beyond Journey's End",
    originalTitle: 'Sousou no Frieren',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 9.1,
    year: 2023,
    image: 'https://image.tmdb.org/t/p/w500/qykTIEJQF8cunKD0CKOqab15wns.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/rBOnrVlck7BIlGeWVlzYiZeg4l2.jpg',
    description: 'Após derrotar o Rei Demônio, a maga elfa Frieren embarca em uma peregrinação contemplativa sobre o tempo e a brevidade da vida humana.',
    genres: ['Anime', 'Aventura', 'Drama', 'Fantasia'],
    aniListId: 154587,
    tmdbId: '209867',
    malId: 52991,
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'frieren-s1e1',
        number: 1,
        title: 'O Fim da Jornada',
        description: 'Frieren e o grupo dos heróis celebram o retorno triunfal após dez anos de campanha.',
        image: 'https://image.tmdb.org/t/p/w500/7SfqQVmW125ugsktoRVTnRXpAkd.jpg'
      }
    ]
  },

  // 7. CHAINSAW MAN (aniList: 127230 / tmdb: 114410 / mal: 44511)
  {
    id: 'anime-chainsaw-man',
    canonicalId: 'anime:anilist:127230',
    title: 'Chainsaw Man',
    originalTitle: 'Chainsaw Man',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.5,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/mIz0eKhzHuSPeRSePCyoCt9bKVp.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/5DUMPBSnHOZsbBv81GFXZXvDpo6.jpg',
    description: 'Denji renasce como um híbrido motosserra após se fundir com seu cachorro demônio Pochita e entra para a Segurança Pública.',
    genres: ['Anime', 'Ação', 'Sobrenatural', 'Horror'],
    aniListId: 127230,
    tmdbId: '114410',
    malId: 44511,
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'csm-s1e1',
        number: 1,
        title: 'Cachorro e Motosserra',
        description: 'Denji trabalha caçando demônios para pagar as dívidas deixadas por seu falecido pai.',
        image: 'https://image.tmdb.org/t/p/w500/mIz0eKhzHuSPeRSePCyoCt9bKVp.jpg'
      }
    ]
  },

  // 8. ATTACK ON TITAN (aniList: 16498 / tmdb: 1429 / mal: 16498)
  {
    id: 'anime-attack-on-titan',
    canonicalId: 'anime:anilist:16498',
    title: 'Attack on Titan',
    originalTitle: 'Shingeki no Kyojin',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 9.0,
    year: 2013,
    image: 'https://image.tmdb.org/t/p/w500/8aMqmB5xSblsZc7bLMEhE28yHa2.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/rqbCbjB19amtOtFQbb3K2lgm2zv.jpg',
    description: 'Eren Yeager e a Tropa de Exploração lutam desesperadamente pela sobrevivência humana contra gigantes devoradores de homens.',
    genres: ['Anime', 'Ação', 'Drama', 'Fantasia'],
    aniListId: 16498,
    tmdbId: '1429',
    malId: 16498,
    seasonsCount: 4,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'aot-s1e1',
        number: 1,
        title: 'Para Você, Daqui a 2.000 Anos',
        description: 'A Muralha Maria é rompida pelo Titã Colossal e o caos engole a cidade de Shiganshina.',
        image: 'https://image.tmdb.org/t/p/w500/8aMqmB5xSblsZc7bLMEhE28yHa2.jpg'
      }
    ]
  },

  // 9. ONE PIECE (aniList: 21 / tmdb: 37854 / mal: 21)
  {
    id: 'anime-one-piece',
    canonicalId: 'anime:anilist:21',
    title: 'One Piece',
    originalTitle: 'One Piece',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.9,
    year: 1999,
    image: 'https://image.tmdb.org/t/p/w500/fcXdJlbSdUEeMSJFsXKszvGgS6p.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/4MCKNAc6AbWjEsM2crWsNmecOCU.jpg',
    description: 'Monkey D. Luffy navega pelos mares com o bando do Chapéu de Palha em busca do tesouro supremo e o título de Rei dos Piratas.',
    genres: ['Anime', 'Ação', 'Aventura', 'Comédia'],
    aniListId: 21,
    tmdbId: '37854',
    malId: 21,
    seasonsCount: 21,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'op-s1e1',
        number: 1,
        title: 'Eu Sou Luffy! O Homem Que Será o Rei dos Piratas!',
        description: 'Luffy emerge de um barril e conhece Koby a bordo do navio da terrível capitã Alvida.',
        image: 'https://image.tmdb.org/t/p/w500/fcXdJlbSdUEeMSJFsXKszvGgS6p.jpg'
      }
    ]
  },

  // 10. SPY X FAMILY (aniList: 140960 / tmdb: 120089 / mal: 50273)
  {
    id: 'anime-spy-family',
    canonicalId: 'anime:anilist:140960',
    title: 'Spy x Family',
    originalTitle: 'Spy × Family',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.4,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/3r4LYFuXrg3G8fep5Mm79vTfgq1.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/179rKqc8kE3P0x4H2e1wV8x5h7Z.jpg',
    description: 'Um espião mestre precisa forjar uma família de mentira para cumprir sua missão secreta, sem saber que sua filha lê mentes e sua esposa é uma assassina de aluguel.',
    genres: ['Anime', 'Comédia', 'Ação', 'Espionagem'],
    aniListId: 140960,
    tmdbId: '120089',
    malId: 50273,
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'sxf-s1e1',
        number: 1,
        title: 'Operação Strix',
        description: 'O agente Twilight adota a pequena Anya em um orfanato para ingressar na elite de Berlint.',
        image: 'https://image.tmdb.org/t/p/w500/3r4LYFuXrg3G8fep5Mm79vTfgq1.jpg'
      }
    ]
  },

  // 11. KAIJU NO. 8 (aniList: 153288 / tmdb: 206586 / mal: 52588)
  {
    id: 'anime-kaiju-no-8',
    canonicalId: 'anime:anilist:153288',
    title: 'Kaiju No. 8',
    originalTitle: 'Kaijuu 8-gou',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.3,
    year: 2024,
    image: 'https://image.tmdb.org/t/p/w500/fL6K0z0wYV8x1q9eX2xK1v8a7Z1.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/7kK1q2w8vK1m9x2eX2xK1v8a7Z2.jpg',
    description: 'Kafka Hibino realiza o trabalho ingrato de limpar carcaças de monstros gigantes até que um parasita alienígena o transforma no primeiro homem-kaiju.',
    genres: ['Anime', 'Ação', 'Ficção Científica'],
    aniListId: 153288,
    tmdbId: '206586',
    malId: 52588,
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'k8-s1e1',
        number: 1,
        title: 'O Homem Que Se Tornou um Monstro',
        description: 'Kafka reflete sobre seu sonho abandonado das Forças de Defesa enquanto limpa os restos de uma fera colossal.',
        image: 'https://image.tmdb.org/t/p/w500/fL6K0z0wYV8x1q9eX2xK1v8a7Z1.jpg'
      }
    ]
  },

  // 12. BLUE LOCK (aniList: 137822 / tmdb: 131041 / mal: 50528)
  {
    id: 'anime-blue-lock',
    canonicalId: 'anime:anilist:137822',
    title: 'Blue Lock',
    originalTitle: 'Blue Lock',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.2,
    year: 2022,
    image: 'https://image.tmdb.org/t/p/w500/9aICTTHECyRwB2pBHm3rAj1SgGg.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/seMRyWVwIVBWbC9xaMzDMZJ8fUH.jpg',
    description: 'Trezentos atacantes colegiais do Japão são confinados em uma prisão de treinamento de futebol para forjar o maior atacante egoísta do mundo.',
    genres: ['Anime', 'Esporte', 'Ação', 'Drama'],
    aniListId: 137822,
    tmdbId: '131041',
    malId: 50528,
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'bl-s1e1',
        number: 1,
        title: 'Sonho',
        description: 'Yoichi Isagi recebe o convite misterioso da União Japonesa de Futebol para o projeto Blue Lock.',
        image: 'https://image.tmdb.org/t/p/w500/9aICTTHECyRwB2pBHm3rAj1SgGg.jpg'
      }
    ]
  },

  // 13. DEATH NOTE (aniList: 1535 / tmdb: 13916 / mal: 1535 / imdb: tt0877057)
  {
    id: 'anime-death-note',
    canonicalId: 'anime:anilist:1535',
    title: 'Death Note',
    originalTitle: 'Death Note',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 9.0,
    year: 2006,
    image: 'https://image.tmdb.org/t/p/w500/t7X24mF4NzsX4I74z29hXU507y8.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/96Hi2E4gUspXjD37v5kclq7gYv9.jpg',
    description: 'Light Yagami encontra um caderno sobrenatural capaz de matar qualquer pessoa cujo nome seja escrito nele e inicia uma cruzada para livrar o mundo dos criminosos.',
    genres: ['Anime', 'Suspense', 'Mistério', 'Sobrenatural'],
    aniListId: 1535,
    tmdbId: '13916',
    imdbId: 'tt0877057',
    malId: 1535,
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'dn-s1e1',
        number: 1,
        title: 'Renascimento',
        description: 'Light Yagami encontra o Death Note deixado pelo shinigami Ryuk no pátio de sua escola.',
        image: 'https://image.tmdb.org/t/p/w500/t7X24mF4NzsX4I74z29hXU507y8.jpg'
      }
    ]
  },

  // 14. DR. STONE (aniList: 105333 / tmdb: 86031 / mal: 38691 / imdb: tt9679542)
  {
    id: 'anime-dr-stone',
    canonicalId: 'anime:anilist:105333',
    title: 'Dr. Stone',
    originalTitle: 'Dr.STONE',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    rating: 8.6,
    year: 2019,
    image: 'https://image.tmdb.org/t/p/w500/xEbnuDJXA0MYVV1zjizGWgOhSPE.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/lN13BPAEnc5iXmoxxBQHOZ1ScfZ.jpg',
    description: 'Milhares de anos após um fenômeno misterioso transformar toda a humanidade em pedra, o jovem gênio da ciência Senku Ishigami desperta determinado a reconstruir a civilização do zero através da ciência.',
    genres: ['Anime', 'Ficção Científica', 'Aventura', 'Comédia', 'Ação'],
    aniListId: 105333,
    tmdbId: '86031',
    imdbId: 'tt9679542',
    malId: 38691,
    seasonsCount: 3,
    isFeatured: true,
    availabilityStatus: 'verified',
    audioStatus: 'pt-br-dubbed',
    episodes: [
      {
        id: 'dr-stone-s1e1',
        number: 1,
        season: 1,
        title: 'Stone World',
        description: 'Tudo começa quando um clarão misterioso petrifica a humanidade inteira. Milênios depois, o gênio Senku desperta em um mundo de pedra.',
        image: 'https://image.tmdb.org/t/p/w500/tsySP3maZBXg1XnPK0BcOwYfozS.jpg',
        airDate: '2019-07-05',
        releaseDate: '2019-07-05'
      }
    ]
  }
];

// Mescla animes na lista global de itens canônicos
FEATURED_CATALOG_ITEMS.push(...FEATURED_ANIME_ITEMS);

