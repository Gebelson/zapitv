import fs from 'fs';
import path from 'path';

const moviesList = `
- Frágil (2024) - https://watchplayer.lat/movie/tt13605284
- Uma Noite no Jardim de Infância (2022) - https://watchplayer.lat/movie/tt19724270
- Desconectados (2022) - https://watchplayer.lat/movie/tt22442442
- Varig: A Caixa-Preta do Brasil (2022) - https://watchplayer.lat/movie/tt24748792
- Feliz Ano Nosso (2022) - https://watchplayer.lat/movie/tt23867462
- A Loteria: O Sonho Mexicano (2022) - https://watchplayer.lat/movie/tt18381124
- Natal (Ao Vivo) (2022) - https://watchplayer.lat/movie/tt18263854
- Conselheira do Amor (2022) - https://watchplayer.lat/movie/tt23782662
- Vale dos Cangurus (2022) - https://watchplayer.lat/movie/tt15553758
- O Sonho de Ontem (2022) - https://watchplayer.lat/movie/tt12878292
- Gaiola Mental (2022) - https://watchplayer.lat/movie/tt14147224
- A Informante (2024) - https://watchplayer.lat/movie/tt11433906
- Mickey Salva o Natal (2022) - https://watchplayer.lat/movie/tt22899102
- Mergulho (2022) - https://watchplayer.lat/movie/tt22656762
- Natal no Paraíso (2022) - https://watchplayer.lat/movie/tt22309256
- 12 Vésperas de Natal (2022) - https://watchplayer.lat/movie/tt22527810
- Os Suburbanos: O Filme (2022) - https://watchplayer.lat/movie/tt21990918
- The OctoGames (2022) - https://watchplayer.lat/movie/tt18559720
- Nada é por Acaso (2022) - https://watchplayer.lat/movie/tt21994096
- Jack Osbourne: Em Busca dos Óvnis (2022) - https://watchplayer.lat/movie/tt21441396
- Vulcão Whakaari: Resgate na Nova Zelândia (2022) - https://watchplayer.lat/movie/tt21439528
- Calor Mortal (2022) - https://watchplayer.lat/movie/tt15721088
- Código do Armagedom (2022) - https://watchplayer.lat/movie/tt22490660
- Amor Além do Tempo (2022) - https://watchplayer.lat/movie/tt10418680
- Hawa (2022) - https://watchplayer.lat/movie/tt21909950
- Re/Member (2022) - https://watchplayer.lat/movie/tt21250176
- Abestalhados 2 (2022) - https://watchplayer.lat/movie/tt12076024
- Aftersun (2022) - https://watchplayer.lat/movie/tt19770238
- Dead Zone: Operação Resgate (2022) - https://watchplayer.lat/movie/tt18396866
- Rei do Ringue: A História de Jem Belcher (2022) - https://watchplayer.lat/movie/tt4471908
- Perseguição nas Alturas (2022) - https://watchplayer.lat/movie/tt6805938
- Padre Johnny (2022) - https://watchplayer.lat/movie/tt15538570
- Tudo Por um Ponto (2022) - https://watchplayer.lat/movie/tt17517876
- Marte Um (2022) - https://watchplayer.lat/movie/tt16377816
- Brian e Charles (2022) - https://watchplayer.lat/movie/tt13270424
- One Piece Film: Red (2022) - https://watchplayer.lat/movie/tt16183464
- Darby: A Jovem Sensitiva (2022) - https://watchplayer.lat/movie/tt15745226
- Como Agradar Uma Mulher (2022) - https://watchplayer.lat/movie/tt10530838
- A Farsa (2022) - https://watchplayer.lat/movie/tt14534796
- O Mistério de Ozarks (2022) - https://watchplayer.lat/movie/tt11186952
- A Maldição do Quarto 203 (2022) - https://watchplayer.lat/movie/tt12283036
- Maior que o Mundo (2022) - https://watchplayer.lat/movie/tt9787228
- 30 Noites com a Minha Ex (2022) - https://watchplayer.lat/movie/tt15977950
- Fantasy Football (2022) - https://watchplayer.lat/movie/tt15035506
- Carvão (2022) - https://watchplayer.lat/movie/tt21637282
- Marcel, a Concha de Sapatos (2022) - https://watchplayer.lat/movie/tt15339456
- Carmen (2022) - https://watchplayer.lat/movie/tt10692578
- Querida Alice (2022) - https://watchplayer.lat/movie/tt11687104
- Guerra Oculta (2022) - https://watchplayer.lat/movie/tt13918550
- Alerta! Temporada de Tubarões (2022) - https://watchplayer.lat/movie/tt14962428
- Homens Não Choram (2022) - https://watchplayer.lat/movie/tt9797932
- Novembro: Paris Atacado (2022) - https://watchplayer.lat/movie/tt14542254
- A Sorte Grande (2022) - https://watchplayer.lat/movie/tt8129806
- Império da Luz (2022) - https://watchplayer.lat/movie/tt14402146
- Notre-Dame: Desastre em Paris (2022) - https://watchplayer.lat/movie/tt12264966
- De Repente 70 (2022) - https://watchplayer.lat/movie/tt14330236
- O Lobo Viking (2022) - https://watchplayer.lat/movie/tt13051810
- Mentiras Secretas (2022) - https://watchplayer.lat/movie/tt12715472
- Entre Mulheres (2022) - https://watchplayer.lat/movie/tt13669038
- Fogaréu (2022) - https://watchplayer.lat/movie/tt14113574
- O Clube dos Anjos (2022) - https://watchplayer.lat/movie/tt8608144
- Viver (2022) - https://watchplayer.lat/movie/tt9051908
- Casamento Armado (2022) - https://watchplayer.lat/movie/tt9686790
- Super Quem? Heróis Por Acidente (2022) - https://watchplayer.lat/movie/tt13774454
- Um Asilo Fora do Comum (2022) - https://watchplayer.lat/movie/tt12847680
- Lâmina dos 47 Ronins (2022) - dorama - https://watchplayer.lat/movie/tt12610794
- Operação Hunt (2022) - dorama - https://watchplayer.lat/movie/tt6931658
- Decisão de Partir (2022) - https://watchplayer.lat/movie/tt12477480
- I Wanna Dance with Somebody: A História de Whitney Houston (2022) - https://watchplayer.lat/movie/tt12193804
- Invisíveis (2022) - https://watchplayer.lat/movie/tt10506876
- A Morte Habita à Noite (2022) - https://watchplayer.lat/movie/tt12077826
- O Amor dá Voltas (2022) - https://watchplayer.lat/movie/tt6360426
- O Rei Macaco: A Lenda Começa (2022) - https://watchplayer.lat/movie/tt9692040
- Você Vai Lembrar Meu Nome (2022) - https://watchplayer.lat/movie/tt9330648
- Narvik (2022) - https://watchplayer.lat/movie/tt9737876
- Babilônia (2022) - https://watchplayer.lat/movie/tt10640346
- O Filho Protegido (2019) - https://watchplayer.lat/movie/tt8160262
- Serial Kelly (2022) - https://watchplayer.lat/movie/tt7685600
- O Faixa Preta (2022) - https://watchplayer.lat/movie/tt23651588
- O Ataque ao Capitólio (2022) - https://watchplayer.lat/movie/tt22502868
- Pronto, Falei (2022) - https://watchplayer.lat/movie/tt23829618
- Detetive Knight: Redenção (2022) - https://watchplayer.lat/movie/tt22394694
- Em Busca de Mim (2022) - https://watchplayer.lat/movie/tt12726428
- Quebrando o Gelo (2022) - https://watchplayer.lat/movie/tt23622516
- Jack & Jill Nos Passos do Amor (2022) - https://watchplayer.lat/movie/tt14661276
- Cordialmente Teus (2022) - https://watchplayer.lat/movie/tt13678246
- Valentes (2022) - https://watchplayer.lat/movie/tt21833464
- Um Natal na Suíça (2022) - https://watchplayer.lat/movie/tt21662290
- O Preço da Família (2022) - https://watchplayer.lat/movie/tt21149522
- Amor Inesperado (2022) - https://watchplayer.lat/movie/tt21298322
- Meu Vizinho Adolf (2022) - https://watchplayer.lat/movie/tt7175968
- O Ano em que Comecei a Vibrar por Mim (2022) - https://watchplayer.lat/movie/tt15411160
- Dias de Desejo (2022) - https://watchplayer.lat/movie/tt12440964
- Triângulo de Natal (2022) - https://watchplayer.lat/movie/tt19499664
- Oferenda ao Demônio (2022) - https://watchplayer.lat/movie/tt13103732
- O Rei Piu-Piu (2022) - https://watchplayer.lat/movie/tt18951472
- O Chamado 4: Samara Ressurge (2022) - https://watchplayer.lat/movie/tt19815280
- Caminho Para a Liberdade (2022) - https://watchplayer.lat/movie/tt13453138
- Verão Fantasma (2022) - https://watchplayer.lat/movie/tt14456750
- Quatro Amigas Numa Fria (2022) - https://watchplayer.lat/movie/tt12097234
`;

