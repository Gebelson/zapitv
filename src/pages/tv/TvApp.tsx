import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ContentItem, ContentType, User, Profile } from '../../../types';
import { storageService } from '../../core/storage/storageService';
import { tmdbService } from '../../core/tmdb/tmdbClient';
import { tvModeService } from '../../core/tv/tvModeService';
import { tvNavigationManager } from '../../core/tv/tvNavigationManager';
import { deduplicateContentItems } from '../../core/catalog/catalogDeduplication';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { canonicalCatalogMaster } from '../../core/catalog/CanonicalCatalogMaster';
import { catalogReleaseStore } from '../../core/catalog/CatalogReleaseStore';
import { watchPartyService } from '../../core/watchparty/WatchPartyService';
import { useTvIdle } from '../../core/tv/useTvIdle';
import { getTvScreensaverItems } from '../../core/tv/tvScreensaverCatalog';
import { parseWatchRoute, getWatchRoute } from '../../core/routes/navigationRoutes';
import { TvHeader, TvTab } from '../../components/tv/TvHeader';
import { TvHomeView } from '../../components/tv/TvHomeView';
import { TvCategoryView } from '../../components/tv/TvCategoryView';
import { TvAnimeView } from '../../components/tv/TvAnimeView';
import { TvSearchView } from '../../components/tv/TvSearchView';
import { TvListView } from '../../components/tv/TvListView';
import { TvSettingsView } from '../../components/tv/TvSettingsView';
import { TvDetailsModal } from '../../components/tv/TvDetailsModal';
import { TvRemoteDiagnosticOverlay } from '../../components/tv/TvRemoteDiagnosticOverlay';
import { TvScreensaver } from '../../components/tv/TvScreensaver';
import { TvWatchError } from '../../components/tv/TvWatchError';
import { ZapiLoader } from '../../components/common/ZapiLoader';
import { getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { uiSoundService } from '../../core/audio/uiSoundService';

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
  const [currentTab, setCurrentTab] = useState<TvTab>(() => {
    const path = location.pathname;
    if (path.includes('/filmes')) return 'movies';
    if (path.includes('/series')) return 'series';
    if (path.includes('/animes')) return 'animes';
    if (path.includes('/em-destaque')) return 'featured';
    return 'home';
  });

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

  const handleOpenDetailModal = useCallback((item: ContentItem) => {
    tvNavigationManager.saveFocusSnapshot();
    setSelectedDetailSeason(undefined);
    setSelectedDetailEpisode(undefined);
    setSelectedDetailItem(item);
  }, []);

  // Pilha de navegação Voltar da TV (prioridade 10 - Root)
  useEffect(() => {
    return tvNavigationManager.registerBackHandler('tv-app-root', 10, () => {
      // Se estiver em uma tela especial (busca, minha lista, etc.), volta para a Home
      if (specialView !== null) {
        setSpecialView(null);
        setCurrentTab('home');
        setTimeout(() => setFocus('tv-nav-home'), 50);
        return true;
      }

      // Se estiver em uma aba que não seja a Home, volta para a Home
      if (currentTab !== 'home') {
        setCurrentTab('home');
        setTimeout(() => setFocus('tv-nav-home'), 50);
        return true;
      }

      // Se já estiver na Home e o foco não estiver no header, foca no header
      setFocus('tv-nav-home');
      return true;
    });
  }, [specialView, currentTab]);

  // Catálogo completo unificado e elegível para a busca e detalhes da Smart TV
  const fullTvCatalog = useMemo(() => {
    const combined = [
      ...(content || []),
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
  }, [content, popularMovies, popularSeries, animeItems, trendingItems, featuredItems, releasedItems]);

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
              <ZapiLoader size="xl" />
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
          {tvWatchNotFound ? <TvWatchError onBack={handleLeaveWatchError} /> : <ZapiLoader size="xl" />}
        </div>
      ) : (
        <>
          {/* Cabeçalho Fixo Minimalista Cinematográfico */}
          {specialView !== 'search' && (
            <TvHeader
              suspended={screensaverActive}
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setSpecialView(null);
                setCurrentTab(tab);
                setTimeout(() => {
                  setFocus('tv-hero-play');
                }, 100);
              }}
              onOpenSearch={() => setSpecialView('search')}
              onNavigateProfileMenu={(target) => {
                if (target === 'mylist') setSpecialView('mylist');
                else if (target === 'history') setSpecialView('history');
                else if (target === 'settings') setSpecialView('settings');
              }}
              userName={activeProfile?.name || currentUser?.name || 'ZapiTV'}
              avatarUrl={activeProfile?.avatar}
              accountPlan={currentUser?.status === 'Ativo' ? currentUser.plan?.trim() : undefined}
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
                  setTimeout(() => setFocus('tv-nav-search'), 50);
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
                trendingItems={trendingItems}
                popularMovies={popularMovies}
                popularSeries={popularSeries}
                animeItems={animeItems}
                allContent={content}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
              />
            ) : currentTab === 'movies' ? (
              <TvCategoryView
                categoryTitle="Filmes"
                items={popularMovies}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
              />
            ) : currentTab === 'series' ? (
              <TvCategoryView
                categoryTitle="Séries"
                items={popularSeries}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
              />
            ) : currentTab === 'animes' ? (
              <TvAnimeView
                items={animeItems}
                allContent={fullTvCatalog}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
                suspended={screensaverActive}
              />
            ) : (
              <TvCategoryView
                categoryTitle="Em Destaque"
                items={featuredItems}
                onSelectItem={handleOpenDetailModal}
                onPlayItem={(it) => handleStartPlay(it)}
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
        </>
      )}
    </div>
  );
};
