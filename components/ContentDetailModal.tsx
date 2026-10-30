import React, { Suspense, lazy, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Play, Bookmark, Heart, ChevronDown, ChevronUp, AlertCircle, Users, Clock } from 'lucide-react';
import { ContentItem, ContentType } from '../types';
import { tmdbService } from '../src/core/tmdb/tmdbClient';
import { providerRegistry } from '../src/core/providers/providerRegistry';
import { StremioStream } from '../src/core/stremio/stremioTypes';
import { storageService } from '../src/core/storage/storageService';
import { ZapiLoader } from '../src/components/common/ZapiLoader';
import { FeatureErrorBoundary } from '../src/components/common/FeatureErrorBoundary';
import { playbackSessionService, NavigationType } from '../src/core/session/playbackSessionService';
import { catalogEligibilityService } from '../src/core/catalog/CatalogEligibilityService';
import { theatricalFilterService } from '../src/core/catalog/theatricalFilterService';
import { mediaLoadingTracker } from '../src/core/tracking/mediaLoadingTracker';
import { mediaAvailabilityIndex } from '../src/core/catalog/MediaAvailabilityIndex';
import { canonicalIdentityService } from '../src/core/identity/canonicalIdentity';
import { sourceConfidenceEngine } from '../src/core/identity/sourceConfidenceEngine';
import { audioPreferenceService } from '../src/core/audio/audioPreferenceService';
import { streamValidator } from '../src/core/providers/streamValidator';
import { similarTitlesService } from '../src/core/recommendations/similarTitlesService';
import { userPreferenceStore } from '../src/core/recommendations/userPreferenceStore';
import { episodeAvailabilityService } from '../src/core/episodes/episodeAvailabilityService';
import { animeSeasonMappingService } from '../src/core/anime/animeSeasonMappingService';
import { sourceVerificationService, VerificationState, MSG_INCONCLUSIVE, MSG_UNAVAILABLE } from '../src/core/providers/sourceVerificationService';
import { watchPartyService } from '../src/core/watchparty/WatchPartyService';
import { uiSoundService } from '../src/core/audio/uiSoundService';
import { getRememberedSources, prioritizeRememberedSources, RememberedSource } from '../src/core/providers/sourceMemory';
import { useTvFocusable } from '../src/core/tv/useTvFocusable';
import { tvModeService } from '../src/core/tv/tvModeService';
import { tvNavigationManager } from '../src/core/tv/tvNavigationManager';
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { mobileFullscreenService } from '../src/core/mobile/mobileFullscreenService';
import { getWatchRoute, getContentRoute, parseWatchRoute } from '../src/core/routes/navigationRoutes';
import { useIsMobileViewport } from '../src/core/mobile/mobileViewportService';
import { useExpandableSynopsis } from '../src/components/common/useExpandableSynopsis';

const DetailModalTvButton: React.FC<{
  focusKey: string;
  onClick: (e: any) => void;
  className: string;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}> = ({ focusKey, onClick, className, title, ariaLabel, children }) => {
  const isTv = tvModeService.isTvMode();
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: () => onClick({ preventDefault: () => {}, stopPropagation: () => {} } as any)
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      data-focus-key={focusKey}
      tabIndex={isTv ? 0 : undefined}
      title={title}
      aria-label={ariaLabel}
      className={`${className} ${focused ? 'tv-focused scale-105 z-30' : ''}`}
    >
      {children}
    </button>
  );
};

const SeasonSelectTv: React.FC<{
  currentSeason: number;
  availableSeasons: number[];
  onChange: (val: number) => void;
}> = ({ currentSeason, availableSeasons, onChange }) => {
  const isTv = tvModeService.isTvMode();
  const { ref, focused } = useTvFocusable({
    focusKey: 'modal-season-select',
    autoScroll: true
  });

  return (
    <div className={`relative group ${focused ? 'tv-focused rounded-xl' : ''}`}>
      <select 
        ref={ref}
        value={currentSeason} 
        onChange={(e) => onChange(Number(e.target.value))} 
        className="appearance-none bg-[#242424] border border-white/20 text-white py-1.5 sm:py-2 pl-3 sm:pl-4 pr-9 sm:pr-10 rounded-xl font-bold text-xs sm:text-sm outline-none cursor-pointer hover:bg-[#333] transition-colors"
        aria-label="Selecionar temporada"
      >
        {availableSeasons.map((sNum) => (
           <option key={sNum} value={sNum}>Temporada {sNum}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-white" />
    </div>
  );
};

const EpisodeTvRow: React.FC<{
  ep: any;
  currentSeason: number;
  epProgress: number;
  onEpisodeClick: (season: number, episode: number) => void;
}> = ({ ep, currentSeason, epProgress, onEpisodeClick }) => {
  const isTv = tvModeService.isTvMode();
  const { ref, focused } = useTvFocusable({
    focusKey: `ep-${currentSeason}-${ep.number}`,
    onEnterPress: () => onEpisodeClick(currentSeason, ep.number),
    autoScroll: true
  });

  return (
    <div 
      ref={ref}
      key={ep.id} 
      data-focus-key={`ep-${currentSeason}-${ep.number}`}
      tabIndex={isTv ? 0 : undefined}
      onClick={() => {
        mobileFullscreenService.requestAutoFullscreenAndLandscape().catch(() => {});
        onEpisodeClick(currentSeason, ep.number);
      }} 
      className={`group flex flex-row items-center gap-3 sm:gap-4 md:gap-6 p-3 sm:p-4 md:p-6 transition-all cursor-pointer border-b border-black/20 last:border-0 ${
        focused ? 'tv-focused bg-white/10 ring-2 ring-[#00e5ff] scale-[1.01] z-20' : 'hover:bg-white/5'
      }`}
    >
      <div className={`text-base sm:text-xl md:text-2xl font-normal w-6 sm:w-8 text-center shrink-0 ${focused ? 'text-cyan-300 font-bold' : 'text-gray-500'}`}>{ep.number}</div>
      <div className="relative w-24 sm:w-36 md:w-40 aspect-video rounded-lg overflow-hidden shrink-0 bg-black shadow-lg">
        <img 
          src={ep.image} 
          alt={`Episódio ${ep.number} - ${ep.title}`}
          className={`w-full h-full object-cover transition-opacity ${focused ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`} 
          loading="lazy" 
        />
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity bg-black/40 ${focused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
           <Play className="w-5 h-5 sm:w-8 sm:h-8 fill-white text-white" />
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
      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-xs sm:text-sm md:text-base transition-colors truncate ${focused ? 'text-cyan-300' : 'text-white group-hover:text-[#007df7]'}`}>{ep.title}</h4>
        <p className="text-[11px] sm:text-xs md:text-sm text-gray-400 leading-relaxed line-clamp-2 mt-0.5">{ep.description}</p>
      </div>
    </div>
  );
};

const ZapiPlayer = lazy(() => import('../src/components/player/ZapiPlayer').then(m => ({ default: m.ZapiPlayer })));
const WatchPartyModal = lazy(() => import('../src/components/watchparty/WatchPartyModal').then(m => ({ default: m.WatchPartyModal })));
const ReportFeedbackModal = lazy(() => import('../src/components/feedback/ReportFeedbackModal').then(m => ({ default: m.ReportFeedbackModal })));

interface ContentDetailModalProps {
  item: ContentItem;
  onClose: () => void;
  isDarkMode: boolean;
  myList: string[];
  favorites: string[];
  onToggleList: (e: React.MouseEvent, id: string) => void;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  allContent: ContentItem[];
  initialSeason?: number;
  initialEpisode?: number;
  autoPlayInitialEpisode?: boolean;
  playerOnly?: boolean;
  originRoute?: string | null;
  onSelectContent?: (item: ContentItem) => void;
}

function uniqueEpisodes<T extends { number: number }>(episodes: T[]): T[] {
  const seen = new Set<number>();
  return episodes.filter(ep => {
    if (!Number.isInteger(ep.number) || ep.number < 1 || seen.has(ep.number)) return false;
    seen.add(ep.number);
    return true;
  }).sort((a, b) => a.number - b.number);
}

export const ContentDetailModal: React.FC<ContentDetailModalProps> = ({ 
  item: initialItem, onClose, isDarkMode, myList, favorites, onToggleList, onToggleFavorite, allContent,
  initialSeason, initialEpisode, autoPlayInitialEpisode, playerOnly = false, originRoute, onSelectContent
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [item, setItem] = useState<ContentItem>(initialItem);
  const [isSimilarExpanded, setIsSimilarExpanded] = useState(false);
  const [similarTitles, setSimilarTitles] = useState<ContentItem[]>(() => 
    similarTitlesService.getImmediateSimilar(initialItem, allContent)
  );
  const [isClosing, setIsClosing] = useState(false);
  const initialContinuity = useMemo(() => {
    return storageService.getPlaybackContinuity(initialItem);
  }, [initialItem]);

  const initialAnimeMapping = useMemo(() => {
    return animeSeasonMappingService.resolveAnimeTmdbIdentity(initialItem);
  }, [initialItem]);

  const [currentSeason, setCurrentSeason] = useState<number>(() => {
    if (initialSeason) return initialSeason;
    if (initialContinuity.hasStarted && initialContinuity.season) return initialContinuity.season;
    if (initialAnimeMapping?.defaultSeason) return initialAnimeMapping.defaultSeason;
    return 1;
  });
  const [totalSeasons, setTotalSeasons] = useState(() => {
    if (initialItem.seasonsCount && initialItem.seasonsCount > 0) return initialItem.seasonsCount;
    if (initialAnimeMapping) return 3;
    return 1;
  });
  const [availableSeasons, setAvailableSeasons] = useState<number[]>(() => {
    if (initialItem.episodes && initialItem.episodes.length > 0) {
      const sSet = new Set(initialItem.episodes.map((e: any) => Number(e.season ?? 1)).filter((s: number) => s > 0));
      if (sSet.size > 0) return Array.from(sSet).sort((a: number, b: number) => a - b);
    }
    const count = initialItem.seasonsCount || (initialAnimeMapping ? 3 : 1);
    return Array.from({ length: Math.max(1, count) }, (_, i) => i + 1);
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [resolvedStreams, setResolvedStreams] = useState<StremioStream[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [streamResolutionError, setStreamResolutionError] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<VerificationState>('IDLE');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showWatchPartyModal, setShowWatchPartyModal] = useState(false);
  const isScheduledUnavailable = !catalogEligibilityService.isCatalogVisibleNow(item);
  const isMobile = useIsMobileViewport(768);
  const synopsisText = item.description || "Assista agora no ZapiTV com streaming em alta definição.";
  const {
    isExpanded: isSynopsisExpanded,
    canExpand: canExpandSynopsis,
    toggleSynopsis,
    textRef: synopsisTextRef,
    measureRef: synopsisMeasureRef
  } = useExpandableSynopsis({
    text: synopsisText,
    contentId: item.id,
    maxLines: isMobile ? 3 : 4
  });
  const [, setModalEligibilityVersion] = useState(0);
  useEffect(() => {
    return catalogEligibilityService.subscribe(() => {
      setModalEligibilityVersion(v => v + 1);
    });
  }, []);
  const [progressVersion, setProgressVersion] = useState(0);

  // Auto-play episode if directed by URL deep link
  const autoPlayTriggeredRef = useRef(false);

  // Registro de interesse exploratório no motor de recomendações e pré-aquecimento assíncrono do ZapiPlayer
  useEffect(() => {
    if (initialItem && initialItem.id) {
      userPreferenceStore.recordDetailView(initialItem).catch(() => {});
    }
    const timer = setTimeout(() => {
      import('../src/components/player/ZapiPlayer').catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, [initialItem?.id]);

  // Playback session lifecycle
  const playbackRequestIdRef = useRef<number>(0);
  const [playbackSessionId, setPlaybackSessionId] = useState<string>('');
  const [loadingTraceId, setLoadingTraceId] = useState<string>('');
  const loadingTraceIdRef = useRef<string>('');
  const [navigationType, setNavigationType] = useState<NavigationType>('manual_start');
  const [sessionIntroPlayed, setSessionIntroPlayed] = useState<boolean>(false);

  // ETAPA 1: Prefetch de fontes em segundo plano ao abrir o modal
  const prefetchedSourcesRef = useRef<{
    targetKey: string;
    promise: Promise<StremioStream[]>;
    streams: StremioStream[];
    status: 'idle' | 'pending' | 'resolved' | 'error';
  } | null>(null);
  const prefetchGenerationRef = useRef<number>(0);
  const prefetchAbortControllerRef = useRef<AbortController | null>(null);
  const activePlaybackAbortControllerRef = useRef<AbortController | null>(null);

  const cancelAllPendingRequests = useCallback(() => {
    prefetchGenerationRef.current++;
    if (prefetchAbortControllerRef.current) {
      try { prefetchAbortControllerRef.current.abort(); } catch {}
      prefetchAbortControllerRef.current = null;
    }
    if (activePlaybackAbortControllerRef.current) {
      try { activePlaybackAbortControllerRef.current.abort(); } catch {}
      activePlaybackAbortControllerRef.current = null;
    }
    prefetchedSourcesRef.current = null;
  }, []);

  // Dynamic episodes from TMDB
  const [episodes, setEpisodes] = useState<{
    id: string;
    number: number;
    title: string;
    description: string;
    image: string;
  }[]>(() => {
    if (initialItem.episodes && initialItem.episodes.length > 0) {
      const season = initialSeason || initialContinuity.season || 1;
      const filtered = initialItem.episodes.filter((e: any) => Number(e.season ?? 1) === season);
      return episodeAvailabilityService.filterAiredEpisodes(filtered as any[]);
    }
    return [];
  });
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [retryEpisodeTrigger, setRetryEpisodeTrigger] = useState(0);

  // Parâmetros do player (filme ou série/EP)
  const [currentEpisodeParams, setCurrentEpisodeParams] = useState<{season: number, episode: number} | null>(null);

  const isFavorite = favorites.includes(item.id);
  const isInList = myList.includes(item.id);
  const hasEpisodes = item.mediaFormat !== 'movie' && (item.type === ContentType.SERIES || item.type === ContentType.ANIME);
  const [rememberedSources, setRememberedSources] = useState<RememberedSource[]>([]);
  useEffect(() => {
    let active = true;
    const identity = canonicalIdentityService.buildIdentity(item,
      hasEpisodes ? { season: currentSeason, episode: currentEpisodeParams?.episode || 1 } : undefined);
    setRememberedSources([]);
    getRememberedSources({
      canonicalId: identity.canonicalId || '',
      mediaType: (identity.canonicalId?.split(':')[0] as 'movie' | 'series' | 'anime') || 'movie',
      season: hasEpisodes ? currentSeason : 0,
      episode: hasEpisodes ? currentEpisodeParams?.episode || 1 : 0,
    }).then(rows => { if (active) setRememberedSources(rows); });
    return () => { active = false; };
  }, [item.id, item.canonicalId, item.imdbId, item.tmdbId, item.aniListId,
    item.title, item.type, item.mediaFormat, currentSeason, currentEpisodeParams?.episode, hasEpisodes]);

  // Referência perfeitamente estável do objeto item passado ao player para eliminar loops e re-renderizações desnecessárias
  const stablePlayerItem = useMemo(() => {
    if (item.episodes && item.episodes.length > 0) return item;
    if (episodes && episodes.length > 0) {
      return {
        ...item,
        episodes: episodes.map(e => ({
          ...e,
          season: (e as any).season ?? currentSeason
        }))
      };
    }
    return item;
  }, [item.id, item.title, item.type, item.mediaFormat, item.episodes, episodes, currentSeason]);

  const verifiedStreamsForPlayer = useMemo(() => prioritizeRememberedSources(
    (item.verifiedStreams || []).map(source => ({ ...source, providerId: source.providerId || 'zapitv-verified' })),
    rememberedSources,
  ), [item.verifiedStreams, rememberedSources]);

  // ETAPA 1: Busca e validação leve em segundo plano das fontes, priorizando PT-BR sem baixar o vídeo
  const prefetchSources = useCallback((targetItem: ContentItem, targetSeason?: number, targetEpisode?: number) => {
    if (isPlaying) return;
    const isMovie = targetItem.mediaFormat === 'movie' || targetItem.type === ContentType.MOVIE;
    const epParams = (!isMovie && targetSeason && targetEpisode)
      ? { season: targetSeason, episode: targetEpisode }
      : undefined;
    const targetKey = isMovie 
      ? `${targetItem.id}:movie` 
      : `${targetItem.id}:s${targetSeason || 1}:e${targetEpisode || 1}`;

    if (prefetchedSourcesRef.current?.targetKey === targetKey) {
      return;
    }

    if (prefetchAbortControllerRef.current) {
      try { prefetchAbortControllerRef.current.abort(); } catch {}
      prefetchAbortControllerRef.current = null;
    }
    const abortController = new AbortController();
    prefetchAbortControllerRef.current = abortController;

    const gen = ++prefetchGenerationRef.current;
    const targetType = isMovie ? 'movie' : (targetItem.type === ContentType.ANIME ? 'anime' : 'series');
    const animeMapped = animeSeasonMappingService.resolveAnimeTmdbIdentity(targetItem);
    const targetId = {
      tmdbId: targetItem.tmdbId || animeMapped?.tmdbId,
      imdbId: targetItem.imdbId || animeMapped?.imdbId,
      id: targetItem.id,
      title: targetItem.title,
      originalTitle: targetItem.originalTitle,
      year: targetItem.year
    };

    const promise = (async () => {
      try {
        const streams = await providerRegistry.resolveStreams(
          targetType,
          targetId,
          epParams,
          {
            signal: abortController.signal,
            onProgressiveStreams: (progressive) => {
              if (prefetchGenerationRef.current !== gen || abortController.signal.aborted) return;
              if (prefetchedSourcesRef.current?.targetKey === targetKey) {
                prefetchedSourcesRef.current.streams = progressive;
                prefetchedSourcesRef.current.status = 'resolved';
              }
            }
          }
        );
        if (prefetchGenerationRef.current !== gen || abortController.signal.aborted) return [];

        // Validação leve em segundo plano das 3 primeiras fontes sem baixar vídeo
        if (streams && streams.length > 0) {
          const topCandidates = streams.slice(0, 3);
          for (const cand of topCandidates) {
            if (cand?.url) {
              streamValidator.validateStream(cand, 2500).catch(() => {});
            }
          }
        }
        return streams;
      } catch {
        return [];
      }
    })();

    prefetchedSourcesRef.current = {
      targetKey,
      promise,
      streams: [],
      status: 'pending'
    };

    promise.then((streams) => {
      if (prefetchGenerationRef.current === gen && prefetchedSourcesRef.current?.targetKey === targetKey) {
        prefetchedSourcesRef.current.streams = streams;
        prefetchedSourcesRef.current.status = 'resolved';
        setResolvedStreams(streams);
      }
    }).catch(() => {
      if (prefetchGenerationRef.current === gen && prefetchedSourcesRef.current?.targetKey === targetKey) {
        prefetchedSourcesRef.current.status = 'error';
      }
    });
  }, [isPlaying]);

  // Dispara a Etapa 1 automaticamente ao abrir o modal ou alternar temporada
  useEffect(() => {
    if (isPlaying) return;
    const isMovie = item.mediaFormat === 'movie' || item.type === ContentType.MOVIE;
    if (isMovie) {
      prefetchSources(item);
    } else {
      const cont = storageService.getPlaybackContinuity(item, totalSeasons, episodes.length);
      const s = (currentSeason && (!cont.hasStarted || currentSeason !== cont.season))
        ? currentSeason
        : (cont.season || currentSeason || 1);
      const e = (s === cont.season && cont.hasStarted) ? (cont.episode || 1) : 1;
      prefetchSources(item, s, e);
    }
  }, [item.id, item.tmdbId, item.imdbId, currentSeason, totalSeasons, episodes.length, isPlaying, prefetchSources]);

  // Limpeza de tarefas de prefetch e requisições pendentes ao desmontar
  useEffect(() => {
    return () => {
      cancelAllPendingRequests();
    };
  }, [cancelAllPendingRequests]);

  // Reage imediatamente a atualizações de progresso do player
  useEffect(() => {
    const handleProgressUpdate = (e: any) => {
      const keys = storageService.getCandidateKeys(item);
      if (keys.includes(e.detail?.contentId)) {
        setProgressVersion(v => v + 1);
      }
    };
    window.addEventListener('zapitv_progress_updated', handleProgressUpdate);
    return () => window.removeEventListener('zapitv_progress_updated', handleProgressUpdate);
  }, [item]);

  // Sincroniza a temporada atual com o progresso do item caso o item mude
  useEffect(() => {
    const cont = storageService.getPlaybackContinuity(item);
    if (cont.hasStarted && cont.season && !initialSeason) {
      setCurrentSeason(cont.season);
    }
  }, [item.id, initialSeason]);

  // Abertura segura e estável dos detalhes: metadados já carregados e fontes gerenciadas por prefetchSources

  const getEpisodeProgress = useCallback((season: number, episode: number): number => {
    return storageService.getSyncEpisodeProgress(item.id, season, episode);
  }, [item.id, progressVersion]);

  // Continuidade de reprodução baseada no histórico salvo
  const playbackContinuity = useMemo(() => {
    return storageService.getPlaybackContinuity(item, totalSeasons, episodes.length);
  }, [item, totalSeasons, episodes.length, progressVersion]);

  const isClosingRef = useRef(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    mobileFullscreenService.exitMobileFullscreen({ force: true }).catch(() => {});
    uiSoundService.play('detailClose');
    playbackRequestIdRef.current++;
    cancelAllPendingRequests();
    if (loadingTraceIdRef.current) mediaLoadingTracker.endTrace(loadingTraceIdRef.current, 'CANCELLED');
    setIsClosing(true);
    tvNavigationManager.restoreFocusSnapshot(`card-${item.id}`);
    if (playbackSessionId) {
      playbackSessionService.endSession(playbackSessionId);
    } else {
      playbackSessionService.endSession();
    }
    setPlaybackSessionId('');
    setSessionIntroPlayed(false);

    const parsed = parseWatchRoute(location.pathname);
    if (parsed.isWatch) {
      const isTv = tvModeService.isTvMode() || location.pathname.startsWith('/tv');
      if (isTv) {
        navigate('/tv', { replace: true });
      } else {
        const origin = originRoute || modalOriginRouteRef.current;
        const returnRoute = origin && !parseWatchRoute(origin).isWatch ? origin : '/';
        navigate(returnRoute, { replace: true });
      }
    }

    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
    }, 280);
  }, [cancelAllPendingRequests, item.id, onClose, playbackSessionId]);

  useEffect(() => {
    if (!isPlaying && !playerOnly) {
      return tvNavigationManager.registerBackHandler('detail-modal', 100, () => {
        handleClose();
        return true;
      });
    }
  }, [isPlaying, playerOnly, handleClose]);

  const modalOriginRouteRef = useRef<string | null>(originRoute || null);
  useEffect(() => {
    if (originRoute && !parseWatchRoute(originRoute).isWatch) {
      modalOriginRouteRef.current = originRoute;
    }
  }, [originRoute]);

  const handleClosePlayer = useCallback(() => {
    mobileFullscreenService.exitMobileFullscreen({ force: true }).catch(() => {});
    playbackRequestIdRef.current++;
    cancelAllPendingRequests();
    if (loadingTraceIdRef.current) mediaLoadingTracker.endTrace(loadingTraceIdRef.current, 'CANCELLED');
    const isTv = tvModeService.isTvMode() || location.pathname.startsWith('/tv');
    if (!playerOnly || !isTv) {
      setIsPlaying(false);
      setResolvedStreams([]);
    }
    isClosingRef.current = false;
    setIsClosing(false);
    if (playbackSessionId) {
      playbackSessionService.endSession(playbackSessionId);
    } else {
      playbackSessionService.endSession();
    }
    setPlaybackSessionId('');
    setSessionIntroPlayed(false);

    if (playerOnly) {
      onClose();
      return;
    }

    const parsed = parseWatchRoute(location.pathname);
    if (parsed.isWatch) {
      if (isTv) {
        navigate('/tv', { replace: true });
      } else {
        const fallbackRoute = getContentRoute(item);
        const origin = originRoute || modalOriginRouteRef.current;
        const returnRoute = origin && !parseWatchRoute(origin).isWatch
          ? origin
          : fallbackRoute;
        navigate(returnRoute, { replace: true });
      }
    }
  }, [cancelAllPendingRequests, playbackSessionId, playerOnly, onClose, location.pathname, navigate, item, originRoute]);

  // Click outside to close (apenas quando não estiver no player e nenhum modal flutuante estiver aberto)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isClosingRef.current || showFeedbackModal || showWatchPartyModal) return;

      if (modalRef.current && !modalRef.current.contains(event.target as Node) && !isPlaying) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClose, isPlaying, showFeedbackModal, showWatchPartyModal]);

  // Tecla Escape: fecha a janela de detalhes apenas se nenhum modal flutuante e o player não estiverem abertos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isClosingRef.current) return;
      if (e.key === 'Escape' && !isPlaying && !showFeedbackModal && !showWatchPartyModal) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isPlaying, showFeedbackModal, showWatchPartyModal]);

  // Sincronização com o botão Voltar do navegador caso saia da rota de assistir sem fechar o modal
  useEffect(() => {
    const isWatch = parseWatchRoute(location.pathname).isWatch;
    if (!isWatch && isPlaying && !playerOnly) {
      setIsPlaying(false);
      setResolvedStreams([]);
      isClosingRef.current = false;
      setIsClosing(false);
      if (playbackSessionId) {
        playbackSessionService.endSession(playbackSessionId);
      } else {
        playbackSessionService.endSession();
      }
      setPlaybackSessionId('');
    }
  }, [location.pathname, isPlaying, playerOnly, playbackSessionId]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Fetch full metadata from TMDB or Cinemeta para o item atual exibido no modal
  useEffect(() => {
    let active = true;
    const currentItem = item;
    const fetchMetadata = async () => {
      try {
        let details: any = null;
        const fetchPromise = (async () => {
          const rawId = currentItem.tmdbId || currentItem.id;
          let cleanTmdbId = typeof rawId === 'string' ? rawId.replace(/^tmdb-?/i, '') : String(rawId);
          let animeMapped = animeSeasonMappingService.resolveAnimeTmdbIdentity(currentItem);
          if (!cleanTmdbId || !/^\d+$/.test(cleanTmdbId)) {
            if (animeMapped?.tmdbId) {
              cleanTmdbId = animeMapped.tmdbId;
            } else {
              const discovered = await animeSeasonMappingService.discoverAnimeTmdbIdentity(currentItem);
              if (discovered?.tmdbId) {
                cleanTmdbId = discovered.tmdbId;
              }
            }
          }
          if (cleanTmdbId && /^\d+$/.test(cleanTmdbId)) {
            return await tmdbService.getDetails(cleanTmdbId, currentItem.type, currentItem.mediaFormat);
          } else if (currentItem.imdbId || animeMapped?.imdbId || currentItem.id.startsWith('tt')) {
            const targetImdb = currentItem.imdbId || animeMapped?.imdbId || currentItem.id;
            return await tmdbService.getDetailsByImdb(targetImdb, currentItem.type, currentItem.mediaFormat);
          }
          return null;
        })();

        // Timeout de 8 segundos para metadados
        details = await Promise.race([
          fetchPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
        ]);

        if (active && details && details.item && canonicalIdentityService.isSameWork(currentItem, details.item)) {
          const animeMapped = animeSeasonMappingService.resolveAnimeTmdbIdentity(currentItem);
          setItem(prev => ({
            ...prev,
            ...details.item,
            id: prev.id, // Preserva rigorosamente o ID inicial para evitar remount do ZapiPlayer
            imdbId: details.imdbId || animeMapped?.imdbId || prev.imdbId,
            tmdbId: details.item?.tmdbId || animeMapped?.tmdbId || prev.tmdbId,
            director: details.director || prev.director,
            cast: details.cast && details.cast.length > 0 ? details.cast : prev.cast
          }));
          if (details.seasons && details.seasons.length > 0) {
            const validSeasons = episodeAvailabilityService.getAvailableSeasons(details.seasons, details.seasonsCount);
            setAvailableSeasons(validSeasons);
            setTotalSeasons(validSeasons.length);
            if (!validSeasons.includes(currentSeason)) {
              const defaultSeason = (animeMapped?.defaultSeason && validSeasons.includes(animeMapped.defaultSeason))
                ? animeMapped.defaultSeason
                : (validSeasons[0] || 1);
              setCurrentSeason(defaultSeason);
            }
          } else if (details.seasonsCount && details.seasonsCount > 1) {
            setTotalSeasons(details.seasonsCount);
            const countSeasons = Array.from({ length: details.seasonsCount }, (_, i) => i + 1);
            setAvailableSeasons(countSeasons);
            if (!countSeasons.includes(currentSeason)) {
              const defaultSeason = (animeMapped?.defaultSeason && countSeasons.includes(animeMapped.defaultSeason))
                ? animeMapped.defaultSeason
                : (countSeasons[0] || 1);
              setCurrentSeason(defaultSeason);
            }
          }
        }
      } catch (err) {
        console.warn('Falha ao enriquecer detalhes:', err);
      }
    };
    fetchMetadata();
    return () => { active = false; };
  }, [item.tmdbId, item.imdbId, item.id, item.type]);

  // Carrega e refina títulos semelhantes via SimilarTitlesService (TMDB, AniList e Relevância Semântica)
  useEffect(() => {
    let active = true;
    // Cálculo imediato sem latência (cache ou semântico local rigoroso)
    const immediate = similarTitlesService.getImmediateSimilar(item, allContent);
    setSimilarTitles(immediate);

    similarTitlesService.getSimilarTitles(item, allContent)
      .then(results => {
        if (active) {
          setSimilarTitles(results);
        }
      })
      .catch(err => {
        console.warn('Erro ao carregar títulos semelhantes:', err);
      });

    return () => {
      active = false;
    };
  }, [item.id, item.imdbId, item.tmdbId, item.title, allContent]);

  // Dynamic episodes from item, TMDB or Cinemeta
  useEffect(() => {
    if (!hasEpisodes) return;
    let active = true;
    const fetchEpisodes = async () => {
      setIsLoadingEpisodes(true);
      try {
        const fetchEpPromise = (async () => {
          const rawId = item.tmdbId || item.id;
          let cleanTmdbId = typeof rawId === 'string' ? rawId.replace(/^tmdb-?/i, '') : String(rawId);
          let animeMapped = animeSeasonMappingService.resolveAnimeTmdbIdentity(item);
          if (!cleanTmdbId || !/^\d+$/.test(cleanTmdbId)) {
            if (animeMapped?.tmdbId) {
              cleanTmdbId = animeMapped.tmdbId;
            } else {
              const discovered = await animeSeasonMappingService.discoverAnimeTmdbIdentity(item);
              if (discovered?.tmdbId) {
                cleanTmdbId = discovered.tmdbId;
              }
            }
          }
          if (cleanTmdbId && /^\d+$/.test(cleanTmdbId)) {
            const eps = await tmdbService.getSeasonEpisodes(cleanTmdbId, currentSeason);
            if (eps && eps.length > 0) return eps;
          }
          const targetImdb = item.imdbId || animeMapped?.imdbId || (item.id.startsWith('tt') ? item.id : null);
          if (targetImdb) {
            const eps = await tmdbService.getSeasonEpisodesByImdb(targetImdb, currentSeason);
            if (eps && eps.length > 0) return eps;
          }
          if (item.episodes && item.episodes.length > 0) {
            const seasonEps = item.episodes.filter((e: any) => (e.season ?? 1) === currentSeason);
            if (seasonEps.length > 0) return seasonEps;
          }
          return [];
        })();

        // Timeout de 8 segundos para metadados dos episódios
        const rawEps = await Promise.race([
          fetchEpPromise,
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 8000))
        ]);

        if (active) {
          // 1. Filtragem rigorosa por Data de Estreia Oficial (sem descartar episódios reais lançados)
          const airedEps = episodeAvailabilityService.filterAiredEpisodes(rawEps, {
            seriesYear: item.year,
            totalEpisodesCount: rawEps.length
          });

          if (airedEps.length > 0) {
            setEpisodes(uniqueEpisodes(airedEps));
          } else if (rawEps.length === 0) {
            // Em caso de erro temporário de rede ou timeout, preserva os episódios se já existirem
            setEpisodes(prev => prev.length > 0 ? prev : []);
          } else {
            setEpisodes([]);
          }
          setIsLoadingEpisodes(false);

          // 2. Auditoria/Pré-validação em segundo plano sem apagar episódios da interface
          // Mantém integridade total dos metadados independente do status de streams individuais
          (async () => {
            for (const ep of airedEps) {
              if (!active) break;
              const cached = episodeAvailabilityService.getCachedAvailability(item.id, currentSeason, ep.number);
              if (cached.checked) continue;

              await episodeAvailabilityService.verifyEpisodeAvailability(
                item,
                currentSeason,
                ep.number,
                (ep as any).airDate || (ep as any).releaseDate
              ).catch(() => {});
            }
          })().catch(() => {});
        }
      } catch (e) {
        console.warn('Erro ao carregar episódios:', e);
        if (active) {
          setEpisodes(prev => prev.length > 0 ? prev : []);
        }
      } finally {
        if (active) {
          setIsLoadingEpisodes(false);
        }
      }
    };
    fetchEpisodes();
    return () => { active = false; };
  }, [hasEpisodes, item.tmdbId, item.imdbId, item.id, item.episodes, currentSeason, item.backdrop, item.image, retryEpisodeTrigger]);

  // Pre-fetch / Resolve Streams whenever play is triggered
  const startPlayback = async (
    season?: number, 
    episode?: number, 
    navType: NavigationType = 'manual_start',
    isAutoRetry = false
  ) => {
    // Se já estiver reproduzindo ou em reprodução contínua, marca transição de episódio para preservar fullscreen e landscape
    if (isPlaying || navType === 'continuous_playback') {
      mobileFullscreenService.beginEpisodeTransition();
    }

    // Solicitação imediata de Fullscreen e Orientação no gesto de toque antes de operações assíncronas
    if (navType === 'manual_start' || navType === 'continuous_playback') {
      mobileFullscreenService.requestAutoFullscreenAndLandscape().catch(() => {});
    }

    if (isScheduledUnavailable) {
      setVerificationState('UNAVAILABLE');
      setStreamResolutionError('Este título está temporariamente indisponível no catálogo. Retorno programado para 20/11/2026 às 00:00 (Horário de Brasília).');
      setIsLoadingStreams(false);
      return;
    }

    const currentRequestId = ++playbackRequestIdRef.current;
    const currentTargetItem = item;
    let epParams: { season: number; episode: number } | undefined = undefined;

    if (hasEpisodes) {
      const isExplicitEpisodeClick = season !== undefined && episode !== undefined;
      let targetSeason: number;
      let targetEpisode: number;

      if (isExplicitEpisodeClick) {
        // Seleção manual de episódio na lista é soberana
        targetSeason = season;
        targetEpisode = episode;
      } else {
        // Clique no botão principal "Assistir" ou "Continuar assistindo":
        // Consulta a continuidade como fonte única da verdade
        const cont = storageService.getPlaybackContinuity(currentTargetItem, totalSeasons, episodes.length);
        // Se o usuário está navegando em uma temporada específica no modal diferente da continuidade gravada,
        // ou se ainda não iniciou a reprodução:
        if (currentSeason && (!cont.hasStarted || currentSeason !== cont.season)) {
          targetSeason = currentSeason;
          targetEpisode = 1;
        } else {
          targetSeason = cont.hasStarted ? (cont.season || currentSeason || 1) : (currentSeason || 1);
          targetEpisode = cont.hasStarted ? (cont.episode || 1) : 1;
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

    const isTv = tvModeService.isTvMode() || location.pathname.startsWith('/tv');
    const targetWatchRoute = getWatchRoute(currentTargetItem, epParams?.season, epParams?.episode, isTv);
    if (location.pathname !== targetWatchRoute) {
      navigate(targetWatchRoute, { replace: navType === 'continuous_playback' });
    }

    const requestedKey = (currentTargetItem.mediaFormat === 'movie' || currentTargetItem.type === ContentType.MOVIE)
      ? `${currentTargetItem.id}:movie`
      : `${currentTargetItem.id}:s${epParams?.season || 1}:e${epParams?.episode || 1}`;

    // A recuperação automática da busca pertence ao mesmo clique do usuário.
    // Não a transforme em retry_playback, que marcaria a intro como já exibida.
    if (!isAutoRetry) {
      const session = playbackSessionService.startSession(
        currentTargetItem.id,
        navType,
        epParams?.season,
        epParams?.episode
      );
      setPlaybackSessionId(session.sessionId);
      setNavigationType(navType);
      setSessionIntroPlayed(session.introPlayed);
    }

    setIsPlaying(true);
    setStreamResolutionError(null);

    // Se for convidado em modo Transmissão do Host (WebRTC), não busca fontes no dispositivo do convidado
    if (watchPartyService.isConnected && !watchPartyService.isHost() && watchPartyService.isHostBroadcastMode()) {
      setVerificationState('AVAILABLE');
      setResolvedStreams([{
        name: 'Transmissão do Host',
        title: 'Transmissão do Host (WebRTC Direto)',
        url: '',
        quality: '1080p',
        isDubbed: true,
        isPtBr: true
      } as any]);
      setIsLoadingStreams(false);
      return;
    }

    // Uma tentativa e um episódio por trace, inclusive quando a descoberta já terminou no prefetch.
    const traceId = mediaLoadingTracker.startTrace(
      currentTargetItem.id, currentTargetItem.title, currentTargetItem.type,
      epParams?.season, epParams?.episode
    );
    loadingTraceIdRef.current = traceId;
    setLoadingTraceId(traceId);
    mediaLoadingTracker.recordEvent(traceId, 'MEDIA_SELECTED', 'ContentDetailModal', 'OK',
      { season: epParams?.season, episode: epParams?.episode });
    try {
      const identity = canonicalIdentityService.buildIdentity(currentTargetItem, epParams);
      if (identity.canonicalId) mediaLoadingTracker.recordEvent(traceId, 'CANONICAL_ID_RESOLVED', 'canonicalIdentityService');
    } catch { /* Telemetria não pode interromper a reprodução. */ }

    // ETAPA 2: Verifica se já temos fontes pré-resolvidas em cache da etapa 1
    const prefetched = prefetchedSourcesRef.current;
    const identityForPrefetch = canonicalIdentityService.buildIdentity(currentTargetItem, epParams);
    const validPrefetchedStreams = (prefetched?.streams || []).filter(s =>
      sourceConfidenceEngine.evaluate(s, identityForPrefetch).isMatch
    );
    const hasReadyPrefetch = prefetched && 
      prefetched.targetKey === requestedKey && 
      prefetched.status === 'resolved' && 
      validPrefetchedStreams.length > 0 &&
      !isAutoRetry;

    if (hasReadyPrefetch) {
      // Fontes já prontas e com identidade canônica confirmada: passa ao ZapiPlayer
      setVerificationState('AVAILABLE');
      setResolvedStreams(validPrefetchedStreams);
      setIsLoadingStreams(false);
      mediaLoadingTracker.recordEvent(traceId, 'CANDIDATES_FILTERED', 'ContentDetailModal', 'OK',
        { streamCount: validPrefetchedStreams.length, prefetched: true });
      mediaLoadingTracker.transition(traceId, 'BUFFERING', {
        streamCount: validPrefetchedStreams.length,
        prefetched: true
      });
      return;
    }

    const hasPendingPrefetch = prefetched &&
      prefetched.targetKey === requestedKey &&
      prefetched.status === 'pending' &&
      !isAutoRetry;

    setIsLoadingStreams(true);
    setResolvedStreams([]);

    mediaLoadingTracker.recordEvent(traceId, 'DISCOVERY_STARTED', 'sourceVerificationService', 'STARTED');
    mediaLoadingTracker.transition(traceId, 'PREPARING_PLAYER', {
      navType,
      season: epParams?.season,
      episode: epParams?.episode
    });

    if (activePlaybackAbortControllerRef.current) {
      try { activePlaybackAbortControllerRef.current.abort(); } catch {}
      activePlaybackAbortControllerRef.current = null;
    }
    const playbackAbort = new AbortController();
    activePlaybackAbortControllerRef.current = playbackAbort;

    try {
      let progressiveStreamsFound: StremioStream[] = [];
      const playbackCanonicalIdentity = canonicalIdentityService.buildIdentity(currentTargetItem, epParams);
      const handleProgressive = (progressive: StremioStream[]) => {
        if (currentRequestId !== playbackRequestIdRef.current || playbackAbort.signal.aborted) return;
        if (progressive && progressive.length > 0) {
          const verifiedPlayable = progressive.filter(s =>
            !s.isTorrent && !s.url?.includes('127.0.0.1:11470') && !s.url?.includes('localhost:11470') &&
            sourceConfidenceEngine.evaluate(s, playbackCanonicalIdentity).isMatch
          );
          if (verifiedPlayable.length > 0) {
            progressiveStreamsFound = verifiedPlayable;
            setResolvedStreams(verifiedPlayable);
            setIsLoadingStreams(false);
            mediaLoadingTracker.transition(traceId, 'BUFFERING', {
              streamCount: verifiedPlayable.length,
              progressive: true
            });
          }
        }
      };

      setVerificationState(isAutoRetry ? 'RETRYING' : 'SEARCHING');

      // Sistema Inteligente de Verificação Dupla de Fontes (com Primeira e Segunda busca automáticas)
      const verificationResult = await sourceVerificationService.verifySources(
        currentTargetItem,
        epParams,
        {
          signal: playbackAbort.signal,
          onStateChange: (state) => {
            if (currentRequestId === playbackRequestIdRef.current && !playbackAbort.signal.aborted) {
              setVerificationState(state);
            }
          },
          onProgressiveStreams: handleProgressive,
          forceRefresh: isAutoRetry,
          bypassNegativeCache: isAutoRetry
        }
      );

      if (currentRequestId !== playbackRequestIdRef.current || playbackAbort.signal.aborted) {
        return;
      }

      // Se a verificação retornou fontes ou se fontes progressivas já foram validadas, preserva as fontes canônicas
      const rawCandidates = (verificationResult.streams && verificationResult.streams.length > 0)
        ? verificationResult.streams
        : (progressiveStreamsFound.length > 0 ? progressiveStreamsFound : []);
      const streams = rawCandidates.filter(s =>
        sourceConfidenceEngine.evaluate(s, playbackCanonicalIdentity).isMatch
      );

      if (streams.length > 0) {
        setVerificationState('AVAILABLE');
        prefetchedSourcesRef.current = {
          targetKey: requestedKey,
          promise: Promise.resolve(streams),
          streams,
          status: 'resolved'
        };

        setResolvedStreams(streams);
        if (hasEpisodes && epParams) {
          episodeAvailabilityService.recordEpisodeSourceFound(
            currentTargetItem.id,
            epParams.season,
            epParams.episode,
            streams.length
          );
        }
        mediaLoadingTracker.recordEvent(traceId, 'SOURCE_VALIDATION', 'sourceVerificationService', 'OK',
          { streamCount: streams.length });
        mediaLoadingTracker.transition(traceId, 'BUFFERING', {
          streamCount: streams.length,
        });
      } else if (verificationResult.state === 'INCONCLUSIVE' && !isAutoRetry) {
        // Recuperação automática limitada para instabilidades transitórias / cold start de provedores no Fire TV
        console.log('[ContentDetailModal] Verificação inconclusiva transitória na 1ª tentativa. Realizando auto-recuperação automática imediata...');
        await new Promise(r => setTimeout(r, 350));
        if (currentRequestId === playbackRequestIdRef.current && !playbackAbort.signal.aborted) {
          return startPlayback(season, episode, navType, true);
        }
      } else {
        setVerificationState(verificationResult.state);
        setResolvedStreams([]);
        if (hasEpisodes && epParams) {
          episodeAvailabilityService.recordEpisodeSourceFailed(
            currentTargetItem.id,
            epParams.season,
            epParams.episode,
            verificationResult.state === 'INCONCLUSIVE'
          );
        }
        setStreamResolutionError(
          verificationResult.errorMessage ||
          (verificationResult.state === 'INCONCLUSIVE' ? MSG_INCONCLUSIVE : MSG_UNAVAILABLE)
        );
        const errorCode = verificationResult.state === 'INCONCLUSIVE'
          ? 'SOURCE_VALIDATION_INCONCLUSIVE' : 'NO_CANDIDATES';
        mediaLoadingTracker.recordEvent(traceId, 'PLAYBACK_FAILED', 'sourceVerificationService',
          verificationResult.state === 'INCONCLUSIVE' ? 'INCONCLUSIVE' : 'FAILED',
          undefined, errorCode, verificationResult.errorMessage);
      }
    } catch (err: any) {
      if (currentRequestId !== playbackRequestIdRef.current || playbackAbort.signal.aborted) return;
      if (hasEpisodes && epParams) {
        episodeAvailabilityService.recordEpisodeSourceFailed(
          currentTargetItem.id,
          epParams.season,
          epParams.episode,
          true
        );
      }
      console.error('Erro ao resolver provedores:', err);
      setVerificationState('INCONCLUSIVE');
      setStreamResolutionError(err?.message || MSG_INCONCLUSIVE);
      mediaLoadingTracker.recordEvent(traceId, 'PLAYBACK_FAILED', 'sourceVerificationService',
        'FAILED', undefined, 'SOURCE_DISCOVERY_FAILED', err?.message);
    } finally {
      if (currentRequestId === playbackRequestIdRef.current) {
        setIsLoadingStreams(false);
      }
    }
  };
  
  // Auto-play episode if directed by URL deep link or Watch Party
  useEffect(() => {
    if (autoPlayInitialEpisode && !autoPlayTriggeredRef.current) {
      autoPlayTriggeredRef.current = true;
      startPlayback(initialSeason || (hasEpisodes ? 1 : undefined), initialEpisode || (hasEpisodes ? 1 : undefined), 'manual_start');
    }
  }, [autoPlayInitialEpisode, initialSeason, initialEpisode, hasEpisodes]);

  // Sincronização de troca de episódio na Watch Party
  useEffect(() => {
    const unsub = watchPartyService.onChangeEpisode((change: any) => {
      const targetSeason = change?.season ?? change?.media?.season;
      const targetEpisode = change?.episode ?? change?.media?.episode;
      if (typeof targetSeason === 'number' && typeof targetEpisode === 'number') {
        if (
          currentEpisodeParams?.season === targetSeason &&
          currentEpisodeParams?.episode === targetEpisode &&
          isPlaying
        ) {
          return;
        }
        if (targetSeason !== currentSeason) {
          setCurrentSeason(targetSeason);
        }
        startPlayback(targetSeason, targetEpisode, 'remote_sync');
      }
    });
    return () => unsub();
  }, [currentSeason, currentEpisodeParams, isPlaying]);


  const handleEpisodeClick = (season: number, episode: number) => {
    if (watchPartyService.isConnected && (watchPartyService.isHost() || watchPartyService.canLocalControl('canChangeEpisode'))) {
      watchPartyService.changeEpisode(season, episode);
    }
    startPlayback(season, episode, 'manual_start');
  };

  const nextEpisodeInfo = useMemo(() => {
    if (!hasEpisodes) return null;
    const curSeason = Number(currentEpisodeParams?.season ?? currentSeason ?? 1);
    const curEpisode = Number(currentEpisodeParams?.episode ?? 1);

    // Fallback: se episodes ainda estiver vazio (ex: carregando TMDB), utiliza item.episodes se existir
    const rawCurrentEps = (episodes && episodes.length > 0)
      ? episodes
      : (item.episodes && item.episodes.length > 0
          ? item.episodes.filter((e: any) => Number(e.season ?? 1) === curSeason)
          : []);

    // Próxima temporada em item.episodes se disponível
    let nextSeasonEps: any[] | undefined = undefined;
    if (item.episodes && item.episodes.length > 0) {
      const sortedSeasons = [...availableSeasons].map(Number).sort((a, b) => a - b);
      const nextSeason = sortedSeasons.find(s => s > curSeason);
      if (nextSeason !== undefined) {
        nextSeasonEps = item.episodes.filter((e: any) => Number(e.season ?? 1) === nextSeason);
      }
    }

    return episodeAvailabilityService.getNextAvailableEpisode(
      curSeason,
      curEpisode,
      rawCurrentEps as any[],
      availableSeasons,
      nextSeasonEps
    );
  }, [hasEpisodes, currentEpisodeParams, currentSeason, episodes, availableSeasons, item.episodes]);

  const hasNextEpisode = Boolean(nextEpisodeInfo);

  const handleNextEpisode = () => {
    if (!hasEpisodes || isLoadingStreams || !nextEpisodeInfo) return;
    if (nextEpisodeInfo.season !== currentSeason) {
      setCurrentSeason(nextEpisodeInfo.season);
    }
    if (watchPartyService.isConnected && (watchPartyService.isHost() || watchPartyService.canLocalControl('canChangeEpisode'))) {
      watchPartyService.changeEpisode(nextEpisodeInfo.season, nextEpisodeInfo.episode);
    }
    const isTv = tvModeService.isTvMode() || location.pathname.startsWith('/tv');
    const nextRoute = getWatchRoute(item, nextEpisodeInfo.season, nextEpisodeInfo.episode, isTv);
    navigate(nextRoute, { replace: true });
    startPlayback(nextEpisodeInfo.season, nextEpisodeInfo.episode, 'continuous_playback');
  };

  const initialSimilar = similarTitles.slice(0, 6);
  const extraSimilar = similarTitles.slice(6);

  const renderSimilarCard = (similar: ContentItem) => {
    const simProgress = storageService.getSyncItemProgress(similar.id);
    return (
      <div 
        key={similar.id} 
        onClick={() => {
          playbackRequestIdRef.current++;
          cancelAllPendingRequests();
          setIsPlaying(false);
          setResolvedStreams([]);
          setCurrentEpisodeParams(null);
          if (playbackSessionId) {
            playbackSessionService.endSession(playbackSessionId);
          } else {
            playbackSessionService.endSession();
          }
          setPlaybackSessionId('');
          setSessionIntroPlayed(false);
          setIsSimilarExpanded(false);
          if (onSelectContent) {
            onSelectContent(similar);
          } else {
            setItem(similar);
          }
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

  const isPlayerSurfaceActive = isPlaying || playerOnly;

  return (
    <div className={isPlayerSurfaceActive ? "zapi-watch-surface fixed inset-0 z-[2000] overflow-hidden bg-black select-none" : `fixed inset-0 z-[400] overflow-y-auto overflow-x-hidden no-scrollbar bg-black/80 backdrop-blur-md ${
      isClosing ? 'animate-out fade-out duration-300' : 'animate-in fade-in duration-300'
    }`}>
      {isPlaying && (
        <div key="modal-player-stage">
          <Suspense fallback={<div className="fixed inset-0 z-[500] bg-black flex items-center justify-center"><ZapiLoader size="lg" /></div>}>
            <ZapiPlayer 
              key={hasEpisodes ? `${item.id}_s${currentEpisodeParams?.season || 1}_e${currentEpisodeParams?.episode || 1}` : item.id}
              item={stablePlayerItem} 
              streams={resolvedStreams} 
              isLoadingStreams={isLoadingStreams}
              streamResolutionError={streamResolutionError}
              verificationState={verificationState}
              onRetrySources={() => {
                providerRegistry.invalidateCache(item);
                prefetchedSourcesRef.current = null;
                if (hasEpisodes && currentEpisodeParams) {
                  episodeAvailabilityService.invalidateEpisode(item.id, currentEpisodeParams.season, currentEpisodeParams.episode);
                }
                startPlayback(currentEpisodeParams?.season, currentEpisodeParams?.episode, 'retry_playback', true);
              }}
              initialSeason={currentEpisodeParams?.season || (hasEpisodes ? 1 : undefined)}
              initialEpisode={currentEpisodeParams?.episode || (hasEpisodes ? 1 : undefined)}
              nextEpisodeInfo={nextEpisodeInfo}
              playbackSessionId={playbackSessionId}
              loadingTraceId={loadingTraceId}
              navigationType={navigationType}
              initialPlayIntro={!sessionIntroPlayed}
              onIntroCompleted={() => {
                if (loadingTraceId) mediaLoadingTracker.recordEvent(loadingTraceId,
                  'INTRO_COMPLETED', 'ZapiPlayer');
                setSessionIntroPlayed(true);
                if (playbackSessionId) {
                  playbackSessionService.markIntroPlayed(playbackSessionId);
                } else {
                  playbackSessionService.markIntroPlayed();
                }
              }}
              onClose={handleClosePlayer}
              onNextEpisode={hasNextEpisode ? handleNextEpisode : undefined}
              onSelectEpisode={hasEpisodes ? (season, episode) => handleEpisodeClick(season, episode) : undefined}
            />
          </Suspense>
        </div>
      )}
      
      {playerOnly && !isPlaying && (
        <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center p-6 text-center text-white">
          {isScheduledUnavailable ? (
            <div className="max-w-md p-6 rounded-2xl bg-[#0f1115] border border-amber-500/30 flex flex-col items-center gap-4 shadow-2xl">
              <Clock className="w-12 h-12 text-amber-400 shrink-0" />
              <h2 className="text-xl font-bold text-white">{item.title}</h2>
              <p className="text-sm text-amber-200">
                {catalogEligibilityService.getLockedReleaseNotice(item) || 'Este título está temporariamente indisponível no catálogo. Aguardando disponibilidade oficial em HD.'}
              </p>
              <button
                onClick={handleClose}
                className="mt-2 px-6 py-2.5 rounded-xl bg-[#007df7] hover:bg-[#0069d9] text-white font-semibold text-sm transition-all shadow-lg shadow-[#007df7]/25"
              >
                Voltar ao catálogo
              </button>
            </div>
          ) : (
            <ZapiLoader size="lg" />
          )}
        </div>
      )}
      {!isPlaying && !playerOnly && (
        <div key="modal-detail-stage" className="min-h-full w-full flex items-start justify-center py-3 sm:py-8 md:py-12 px-2 sm:px-4 md:px-6">
          <div ref={modalRef} className={`relative w-full max-w-[850px] bg-[#0f1115] rounded-2xl sm:rounded-3xl md:rounded-[32px] shadow-2xl overflow-hidden border border-white/10 ${
              isClosing ? 'animate-out zoom-out-95 slide-out-to-bottom-[5%] duration-300' : 'animate-in zoom-in-95 slide-in-from-bottom-[5%] duration-300'
            }`}>
            <button onClick={handleClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 w-9 h-9 sm:w-10 sm:h-10 bg-black/50 backdrop-blur-md border border-white/10 text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all cursor-pointer" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>

            <div className="relative aspect-[16/10] sm:aspect-[16/9] md:aspect-video w-full min-h-[220px] max-h-[50vh] sm:max-h-none">
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

              <div className="absolute bottom-0 left-0 w-full px-4 sm:px-8 md:px-12 pb-4 sm:pb-8 md:pb-12 z-20 flex flex-col justify-end h-full">
                {/* Badges de Disponibilidade e Idioma Real */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                  {typeof item.displayRank === 'number' && (
                    <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-lg flex items-center gap-1.5 border border-amber-300/60">
                      <span>#{item.displayRank} Em Destaque</span>
                      {item.imdbRank && (
                        <span className="text-[9px] sm:text-[10px] font-bold text-black/75 font-mono">
                          (IMDb #{item.imdbRank})
                        </span>
                      )}
                    </span>
                  )}
                  {item.audioStatus === 'pt-br-original' && (
                    <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                      🇧🇷 Áudio Original PT-BR Informado
                    </span>
                  )}
                  {item.audioStatus === 'other' && (
                    <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                      🌐 Áudio Original (Legendas conforme a fonte)
                    </span>
                  )}
                  {item.audioStatus === 'universal' && (
                    <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                      🎵 Trilha Sonora Universal / Sem Diálogos
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black text-white mb-3 md:mb-6 drop-shadow-xl max-w-2xl leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
                  {item.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
                  {isScheduledUnavailable ? (
                    <div className="flex items-center gap-2.5 px-4 sm:px-6 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-semibold select-none shadow-lg">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                      <span>{catalogEligibilityService.getLockedReleaseNotice(item) || 'Indisponível temporariamente no catálogo. Retorno programado para 20/11/2026 às 00:00 (Horário de Brasília).'}</span>
                    </div>
                  ) : (
                    <DetailModalTvButton 
                      focusKey="modal-play"
                      className="h-11 sm:h-12 px-4 sm:px-6 md:px-8 bg-[#007df7] text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm md:text-base hover:bg-[#0069d9] transition-all hover:scale-105 active:scale-95 shadow-xl shadow-[#007df7]/20 flex items-center justify-center gap-2 select-none border border-transparent box-border"
                      onClick={() => {
                        mobileFullscreenService.requestAutoFullscreenAndLandscape().catch(() => {});
                        startPlayback(undefined, undefined, 'manual_start');
                      }}
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
                      <span>
                        {playbackContinuity.hasStarted && !playbackContinuity.isCompleted ? 'Continuar' : 'Assistir'}
                      </span>
                    </DetailModalTvButton>
                  )}

                  {/* Botão Grupo (Watch Party P2P Gratuita) */}
                  {!isScheduledUnavailable && (
                    <DetailModalTvButton
                      focusKey="modal-group"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowWatchPartyModal(true);
                      }}
                      className="w-11 h-11 sm:w-auto sm:h-12 p-0 sm:px-5 bg-gradient-to-r from-cyan-600/20 to-[#007df7]/20 border border-cyan-500/30 hover:border-cyan-400 text-white hover:text-cyan-200 rounded-full sm:rounded-2xl font-bold text-xs sm:text-sm md:text-base backdrop-blur-sm transition-all hover:scale-105 active:scale-95 cursor-pointer group shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-0 sm:gap-2 select-none box-border shrink-0 aspect-square sm:aspect-auto"
                      title="Assistir em grupo com amigos em tempo real (Watch Party P2P Gratuita)"
                      ariaLabel="Grupo"
                    >
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="hidden sm:inline">Grupo</span>
                    </DetailModalTvButton>
                  )}

                  <DetailModalTvButton 
                    focusKey="modal-fav"
                    onClick={(e) => onToggleFavorite(e, item.id)} 
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center backdrop-blur-sm transition-all group shrink-0 select-none box-border active:scale-95 ${isFavorite ? 'bg-[#007df7] border-[#007df7] text-white shadow-lg' : 'bg-white/5 border-white/10 text-white hover:bg-white/20 hover:border-white/30'}`} 
                    title="Favoritos"
                    ariaLabel="Favoritos"
                  >
                    <Heart className={`w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform ${isFavorite ? 'fill-current' : ''}`} />
                  </DetailModalTvButton>
                  <DetailModalTvButton 
                    focusKey="modal-list"
                    onClick={(e) => onToggleList(e, item.id)} 
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center backdrop-blur-sm transition-all group shrink-0 select-none box-border active:scale-95 ${isInList ? 'bg-white text-[#007df7] border-white shadow-lg' : 'bg-white/5 border-white/10 text-white hover:bg-white/20 hover:border-white/30'}`} 
                    title="Minha Lista"
                    ariaLabel="Minha Lista"
                  >
                    <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform ${isInList ? 'fill-current' : ''}`} />
                  </DetailModalTvButton>
                  <DetailModalTvButton 
                    focusKey="modal-feedback"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowFeedbackModal(true);
                    }}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 flex items-center justify-center backdrop-blur-sm transition-all group cursor-pointer shrink-0 select-none box-border active:scale-95" 
                    title="Reportar problema neste título"
                    ariaLabel="Reportar problema"
                  >
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                  </DetailModalTvButton>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-8 md:px-12 py-5 sm:py-8 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 md:gap-10">
              <div>
                <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-white mb-4 sm:mb-6 font-medium">
                  <span className="text-green-400 font-black text-sm">{item.year}</span>
                  <span className="bg-white/10 border border-white/10 px-1.5 py-0.5 text-xs text-white rounded font-bold uppercase tracking-wider">HD</span>
                  <span className="bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded">{item.rating > 8 ? '16' : '12'}</span>
                  <span className="text-gray-300 text-xs sm:text-sm">{item.type}</span>
                  {resolvedStreams.some(stream => audioPreferenceService.analyzeAudio(stream).tier === 'dubbed_ptbr') && (
                    <span className="px-2 py-0.5 rounded text-xs font-black bg-green-500/20 text-green-400 border border-green-500/30">
                      Dublado PT-BR
                    </span>
                  )}
                </div>
                <div className="relative mb-4 sm:mb-6">
                  <p 
                    ref={synopsisTextRef}
                    className={`text-gray-300 text-xs sm:text-sm md:text-base leading-relaxed font-medium transition-all duration-200 ${
                      isSynopsisExpanded ? 'line-clamp-none' : 'line-clamp-3 md:line-clamp-4'
                    }`}
                  >
                    {synopsisText}
                  </p>
                  <p
                    ref={synopsisMeasureRef}
                    aria-hidden="true"
                    className="absolute top-0 left-0 w-full pointer-events-none opacity-0 select-none -z-50 text-gray-300 text-xs sm:text-sm md:text-base leading-relaxed font-medium line-clamp-3 md:line-clamp-4"
                  >
                    {synopsisText}
                  </p>
                  {canExpandSynopsis && (
                    <button
                      type="button"
                      onClick={toggleSynopsis}
                      aria-expanded={isSynopsisExpanded}
                      className="mt-2 text-xs sm:text-sm font-semibold text-[#007df7] hover:text-[#389aff] focus:text-[#389aff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007df7]/60 rounded transition-colors duration-150 inline-flex items-center cursor-pointer select-none"
                    >
                      {isSynopsisExpanded ? 'Ver menos' : 'Ver mais'}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs md:text-sm space-y-3 sm:space-y-4">
                {item.director && (<div><span className="text-gray-500 font-bold">Direção: </span><span className="text-gray-300">{item.director}</span></div>)}
                {item.cast && item.cast.length > 0 && (<div><span className="text-gray-500 font-bold">Elenco: </span><span className="text-gray-300">{item.cast.join(', ')}</span></div>)}
                {item.genres && (<div><span className="text-gray-500 font-bold">Gêneros: </span><span className="text-gray-300">{item.genres.join(', ')}</span></div>)}
              </div>
            </div>

            {hasEpisodes && (
              <div className="px-4 sm:px-8 md:px-12 py-5 sm:py-8 border-t border-white/5 bg-transparent">
                <div className="flex flex-row justify-between items-center mb-6 sm:mb-8 gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white">Episódios</h3>
                  </div>
                  <SeasonSelectTv 
                    currentSeason={currentSeason} 
                    availableSeasons={availableSeasons} 
                    onChange={setCurrentSeason} 
                  />
                </div>

                <div className="space-y-px bg-white/5 rounded-xl overflow-hidden border border-white/5">
                  {isLoadingEpisodes ? (
                    <div className="p-6 sm:p-8 flex flex-col items-center justify-center gap-3 text-gray-400 font-bold text-sm">
                      <ZapiLoader size="sm" />
                      <span>Carregando episódios da Temporada {currentSeason}...</span>
                    </div>
                  ) : episodes.length === 0 ? (
                    <div className="p-6 sm:p-8 flex flex-col items-center justify-center gap-3 text-center text-gray-400 text-sm">
                      <span>Não foi possível carregar os episódios no momento.</span>
                      <button
                        type="button"
                        onClick={() => setRetryEpisodeTrigger(v => v + 1)}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-semibold transition-all cursor-pointer"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : (
                    episodes.map((ep) => (
                      <EpisodeTvRow
                        key={ep.id}
                        ep={ep}
                        currentSeason={currentSeason}
                        epProgress={getEpisodeProgress(currentSeason, ep.number)}
                        onEpisodeClick={handleEpisodeClick}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {similarTitles.length > 0 && (
              <div className="px-4 sm:px-8 md:px-12 py-5 sm:py-8 border-t border-white/5 bg-black/20">
                <h3 className="text-lg sm:text-xl font-black text-white mb-4 sm:mb-6">Títulos semelhantes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  {initialSimilar.map(renderSimilarCard)}
                </div>
                {extraSimilar.length > 0 && (
                   <div className={`transition-all duration-700 ease-in-out overflow-hidden ${isSimilarExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
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
            )}
          </div>
        </div>
      )}

      {/* Modal Inteligente de Feedback */}
      {showFeedbackModal && (
        <Suspense fallback={null}>
          <ReportFeedbackModal
            isOpen={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
            defaultCategory="catalog_problem"
            playbackContext={{
              item,
              season: hasEpisodes && currentEpisodeParams?.season ? currentEpisodeParams.season : undefined,
              episode: hasEpisodes && currentEpisodeParams?.episode ? currentEpisodeParams.episode : undefined
            }}
          />
        </Suspense>
      )}

      {/* Modal Watch Party P2P Gratuita */}
      {showWatchPartyModal && (
        <FeatureErrorBoundary featureName="a Watch Party" onClose={() => setShowWatchPartyModal(false)}>
          <Suspense fallback={null}>
            <WatchPartyModal
              isOpen={showWatchPartyModal}
              onClose={() => setShowWatchPartyModal(false)}
              item={item}
              season={hasEpisodes ? (currentEpisodeParams?.season || currentSeason || 1) : undefined}
              episode={hasEpisodes ? (currentEpisodeParams?.episode || playbackContinuity.episode || 1) : undefined}
              onStartWatchPartyPlayback={(targetItem, targetSeason, targetEpisode) => {
                setShowWatchPartyModal(false);
                setSessionIntroPlayed(false);
                mobileFullscreenService.requestAutoFullscreenAndLandscape().catch(() => {});
                startPlayback(targetSeason, targetEpisode, 'manual_start');
              }}
            />
          </Suspense>
        </FeatureErrorBoundary>
      )}
    </div>
  );
};

export default ContentDetailModal;
