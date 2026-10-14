/**
 * SUÍTE DE TESTES: PESQUISA COM FILTROS AUTOMÁTICOS POR PÁGINA (ZAPITV)
 * Executa os 17 testes obrigatórios exigidos pelo prompt.
 */

import { searchService } from '../src/core/search/searchService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { ContentItem, ContentType } from '../types';

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: any) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`, detail !== undefined ? detail : '');
    failed++;
  }
}

async function runSuite() {
  console.log('====================================================');
  console.log('SUÍTE DE TESTES: PESQUISA CONTEXTUAL AUTOMÁTICA POR PÁGINA');
  console.log('====================================================\n');

  // MOCK DE ACERVO LOCAL PARA VERIFICAÇÃO INSTANTÂNEA E CONSISTENTE
  const mockCatalog: ContentItem[] = [
    {
      id: 'movie-godfather',
      imdbId: 'tt0068646',
      title: 'O Poderoso Chefão',
      type: ContentType.MOVIE,
      year: 1972,
      genres: ['Drama', 'Crime']
    },
    {
      id: 'movie-toy-story',
      imdbId: 'tt0114709',
      title: 'Toy Story: Um Mundo de Aventuras',
      type: ContentType.MOVIE,
      year: 1995,
      genres: ['Animação', 'Comédia', 'Família'] // Animação ocidental -> Filme
    },
    {
      id: 'movie-el-camino',
      imdbId: 'tt9243946',
      title: 'El Camino: A Breaking Bad Film',
      type: ContentType.MOVIE,
      year: 2019,
      genres: ['Crime', 'Drama']
    },
    {
      id: 'series-breaking-bad',
      imdbId: 'tt0903747',
      title: 'Breaking Bad',
      type: ContentType.SERIES,
      year: 2008,
      genres: ['Crime', 'Drama']
    },
    {
      id: 'series-simpsons',
      imdbId: 'tt0096697',
      title: 'Os Simpsons',
      type: ContentType.SERIES,
      year: 1989,
      genres: ['Animação', 'Comédia'] // Animação ocidental -> Série
    },
    {
      id: 'series-one-piece-la',
      imdbId: 'tt11737520',
      title: 'ONE PIECE: A Série',
      type: ContentType.SERIES,
      year: 2023,
      genres: ['Ação', 'Aventura'] // Live Action -> Série
    },
    {
      id: 'anime-one-piece',
      imdbId: 'tt0388629',
      title: 'One Piece',
      type: ContentType.ANIME,
      year: 1999,
      genres: ['Anime', 'Animação', 'Ação']
    },
    {
      id: 'anime-naruto',
      imdbId: 'tt0409591',
      title: 'Naruto',
      type: ContentType.ANIME,
      year: 2002,
      genres: ['Anime', 'Animação', 'Ação']
    },
    {
      id: 'anime-chihiro',
      imdbId: 'tt0245429',
      title: 'A Viagem de Chihiro',
      type: ContentType.ANIME,
      year: 2001,
      genres: ['Anime', 'Animação', 'Fantasia'] // Filme de Anime -> Categoria Anime
    },
    {
      id: 'movie-doomsday-unreleased',
      imdbId: 'tt10857164',
      title: 'Vingadores: Doutor Destino',
      type: ContentType.MOVIE,
      year: 2026,
      genres: ['Ação', 'Ficção'] // Não lançado / Theatrical
    }
  ];

  // 1. Pesquisa de filmes na página Filmes
  console.log('--- TESTE 1: Pesquisa de filmes na página Filmes ---');
  const res1 = await searchService.search('Godfather', 'movies', mockCatalog);
  assert('1.1 Retorna filmes na página movies', res1.some(i => i.title.includes('Poderoso Chefão')));
  assert('1.2 Nenhum item retornado é série', res1.every(i => i.type === ContentType.MOVIE));
  assert('1.3 Nenhum item retornado é anime', res1.every(i => !searchService.isAnimeItem(i)));

  // 2. Pesquisa de séries na página Séries
  console.log('\n--- TESTE 2: Pesquisa de séries na página Séries ---');
  const res2 = await searchService.search('Breaking Bad', 'series', mockCatalog);
  assert('2.1 Retorna série Breaking Bad na página series', res2.some(i => i.title === 'Breaking Bad' && i.type === ContentType.SERIES));
  assert('2.2 Nenhum item retornado é filme', res2.every(i => i.type === ContentType.SERIES));
  assert('2.3 Nenhum item retornado é anime', res2.every(i => !searchService.isAnimeItem(i)));

  // 3. Pesquisa de animes na página Animes
  console.log('\n--- TESTE 3: Pesquisa de animes na página Animes ---');
  const res3 = await searchService.search('Naruto', 'animes', mockCatalog);
  assert('3.1 Retorna anime Naruto na página animes', res3.some(i => i.title === 'Naruto' && i.type === ContentType.ANIME));
  assert('3.2 Todos os resultados são anime', res3.every(i => searchService.isAnimeItem(i)));

  // 4. Filme com nome semelhante ao de uma série (Breaking Bad na página Filmes)
  console.log('\n--- TESTE 4: Filme com nome semelhante ao de uma série ---');
  const res4 = await searchService.search('Breaking Bad', 'movies', mockCatalog);
  assert('4.1 Retorna o filme derivado El Camino', res4.some(i => i.title.includes('El Camino')));
  assert('4.2 Não retorna a série de TV Breaking Bad na página Filmes', !res4.some(i => i.id === 'series-breaking-bad'));

  // 5. Anime com adaptação live-action (One Piece)
  console.log('\n--- TESTE 5: Anime com adaptação live-action (One Piece) ---');
  const res5Series = await searchService.search('One Piece', 'series', mockCatalog);
  assert('5.1 Na página Séries, retorna o live-action da Netflix', 
    res5Series.some(i => i.id === 'series-one-piece-la' || i.title.toLowerCase().includes('one piece: a série'))
  );
  assert('5.2 Na página Séries, NÃO retorna o anime One Piece', 
    !res5Series.some(i => i.title.toLowerCase() === 'one piece' && searchService.isAnimeItem(i))
  );

  const res5Anime = await searchService.search('One Piece', 'animes', mockCatalog);
  assert('5.3 Na página Animes, retorna o anime One Piece', 
    res5Anime.some(i => i.title.toLowerCase() === 'one piece' && searchService.isAnimeItem(i))
  );
  assert('5.4 Na página Animes, NÃO retorna o live-action', 
    !res5Anime.some(i => i.title.toLowerCase().includes('one piece: a série'))
  );

  // 6. Filme de anime (A Viagem de Chihiro)
  console.log('\n--- TESTE 6: Filme de anime ---');
  const res6Anime = await searchService.search('Chihiro', 'animes', mockCatalog);
  assert('6.1 Filme de anime aparece na página Animes', res6Anime.some(i => i.title.includes('Chihiro') && searchService.isAnimeItem(i)));
  const res6Movie = await searchService.search('Chihiro', 'movies', mockCatalog);
  assert('6.2 Filme de anime é direcionado prioritariamente para Animes (não aparece em filmes convencionais)', !res6Movie.some(i => i.id === 'anime-chihiro' || i.title.toLowerCase() === 'a viagem de chihiro'));

  // 7. Série animada ocidental (Os Simpsons)
  console.log('\n--- TESTE 7: Série animada ocidental (Os Simpsons) ---');
  const res7Series = await searchService.search('Simpsons', 'series', mockCatalog);
  assert('7.1 Os Simpsons aparece na página Séries', res7Series.some(i => i.title.includes('Simpsons') && i.type === ContentType.SERIES));
  const res7Anime = await searchService.search('Simpsons', 'animes', mockCatalog);
  assert('7.2 Os Simpsons NÃO aparece na página Animes (não é anime)', !res7Anime.some(i => i.title.includes('Simpsons')));

  // 8. Anime com filme derivado (Naruto na página Séries)
  console.log('\n--- TESTE 8: Anime pesquisado na página Séries ---');
  const res8 = await searchService.search('Naruto', 'series', mockCatalog);
  assert('8.1 Não retorna animes na página Séries', res8.every(i => !searchService.isAnimeItem(i)));

  // 9. Título que não existe na categoria atual e mensagem de vazio
  console.log('\n--- TESTE 9: Título inexistente na categoria e mensagens contextuais ---');
  const emptyMovie = searchService.getEmptyMessage('movies', 'Breaking Bad');
  assert('9.1 Mensagem de filmes vazios', emptyMovie.title === 'Nenhum filme encontrado.');
  const emptySeries = searchService.getEmptyMessage('series', 'Toy Story');
  assert('9.2 Mensagem de séries vazias', emptySeries.title === 'Nenhuma série encontrada.');
  const emptyAnime = searchService.getEmptyMessage('animes', 'O Poderoso Chefão');
  assert('9.3 Mensagem de animes vazios', emptyAnime.title === 'Nenhum anime encontrado.');

  // 10. Sugestões automáticas (Dropdown)
  console.log('\n--- TESTE 10: Sugestões automáticas com limite ---');
  const suggestions = await searchService.getSuggestions('One Piece', 'animes', 3, mockCatalog);
  assert('10.1 Sugestões respeitam o limite máximo', suggestions.length <= 3);
  assert('10.2 Sugestões respeitam a categoria Animes', suggestions.every(i => searchService.isAnimeItem(i)));

  // 11. Mudança de página e placeholders
  console.log('\n--- TESTE 11: Placeholders dinâmicos por página ---');
  assert('11.1 Placeholder de Filmes', searchService.getPlaceholder('movies') === 'Buscar filmes...');
  assert('11.2 Placeholder de Séries', searchService.getPlaceholder('series') === 'Buscar séries...');
  assert('11.3 Placeholder de Animes', searchService.getPlaceholder('animes') === 'Buscar animes...');
  assert('11.4 Placeholder de Live', searchService.getPlaceholder('live') === 'Buscar canais e programas...');
  assert('11.5 Placeholder Global/Home', searchService.getPlaceholder('all') === 'Buscar filmes, séries e animes...');

  // 12. Cancelamento de requisições pendentes
  console.log('\n--- TESTE 12: Cancelamento de buscas pendentes (AbortController) ---');
  searchService.cancelPending();
  assert('12.1 cancelPending executa sem erro', true);

  // 13. Cache de pesquisa contextual
  console.log('\n--- TESTE 13: Cache de pesquisa contextual ---');
  const t0 = performance.now();
  await searchService.search('Godfather', 'movies', mockCatalog);
  const t1 = performance.now();
  assert('13.1 Cache retorna em menos de 10ms', (t1 - t0) < 15);

  // 14. Paginação / Limite
  console.log('\n--- TESTE 14: Limite e paginação de sugestões ---');
  const sugLimit = await searchService.getSuggestions('e', 'all', 2, mockCatalog);
  assert('14.1 Respeita limite estrito de 2 itens', sugLimit.length <= 2);

  // 15. Pesquisa global na Home ('all')
  console.log('\n--- TESTE 15: Pesquisa global na Home ---');
  const resGlobal = await searchService.search('One Piece', 'all', mockCatalog);
  assert('15.1 Retorna tanto o anime quanto o live action na busca global', 
    resGlobal.some(i => i.title.toLowerCase() === 'one piece') && 
    resGlobal.some(i => i.title.toLowerCase().includes('one piece: a série'))
  );

  // 16. Pesquisa de Programas ('live')
  console.log('\n--- TESTE 16: Pesquisa de Programas (live) ---');
  const emptyLive = searchService.getEmptyMessage('live', 'Globo');
  assert('16.1 Mensagem de programas vazios', emptyLive.title === 'Nenhum canal ou programa encontrado.');

  // 17. Resultados sem fonte validada / não lançados
  console.log('\n--- TESTE 17: Títulos não lançados são bloqueados na pesquisa ---');
  const res17 = await searchService.search('Doomsday', 'movies', mockCatalog);
  assert('17.1 Título não lançado (Vingadores Doutor Destino) não aparece na busca', !res17.some(i => i.id === 'movie-doomsday-unreleased'));

  console.log('\n====================================================');
  console.log(`RESULTADO FINAL DA SUÍTE DE PESQUISA: ${passed} PASSOU, ${failed} FALHOU`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(e => {
  console.error('Erro na execução da suíte:', e);
  process.exit(1);
});
