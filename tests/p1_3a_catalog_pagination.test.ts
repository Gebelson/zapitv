import assert from 'node:assert/strict';
import { catalogDiscoveryService } from '../src/core/catalog/CatalogDiscoveryService';
import { CatalogPaginationSession } from '../src/core/catalog/catalogPaginationSession';
import { deduplicateContentItems, getCanonicalKeysForItem } from '../src/core/catalog/catalogDeduplication';
import { canonicalCatalogMaster } from '../src/core/catalog/CanonicalCatalogMaster';
import { ContentType, ContentItem } from '../types';

async function runTestSuite() {
  console.log('========================================================================');
  console.log('=== ZapiTV | P1.3A — Validação de Catálogo Completo e Paginação Real ===');
  console.log('========================================================================\n');

  const stats = {
    movies: { pages: 0, uniqueTitles: 0, eofReached: false },
    series: { pages: 0, uniqueTitles: 0, eofReached: false },
    animes: { pages: 0, uniqueTitles: 0, eofReached: false },
    finiteEndpoints: { adultMoviesEof: false, adultSeriesEof: false, fWesternSeriesEof: false }
  };

  // -------------------------------------------------------------------------
  // 1. Paginação Real de Filmes (Movies)
  // -------------------------------------------------------------------------
  console.log('1. Testando Paginação Real de Filmes (Páginas 1 a 6)...');
  catalogDiscoveryService.clearCache();
  let moviesAccumulated: ContentItem[] = [];
  const moviePageSizes: number[] = [];

  for (let p = 1; p <= 6; p++) {
    const res = await catalogDiscoveryService.discoverMovies(p);
    assert.equal(res.page, p, `A página retornada (${res.page}) deve coincidir com a requisitada (${p})`);
    assert.ok(res.items.length > 0, `Página ${p} de filmes deve conter itens`);
    assert.equal(res.hasMore, true, `Página ${p} de filmes do acervo amplo deve indicar hasMore=true`);
    moviePageSizes.push(res.items.length);
    moviesAccumulated = deduplicateContentItems([...moviesAccumulated, ...res.items]);
  }
  stats.movies.pages = 6;
  stats.movies.uniqueTitles = moviesAccumulated.length;
  assert.ok(moviesAccumulated.length >= 150, `Filmes: Esperado pelo menos 150 títulos únicos nas primeiras 6 páginas, obtido ${moviesAccumulated.length}`);
  console.log(`✓ Filmes: 6 páginas verificadas, ${moviesAccumulated.length} títulos únicos (lotes: ${moviePageSizes.join(', ')}).`);

  // -------------------------------------------------------------------------
  // 2. Paginação Real de Séries (Series)
  // -------------------------------------------------------------------------
  console.log('\n2. Testando Paginação Real de Séries (Páginas 1 a 6)...');
  catalogDiscoveryService.clearCache();
  let seriesAccumulated: ContentItem[] = [];
  const seriesPageSizes: number[] = [];

  for (let p = 1; p <= 6; p++) {
    const res = await catalogDiscoveryService.discoverSeries(p);
    assert.equal(res.page, p, `A página de séries (${res.page}) deve coincidir com ${p}`);
    assert.ok(res.items.length > 0, `Página ${p} de séries deve conter itens`);
    assert.equal(res.hasMore, true, `Página ${p} de séries deve indicar hasMore=true`);
    seriesPageSizes.push(res.items.length);
    seriesAccumulated = deduplicateContentItems([...seriesAccumulated, ...res.items]);
  }
  stats.series.pages = 6;
  stats.series.uniqueTitles = seriesAccumulated.length;
  assert.ok(seriesAccumulated.length >= 110, `Séries: Esperado pelo menos 110 títulos únicos nas primeiras 6 páginas, obtido ${seriesAccumulated.length}`);
  console.log(`✓ Séries: 6 páginas verificadas, ${seriesAccumulated.length} títulos únicos (lotes: ${seriesPageSizes.join(', ')}).`);

  // -------------------------------------------------------------------------
  // 3. Paginação Real de Animes (Animes: Séries + Longas + AniList)
  // -------------------------------------------------------------------------
  console.log('\n3. Testando Paginação Real de Animes (Páginas 1 a 6)...');
  catalogDiscoveryService.clearCache();
  let animesAccumulated: ContentItem[] = [];
  const animePageSizes: number[] = [];

  for (let p = 1; p <= 6; p++) {
    const res = await catalogDiscoveryService.discoverAnimes(p);
    assert.equal(res.page, p, `A página de animes (${res.page}) deve coincidir com ${p}`);
    assert.ok(res.items.length > 0, `Página ${p} de animes deve conter itens`);
    assert.equal(res.hasMore, true, `Página ${p} de animes deve indicar hasMore=true`);
    animePageSizes.push(res.items.length);
    animesAccumulated = deduplicateContentItems([...animesAccumulated, ...res.items]);
  }
  stats.animes.pages = 6;
  stats.animes.uniqueTitles = animesAccumulated.length;
  assert.ok(animesAccumulated.length >= 250, `Animes: Esperado pelo menos 250 títulos únicos nas primeiras 6 páginas, obtido ${animesAccumulated.length}`);
  console.log(`✓ Animes: 6 páginas verificadas, ${animesAccumulated.length} títulos únicos (lotes: ${animePageSizes.join(', ')}).`);

  // -------------------------------------------------------------------------
  // 4. Chegada ao Final Real do Catálogo (hasMore=false verificável em fontes finitas)
  // -------------------------------------------------------------------------
  console.log('\n4. Testando Chegada ao Final Real do Catálogo (hasMore=false)...');
  
  // 4a. Filmes Adultos: esgota na página 2
  const adultMoviesP1 = await catalogDiscoveryService.discoverMovies(1, 'Adulto');
  const adultMoviesP2 = await catalogDiscoveryService.discoverMovies(2, 'Adulto');
  assert.equal(adultMoviesP1.hasMore, true, 'Filmes Adulto P1 deve ter hasMore=true');
  assert.equal(adultMoviesP2.hasMore, false, 'Filmes Adulto P2 deve ter hasMore=false (fim confirmado)');
  assert.equal(adultMoviesP2.items.length, 0, 'Filmes Adulto P2 deve ter 0 itens após esgotamento');
  stats.finiteEndpoints.adultMoviesEof = true;
  console.log(`✓ Filmes Adulto: Fim real alcançado na página 2 (P1: ${adultMoviesP1.items.length} itens, P2: 0 itens, hasMore=false).`);

  // 4b. Séries Adultas: esgota na página 2
  const adultSeriesP1 = await catalogDiscoveryService.discoverSeries(1, 'Adulto');
  const adultSeriesP2 = await catalogDiscoveryService.discoverSeries(2, 'Adulto');
  assert.equal(adultSeriesP1.hasMore, true, 'Séries Adulto P1 deve ter hasMore=true');
  assert.equal(adultSeriesP2.hasMore, false, 'Séries Adulto P2 deve ter hasMore=false (fim confirmado)');
  assert.equal(adultSeriesP2.items.length, 0, 'Séries Adulto P2 deve ter 0 itens após esgotamento');
  stats.finiteEndpoints.adultSeriesEof = true;
  console.log(`✓ Séries Adulto: Fim real alcançado na página 2 (P1: ${adultSeriesP1.items.length} itens, P2: 0 itens, hasMore=false).`);

  // 4c. Séries Faroeste (Western): categoria delimitada que encerra em P21
  const westernP20 = await catalogDiscoveryService.discoverSeries(20, 'Faroeste');
  const westernP21 = await catalogDiscoveryService.discoverSeries(21, 'Faroeste');
  assert.equal(westernP20.hasMore, true, 'Séries Faroeste P20 ainda possui resultados finais');
  assert.equal(westernP21.hasMore, false, 'Séries Faroeste P21 confirma hasMore=false');
  assert.equal(westernP21.items.length, 0, 'Séries Faroeste P21 retorna lote vazio');
  stats.finiteEndpoints.fWesternSeriesEof = true;
  console.log(`✓ Séries Faroeste: Fim real alcançado e comprovado na página 21 (P20: ${westernP20.items.length} itens, P21: 0 itens, hasMore=false).`);

  // -------------------------------------------------------------------------
  // 5. Sessão de Paginação (CatalogPaginationSession): Cursores, Concorrência e Cooldown
  // -------------------------------------------------------------------------
  console.log('\n5. Testando CatalogPaginationSession (Controle de Cursors, Cooldown e Estados)...');
  let mockClock = 10000;
  let mockMode: 'normal' | 'partial' | 'error' = 'normal';
  const requestedPages: number[] = [];

  const session = new CatalogPaginationSession(async (page: number) => {
    requestedPages.push(page);
    if (mockMode === 'error') {
      throw new Error('NETWORK_TIMEOUT_SIMULATION');
    }
    return {
      items: page > 3 ? [] : Array.from({ length: 10 }, (_, i) => ({
        id: `mock-item-${page}-${i}`,
        title: `Mock Item ${page}-${i}`,
        type: ContentType.MOVIE,
        year: 2024
      })),
      page,
      hasMore: page < 3,
      isPartial: mockMode === 'partial',
      totalDiscovered: page * 10,
      totalAvailable: 30
    };
  }, 0, () => mockClock);

  assert.equal(session.getPage(), 0, 'Cursor inicial deve ser 0');
  assert.equal(session.isExhausted(), false, 'Não deve iniciar exaurido');

  // Carrega página 1
  const s1 = await session.loadNext();
  assert.equal(s1?.page, 1);
  assert.equal(session.getPage(), 1);
  assert.equal(session.isExhausted(), false);

  // Simula erro de rede na página 2
  mockMode = 'error';
  await assert.rejects(session.loadNext(), /NETWORK_TIMEOUT_SIMULATION/);
  assert.equal(session.getPage(), 1, 'Cursor NÃO deve avançar em caso de erro');
  assert.equal(session.isExhausted(), false, 'Falha de rede NÃO deve ser interpretada como fim de catálogo');

  // Cooldown de 3 segundos
  assert.equal(await session.loadNext(), null, 'Tentativa dentro do cooldown deve retornar null');
  mockClock += 3001; // Avança o relógio além do cooldown
  mockMode = 'normal';

  // Retenta a página 2 com sucesso
  const s2 = await session.loadNext();
  assert.equal(s2?.page, 2, 'Após restabelecimento, retoma da página 2 sem pular páginas');
  assert.equal(session.getPage(), 2);

  // Simula resposta parcial (ex: uma fonte secundária falhou)
  mockMode = 'partial';
  const s3 = await session.loadNext();
  assert.equal(s3?.isPartial, true);
  assert.equal(session.getPage(), 2, 'Resposta parcial não avança a página definitiva');
  assert.equal(session.isExhausted(), false, 'Resposta parcial NUNCA deve esgotar o catálogo prematuramente');

  mockClock += 3001;
  mockMode = 'normal';
  const s3Success = await session.loadNext();
  assert.equal(s3Success?.page, 3);
  assert.equal(session.getPage(), 3);
  assert.equal(session.isExhausted(), true, 'Página 3 (hasMore=false) deve marcar exhausted=true');

  // Tentativas após esgotamento
  const s4 = await session.loadNext();
  assert.equal(s4, null, 'Sessão esgotada deve retornar null sem novas requisições');
  console.log('✓ CatalogPaginationSession: Proteção contra pular páginas, isolamento de falhas e fim correto validados.');

  // -------------------------------------------------------------------------
  // 6. Deduplicação Canônica Cross-Page e Aliases
  // -------------------------------------------------------------------------
  console.log('\n6. Testando Deduplicação Canônica e Unicidade Cross-Page...');

  const itemA: ContentItem = {
    id: 'movie-100',
    imdbId: 'tt1234567',
    tmdbId: '550',
    title: 'Filme Canônico',
    type: ContentType.MOVIE,
    year: 2023
  };

  const itemA_alias: ContentItem = {
    id: 'tmdb-movie-550',
    imdbId: '',
    tmdbId: '550',
    title: 'Filme Canônico',
    type: ContentType.MOVIE,
    year: 2023,
    overview: 'Sinopse adicional recebida na página 2'
  };

  const itemB: ContentItem = {
    id: 'tt9999999',
    title: 'Outro Filme',
    type: ContentType.MOVIE,
    year: 2024
  };

  const dedupedList = deduplicateContentItems([itemA, itemA_alias, itemB]);
  assert.equal(dedupedList.length, 2, 'Itens que compartilham TMDb ID/IMDb ID devem ser unificados em 1 único card');
  assert.equal(dedupedList[0].imdbId, 'tt1234567', 'Metadados de IMDb devem ser preservados');
  assert.equal(dedupedList[0].overview, 'Sinopse adicional recebida na página 2', 'Metadados adicionais devem enriquecer o item original');
  console.log('✓ Deduplicação Canônica: Unificação de TMDb/IMDb e aliases confirmada sem duplicações.');

  // -------------------------------------------------------------------------
  // 7. Filtros e Isolamento de Estado
  // -------------------------------------------------------------------------
  console.log('\n7. Testando Filtros e Isolamento durante a Paginação...');
  catalogDiscoveryService.clearCache();
  const dramaP1 = await catalogDiscoveryService.discoverMovies(1, 'Drama');
  const actionP1 = await catalogDiscoveryService.discoverMovies(1, 'Ação');
  const allP1 = await catalogDiscoveryService.discoverMovies(1, 'Todos');

  assert.ok(dramaP1.items.length > 0, 'Filtro Drama deve retornar itens');
  assert.ok(actionP1.items.length > 0, 'Filtro Ação deve retornar itens');
  assert.ok(allP1.items.length > 0, 'Filtro Todos deve retornar itens');

  // Garante que o cache por categoria/gênero é estritamente isolado
  assert.notEqual(
    dramaP1.items.map(i => i.id).join(','),
    actionP1.items.map(i => i.id).join(','),
    'Filtros diferentes não podem compartilhar os mesmos resultados'
  );
  console.log('✓ Filtros: Isolamento de cache entre gêneros e recuperação íntegra validados.');

  // -------------------------------------------------------------------------
  // 8. Validação de Adaptações TV e Mobile
  // -------------------------------------------------------------------------
  console.log('\n8. Testando Integração com Modos TV e Mobile...');
  
  // Teste TV: Cursor inicializado com items já carregados (ex: 40 items = página 2)
  const tvSession = new CatalogPaginationSession(
    async (p) => ({ items: [], page: p, hasMore: true, totalAvailable: 100, totalDiscovered: p * 20 }),
    2 // inicia na página 2
  );
  assert.equal(tvSession.getPage(), 2, 'TV deve poder inicializar cursor na página 2');
  const tvNext = await tvSession.loadNext();
  assert.equal(tvNext?.page, 3, 'Primeira solicitação de scroll na TV deve buscar diretamente a página 3');

  console.log('✓ Adaptação TV: Inicialização de cursor inteligente previne requisições redundantes de páginas 1 e 2.');

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS TESTES DE PAGINAÇÃO REAL E CATÁLOGO P1.3A PASSARAM COM SUCESSO!');
  console.log('========================================================================\n');
  console.log('Resumo dos Dados Reais:');
  console.log(`- Filmes: 6 páginas verificadas, ${stats.movies.uniqueTitles} títulos únicos.`);
  console.log(`- Séries: 6 páginas verificadas, ${stats.series.uniqueTitles} títulos únicos.`);
  console.log(`- Animes: 6 páginas verificadas, ${stats.animes.uniqueTitles} títulos únicos.`);
  console.log('- Fim real comprovado em categorias delimitadas (Filmes Adulto P2, Séries Adulto P2, Faroeste P21).');
  console.log('- Deduplicação e unicidade canônica ativas e verificadas em todas as categorias.');
}

runTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Falha no teste P1.3A:', err);
    process.exit(1);
  });
