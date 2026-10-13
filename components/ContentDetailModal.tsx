import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { X, Play, Bookmark, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { ContentItem, ContentType } from '../types';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { ZapiPlayer } from '../src/components/player/ZapiPlayer';
import { storageService } from '../src/core/storage/storageService';
import { ZapiLoader } from '../src/components/common/ZapiLoader';
import { playbackSessionService, NavigationType } from '../src/core/session/playbackSessionService';

interface ContentDetailModalProps {
  item: ContentItem;
  onClose: () => void;
  isDarkMode: boolean;
  myList: string[];
  favorites: string[];
  onToggleList: (e: React.MouseEvent, id: string) => void;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  allContent: ContentItem[];
}

export const ContentDetailModal: React.FC<ContentDetailModalProps> = ({ 
  item: initialItem, onClose, isDarkMode, myList, favorites, onToggleList, onToggleFavorite, allContent 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [item, setItem] = useState<ContentItem>(initialItem);
  const [isSimilarExpanded, setIsSimilarExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [totalSeasons, setTotalSeasons] = useState(initialItem.seasonsCount || 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resolvedStreams, setResolvedStreams] = useState<StremioStream[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [progressVersion, setProgressVersion] = useState(0);

  // Playback session lifecycle
  const [playbackSessionId, setPlaybackSessionId] = useState<string>('');
  const [navigationType, setNavigationType] = useState<NavigationType>('manual_start');
  const [sessionIntroPlayed, setSessionIntroPlayed] = useState<boolean>(false);

  // Reage imediatamente a atualizações de progresso do player
  useEffect(() => {
    const handleProgressUpdate = (e: any) => {
      if (e.detail?.contentId === item.id) {
        setProgressVersion(v => v + 1);
      }
    };
    window.addEventListener('zapitv_progress_updated', handleProgressUpdate);
    return () => window.removeEventListener('zapitv_progress_updated', handleProgressUpdate);
  }, [item.id]);

  const getEpisodeProgress = useCallback((season: number, episode: number): number => {
    return storageService.getSyncEpisodeProgress(item.id, season, episode);
  }, [item.id, progressVersion]);
  
  // Dynamic episodes from TMDB
  const [episodes, setEpisodes] = useState<{
    id: string;
    number: number;
    title: string;
    description: string;
    image: string;
  }[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  // Parâmetros do player (filme ou série/EP)
  const [currentEpisodeParams, setCurrentEpisodeParams] = useState<{season: number, episode: number} | null>(null);

  const isFavorite = favorites.includes(item.id);
  const isInList = myList.includes(item.id);
  const hasEpisodes = item.type === ContentType.SERIES || item.type === ContentType.ANIME;

  const handleClose = useCallback(() => {
    setIsClosing(true);
    if (playbackSessionId) {
      playbackSessionService.endSession(playbackSessionId);
    } else {
      playbackSessionService.endSession();
    }
    setPlaybackSessionId('');
    setSessionIntroPlayed(false);
    setTimeout(() => {
      onClose();
    }, 280);
  }, [onClose, playbackSessionId]);

  const handleClosePlayer = useCallback(() => {
    setIsPlaying(false);
    if (playbackSessionId) {
      playbackSessionService.endSession(playbackSessionId);
    } else {
      playbackSessionService.endSession();
    }
    setPlaybackSessionId('');
    setSessionIntroPlayed(false);
  }, [playbackSessionId]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node) && !isPlaying) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClose, isPlaying]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Fetch full metadata from TMDB or Cinemeta
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        let details: any = null;
        if (initialItem.tmdbId) {
          details = await tmdbService.getDetails(initialItem.tmdbId, initialItem.type);
        } else if (initialItem.imdbId || initialItem.id.startsWith('tt')) {
          const targetImdb = initialItem.imdbId || initialItem.id;
          details = await tmdbService.getDetailsByImdb(targetImdb, initialItem.type);
        }
        if (details) {
          setItem(prev => ({
            ...prev,
            ...details.item,
            id: prev.id, // Preserva rigorosamente o ID inicial para evitar remount do ZapiPlayer
            imdbId: details.imdbId || prev.imdbId,
            tmdbId: details.item?.tmdbId || prev.tmdbId,
            director: details.director || prev.director,
            cast: details.cast && details.cast.length > 0 ? details.cast : prev.cast
          }));
          if (details.seasonsCount && details.seasonsCount > 1) {
            setTotalSeasons(details.seasonsCount);
          }
        }
      } catch (err) {
        console.warn('Falha ao enriquecer detalhes:', err);
      }
    };
    fetchMetadata();
  }, [initialItem.tmdbId, initialItem.imdbId, initialItem.id, initialItem.type]);

  // Dynamic episodes from item, TMDB or Cinemeta
  useEffect(() => {
    if (!hasEpisodes) return;
    if (item.episodes && item.episodes.length > 0) {
      setEpisodes(item.episodes);
      return;
    }
    const fetchEpisodes = async () => {
      setIsLoadingEpisodes(true);
      try {
        let eps: any[] = [];
        if (item.tmdbId) {
          eps = await tmdbService.getSeasonEpisodes(item.tmdbId, currentSeason);
        } else if (item.imdbId || item.id.startsWith('tt')) {
          const targetImdb = item.imdbId || item.id;
          eps = await tmdbService.getSeasonEpisodesByImdb(targetImdb, currentSeason);
        }
        if (eps && eps.length > 0) {
          setEpisodes(eps);
        } else {
          // Fallback dummy episodes
          setEpisodes(Array.from({ length: 8 }).map((_, i) => ({
            id: `ep-${item.id}-s${currentSeason}-${i + 1}`,
            number: i + 1,
            title: `Episódio ${i + 1}`,
            description: 'Assista a este episódio para acompanhar os desdobramentos da trama.',
            image: item.backdrop || item.image
          })));
        }
      } catch (e) {
        console.warn('Erro ao carregar episódios:', e);
      } finally {
        setIsLoadingEpisodes(false);
      }
    };
    fetchEpisodes();
  }, [hasEpisodes, item.tmdbId, item.imdbId, item.id, item.episodes, currentSeason, item.backdrop, item.image]);

  // Pre-fetch / Resolve Streams whenever play is triggered
  const startPlayback = async (
    season?: number, 
    episode?: number, 
    navType: NavigationType = 'manual_start'
  ) => {
    let epParams: { season: number; episode: number } | undefined = undefined;

    if (hasEpisodes) {
      // 1. Determina temporada alvo
      let targetSeason = season ?? currentEpisodeParams?.season ?? currentSeason ?? 1;

      // 2. Determina episódio alvo
      let targetEpisode = episode ?? currentEpisodeParams?.episode;
      if (!targetEpisode) {
        // Se o usuário não especificou episódio (ex: clicou no botão principal 'Assistir'),
        // recupera o último episódio salvo no histórico ou inicia no episódio 1
        const savedProg = storageService.getSyncItemProgressRecord(item.id);
        if (savedProg && savedProg.episode && (!season || savedProg.season === targetSeason)) {
          targetEpisode = savedProg.episode;
          if (savedProg.season && !season) {
            targetSeason = savedProg.season;
          }
        } else {
          targetEpisode = 1;
        }
      }

      epParams = { season: targetSeason, episode: targetEpisode };
      setCurrentEpisodeParams(epParams);
      if (targetSeason !== currentSeason) {
        setCurrentSeason(targetSeason);
      }
    } else {
      setCurrentEpisodeParams(null);
    }

    // Inicia ou continua a sessão de reprodução rastreando a intro
    const session = playbackSessionService.startSession(
      item.id,
      navType,
      epParams?.season,
      epParams?.episode
    );
    setPlaybackSessionId(session.sessionId);
    setNavigationType(navType);
    setSessionIntroPlayed(session.introPlayed);

    setIsPlaying(true);
    setIsLoadingStreams(true);
    setResolvedStreams([]);

    try {
      const streams = await providerRegistry.resolveStreams(
        item.type === ContentType.MOVIE ? 'movie' : (item.type === ContentType.ANIME ? 'anime' : 'series'),
        { tmdbId: item.tmdbId, imdbId: item.imdbId, id: item.id, title: item.title },
        epParams
      );
      setResolvedStreams(streams);
    } catch (err) {
      console.error('Erro ao resolver provedores:', err);
    } finally {
      setIsLoadingStreams(false);
    }
  };

  const handleEpisodeClick = (season: number, episode: number) => {
    startPlayback(season, episode, 'manual_start');
  };

  const handleNextEpisode = () => {
    if (!hasEpisodes || isLoadingStreams) return;
    const curSeason = currentEpisodeParams?.season ?? currentSeason ?? 1;
    const curEpisode = currentEpisodeParams?.episode ?? 1;
    const seasonEpCount = episodes.length > 0 ? episodes.length : 8;

    if (curEpisode < seasonEpCount) {
      startPlayback(curSeason, curEpisode + 1, 'continuous_playback');
    } else if (curSeason < totalSeasons) {
      // Avança para a próxima temporada, episódio 1
      const nextSeason = curSeason + 1;
      setCurrentSeason(nextSeason);
      startPlayback(nextSeason, 1, 'continuous_playback');
    } else {
      console.log('Último episódio da série alcançado.');
    }
  };

  const hasNextEpisode = useMemo(() => {
    if (!hasEpisodes) return false;
    const curSeason = currentEpisodeParams?.season ?? currentSeason ?? 1;
    const curEpisode = currentEpisodeParams?.episode ?? 1;
    const seasonEpCount = episodes.length > 0 ? episodes.length : 8;
    return curEpisode < seasonEpCount || curSeason < totalSeasons;
  }, [hasEpisodes, currentEpisodeParams, currentSeason, episodes.length, totalSeasons]);

  const nextEpisodeInfo = useMemo(() => {
    if (!hasEpisodes) return null;
    const curSeason = currentEpisodeParams?.season ?? currentSeason ?? 1;
    const curEpisode = currentEpisodeParams?.episode ?? 1;
    const seasonEpCount = episodes.length > 0 ? episodes.length : 8;

    if (curEpisode < seasonEpCount) {
      const nextNum = curEpisode + 1;
      const found = episodes.find(e => e.number === nextNum);
      return {
        season: curSeason,
        episode: nextNum,
        title: found?.title || `Episódio ${nextNum}`
      };
    } else if (curSeason < totalSeasons) {
      return {
        season: curSeason + 1,
        episode: 1,
        title: `Temporada ${curSeason + 1} • Episódio 1`
      };
    }
    return null;
  }, [hasEpisodes, currentEpisodeParams, currentSeason, episodes, totalSeasons]);

  const similarTitles = allContent
    .filter(c => c.id !== item.id && (c.genres?.some(g => item.genres?.includes(g)) || c.type === item.type))
    .slice(0, 12);

  const initialSimilar = similarTitles.slice(0, 6);
  const extraSimilar = similarTitles.slice(6);

  const renderSimilarCard = (similar: ContentItem) => {
    const simProgress = storageService.getSyncItemProgress(similar.id);
    return (
      <div 
        key={similar.id} 
        onClick={() => {
          if (playbackSessionId) {
            playbackSessionService.endSession(playbackSessionId);
          } else {
            playbackSessionService.endSession();
          }
          setPlaybackSessionId('');
          setSessionIntroPlayed(false);
          setItem(similar);
        }}
        className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden hover:bg-white/10 hover:border-white/10 transition-all group cursor-pointer"
      >
        <div className="relative aspect-video">
          <img 
            src={similar.backdrop || similar.image} 
            onError={(e) => { (e.target as HTMLImageElement).src = similar.image; }} 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
            loading="lazy" 
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full border-2 border-white bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-5 h-5 fill-white text-white" />
            </div>
          </div>
          {/* Barrinha Vermelha de Progresso Assistido */}
          {simProgress > 0 && (
            <div className="absolute bottom-0 inset-x-0 h-1 md:h-1.5 bg-black/70 z-20 overflow-hidden pointer-events-none">
              <div 
                className="h-full bg-red-600 transition-all duration-300 shadow-[0_0_8px_rgba(220,38,38,0.8)]"
                style={{ width: `${Math.min(100, Math.max(3, simProgress))}%` }}
              />
            </div>
          )}
        </div>
        <div className="p-4">
          <p className="text-white font-bold text-sm mb-2 line-clamp-1">{similar.title}</p>
          <p className="text-gray-400 text-xs line-clamp-3 leading-relaxed">{similar.description || "Uma produção imperdível disponível no ZapiTV."}</p>
        </div>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-[400] overflow-y-auto overflow-x-hidden no-scrollbar bg-black/80 backdrop-blur-md ${
      isClosing ? 'animate-out fade-out duration-300' : 'animate-in fade-in duration-300'
    }`}>
      {isPlaying && (
        <ZapiPlayer 
          key={hasEpisodes ? `${item.id}_s${currentEpisodeParams?.season || 1}_e${currentEpisodeParams?.episode || 1}` : item.id}
          item={item} 
          streams={resolvedStreams} 
          isLoadingStreams={isLoadingStreams}
          initialSeason={currentEpisodeParams?.season || (hasEpisodes ? 1 : undefined)}
          initialEpisode={currentEpisodeParams?.episode || (hasEpisodes ? 1 : undefined)}
          nextEpisodeInfo={nextEpisodeInfo}
          playbackSessionId={playbackSessionId}
          navigationType={navigationType}
          initialPlayIntro={!sessionIntroPlayed}
          onIntroCompleted={() => {
            setSessionIntroPlayed(true);
            if (playbackSessionId) {
              playbackSessionService.markIntroPlayed(playbackSessionId);
            } else {
              playbackSessionService.markIntroPlayed();
            }
          }}
          onClose={handleClosePlayer}
          onNextEpisode={hasNextEpisode ? handleNextEpisode : undefined}
        />
      )}
      
      {!isPlaying && (
        <div className="min-h-full w-full flex items-start justify-center py-8 md:py-12 px-4">
          <div ref={modalRef} className={`relative w-full max-w-[850px] bg-[#0f1115] rounded-[32px] shadow-2xl overflow-hidden border border-white/10 ${
              isClosing ? 'animate-out zoom-out-95 slide-out-to-bottom-[5%] duration-300' : 'animate-in zoom-in-95 slide-in-from-bottom-[5%] duration-300'
            }`}>
            <button onClick={handleClose} className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all">
              <X className="w-5 h-5" />
            </button>

            <div className="relative aspect-[4/5] md:aspect-video w-full">
              <div className="absolute inset-0">
                <img 
                  src={item.backdrop || item.image} 
                  alt={item.title} 
                  onError={(e) => { 
                    const target = e.target as HTMLImageElement;
                    if (target.src !== item.image && item.image) {
                      target.src = item.image;
                    }
                  }} 
                  className="w-full h-full object-cover" 
                  loading="lazy" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1115] via-[#0f1115]/40 to-transparent" />
              </div>

              <div className="absolute bottom-0 left-0 w-full px-6 md:px-12 pb-8 md:pb-12 z-20 flex flex-col justify-end h-full">
                {/* Badges de Disponibilidade e Idioma Real */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {item.audioStatus === 'pt-br-original' && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                      🇧🇷 Áudio Original PT-BR Confirmado
                    </span>
                  )}
                  {item.audioStatus === 'pt-br-dubbed' && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                      🇧🇷 Dublagem PT-BR Confirmada
                    </span>
                  )}
                  {item.audioStatus === 'other' && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                      🌐 Áudio Original (Com Legendas PT-BR)
                    </span>
                  )}
                  {item.audioStatus === 'universal' && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                      🎵 Trilha Sonora Universal / Sem Diálogos
                    </span>
                  )}
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-4 md:mb-6 drop-shadow-xl max-w-2xl leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
                  {item.title}
                </h1>
                
                <div className="flex items-center gap-3 md:gap-4">
                  <button 
                    className="flex items-center gap-2 px-6 md:px-8 py-3 md:py-3.5 bg-[#007df7] text-white rounded-2xl font-black text-sm md:text-lg hover:bg-[#0069d9] transition-all hover:scale-105 shadow-xl shadow-[#007df7]/20"
                    onClick={() => startPlayback(undefined, undefined, 'manual_start')}
                  >
                    <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                    Assistir
                  </button>
                  <button 
                    onClick={(e) => onToggleFavorite(e, item.id)} 
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-full border flex items-center justify-center backdrop-blur-sm transition-all group ${isFavorite ? 'bg-[#007df7] border-[#007df7] text-white shadow-lg' : 'bg-white/5 border-white/10 text-white hover:bg-white/20 hover:border-white/30'}`} 
                    title="Favoritos"
                  >
                    <Heart className={`w-5 h-5 md:w-5 md:h-5 group-hover:scale-110 transition-transform ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button 
                    onClick={(e) => onToggleList(e, item.id)} 
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-full border flex items-center justify-center backdrop-blur-sm transition-all group ${isInList ? 'bg-white text-[#007df7] border-white shadow-lg' : 'bg-white/5 border-white/10 text-white hover:bg-white/20 hover:border-white/30'}`} 
                    title="Minha Lista"
                  >
                    <Bookmark className={`w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform ${isInList ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-8 md:px-12 py-8 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-10">
              <div>
                <div className="flex items-center flex-wrap gap-3 text-white mb-6 font-medium">
                  <span className="text-green-400 font-black">{item.year}</span>
                  <span className="bg-white/10 border border-white/10 px-1.5 py-0.5 text-xs text-white rounded font-bold uppercase tracking-wider">HD</span>
                  <span className="bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded">{item.rating > 8 ? '16' : '12'}</span>
                  <span className="text-gray-300">{item.type}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-black bg-green-500/20 text-green-400 border border-green-500/30">
                    🇧🇷 Áudio Dublado PT-BR
                  </span>
                </div>
                <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-6 font-medium">
                  {item.description || "Assista agora no ZapiTV com streaming em alta definição."}
                </p>
              </div>
              <div className="text-xs md:text-sm space-y-4">
                {item.director && (<div><span className="text-gray-500 font-bold">Direção: </span><span className="text-gray-300">{item.director}</span></div>)}
                {item.cast && item.cast.length > 0 && (<div><span className="text-gray-500 font-bold">Elenco: </span><span className="text-gray-300">{item.cast.join(', ')}</span></div>)}
                {item.genres && (<div><span className="text-gray-500 font-bold">Gêneros: </span><span className="text-gray-300">{item.genres.join(', ')}</span></div>)}
              </div>
            </div>

            {hasEpisodes && (
              <div className="px-8 md:px-12 py-8 border-t border-white/5 bg-transparent">
                <div className="flex flex-row justify-between items-end mb-8">
                  <h3 className="text-2xl font-black text-white">Episódios</h3>
                  <div className="relative group">
                    <select 
                      value={currentSeason} 
                      onChange={(e) => setCurrentSeason(Number(e.target.value))} 
                      className="appearance-none bg-[#242424] border border-white/20 text-white py-2 pl-4 pr-10 rounded font-bold text-sm outline-none cursor-pointer hover:bg-[#333] transition-colors"
                    >
                      {Array.from({ length: totalSeasons }).map((_, i) => (
                         <option key={i + 1} value={i + 1}>Temporada {i + 1}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-white" />
                  </div>
                </div>

                <div className="space-y-px bg-white/5 rounded-lg overflow-hidden border border-white/5">
                  {isLoadingEpisodes ? (
                    <div className="p-8 flex flex-col items-center justify-center gap-3 text-gray-400 font-bold text-sm">
                      <ZapiLoader size="sm" />
                      <span>Carregando episódios da Temporada {currentSeason}...</span>
                    </div>
                  ) : (
                    episodes.map((ep) => {
                      const epProgress = getEpisodeProgress(currentSeason, ep.number);
                      return (
                        <div 
                          key={ep.id} 
                          onClick={() => handleEpisodeClick(currentSeason, ep.number)} 
                          className="group flex flex-col md:flex-row items-center gap-4 md:gap-6 p-4 md:p-6 hover:bg-white/5 transition-colors cursor-pointer border-b border-black/20 last:border-0"
                        >
                          <div className="text-2xl font-normal text-gray-500 w-8 text-center shrink-0">{ep.number}</div>
                          <div className="relative w-full md:w-40 aspect-video rounded-lg overflow-hidden shrink-0 bg-black shadow-lg">
                            <img 
                              src={ep.image} 
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                              loading="lazy" 
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                               <Play className="w-8 h-8 fill-white text-white" />
                            </div>
                            {/* Barrinha Vermelha de Progresso Assistido (Estilo Netflix) */}
                            {epProgress > 0 && (
                              <div className="absolute bottom-0 inset-x-0 h-1 md:h-1.5 bg-black/70 z-20 overflow-hidden pointer-events-none">
                                <div 
                                  className="h-full bg-red-600 transition-all duration-300 shadow-[0_0_8px_rgba(220,38,38,0.8)]"
                                  style={{ width: `${Math.min(100, Math.max(3, epProgress))}%` }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 w-full text-center md:text-left">
                            <h4 className="text-white font-bold text-sm md:text-base group-hover:text-[#007df7] transition-colors">{ep.title}</h4>
                            <p className="text-xs md:text-sm text-gray-400 leading-relaxed line-clamp-2">{ep.description}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="px-8 md:px-12 py-8 border-t border-white/5 bg-black/20">
              <h3 className="text-xl font-black text-white mb-6">Títulos semelhantes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {initialSimilar.map(renderSimilarCard)}
              </div>
              {extraSimilar.length > 0 && (
                 <div className={`transition-all duration-700 ease-in-out overflow-hidden ${isSimilarExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                       {extraSimilar.map(renderSimilarCard)}
                    </div>
                 </div>
              )}
              {similarTitles.length > 6 && (
                <div className="relative w-full flex items-center justify-center mt-10 mb-4">
                   <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/10" />
                   <button onClick={() => setIsSimilarExpanded(!isSimilarExpanded)} className="relative z-10 w-12 h-12 rounded-full bg-[#0f1115] border border-white/20 hover:border-white hover:bg-[#1a1d24] flex items-center justify-center transition-all duration-300 shadow-lg group">
                     {isSimilarExpanded ? <ChevronUp className="w-6 h-6 text-gray-400 group-hover:text-white" /> : <ChevronDown className="w-6 h-6 text-gray-400 group-hover:text-white" />}
                   </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentDetailModal;