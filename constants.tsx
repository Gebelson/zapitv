import { ContentItem, ContentType, User, Profile } from './types';

export const COLORS = {
  primary: '#007df7',
  darkBg: '#0A0E17',
  darkCard: '#151C26',
  darkSidebar: '#070A0F',
};

/**
 * Avatares Premium ZapiTV
 * Coleção completa de 12 ícones personalizados.
 */
export const AVATARS = [
  'https://i.imgur.com/0KzQwwX.png',
  'https://i.imgur.com/Spw0Cos.png',
  'https://i.imgur.com/6IEApDt.png',
  'https://i.imgur.com/FyLB4ca.png',
  'https://i.imgur.com/bA8ltkk.png',
  'https://i.imgur.com/kimAW6g.png',
  'https://i.imgur.com/sTbJUBM.png',
  'https://i.imgur.com/amtR2VN.png',
  'https://i.imgur.com/10zcAOY.png',
  'https://i.imgur.com/7yXXxXT.png',
  'https://i.imgur.com/XK8zLav.png',
  'https://i.imgur.com/6IYczXJ.png',
];

// Recriando perfis padrão para garantir consistência
const createDefaultProfiles = (name: string): Profile[] => [
  { id: 'p1', name: name.split(' ')[0], avatar: AVATARS[0], isChild: false }
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Gráfica do Futuro',
    email: 'graficadfuturo@gmail.com',
    password: '123',
    role: 'admin',
    devMode: true,
    memberSince: '01/02/2026',
    plan: 'Premium 4K',
    status: 'Ativo',
    profiles: [
      { id: 'p1', name: 'Gráfica', avatar: AVATARS[0], isChild: false },
      { id: 'p2', name: 'Kids', avatar: 'https://i.imgur.com/LSu54L9.png', isChild: true }
    ]
  },
  {
    id: 'u2',
    name: 'Gabriel Nascimento',
    email: 'gbrielcn20@hotmail.com',
    password: '123',
    role: 'user',
    devMode: false,
    memberSince: '10/12/2025',
    plan: 'Premium',
    status: 'Ativo',
    profiles: createDefaultProfiles('Gabriel Nascimento')
  },
  {
    id: 'u3',
    name: 'infoprodutos100k',
    email: 'infoprodutos100k@gmail.com',
    password: '123',
    role: 'user',
    devMode: false,
    memberSince: '15/01/2026',
    plan: 'Padrão',
    status: 'Ativo',
    profiles: createDefaultProfiles('infoprodutos100k')
  },
  {
    id: 'u4',
    name: 'João Silva',
    email: 'joao@example.com',
    password: '123',
    role: 'admin',
    devMode: true,
    memberSince: '05/03/2024',
    plan: 'Básico',
    status: 'Atrasado',
    profiles: createDefaultProfiles('João Silva')
  },
  {
    id: 'u5',
    name: 'Admin User',
    email: 'admin@zapitv.com',
    password: '123',
    role: 'admin',
    devMode: true,
    memberSince: '2023',
    plan: 'Premium 4K',
    status: 'Ativo',
    profiles: [{ id: 'p_admin', name: 'Admin', avatar: AVATARS[5], isChild: false }]
  }
];

