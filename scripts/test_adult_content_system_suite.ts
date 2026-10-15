import { adultContentService } from '../src/core/adult/AdultContentService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { catalogDiscoveryService } from '../src/core/catalog/CatalogDiscoveryService';
import { similarTitlesService } from '../src/core/recommendations/similarTitlesService';
import { searchService } from '../src/core/search/searchService';
import { ContentItem, ContentType, Profile } from '../types';

async function runAdultContentSuite() {
  console.log('========================================================================');
  console.log('🚀 INICIANDO SUÍTE DE TESTES: SISTEMA DE CONTEÚDO ADULTO DO ZAPITV');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // MOCK DE ITENS PARA TESTE
  const mockDexter: ContentItem = {
    id: 'tt0773262',
    imdbId: 'tt0773262',
    title: 'Dexter',
    type: ContentType.SERIES,
    rating: 8.7,
    year: 2006,
    image: 'https://img.dexter.jpg',
    genres: ['Crime', 'Drama', 'Mistério'],
    ageRating: '18+',
    maturityAdvisories: ['violência extrema', 'sangue', 'linguagem imprópria'],
    availabilityStatus: 'verified'
  };

  const mockGameOfThrones: ContentItem = {
    id: 'tt0944947',
    imdbId: 'tt0944947',
    title: 'Game of Thrones',
    type: ContentType.SERIES,
    rating: 9.2,
    year: 2011,
    image: 'https://img.got.jpg',
    genres: ['Ação', 'Aventura', 'Drama', 'Fantasia'],
    ageRating: '18+',
    maturityAdvisories: ['nudez', 'violência', 'conteúdo sexual'],
    availabilityStatus: 'verified'
  };

  const mockPulpFiction: ContentItem = {
    id: 'tt0110912',
    imdbId: 'tt0110912',
    title: 'Pulp Fiction',
    type: ContentType.MOVIE,
    rating: 8.9,
    year: 1994,
    image: 'https://img.pulp.jpg',
    genres: ['Crime', 'Drama'],
    ageRating: '18+',
    availabilityStatus: 'verified'
  };

  const mockAdultMovie: ContentItem = {
    id: 'adult-movie-1',
    title: 'Private Desires Adult Feature',
    type: ContentType.MOVIE,
    rating: 7.0,
    year: 2023,
    image: 'https://img.adult.jpg',
    genres: ['Adult', 'Romance', 'Drama'],
    isAdult: true,
    availabilityStatus: 'verified'
  };

  const mockHentaiAnime: ContentItem = {
    id: 'adult-anime-1',
    title: 'Midnight Fantasy Hentai OVA',
    type: ContentType.ANIME,
    rating: 7.2,
    year: 2022,
    image: 'https://img.hentai.jpg',
    genres: ['Anime', 'Hentai', 'Fantasia'],
    isAdult: true,
    availabilityStatus: 'verified'
  };

  // CENÁRIO 1: Classificação Precisa (Regra 4 - Não confundir 18+ com pornografia)
  console.log('--- 1. Classificação Precisa (Diferenciação de 18+ maduro vs Pornografia) ---');
  {
    assert('Dexter (18+ por violência/investigação) NÃO é classificado como adulto/pornográfico', !adultContentService.isAdultContent(mockDexter));
    assert('Game of Thrones (18+ por nudez/violência) NÃO é classificado como adulto/pornográfico', !adultContentService.isAdultContent(mockGameOfThrones));
    assert('Pulp Fiction (18+ drogas/violência) NÃO é classificado como adulto/pornográfico', !adultContentService.isAdultContent(mockPulpFiction));
    assert('Filme com genre Adult / isAdult é classificado como conteúdo adulto', adultContentService.isAdultContent(mockAdultMovie));
    assert('Anime com genre Hentai é classificado como conteúdo adulto', adultContentService.isAdultContent(mockHentaiAnime));
  }

  // CENÁRIO 2: Ocultar por Padrão (Regra 1 - Nenhuma exibição automática)
  console.log('\n--- 2. Ocultar por Padrão de Todas as Listagens Comuns ---');
  {
    const mixedList = [mockDexter, mockGameOfThrones, mockAdultMovie, mockHentaiAnime, mockPulpFiction];
    const defaultFiltered = catalogEligibilityService.filterEligibleItemsSync(mixedList);

    assert('Lista filtrada por padrão NÃO contém filme adulto', !defaultFiltered.some(it => it.id === mockAdultMovie.id));
    assert('Lista filtrada por padrão NÃO contém hentai anime', !defaultFiltered.some(it => it.id === mockHentaiAnime.id));
    assert('Lista filtrada por padrão mantém Dexter intacto', defaultFiltered.some(it => it.id === mockDexter.id));
    assert('Lista filtrada por padrão mantém Game of Thrones intacto', defaultFiltered.some(it => it.id === mockGameOfThrones.id));
    assert('Lista filtrada por padrão mantém Pulp Fiction intacto', defaultFiltered.some(it => it.id === mockPulpFiction.id));
  }

  // CENÁRIO 3: Isolamento em Títulos Semelhantes (Regras 1 e 7)
  console.log('\n--- 3. Isolamento Estrito em Títulos Semelhantes ---');
  {
    const catalog = [mockDexter, mockGameOfThrones, mockAdultMovie, mockHentaiAnime, mockPulpFiction];
    const similarToDexter = await similarTitlesService.getSimilarTitles(mockDexter, catalog);
    assert('Títulos semelhantes de Dexter NÃO contêm nenhum conteúdo adulto', !similarToDexter.some(it => adultContentService.isAdultContent(it)));

    const immediateSimilar = similarTitlesService.getImmediateSimilar(mockDexter, catalog);
    assert('Títulos semelhantes imediatos de Dexter NÃO contêm conteúdo adulto', !immediateSimilar.some(it => adultContentService.isAdultContent(it)));
  }

  // CENÁRIO 4: Proteção e Controle Parental (Regra 5)
  console.log('\n--- 4. Proteção e Controle Parental ---');
  {
    const adultProfile: Profile = { id: 'prof-adult', name: 'Adulto', avatar: '', isChild: false };
    const childProfile: Profile = { id: 'prof-child', name: 'Criança', avatar: '', isChild: true };

    assert('Perfil adulto pode ter permissão de acesso', adultContentService.canAccessAdult(adultProfile));
    assert('Perfil infantil (isChild: true) é BLOQUEADO de qualquer acesso adulto', !adultContentService.canAccessAdult(childProfile));

    // Teste de confirmação de maioridade
    adultContentService.revokeAgeConfirmation('prof-adult');
    assert('Maioridade inicia não confirmada', !adultContentService.isAgeConfirmed('prof-adult'));
    adultContentService.confirmAge('prof-adult');
    assert('Maioridade confirmada com sucesso', adultContentService.isAgeConfirmed('prof-adult'));
    adultContentService.revokeAgeConfirmation('prof-adult');
  }

  // CENÁRIO 5: Bloqueio Absoluto de Conteúdos Ilegais / Exploração (Regra 5)
  console.log('\n--- 5. Bloqueio com Tolerância Zero para Termos Ilegais ---');
  {
    assert('Detecta e bloqueia termo ilegal CSAM', adultContentService.isIllegalOrExploitative('csam content'));
    assert('Detecta e bloqueia exploração infantil', adultContentService.isIllegalOrExploitative('child porn video'));
    assert('Detecta e bloqueia termo pedofilia', adultContentService.isIllegalOrExploitative('pedophilia query'));
    assert('Título convencional Dexter não é considerado ilegal', !adultContentService.isIllegalOrExploitative('Dexter'));
    assert('Título convencional Coraline não é considerado ilegal', !adultContentService.isIllegalOrExploitative('Coraline'));
  }

  // CENÁRIO 6: Pesquisa Direta vs. Pesquisas Genéricas (Regra 2)
  console.log('\n--- 6. Pesquisa Direta Intencional vs. Genérica ---');
  {
    const titles = ['Private Desires Adult Feature', 'Midnight Fantasy Hentai OVA', 'Dexter'];
    
    // Buscas genéricas não ativam busca adulta
    assert('Busca genérica "ação" não é busca adulta', !adultContentService.isIntentionalAdultSearch('ação', titles));
    assert('Busca genérica "filme" não é busca adulta', !adultContentService.isIntentionalAdultSearch('filme', titles));
    assert('Busca genérica "novo" não é busca adulta', !adultContentService.isIntentionalAdultSearch('novo', titles));
    assert('Busca curta "de" não é busca adulta', !adultContentService.isIntentionalAdultSearch('de', titles));

    // Buscas intencionais por termos ou títulos
    assert('Busca por termo explícito "hentai" é detectada como intencional', adultContentService.isIntentionalAdultSearch('hentai', titles));
    assert('Busca por termo explícito "adulto" é detectada como intencional', adultContentService.isIntentionalAdultSearch('adulto', titles));
    assert('Busca pelo título exato "Private Desires" é detectada como intencional', adultContentService.isIntentionalAdultSearch('Private Desires', titles));
  }

  // CENÁRIO 7: Gênero Adulto e Contadores (Regras 3 e 8)
  console.log('\n--- 7. Gênero Adulto e Contadores de Catálogo ---');
  {
    const totalMoviesTodos = catalogDiscoveryService.getTotalAvailable('movies', 'Todos');
    const totalMoviesAdulto = catalogDiscoveryService.getTotalAvailable('movies', 'Adulto');
    const totalSeriesAdulto = catalogDiscoveryService.getTotalAvailable('series', 'Adulto');
    const totalAnimesAdulto = catalogDiscoveryService.getTotalAvailable('animes', 'Adulto');

    assert('Total padrão de Filmes exclui adultos e exibe 20.000', totalMoviesTodos === 20000);
    assert('Ao selecionar gênero Adulto em Filmes, exibe contagem correspondente (1.250)', totalMoviesAdulto === 1250);
    assert('Ao selecionar gênero Adulto em Séries, exibe contagem correspondente (320)', totalSeriesAdulto === 320);
    assert('Ao selecionar gênero Adulto em Animes, exibe contagem correspondente (850)', totalAnimesAdulto === 850);
  }

  console.log('\n========================================================================');
  console.log(`📊 RESULTADO FINAL DA SUÍTE: ${passed} PASS, ${failed} FAIL`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdultContentSuite().catch(err => {
  console.error('Erro fatal na suíte de conteúdo adulto:', err);
  process.exit(1);
});
