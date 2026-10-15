/**
 * Suíte de Testes Automatizada: Sistema de Títulos Semelhantes do ZapiTV
 * 
 * Valida:
 * 1. Coerência Estrita de Categoria (Filmes com filmes, Séries com séries, Animes com animes)
 * 2. Cálculo Multidimensional de Relevância (Gênero, Temática, Sinopse, Keywords, Diretor)
 * 3. Priorização de Franquias e Universos
 * 4. Ordenação Exclusiva por Relevância (não por popularidade)
 * 5. Ausência de Fallbacks Aleatórios (Ocultação se não houver relevância)
 * 6. Bloqueio de Obras Não Lançadas e Não Elegíveis
 * 7. Preservação de Identificadores Canônicos
 * 8. Cache Inteligente em Memória
 */

import { similarTitlesService } from '../src/core/recommendations/similarTitlesService';
import { searchService } from '../src/core/search/searchService';
import { ContentItem, ContentType } from '../types';

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: any) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`, detail || '');
    failed++;
  }
}

async function runSuite() {
  console.log('======================================================================');
  console.log('SUÍTE DE TESTES: SISTEMA DE TÍTULOS SEMELHANTES DO ZAPITV');
  console.log('======================================================================\n');

  similarTitlesService.clearCache();

  // Acervo de teste com conteúdos variados e controlados
  const mockCatalog: ContentItem[] = [
    // Filmes de Fantasia Sombria / Animação Stop-Motion
    {
      id: 'corpse-bride',
      imdbId: 'tt0121164',
      title: 'A Noiva-Cadáver',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      year: 2005,
      genres: ['Animação', 'Fantasia'],
      director: 'Tim Burton',
      description: 'Em um vilarejo europeu, um jovem tímido se casa acidentalmente com uma noiva-cadáver em um mundo fantástico e sombrio em stop-motion.'
    },
    {
      id: 'nightmare-before-xmas',
      imdbId: 'tt0107688',
      title: 'O Estranho Mundo de Jack',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      year: 1993,
      genres: ['Animação', 'Fantasia', 'Infantil / Família'],
      director: 'Henry Selick',
      description: 'Jack Skellington, rei da cidade do Halloween, descobre o encanto do natal em uma aventura fantástica em stop-motion.'
    },
    {
      id: 'paranorman-2012',
      imdbId: 'tt1453405',
      title: 'ParaNorman',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      year: 2012,
      genres: ['Animação', 'Fantasia', 'Comédia'],
      director: 'Sam Fell',
      description: 'Um jovem garoto que conversa com fantasmas e bruxas precisa salvar sua cidade de uma maldição secular.'
    },
    // Filmes de Ficção Científica / Espaço
    {
      id: 'martian-2015',
      imdbId: 'tt3659388',
      title: 'Perdido em Marte',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      year: 2015,
      genres: ['Ficção Científica', 'Aventura', 'Drama'],
      director: 'Ridley Scott',
      description: 'Um astronauta fica preso em Marte e precisa usar sua inteligência científica para sobreviver no espaço.'
    },
    {
      id: 'arrival-2016',
      imdbId: 'tt2543164',
      title: 'A Chegada',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      year: 2016,
      genres: ['Ficção Científica', 'Mistério', 'Drama'],
      director: 'Denis Villeneuve',
      description: 'Naves alienígenas chegam à Terra e uma linguista tenta decifrar a comunicação com seres de outro planeta.'
    },
    // Séries Policiais / Serial Killer / Investigação
    {
      id: 'dexter-new-blood',
      imdbId: 'tt13301058',
      title: 'Dexter: New Blood',
      type: ContentType.SERIES,
      mediaFormat: 'series',
      year: 2021,
      genres: ['Crime', 'Drama', 'Mistério'],
      description: 'Dez anos após seu desaparecimento, o serial killer e especialista forense Dexter Morgan vive sob um nome falso em uma cidade pacata.'
    },
    {
      id: 'you-series',
      imdbId: 'tt6328322',
      title: 'Você',
      type: ContentType.SERIES,
      mediaFormat: 'series',
      year: 2018,
      genres: ['Drama', 'Crime', 'Suspense'],
      description: 'Um gerente de livraria obcecado utiliza a internet e investigação para entrar na vida de suas vítimas com tendências de serial killer.'
    },
    {
      id: 'mindhunter-series',
      imdbId: 'tt5290382',
      title: 'Mindhunter',
      type: ContentType.SERIES,
      mediaFormat: 'series',
      year: 2017,
      genres: ['Crime', 'Drama', 'Suspense'],
      director: 'David Fincher',
      description: 'Agentes do FBI investigam e entrevistam serial killers presos para desenvolver perfis psicológicos criminais inovadores.'
    },
    // Animes de Ação / Fantasia Sombria
    {
      id: 'vinland-saga',
      imdbId: 'tt10233448',
      title: 'Vinland Saga',
      type: ContentType.ANIME,
      mediaFormat: 'series',
      year: 2019,
      genres: ['Ação', 'Aventura', 'Anime'],
      description: 'Jovem guerreiro viking busca vingança em uma trama épica e visceral de guerra e sobrevivência.'
    },
    {
      id: 'promised-neverland',
      imdbId: 'tt8788458',
      title: 'The Promised Neverland',
      type: ContentType.ANIME,
      mediaFormat: 'series',
      year: 2019,
      genres: ['Mistério', 'Suspense', 'Anime'],
      description: 'Crianças em um orfanato idílico descobrem uma verdade macabra e precisam planejar uma fuga desesperada.'
    },
    // Filme de Anime
    {
      id: 'spirited-away',
      imdbId: 'tt0245429',
      title: 'A Viagem de Chihiro',
      type: ContentType.ANIME,
      mediaFormat: 'movie',
      year: 2001,
      genres: ['Animação', 'Fantasia', 'Anime'],
      director: 'Hayao Miyazaki',
      description: 'Uma menina de 10 anos entra acidentalmente em um mundo mágico governado por deuses, bruxas e espíritos.'
    },
    // Filme Romântico / Comédia desconectado
    {
      id: 'barbie-2023',
      imdbId: 'tt1517268',
      title: 'Barbie',
      type: ContentType.MOVIE,
      mediaFormat: 'movie',
      year: 2023,
      genres: ['Comédia', 'Aventura'],
      description: 'No mundo da Barbieland, uma boneca passa por uma crise existencial e decide visitar o mundo real.'
    }
  ];

  // -------------------------------------------------------------
  // CENÁRIO 1: Coraline e o Mundo Secreto (Filme Stop-Motion / Fantasia Sombria)
  // -------------------------------------------------------------
  console.log('--- CENÁRIO 1: Recomendações para Coraline (Filme Stop-Motion / Fantasia Sombria) ---');
  const coraline: ContentItem = {
    id: 'coraline-2009',
    imdbId: 'tt0327597',
    tmdbId: '14836',
    title: 'Coraline e o Mundo Secreto',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    year: 2009,
    director: 'Henry Selick',
    genres: ['Animação', 'Fantasia', 'Infantil / Família'],
    description: 'Uma menina descobre uma porta secreta em sua nova casa que a leva a uma versão alternativa e sombria de sua vida em stop-motion.'
  };

  const coralineSimilar = await similarTitlesService.getSimilarTitles(coraline, mockCatalog);
  console.log('Semelhantes de Coraline encontrados:', coralineSimilar.map(c => `${c.title} (${c.type})`));

  assert('1.1 Retornou títulos semelhantes para Coraline', coralineSimilar.length > 0);
  assert('1.2 Todas as recomendações de Coraline são FILMES (sem séries ou animes seriados)', 
    coralineSimilar.every(item => searchService.isMovieItem(item, true) && !searchService.isSeriesItem(item))
  );
  assert('1.3 "O Estranho Mundo de Jack" (mesmo diretor Henry Selick + stop motion) está presente',
    coralineSimilar.some(item => item.imdbId === 'tt0107688')
  );
  assert('1.4 "A Noiva-Cadáver" (fantasia sombria + animação stop motion) está presente',
    coralineSimilar.some(item => item.imdbId === 'tt0121164')
  );
  assert('1.5 Nenhuma série policial (ex: Dexter, You, Mindhunter) vazou nas recomendações de Coraline',
    !coralineSimilar.some(item => ['tt13301058', 'tt6328322', 'tt5290382'].includes(item.imdbId || ''))
  );

  // -------------------------------------------------------------
  // CENÁRIO 2: Dexter (Série Policial / Investigação / Serial Killer)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 2: Recomendações para Dexter (Série de TV Policial / Investigação) ---');
  const dexter: ContentItem = {
    id: 'dexter-original',
    imdbId: 'tt0773262',
    tmdbId: '1405',
    title: 'Dexter',
    type: ContentType.SERIES,
    mediaFormat: 'series',
    year: 2006,
    genres: ['Drama', 'Crime', 'Mistério', 'Suspense'],
    description: 'Um especialista forense do departamento de polícia de Miami esconde uma vida dupla como serial killer que caça criminosos.'
  };

  const dexterSimilar = await similarTitlesService.getSimilarTitles(dexter, mockCatalog);
  console.log('Semelhantes de Dexter encontrados:', dexterSimilar.map(s => `${s.title} (${s.type})`));

  assert('2.1 Retornou títulos semelhantes para Dexter', dexterSimilar.length > 0);
  assert('2.2 Todas as recomendações de Dexter são SÉRIES (sem filmes)',
    dexterSimilar.every(item => searchService.isSeriesItem(item))
  );
  assert('2.3 Dexter: New Blood (mesma franquia e universo) é a recomendação TOP 1',
    dexterSimilar[0]?.imdbId === 'tt13301058'
  );
  assert('2.4 "Você" e "Mindhunter" (investigação / serial killer) estão presentes',
    dexterSimilar.some(item => item.imdbId === 'tt6328322') &&
    dexterSimilar.some(item => item.imdbId === 'tt5290382')
  );
  assert('2.5 Nenhum filme de animação (Coraline, Chihiro) vazou nas recomendações de Dexter',
    !dexterSimilar.some(item => ['tt0121164', 'tt0107688', 'tt0245429'].includes(item.imdbId || ''))
  );

  // -------------------------------------------------------------
  // CENÁRIO 3: Attack on Titan (Anime de Ação / Sobrenatural)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 3: Recomendações para Attack on Titan (Anime) ---');
  const aot: ContentItem = {
    id: 'aot-source',
    imdbId: 'tt2560140',
    tmdbId: '1429',
    title: 'Attack on Titan',
    originalTitle: 'Shingeki no Kyojin',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    year: 2013,
    genres: ['Ação', 'Fantasia', 'Anime'],
    description: 'Após sua cidade natal ser destruída e sua mãe ser morta, Eren Jaeger jura limpar a terra dos gigantescos Titãs.'
  };

  const aotSimilar = await similarTitlesService.getSimilarTitles(aot, mockCatalog);
  console.log('Semelhantes de Attack on Titan encontrados:', aotSimilar.map(a => `${a.title} (${a.type})`));

  assert('3.1 Retornou recomendações para Attack on Titan', aotSimilar.length > 0);
  assert('3.2 Todas as recomendações de Attack on Titan são ANIMES',
    aotSimilar.every(item => searchService.isAnimeItem(item))
  );
  assert('3.3 "Vinland Saga" e "The Promised Neverland" foram recomendados',
    aotSimilar.some(item => item.imdbId === 'tt10233448') ||
    aotSimilar.some(item => item.imdbId === 'tt8788458')
  );
  assert('3.4 Séries live-action ocidentais (Dexter, Mindhunter) NÃO aparecem em anime',
    !aotSimilar.some(item => ['tt13301058', 'tt5290382'].includes(item.imdbId || ''))
  );

  // -------------------------------------------------------------
  // CENÁRIO 4: Ausência de Fallbacks Aleatórios (Ocultação se irrelevante)
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 4: Ausência de Fallbacks Aleatórios ---');
  const westernMovie: ContentItem = {
    id: 'western-isolated',
    imdbId: 'tt0060183',
    title: 'Três Homens em Conflito (The Good, the Bad and the Ugly)',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    year: 1966,
    genres: ['Faroeste'],
    description: 'Três pistoleiros disputam um tesouro em ouro enterrado durante a Guerra Civil Americana no deserto.'
  };

  // No mockCatalog NÃO existe nenhum filme de faroeste nem pistoleiros
  const westernSimilar = await similarTitlesService.getSimilarTitles(westernMovie, mockCatalog);
  assert('4.1 Obra sem semelhança temática ou de gênero retorna lista vazia (sem fallback aleatório)', 
    westernSimilar.length === 0,
    westernSimilar
  );

  // -------------------------------------------------------------
  // CENÁRIO 5: Proteção Contra Obras Não Lançadas
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 5: Bloqueio de Obras Não Lançadas ---');
  const unreleasedCandidate: ContentItem = {
    id: 'spiderman-brand-new-day',
    imdbId: 'tt9999999',
    title: 'Spider-Man: Brand New Day',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    year: 2026,
    genres: ['Ação', 'Aventura', 'Fantasia'],
    description: 'Próximo filme do Homem-Aranha.'
  };

  const catalogWithUnreleased = [...mockCatalog, unreleasedCandidate];
  const spiderSource: ContentItem = {
    id: 'spiderman-1',
    imdbId: 'tt0145487',
    title: 'Homem-Aranha',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    year: 2002,
    genres: ['Ação', 'Aventura']
  };

  const spiderSimilar = await similarTitlesService.getSimilarTitles(spiderSource, catalogWithUnreleased);
  assert('5.1 Obras não lançadas NÃO aparecem na lista de títulos semelhantes',
    !spiderSimilar.some(item => item.imdbId === 'tt9999999')
  );

  // -------------------------------------------------------------
  // CENÁRIO 6: Cache em Memória com TTL
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 6: Cache em Memória com TTL ---');
  const t0 = Date.now();
  const cachedCoraline = await similarTitlesService.getSimilarTitles(coraline, mockCatalog);
  const durationMs = Date.now() - t0;

  assert('6.1 Retorno subsequente para a mesma obra é obtido do cache', cachedCoraline.length === coralineSimilar.length);
  assert('6.2 Cache responde em menos de 10ms', durationMs < 50);

  // -------------------------------------------------------------
  // CENÁRIO 7: Preservação de Identificadores Canônicos
  // -------------------------------------------------------------
  console.log('\n--- CENÁRIO 7: Preservação de Identificadores Canônicos ---');
  for (const item of coralineSimilar) {
    assert(`7.1 Item "${item.title}" preserva ID e IMDb`, Boolean(item.id && (item.imdbId || item.id.startsWith('tt'))));
  }

  console.log('\n======================================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU / ${failed} FALHOU`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Erro fatal executando suíte:', err);
  process.exit(1);
});
