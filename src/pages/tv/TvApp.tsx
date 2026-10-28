import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ContentItem, ContentType, User, Profile } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { tmdbService } from '../../core/tmdb/tmdbClient';
import { tvModeService } from '../../core/tv/tvModeService';
import { tvScrollService } from '../../core/tv/tvScrollService';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { canonicalCatalogMaster } from '../../core/catalog/CanonicalCatalogMaster';
import { catalogReleaseStore } from '../../core/catalog/CatalogReleaseStore';
import { catalogDiscoveryService } from '../../core/catalog/CatalogDiscoveryService';
import { CatalogPaginationSession } from '../../core/catalog/catalogPaginationSession';
import { searchService } from '../../core/search/searchService';
import { watchPartyService } from '../../core/watchparty/WatchPartyService';
import { useTvIdle } from '../../core/tv/useTvIdle';
import { getTvScreensaverItems } from '../../core/tv/tvScreensaverCatalog';
import { parseWatchRoute, getWatchRoute } from '../../core/routes/navigationRoutes';
import { TvHeader, TvTab } from '../../components/tv/TvHeader';
import { TvHomeView } from '../../components/tv/TvHomeView';
import { TvCategoryView } from '../../components/tv/TvCategoryView';
import { TvAnimeView } from '../../components/tv/TvAnimeView';
import { TvLiveView } from '../../components/tv/live/TvLiveView';
import { TvSearchView } from '../../components/tv/TvSearchView';
import { TvListView } from '../../components/tv/TvListView';
import { TvSettingsView } from '../../components/tv/TvSettingsView';
import { TvDetailsModal } from '../../components/tv/TvDetailsModal';
import { TvRemoteDiagnosticOverlay } from '../../components/tv/TvRemoteDiagnosticOverlay';
import { TvScreensaver } from '../../components/tv/TvScreensaver';
import { TvWatchError } from '../../components/tv/TvWatchError';
import { ZapiLoader } from '../../components/common/ZapiLoader';
import { useTvViewport } from '../../core/tv/tvViewportService';
import { tvImagePreloaderService } from '../../core/tv/tvImagePreloaderService';
import { getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { TvQrLinkModal } from '../../components/tv/TvQrLinkModal';
import { TvProfileSelector } from '../../components/tv/TvProfileSelector';
import { profileClient } from '../../core/profile/profileClient';
import { authClient } from '../../core/auth/authClient';
import { resolveAvatarUrl } from '../../core/profile/avatarRegistry';

// Lazy load do orquestrador de reprodução para máxima performance inicial na TV
const ContentDetailModal = lazy(() => import('../../../components/ContentDetailModal'));

interface TvAppProps {
  content: ContentItem[];
  trendingItems: ContentItem[];
  popularMovies: ContentItem[];
  popularSeries: ContentItem[];
  animeItems: ContentItem[];
  featuredItems: ContentItem[];
  myList: string[];
  favorites: string[];
  onToggleList: (e: any, id: string) => void;
  onToggleFavorite: (e: any, id: string) => void;
  onToggleListById: (id: string) => void;
  onToggleFavoriteById: (id: string) => void;
  currentUser?: User;
  activeProfile?: Profile | null;
}

const tabFocusKeys: Record<TvTab, string> = {
  home: 'tv-nav-home',
  movies: 'tv-nav-movies',
  series: 'tv-nav-series',
  animes: 'tv-nav-animes',
  featured: 'tv-nav-featured'
};

export const TvApp: React.FC<TvAppProps> = ({
  content,
  trendingItems,
  popularMovies,
  popularSeries,
  animeItems,
  featuredItems,
  myList,
  favorites,
  onToggleList,
  onToggleFavorite,
  onToggleListById,
  onToggleFavoriteById,
  currentUser,
  activeProfile
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const viewport = useTvViewport();

  // Estados de Vinculação QR Code e Perfis da Smart TV (P3.C)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isProfileSelectorOpen, setIsProfileSelectorOpen] = useState(false);
  const [tvProfiles, setTvProfiles] = useState<Profile[]>([]);
  const [activeTvProfile, setActiveTvProfile] = useState<Profile | null>(() => activeProfile || null);
  const [isTvAuthenticated, setIsTvAuthenticated] = useState<boolean>(() => Boolean(currentUser));

  useEffect(() => {
    if (activeProfile) {
      setActiveTvProfile(activeProfile);
      if (currentUser?.id) {
        storageService.setScope({ userId: currentUser.id, profileId: activeProfile.id }).catch(() => {});
      }
    }
  }, [activeProfile, currentUser]);

  useEffect(() => {
    if (currentUser) setIsTvAuthenticated(true);
  }, [currentUser]);

  const loadProfilesAndOpenSelector = useCallback(async () => {
    try {
      const items = await profileClient.list();
      if (items.length > 0) {
        const mapped: Profile[] = items.map(p => ({
          id: p.id,
          name: p.name,
          avatar: resolveAvatarUrl(p.avatarId),
          avatarId: p.avatarId,
          isDefault: p.isDefault ? 1 : 0,
          isChild: false,
          displayOrder: p.displayOrder,
        }));
        setTvProfiles(mapped);
        setIsProfileSelectorOpen(true);
      }
    } catch {}
  }, []);

  const handleTvLinked = useCallback(async (_userData: any) => {
    setIsQrModalOpen(false);
    setIsTvAuthenticated(true);
    await loadProfilesAndOpenSelector();
  }, [loadProfilesAndOpenSelector]);

  const handleSelectTvProfile = useCallback(async (p: Profile) => {
    try {
      await profileClient.select(p.id);
    } catch {}
    setActiveTvProfile(p);
    setIsProfileSelectorOpen(false);
    if (currentUser?.id) {
      await storageService.setScope({ userId: currentUser.id, profileId: p.id });
    } else {
      try {
        const sess = await authClient.checkSession();
        if (sess.user?.id) {
          await storageService.setScope({ userId: sess.user.id, profileId: p.id });
        }
      } catch {}
    }
    setTimeout(() => {
      try { setFocus('tv-hero-play'); } catch {}
    }, 50);
  }, [currentUser]);

  const handleTvLogout = useCallback(async () => {
    try {
      await authClient.logout();
    } catch {}
    setIsTvAuthenticated(false);
    setActiveTvProfile(null);
    setTvProfiles([]);
    await storageService.setScope(null);
    uiSoundService.play('click');
  }, []);

  const [additionalCatalog, setAdditionalCatalog] = useState<ContentItem[]>([]);
  const catalogMounted = useRef(true);
  useEffect(() => {
    catalogMounted.current = true;
    return () => { catalogMounted.current = false; };
  }, []);
  const pagination = useMemo(() => ({
    movies: new CatalogPaginationSession(page => catalogDiscoveryService.discoverMovies(page), Math.max(0, Math.floor((popularMovies?.length || 0) / 20))),
    series: new CatalogPaginationSession(page => catalogDiscoveryService.discoverSeries(page), Math.max(0, Math.floor((popularSeries?.length || 0) / 20))),
    animes: new CatalogPaginationSession(page => catalogDiscoveryService.discoverAnimes(page), Math.max(0, Math.floor((animeItems?.length || 0) / 20)))
  }), []);

  // Sincroniza o cursor de paginação da TV caso os catálogos iniciais já estejam carregados
  useEffect(() => {
    if (popularMovies && popularMovies.length >= 20 && pagination.movies.getPage() === 0) {
      pagination.movies.setPage(Math.floor(popularMovies.length / 20));
    }
    if (popularSeries && popularSeries.length >= 20 && pagination.series.getPage() === 0) {
      pagination.series.setPage(Math.floor(popularSeries.length / 20));
    }
    if (animeItems && animeItems.length >= 20 && pagination.animes.getPage() === 0) {
      pagination.animes.setPage(Math.floor(animeItems.length / 20));
    }
  }, [popularMovies, popularSeries, animeItems, pagination]);

  // Inicializa navegação espacial e define o foco inicial no botão Assistir do Hero
  useEffect(() => {
    tvNavigationManager.init();
    tvNavigationManager.resume();
    tvModeService.setTvMode(true);
    uiSoundService.setTvMode(true);
    document.body.classList.add('tv-mode');

    const timer = setTimeout(() => {
      try {
        if (!parseWatchRoute(window.location.pathname).isWatch) setFocus('tv-hero-play');
      } catch {}
    }, 150);

    return () => {
      clearTimeout(timer);
      tvNavigationManager.pause();
      tvModeService.setTvMode(false);
      uiSoundService.setTvMode(false);
      document.body.classList.remove('tv-mode');
    };
  }, []);

  // Aba ativa na navegação superior
  const [catalogEligibilityTick, setCatalogEligibilityTick] = useState(0);
  useEffect(() => {
    return catalogEligibilityService.subscribe(() => {
      setCatalogEligibilityTick(t => t + 1);
    });
  }, []);

  const [currentTab, setCurrentTab] = useState<TvTab>(() => {
    const path = location.pathname;
    if (path.includes('/filmes')) return 'movies';
    if (path.includes('/series')) return 'series';
    if (path.includes('/animes')) return 'animes';
    if (path.includes('/em-destaque') || path.includes('/ao-vivo') || path.includes('/destaques')) return 'featured';
    return 'home';
  });
  const loadMoreCategory = useCallback(() => {
    if (currentTab !== 'movies' && currentTab !== 'series' && currentTab !== 'animes') return;
    void pagination[currentTab].loadNext().then(result => {
      if (catalogMounted.current && result?.items.length) {
        setAdditionalCatalog(previous => deduplicateContentItems([...previous, ...result.items]));
      }
    }).catch(() => console.warn('[TV catalog] Página preservada para nova tentativa após falha temporária.'));
  }, [currentTab, pagination]);

  // Visões especiais além das abas
  const [specialView, setSpecialView] = useState<'search' | 'mylist' | 'history' | 'settings' | null>(() => {
    const path = location.pathname;
    if (path.includes('/busca')) return 'search';
    if (path.includes('/minha-lista')) return 'mylist';
    if (path.includes('/historico')) return 'history';
    return null;
  });

  // Item selecionado para detalhes ou reprodução
  const [selectedDetailItem, setSelectedDetailItem] = useState<ContentItem | null>(null);
  const [selectedDetailSeason, setSelectedDetailSeason] = useState<number | undefined>();
  const [selectedDetailEpisode, setSelectedDetailEpisode] = useState<number | undefined>();
  const [playingItem, setPlayingItem] = useState<{
    item: ContentItem;
    season?: number;
    episode?: number;
  } | null>(null);
  const [tvWatchNotFound, setTvWatchNotFound] = useState(false);
  const [partyActive, setPartyActive] = useState(() => watchPartyService.getRoomState().isActive);
  const [releasedItems, setReleasedItems] = useState(() => catalogReleaseStore.getReleases());

  useEffect(() => catalogReleaseStore.subscribe(setReleasedItems), []);

  useEffect(() => watchPartyService.subscribe(event => {
    if (event === 'state_changed') setPartyActive(watchPartyService.getRoomState().isActive);
  }), []);

  // Suspende 100% do pré-carregamento de catálogo durante a reprodução para priorizar buffer e decodificação do player
  useEffect(() => {
    const isPlaying = Boolean(playingItem);
    tvImagePreloaderService.setPlaybackActive(isPlaying);
    return () => {
      tvImagePreloaderService.setPlaybackActive(false);
    };
  }, [playingItem]);

  // Controle de ocultação automática do Header na aba Ao Vivo (featured)
  const [isLiveHeaderHidden, setIsLiveHeaderHidden] = useState(false);
  const liveHeaderTimerRef = useRef<any>(null);

  const resetLiveHeaderTimeout = useCallback(() => {
    if (liveHeaderTimerRef.current) {
      clearTimeout(liveHeaderTimerRef.current);
    }
    liveHeaderTimerRef.current = setTimeout(() => {
      if (currentTab === 'featured' && !specialView && !selectedDetailItem && !playingItem) {
        setIsLiveHeaderHidden(true);
      }
    }, 4000);
  }, [currentTab, specialView, selectedDetailItem, playingItem]);

  useEffect(() => {
    if (currentTab === 'featured') {
      setIsLiveHeaderHidden(false);
      resetLiveHeaderTimeout();
    } else {
      setIsLiveHeaderHidden(false);
      if (liveHeaderTimerRef.current) clearTimeout(liveHeaderTimerRef.current);
    }
    return () => {
      if (liveHeaderTimerRef.current) clearTimeout(liveHeaderTimerRef.current);
    };
  }, [currentTab, resetLiveHeaderTimeout]);

  const handleRevealLiveHeader = useCallback(() => {
    setIsLiveHeaderHidden(false);
    resetLiveHeaderTimeout();
    setTimeout(() => {
      try {
        setFocus('tv-nav-featured');
      } catch {}
    }, 60);
  }, [resetLiveHeaderTimeout]);

  // Retorno imediato ao topo absoluto (0, 0) ao selecionar qualquer aba do header
  const resetScrollToTop = useCallback(() => {
    tvScrollService.reset();

    try {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as any
      });
    } catch {
      window.scrollTo(0, 0);
    }

    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    requestAnimationFrame(() => {
      try {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: 'instant' as any
        });
      } catch {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    });
  }, []);

  // Centralização da navegação do header e garantia de retorno ao topo absoluto
  const handleSelectTab = useCallback((tab: TvTab) => {
    setSpecialView(null);
    setCurrentTab(tab);
    resetScrollToTop();

    // Garante que o foco permaneça estritamente no link selecionado do header
    const targetFocus = tabFocusKeys[tab] || 'tv-nav-home';
    if (getCurrentFocusKey() !== targetFocus) {
      try {
        setFocus(targetFocus);
      } catch {}
    }
  }, [resetScrollToTop]);

  const handleOpenDetailModal = useCallback((item: ContentItem) => {
    tvNavigationManager.saveFocusSnapshot();
    setSelectedDetailSeason(undefined);
    setSelectedDetailEpisode(undefined);
    setSelectedDetailItem(item);
  }, []);

  // Pilha de navegação Voltar da TV (prioridade 10 - Root)
  useEffect(() => {
    return tvNavigationManager.registerBackHandler('tv-app-root', 10, () => {
      // 1. Se estiver em uma tela especial (busca, minha lista, etc.), fecha a visão e restaura o foco no link da aba ativa
      if (specialView !== null) {
        setSpecialView(null);
        const targetFocus = tabFocusKeys[currentTab] || 'tv-nav-home';
        setTimeout(() => {
          try {
            setFocus(targetFocus);
          } catch {}
        }, 50);
        return true;
      }

      // 2. Se estiver na aba Ao Vivo (featured), revela o header imediatamente e foca no canal / aba Ao Vivo
      if (currentTab === 'featured') {
        handleRevealLiveHeader();
        return true;
      }

      // 3. Nas páginas principais de catálogo (Início, Filmes, Séries, Animes),
      // o botão Voltar devolve o foco diretamente ao link da página atual no header,
      // sem alterar a página (não troca automaticamente para Início).
      const targetFocus = tabFocusKeys[currentTab] || 'tv-nav-home';
      try {
        setFocus(targetFocus);
      } catch {
        setTimeout(() => {
          try {
            setFocus(targetFocus);
          } catch {}
        }, 50);
      }
      return true;
    });
  }, [specialView, currentTab, handleRevealLiveHeader]);

  // Catálogo completo unificado e elegível para a busca e detalhes da Smart TV
  const fullTvCatalog = useMemo(() => {
    const combined = [
      ...(content || []),
      ...additionalCatalog,
      ...(popularMovies || []),
      ...(popularSeries || []),
      ...(animeItems || []),
      ...(trendingItems || []),
      ...(featuredItems || []),
      ...releasedItems,
      ...storageService.getCachedCatalog('top_rated'),
      ...canonicalCatalogMaster.getPublicCatalog('movies'),
      ...canonicalCatalogMaster.getPublicCatalog('series'),
      ...canonicalCatalogMaster.getPublicCatalog('animes'),
    ];
    return catalogEligibilityService.filterEligibleItemsSync(deduplicateContentItems(combined));
  }, [content, popularMovies, popularSeries, animeItems, trendingItems, featuredItems, releasedItems, catalogEligibilityTick, additionalCatalog]);

  // Listas por categoria unificadas aproveitando fullTvCatalog + resultados obtidos da rede
  const unifiedMovies = useMemo(() => {
    const catalogMovies = fullTvCatalog.filter(i => searchService.isMovieItem(i));
    const combined = [...(popularMovies || []), ...catalogMovies];
    return deduplicateContentItems(combined);
  }, [popularMovies, fullTvCatalog]);

  const unifiedSeries = useMemo(() => {
    const catalogSeries = fullTvCatalog.filter(i => searchService.isSeriesItem(i));
    const combined = [...(popularSeries || []), ...catalogSeries];
    return deduplicateContentItems(combined);
  }, [popularSeries, fullTvCatalog]);

  const unifiedAnimes = useMemo(() => {
    const catalogAnimes = fullTvCatalog.filter(i => searchService.isAnimeItem(i));
    const combined = [...(animeItems || []), ...catalogAnimes];
    return deduplicateContentItems(combined);
  }, [animeItems, fullTvCatalog]);

  const unifiedTrending = useMemo(() => {
    if (trendingItems && trendingItems.length > 0) return trendingItems;
    const fallback = deduplicateContentItems([
      ...(featuredItems || []),
      ...unifiedMovies.slice(0, 10),
      ...unifiedSeries.slice(0, 10)
    ]);
    return fallback.slice(0, 20);
  }, [trendingItems, featuredItems, unifiedMovies, unifiedSeries]);

  // Itens da Minha Lista reais
  const myListItems = useMemo(() => {
    if (!content || !myList) return [];
    const listSet = new Set(myList);
    return content.filter(it => listSet.has(it.id));
  }, [content, myList]);

  // Itens do Histórico reais
  const historyItems = useMemo(() => {
    if (specialView !== 'history' || !content) return [];
    return content.filter(it => {
      const cont = storageService.getPlaybackContinuity(it);
      return cont.hasStarted;
    });
  }, [content, specialView]);

  // Recuperação e sincronização de rotas de reprodução na Smart TV (/tv/assistir/...)
  useEffect(() => {
    const parsed = parseWatchRoute(location.pathname);
    if (!parsed.isWatch || !parsed.isTv) {
      return;
    }
    if (!parsed.id) {
      setTvWatchNotFound(true);
      return;
    }

    if (playingItem && (playingItem.item.id === parsed.id || playingItem.item.imdbId === parsed.id || playingItem.item.tmdbId === parsed.id) &&
        getWatchRoute(playingItem.item, 1, 1, true).split('/')[3] ===
          (parsed.mediaType === 'movie' ? 'filme' : parsed.mediaType === 'anime' ? 'anime' : 'serie')) {
      return;
    }

    let active = true;
    setTvWatchNotFound(false);

    const resolveItemForTvWatch = async () => {
      let found = fullTvCatalog.find(i =>
        i.id === parsed.id ||
        i.imdbId === parsed.id ||
        i.tmdbId === parsed.id
      );

      if (!found) {
        try {
          const isAnime = parsed.mediaType === 'anime';
          const isSeries = parsed.mediaType === 'series' || isAnime;
          const mediaType = isAnime ? ContentType.ANIME : (isSeries ? ContentType.SERIES : ContentType.MOVIE);

          if (parsed.id!.startsWith('tt')) {
            found = (await tmdbService.findByImdb(parsed.id!)) || undefined;
          } else if (/^\d+$/.test(parsed.id!)) {
            const res = await tmdbService.getDetails(parsed.id!, mediaType);
            found = res?.item || undefined;
          }
        } catch (err) {
          console.warn('[TvApp] Erro ao carregar conteúdo da rota de reprodução:', err);
        }
      }

      const matchesType = found && getWatchRoute(found, 1, 1, true).split('/')[3] ===
        (parsed.mediaType === 'movie' ? 'filme' : parsed.mediaType === 'anime' ? 'anime' : 'serie');
      if (active && found && matchesType && catalogEligibilityService.isItemPubliclyPlayableSync(found)) {
        const continuity = storageService.getPlaybackContinuity(found);
        const resolvedSeason = parsed.season ?? continuity.season ?? 1;
        const resolvedEpisode = parsed.episode ?? continuity.episode ?? 1;

        setSelectedDetailItem(found);
        setSelectedDetailSeason(resolvedSeason);
        setSelectedDetailEpisode(resolvedEpisode);
        setPlayingItem({
          item: found,
          season: resolvedSeason,
          episode: resolvedEpisode
        });
      } else if (active) {
        setTvWatchNotFound(true);
      }
    };

    resolveItemForTvWatch();

    return () => {
      active = false;
    };
  }, [location.pathname, fullTvCatalog, playingItem]);

  // Execução de reprodução com rota persistente
  const handleStartPlay = useCallback((item: ContentItem, season?: number, episode?: number) => {
    if (!catalogEligibilityService.isItemPubliclyPlayableSync(item)) {
      setTvWatchNotFound(true);
      return;
    }
    if (!selectedDetailItem) tvNavigationManager.saveFocusSnapshot();
    const continuity = storageService.getPlaybackContinuity(item);
    const resolvedSeason = season ?? continuity.season ?? 1;
    const resolvedEpisode = episode ?? continuity.episode ?? 1;
    const watchRoute = getWatchRoute(item, resolvedSeason, resolvedEpisode, true);
    navigate(watchRoute);

    setSelectedDetailItem(item);
    setSelectedDetailSeason(resolvedSeason);
    setSelectedDetailEpisode(resolvedEpisode);
    setPlayingItem({ item, season: resolvedSeason, episode: resolvedEpisode });
  }, [selectedDetailItem, navigate]);

  const handleClosePlayer = useCallback(() => {
    const itemToPreserve = playingItem?.item || selectedDetailItem;
    if (itemToPreserve) {
      setSelectedDetailItem(itemToPreserve);
      setSelectedDetailSeason(playingItem?.season || storageService.getPlaybackContinuity(itemToPreserve).season);
      setSelectedDetailEpisode(playingItem?.episode || storageService.getPlaybackContinuity(itemToPreserve).episode);
    }
    setPlayingItem(null);
    navigate('/tv', { replace: true });
  }, [playingItem, selectedDetailItem, navigate]);

  const handleLeaveWatchError = useCallback(() => {
    setTvWatchNotFound(false);
    setPlayingItem(null);
    setSelectedDetailItem(null);
    setSelectedDetailSeason(undefined);
    setSelectedDetailEpisode(undefined);
    setSpecialView(null);
    setCurrentTab('home');
    navigate('/tv', { replace: true });
    requestAnimationFrame(() => setFocus('tv-hero-play'));
  }, [navigate]);

  // A URL é a fonte de verdade: um Back que sai da rota de reprodução
  // também desmonta o player, mesmo se houver outro listener de TV ativo.
  useEffect(() => {
    if (!parseWatchRoute(location.pathname).isWatch && playingItem) {
      setSelectedDetailItem(playingItem.item);
      setSelectedDetailSeason(playingItem.season || storageService.getPlaybackContinuity(playingItem.item).season);
      setSelectedDetailEpisode(playingItem.episode || storageService.getPlaybackContinuity(playingItem.item).episode);
      setPlayingItem(null);
    }
  }, [location.pathname, playingItem]);

  const currentWatchRoute = parseWatchRoute(location.pathname);
  const isTvWatchRoute = currentWatchRoute.isWatch && currentWatchRoute.isTv;
  const screensaverActive = useTvIdle(!playingItem && !isTvWatchRoute && !partyActive);
  const preSaverFocusRef = React.useRef<string | null>(null);
  const wasSaverActiveRef = React.useRef(false);

  useEffect(() => {
    uiSoundService.setSilenced(screensaverActive);
    if (screensaverActive) {
      preSaverFocusRef.current = getCurrentFocusKey() || null;
      wasSaverActiveRef.current = true;
      tvNavigationManager.pause();
    } else if (wasSaverActiveRef.current) {
      wasSaverActiveRef.current = false;
      tvNavigationManager.resume();
      if (preSaverFocusRef.current) setFocus(preSaverFocusRef.current);
    }
  }, [screensaverActive]);

  const screensaverItems = useMemo(() => {
    if (!screensaverActive) return [];
    return getTvScreensaverItems(
      [featuredItems, trendingItems, popularMovies, popularSeries, animeItems, fullTvCatalog],
      activeProfile?.isChild === true
    );
  }, [screensaverActive, featuredItems, trendingItems, popularMovies, popularSeries, animeItems, fullTvCatalog, activeProfile?.isChild]);
  const playingMatchesRoute = !isTvWatchRoute ||
    (playingItem && (playingItem.item.id === currentWatchRoute.id || playingItem.item.imdbId === currentWatchRoute.id || playingItem.item.tmdbId === currentWatchRoute.id) &&
      getWatchRoute(playingItem.item, 1, 1, true).split('/')[3] ===
        (currentWatchRoute.mediaType === 'movie' ? 'filme' : currentWatchRoute.mediaType === 'anime' ? 'anime' : 'serie'));

  return (
    <div className="zapi-tv-root relative min-h-screen bg-[#05070a] text-white overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* Diagnóstico em tempo real na TV (?tvdiag=1) */}
      <TvRemoteDiagnosticOverlay />

      {playingItem && playingMatchesRoute ? (
        /* Player de Reprodução em Tela Cheia 100% isolado (Sem elementos da interface anterior no DOM) */
        <div className="fixed inset-0 z-[5000] bg-black overflow-hidden select-none">
          <Suspense fallback={
            <div className="fixed inset-0 z-[5000] bg-black flex items-center justify-center">
              <ZapiLoader size={viewport.loaderSize || 76} />
            </div>
          }>
            <ContentDetailModal
              item={playingItem.item}
              onClose={handleClosePlayer}
              isDarkMode={true}
              myList={myList}
              favorites={favorites}
              onToggleList={onToggleList}
              onToggleFavorite={onToggleFavorite}
              allContent={fullTvCatalog}
              initialSeason={playingItem.season}
              initialEpisode={playingItem.episode}
              autoPlayInitialEpisode={true}
              playerOnly={true}
            />
          </Suspense>
        </div>
      ) : isTvWatchRoute ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
          {tvWatchNotFound ? <TvWatchError onBack={handleLeaveWatchError} /> : <ZapiLoader size={viewport.loaderSize || 76} />}
        </div>
      ) : (
        <>
          {/* Cabeçalho Fixo Minimalista Cinematográfico */}
          {specialView !== 'search' && (
            <TvHeader
              suspended={screensaverActive}
              hidden={currentTab === 'featured' && isLiveHeaderHidden}
              currentTab={currentTab}
              onSelectTab={handleSelectTab}
              onOpenSearch={() => {
                setSpecialView('search');
                resetScrollToTop();
              }}
              onNavigateProfileMenu={(target) => {
                if (target === 'mylist') {
                  setSpecialView('mylist');
                  resetScrollToTop();
                } else if (target === 'history') {
                  setSpecialView('history');
                  resetScrollToTop();
                } else if (target === 'settings') {
                  setSpecialView('settings');
                  resetScrollToTop();
                }
              }}
              userName={activeTvProfile?.name || currentUser?.name || 'ZapiTV'}
              avatarUrl={activeTvProfile?.avatar}
              accountPlan={currentUser?.status === 'Ativo' ? currentUser.plan?.trim() : undefined}
              isAuthenticated={isTvAuthenticated}
              onOpenQrLink={() => setIsQrModalOpen(true)}
              onSwitchProfile={loadProfilesAndOpenSelector}
              onLogout={handleTvLogout}
            />
          )}

          {/* Visão Ativa */}
          <main className={`relative z-10 w-full min-h-screen ${specialView && specialView !== 'search' ? 'pt-24' : 'pt-0'}`}>
            {specialView === 'search' ? (
              <TvSearchView
                allContent={fullTvCatalog}
                onSelectItem={handleOpenDetailModal}
                onClose={() => {
                  setSpecialView(null);
                  const targetFocus = tabFocusKeys[currentTab] || 'tv-nav-home';
                  setTimeout(() => {
                    try {
                      setFocus(targetFocus);
                    } catch {}
                  }, 50);
                }}
              />
            ) : specialView === 'mylist' ? (
              <TvListView
                title="Minha Lista"
                type="mylist"
                items={myListItems}
                onSelectItem={handleOpenDetailModal}
                onBack={() => setSpecialView(null)}
              />
            ) : specialView === 'history' ? (
              <TvListView
                title="Histórico de Reprodução"
                type="history"
                items={historyItems}
                onSelectItem={handleOpenDetailModal}
                onBack={() => setSpecialView(null)}
              />
            ) : specialView === 'settings' ? (
              <TvSettingsView onBack={() => setSpecialView(null)} />
            ) : currentTab === 'home' ? (
              <TvHomeView
                suspended={screensaverActive}
                featuredItems={featuredItems}
                trendingItems={unifiedTrending}
                popularMovies={unifiedMovies}
                popularSeries={unifiedSeries}
                animeItems={unifiedAnimes}
                allContent={fullTvCatalog}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
              />
            ) : currentTab === 'movies' ? (
              <TvCategoryView
                categoryTitle="Filmes"
                onLoadMore={loadMoreCategory}
                upFocusKey="tv-nav-movies"
                items={unifiedMovies}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
                suspended={screensaverActive}
              />
            ) : currentTab === 'series' ? (
              <TvCategoryView
                categoryTitle="Séries"
                onLoadMore={loadMoreCategory}
                upFocusKey="tv-nav-series"
                items={unifiedSeries}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
                suspended={screensaverActive}
              />
            ) : currentTab === 'animes' ? (
              <TvAnimeView
                onLoadMore={loadMoreCategory}
                items={unifiedAnimes}
                upFocusKey="tv-nav-animes"
                allContent={fullTvCatalog}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
                suspended={screensaverActive}
              />
            ) : (
              <TvLiveView
                onTriggerHeader={handleRevealLiveHeader}
                isHeaderVisible={!isLiveHeaderHidden}
              />
            )}
          </main>

          {/* Modal de Detalhes Cinematográfico */}
          {selectedDetailItem && (
            <TvDetailsModal
              item={selectedDetailItem}
              initialSeason={selectedDetailSeason}
              initialEpisode={selectedDetailEpisode}
              allContent={fullTvCatalog}
              myList={myList}
              favorites={favorites}
              onToggleList={onToggleListById}
              onToggleFavorite={onToggleFavoriteById}
              onClose={() => {
                setSelectedDetailItem(null);
                tvNavigationManager.restoreFocusSnapshot('tv-hero-play');
              }}
              onPlay={(it, s, e) => {
                handleStartPlay(it, s, e);
              }}
            />
          )}
          {screensaverActive && <TvScreensaver items={screensaverItems} />}

          {/* Modal de Vinculação QR Code da Smart TV */}
          <TvQrLinkModal
            isOpen={isQrModalOpen}
            onClose={() => setIsQrModalOpen(false)}
            onLinked={handleTvLinked}
          />

          {/* Seletor de Perfis Smart TV */}
          {isProfileSelectorOpen && tvProfiles.length > 0 && (
            <TvProfileSelector
              profiles={tvProfiles}
              activeProfileId={activeTvProfile?.id}
              onSelectProfile={handleSelectTvProfile}
              onClose={() => setIsProfileSelectorOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
};
