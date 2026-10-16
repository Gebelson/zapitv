import { classifyFeedbackMedia } from '../src/core/feedback/mediaClassifier';
import { FeedbackCollector } from '../src/core/feedback/feedbackCollector';
import { FeedbackClusteringEngine } from '../src/core/feedback/FeedbackClusteringEngine';
import { FeedbackPromptGenerator } from '../src/core/feedback/FeedbackPromptGenerator';
import { ContentType, ContentItem } from '../types';

function runAssertions() {
  console.log('=== TESTE DE IDENTIFICAÇÃO DE CONTEÚDOS NO FEEDBACK ===\n');

  // 1. FILME: Batman: O Cavaleiro das Trevas
  const batmanMovie: ContentItem = {
    id: 'tmdb-movie-155',
    title: 'Batman: O Cavaleiro das Trevas',
    type: ContentType.MOVIE,
    mediaFormat: 'movie',
    rating: 9.0,
    year: 2008,
    image: 'https://image.tmdb.org/t/p/w500/batman.jpg'
  };

  // Teste com season e episode passados erroneamente (ex: T1:E1)
  const movieClassification = classifyFeedbackMedia(batmanMovie, 1, 1);
  console.log('1. Filme (Batman: O Cavaleiro das Trevas):');
  console.log('   - Display Title:', movieClassification.displayTitle);
  console.log('   - Media Type:', movieClassification.mediaType);
  console.log('   - Season:', movieClassification.season);
  console.log('   - Episode:', movieClassification.episode);
  console.log('   - Is Episodic:', movieClassification.isEpisodic);

  if (movieClassification.displayTitle !== 'Batman: O Cavaleiro das Trevas') {
    throw new Error(`Falha no filme: esperado "Batman: O Cavaleiro das Trevas", obteve "${movieClassification.displayTitle}"`);
  }
  if (movieClassification.season !== undefined || movieClassification.episode !== undefined) {
    throw new Error('Falha no filme: season e episode devem ser undefined para filmes!');
  }
  if (movieClassification.mediaType !== 'movie') {
    throw new Error(`Falha no tipo de mídia do filme: esperado "movie", obteve "${movieClassification.mediaType}"`);
  }
  console.log('   ✓ Filme validado com sucesso: exibe somente o título sem T1:E1!\n');

  // 2. SÉRIE: Dexter (T1:E3)
  const dexterSeries: ContentItem = {
    id: 'tmdb-tv-1405',
    title: 'Dexter',
    type: ContentType.SERIES,
    mediaFormat: 'series',
    rating: 8.7,
    year: 2006,
    image: 'https://image.tmdb.org/t/p/w500/dexter.jpg',
    seasonsCount: 8
  };

  const seriesClassification = classifyFeedbackMedia(dexterSeries, 1, 3);
  console.log('2. Série (Dexter T1:E3):');
  console.log('   - Display Title:', seriesClassification.displayTitle);
  console.log('   - Media Type:', seriesClassification.mediaType);
  console.log('   - Season:', seriesClassification.season);
  console.log('   - Episode:', seriesClassification.episode);
  console.log('   - Is Episodic:', seriesClassification.isEpisodic);

  if (seriesClassification.displayTitle !== 'Dexter (T1:E3)') {
    throw new Error(`Falha na série: esperado "Dexter (T1:E3)", obteve "${seriesClassification.displayTitle}"`);
  }
  if (seriesClassification.season !== 1 || seriesClassification.episode !== 3) {
    throw new Error('Falha na série: temporada deve ser 1 e episódio 3!');
  }
  if (seriesClassification.mediaType !== 'series') {
    throw new Error(`Falha no tipo de mídia da série: esperado "series", obteve "${seriesClassification.mediaType}"`);
  }
  console.log('   ✓ Série validada com sucesso: exibe "Dexter (T1:E3)"!\n');

  // 2.1 SÉRIE sem episódio selecionado (apenas navegando no catálogo/detalhes)
  const seriesNoEp = classifyFeedbackMedia(dexterSeries, undefined, undefined);
  console.log('2.1 Série sem episódio selecionado:');
  console.log('   - Display Title:', seriesNoEp.displayTitle);
  if (seriesNoEp.displayTitle !== 'Dexter' || seriesNoEp.season !== undefined || seriesNoEp.episode !== undefined) {
    throw new Error(`Falha na série sem episódio: esperado "Dexter", obteve "${seriesNoEp.displayTitle}"`);
  }
  console.log('   ✓ Série sem episódio não inventa T1:E1!\n');

  // 3. ANIME: Bleach (T2:E5)
  const bleachAnime: ContentItem = {
    id: 'anime-30984',
    title: 'Bleach',
    type: ContentType.ANIME,
    mediaFormat: 'series',
    genres: ['Anime', 'Ação', 'Sobrenatural'],
    rating: 8.5,
    year: 2004,
    image: 'https://image.tmdb.org/t/p/w500/bleach.jpg',
    seasonsCount: 16
  };

  const animeClassification = classifyFeedbackMedia(bleachAnime, 2, 5);
  console.log('3. Anime (Bleach T2:E5):');
  console.log('   - Display Title:', animeClassification.displayTitle);
  console.log('   - Media Type:', animeClassification.mediaType);
  console.log('   - Season:', animeClassification.season);
  console.log('   - Episode:', animeClassification.episode);
  console.log('   - Is Episodic:', animeClassification.isEpisodic);

  if (animeClassification.displayTitle !== 'Bleach (T2:E5)') {
    throw new Error(`Falha no anime: esperado "Bleach (T2:E5)", obteve "${animeClassification.displayTitle}"`);
  }
  if (animeClassification.season !== 2 || animeClassification.episode !== 5) {
    throw new Error('Falha no anime: temporada deve ser 2 e episódio 5!');
  }
  if (animeClassification.mediaType !== 'anime') {
    throw new Error(`Falha no tipo de mídia do anime: esperado "anime", obteve "${animeClassification.mediaType}"`);
  }
  console.log('   ✓ Anime validado com sucesso: exibe "Bleach (T2:E5)"!\n');

  // 4. TESTE DO CONTEXTO TÉCNICO GERADO POR FeedbackCollector
  console.log('4. Validação do Contexto Técnico (FeedbackCollector.captureTechnicalContext):');
  const movieTechContext = FeedbackCollector.captureTechnicalContext({
    item: batmanMovie,
    season: 1, // Simula valor sujo passado por engano
    episode: 1
  });
  console.log('   - Filme Tech Context:', {
    canonicalMediaId: movieTechContext.canonicalMediaId,
    mediaType: movieTechContext.mediaType,
    season: movieTechContext.season,
    episode: movieTechContext.episode
  });
  if (movieTechContext.season !== undefined || movieTechContext.episode !== undefined || movieTechContext.mediaType !== 'movie') {
    throw new Error('Falha no contexto técnico de filme: season e episode devem ser undefined!');
  }
  console.log('   ✓ Contexto técnico de filme sanitizado: sem registro de episódios!\n');

  // 5. TESTE DE CLUSTERING E PROMPTS TÉCNICOS
  console.log('5. Validação de Título do Cluster e Prompts Técnicos:');
  const clusterTitleMovie = FeedbackClusteringEngine.generateClusterTitle('video_not_loading', movieTechContext);
  console.log('   - Título do Cluster Filme:', clusterTitleMovie);
  if (clusterTitleMovie.includes('T1:E1')) {
    throw new Error(`Título do cluster de filme contém T1:E1 indevidamente: "${clusterTitleMovie}"`);
  }

  const seriesTechContext = FeedbackCollector.captureTechnicalContext({
    item: dexterSeries,
    season: 1,
    episode: 3
  });
  const clusterTitleSeries = FeedbackClusteringEngine.generateClusterTitle('video_stuttering', seriesTechContext);
  console.log('   - Título do Cluster Série:', clusterTitleSeries);
  if (!clusterTitleSeries.includes('T1:E3')) {
    throw new Error(`Título do cluster de série não contém T1:E3: "${clusterTitleSeries}"`);
  }

  const animeTechContext = FeedbackCollector.captureTechnicalContext({
    item: bleachAnime,
    season: 2,
    episode: 5
  });
  const clusterTitleAnime = FeedbackClusteringEngine.generateClusterTitle('subtitles_out_of_sync', animeTechContext);
  console.log('   - Título do Cluster Anime:', clusterTitleAnime);
  if (!clusterTitleAnime.includes('T2:E5')) {
    throw new Error(`Título do cluster de anime não contém T2:E5: "${clusterTitleAnime}"`);
  }

  console.log('\n=== TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! ===');
}

runAssertions();
