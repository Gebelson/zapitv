import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Play, Bookmark, Heart, Star, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { ContentItem, ContentType } from '../../../types';
import { tmdbService } from '../../core/tmdb/tmdbClient';
import { storageService } from '../../core/storage/storageService';
import { TvCard16x9 } from './TvCard16x9';
import { TvContentRow } from './TvContentRow';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';

interface TvDetailsModalProps {
  item: ContentItem;
  initialSeason?: number;
  allContent: ContentItem[];
  myList: string[];
  favorites: string[];
  onToggleList: (e: any, id: string) => void;
  onToggleFavorite: (e: any, id: string) => void;
  onClose: () => void;
  onPlay: (item: ContentItem, season?: number, episode?: number) => void;
}

export const TvDetailsModal: React.FC<TvDetailsModalProps> = ({
  item: initialItem,
  initialSeason,
  allContent,
  myList,
  favorites,
  onToggleList,
  onToggleFavorite,
  onClose,
  onPlay
}) => {
  const [item, setItem] = useState<ContentItem>(initialItem);
  const [currentSeason, setCurrentSeason] = useState(initialSeason || 1);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([initialSeason || 1]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  const isEpisodic = item.type === ContentType.SERIES || item.type === ContentType.ANIME || Boolean(item.seasonsCount && item.seasonsCount > 0);
  const isInList = myList.includes(item.id);
  const isFav = favorites.includes(item.id);

  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-details-screen',
    trackChildren: true
  });

  // Botões de Ação
  const { ref: backRef, focused: isBackFocused } = useTvFocusable({
    focusKey: 'tv-details-back',
    onEnterPress: onClose
  });

  const { ref: playRef, focused: isPlayFocused } = useTvFocusable({
    focusKey: 'tv-details-play',
    onEnterPress: () => onPlay(item, isEpisodic ? currentSeason : undefined, isEpisodic ? 1 : undefined)
  });

  const { ref: listRef, focused: isListFocused } = useTvFocusable({
    focusKey: 'tv-details-list',
    onEnterPress: () => onToggleList({} as any, item.id)
  });

  const { ref: favRef, focused: isFavFocused } = useTvFocusable({
    focusKey: 'tv-details-fav',
    onEnterPress: () => onToggleFavorite({} as any, item.id)
  });

  // Registra Voltar no tvNavigationManager
  useEffect(() => {
    const unregister = tvNavigationManager.registerBackHandler('tv-details-modal', 100, () => {
      onClose();
      return true;
    });

    const timer = setTimeout(() => {
      setFocus('tv-details-play');
    }, 150);

    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, [onClose]);

  // Carrega metadados detalhados
  useEffect(() => {
    let active = true;
    const fetchMetadata = async () => {
      try {
        const rawId = item.tmdbId || item.id;
        const cleanTmdbId = typeof rawId === 'string' ? rawId.replace(/^tmdb-?/i, '') : String(rawId);
        let details = null;

        if (cleanTmdbId && /^\d+$/.test(cleanTmdbId)) {
          details = await tmdbService.getDetails(cleanTmdbId, item.type, item.mediaFormat);
        } else if (item.imdbId || item.id.startsWith('tt')) {
          details = await tmdbService.getDetailsByImdb(item.imdbId || item.id, item.type, item.mediaFormat);
        }

        if (active && details?.item) {
          setItem(prev => ({
            ...prev,
            ...details.item,
            id: prev.id,
            director: details.director || prev.director,
            cast: details.cast || prev.cast
          }));

          if (details.seasons && details.seasons.length > 0) {
            const sNums = details.seasons.map((s: any) => s.season_number || s.seasonNumber || 1).filter((n: number) => n > 0);
            if (sNums.length > 0) setAvailableSeasons(sNums);
          } else if (details.seasonsCount && details.seasonsCount > 1) {
            setAvailableSeasons(Array.from({ length: details.seasonsCount }, (_, i) => i + 1));
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar detalhes TMDB para TV:', err);
      }
    };

    fetchMetadata();
    return () => { active = false; };
  }, [item.id, item.tmdbId, item.imdbId, item.type, item.mediaFormat]);

  // Carrega episódios da temporada selecionada
  useEffect(() => {
    if (!isEpisodic) return;
    let active = true;
    setIsLoadingEpisodes(true);

    const fetchEps = async () => {
      try {
        const rawId = item.tmdbId || item.id;
        const cleanTmdbId = typeof rawId === 'string' ? rawId.replace(/^tmdb-?/i, '') : String(rawId);
        let eps: any[] = [];

        if (cleanTmdbId && /^\d+$/.test(cleanTmdbId)) {
          eps = await tmdbService.getSeasonEpisodes(cleanTmdbId, currentSeason);
        } else if (item.imdbId || item.id.startsWith('tt')) {
          eps = await tmdbService.getSeasonEpisodesByImdb(item.imdbId || item.id, currentSeason);
        }

        if ((!eps || eps.length === 0) && item.episodes) {
          eps = item.episodes.filter((e: any) => (e.season ?? 1) === currentSeason);
        }

        if (active) {
          setEpisodes(eps || []);
          setIsLoadingEpisodes(false);
        }
      } catch {
        if (active) {
          setEpisodes([]);
          setIsLoadingEpisodes(false);
        }
      }
    };

    fetchEps();
    return () => { active = false; };
  }, [item.id, item.tmdbId, item.imdbId, currentSeason, isEpisodic]);

  // Títulos Semelhantes
  const relatedItems = useMemo(() => {
    if (!allContent || allContent.length === 0) return [];
    return allContent.filter(cand => {
      if (cand.id === item.id) return false;
      const shareGenre = cand.genres?.some(g => item.genres?.includes(g));
      return shareGenre && cand.type === item.type;
    }).slice(0, 15);
  }, [allContent, item.id, item.genres, item.type]);

  const backdropUrl = item.backdrop || item.image || item.poster || '';
  const genresText = item.genres?.join(' • ') || (item.type === 'FILME' ? 'Filme' : 'Série');

  return (
    <FocusContext.Provider value={focusKey}>
      <div 
        ref={noriginRef as any}
        className="fixed inset-0 z-[200] bg-[#05070a] overflow-y-auto no-scrollbar select-none animate-in fade-in duration-300"
      >
        {/* Banner Cinematográfico Superior */}
        <div className="relative w-full h-[65vh] min-h-[460px] max-h-[680px]">
          {backdropUrl && (
            <img
              src={backdropUrl}
              alt={item.title}
              className="w-full h-full object-cover object-center"
            />
          )}

          {/* Gradientes de Fusão */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#05070a] via-[#05070a]/75 via-50% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/80 via-25% to-transparent" />

          {/* Botão Superior Voltar */}
          <div className="absolute top-8 left-8 sm:left-12 z-20">
            <button
              ref={backRef}
              type="button"
              data-focus-key="tv-details-back"
              data-tv-focused={isBackFocused ? "true" : undefined}
              onClick={onClose}
              className={`p-3 rounded-xl border transition-all duration-200 outline-none ${
                isBackFocused
                  ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(0,229,255,0.4)]'
                  : 'bg-black/50 text-gray-300 border-white/15 hover:bg-black/70'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Informações Principais no Banner */}
          <div className="absolute bottom-8 left-8 sm:left-12 md:left-16 max-w-2xl lg:max-w-3xl z-10">
            {/* Metadados */}
            <div className="flex flex-wrap items-center gap-2.5 mb-2 text-xs font-bold text-gray-300">
              {item.rating ? (
                <span className="flex items-center gap-1 text-amber-400 bg-black/60 px-2 py-0.5 rounded-md border border-amber-400/30">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {item.rating.toFixed(1)}
                </span>
              ) : null}
              {item.year ? <span>{item.year}</span> : null}
              {item.ageRating && (
                <span className="px-1.5 py-0.5 rounded bg-white/15 border border-white/20 text-[11px] text-white">
                  {item.ageRating}
                </span>
              )}
              {availableSeasons.length > 1 && (
                <span className="text-cyan-400 font-semibold">{availableSeasons.length} Temporadas</span>
              )}
              <span>•</span>
              <span className="text-gray-400">{genresText}</span>
            </div>

            {/* Título Principal */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-3 drop-shadow-2xl">
              {item.title}
            </h1>

            {/* Sinopse */}
            <p className="text-xs sm:text-sm md:text-base text-gray-300/90 leading-relaxed line-clamp-3 mb-6 max-w-xl">
              {item.description || item.overview || 'Sinopse completa disponível no catálogo do ZapiTV.'}
            </p>

            {/* Linha de Ações */}
            <div className="flex items-center gap-4">
              {/* Assistir Principal */}
              <button
                ref={playRef}
                type="button"
                data-focus-key="tv-details-play"
                data-tv-focused={isPlayFocused ? "true" : undefined}
                onClick={() => onPlay(item, isEpisodic ? currentSeason : undefined, isEpisodic ? 1 : undefined)}
                className={`px-8 py-3.5 rounded-xl font-black text-sm tracking-wide flex items-center gap-3 transition-all duration-200 outline-none ${
                  isPlayFocused
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white scale-105 shadow-[0_0_30px_rgba(0,229,255,0.7)] border-2 border-[#00e5ff]'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20 border-2 border-transparent'
                }`}
              >
                <Play className="w-5 h-5 fill-white" />
                <span>Assistir Agora</span>
              </button>

              {/* Minha Lista */}
              <button
                ref={listRef}
                type="button"
                data-focus-key="tv-details-list"
                data-tv-focused={isListFocused ? "true" : undefined}
                onClick={(e) => onToggleList(e, item.id)}
                className={`px-5 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 border transition-all duration-200 outline-none ${
                  isListFocused
                    ? 'bg-white/25 text-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.4)] border-white'
                    : isInList
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-white/10 text-gray-200 border-white/15'
                }`}
              >
                {isInList ? <Check className="w-4 h-4 text-cyan-300" /> : <Bookmark className="w-4 h-4" />}
                <span>{isInList ? 'Na Minha Lista' : 'Salvar na Lista'}</span>
              </button>

              {/* Favorito */}
              <button
                ref={favRef}
                type="button"
                data-focus-key="tv-details-fav"
                data-tv-focused={isFavFocused ? "true" : undefined}
                onClick={(e) => onToggleFavorite(e, item.id)}
                className={`p-3.5 rounded-xl border transition-all duration-200 outline-none ${
                  isFavFocused
                    ? 'bg-rose-500/30 text-rose-300 border-rose-400 scale-105 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                    : isFav
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    : 'bg-white/10 text-gray-200 border-white/15'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Informações Complementares: Direção, Elenco */}
        <div className="px-8 sm:px-12 md:px-16 pt-6 pb-4">
          <div className="flex flex-wrap gap-8 text-xs text-gray-400">
            {item.director && (
              <div>
                <span className="font-bold text-gray-200">Direção / Criação: </span>
                <span>{item.director}</span>
              </div>
            )}
            {item.cast && item.cast.length > 0 && (
              <div>
                <span className="font-bold text-gray-200">Elenco Principal: </span>
                <span>{item.cast.slice(0, 5).join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Seção de Temporadas e Episódios para Séries */}
        {isEpisodic && (
          <div className="px-8 sm:px-12 md:px-16 py-6 border-t border-white/10 mt-4">
            {/* Seletor de Temporadas */}
            {availableSeasons.length > 1 && (
              <div className="flex items-center gap-3 mb-4 overflow-x-auto no-scrollbar py-2">
                <span className="text-sm font-bold text-gray-300 mr-2">Temporada:</span>
                {availableSeasons.map((sNum) => (
                  <button
                    key={`tv-season-${sNum}`}
                    type="button"
                    onClick={() => setCurrentSeason(sNum)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all outline-none ${
                      currentSeason === sNum
                        ? 'bg-cyan-500 text-black shadow-[0_0_12px_#00e5ff]'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    Temporada {sNum}
                  </button>
                ))}
              </div>
            )}

            {/* Trilho de Episódios */}
            <h3 className="text-base font-black text-white mb-3">
              Episódios da Temporada {currentSeason} ({episodes.length})
            </h3>

            {isLoadingEpisodes ? (
              <div className="py-8 text-gray-400 text-sm">Carregando episódios...</div>
            ) : episodes.length > 0 ? (
              <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
                {episodes.map((ep, idx) => (
                  <div
                    key={`ep-${ep.number || idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPlay(item, currentSeason, ep.number || idx + 1)}
                    className="flex-none w-[260px] bg-[#0c121e] rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400 cursor-pointer transition-all hover:scale-105"
                  >
                    <div className="relative aspect-video bg-black/40 overflow-hidden">
                      {ep.image ? (
                        <img src={ep.image} alt={ep.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-8 h-8 text-cyan-400/50" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold text-white">
                        EP {ep.number || idx + 1}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-bold text-white line-clamp-1">{ep.title || `Episódio ${ep.number || idx + 1}`}</div>
                      <div className="text-[10px] text-gray-400 line-clamp-2 mt-1">{ep.description || ep.overview || ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-gray-500 text-xs">Nenhum episódio cadastrado para esta temporada.</div>
            )}
          </div>
        )}

        {/* Trilho de Títulos Semelhantes */}
        {relatedItems.length > 0 && (
          <div className="py-6 border-t border-white/10 mt-6">
            <TvContentRow
              title="Títulos Semelhantes"
              rowId="related-titles"
              items={relatedItems}
              onItemClick={(sel) => setItem(sel)}
            />
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
};