export const filmesData: ContentItem[] = [
  {
  "id": "movie-15340724",
  "title": "Garota do Século 20",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.4,
  "image": "https://m.media-amazon.com/images/M/MV5BMjA4NzYxNWItZWJmNi00ODE2LTgwZDgtMzBkN2MzOGZhNDEzXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15340724/img",
  "description": "Em 1999, uma adolescente com um coração de ouro começa a ficar de olho em uma colega de classe popular como um favor à sua melhor amiga apaixonada.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15340724",
  "imdbId": "tt15340724",
  "isFeatured": false,
  "director": "Bang Woo-ri",
  "cast": [
    "Kim Yoo-jung",
    "Byeon Woo-seok",
    "Park Jung-woo"
  ],
  "genres": [
    "Drama",
    "Romance",
    "Dorama"
  ],
  "ageRating": "TV-PG"
},
  {
  "id": "movie-11897478",
  "title": "O Desconhecido",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.6,
  "image": "https://m.media-amazon.com/images/M/MV5BOGRlMWIyODMtNWVhNi00MjgxLWFhOGYtOGVlNjRiNmU0ZWNkXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt11897478/img",
  "description": "Dois homens que se conhecem num ônibus iniciam uma conversa que se transforma em amizade. Para Henry Teague, desgastado por uma vida inteira de trabalho físico e crime, este é um sonho que se torna realidade.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt11897478",
  "imdbId": "tt11897478",
  "isFeatured": false,
  "director": "Thomas M. Wright",
  "cast": [
    "Joel Edgerton",
    "Sean Harris",
    "Jada Alberts"
  ],
  "genres": [
    "Crime",
    "Drama",
    "Suspense"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-1777606",
  "title": "Rosalina",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.5,
  "image": "https://m.media-amazon.com/images/M/MV5BNWFiODU3OGItMzc3Ni00ZDg1LTgwZTktNzJkOGViYjVhY2UxXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt1777606/img",
  "description": "Uma versão cômica de \"Romeu e Julieta\" de Shakespeare, contada do ponto de vista da ex-namorada de Romeu, Rosaline, a mulher que Romeu afirma amar antes de se apaixonar por Julieta.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt1777606",
  "imdbId": "tt1777606",
  "isFeatured": false,
  "director": "Karen Maine",
  "cast": [
    "Kaitlyn Dever",
    "Isabela Merced",
    "Sean Teale"
  ],
  "genres": [
    "Comédia",
    "Romance"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-4595186",
  "title": "Uma Garota de Muita Sorte",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.4,
  "image": "https://m.media-amazon.com/images/M/MV5BYTk0ZDg0YzMtNzYxYS00NTkzLWEyZGItNGMzNTRlZmZiYTEwXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt4595186/img",
  "description": "Uma mulher em Nova York, que parece ter as coisas sob controle, se depara com um trauma que faz sua vida desmoronar.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt4595186",
  "imdbId": "tt4595186",
  "isFeatured": false,
  "director": "Mike Barker",
  "cast": [
    "Mila Kunis",
    "Chiara Aurelia",
    "Finn Wittrock"
  ],
  "genres": [
    "Drama",
    "Mistério",
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-13635702",
  "title": "Aquele que Habita em Mim",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.4,
  "image": "https://m.media-amazon.com/images/M/MV5BYWYxNjU5Y2ItN2ZjMi00NTM1LTlkOWUtZjc2OGRjYmI4OTdjXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt13635702/img",
  "description": "Uma série de eventos sobrenaturais revela uma verdade sombria por trás de um adolescente atormentado.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt13635702",
  "imdbId": "tt13635702",
  "isFeatured": false,
  "director": "Jerren Lauder",
  "cast": [
    "Odessa A'zion",
    "Leslie Bibb",
    "Dermot Mulroney"
  ],
  "genres": [
    "Terror",
    "Suspense"
  ]
},
  {
  "id": "movie-13456976",
  "title": "O Homem da Cabana",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.9,
  "image": "https://m.media-amazon.com/images/M/MV5BNTk3NmUyZWQtZDZjMS00YTE5LWE4YTMtMmIwODhhNjUyNzRjXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt13456976/img",
  "description": "Quando um caminhante perdido se depara com um velho errante que vive na floresta, ele nunca poderia ter imaginado o pesadelo que o aguarda.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt13456976",
  "imdbId": "tt13456976",
  "isFeatured": false,
  "director": "Lucky McKee",
  "cast": [
    "Stephen Lang",
    "Marc Senter",
    "Patch Darragh"
  ],
  "genres": [
    "Suspense"
  ]
},
  {
  "id": "movie-10558652",
  "title": "O Palestrante",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.7,
  "image": "https://m.media-amazon.com/images/M/MV5BMTdmYjhmMjItOWVkMC00MThkLTgzOTQtMWM5Yzc5ZjIzNDFlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10558652/img",
  "description": "Tocado pela falta de perspectiva em sua vida, o contador Guilherme assume o lugar de Marcelo sem nem saber que o verdadeiro Marcelo é um palestrante motivacional.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10558652",
  "imdbId": "tt10558652",
  "isFeatured": false,
  "director": "Marcelo Antunez",
  "cast": [
    "Fábio Porchat",
    "Dani Calabresa",
    "Saulo Arcoverde"
  ],
  "genres": [
    "Comédia",
    "Romance"
  ]
},
  {
  "id": "movie-8363392",
  "title": "Blackout",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 3.9,
  "image": "https://m.media-amazon.com/images/M/MV5BZWM3OTk2NmYtOTNiNy00NWZjLTg1M2UtOWM5Y2RmMjc4NWVjXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt8363392/img",
  "description": "Um homem acorda em um hospital sem memória e rapidamente se vê fugindo em um hospital fechado com o Cartel em seu encalço. Ele luta para encontrar sua verdadeira identidade da maneira mais cruel.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt8363392",
  "imdbId": "tt8363392",
  "isFeatured": false,
  "director": "Sam Macaroni",
  "cast": [
    "Josh Duhamel",
    "Abbie Cornish",
    "Omar Chaparro"
  ],
  "genres": [
    "Ação",
    "Crime",
    "Suspense"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-10304142",
  "title": "Amsterdam",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.1,
  "image": "https://m.media-amazon.com/images/M/MV5BNzgxNTQzYTEtMDI3Yi00OGQ1LWFkNGMtZDEyM2JlYmE0YzUyXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10304142/img",
  "description": "Na década de 1930, três amigos testemunham um assassinato, são incriminados e descobrem uma das conspirações mais ultrajantes da história americana.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10304142",
  "imdbId": "tt10304142",
  "isFeatured": false,
  "director": "David O. Russell",
  "cast": [
    "Christian Bale",
    "Margot Robbie",
    "John David Washington"
  ],
  "genres": [
    "Comédia",
    "Drama",
    "História"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-11128440",
  "title": "O Balconista 3",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.2,
  "image": "https://m.media-amazon.com/images/M/MV5BNmYzNzg5NzUtNzIzMy00MjEwLTk5OGItNmUxNGE4NGVhMmEwXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt11128440/img",
  "description": "Dante, Elias, Jay e Silent Bob são recrutados por Randal após um ataque cardíaco para fazer um filme sobre a loja de conveniência que deu início a tudo.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt11128440",
  "imdbId": "tt11128440",
  "isFeatured": false,
  "director": "Kevin Smith",
  "cast": [
    "Brian O'Halloran",
    "Jeff Anderson",
    "Vincent Pereira"
  ],
  "genres": [
    "Comédia",
    "Drama"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-9731598",
  "title": "Mais que Amigos",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.4,
  "image": "https://m.media-amazon.com/images/M/MV5BN2UxNGVkNDctMTdkZi00NzgyLWJiZjQtMGY1MWUwNTQ1MTY2XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt9731598/img",
  "description": "Dois homens com problemas de compromisso tentam um relacionamento.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt9731598",
  "imdbId": "tt9731598",
  "isFeatured": false,
  "director": "Nicholas Stoller",
  "cast": [
    "Billy Eichner",
    "Luke Macfarlane",
    "Guy Branum"
  ],
  "genres": [
    "Comédia",
    "Romance"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-10354106",
  "title": "Stars at Noon",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.5,
  "image": "https://m.media-amazon.com/images/M/MV5BOTZmNmY5ZjgtNzU3OC00ZjkwLWFlZWMtN2Q1MjQ4MTg1ZTAyXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10354106/img",
  "description": "Uma jovem jornalista americana presa na atual Nicarágua se apaixona por um enigmático inglês que parece ser sua melhor chance de fuga. Ela logo percebe, porém, que ele pode estar em perigo ainda maior do que ela.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10354106",
  "imdbId": "tt10354106",
  "isFeatured": false,
  "director": "Claire Denis",
  "cast": [
    "Margaret Qualley",
    "Joe Alwyn",
    "Benny Safdie"
  ],
  "genres": [
    "Drama",
    "Romance",
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-0887261",
  "title": "Hellraiser: Renascido do Inferno",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.9,
  "image": "https://m.media-amazon.com/images/M/MV5BNWZkZTU0YzItM2YyZi00NzdiLWEwYWMtZjJhMTFjYmVmYWE1XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt0887261/img",
  "description": "Uma jovem que luta contra o vício adquire uma antiga caixa de quebra-cabeça, sem saber que seu objetivo é convocar os Cenobitas.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt0887261",
  "imdbId": "tt0887261",
  "isFeatured": false,
  "director": "David Bruckner",
  "cast": [
    "Odessa A'zion",
    "Jamie Clayton",
    "Adam Faison"
  ],
  "genres": [
    "Terror",
    "Mistério",
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-17202326",
  "title": "A Matriarca",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.6,
  "image": "https://m.media-amazon.com/images/M/MV5BZTFkMjFlYzQtNTBhYi00Y2I1LWFjZWQtYmY4ZjQ5YzE3NWVlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt17202326/img",
  "description": "Atormentada por uma doença misteriosa após sobreviver a uma overdose, uma mulher retorna à casa de sua infância para enfrentar seus demônios pessoais, mas em vez disso descobre um verdadeiro.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt17202326",
  "imdbId": "tt17202326",
  "isFeatured": false,
  "director": "Ben Steiner",
  "cast": [
    "Jemima Rooper",
    "Kate Dickie",
    "Sarah Paul"
  ],
  "genres": [
    "Terror"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-22091698",
  "title": "Esposa de Aluguel",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.7,
  "image": "https://m.media-amazon.com/images/M/MV5BN2FmNjg5ZTYtOTU2YS00MWMzLThkZmYtMmJjYjA3M2Q4NTU2XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt22091698/img",
  "description": "Um solteiro teimoso contrata uma atriz para interpretar sua noiva e cumprir o último desejo de sua mãe moribunda e tenta evitar que ela o exclua de seu testamento.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt22091698",
  "imdbId": "tt22091698",
  "isFeatured": false,
  "director": "Cris D'Amato",
  "cast": [
    "Caio Castro",
    "Thati Lopes",
    "Mariana Xavier"
  ],
  "genres": [
    "Comédia",
    "Romance"
  ],
  "ageRating": "TV-14"
},
  {
  "id": "movie-21837726",
  "title": "O Time da Redenção",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.4,
  "image": "https://m.media-amazon.com/images/M/MV5BYTc0YWUwNWItYzA4OC00Mzk5LTk3ZDQtOGYxM2M5NmE4YWViXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt21837726/img",
  "description": "Segue a história da equipe olímpica de basquete masculino dos EUA em 2008 e como \"The Redeem Team\" estabeleceu um novo padrão para o basquete americano.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt21837726",
  "imdbId": "tt21837726",
  "isFeatured": false,
  "director": "Jon Weinbach",
  "cast": [
    "LeBron James",
    "Dwyane Wade",
    "Carmelo Anthony"
  ],
  "genres": [
    "Documentário",
    "História",
    "Esporte"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-16027944",
  "title": "Depois do Universo",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.6,
  "image": "https://m.media-amazon.com/images/M/MV5BYzQzM2IwOGYtOWE0NC00MzA5LWEzMjAtMmUzMjk2ZTZhOWZiXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt16027944/img",
  "description": "Segue Nina, uma talentosa pianista que tem lúpus. Ela cria uma ligação inesperada, mas forte, com Gabriel, um dos médicos da equipe que cuida dela e lhe dá confiança para tocar com uma grande orquestra em São Paulo.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt16027944",
  "imdbId": "tt16027944",
  "isFeatured": false,
  "director": "Diego Freitas",
  "cast": [
    "Henrique Zaga",
    "Ashleigh Morghan",
    "João Miguel"
  ],
  "genres": [
    "Comédia",
    "Drama",
    "Romance"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-12683756",
  "title": "Jaula",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.1,
  "image": "https://m.media-amazon.com/images/M/MV5BNzM0YWVmOGQtMzRhMy00MThmLTgzMmMtZDA0YTcyY2Q2YjdiXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt12683756/img",
  "description": "Um casal adota temporariamente uma jovem que encontraram vagando sozinha na estrada.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt12683756",
  "imdbId": "tt12683756",
  "isFeatured": false,
  "director": "Ignacio Tatay",
  "cast": [
    "Elena Anaya",
    "Pablo Molinero",
    "Eva Tennear"
  ],
  "genres": [
    "Terror",
    "Mistério",
    "Suspense"
  ]
},
  {
  "id": "movie-18082758",
  "title": "Hackers no Controle",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.3,
  "image": "https://m.media-amazon.com/images/M/MV5BNDNmZDFjZTktNTE2NC00Yzc1LTgzNDUtYWJhM2U3NzQxMjY5XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt18082758/img",
  "description": "Acusada de assassinato após descobrir um escândalo de privacidade, uma hacker ética deve fugir da polícia enquanto tenta rastrear os criminosos que a chantageiam.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt18082758",
  "imdbId": "tt18082758",
  "isFeatured": false,
  "director": "Annemarie van de Mond",
  "cast": [
    "Holly Mae Brood",
    "Géza Weisz",
    "Frank Lammers"
  ],
  "genres": [
    "Ação",
    "Crime",
    "Suspense"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-14030846",
  "title": "Os Céus do Norte sobre o Vazio",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.5,
  "image": "https://m.media-amazon.com/images/M/MV5BM2E5OTk2ZjAtMzIzOC00NGFiLThlMjctZWE2MzRmMzlmODYzXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14030846/img",
  "description": "Don Reynaldo (Gerardo Trejoluna) é um famoso caçador em declínio. Quando seu rancho e o legado de seu pai forem ameaçados, a dinâmica de seu relacionamento com sua família, seus empregados e suas terras será perigosamente abalada.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14030846",
  "imdbId": "tt14030846",
  "isFeatured": false,
  "director": "Alejandra Márquez Abella",
  "cast": [
    "Gerardo Trejoluna",
    "Paloma Petra",
    "Dolores Heredia"
  ],
  "genres": [
    "Crime"
  ]
},
  {
  "id": "movie-15837458",
  "title": "No Lugar Errado",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 3.5,
  "image": "https://m.media-amazon.com/images/M/MV5BMjg5MThiMzMtZGFhYS00ZjhjLTljODItNDIwODE3NjBmZTk5XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15837458/img",
  "description": "Um cozinheiro de metanfetaminas persegue o ex-chefe de polícia de uma pequena cidade para silenciá-lo antes que ele possa prestar depoimento contra sua família, mas acaba enfrentando mais do que esperava.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15837458",
  "imdbId": "tt15837458",
  "isFeatured": false,
  "director": "Mike Burns",
  "cast": [
    "Ashley Greene",
    "Bruce Willis",
    "Michael Sirow"
  ],
  "genres": [
    "Ação",
    "Crime",
    "Suspense"
  ]
},
  {
  "id": "movie-15791034",
  "title": "Noites Brutais",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7,
  "image": "https://m.media-amazon.com/images/M/MV5BNWQ5MDgwMzMtNWZhMy00Y2Q4LWI5NTAtODA4MDIzYTExOGQzXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15791034/img",
  "description": "Uma mulher hospedada num Airbnb descobre que a casa que alugou não é o que parece.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15791034",
  "imdbId": "tt15791034",
  "isFeatured": false,
  "director": "Zach Cregger",
  "cast": [
    "Georgina Campbell",
    "Bill Skarsgård",
    "Justin Long"
  ],
  "genres": [
    "Terror",
    "Mistério",
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-17003896",
  "title": "A Jaula",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.2,
  "image": "https://m.media-amazon.com/images/M/MV5BMDI3NzYwZWEtODg3ZS00MDA2LWIxYjUtNjYxY2Q1NDJlOTZjXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt17003896/img",
  "description": "Um criminoso tenta roubar um carro e acaba preso pelo proprietário, que planeja fazer justiça com as próprias mãos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt17003896",
  "imdbId": "tt17003896",
  "isFeatured": false,
  "director": "João Wainer",
  "cast": [
    "Chay Suede",
    "Alexandre Nero",
    "Mariana Lima"
  ],
  "genres": [
    "Crime",
    "Suspense"
  ]
},
  {
  "id": "movie-14270848",
  "title": "Roubando Mussolini",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.4,
  "image": "https://m.media-amazon.com/images/M/MV5BMzczOTI1OTItYzAwNS00MDVhLWIwMzMtODE3MWEwMjJmODZlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14270848/img",
  "description": "Um empresário milanês do tempo da guerra forma um bando de desajustados e bandidos para encenar um elaborado roubo de um tesouro lendário pertencente a Benito Mussolini.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14270848",
  "imdbId": "tt14270848",
  "isFeatured": false,
  "director": "Renato De Maria",
  "cast": [
    "Pietro Castellitto",
    "Matilda De Angelis",
    "Tommaso Ragno"
  ],
  "genres": [
    "Ação",
    "Comédia",
    "Crime"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-15078804",
  "title": "Problemista",
  "year": 2024,
  "type": ContentType.MOVIE,
  "rating": 6.7,
  "image": "https://m.media-amazon.com/images/M/MV5BNjNlNzBlN2EtZDhhNC00ZDg0LTljODgtMTAzNDI2MTRmMjZjXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15078804/img",
  "description": "Alejandro é um aspirante a designer de brinquedos de El Salvador que luta para dar vida às suas ideias incomuns em Nova York. À medida que o tempo do seu visto de trabalho se esgota, um emprego como ajudante de um errante pária do mundo da arte torna-se a sua única esperança de permanecer no país.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15078804",
  "imdbId": "tt15078804",
  "isFeatured": false,
  "director": "Julio Torres",
  "cast": [
    "Julio Torres",
    "Tilda Swinton",
    "RZA"
  ],
  "genres": [
    "Comédia"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-14641788",
  "title": "Enola Holmes 2",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.8,
  "image": "https://m.media-amazon.com/images/M/MV5BZjRjZjZhNzUtMDQyMC00OWZmLWIzMjQtZDM2OWRhNzgwOGU2XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14641788/img",
  "description": "Agora uma detetive de aluguel, Enola Holmes assume seu primeiro caso oficial para encontrar uma garota desaparecida enquanto as faíscas de uma conspiração perigosa acendem um mistério que requer a ajuda de amigos - e do próprio Sherlock - para ser desvendado.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14641788",
  "imdbId": "tt14641788",
  "isFeatured": false,
  "director": "Harry Bradbeer",
  "cast": [
    "Millie Bobby Brown",
    "Henry Cavill",
    "David Thewlis"
  ],
  "genres": [
    "Ação",
    "Aventura",
    "Crime"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-2184390",
  "title": "Um Rio Muito Frio",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.2,
  "image": "https://m.media-amazon.com/images/M/MV5BNDE0OWQ1YTctYTNlNy00ZjA0LTljZWItZDlmY2Y0OWY5YzBiXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt2184390/img",
  "description": "A pesquisa de um documentarista sobre o misterioso benfeitor de uma cidade revela um mal inexplicável enquanto está hospedado em um resort local.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt2184390",
  "imdbId": "tt2184390",
  "isFeatured": false,
  "director": "Paul Shoulberg",
  "cast": [
    "Ruth Kaufman",
    "Bill Simmons",
    "Bethany Joy Lenz"
  ],
  "genres": [
    "Drama",
    "Terror",
    "Mistério"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-14109724",
  "title": "Ingresso Para o Paraíso",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.1,
  "image": "https://m.media-amazon.com/images/M/MV5BNmQwNDg4Y2EtZjc4OS00NDY0LTk1NGMtZTEyOTAxMWQ3NWQ5XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14109724/img",
  "description": "Um casal divorciado se une e viaja para Bali para impedir que sua filha cometa o mesmo erro que eles acham que cometeram há 25 anos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14109724",
  "imdbId": "tt14109724",
  "isFeatured": false,
  "director": "Ol Parker",
  "cast": [
    "George Clooney",
    "Sean Lynch",
    "Julia Roberts"
  ],
  "genres": [
    "Comédia",
    "Drama",
    "Romance"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-13640696",
  "title": "Veja Como Eles Correm",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.5,
  "image": "https://m.media-amazon.com/images/M/MV5BMGNiNDNlNjQtMGEzMC00NmNjLWJhYWYtODBhNjQ3Mjc2YjZmXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt13640696/img",
  "description": "No West End de Londres dos anos 1950, os planos para uma versão cinematográfica de uma peça de grande sucesso são interrompidos abruptamente depois que um membro importante da equipe é assassinado.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt13640696",
  "imdbId": "tt13640696",
  "isFeatured": false,
  "director": "Tom George",
  "cast": [
    "Kieran Hodgson",
    "Pearl Chanda",
    "Gregory Cox"
  ],
  "genres": [
    "Comédia",
    "Crime",
    "Mistério"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-15301048",
  "title": "Argentina 1985",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.6,
  "image": "https://m.media-amazon.com/images/M/MV5BMGQxYTQyNDUtNmZkMi00MzQ4LWFhMTktNTYzOGQ1ZGMzYjQ2XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15301048/img",
  "description": "Uma equipe de advogados enfrenta os chefes da sangrenta ditadura militar argentina durante a década de 1980, em uma batalha contra as adversidades e uma corrida contra o tempo.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15301048",
  "imdbId": "tt15301048",
  "isFeatured": false,
  "director": "Santiago Mitre",
  "cast": [
    "Ricardo Darín",
    "Gina Mastronicola",
    "Francisco Bertín"
  ],
  "genres": [
    "Biografia",
    "Crime",
    "Drama"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-11807888",
  "title": "A Avó",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.9,
  "image": "https://m.media-amazon.com/images/M/MV5BODlmNjQzNDItMmNlNS00MTE1LWIwNzUtZTY3ZGYyYjRmN2IyXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt11807888/img",
  "description": "Uma modelo parisiense deve regressar a Madrid, onde a sua avó, que a criou, acabou de sofrer um acidente vascular cerebral. Mas passar apenas alguns dias com esse parente se transforma em um pesadelo inesperado.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt11807888",
  "imdbId": "tt11807888",
  "isFeatured": false,
  "director": "Paco Plaza",
  "cast": [
    "Almudena Amor",
    "Vera Valdez",
    "Karina Kolokolchykova"
  ],
  "genres": [
    "Terror"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-10731256",
  "title": "Não Se Preocupe, Querida",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.3,
  "image": "https://m.media-amazon.com/images/M/MV5BY2I0ZDExM2EtZTQ4OC00NGQ0LWIzYjktYWE4MDMxZDZlY2MwXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10731256/img",
  "description": "Enquanto seu marido sai de casa todos os dias para trabalhar em uma instalação ultrassecreta, uma jovem dona de casa dos anos 1950 começa a questionar sua vida ao notar um comportamento estranho das outras esposas da vizinhança.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10731256",
  "imdbId": "tt10731256",
  "isFeatured": false,
  "director": "Olivia Wilde",
  "cast": [
    "Florence Pugh",
    "Harry Styles",
    "Chris Pine"
  ],
  "genres": [
    "Drama",
    "Mistério",
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-9225812",
  "title": "A Viagem de Pedro",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.5,
  "image": "https://m.media-amazon.com/images/M/MV5BMTI0NzllMzktZTk1NC00NDY5LWE4ODMtYjhjNTNmNzYzZjdhXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt9225812/img",
  "description": "Um olhar intimista sobre a vida de Dom Pedro I e os acontecimentos históricos que giram em torno do príncipe, antecipando um momento decisivo em sua trajetória. Em 1831, o primeiro Imperador do Brasil retornou à Europa sob condições adversas...",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt9225812",
  "imdbId": "tt9225812",
  "isFeatured": false,
  "director": "Laís Bodanzky",
  "cast": [
    "Cauã Reymond",
    "Luise Heyer",
    "Isabél Zuaa"
  ],
  "genres": [
    "Biografia",
    "Drama"
  ]
},
  {
  "id": "movie-5181830",
  "title": "Wendell & Wild",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.4,
  "image": "https://m.media-amazon.com/images/M/MV5BYWQ2NmZjMWYtYmY5Ni00ZmM4LWFkMzEtMWM0MjI0OTE3N2Y1XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt5181830/img",
  "description": "Dois irmãos demônios intrigantes, Wendell e Wild, recrutam a ajuda de Kat Elliot, de 13 anos, para convocá-los para a Terra dos Vivos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt5181830",
  "imdbId": "tt5181830",
  "isFeatured": false,
  "director": "Henry Selick",
  "cast": [
    "Lyric Ross",
    "Keegan-Michael Key",
    "Jordan Peele"
  ],
  "genres": [
    "Animação",
    "Aventura",
    "Comédia"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-1016150",
  "title": "Nada de Novo no Front",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.8,
  "image": "https://m.media-amazon.com/images/M/MV5BOWJiYWMyYTktZThhOS00ZjgxLWE0YTQtZDMyNTQxMjMyYjI2XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt1016150/img",
  "description": "A vontade de um jovem soldado alemão de servir o seu país desaparece rapidamente quando ele testemunha os horrores do combate na Frente Ocidental durante a Primeira Guerra Mundial.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt1016150",
  "imdbId": "tt1016150",
  "isFeatured": false,
  "director": "Edward Berger",
  "cast": [
    "Felix Kammerer",
    "Albrecht Schuch",
    "Aaron Hilmer"
  ],
  "genres": [
    "Drama",
    "História",
    "Guerra"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-4788734",
  "title": "A Madrasta",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.3,
  "image": "https://m.media-amazon.com/images/M/MV5BNzU4YzhlOTUtZjMyZC00MTYzLTgzNDAtZmNjZmNjNDY1YmMyXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt4788734/img",
  "description": "Uma viagem ao campo acaba ficando longe de ser idílica para um pai e sua nova noiva quando seus filhos decidem que a casa está um pouco lotada.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt4788734",
  "imdbId": "tt4788734",
  "isFeatured": false,
  "director": "Sebastian Godwin",
  "cast": [
    "Aisling Loftus",
    "Tom Goodman-Hill",
    "Raffiella Chapman"
  ],
  "genres": [
    "Drama",
    "Terror",
    "Mistério"
  ]
},
  {
  "id": "movie-12390572",
  "title": "Gêmeo Maligno",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.1,
  "image": "https://m.media-amazon.com/images/M/MV5BZGY1NjZlOWItNjE2NS00MWNhLTg5ZjktYzUzNjg0NzZkZjgxXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt12390572/img",
  "description": "Uma mãe tem que enfrentar a verdade insuportável sobre seu filho gêmeo sobrevivente.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt12390572",
  "imdbId": "tt12390572",
  "isFeatured": false,
  "director": "Taneli Mustonen",
  "cast": [
    "Teresa Palmer",
    "Steven Cree",
    "Barbara Marten"
  ],
  "genres": [
    "Drama",
    "Terror",
    "Mistério"
  ]
},
  {
  "id": "movie-6443346",
  "title": "Adão Negro",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.1,
  "image": "https://m.media-amazon.com/images/M/MV5BYmM3OTM4NDktMmI2NS00OWU0LTg4OTQtNjZhMmFkYjhmOGY1XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt6443346/img",
  "description": "Quase 5.000 anos depois de ter sido agraciado com os poderes onipotentes dos deuses egípcios – e aprisionado com a mesma rapidez – Adão Negro é libertado de sua tumba terrestre, pronto para liberar sua forma única de justiça no mundo moderno.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt6443346",
  "imdbId": "tt6443346",
  "isFeatured": false,
  "director": "Jaume Collet-Serra",
  "cast": [
    "Dwayne Johnson",
    "Aldis Hodge",
    "Pierce Brosnan"
  ],
  "genres": [
    "Ação",
    "Aventura",
    "Fantasia"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-18224682",
  "title": "Roubo Cibernético: Bilhões em Bitcoins",
  "year": 2024,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BZTI2ODcyYmYtMTdlYS00NTIxLWI0NmUtMTQ2ZjQ1YjU2MjdiXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt18224682/img",
  "description": "Morgan, uma rapper hipster também conhecida como Razzlekhan e colaboradora da Forbes, e seu marido Lichtenstein foram presos após serem acusados ​​de conspirar para lavar quase 120.000 Bitcoins.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt18224682",
  "imdbId": "tt18224682",
  "isFeatured": false,
  "director": "Chris Smith",
  "cast": [
    "Heather Morgan",
    "Ilya Lichtenstein",
    "Chris Janczewski"
  ],
  "genres": [
    "Documentário",
    "Biografia",
    "Crime"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-32084246",
  "title": "Virgem Maria",
  "year": 2024,
  "type": ContentType.MOVIE,
  "rating": 5.2,
  "image": "https://m.media-amazon.com/images/M/MV5BMDM5YWJlNjgtYzUyNy00MTc4LWFkZTAtMTdlNDM2MDcwYTcyXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt32084246/img",
  "description": "Nesta história atemporal de maioridade, Maria é rejeitada após uma concepção sobrenatural e forçada a fugir quando a sede insaciável de Herodes por poder desencadeia uma perseguição assassina pelo recém-nascido.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt32084246",
  "imdbId": "tt32084246",
  "isFeatured": false,
  "director": "D.J. Caruso",
  "cast": [
    "Noa Cohen",
    "Ido Tako",
    "Ori Pfeffer"
  ],
  "genres": [
    "Drama"
  ],
  "ageRating": "TV-14"
},
  {
  "id": "movie-29368988",
  "title": "Acampamento com a Mamãe",
  "year": 2024,
  "type": ContentType.MOVIE,
  "rating": 5.5,
  "image": "https://m.media-amazon.com/images/M/MV5BZDRiNjc0MDItMzIwMy00MzkzLWJkNWUtM2VkYTFlYjIzYTM5XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt29368988/img",
  "description": "Patri, uma mãe autoritária, luta para se relacionar com o filho adolescente que quer morar com o pai. Para mantê-lo em casa, ela se oferece para levá-lo e amigos para um acampamento, disputando seu carinho durante a viagem.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt29368988",
  "imdbId": "tt29368988",
  "isFeatured": false,
  "director": "Martino Zaidelis",
  "cast": [
    "Natalia Oreiro",
    "Milo Lis",
    "Pablo Rago"
  ],
  "genres": [
    "Comédia"
  ]
},
  {
  "id": "movie-17371682",
  "title": "Nossa Mãe é Para Sempre",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BNzEwNmFmNWYtYTM5YS00Y2Q4LWJlN2UtYzg5ZjZlNjQxZTEwXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt17371682/img",
  "description": "No Dia Santo das Mortes, uma mãe retorna e descobre que seus três filhos são desconsiderados, feios e preguiçosos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt17371682",
  "imdbId": "tt17371682",
  "isFeatured": false,
  "director": "Noé Santillán-López",
  "cast": [
    "Carmen Beato",
    "José Eduardo Derbez",
    "Gustavo Egelhaaf"
  ],
  "genres": [
    "Comédia"
  ]
},
  {
  "id": "movie-22437050",
  "title": "Vento Selvagem",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.6,
  "image": "https://m.media-amazon.com/images/M/MV5BYmIzNmZkMTktMGFmNC00NDU2LWE2MjItN2ExMzJkMDJlZThlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt22437050/img",
  "description": "As tensões raciais e a corrupção chegam ao auge em uma cidade pequena e segregada depois que a polícia encontra o corpo de uma jovem africânder no mato.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt22437050",
  "imdbId": "tt22437050",
  "isFeatured": false,
  "director": "Fabian Medea",
  "cast": [
    "Mothusi Magano",
    "Frank Rautenbach",
    "Chris Chameleon"
  ],
  "genres": [
    "Crime",
    "Drama"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-19724142",
  "title": "O Monastério",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.8,
  "image": "https://m.media-amazon.com/images/M/MV5BMGJkZmY0NmItODk4Yy00NjkzLWJmOGUtMGM1NzRhYmRhZjM0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt19724142/img",
  "description": "Na Polônia de 1987, um policial que investiga desaparecimentos misteriosos se infiltra em um mosteiro remoto e descobre uma verdade sombria sobre seu clero.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt19724142",
  "imdbId": "tt19724142",
  "isFeatured": false,
  "director": "Bartosz M. Kowalski",
  "cast": [
    "Piotr Zurawski",
    "Olaf Lubaszenko",
    "Sebastian Stankiewicz"
  ],
  "genres": [
    "Terror",
    "Mistério"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-22227936",
  "title": "Quatro Gerações",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.1,
  "image": "https://m.media-amazon.com/images/M/MV5BMjg0NjY1YzgtNTc2NS00MzY4LTgzNzktNDg1MWE4NzA4ZDExXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt22227936/img",
  "description": "Uma família migra para a cidade após uma perda trágica. Quando eles se reencontram em sua cidade natal, 30 anos depois, emoções enterradas e segredos dolorosos ressurgem.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt22227936",
  "imdbId": "tt22227936",
  "isFeatured": false,
  "director": "Berkun Oya",
  "cast": [
    "Ayça Bingöl",
    "Fatih Artman",
    "Funda Eryigit"
  ],
  "genres": [
    "Drama"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-12444934",
  "title": "Oficina do Diabo",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 3.8,
  "image": "https://m.media-amazon.com/images/M/MV5BYjEwOTg3OTktMWI0OC00ODgxLWE3MTYtMjYyODdjOWM1MmU0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt12444934/img",
  "description": "Um ator em dificuldades, desesperado para reviver sua carreira, passa um fim de semana com um demonologista sedutor para se preparar para um teste.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt12444934",
  "imdbId": "tt12444934",
  "isFeatured": false,
  "director": "Chris von Hoffmann",
  "cast": [
    "Radha Mitchell",
    "Timothy Granaderos",
    "Emile Hirsch"
  ],
  "genres": [
    "Drama",
    "Terror"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-19408390",
  "title": "Acampamento Intergaláctico",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BNTljNTllMzItMTEyYS00ZjM4LTg1MmYtYjE3Mjk0OGU5YmRhXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt19408390/img",
  "description": "Ronaldo e sua irmã estão visitando o Acampamento Intergaláctico para desvendar os segredos do espaço, mas não têm ideia de que os ETs estão mais próximos do que nunca. Agora eles viverão aventuras cheias de ciência, diversão e música para salvar o planeta.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt19408390",
  "imdbId": "tt19408390",
  "isFeatured": false,
  "director": "Fabrício Bittar",
  "cast": [
    "Ronaldo de Azevedo",
    "Blota Filho",
    "Pedro Miranda"
  ],
  "genres": [
    "Aventura",
    "Comédia",
    "Família"
  ]
},
  {
  "id": "movie-10198564",
  "title": "Perseguição Mortal",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.3,
  "image": "https://m.media-amazon.com/images/M/MV5BMjU1NGQyY2QtZmYwNy00M2JkLTk1NjAtZWY4MTgwYjE4ZGVkXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10198564/img",
  "description": "Depois de roubar milhões em dinheiro do esconderijo de drogas do sádico chefe da máfia Temple, um ladrão encontra um passageiro clandestino em seu carro de fuga.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10198564",
  "imdbId": "tt10198564",
  "isFeatured": false,
  "director": "James Clayton",
  "cast": [
    "Vinnie Jones",
    "Philip Granger",
    "James Clayton"
  ],
  "genres": [
    "Ação"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-14824590",
  "title": "Até o Limite",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.4,
  "image": "https://m.media-amazon.com/images/M/MV5BNjBiNjU2MmItYTYxZC00N2NmLTgwNjItZDc4MjZhZmFhMDNkXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14824590/img",
  "description": "Um apresentador atende uma ligação, onde um desconhecido ameaça matar toda a família do showman no ar. Para salvar entes queridos, o radialista terá que jogar um jogo de sobrevivência e a única maneira de vencer é descobrir a identidade do cri...",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14824590",
  "imdbId": "tt14824590",
  "isFeatured": false,
  "director": "Romuald Boulanger",
  "cast": [
    "Mel Gibson",
    "William Moseley",
    "Alia Seror-O'Neill"
  ],
  "genres": [
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-4303322",
  "title": "Duetto",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BZjI4ZTVkMmQtZDU4Mi00MDU1LWFiZjgtMTM2ZDNjMTFlMDc1XkEyXkFqcGdeQXVyNTczMDM0OTU@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt4303322/img",
  "description": "Duetto se passa em 1965 e conta a história de Cora, de 18 anos, uma brasileira de família italiana que, após perder o pai em um trágico acidente de carro, vai com a avó Lúcia para Puglia, na Itália, onde moram seus ancestrais...",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt4303322",
  "imdbId": "tt4303322",
  "isFeatured": false,
  "director": "Vicente Amorim",
  "cast": [
    "Michele Morrone",
    "Giancarlo Giannini",
    "Gabriel Leone"
  ],
  "genres": [
    "Drama"
  ]
},
  {
  "id": "movie-10242388",
  "title": "Caça Implacável",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.7,
  "image": "https://m.media-amazon.com/images/M/MV5BNDE4ZmRmZGUtMTVjOC00OWE2LTk2OGItZmJkNzkyMGFjNGE1XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10242388/img",
  "description": "A futura ex-mulher de Will desaparece misteriosamente em um posto de gasolina. Ele investiga o ponto fraco do crime da cidade enquanto foge das autoridades em uma corrida contra o tempo para encontrá-la.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10242388",
  "imdbId": "tt10242388",
  "isFeatured": false,
  "director": "Brian Goodman",
  "cast": [
    "Gerard Butler",
    "Jaimie Alexander",
    "Russell Hornsby"
  ],
  "genres": [
    "Ação",
    "Crime",
    "Drama"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-4546156",
  "title": "A Espera de Liz",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BZDkzMjRlM2QtOWIwMi00ZmQyLThhZTQtZDZkNTFmNWNhNDAyXkEyXkFqcGdeQXVyMTI3MjIyMTgw._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt4546156/img",
  "description": "Liz está cercada de dúvidas e incertezas. Introspectiva, ela busca o motivo da partida de seu companheiro Miguel. Enquanto procura respostas profundas, ela sente necessidade de apoio emocional de sua irmã mais nova, Lara.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt4546156",
  "imdbId": "tt4546156",
  "isFeatured": false,
  "director": "Bruno Fatumbi Torres",
  "cast": [
    "Juliana Drummond",
    "Murilo Grossi",
    "Simone Iliescu"
  ],
  "genres": [
    "Drama"
  ]
},
  {
  "id": "movie-14557188",
  "title": "Suaves e Discretas",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.2,
  "image": "https://m.media-amazon.com/images/M/MV5BZWI3ZTVmOGItNzcwMS00N2Y4LTg3N2UtMDViN2YyM2E0MGUzXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14557188/img",
  "description": "Jogando em tempo real, uma professora do ensino fundamental organiza uma reunião de mulheres com ideias semelhantes, quando encontra uma mulher de seu passado, levando a uma cadeia volátil de eventos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14557188",
  "imdbId": "tt14557188",
  "isFeatured": false,
  "director": "Beth de Araújo",
  "cast": [
    "Stefanie Estes",
    "Olivia Luccardi",
    "Dana Millican"
  ],
  "genres": [
    "Terror",
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-15128068",
  "title": "Monica, O My Darling",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.4,
  "image": "https://m.media-amazon.com/images/M/MV5BY2JkNTU0MDEtMzdhNC00NTZkLWI0YTMtZTdlZDkxM2Q0MTZjXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15128068/img",
  "description": "Um astuto especialista em robótica se junta a uma trama assassina depois que um caso apaixonado sofre uma reviravolta repentina, mas nada, nem mesmo a morte, é o que parece ser.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15128068",
  "imdbId": "tt15128068",
  "isFeatured": false,
  "director": "Vasan Bala",
  "cast": [
    "Rajkummar Rao",
    "Huma Qureshi",
    "Sikandar Kher"
  ],
  "genres": [
    "Comédia",
    "Crime",
    "Drama"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-13421498",
  "title": "O Rei Perdido",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.7,
  "image": "https://m.media-amazon.com/images/M/MV5BNGUzMTY2M2YtZGMxZi00NTVhLWFiZDQtM2E4ZTQwOTcwMjc3XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt13421498/img",
  "description": "Uma historiadora amadora desafia o pesado establishment acadêmico em seus esforços para encontrar os restos mortais do rei Ricardo III, que ficaram perdidos por mais de 500 anos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt13421498",
  "imdbId": "tt13421498",
  "isFeatured": false,
  "director": "Stephen Frears",
  "cast": [
    "Sally Hawkins",
    "Shonagh Price",
    "Helen Katamba"
  ],
  "genres": [
    "Drama"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-15713012",
  "title": "Overdose",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.8,
  "image": "https://m.media-amazon.com/images/M/MV5BMGNlNzkwMGUtYzZmMC00ZGM4LTliMTYtNjBiNmNkYzkyMWVkXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15713012/img",
  "description": "Segue Sara, chefe do esquadrão antidrogas da polícia de Toulouse, que é forçada a colaborar com Richard, o chefe da polícia criminal local, para impedir um ataque rápido entre Espanha e França e encontrar o assassino ligado ao caso.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15713012",
  "imdbId": "tt15713012",
  "isFeatured": false,
  "director": "Olivier Marchal",
  "cast": [
    "Sofia Essaïdi",
    "Assaad Bouab",
    "Alberto Ammann"
  ],
  "genres": [
    "Ação",
    "Crime",
    "Suspense"
  ]
},
  {
  "id": "movie-8296030",
  "title": "Você Não Estará Só!",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.4,
  "image": "https://m.media-amazon.com/images/M/MV5BNjM3ODYzMmQtMzc5Mi00Y2MwLWIyNWEtMWFjZTM5ZTA0ZWFlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt8296030/img",
  "description": "Numa aldeia montanhosa isolada na Macedónia do século XIX, uma jovem é raptada e depois transformada em bruxa por um espírito antigo.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt8296030",
  "imdbId": "tt8296030",
  "isFeatured": false,
  "director": "Goran Stolevski",
  "cast": [
    "Sara Klimoska",
    "Leontina Bainovic",
    "Anamaria Marinca"
  ],
  "genres": [
    "Drama",
    "Fantasia",
    "Terror"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-14715170",
  "title": "Uma Quedinha de Natal",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.3,
  "image": "https://m.media-amazon.com/images/M/MV5BNjRlOTQwZmYtOWVhYy00ZTA1LWEzZWEtNjRhNzU4ODI3NzM1XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14715170/img",
  "description": "Nos dias que antecedem o Natal, uma jovem herdeira recém-noiva sofre um acidente de esqui. Depois de ser diagnosticada com amnésia, ela fica sob os cuidados do belo dono da pousada e de sua filha.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14715170",
  "imdbId": "tt14715170",
  "isFeatured": false,
  "director": "Janeen Damian",
  "cast": [
    "Lindsay Lohan",
    "Chord Overstreet",
    "George Young"
  ],
  "genres": [
    "Comédia",
    "Romance"
  ],
  "ageRating": "TV-PG"
},
  {
  "id": "movie-14444726",
  "title": "TÁR",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.4,
  "image": "https://m.media-amazon.com/images/M/MV5BYWY5YThhOGUtNDU4OS00NTk3LWI0ODQtNmRiYTk0ZjVkZWU2XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14444726/img",
  "description": "Situado no mundo internacional da música clássica ocidental, o filme centra-se em Lydia Tár, amplamente considerada uma das maiores compositoras-regentes vivas e a primeira mulher diretora de uma grande orquestra alemã.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14444726",
  "imdbId": "tt14444726",
  "isFeatured": false,
  "director": "Todd Field",
  "cast": [
    "Cate Blanchett",
    "Noémie Merlant",
    "Nina Hoss"
  ],
  "genres": [
    "Drama",
    "Música"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-11454320",
  "title": "Herança Maldita",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.9,
  "image": "https://m.media-amazon.com/images/M/MV5BMmY2MDgzYjUtOGI3ZC00NGI4LTkwZjAtNTJlYWM3OWE3MjNlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt11454320/img",
  "description": "Depois de receber uma carta misteriosa, uma mulher viaja para uma cidade-ilha deserta e logo fica presa em um pesadelo.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt11454320",
  "imdbId": "tt11454320",
  "isFeatured": false,
  "director": "Mickey Keating",
  "cast": [
    "Jocelin Donahue",
    "Joe Swanberg",
    "Richard Brake"
  ],
  "genres": [
    "Drama",
    "Fantasia",
    "Terror"
  ]
},
  {
  "id": "movie-8859236",
  "title": "Território Hostil",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.9,
  "image": "https://m.media-amazon.com/images/M/MV5BMThhNDQxMWItYjcyMC00YzdmLTliZDctMmI0ZTcxNWNlMGE0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt8859236/img",
  "description": "Na América pós-guerra civil, quando um soldado da União é dado como morto, os seus filhos são erroneamente mandados embora no comboio órfão. Esta é uma história do oeste selvagem sobre pessoas unidas por um bem maior e crianças forçadas a crescer rapidamente.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt8859236",
  "imdbId": "tt8859236",
  "isFeatured": false,
  "director": "Brian Presley",
  "cast": [
    "Matt McCoy",
    "Lew Temple",
    "Brad Leland"
  ],
  "genres": [
    "Drama",
    "História",
    "Faroeste"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-12194006",
  "title": "Beleza",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7,
  "image": "https://m.media-amazon.com/images/M/MV5BYzkyZjY1OTktNzFkNy00ZWUyLThiNGYtMjk3ZmM3ZjYzMmNkXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt12194006/img",
  "description": "Cinco mulheres de diferentes idades são confrontadas com a sua autoimagem e as exigências próprias e dos outros.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt12194006",
  "imdbId": "tt12194006",
  "isFeatured": false,
  "director": "Karoline Herfurth",
  "cast": [
    "Emilia Schüle",
    "Martina Gedeck",
    "Nora Tschirner"
  ],
  "genres": [
    "Comédia",
    "Drama",
    "Romance"
  ]
},
  {
  "id": "movie-13139228",
  "title": "Meu Policial",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.5,
  "image": "https://m.media-amazon.com/images/M/MV5BYjkxNjg0YTctYTU5OC00MTYwLTg3NTMtZTcwNDRkNmQ2ZTcyXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt13139228/img",
  "description": "A chegada de Patrick à casa de Marion e Tom desencadeia a exploração de eventos sísmicos ocorridos há 40 anos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt13139228",
  "imdbId": "tt13139228",
  "isFeatured": false,
  "director": "Michael Grandage",
  "cast": [
    "Harry Styles",
    "Emma Corrin",
    "Gina McKee"
  ],
  "genres": [
    "Drama",
    "Romance"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-11162490",
  "title": "A Bravura de Molly",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.4,
  "image": "https://m.media-amazon.com/images/M/MV5BYmI2ZmFhMGEtYzI5Yi00YTgwLWI2NjItNzU1NzMxY2Q2ZGVlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt11162490/img",
  "description": "Uma bosquímana solitária luta para criar os filhos e administrar a fazenda da família enquanto o marido está fora.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt11162490",
  "imdbId": "tt11162490",
  "isFeatured": false,
  "director": "Leah Purcell",
  "cast": [
    "Leah Purcell",
    "Malachi Dower-Roberts",
    "Amahlia Olsson"
  ],
  "genres": [
    "Drama",
    "História",
    "Suspense"
  ]
},
  {
  "id": "movie-12215252",
  "title": "Jogada De Amor",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.4,
  "image": "https://m.media-amazon.com/images/M/MV5BMGMwOTQzNWYtNWY4YS00Y2FhLTlkMWQtM2NkMDI1NTg3OTBhXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt12215252/img",
  "description": "A vida do sedutor em série Gianni está fadada a mudar quando ele conhece Chiara, uma bela mulher que sofreu um acidente e está paraplégica.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt12215252",
  "imdbId": "tt12215252",
  "isFeatured": false,
  "director": "Riccardo Milani",
  "cast": [
    "Pierfrancesco Favino",
    "Miriam Leone",
    "Claire Palazzo"
  ],
  "genres": [
    "Comédia",
    "Romance"
  ]
},
  {
  "id": "movie-0120589",
  "title": "Predestinado: Arigó e o Espírito do Dr. Fritz",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.1,
  "image": "https://m.media-amazon.com/images/M/MV5BMzQzZGQwYmYtMWEyNy00MjZkLWE5OTAtYmIyNDg1NTRiMDdjXkEyXkFqcGdeQXVyNTEyMjMxNw@@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt0120589/img",
  "description": "Através do espírito do Dr. Fritz, médico alemão falecido durante a Primeira Guerra Mundial, José Arigó tornou-se esperança de cura para milhões de pessoas ao realizar cirurgias espirituais, ajudando cerca de 2 milhões de pessoas.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt0120589",
  "imdbId": "tt0120589",
  "isFeatured": false,
  "director": "Gustavo Fernández",
  "cast": [
    "James Faulkner",
    "Juliana Paes",
    "Antonio Saboia"
  ],
  "genres": [
    "Biografia",
    "Drama"
  ]
},
  {
  "id": "movie-14855468",
  "title": "Aquele Natal",
  "year": 2024,
  "type": ContentType.MOVIE,
  "rating": 6.8,
  "image": "https://m.media-amazon.com/images/M/MV5BZWRkZjQwNDctOWY2Yy00ZTczLTg2ZTMtMDBlYTVhNGE1OGYzXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14855468/img",
  "description": "É um Natal inesquecível para os habitantes de Wellington-on-Sea, quando a pior tempestade de neve da história altera os planos de todos, inclusive do Papai Noel.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14855468",
  "imdbId": "tt14855468",
  "isFeatured": false,
  "director": "Simon Otto",
  "cast": [
    "Bill Nighy",
    "Brian Cox",
    "Guz Khan"
  ],
  "genres": [
    "Animação",
    "Aventura",
    "Comédia"
  ],
  "ageRating": "PG"
},
  {
  "id": "movie-10192406",
  "title": "Passagem",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.6,
  "image": "https://m.media-amazon.com/images/M/MV5BZjVmZDgwZDItOWVjMy00MDE2LTljMWQtNTRiOTFmMjU4ZWQzXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10192406/img",
  "description": "Um soldado norte-americano sofre uma lesão cerebral traumática enquanto luta no Afeganistão e luta para se adaptar à vida no seu país.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10192406",
  "imdbId": "tt10192406",
  "isFeatured": false,
  "director": "Lila Neugebauer",
  "cast": [
    "Jennifer Lawrence",
    "Brian Tyree Henry",
    "Linda Emond"
  ],
  "genres": [
    "Drama"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-8646254",
  "title": "45 do Segundo Tempo",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BYWFlMjg2MTEtNTk3Zi00MDE5LWEzMDYtNGMyYWY2YTY4MWQ0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt8646254/img",
  "description": "Para recriar uma foto tirada em 1974, durante a inauguração do metrô de São Paulo, Pedro (Tony Ramos) conhece dois amigos de escola que não via há 40 anos. Se as suas crises existenciais, o envelhecimento e os caminhos (desviados) não fossem resolvidos...",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt8646254",
  "imdbId": "tt8646254",
  "isFeatured": false,
  "director": "Luiz Villaça",
  "cast": [
    "Tony Ramos",
    "Cássio Gabus Mendes",
    "Ary França"
  ],
  "genres": [
    "Comédia"
  ]
},
  {
  "id": "movie-9288748",
  "title": "O Dragão do Meu Pai",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.5,
  "image": "https://m.media-amazon.com/images/M/MV5BYzAxMGZiNzgtOTZmNS00M2Y4LWJjNGUtZDNmYTJhM2YyYTk2XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt9288748/img",
  "description": "Elmer Elevator procura um dragão cativo na Ilha Selvagem e encontra muito mais do que ele jamais poderia ter previsto.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt9288748",
  "imdbId": "tt9288748",
  "isFeatured": false,
  "director": "Nora Twomey",
  "cast": [
    "Jacob Tremblay",
    "Gaten Matarazzo",
    "Golshifteh Farahani"
  ],
  "genres": [
    "Animação",
    "Aventura",
    "Comédia"
  ],
  "ageRating": "PG"
},
  {
  "id": "movie-8883486",
  "title": "Medieval",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.9,
  "image": "https://m.media-amazon.com/images/M/MV5BYjgxZjg0MzEtYzQxMi00ZGRkLThkMzYtNzY0MDBmYjU0MjI0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt8883486/img",
  "description": "A história do ícone e senhor da guerra tcheco do século XV, Jan Zizka, que derrotou os exércitos da Ordem Teutônica e do Sacro Império Romano.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt8883486",
  "imdbId": "tt8883486",
  "isFeatured": false,
  "director": "Petr Jákl",
  "cast": [
    "Ben Foster",
    "Sophie Lowe",
    "Michael Caine"
  ],
  "genres": [
    "Ação",
    "Drama",
    "História"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-18884172",
  "title": "Terror em Crescent City",
  "year": 2024,
  "type": ContentType.MOVIE,
  "rating": 3.9,
  "image": "https://m.media-amazon.com/images/M/MV5BMzkxODU0NDItNTkzZS00ZmJlLTk5ZjMtMGQ0MzU4ODczM2RkXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt18884172/img",
  "description": "Uma pequena cidade no sul é devastada por um serial killer, com todos sendo suspeitos, incluindo a polícia.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt18884172",
  "imdbId": "tt18884172",
  "isFeatured": false,
  "director": "RJ Collins",
  "cast": [
    "Terrence Howard",
    "Esai Morales",
    "Nicky Whelan"
  ],
  "genres": [
    "Crime",
    "Terror",
    "Mistério"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-29242846",
  "title": "O Trem Italiano da Felicidade",
  "year": 2024,
  "type": ContentType.MOVIE,
  "rating": 7.4,
  "image": "https://m.media-amazon.com/images/M/MV5BOTBiZTY0NDctOWUyMy00ZGYzLWI2ZGUtNjQwMzI0ZWU5ZmQ3XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt29242846/img",
  "description": "Um menino de sete anos chamado Amerigo que em 1946 deixa sua família empobrecida em Nápoles e pega um trem para ir morar com uma família mais rica no norte, como parte de uma iniciativa do pós-guerra para resgatar crianças da pobreza.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt29242846",
  "imdbId": "tt29242846",
  "isFeatured": false,
  "director": "Cristina Comencini",
  "cast": [
    "Barbara Ronchi",
    "Serena Rossi",
    "Stefano Accorsi"
  ],
  "genres": [
    "Drama",
    "História"
  ],
  "ageRating": "TV-14"
},
  {
  "id": "movie-27599713",
  "title": "A Virgem Vermelha",
  "year": 2024,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BZWU5ZjdjYWItM2ZkNS00Yzg5LTgzNGUtNGFlYmJhOGQ2NDI1XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt27599713/img",
  "description": "Hildegart Rodríguez, escritora precoce e prolífica da década de 1930 na Espanha, criada por sua mãe para se tornar um modelo para futuras mulheres.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt27599713",
  "imdbId": "tt27599713",
  "isFeatured": false,
  "director": "Paula Ortiz",
  "cast": [
    "Najwa Nimri",
    "Alba Planas",
    "Aixa Villagrán"
  ],
  "genres": [
    "Mistério"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-18450548",
  "title": "Não Vá",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.2,
  "image": "https://m.media-amazon.com/images/M/MV5BZjc4ZjAyNWQtMmE1MC00ZmM0LTllODMtNGI0YzliMmVlYjk0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt18450548/img",
  "description": "A namorada de Semih termina repentinamente com ele. Em busca de respostas sobre o relacionamento deles, ele logo deverá confrontar o que há muito ignorou.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt18450548",
  "imdbId": "tt18450548",
  "isFeatured": false,
  "director": "Ozan Açiktan",
  "cast": [
    "Burak Deniz",
    "Dilan Çiçek Deniz",
    "Ceyda Düvenci"
  ],
  "genres": [
    "Drama",
    "Romance"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-22010586",
  "title": "Em Busca do Enfermeiro da Noite",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.4,
  "image": "https://m.media-amazon.com/images/M/MV5BYzNhZGQ4MmYtMWVkMS00MWY5LThjMzgtYTBjNDY3YTJiNzUxXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt22010586/img",
  "description": "Este documentário revela como os investigadores provaram que o enfermeiro da UTI Charles Cullen estava matando pacientes - e quão perto ele esteve de escapar impune do assassinato.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt22010586",
  "imdbId": "tt22010586",
  "isFeatured": false,
  "director": "Tim Travers Hawkins",
  "cast": [
    "Charles Cullen",
    "Amy Loughren",
    "Donna Hargreaves"
  ],
  "genres": [
    "Documentário",
    "Crime"
  ],
  "ageRating": "TV-14"
},
  {
  "id": "movie-8147518",
  "title": "Uma Pitada de Sorte",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BODY1ZTFhYTktZWY2OS00NmZjLWI0ZWYtYjNlZGJhNmM2NzZmXkEyXkFqcGdeQXVyMTU1ODkwMDU0._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt8147518/img",
  "description": "Sonhando em ter seu próprio negócio de culinária, sua “sorte” surge quando ela é aprovada para ser assistente de um famoso chef em um programa de televisão.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt8147518",
  "imdbId": "tt8147518",
  "isFeatured": false,
  "director": "Pedro Antônio Paes",
  "cast": [
    "Izabel Alvares",
    "Regiane Alves",
    "Daniel Belmonte"
  ],
  "genres": [
    "Comédia"
  ]
},
  {
  "id": "movie-21094994",
  "title": "R.I.P.D. 2: Rise of the Damned",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.6,
  "image": "https://m.media-amazon.com/images/M/MV5BODA4Y2UxZjItOGY5NS00ZGJjLWIxMWMtZjczODQ1NzQwY2NiXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt21094994/img",
  "description": "Recrutado pelo RIPD, um xerife ressuscitado retorna à Terra para salvar a humanidade de uma porta de entrada para o inferno.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt21094994",
  "imdbId": "tt21094994",
  "isFeatured": false,
  "director": "Paul Leyden",
  "cast": [
    "Jeffrey Donovan",
    "Rachel Adedeji",
    "Penelope Mitchell"
  ],
  "genres": [
    "Ação",
    "Aventura",
    "Comédia"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-15374214",
  "title": "O Cavaleiro do Rei",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.4,
  "image": "https://m.media-amazon.com/images/M/MV5BNTg0ZDBlM2MtYmNhNy00ZGI5LWI0M2YtYTMzZDBlYzJiNDRlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15374214/img",
  "description": "Depois que seu rei morre, um cavaleiro deve se sacrificar para servir seu governante na vida após a morte, mas distrações repentinas levam a uma tragédia inesperada.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15374214",
  "imdbId": "tt15374214",
  "isFeatured": false,
  "director": "Biyi Bandele",
  "cast": [
    "Odunlade Adekola",
    "Shaffy Bello",
    "Olawale-Brymo Olofooro"
  ],
  "genres": [
    "Aventura",
    "Drama",
    "História"
  ],
  "ageRating": "TV-MA"
},
  {
  "id": "movie-22207152",
  "title": "Um Mistério de Natal",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6,
  "image": "https://m.media-amazon.com/images/M/MV5BZGU3N2E2NmItZTJlNC00ZGM5LTg2ZjAtODA3OWZmZjI3NTg3XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt22207152/img",
  "description": "Quando o pai de sua melhor amiga é falsamente acusado de roubar os sinos mais valiosos da cidade, uma jovem detetive amadora e seus amigos devem encontrar o verdadeiro ladrão antes do Natal.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt22207152",
  "imdbId": "tt22207152",
  "isFeatured": false,
  "director": "Alex Ranarivelo",
  "cast": [
    "Violet McGraw",
    "Santino Barnard",
    "Lauren Lindsey Donzis"
  ],
  "genres": [
    "Comédia",
    "Drama",
    "Família"
  ],
  "ageRating": "PG"
},
  {
  "id": "movie-1551614",
  "title": "Roubo Entre Ladrões",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.3,
  "image": "https://m.media-amazon.com/images/M/MV5BZjBiOTVkYWUtOTgwNy00YjY5LWJmN2UtYWFlYjlmMmMwYzcxXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt1551614/img",
  "description": "Depois de planejar um assalto perfeito, Nick está pronto para marcar. Um problema, sua garota e a equipe têm outras ideias. Eles derrubam Nick com uma saraivada de balas, mas Nick não morre e, em uma corrida por sua vida, busca vingança, um alvo de cada vez.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt1551614",
  "imdbId": "tt1551614",
  "isFeatured": false,
  "director": "Tibor Takács",
  "cast": [
    "Randy Couture",
    "Cam Gigandet",
    "Chris Maher"
  ],
  "genres": [
    "Ação",
    "Crime",
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-18305922",
  "title": "Conspiração Fatal",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BNzkwYTY2MDktOTg3Yy00NjRkLTg3YWEtY2I1YTdiNGYwOGQxXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt18305922/img",
  "description": "Casal Davi e Juliana enfrentam crises; Davi investiga escândalo financeiro no trabalho, colocando-se em perigo. Juliana suspeita que sua nova casa esconde segredos obscuros, colocando sua vida em risco. Suas vidas se entrelaçam com uma conspiração perigosa.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt18305922",
  "imdbId": "tt18305922",
  "isFeatured": false,
  "director": "Renato Siqueira",
  "cast": [
    "Aline Mineiro",
    "Ricardo Ramory",
    "Priscila Castello Branco"
  ],
  "genres": [
    "Suspense"
  ]
},
  {
  "id": "movie-15038118",
  "title": "A Grande Aventura de Blue na Cidade",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.2,
  "image": "https://m.media-amazon.com/images/M/MV5BNWI2ZjYxMGYtODBkYS00NmExLWJiMTktOGUzOTJhODYwZWI0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt15038118/img",
  "description": "Josh e Blue vão para Nova York para fazer um teste para um grande musical da Broadway.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt15038118",
  "imdbId": "tt15038118",
  "isFeatured": false,
  "director": "Matt Stawski",
  "cast": [
    "Nick Balaban",
    "Ava Augustin",
    "Shazdeh Kapadia"
  ],
  "genres": [
    "Animação",
    "Aventura",
    "Comédia"
  ],
  "ageRating": "TV-Y"
},
  {
  "id": "movie-17220704",
  "title": "Uma História de Natal Natalina",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.7,
  "image": "https://m.media-amazon.com/images/M/MV5BZWU1Mjk2YmItM2E3Yi00OWYwLWIxMjItNGNkMGFiYmI0NDUxXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt17220704/img",
  "description": "Segue o agora adulto Ralphie enquanto ele retorna para a casa na Cleveland Street para dar aos seus filhos um Natal mágico como o que ele teve quando criança, reconectando-se com amigos de infância e reconciliando o falecimento de seu Velho.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt17220704",
  "imdbId": "tt17220704",
  "isFeatured": false,
  "director": "Clay Kaytis",
  "cast": [
    "Peter Billingsley",
    "Erinn Hayes",
    "River Drosche"
  ],
  "genres": [
    "Comédia",
    "Família"
  ],
  "ageRating": "PG"
},
  {
  "id": "movie-12630014",
  "title": "Busco Namorada",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 0,
  "image": "https://m.media-amazon.com/images/M/MV5BZTZjZDIyZmYtM2E4NC00MTZlLWE4YTYtNWRjYWI1ODJjODQ3XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt12630014/img",
  "description": "Renzo Collazos é jornalista reconhecido da seção política do jornal El Comercio há um ano. Certa manhã, o editor do site pede que ele gerencie um blog dedicado à juventude e escreva semanalmente sobre suas pálidas redes sociais...",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt12630014",
  "imdbId": "tt12630014",
  "isFeatured": false,
  "director": "Daniel Vega Vidal",
  "cast": [
    "Gustavo Bueno",
    "Vadhir Derbez",
    "Crystal Lopez"
  ],
  "genres": [
    "Comédia"
  ]
},
  {
  "id": "movie-4459134",
  "title": "Frank & Penelope",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.3,
  "image": "https://m.media-amazon.com/images/M/MV5BMTVkMmFjODctMTRjYS00OWMyLWI3MGYtYmQ5NmY0YjAxNDQxXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt4459134/img",
  "description": "Uma história de amor e violência quando um homem em seus últimos momentos emocionais encontra um salvador dançando sedutoramente em um clube de strip-tease decadente. E uma vida certamente despencou de um penhasco de repente é redirecionada - já que tudo agora vale a pena...",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt4459134",
  "imdbId": "tt4459134",
  "isFeatured": false,
  "director": "Sean Patrick Flanery",
  "cast": [
    "Billy Budinich",
    "Caylee Cowan",
    "Johnathon Schaech"
  ],
  "genres": [
    "Terror",
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-14394620",
  "title": "Em Confinamento",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.7,
  "image": "https://m.media-amazon.com/images/M/MV5BOGUwMzZlMjMtNTc4Yy00N2Y3LWI4ZjItNmNiNWY3ZTUxYWY0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14394620/img",
  "description": "Um homem de família se vê preso no forro de uma cabana remota no Oregon, onde caçadores furtivos impiedosos esconderam seus ganhos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14394620",
  "imdbId": "tt14394620",
  "isFeatured": false,
  "director": "L. Gustavo Cooper",
  "cast": [
    "Henry Thomas",
    "Bradley Stryker",
    "C. Ernst Harth"
  ],
  "genres": [
    "Suspense"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-11540726",
  "title": "Sombras do Passado",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.9,
  "image": "https://m.media-amazon.com/images/M/MV5BYjAxZDc2YzYtYWE2Yi00Y2E3LTkyMTAtYTI0ZmFiZWRjZmIyXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt11540726/img",
  "description": "A vida de Margaret está em ordem. Ela é capaz, disciplinada e bem-sucedida. Tudo está sob controle até que David retorne – isto é – carregando consigo os horrores do passado de Margaret.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt11540726",
  "imdbId": "tt11540726",
  "isFeatured": false,
  "director": "Andrew Semans",
  "cast": [
    "Rebecca Hall",
    "Tim Roth",
    "Grace Kaufman"
  ],
  "genres": [
    "Crime",
    "Drama",
    "Terror"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-14668630",
  "title": "Lilo, Lilo, Crocodilo",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.1,
  "image": "https://m.media-amazon.com/images/M/MV5BMDkyOTM5MmYtZWU0ZC00MmU0LWIyN2UtZDAzNGRiZDZmN2MwXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt14668630/img",
  "description": "Longa-metragem baseado no livro infantil sobre um crocodilo que vive na cidade de Nova York.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt14668630",
  "imdbId": "tt14668630",
  "isFeatured": false,
  "director": "Josh Gordon, Will Speck",
  "cast": [
    "Javier Bardem",
    "Winslow Fegley",
    "Shawn Mendes"
  ],
  "genres": [
    "Aventura",
    "Comédia",
    "Família"
  ],
  "ageRating": "PG"
},
  {
  "id": "movie-8745676",
  "title": "As Nadadoras",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.4,
  "image": "https://m.media-amazon.com/images/M/MV5BM2I0MWExYTktN2Q5NS00YjAwLWIwYTAtYWIyNDc1ZTVmZTQ4XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt8745676/img",
  "description": "Da Síria devastada pela guerra aos Jogos Olímpicos do Rio de 2016, duas jovens irmãs embarcam numa viagem angustiante como refugiadas, colocando ao mesmo tempo os seus corações e as suas capacidades de natação de campeã em uso heróico.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt8745676",
  "imdbId": "tt8745676",
  "isFeatured": false,
  "director": "Sally El Hosaini",
  "cast": [
    "Nathalie Issa",
    "Manal Issa",
    "Matthias Schweighöfer"
  ],
  "genres": [
    "Biografia",
    "Drama",
    "Esporte"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-9071456",
  "title": "Os Odiados do Casamento",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 5.8,
  "image": "https://m.media-amazon.com/images/M/MV5BNTdhMTU3MjctYjU1OS00Y2M1LWJkNzEtMGMyY2VkNDQ5NDZlXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt9071456/img",
  "description": "As tensões familiares aumentam entre os irmãos na semana que antecede o casamento da meia-irmã no país.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt9071456",
  "imdbId": "tt9071456",
  "isFeatured": false,
  "director": "Claire Scanlon",
  "cast": [
    "Allison Janney",
    "Ben Platt",
    "Cynthia Addai-Robinson"
  ],
  "genres": [
    "Comédia"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-21819228",
  "title": "O Método de Stutz",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.8,
  "image": "https://m.media-amazon.com/images/M/MV5BMjZiMjQ4YzYtMWNhZi00NzBmLWE1YzEtMzQxZTRlMWZjNGU3XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt21819228/img",
  "description": "Acompanhe Hill e seu terapeuta enquanto ele tem discussões francas sobre saúde mental e o agravamento progressivo dos ataques de ansiedade relacionados à promoção de filmes que transformaram seu emprego dos sonhos em um pesadelo.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt21819228",
  "imdbId": "tt21819228",
  "isFeatured": false,
  "director": "Jonah Hill",
  "cast": [
    "Sharon Feldstein",
    "Jonah Hill",
    "Phil Stutz"
  ],
  "genres": [
    "Documentário"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-11399896",
  "title": "A Última Caçada",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 4.4,
  "image": "https://m.media-amazon.com/images/M/MV5BMmMyYjYxZmYtNjgzZi00NzU0LThlZmMtZWZiZTUxMWNlMWRhXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt11399896/img",
  "description": "Baseado em acontecimentos reais do Velho Oeste do início dos anos 1900, Willie Boy se apaixona por Carlota da tribo Chemehuevi, apesar de serem proibidos de ficarem juntos. Um incidente fatal obriga o jovem casal a fugir do único lugar que conhecem...",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt11399896",
  "imdbId": "tt11399896",
  "isFeatured": false,
  "director": "Christian Camargo",
  "cast": [
    "Martin Sensmeier",
    "Mainei Kinimaka",
    "Zahn McClarnon"
  ],
  "genres": [
    "Ação",
    "Drama",
    "Romance"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-12728584",
  "title": "La Verónica",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6,
  "image": "https://m.media-amazon.com/images/M/MV5BZWExYjM3OTMtMTQwNi00MTRlLWE5NjMtNWIzNjZlMmUxNzk4XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt12728584/img",
  "description": "Verônica, modelo muito popular nas redes sociais, cai em desgraça ao descobrir que é a principal suspeita de uma investigação pelo assassinato de sua primeira filha.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt12728584",
  "imdbId": "tt12728584",
  "isFeatured": false,
  "director": "Leonardo Medel",
  "cast": [
    "Mariana Di Girólamo",
    "Valeryia Alfirovich",
    "Stephan Cabezas"
  ],
  "genres": [
    "Drama"
  ]
},
  {
  "id": "movie-12545566",
  "title": "A Lista do Sr. Malcolm",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6,
  "image": "https://m.media-amazon.com/images/M/MV5BMWFkNThiYWItYzI0Mi00ZDAxLThlYzAtNjAyMDQzY2IzZTE0XkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt12545566/img",
  "description": "Uma jovem corteja um misterioso pretendente rico na Inglaterra do século XIX.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt12545566",
  "imdbId": "tt12545566",
  "isFeatured": false,
  "director": "Emma Holly Jones",
  "cast": [
    "Freida Pinto",
    "Sope Dirisu",
    "Oliver Jackson-Cohen"
  ],
  "genres": [
    "Comédia",
    "Drama",
    "Romance"
  ],
  "ageRating": "PG"
},
  {
  "id": "movie-13320662",
  "title": "Terra dos Sonhos",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.7,
  "image": "https://m.media-amazon.com/images/M/MV5BOGFiMmNhZGItNjZjOS00ZTk1LTg1MDMtYzBhZjBmYjdlNGQyXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt13320662/img",
  "description": "Uma jovem descobre um mapa secreto para o mundo dos sonhos de Slumberland e, com a ajuda de um fora-da-lei excêntrico, ela atravessa sonhos e foge de pesadelos, na esperança de poder ver seu falecido pai novamente.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt13320662",
  "imdbId": "tt13320662",
  "isFeatured": false,
  "director": "Francis Lawrence",
  "cast": [
    "Jason Momoa",
    "Marlow Barkley",
    "Chris O'Dowd"
  ],
  "genres": [
    "Aventura",
    "Comédia",
    "Drama"
  ],
  "ageRating": "PG"
},
  {
  "id": "movie-10999120",
  "title": "Spirited: Um Conto Natalino",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.6,
  "image": "https://m.media-amazon.com/images/M/MV5BY2E3MWRiMjYtMjM2Yi00ZDJiLTgwZDctMjk2ZWQ0NjQyYzliXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10999120/img",
  "description": "Uma versão musical da história de Charles Dickens sobre um misantropo avarento que é levado em uma jornada mágica.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10999120",
  "imdbId": "tt10999120",
  "isFeatured": false,
  "director": "Sean Anders",
  "cast": [
    "Will Ferrell",
    "Ryan Reynolds",
    "Octavia Spencer"
  ],
  "genres": [
    "Comédia",
    "Família",
    "Fantasia"
  ],
  "ageRating": "PG-13"
},
  {
  "id": "movie-10343028",
  "title": "Armageddon Time",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.4,
  "image": "https://m.media-amazon.com/images/M/MV5BNDcyNGZmZTAtOWM2NS00NzlkLTk2ZTMtMDkzNGM1ODQ3OTVkXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt10343028/img",
  "description": "Uma história profundamente pessoal sobre a maioridade sobre a força da família e a busca geracional do sonho americano.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt10343028",
  "imdbId": "tt10343028",
  "isFeatured": false,
  "director": "James Gray",
  "cast": [
    "Anne Hathaway",
    "Jeremy Strong",
    "Banks Repeta"
  ],
  "genres": [
    "Drama"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-7461272",
  "title": "Disque Jane",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 6.5,
  "image": "https://m.media-amazon.com/images/M/MV5BMzU4NzNmY2UtZDgxZi00YTJmLTk4OTAtYjgzOTAyMmRiOWFmXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt7461272/img",
  "description": "Uma mulher casada com uma gravidez indesejada vive numa época na América em que não consegue fazer um aborto legal e trabalha com um grupo de mulheres suburbanas para encontrar ajuda.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt7461272",
  "imdbId": "tt7461272",
  "isFeatured": false,
  "director": "Phyllis Nagy",
  "cast": [
    "Elizabeth Banks",
    "Sigourney Weaver",
    "Chris Messina"
  ],
  "genres": [
    "Drama",
    "História"
  ],
  "ageRating": "R"
},
  {
  "id": "movie-7322224",
  "title": "Triângulo da Tristeza",
  "year": 2022,
  "type": ContentType.MOVIE,
  "rating": 7.2,
  "image": "https://m.media-amazon.com/images/M/MV5BYTViNzUyNDUtZTg3Yy00OTY4LWEyMTYtMmUzYjE3ZmZjYzUwXkEyXkFqcGc@._V1_SX300.jpg",
  "backdrop": "https://images.metahub.space/background/medium/tt7322224/img",
  "description": "Um casal de celebridades e modelos se junta a um cruzeiro movimentado para os super-ricos.",
  "platform": "Outros",
  "videoUrl": "https://watchplayer.lat/movie/tt7322224",
  "imdbId": "tt7322224",
  "isFeatured": false,
  "director": "Ruben Östlund",
  "cast": [
    "Thobias Thorwid",
    "Harris Dickinson",
    "Charlbi Dean"
  ],
  "genres": [
    "Comédia",
    "Drama"
  ],
  "ageRating": "R"
},
  
  {
    id: 'movie-17492148',
    title: 'Conselhos De Um Serial Killer Aposentado',
    year: 2025,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BNDQwZWVkYTUtYjU5Ni00NWRjLWE2NTktNmQ1Mzc1ODBjZWNkXkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt17492148/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt17492148',
    imdbId: 'tt17492148',
    isFeatured: false
  },
  {
    id: 'movie-15738252',
    title: 'Enterre Seus Mortos',
    year: 2025,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BOGQyZDYyYTEtMzI5NC00ZmFiLWE1OGMtNDE2OGJjNjk2ODViXkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt15738252/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt15738252',
    imdbId: 'tt15738252',
    isFeatured: false
  },
  {
    id: 'movie-30343021',
    title: 'Song Sung Blue: Um Sonho a Dois',
    year: 2025,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BYmQ2YjhjNjgtNGQxNC00NmI0LWEzMjktNWEzMWY2OTUwZjFiXkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt30343021/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt30343021',
    imdbId: 'tt30343021',
    isFeatured: false
  },
  {
    id: 'movie-34682220',
    title: 'Parque Lezama',
    year: 2026,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BNDU1Njk2MDctMjExNS00YTRlLWEwNzAtNDk3ZmRjZmQzNjU0XkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt34682220/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt34682220',
    imdbId: 'tt34682220',
    isFeatured: false
  },
  {
    id: 'movie-25967234',
    title: 'Alienígena',
    year: 2024,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BZjkyYzQwOTktOTg4Ni00ZmEwLTlmODMtNjFjZGY2Zjc2MzI4XkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt25967234/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt25967234',
    imdbId: 'tt25967234',
    isFeatured: false
  },
  {
    id: 'movie-27497165',
    title: 'Sombra da Morte',
    year: 2026,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BZjQxMTVhMzktZmI4MC00MWI5LTg0YWEtN2E4MjMwMTU0ZTBkXkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt27497165/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt27497165',
    imdbId: 'tt27497165',
    isFeatured: false
  },
  {
    id: 'movie-15940132',
    title: 'Máquina de Guerra',
    year: 2026,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BMmM1ZTc5ZTYtOTM2My00MjBmLWE5NzktYzkyYzdlYWE3ZDAzXkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt15940132/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt15940132',
    imdbId: 'tt15940132',
    isFeatured: false
  },
  {
    id: 'movie-34610311',
    title: 'A Sombra do Perigo',
    year: 2025,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BN2ZhMGU1MTItMzBkMi00MjZmLWI2MDQtMWE1ODNjMWFhZjY4XkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt34610311/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt34610311',
    imdbId: 'tt34610311',
    isFeatured: false
  },
  {
    id: 'movie-11005128',
    title: 'Nas Profundezas',
    year: 2022,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BNmNjNWVjNTgtZjNiYS00Njg0LWEyYWQtNWJiOTUwMzE4MTE4XkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt11005128/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt11005128',
    imdbId: 'tt11005128',
    isFeatured: false
  },
  {
    id: 'movie-15006754',
    title: 'A Gestora',
    year: 2022,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BNTIyNTVjOGItYzA1ZC00NmNkLWFhYzUtZDRhNTIzMmVhOWQ4XkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt15006754/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt15006754',
    imdbId: 'tt15006754',
    isFeatured: false
  },
  {
    id: 'movie-15463032',
    title: 'Amor em Verona',
    year: 2022,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BMjk5MTQ2ZTAtNWQ4ZC00NWY5LWFhMTItZjZkZDI0N2QwNjhkXkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt15463032/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt15463032',
    imdbId: 'tt15463032',
    isFeatured: false
  },
  {
    id: 'movie-15529106',
    title: 'Fortaleza Hotel',
    year: 2022,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BMWZhYTZhNjItNzVjMy00OWU3LTljMTAtMzBmYjZlNzg4MGVkXkEyXkFqcGc@._V1_.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt15529106/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt15529106',
    imdbId: 'tt15529106',
    isFeatured: false
  },
  {
    id: 'movie-11636118',
    title: 'De Férias da Família',
    year: 2022,
    type: ContentType.MOVIE,
    rating: 0,
    image: 'https://m.media-amazon.com/images/M/MV5BYjYzMTkyYjUtYTVmYi00Y2ZjLTg2N2ItZGFhODAzYTVmYzkzXkEyXkFqcGc@._V1_SX300.jpg',
    backdrop: 'https://images.metahub.space/background/medium/tt11636118/img',
    description: 'Sinopse indisponível.',
    platform: 'Outros',
    videoUrl: 'https://watchplayer.lat/movie/tt11636118',
    imdbId: 'tt11636118',
    isFeatured: false
  }
];