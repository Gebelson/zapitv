/**
 * ZapiTV — Media Classifier for Feedback & Observability
 * 
 * Classificador unificado de mídias para relatos de erro, telemetria e agrupamento automático.
 * Diferencia rigorosamente filmes, séries e animes a partir do ID canônico e metadados,
 * garantindo que filmes nunca recebam sufixos ou contadores de temporada/episódio.
 */

import { ContentItem, ContentType } from '../../../types';

export interface MediaClassification {
  mediaType: 'movie' | 'series' | 'anime' | 'live' | 'app';
  isMovie: boolean;
  isEpisodic: boolean;
  displayTitle: string;
  season?: number;
  episode?: number;
  canonicalMediaId?: string;
}

/**
 * Classifica a mídia e formata o título exibido no formulário de feedback e nos dados técnicos.
 * 
 * Regras:
 * 1. Filmes: exibem SOMENTE o título. Temporada e episódio são SEMPRE undefined.
 * 2. Séries e Animes episódicos: exibem "(T{season}:E{episode})" APENAS se houver temporada e episódio válidos (> 0).
 * 3. Se não houver episódio selecionado para série/anime, exibe somente o título sem inventar T1:E1.
 * 4. Canais ao vivo: exibem o nome do canal (mediaType: 'live').
 * 5. Feedbacks gerais de sistema: mediaType: 'app'.
 */
export function classifyFeedbackMedia(
  item?: ContentItem | null,
  rawSeason?: number | null,
  rawEpisode?: number | null,
  streamName?: string | null
): MediaClassification {
  if (!item) {
    if (streamName && streamName.trim()) {
      return {
        mediaType: 'live',
        isMovie: false,
        isEpisodic: false,
        displayTitle: streamName.trim()
      };
    }
    return {
      mediaType: 'app',
      isMovie: false,
      isEpisodic: false,
      displayTitle: ''
    };
  }

  const id = (item.id || '').toLowerCase();
  const rawType = String(item.type || '').toUpperCase();
  const format = (item.mediaFormat || '').toLowerCase();
  const genres = (item.genres || []).map(g => g.toLowerCase());
  const title = (item.title || item.originalTitle || 'Conteúdo sem título').trim();

  // 1. Detecção de Anime
  const isAnime = (
    rawType === ContentType.ANIME ||
    rawType === 'ANIME' ||
    id.startsWith('anime-') ||
    id.startsWith('mal-') ||
    id.startsWith('anilist-') ||
    genres.some(g => /anime/i.test(g))
  );

  // 2. Detecção de Filme
  // Um conteúdo é filme se mediaFormat for 'movie', ou tipo MOVIE ('FILME'), ou id tmdb-movie- / movie-
  const isMovie = (
    format === 'movie' ||
    rawType === ContentType.MOVIE ||
    rawType === 'FILME' ||
    rawType === 'MOVIE' ||
    id.startsWith('tmdb-movie-') ||
    id.startsWith('movie-')
  );

  // 3. Diferenciação da categoria de mídia
  let mediaType: 'movie' | 'series' | 'anime' | 'live' | 'app' = 'movie';
  if (isAnime) {
    mediaType = isMovie ? 'movie' : 'anime';
  } else if (isMovie) {
    mediaType = 'movie';
  } else {
    mediaType = 'series';
  }

  // Se o item for anime explícito com episódios, deve ser 'anime'
  if (isAnime && !isMovie) {
    mediaType = 'anime';
  }

  // 4. Determinação episódica: Filmes NUNCA são episódicos
  const isEpisodic = !isMovie && (mediaType === 'series' || mediaType === 'anime');

  // 5. Validação estrita de temporada e episódio
  // Apenas aceita valores numéricos inteiros válidos estritamente positivos (> 0)
  const hasValidSeason = typeof rawSeason === 'number' && Number.isInteger(rawSeason) && rawSeason > 0;
  const hasValidEpisode = typeof rawEpisode === 'number' && Number.isInteger(rawEpisode) && rawEpisode > 0;

  // Temporada e episódio só existem se a mídia for episódica e AMBOS tiverem sido selecionados
  const hasEpisodicSelection = isEpisodic && hasValidSeason && hasValidEpisode;

  const finalSeason = hasEpisodicSelection ? (rawSeason as number) : undefined;
  const finalEpisode = hasEpisodicSelection ? (rawEpisode as number) : undefined;

  // 6. Título final formatado
  const displayTitle = hasEpisodicSelection
    ? `${title} (T${finalSeason}:E${finalEpisode})`
    : title;

  return {
    mediaType,
    isMovie,
    isEpisodic,
    displayTitle,
    season: finalSeason,
    episode: finalEpisode,
    canonicalMediaId: item.id
  };
}