async function translate(text) {
  if (!text || text === 'N/A') return text;
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    return data[0].map(x => x[0]).join('');
  } catch (e) {
    return text;
  }
}

const genreMap = {
  'Action': 'Ação',
  'Adventure': 'Aventura',
  'Animation': 'Animação',
  'Biography': 'Biografia',
  'Comedy': 'Comédia',
  'Crime': 'Crime',
  'Documentary': 'Documentário',
  'Drama': 'Drama',
  'Family': 'Família',
  'Fantasy': 'Fantasia',
  'Film-Noir': 'Film-Noir',
  'History': 'História',
  'Horror': 'Terror',
  'Music': 'Música',
  'Musical': 'Musical',
  'Mystery': 'Mistério',
  'Romance': 'Romance',
  'Sci-Fi': 'Ficção Científica',
  'Short': 'Curta-metragem',
  'Sport': 'Esporte',
  'Thriller': 'Suspense',
  'War': 'Guerra',
  'Western': 'Faroeste'
};

function translateGenres(genresStr) {
  if (!genresStr || genresStr === 'N/A') return [];
  return genresStr.split(', ').map(g => genreMap[g] || g);
}

async function processMovies() {
  const lines = moviesList.trim().split('\n');
  const newMovies = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/- (.*?) \((\d{4})\)(?: - (.*?))? - https:\/\/watchplayer\.lat\/movie\/(tt\d+)/);
    if (!match) {
      console.log("Failed to parse line:", line);
      continue;
    }
    const [_, title, yearStr, extraTags, imdbId] = match;
    const year = parseInt(yearStr);
    const videoUrl = `https://watchplayer.lat/movie/${imdbId}`;

    console.log(`Processing ${i+1}/${lines.length}: ${title} (${imdbId})`);

    try {
      const res = await fetch(`http://www.omdbapi.com/?i=${imdbId}&apikey=a407a7b3`);
      const data = await res.json();

      let description = 'Sinopse indisponível.';
      let rating = 0;
      let director = undefined;
      let cast = undefined;
      let genres = [];
      let ageRating = undefined;
      let image = `https://picsum.photos/seed/${imdbId}/400/600`;
      let backdrop = `https://images.metahub.space/background/medium/${imdbId}/img`;

      if (data.Response === 'True') {
        if (data.Plot && data.Plot !== 'N/A') {
          description = await translate(data.Plot);
        }
        if (data.imdbRating && data.imdbRating !== 'N/A') {
          rating = parseFloat(data.imdbRating);
        }
        if (data.Director && data.Director !== 'N/A') {
          director = data.Director;
        }
        if (data.Actors && data.Actors !== 'N/A') {
          cast = data.Actors.split(', ');
        }
        if (data.Genre && data.Genre !== 'N/A') {
          genres = translateGenres(data.Genre);
        }
        if (data.Rated && data.Rated !== 'N/A') {
          ageRating = data.Rated;
        }
        if (data.Poster && data.Poster !== 'N/A') {
          image = data.Poster;
        }
      }

      if (extraTags && extraTags.includes('dorama')) {
        genres.push('Dorama');
      }

      const movieObj = {
        id: `movie-${imdbId.replace('tt', '')}`,
        title,
        year,
        type: "ContentType.MOVIE",
        rating,
        image,
        backdrop,
        description,
        platform: 'Outros',
        videoUrl,
        imdbId,
        isFeatured: false,
        director,
        cast,
        genres,
        ageRating
      };

      newMovies.push(movieObj);
    } catch (e) {
      console.error("Error processing", imdbId, e);
    }
  }

  fs.writeFileSync('new_movies.json', JSON.stringify(newMovies, null, 2));
  console.log("Done! Wrote to new_movies.json");
}

processMovies();
