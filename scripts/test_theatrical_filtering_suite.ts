import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { ContentType, ContentItem } from '../types';

async function runTheatricalTests() {
  console.log('====================================================');
  console.log('INICIANDO BATERIA DE TESTES DE FILTRAGEM TEATRAL');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // TESTE 1: Vingadores: Doutor Destino (TMDB ID 1003596) - Síncrono
  const avengersItem: ContentItem = {
    id: 'tmdb-1003596',
    tmdbId: '1003596',
    title: 'Vingadores: Doutor Destino',
    originalTitle: 'Avengers: Doomsday',
    type: ContentType.MOVIE,
    rating: 8.5,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    releaseDate: '2026-12-16'
  };

  const avengersSyncAllowed = theatricalFilterService.isMovieAllowedSync(avengersItem);
  assert('Vingadores: Doutor Destino deve ser BLOQUEADO síncronamente (isMovieAllowedSync === false)', avengersSyncAllowed === false);

  // TESTE 2: Vingadores: Doutor Destino - Assíncrono (evaluateMovie)
  const avengersEval = await theatricalFilterService.evaluateMovie(avengersItem);
  assert('Vingadores: Doutor Destino deve ser BLOQUEADO assincronamente (allowed === false)', avengersEval.allowed === false);
  assert('Vingadores: Doutor Destino deve ter status UPCOMING', avengersEval.status === 'UPCOMING');

  // TESTE 3: Vingadores: Guerras Secretas
  const avengersWarsItem: ContentItem = {
    id: 'tmdb-1003598',
    tmdbId: '1003598',
    title: 'Vingadores: Guerras Secretas',
    originalTitle: 'Avengers: Secret Wars',
    type: ContentType.MOVIE,
    rating: 8.5,
    year: 2027,
    image: 'https://image.tmdb.org/t/p/w500/poster.jpg'
  };
  assert('Vingadores: Guerras Secretas (ano 2027) deve ser bloqueado síncronamente', theatricalFilterService.isMovieAllowedSync(avengersWarsItem) === false);

  // TESTE 4: Filme com releaseDate futura qualquer no ano corrente
  const futureDateItem: ContentItem = {
    id: 'tmdb-999999',
    tmdbId: '999999',
    title: 'Filme Inédito Dezembro',
    type: ContentType.MOVIE,
    rating: 7.0,
    year: 2026,
    image: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    releaseDate: '2026-12-25'
  };
  assert('Filme com releaseDate futura no ano corrente deve ser bloqueado síncronamente', theatricalFilterService.isMovieAllowedSync(futureDateItem) === false);

  // TESTE 5: Filme clássico de catálogo (Interestelar 2014)
  const interstellarItem: ContentItem = {
    id: 'tt0816692',
    imdbId: 'tt0816692',
    tmdbId: '157336',
    title: 'Interestelar',
    type: ContentType.MOVIE,
    rating: 8.7,
    year: 2014,
    image: 'https://image.tmdb.org/t/p/w500/interstellar.jpg',
    releaseDate: '2014-11-06'
  };
  assert('Interestelar (2014) deve ser PERMITIDO síncronamente', theatricalFilterService.isMovieAllowedSync(interstellarItem) === true);

  // TESTE 6: Séries de TV e Animes Seriais (não possuem janela de cinema)
  const seriesItem: ContentItem = {
    id: 'tt0434665',
    imdbId: 'tt0434665',
    title: 'Bleach',
    type: ContentType.ANIME,
    rating: 8.2,
    year: 2004,
    image: 'https://image.tmdb.org/t/p/w500/bleach.jpg'
  };
  assert('Anime serial (Bleach) deve ser PERMITIDO síncronamente', theatricalFilterService.isMovieAllowedSync(seriesItem) === true);

  const tvSeriesItem: ContentItem = {
    id: 'tt0903747',
    imdbId: 'tt0903747',
    title: 'Breaking Bad',
    type: ContentType.SERIES,
    rating: 9.5,
    year: 2008,
    image: 'https://image.tmdb.org/t/p/w500/bb.jpg'
  };
  assert('Série de TV (Breaking Bad) deve ser PERMITIDA síncronamente', theatricalFilterService.isMovieAllowedSync(tvSeriesItem) === true);

  // TESTE 7: Detecção de fontes piratas de sala de cinema (CAM / Telesync)
  assert('CAMRip é identificado como gravação de cinema', theatricalFilterService.isCamRecording('Vingadores.CAMRip.x264') === true);
  assert('HDCAM é identificado como gravação de cinema', theatricalFilterService.isCamRecording('Doutor.Destino.2026.HDCAM.Line.Audio') === true);
  assert('Telesync TS é identificado como gravação de cinema', theatricalFilterService.isCamRecording('Filme.2026.TS.x264-RIP') === true);
  assert('Extensão HLS normal .ts NÃO é confundida com Telesync', theatricalFilterService.isCamRecording('https://cdn.example.com/segment_001.ts') === false);
  assert('Trailer ou preview é identificado por isTrailerOrFakeSource', theatricalFilterService.isTrailerOrFakeSource({ title: 'Official Trailer 2026' }).isFake === true);

  // TESTE 8: Filtragem em massa de catálogo com filterAllowedMoviesSync
  const mixedCatalog: ContentItem[] = [
    avengersItem,
    interstellarItem,
    avengersWarsItem,
    futureDateItem,
    seriesItem,
    tvSeriesItem
  ];

  const sanitized = theatricalFilterService.filterAllowedMoviesSync(mixedCatalog);
  assert('Catálogo misto de 6 itens deve reter exatamente 3 itens elegíveis (Interestelar, Bleach, Breaking Bad)', sanitized.length === 3);
  assert('Vingadores: Doutor Destino NÃO deve estar presente no catálogo sanitizado', !sanitized.some(i => i.id === 'tmdb-1003596'));
  assert('Interestelar DEVE estar presente no catálogo sanitizado', sanitized.some(i => i.id === 'tt0816692'));
  assert('Bleach DEVE estar presente no catálogo sanitizado', sanitized.some(i => i.id === 'tt0434665'));

  console.log('\n====================================================');
  console.log(`RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTheatricalTests();
