
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams, matchPath } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Hero from './components/Hero';
import ContentRow from './components/ContentRow';
import ContentCard from './components/ContentCard';
import { FeaturedRankedCarousel } from './components/FeaturedRankedCarousel';
import { VirtualizedCatalogGrid } from './src/components/catalog/VirtualizedCatalogGrid';
import AnimatedBackground from './components/AnimatedBackground';
import ScrollToTop from './components/ScrollToTop';
import GenreDropdown from './components/GenreDropdown';
import SortDropdown, { CatalogSortOption } from './components/SortDropdown';
import { getContentRoute, getWatchRoute, parseWatchRoute, ROUTES } from './src/core/routes/navigationRoutes';
import { matchesRoomMedia, roomMediaFormat, roomMediaType } from './src/core/watchparty/roomMediaIdentity';
import { AppView, User, ContentType, ContentItem, SiteNotification, Profile, CustomSection, ActorPerson } from './types';
import { MOCK_USERS, AVATARS, filmesData } from './constants';
import { ShieldCheck, Flame, Film, Tv, List, Search, Sparkles, Plus, RefreshCw, Activity, User as UserIcon } from 'lucide-react';

import { db } from './db';
import { tmdbService } from './src/core/tmdb/tmdbClient';
import { storageService, WatchProgress } from './src/core/storage/storageService';
import { VERIFIED_OPEN_ITEMS } from './src/core/catalog/verifiedCatalog';
import { ZapiLoader } from './src/components/common/ZapiLoader';
import { FeatureErrorBoundary } from './src/components/common/FeatureErrorBoundary';
import { catalogDiscoveryService } from './src/core/catalog/CatalogDiscoveryService';
import { mediaAvailabilityIndex } from './src/core/catalog/MediaAvailabilityIndex';
import { theatricalFilterService } from './src/core/catalog/theatricalFilterService';
import { catalogEligibilityService } from './src/core/catalog/CatalogEligibilityService';
import { searchService } from './src/core/search/searchService';
import { searchHistoryService } from './src/core/search/searchHistoryService';
import { featuredRankingService } from './src/core/rankings/FeaturedRankingService';
import { FeaturedSelectionResult } from './src/core/rankings/featuredRankingTypes';
import { deduplicateContentItems } from './src/core/catalog/catalogDeduplication';
import { adultContentService } from './src/core/adult/AdultContentService';
import { AgeVerificationModal } from './components/AgeVerificationModal';
import { recommendationEngine } from './src/core/recommendations/recommendationEngine';
import { userPreferenceStore } from './src/core/recommendations/userPreferenceStore';
import { uiSoundService } from './src/core/audio/uiSoundService';
import { hybridRecommendationEngine } from './src/core/recommendations/hybridRecommendationEngine';
import { bannedContentRegistry } from './src/core/catalog/BannedContentRegistry';
import { catalogSnapshotManager } from './src/core/catalog/CatalogSnapshotManager';
import { heroCarouselStore } from './src/core/catalog/heroCarouselStore';
import { fetchHeroCarousel, fetchSectionTitles, saveHeroCarousel, saveSectionTitles } from './src/core/admin/globalSettingsClient';
import { WatchPartyService } from './src/core/watchparty/WatchPartyService';
import { tvModeService } from './src/core/tv/tvModeService';
import { tvNavigationManager } from './src/core/tv/tvNavigationManager';
import { TvRemoteDiagnosticOverlay } from './src/components/tv/TvRemoteDiagnosticOverlay';
import { useIsMobileViewport } from './src/core/mobile/mobileViewportService';
import { MobileLayout } from './src/components/mobile';

const ProfileView = React.lazy(() => import('./components/ProfileView'));
const AdminView = React.lazy(() => import('./components/AdminView'));
const SettingsView = React.lazy(() => import('./components/SettingsView'));
const HelpView = React.lazy(() => import('./components/HelpView'));
const ContentDetailModal = React.lazy(() => import('./components/ContentDetailModal'));
const AuthView = React.lazy(() => import('./components/AuthView'));
const ProfileSelectorView = React.lazy(() => import('./components/ProfileSelectorView'));
const AddSectionModal = React.lazy(() => import('./components/AddSectionModal'));
const ProgramasView = React.lazy(() => import('./components/ProgramasView'));
const NotFoundPage = React.lazy(() => import('./src/pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })));
const ZapiPlayer = React.lazy(() => import('./src/components/player/ZapiPlayer').then(module => ({ default: module.ZapiPlayer })));
const CatalogDiagnosticModal = React.lazy(() => import('./src/components/catalog/CatalogDiagnosticModal').then(module => ({ default: module.CatalogDiagnosticModal })));
const ActorView = React.lazy(() => import('./src/pages/ActorView').then(module => ({ default: module.ActorView })));
const WatchPartyModal = React.lazy(() => import('./src/components/watchparty/WatchPartyModal').then(module => ({ default: module.WatchPartyModal })));
const TvApp = React.lazy(() => import('./src/pages/tv/TvApp').then(module => ({ default: module.TvApp })));

const GENRES_LIST = [
  'Ação', 'Adulto', 'Animação', 'Anime', 'Aventura', 'Biografia', 'Comédia', 
  'Documentários', 'Drama', 'Fantasia', 'Faroeste', 'Ficção Científica', 
  'Guerra', 'Histórico', 'Infantil / Família', 'Mistério', 'Musical', 
  'Policial', 'Premiados', 'Reality Show', 'Religioso', 'Romance', 
  'Suspense', 'Terror'
];

const ViewWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="animate-in fade-in duration-500 fill-mode-both transform-gpu">
    <React.Suspense fallback={<div className="min-h-[75vh] flex items-center justify-center"><ZapiLoader size="xl" /></div>}>
      {children}
    </React.Suspense>
  </div>
);

const withoutPlaintextPassword = (user: User): User => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const App: React.FC<{ initialState: any }> = ({ initialState }) => {
  const [users, setUsers] = useState<User[]>(() => {
    try {
      let parsedUsers = initialState.users;
      if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) parsedUsers = [];

      // Mantém perfis legados sem propagar senhas em texto puro.
      const mergedUsers = (parsedUsers as User[]).map(withoutPlaintextPassword);
      
      MOCK_USERS.forEach(mockUser => {
        const index = mergedUsers.findIndex(u => u.id === mockUser.id);
        if (index !== -1) {
          mergedUsers[index] = { 
            ...mergedUsers[index], 
            email: mockUser.email,       // Garante que o email está correto
            // Mantém perfis se o usuário já os customizou, senão usa o mock
            profiles: (mergedUsers[index].profiles && mergedUsers[index].profiles.length > 0) ? mergedUsers[index].profiles : mockUser.profiles 
          };
        } else {
          mergedUsers.push(withoutPlaintextPassword(mockUser));
        }
      });
      
      return mergedUsers;
    } catch { return MOCK_USERS.map(withoutPlaintextPassword); }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => initialState.auth);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const user = initialState.currentUser;
    if (user) {
      const mockUser = MOCK_USERS.find(m => m.id === user.id);
      return withoutPlaintextPassword({
        ...user, 
        profiles: (user.profiles && user.profiles.length > 0) ? user.profiles : (mockUser?.profiles || [])
      });
    }
    return user as User;
  });
  const [activeProfile, setActiveProfile] = useState<Profile | null>(() => initialState.activeProfile || currentUser?.profiles?.[0] || null);

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Redirecionamento can�nico de entrada de compatibilidade ?tv=1 para a rota /tv
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tvParam = params.get('tv');
    const isDiag = params.get('tvdiag') === '1' || params.get('tv_diag') === '1';

    if ((tvParam === '1' || tvParam === 'true') && !location.pathname.startsWith('/tv')) {
      navigate(isDiag ? '/tv?tvdiag=1' : '/tv', { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  // Matchers para rotas de detalhes e episódios
  const matchMovieDetail = matchPath('/filmes/:id', location.pathname);
  const matchSeriesEpisode = matchPath('/series/:id/temporada/:season/episodio/:episode', location.pathname);
  const matchSeriesDetail = matchPath('/series/:id', location.pathname);
  const matchAnimeEpisode = matchPath('/animes/:id/temporada/:season/episodio/:episode', location.pathname);
  const matchAnimeDetail = matchPath('/animes/:id', location.pathname);
  const matchActorDetail = matchPath('/atores/:id', location.pathname);
  const matchWatchParty = matchPath('/sala/:roomId', location.pathname);

  const isMobileViewport = useIsMobileViewport(768);

  // Derivação automática da view com base no pathname
  // Matchers para rotas de reprodução persistente (/assistir/...)
  const parsedWatch = useMemo(() => parseWatchRoute(location.pathname), [location.pathname]);
  const isWatchRoute = parsedWatch.isWatch && !parsedWatch.isTv;

  const currentView: AppView = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/tv')) return 'tv';
    if (isWatchRoute) return 'home';
    if (path === '/' || path.startsWith('/sala')) return 'home';
    if (path.startsWith('/explorar')) return 'explore';
    if (path.startsWith('/buscar')) return 'search';
    if (path.startsWith('/minha-zapitv')) return 'my-zapitv';
    if (path.startsWith('/em-destaque')) return 'featured';
    if (path.startsWith('/filmes')) return 'movies';
    if (path.startsWith('/series')) return 'series';
    if (path.startsWith('/animes')) return 'animes';
    if (path.startsWith('/atores')) return 'actor';
    if (path === '/programas' || path.startsWith('/televisao')) return 'programas';
    if (path.startsWith('/minha-lista')) return 'mylist';
    if (path.startsWith('/historico')) return 'profile';
    if (path.startsWith('/perfil-selector')) return 'profile-selector';
    if (path.startsWith('/perfil')) return 'profile';
    if (path.startsWith('/configuracoes')) return 'settings';
    if (path.startsWith('/ajuda')) return 'help';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/login') || path.startsWith('/auth')) return 'login';
    return 'notfound';
  }, [location.pathname, isWatchRoute]);

  const [previousView, setPreviousView] = useState<AppView>('home');
  useEffect(() => uiSoundService.bindInteractions(document), []);

  useEffect(() => {
    // Garante que a versão desktop/mobile NUNCA possua a classe tv-mode no body
    if (!location.pathname.startsWith('/tv')) {
      document.body.classList.remove('tv-mode');
    }
  }, [location.pathname]);
  useEffect(() => {
    if (currentView !== 'admin' && currentView !== 'notfound') {
      setPreviousView(currentView);
    }
  }, [currentView]);

  const activeDetailId = (isWatchRoute ? parsedWatch.id : undefined) ||
                         matchSeriesEpisode?.params.id ||
                         matchSeriesDetail?.params.id ||
                         matchAnimeEpisode?.params.id ||
                         matchAnimeDetail?.params.id ||
                         matchMovieDetail?.params.id;

  const activeActorId = matchActorDetail?.params.id;

  const urlSeason = matchSeriesEpisode?.params.season || matchAnimeEpisode?.params.season;
  const urlEpisode = matchSeriesEpisode?.params.episode || matchAnimeEpisode?.params.episode;
  const initialSeasonNum = isWatchRoute ? parsedWatch.season : (urlSeason ? parseInt(urlSeason, 10) : undefined);
  const initialEpisodeNum = isWatchRoute ? parsedWatch.episode : (urlEpisode ? parseInt(urlEpisode, 10) : undefined);
  const hasDeepLinkEpisode = initialEpisodeNum !== undefined;

  // Estado para Watch Party direta via URL /sala/:roomId ou ?sala=...
  const [directPartyEpisode, setDirectPartyEpisode] = useState<{ season?: number; episode?: number } | null>(null);
  const rawWatchPartyParam = matchWatchParty?.params.roomId || searchParams.get('sala') || null;
  const watchPartyRoomId = rawWatchPartyParam ? WatchPartyService.sanitizeRoomId(rawWatchPartyParam) : null;
  const [showDirectWatchPartyModal, setShowDirectWatchPartyModal] = useState<boolean>(Boolean(watchPartyRoomId));

  useEffect(() => {
    if (watchPartyRoomId) {
      setShowDirectWatchPartyModal(true);
    }
  }, [watchPartyRoomId]);

  const effectiveSeasonNum = directPartyEpisode?.season !== undefined ? directPartyEpisode.season : initialSeasonNum;
  const effectiveEpisodeNum = directPartyEpisode?.episode !== undefined ? directPartyEpisode.episode : initialEpisodeNum;
  const effectiveAutoPlay = Boolean(isWatchRoute || directPartyEpisode || hasDeepLinkEpisode);

  const handleNavigateView = useCallback((view: AppView) => {
    setSelectedContent(null);
    if (closedContentIdRef.current) closedContentIdRef.current = null;
    if (detailOriginRouteRef.current) detailOriginRouteRef.current = null;
    searchService.cancelPending();
    setIsMobileMenuOpen(false);
    setSelectedGenre('');
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setLiveSearchResults([]);
    setLiveSearchActors([]);

    const routeTo = (path: string) => navigate(tvModeService.formatInternalRoute(path));

    switch (view) {
      case 'home': routeTo('/'); break;
      case 'explore': routeTo('/explorar'); break;
      case 'search': routeTo('/buscar'); break;
      case 'my-zapitv': routeTo('/minha-zapitv'); break;
      case 'featured': routeTo('/em-destaque'); break;
      case 'movies': routeTo('/filmes'); break;
      case 'series': routeTo('/series'); break;
      case 'animes': routeTo('/animes'); break;
      case 'programas':
      case 'television':
      case 'live': routeTo('/programas'); break;
      case 'mylist': routeTo('/minha-lista'); break;
      case 'history': routeTo('/perfil'); break;
      case 'profile': routeTo('/perfil'); break;
      case 'settings': routeTo('/configuracoes'); break;
      case 'help': routeTo('/ajuda'); break;
      case 'admin': routeTo('/admin'); break;
      case 'login':
      case 'signup': routeTo('/login'); break;
      case 'profile-selector': routeTo('/perfil-selector'); break;
      default: routeTo('/'); break;
    }
  }, [navigate]);

  const setCurrentView = handleNavigateView;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => initialState.theme);

  // Estado para títulos das seções padrão
  const [sectionTitles, setSectionTitles] = useState(() => initialState.sectionTitles);
  const [sectionTitleSaveError, setSectionTitleSaveError] = useState('');

  // Estado para Seções Customizadas Dinâmicas
  const [customSections, setCustomSections] = useState<CustomSection[]>(() => initialState.customSections);

  const [editingSection, setEditingSection] = useState<{ key: keyof typeof sectionTitles, title: string } | null>(null);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);

  const currentViewRef = useRef<AppView>(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const [content, setContent] = useState<ContentItem[]>(() => {
    storageService.purgeBannedItemsFromStorage();
    bannedContentRegistry.purgeStorage();
    const initial = Array.isArray(initialState.content) ? initialState.content : [];
    const base = Array.isArray(filmesData) ? filmesData : [];
    const combined = [...VERIFIED_OPEN_ITEMS, ...base, ...initial].filter(it => it && !bannedContentRegistry.isBanned(it));
    return deduplicateContentItems(combined);
  });
  const contentRef = useRef(content);
  contentRef.current = content;
  const [siteNotifications, setSiteNotifications] = useState<SiteNotification[]>(() => initialState.notifications);
  const [myList, setMyList] = useState<string[]>(() => (initialState.myList || []).filter((id: string) => !bannedContentRegistry.isBannedKeyOrId(id)));
  const [favorites, setFavorites] = useState<string[]>(() => (initialState.favorites || []).filter((id: string) => !bannedContentRegistry.isBannedKeyOrId(id)));

  // Catálogos Dinâmicos em PT-BR (TMDB + Local) com Hidratação Instantânea via Cache
  const [trendingItems, setTrendingItems] = useState<ContentItem[]>(() => deduplicateContentItems(storageService.getCachedCatalog('trending')));
  const [popularMovies, setPopularMovies] = useState<ContentItem[]>(() => deduplicateContentItems(storageService.getCachedCatalog('movies').filter(i => searchService.isMovieItem(i))));
  const [popularSeries, setPopularSeries] = useState<ContentItem[]>(() => deduplicateContentItems(storageService.getCachedCatalog('series').filter(i => searchService.isSeriesItem(i))));
  const [topRatedItems, setTopRatedItems] = useState<ContentItem[]>(() => deduplicateContentItems(storageService.getCachedCatalog('top_rated')));
  const [animeItems, setAnimeItems] = useState<ContentItem[]>(() => deduplicateContentItems(storageService.getCachedCatalog('animes').filter(i => searchService.isAnimeItem(i))));
  const [featuredSelection, setFeaturedSelection] = useState<FeaturedSelectionResult>(() => featuredRankingService.getFeaturedSelectionSync());
  const [heroCarouselItems, setHeroCarouselItems] = useState<ContentItem[]>(() => 
    heroCarouselStore.getCarouselItems(initialState.content || [])
  );
  const queryClient = useQueryClient();
  const heroCarouselQuery = useQuery({
    queryKey: ['global-settings', 'hero-carousel'],
    queryFn: ({ signal }) => fetchHeroCarousel(signal),
    refetchInterval: 60_000,
    retry: false,
  });
  const sectionTitlesQuery = useQuery({
    queryKey: ['global-settings', 'section-titles'],
    queryFn: ({ signal }) => fetchSectionTitles(signal),
    refetchInterval: 60_000,
    retry: false,
  });

  useEffect(() => {
    const remoteTitles = sectionTitlesQuery.data?.titles;
    if (remoteTitles) {
      setSectionTitles(current => {
        let hasChanges = false;
        for (const [k, v] of Object.entries(remoteTitles)) {
          if (current[k] !== v) {
            hasChanges = true;
            break;
          }
        }
        return hasChanges ? { ...current, ...remoteTitles } : current;
      });
    }
  }, [sectionTitlesQuery.data?.titles]);

  useEffect(() => {
    const remoteItems = heroCarouselQuery.data?.items;
    if (Array.isArray(remoteItems) && remoteItems.length > 0) {
      setHeroCarouselItems(current => {
        if (current.length === remoteItems.length) {
          const isIdentical = current.every((item, idx) => {
            const r = remoteItems[idx];
            return item.id === r.id && item.title === r.title;
          });
          if (isIdentical) return current;
        }
        return remoteItems;
      });
    }
  }, [heroCarouselQuery.data?.items]);

  useEffect(() => {
    return heroCarouselStore.subscribe(items => setHeroCarouselItems(items));
  }, []);

  useEffect(() => {
    if (content.length > 0 && heroCarouselItems.length === 0) {
      setHeroCarouselItems(heroCarouselStore.getCarouselItems(content));
    }
  }, [content]);
  const [continueWatchingList, setContinueWatchingList] = useState<WatchProgress[]>([]);
  const [liveSearchResults, setLiveSearchResults] = useState<ContentItem[]>([]);
  const [liveSearchActors, setLiveSearchActors] = useState<ActorPerson[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  useEffect(() => {
    return featuredRankingService.subscribe((res) => {
      setFeaturedSelection(res);
    });
  }, []);

  const [catalogEligibilityVersion, setCatalogEligibilityVersion] = useState(0);
  useEffect(() => {
    return catalogEligibilityService.subscribe(() => {
      setCatalogEligibilityVersion(v => v + 1);
      catalogSnapshotManager.clearCachedSnapshot();
      setCatalogSnapshots({});
      recommendationEngine.invalidateCache();
      setFeaturedSelection(featuredRankingService.getFeaturedSelectionSync());
      setHeroCarouselItems(heroCarouselStore.getCarouselItems(contentRef.current));
    });
  }, []);

  useEffect(() => {
    if (activeProfile?.id) {
      userPreferenceStore.setProfileMetadata(activeProfile.id, { isChild: activeProfile.isChild === true });
    }
  }, [activeProfile?.id, activeProfile?.isChild]);

  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [moviesPage, setMoviesPage] = useState(2);
  const [seriesPage, setSeriesPage] = useState(2);
  const [animesPage, setAnimesPage] = useState(2);
  const moviesPageRef = useRef(2);
  const seriesPageRef = useRef(2);
  const animesPageRef = useRef(2);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const [hasMoreMovies, setHasMoreMovies] = useState(true);
  const [hasMoreSeries, setHasMoreSeries] = useState(true);
  const [hasMoreAnimes, setHasMoreAnimes] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('');
  
  // Preferência de ordenação isolada e persistente para cada categoria (Filmes, Séries, Animes)
  const [categorySorts, setCategorySorts] = useState<Record<'movies' | 'series' | 'animes', CatalogSortOption>>(() => {
    try {
      const saved = localStorage.getItem('zapitv_category_sorts');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          movies: parsed.movies || 'recommended',
          series: parsed.series || 'recommended',
          animes: parsed.animes || 'recommended'
        };
      }
    } catch (e) {}
    return {
      movies: 'recommended',
      series: 'recommended',
      animes: 'recommended'
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('zapitv_category_sorts', JSON.stringify(categorySorts));
    } catch (e) {}
  }, [categorySorts]);

  const getCurrentCategorySort = useCallback((view: AppView): CatalogSortOption => {
    if (view === 'movies') return categorySorts.movies || 'recommended';
    if (view === 'series') return categorySorts.series || 'recommended';
    if (view === 'animes') return categorySorts.animes || 'recommended';
    return 'recommended';
  }, [categorySorts]);

  const currentCategorySort = useMemo(() => {
    return getCurrentCategorySort(currentView);
  }, [currentView, getCurrentCategorySort]);

  const [isAgeVerificationOpen, setIsAgeVerificationOpen] = useState(false);
  const [pendingAdultGenre, setPendingAdultGenre] = useState<string | null>(null);
  const [pendingAdultItem, setPendingAdultItem] = useState<ContentItem | null>(null);

  // Snapshot estável de navegação por categoria (isolamento total entre Filmes, Séries e Animes)
  const [catalogSnapshots, setCatalogSnapshots] = useState<Record<string, ContentItem[]>>({});
  const [visibleGridCount, setVisibleGridCount] = useState(42);

  useEffect(() => {
    setVisibleGridCount(42);
  }, [currentView, selectedGenre, currentCategorySort]);

  // Pré-aquece o chunk de ContentDetailModal após a montagem inicial para abertura instantânea (<16ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./components/ContentDetailModal').catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);
  const myListSet = useMemo(() => new Set(myList), [myList]);

  const availableGenres = useMemo(() => {
    return activeProfile?.isChild ? GENRES_LIST.filter(g => g !== 'Adulto') : GENRES_LIST;
  }, [activeProfile?.isChild]);

  const handleSelectGenre = useCallback((genre: string) => {
    if (genre === 'Adulto') {
      if (activeProfile?.isChild) {
        setIsAgeVerificationOpen(true);
        return;
      }
      if (!adultContentService.isAgeConfirmed(activeProfile?.id)) {
        setPendingAdultGenre(genre);
        setIsAgeVerificationOpen(true);
        return;
      }
    }
    setSelectedGenre(genre);
    setMoviesPage(1);
    moviesPageRef.current = 1;
    setSeriesPage(1);
    seriesPageRef.current = 1;
    setAnimesPage(1);
    animesPageRef.current = 1;
  }, [activeProfile]);

  // Função pura para extrair itens elegíveis da categoria respeitando o filtro de gênero
  const getEligibleBrowseItems = useCallback((view: 'movies' | 'series' | 'animes', genre: string): ContentItem[] => {
    let source: ContentItem[] = [];
    if (view === 'movies') {
      const catalogMovies = content.filter(i => searchService.isMovieItem(i, false));
      source = deduplicateContentItems([...popularMovies, ...catalogMovies]).filter(i => searchService.isMovieItem(i, false));
    } else if (view === 'series') {
      const catalogSeries = content.filter(i => searchService.isSeriesItem(i));
      source = deduplicateContentItems([...popularSeries, ...catalogSeries]).filter(i => searchService.isSeriesItem(i));
    } else if (view === 'animes') {
      const catalogAnimes = content.filter(i => searchService.isAnimeItem(i));
      source = deduplicateContentItems([...animeItems, ...catalogAnimes]).filter(i => searchService.isAnimeItem(i));
    }

    const isAdultGenre = genre === 'Adulto';
    let genreFiltered = source;
    if (genre && genre !== 'Todos') {
      if (isAdultGenre) {
        genreFiltered = source.filter(i => adultContentService.isAdultContent(i));
      } else {
        genreFiltered = source.filter(i => i.genres?.includes(genre) && !adultContentService.isAdultContent(i));
      }
    } else {
      genreFiltered = source.filter(i => !adultContentService.isAdultContent(i));
    }

    const unique = deduplicateContentItems(genreFiltered);
    return catalogEligibilityService.filterEligibleItemsSync(unique, { allowAdult: isAdultGenre });
  }, [content, popularMovies, popularSeries, animeItems, catalogEligibilityVersion]);

  // Função geradora de chave canônica por visualização e filtros
  const getSnapshotKeyForView = useCallback((view: 'movies' | 'series' | 'animes', genre = selectedGenre, sort?: CatalogSortOption) => {
    const effectiveSort = sort || categorySorts[view] || 'recommended';
    const normGenre = (!genre || genre === 'Todos') ? 'all' : genre;
    return `${view}:${normGenre}:${effectiveSort}:${activeProfile?.id || 'default'}:${activeProfile?.isChild ? 'child' : 'adult'}`;
  }, [selectedGenre, categorySorts, activeProfile?.id, activeProfile?.isChild]);

  // Chave canônica que define uma nova entrada de página ou mudança explícita de filtros
  const snapshotKey = useMemo(() => {
    const isBrowse = currentView === 'movies' || currentView === 'series' || currentView === 'animes';
    if (!isBrowse) return '';
    const view = currentView as 'movies' | 'series' | 'animes';
    return getSnapshotKeyForView(view, selectedGenre, categorySorts[view]);
  }, [currentView, selectedGenre, categorySorts, getSnapshotKeyForView]);

  // Manipulador central de alteração de ordenação: aplica ao catálogo COMPLETO com isolamento total
  const handleSelectSort = useCallback((newSort: CatalogSortOption) => {
    const isBrowse = currentView === 'movies' || currentView === 'series' || currentView === 'animes';
    if (!isBrowse) return;
    const view = currentView as 'movies' | 'series' | 'animes';

    // 1. Atualiza a preferência isolada da categoria atual
    setCategorySorts(prev => ({
      ...prev,
      [view]: newSort
    }));

    // 2. Reseta paginação da categoria
    if (view === 'movies') { setMoviesPage(1); moviesPageRef.current = 1; }
    else if (view === 'series') { setSeriesPage(1); seriesPageRef.current = 1; }
    else if (view === 'animes') { setAnimesPage(1); animesPageRef.current = 1; }

    // 3. Aplica a ordenação ao catálogo COMPLETO daquela categoria
    const targetKey = getSnapshotKeyForView(view, selectedGenre, newSort);
    const baseItems = getEligibleBrowseItems(view, selectedGenre);
    const sorted = catalogSnapshotManager.createInitialSnapshot(baseItems, newSort, {
      profileId: activeProfile?.id || 'default',
      isChild: activeProfile?.isChild === true,
      category: view,
      genreFilter: selectedGenre
    });
    const strictlyTyped = view === 'movies'
      ? sorted.filter(i => searchService.isMovieItem(i, false))
      : view === 'series'
      ? sorted.filter(i => searchService.isSeriesItem(i))
      : sorted.filter(i => searchService.isAnimeItem(i));

    setCatalogSnapshots(prev => ({
      ...prev,
      [targetKey]: strictlyTyped
    }));
  }, [currentView, selectedGenre, activeProfile?.id, activeProfile?.isChild, getSnapshotKeyForView, getEligibleBrowseItems]);

  // Inicializa o snapshot estável ao entrar na página, trocar o gênero ou trocar a ordenação
  useEffect(() => {
    if (!snapshotKey) return;
    const view = currentView as 'movies' | 'series' | 'animes';
    const cached = catalogSnapshots[snapshotKey];
    if (cached && cached.length > 0) return;

    const currentSort = categorySorts[view] || 'recommended';
    const baseItems = getEligibleBrowseItems(view, selectedGenre);
    const sorted = catalogSnapshotManager.createInitialSnapshot(baseItems, currentSort, {
      profileId: activeProfile?.id || 'default',
      isChild: activeProfile?.isChild === true,
      category: view,
      genreFilter: selectedGenre
    });
    const strictlyTyped = view === 'movies'
      ? sorted.filter(i => searchService.isMovieItem(i, false))
      : view === 'series'
      ? sorted.filter(i => searchService.isSeriesItem(i))
      : sorted.filter(i => searchService.isAnimeItem(i));

    setCatalogSnapshots(prev => ({
      ...prev,
      [snapshotKey]: strictlyTyped
    }));
  }, [snapshotKey, currentView, selectedGenre, categorySorts, activeProfile?.id, activeProfile?.isChild, getEligibleBrowseItems]);

  // Atualização manual sob demanda com botão "Atualizar" sem criar reorganizações involuntárias
  const handleManualRefreshCatalog = useCallback(() => {
    const isBrowse = currentView === 'movies' || currentView === 'series' || currentView === 'animes';
    if (!isBrowse) return;
    const view = currentView as 'movies' | 'series' | 'animes';
    const currentSort = categorySorts[view] || 'recommended';
    const targetKey = getSnapshotKeyForView(view, selectedGenre, currentSort);
    const baseItems = getEligibleBrowseItems(view, selectedGenre);
    const sorted = catalogSnapshotManager.createInitialSnapshot(baseItems, currentSort, {
      profileId: activeProfile?.id || 'default',
      isChild: activeProfile?.isChild === true,
      category: view,
      genreFilter: selectedGenre
    });
    const strictlyTyped = view === 'movies'
      ? sorted.filter(i => searchService.isMovieItem(i, false))
      : view === 'series'
      ? sorted.filter(i => searchService.isSeriesItem(i))
      : sorted.filter(i => searchService.isAnimeItem(i));

    setCatalogSnapshots(prev => ({
      ...prev,
      [targetKey]: strictlyTyped
    }));
  }, [currentView, selectedGenre, categorySorts, activeProfile, getEligibleBrowseItems, getSnapshotKeyForView]);

  const handleConfirmAge = useCallback(() => {
    if (activeProfile?.isChild) return;
    adultContentService.confirmAge(activeProfile?.id);
    setIsAgeVerificationOpen(false);

    if (pendingAdultGenre) {
      setSelectedGenre(pendingAdultGenre);
      setPendingAdultGenre(null);
    }
    if (pendingAdultItem) {
      setSelectedContent(pendingAdultItem);
      setPendingAdultItem(null);
    }
  }, [activeProfile, pendingAdultGenre, pendingAdultItem]);

  const handleCancelAge = useCallback(() => {
    setIsAgeVerificationOpen(false);
    setPendingAdultGenre(null);
    setPendingAdultItem(null);
    if (selectedGenre === 'Adulto') {
      setSelectedGenre('Todos');
    }
  }, [selectedGenre]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasDiscoveredLiveRef = useRef(false);
  const needsCatalogDiscovery = currentView === 'home' || currentView === 'featured' ||
    currentView === 'movies' || currentView === 'series' || currentView === 'animes';

  useEffect(() => {
    if (!needsCatalogDiscovery || hasDiscoveredLiveRef.current) return;
    let isMounted = true;
    let discoveryTimer: ReturnType<typeof setTimeout> | null = null;
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsCatalogLoading(false);
      }
    }, 3500);

    // 1. Hidratação local imediata de Continuar Assistindo e Favoritos
    Promise.allSettled([
      storageService.getContinueWatching(),
      storageService.getFavorites()
    ]).then(([progressRes, favsRes]) => {
      if (!isMounted) return;
      if (progressRes.status === 'fulfilled') {
        setContinueWatchingList(progressRes.value);
        const favs = favsRes.status === 'fulfilled' ? favsRes.value : [];
        const favItems = contentRef.current.filter(c => favs.includes(c.id));
        userPreferenceStore.seedFromExistingContinuity(activeProfile?.id || 'default', progressRes.value, favItems);
      }
      if (favsRes.status === 'fulfilled' && favsRes.value.length > 0) {
        setFavorites(favsRes.value);
      }
    });

    // 2. Descoberta online em segundo plano após o primeiro paint (não bloqueia a Home)
    const fetchLiveCatalogs = async () => {
      if (!isMounted) return;
      hasDiscoveredLiveRef.current = true;
      setIsCatalogLoading(true);
      try {
        const [
          trendingRes,
          moviesP1, moviesP2,
          seriesP1, seriesP2,
          animesP1, animesP2
        ] = await Promise.allSettled([
          catalogDiscoveryService.discoverTrending(),
          catalogDiscoveryService.discoverMovies(1),
          catalogDiscoveryService.discoverMovies(2),
          catalogDiscoveryService.discoverSeries(1),
          catalogDiscoveryService.discoverSeries(2),
          catalogDiscoveryService.discoverAnimes(1),
          catalogDiscoveryService.discoverAnimes(2)
        ]);

        if (!isMounted) return;

        const newItems: ContentItem[] = [];
        const seenIds = new Set<string>();

        const addItem = (item: ContentItem) => {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            newItems.push(item);
          }
        };

        if (trendingRes.status === 'fulfilled' && trendingRes.value.length > 0) {
          const validTrending = deduplicateContentItems(trendingRes.value);
          setTrendingItems(validTrending);
          storageService.saveCachedCatalog('trending', validTrending);
          validTrending.forEach(addItem);
        }

        // Combina filmes TMDB + Cinemeta (apenas filmes reais, não animes nem séries)
        const rawMovies: ContentItem[] = [];
        if (moviesP1.status === 'fulfilled') rawMovies.push(...moviesP1.value.items);
        if (moviesP2.status === 'fulfilled') rawMovies.push(...moviesP2.value.items);
        const combinedMovies = deduplicateContentItems(rawMovies.filter(i => searchService.isMovieItem(i)));
        if (combinedMovies.length > 0) {
          setPopularMovies(combinedMovies);
          storageService.saveCachedCatalog('movies', combinedMovies);
          combinedMovies.forEach(addItem);
        }

        // Combina séries TMDB + Cinemeta (apenas séries reais de TV, não filmes nem animes)
        const rawSeries: ContentItem[] = [];
        if (seriesP1.status === 'fulfilled') rawSeries.push(...seriesP1.value.items);
        if (seriesP2.status === 'fulfilled') rawSeries.push(...seriesP2.value.items);
        const combinedSeries = deduplicateContentItems(rawSeries.filter(i => searchService.isSeriesItem(i)));
        if (combinedSeries.length > 0) {
          setPopularSeries(combinedSeries);
          storageService.saveCachedCatalog('series', combinedSeries);
          combinedSeries.forEach(addItem);
        }

        // Combina animes (séries + filmes de anime como Shinkai/Ghibli/Mugen Train)
        const rawAnimes: ContentItem[] = [];
        if (animesP1.status === 'fulfilled') rawAnimes.push(...animesP1.value.items);
        if (animesP2.status === 'fulfilled') rawAnimes.push(...animesP2.value.items);
        const combinedAnimes = deduplicateContentItems(rawAnimes.filter(i => searchService.isAnimeItem(i)));
        if (combinedAnimes.length > 0) {
          setAnimeItems(combinedAnimes);
          storageService.saveCachedCatalog('animes', combinedAnimes);
          combinedAnimes.forEach(addItem);
        }

        // Sincroniza novos lançamentos validados do backend (AutoReleaseService)
        try {
          const relRes = await fetch('/api/catalog/new-releases', { signal: AbortSignal.timeout(2000) });
          if (relRes.ok) {
            const relItems: ContentItem[] = await relRes.json();
            if (Array.isArray(relItems) && relItems.length > 0) {
              const eligibleRels = catalogEligibilityService.filterEligibleItemsSync(relItems);
              if (eligibleRels.length > 0) {
                newItems.push(...eligibleRels);
              }
            }
          }
        } catch {}

        if (newItems.length > 0) {
          setContent(prev => deduplicateContentItems([...prev, ...newItems]));
        }
      } catch (err) {
        console.warn('Erro ao carregar catálogo online:', err);
      } finally {
        clearTimeout(safetyTimer);
        if (isMounted) {
          setIsCatalogLoading(false);
        }
      }
    };

    discoveryTimer = setTimeout(fetchLiveCatalogs, 400);

    return () => {
      isMounted = false;
      if (discoveryTimer) clearTimeout(discoveryTimer);
      clearTimeout(safetyTimer);
    };
  }, [needsCatalogDiscovery]);

  // Descoberta reativa ao navegar para Filmes, Séries ou Animes (garante dados online isolados da categoria)
  useEffect(() => {
    let isCancelled = false;
    const view = currentView;

    if (view === 'series' && popularSeries.length <= 25) {
      catalogDiscoveryService.discoverSeries(1).then(res => {
        if (!isCancelled && res.items.length > 0 && currentViewRef.current === 'series') {
          const onlySeries = res.items.filter(i => searchService.isSeriesItem(i));
          if (onlySeries.length > 0) {
            setPopularSeries(prev => {
              const updated = deduplicateContentItems([...prev, ...onlySeries]).filter(i => searchService.isSeriesItem(i));
              storageService.saveCachedCatalog('series', updated);
              return updated;
            });
            setContent(prev => deduplicateContentItems([...prev, ...onlySeries]));
            const targetKey = getSnapshotKeyForView('series');
            const currentSort = categorySorts.series || 'recommended';
            setCatalogSnapshots(prev => {
              const currentList = prev[targetKey] || [];
              const eligible = catalogEligibilityService.filterEligibleItemsSync(onlySeries);
              const updated = currentList.length === 0
                ? catalogSnapshotManager.createInitialSnapshot(eligible, currentSort, {
                    profileId: activeProfile?.id || 'default',
                    isChild: activeProfile?.isChild === true,
                    category: 'series',
                    genreFilter: selectedGenre
                  })
                : catalogSnapshotManager.appendPaginationBatch(currentList, eligible, currentSort, {
                    profileId: activeProfile?.id || 'default',
                    isChild: activeProfile?.isChild === true,
                    category: 'series',
                    genreFilter: selectedGenre
                  });
              return { ...prev, [targetKey]: updated.filter(i => searchService.isSeriesItem(i)) };
            });
          }
        }
      }).catch(() => {});
    } else if (view === 'animes' && animeItems.length <= 10) {
      catalogDiscoveryService.discoverAnimes(1).then(res => {
        if (!isCancelled && res.items.length > 0 && currentViewRef.current === 'animes') {
          const onlyAnimes = res.items.filter(i => searchService.isAnimeItem(i));
          if (onlyAnimes.length > 0) {
            setAnimeItems(prev => {
              const updated = deduplicateContentItems([...prev, ...onlyAnimes]).filter(i => searchService.isAnimeItem(i));
              storageService.saveCachedCatalog('animes', updated);
              return updated;
            });
            setContent(prev => deduplicateContentItems([...prev, ...onlyAnimes]));
            const targetKey = getSnapshotKeyForView('animes');
            const currentSort = categorySorts.animes || 'recommended';
            setCatalogSnapshots(prev => {
              const currentList = prev[targetKey] || [];
              const eligible = catalogEligibilityService.filterEligibleItemsSync(onlyAnimes);
              const updated = currentList.length === 0
                ? catalogSnapshotManager.createInitialSnapshot(eligible, currentSort, {
                    profileId: activeProfile?.id || 'default',
                    isChild: activeProfile?.isChild === true,
                    category: 'animes',
                    genreFilter: selectedGenre
                  })
                : catalogSnapshotManager.appendPaginationBatch(currentList, eligible, currentSort, {
                    profileId: activeProfile?.id || 'default',
                    isChild: activeProfile?.isChild === true,
                    category: 'animes',
                    genreFilter: selectedGenre
                  });
              return { ...prev, [targetKey]: updated.filter(i => searchService.isAnimeItem(i)) };
            });
          }
        }
      }).catch(() => {});
    }

    return () => {
      isCancelled = true;
    };
  }, [currentView, getSnapshotKeyForView, categorySorts, selectedGenre, activeProfile?.id, activeProfile?.isChild]);

  // Busca sob demanda quando o usuário seleciona um gênero específico
  useEffect(() => {
    if (!selectedGenre || selectedGenre === 'Todos') return;

    let isMounted = true;
    const loadGenreCatalog = async () => {
      try {
        if (currentView === 'movies') {
          const currentSort = categorySorts.movies || 'recommended';
          const targetKey = getSnapshotKeyForView('movies', selectedGenre, currentSort);
          const res = await catalogDiscoveryService.discoverMovies(1, selectedGenre);
          if (isMounted && res.items.length > 0 && currentViewRef.current === 'movies') {
            const onlyMovies = res.items.filter(i => searchService.isMovieItem(i, false));
            setPopularMovies(prev => deduplicateContentItems([...prev, ...onlyMovies]).filter(i => searchService.isMovieItem(i, false)));
            setContent(prev => deduplicateContentItems([...prev, ...onlyMovies]));
            setCatalogSnapshots(prev => {
              const currentList = prev[targetKey] || [];
              const eligible = catalogEligibilityService.filterEligibleItemsSync(onlyMovies);
              if (currentList.length === 0) {
                const sorted = catalogSnapshotManager.createInitialSnapshot(eligible, currentSort, {
                  profileId: activeProfile?.id || 'default',
                  isChild: activeProfile?.isChild === true,
                  category: 'movies',
                  genreFilter: selectedGenre
                });
                return { ...prev, [targetKey]: sorted.filter(i => searchService.isMovieItem(i, false)) };
              }
              const updated = catalogSnapshotManager.appendPaginationBatch(
                currentList,
                eligible,
                currentSort,
                {
                  profileId: activeProfile?.id || 'default',
                  isChild: activeProfile?.isChild === true,
                  category: 'movies',
                  genreFilter: selectedGenre
                }
              );
              return { ...prev, [targetKey]: updated.filter(i => searchService.isMovieItem(i, false)) };
            });
            setMoviesPage(1);
          }
        } else if (currentView === 'series') {
          const currentSort = categorySorts.series || 'recommended';
          const targetKey = getSnapshotKeyForView('series', selectedGenre, currentSort);
          const res = await catalogDiscoveryService.discoverSeries(1, selectedGenre);
          if (isMounted && res.items.length > 0 && currentViewRef.current === 'series') {
            const onlySeries = res.items.filter(i => searchService.isSeriesItem(i));
            setPopularSeries(prev => deduplicateContentItems([...prev, ...onlySeries]).filter(i => searchService.isSeriesItem(i)));
            setContent(prev => deduplicateContentItems([...prev, ...onlySeries]));
            setCatalogSnapshots(prev => {
              const currentList = prev[targetKey] || [];
              const eligible = catalogEligibilityService.filterEligibleItemsSync(onlySeries);
              if (currentList.length === 0) {
                const sorted = catalogSnapshotManager.createInitialSnapshot(eligible, currentSort, {
                  profileId: activeProfile?.id || 'default',
                  isChild: activeProfile?.isChild === true,
                  category: 'series',
                  genreFilter: selectedGenre
                });
                return { ...prev, [targetKey]: sorted.filter(i => searchService.isSeriesItem(i)) };
              }
              const updated = catalogSnapshotManager.appendPaginationBatch(
                currentList,
                eligible,
                currentSort,
                {
                  profileId: activeProfile?.id || 'default',
                  isChild: activeProfile?.isChild === true,
                  category: 'series',
                  genreFilter: selectedGenre
                }
              );
              return { ...prev, [targetKey]: updated.filter(i => searchService.isSeriesItem(i)) };
            });
            setSeriesPage(1);
          }
        } else if (currentView === 'animes') {
          const currentSort = categorySorts.animes || 'recommended';
          const targetKey = getSnapshotKeyForView('animes', selectedGenre, currentSort);
          const res = await catalogDiscoveryService.discoverAnimes(1, selectedGenre);
          if (isMounted && res.items.length > 0 && currentViewRef.current === 'animes') {
            const onlyAnimes = res.items.filter(i => searchService.isAnimeItem(i));
            setAnimeItems(prev => deduplicateContentItems([...prev, ...onlyAnimes]).filter(i => searchService.isAnimeItem(i)));
            setContent(prev => deduplicateContentItems([...prev, ...onlyAnimes]));
            setCatalogSnapshots(prev => {
              const currentList = prev[targetKey] || [];
              const eligible = catalogEligibilityService.filterEligibleItemsSync(onlyAnimes);
              if (currentList.length === 0) {
                const sorted = catalogSnapshotManager.createInitialSnapshot(eligible, currentSort, {
                  profileId: activeProfile?.id || 'default',
                  isChild: activeProfile?.isChild === true,
                  category: 'animes',
                  genreFilter: selectedGenre
                });
                return { ...prev, [targetKey]: sorted.filter(i => searchService.isAnimeItem(i)) };
              }
              const updated = catalogSnapshotManager.appendPaginationBatch(
                currentList,
                eligible,
                currentSort,
                {
                  profileId: activeProfile?.id || 'default',
                  isChild: activeProfile?.isChild === true,
                  category: 'animes',
                  genreFilter: selectedGenre
                }
              );
              return { ...prev, [targetKey]: updated.filter(i => searchService.isAnimeItem(i)) };
            });
            setAnimesPage(1);
          }
        }
      } catch (e) {
        console.warn('Erro ao buscar catálogo por gênero:', e);
      }
    };

    loadGenreCatalog();
    return () => { isMounted = false; };
  }, [selectedGenre, currentView, categorySorts, activeProfile?.id, activeProfile?.isChild, getSnapshotKeyForView]);

  // Paginação e carregamento incremental sob demanda ("Carregar Mais" / Infinite Scroll sem limites artificiais)
  const handleLoadMore = useCallback(async (view: AppView) => {
    if (isLoadingMoreRef.current) return;
    const isBrowse = view === 'movies' || view === 'series' || view === 'animes';
    if (!isBrowse) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const targetKey = getSnapshotKeyForView(view as 'movies' | 'series' | 'animes');

    try {
      if (view === 'movies') {
        let nextPage = moviesPageRef.current + 1;
        moviesPageRef.current = nextPage;
        setMoviesPage(nextPage);
        let attempts = 0;
        const maxAttempts = 3;
        let newItems: ContentItem[] = [];
        let hasMore = true;

        while (attempts < maxAttempts) {
          const res = await catalogDiscoveryService.discoverMovies(nextPage, selectedGenre);
          hasMore = res.hasMore;
          const onlyMovies = res.items.filter(i => searchService.isMovieItem(i, false));

          if (onlyMovies.length > 0) {
            newItems.push(...onlyMovies);
          }

          if (newItems.length > 0 || !hasMore) {
            break;
          }

          nextPage++;
          moviesPageRef.current = nextPage;
          setMoviesPage(nextPage);
          attempts++;
        }

        if (currentViewRef.current !== 'movies') return;

        if (newItems.length > 0) {
          const eligibleNew = catalogEligibilityService.filterEligibleItemsSync(newItems);
          const currentSort = categorySorts.movies || 'recommended';
          setCatalogSnapshots(prev => {
            const currentList = prev[targetKey] || [];
            const updated = catalogSnapshotManager.appendPaginationBatch(
              currentList,
              eligibleNew,
              currentSort,
              {
                profileId: activeProfile?.id || 'default',
                isChild: activeProfile?.isChild === true,
                category: 'movies',
                genreFilter: selectedGenre
              }
            );
            return { ...prev, [targetKey]: deduplicateContentItems(updated.filter(i => searchService.isMovieItem(i, false))) };
          });

          setPopularMovies(prev => {
            const updated = deduplicateContentItems([...prev, ...newItems]).filter(i => searchService.isMovieItem(i, false));
            storageService.saveCachedCatalog('movies', updated);
            return updated;
          });
          setContent(prev => deduplicateContentItems([...prev, ...newItems]));
        }

        setHasMoreMovies(hasMore);
      } else if (view === 'series') {
        let nextPage = seriesPageRef.current + 1;
        seriesPageRef.current = nextPage;
        setSeriesPage(nextPage);
        let attempts = 0;
        const maxAttempts = 3;
        let newItems: ContentItem[] = [];
        let hasMore = true;

        while (attempts < maxAttempts) {
          const res = await catalogDiscoveryService.discoverSeries(nextPage, selectedGenre);
          hasMore = res.hasMore;
          const onlySeries = res.items.filter(i => searchService.isSeriesItem(i));

          if (onlySeries.length > 0) {
            newItems.push(...onlySeries);
          }

          if (newItems.length > 0 || !hasMore) {
            break;
          }

          nextPage++;
          seriesPageRef.current = nextPage;
          setSeriesPage(nextPage);
          attempts++;
        }

        if (currentViewRef.current !== 'series') return;

        if (newItems.length > 0) {
          const eligibleNew = catalogEligibilityService.filterEligibleItemsSync(newItems);
          const currentSort = categorySorts.series || 'recommended';
          setCatalogSnapshots(prev => {
            const currentList = prev[targetKey] || [];
            const updated = catalogSnapshotManager.appendPaginationBatch(
              currentList,
              eligibleNew,
              currentSort,
              {
                profileId: activeProfile?.id || 'default',
                isChild: activeProfile?.isChild === true,
                category: 'series',
                genreFilter: selectedGenre
              }
            );
            return { ...prev, [targetKey]: deduplicateContentItems(updated.filter(i => searchService.isSeriesItem(i))) };
          });

          setPopularSeries(prev => {
            const updated = deduplicateContentItems([...prev, ...newItems]).filter(i => searchService.isSeriesItem(i));
            storageService.saveCachedCatalog('series', updated);
            return updated;
          });
          setContent(prev => deduplicateContentItems([...prev, ...newItems]));
        }

        setHasMoreSeries(hasMore);
      } else if (view === 'animes') {
        let nextPage = animesPageRef.current + 1;
        animesPageRef.current = nextPage;
        setAnimesPage(nextPage);
        let attempts = 0;
        const maxAttempts = 3;
        let newItems: ContentItem[] = [];
        let hasMore = true;

        while (attempts < maxAttempts) {
          const res = await catalogDiscoveryService.discoverAnimes(nextPage, selectedGenre);
          hasMore = res.hasMore;
          const onlyAnimes = res.items.filter(i => searchService.isAnimeItem(i));

          if (onlyAnimes.length > 0) {
            newItems.push(...onlyAnimes);
          }

          if (newItems.length > 0 || !hasMore) {
            break;
          }

          nextPage++;
          animesPageRef.current = nextPage;
          setAnimesPage(nextPage);
          attempts++;
        }

        if (currentViewRef.current !== 'animes') return;

        if (newItems.length > 0) {
          const eligibleNew = catalogEligibilityService.filterEligibleItemsSync(newItems);
          const currentSort = categorySorts.animes || 'recommended';
          setCatalogSnapshots(prev => {
            const currentList = prev[targetKey] || [];
            const updated = catalogSnapshotManager.appendPaginationBatch(
              currentList,
              eligibleNew,
              currentSort,
              {
                profileId: activeProfile?.id || 'default',
                isChild: activeProfile?.isChild === true,
                category: 'animes',
                genreFilter: selectedGenre
              }
            );
            return { ...prev, [targetKey]: deduplicateContentItems(updated.filter(i => searchService.isAnimeItem(i))) };
          });

          setAnimeItems(prev => {
            const updated = deduplicateContentItems([...prev, ...newItems]).filter(i => searchService.isAnimeItem(i));
            storageService.saveCachedCatalog('animes', updated);
            return updated;
          });
          setContent(prev => deduplicateContentItems([...prev, ...newItems]));
        }

        setHasMoreAnimes(hasMore);
      }
    } catch (e) {
      console.warn('Erro ao carregar mais itens:', e);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [selectedGenre, categorySorts, activeProfile?.id, activeProfile?.isChild, getSnapshotKeyForView]);

  // Atualiza a fileira "Continuar Assistindo" em tempo real sempre que o progresso é salvo
  useEffect(() => {
    const handleProgressUpdated = async () => {
      try {
        const updated = await storageService.getContinueWatching();
        setContinueWatchingList(updated);
      } catch {}
    };
    window.addEventListener('zapitv_progress_updated', handleProgressUpdated);
    return () => window.removeEventListener('zapitv_progress_updated', handleProgressUpdated);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let unsubscribes: (() => void)[] = [];
    let cancelled = false;

    const syncTimer = setTimeout(() => {
      if (cancelled) return;
      import('firebase/firestore').then(({ collection, onSnapshot, doc }) => {
        import('./firebase').then(({ db: firestoreDb }) => {
          if (cancelled) return;
          // Listen to content changes
          unsubscribes.push(onSnapshot(collection(firestoreDb, 'content'), (snapshot) => {
            const newContent = snapshot.docs.map(doc => doc.data() as ContentItem);
            if (newContent.length > 0) {
              setContent(prev => deduplicateContentItems([...prev, ...newContent]));
            }
          }, (error) => {
            if (error.code !== 'permission-denied') {
              console.error("Error listening to content:", error);
            }
          }));

          // Listen to users changes
          if (currentUser?.role === 'admin') {
            unsubscribes.push(onSnapshot(collection(firestoreDb, 'users'), (snapshot) => {
              const newUsers = snapshot.docs.map(doc => {
                const u = doc.data() as User;
                return withoutPlaintextPassword({ ...u, profiles: u.profiles || [] });
              });
              if (newUsers.length > 0) {
                setUsers(newUsers);
              }
              
              // Update current user if they are in the new list
              if (currentUser) {
                const updatedCurrentUser = newUsers.find(u => u.id === currentUser.id);
                if (updatedCurrentUser) {
                  setCurrentUser(updatedCurrentUser);
                  if (activeProfile) {
                    const matchingProfile = updatedCurrentUser.profiles.find(p => p.id === activeProfile.id);
                    if (matchingProfile) setActiveProfile(matchingProfile);
                  }
                }
              }
            }, (error) => {
              if (error.code !== 'permission-denied') {
                console.error("Error listening to users:", error);
              }
            }));
          } else if (currentUser) {
            unsubscribes.push(onSnapshot(doc(firestoreDb, 'users', currentUser.id), (snapshot) => {
              if (snapshot.exists()) {
                let updatedCurrentUser = snapshot.data() as User;
                updatedCurrentUser = withoutPlaintextPassword({ ...updatedCurrentUser, profiles: updatedCurrentUser.profiles || [] });
                setCurrentUser(updatedCurrentUser);
                setUsers([updatedCurrentUser]);
                if (activeProfile) {
                  const matchingProfile = updatedCurrentUser.profiles.find(p => p.id === activeProfile.id);
                  if (matchingProfile) setActiveProfile(matchingProfile);
                }
              }
            }, (error) => {
              if (error.code !== 'permission-denied') {
                console.error("Error listening to current user:", error);
              }
            }));
          }

          // Listen to custom sections changes
          unsubscribes.push(onSnapshot(collection(firestoreDb, 'customSections'), (snapshot) => {
            const newSections = snapshot.docs.map(doc => doc.data() as CustomSection);
            if (newSections.length > 0) {
              setCustomSections(prev => {
                if (prev.length === newSections.length && prev.every((s, i) => s.id === newSections[i].id && s.title === newSections[i].title && s.items.length === newSections[i].items.length)) {
                  return prev;
                }
                return newSections;
              });
            }
          }, (error) => {
            if (error.code !== 'permission-denied') {
              console.error("Error listening to custom sections:", error);
            }
          }));

          // Listen to notifications changes
          unsubscribes.push(onSnapshot(collection(firestoreDb, 'notifications'), (snapshot) => {
            const newNotifications = snapshot.docs.map(doc => doc.data() as SiteNotification);
            if (newNotifications.length > 0) {
              setSiteNotifications(prev => {
                if (prev.length === newNotifications.length && prev.every((n, i) => n.id === newNotifications[i].id && n.title === newNotifications[i].title)) {
                  return prev;
                }
                return newNotifications;
              });
            }
          }, (error) => {
            if (error.code !== 'permission-denied') {
              console.error("Error listening to notifications:", error);
            }
          }));

          // Listen to myList changes
          if (currentUser) {
            unsubscribes.push(onSnapshot(doc(firestoreDb, 'keyValueStore', `zapitv_mylist_${currentUser.id}`), (doc) => {
              if (doc.exists() && Array.isArray(doc.data().value)) {
                const incoming = doc.data().value as string[];
                setMyList(prev => {
                  if (prev.length === incoming.length && prev.every((id, idx) => id === incoming[idx])) {
                    return prev;
                  }
                  return incoming;
                });
              }
            }, (error) => {
              if (error.code !== 'permission-denied') {
                console.error("Error listening to myList:", error);
              }
            }));

            // Listen to favorites changes
            unsubscribes.push(onSnapshot(doc(firestoreDb, 'keyValueStore', `zapitv_favorites_${currentUser.id}`), (doc) => {
              if (doc.exists() && Array.isArray(doc.data().value)) {
                const incoming = doc.data().value as string[];
                setFavorites(prev => {
                  if (prev.length === incoming.length && prev.every((id, idx) => id === incoming[idx])) {
                    return prev;
                  }
                  return incoming;
                });
              }
            }, (error) => {
              if (error.code !== 'permission-denied') {
                console.error("Error listening to favorites:", error);
              }
            }));
          }
        }).catch(error => console.warn('Falha ao iniciar sincronização remota:', error));
      }).catch(error => console.warn('Falha ao carregar cliente de sincronização:', error));
    }, 3500);

    return () => {
      cancelled = true;
      clearTimeout(syncTimer);
      unsubscribes.forEach(unsub => unsub());
    };
  }, [isAuthenticated, currentUser?.id, activeProfile?.id]);

  // Handle mock auth bypass recovery
  useEffect(() => {
    const checkMockAuth = async () => {
      try {
        const mockAuth = await db.keyValueStore.get('zapitv_mock_auth');
        if (mockAuth?.value && !isAuthenticated) {
          const mockUser = await db.keyValueStore.get('zapitv_mock_user');
          if (mockUser?.value) {
            setCurrentUser(mockUser.value);
            setIsAuthenticated(true);
          }
        }
      } catch (e) {
        console.warn('Falha ao restaurar mock auth', e);
      }
    };
    if (!isAuthenticated) {
      checkMockAuth();
    }
  }, [isAuthenticated]);

  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('busca') || sp.get('q') || '';
    } catch {
      return '';
    }
  });
  // Busca confirmada (ativada exclusivamente por Enter ou clique em "Ver todos os resultados")
  // Enquanto o usuário apenas digita no campo, a página atual permanece 100% inalterada!
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState<string>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('busca') || sp.get('q') || '';
    } catch {
      return '';
    }
  });
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [watchRouteNotFound, setWatchRouteNotFound] = useState(false);
  const detailOriginRouteRef = useRef<string | null>(null);
  const closedContentIdRef = useRef<string | null>(null);
  const prevDetailRoutePathRef = useRef<string>(location.pathname);

  // Monitora alterações de rota: se saiu de uma rota profunda de detalhes (ex: /filmes/:id via browser back) para catálogo (/filmes), limpa modal
  useEffect(() => {
    const prevPath = prevDetailRoutePathRef.current;
    const isPrevWatch = parseWatchRoute(prevPath).isWatch;
    const isPrevDetail = Boolean(
      matchPath('/filmes/:id', prevPath) ||
      matchPath('/series/:id', prevPath) ||
      matchPath('/series/:id/temporada/:season/episodio/:episode', prevPath) ||
      matchPath('/animes/:id', prevPath) ||
      matchPath('/animes/:id/temporada/:season/episodio/:episode', prevPath)
    );

    if (isPrevDetail && !isPrevWatch && !activeDetailId && !isWatchRoute && selectedContent) {
      setSelectedContent(null);
    }
    prevDetailRoutePathRef.current = location.pathname;
  }, [activeDetailId, isWatchRoute, selectedContent, location.pathname]);

  // Abertura in-loco de detalhes: abre o modal preservando a rota, página atual, scroll e contexto
  const handleSelectContent = useCallback((item: ContentItem) => {
    if (!catalogEligibilityService.isItemPubliclyPlayableSync(item)) {
      return false;
    }
    if (adultContentService.isAdultContent(item)) {
      if (activeProfile?.isChild) {
        setIsAgeVerificationOpen(true);
        return false;
      }
      if (!adultContentService.isAgeConfirmed(activeProfile?.id)) {
        setPendingAdultItem(item);
        setIsAgeVerificationOpen(true);
        return false;
      }
    }
    if (tvModeService.isTvMode()) {
      tvNavigationManager.saveFocusSnapshot();
    }
    closedContentIdRef.current = null;
    detailOriginRouteRef.current = location.pathname + location.search;
    setSelectedContent(item);
    uiSoundService.play('detailOpen');
    return true;
  }, [activeProfile, location.pathname, location.search]);

  const handlePlayFromHero = useCallback((item: ContentItem) => {
    if (!handleSelectContent(item)) return;
    const continuity = storageService.getPlaybackContinuity(item);
    navigate(getWatchRoute(item, continuity.season, continuity.episode));
  }, [handleSelectContent, navigate]);

  const handleCloseDetailModal = useCallback(() => {
    const currentId = selectedContent?.id || activeDetailId;
    if (currentId) {
      closedContentIdRef.current = String(currentId);
    }
    setSelectedContent(null);

    const origin = detailOriginRouteRef.current;
    detailOriginRouteRef.current = null;

    // Se temos uma rota de origem prévia que não seja rota de assistir nem rota profunda de detalhes
    if (origin && !parseWatchRoute(origin).isWatch && !matchPath('/filmes/:id', origin) && !matchPath('/series/:id', origin) && !matchPath('/animes/:id', origin)) {
      if (location.pathname !== origin) {
        navigate(origin, { replace: true });
      }
    } else {
      const path = location.pathname;
      // Apenas limpa a URL se o usuário tiver acessado diretamente por deep link (/filmes/:id, etc.)
      if (path.startsWith('/filmes/')) {
        navigate('/filmes', { replace: true });
      } else if (path.startsWith('/series/')) {
        navigate('/series', { replace: true });
      } else if (path.startsWith('/animes/')) {
        navigate('/animes', { replace: true });
      }
    }
  }, [selectedContent, activeDetailId, location.pathname, navigate]);

  // Sincronização de conteúdo EXCLUSIVAMENTE para links diretos/profundos na URL (/filmes/:id, /series/:id, /animes/:id, etc.)
  useEffect(() => {
    if (!activeDetailId) {
      if (isWatchRoute) setWatchRouteNotFound(true);
      closedContentIdRef.current = null;
      return;
    }

    // Se o usuário acabou de fechar explicitamente este item, não o restaura pela URL
    if (closedContentIdRef.current && (
      closedContentIdRef.current === activeDetailId ||
      selectedContent?.id === closedContentIdRef.current ||
      selectedContent?.imdbId === closedContentIdRef.current ||
      selectedContent?.tmdbId === closedContentIdRef.current
    )) {
      return;
    }

    if (selectedContent && (selectedContent.id === activeDetailId || selectedContent.imdbId === activeDetailId || selectedContent.tmdbId === activeDetailId) &&
        (!isWatchRoute || getWatchRoute(selectedContent).split('/')[2] ===
          (parsedWatch.mediaType === 'movie' ? 'filme' : parsedWatch.mediaType === 'anime' ? 'anime' : 'serie'))) {
      setWatchRouteNotFound(false);
      return;
    }

    let active = true;
    setWatchRouteNotFound(false);

    const acceptsRoute = (candidate: ContentItem) =>
      !isWatchRoute || (
        catalogEligibilityService.isItemPubliclyPlayableSync(candidate) &&
        getWatchRoute(candidate, 1, 1).split('/')[2] ===
          (parsedWatch.mediaType === 'movie' ? 'filme' : parsedWatch.mediaType === 'anime' ? 'anime' : 'serie')
      );

    const resolveItemFromRoute = async () => {
      // 1. Tenta achar no catálogo local ou itens abertos verificados
      const localFound = content.find(i => 
        i.id === activeDetailId || 
        i.imdbId === activeDetailId || 
        i.tmdbId === activeDetailId
      ) || VERIFIED_OPEN_ITEMS.find(i => 
        i.id === activeDetailId || 
        i.imdbId === activeDetailId || 
        i.tmdbId === activeDetailId
      );

      if (localFound && acceptsRoute(localFound)) {
        if (active && closedContentIdRef.current !== activeDetailId) {
          setSelectedContent(localFound);
        }
        return;
      }

      // 2. Se não estiver no cache imediato, busca metadados no TMDB/Cinemeta
      try {
        const isAnime = parsedWatch.mediaType === 'anime' || location.pathname.startsWith('/animes');
        const isSeries = parsedWatch.mediaType === 'series' || location.pathname.startsWith('/series') || isAnime;
        const mediaType = isAnime ? ContentType.ANIME : (isSeries ? ContentType.SERIES : ContentType.MOVIE);

        let details: ContentItem | null = null;
        if (activeDetailId.startsWith('tt')) {
          details = await tmdbService.findByImdb(activeDetailId);
        } else if (/^\d+$/.test(activeDetailId)) {
          const res = await tmdbService.getDetails(activeDetailId, mediaType);
          details = res?.item || null;
        }

        if (active && closedContentIdRef.current !== activeDetailId && details && acceptsRoute(details)) {
          setSelectedContent(details);
        } else if (active && isWatchRoute) {
          setWatchRouteNotFound(true);
        }
      } catch (err) {
        console.warn('Erro ao carregar conteúdo da URL profunda:', err);
        if (active && isWatchRoute) setWatchRouteNotFound(true);
      }
    };

    resolveItemFromRoute();

    return () => {
      active = false;
    };
  }, [activeDetailId, content, location.pathname, selectedContent, isWatchRoute, parsedWatch.mediaType]);

  // Sincroniza busca se vier por query param (?busca=... ou ?q=...)
  useEffect(() => {
    const q = searchParams.get('busca') || searchParams.get('q') || '';
    if (q && q !== submittedSearchQuery) {
      setSearchQuery(q);
      setSubmittedSearchQuery(q);
    }
  }, [searchParams]);

  // Filtro centralizado de elegibilidade e reprodução real
  const allowedContent = useMemo(() => {
    return catalogEligibilityService.filterEligibleItemsSync(content);
  }, [content, catalogEligibilityVersion]);

  // Memoize row items to prevent filtering 48,000 items on every render
  const netflixItems = useMemo(() => allowedContent.filter(i => i.platform?.includes('Netflix')), [allowedContent]);
  const primeItems = useMemo(() => allowedContent.filter(i => i.platform?.includes('Prime Video')), [allowedContent]);
  const hboItems = useMemo(() => allowedContent.filter(i => i.platform?.includes('Max') || i.platform?.includes('HBO')), [allowedContent]);
  const recentItems = useMemo(() => allowedContent.slice().reverse(), [allowedContent]);
  const premiumItems = useMemo(() => allowedContent.slice(0, 12), [allowedContent]);

  // A busca na página de resultados é exibida imediatamente com os itens locais (< 5ms)
  // e complementada de forma não-bloqueante pelas fontes externas e atores
  useEffect(() => {
    const trimmed = submittedSearchQuery.trim();
    if (!trimmed) {
      setLiveSearchResults([]);
      setLiveSearchActors([]);
      return;
    }

    const category = searchService.mapAppViewToCategory(currentView);

    // 1. FASE IMEDIATA (0ms): Mostra resultados locais em memória sem esperar rede
    const localMatches = searchService.searchLocalInstant(trimmed, category, contentRef.current, activeProfile, 50);
    setLiveSearchResults(localMatches);

    let active = true;

    // 2. FASE NÃO-BLOQUEANTE: Atores carregados de forma independente (não atrasa produções)
    searchService.searchPersons(trimmed)
      .then(foundActors => {
        if (active) {
          setLiveSearchActors(foundActors || []);
        }
      })
      .catch(() => {});

    // 3. FASE NÃO-BLOQUEANTE: Conteúdos remotos acrescentados progressivamente conforme chegam
    searchService.search(trimmed, category, contentRef.current, activeProfile, (partialResults) => {
      if (active) {
        setLiveSearchResults(partialResults);
      }
    }).then(finalResults => {
      if (!active) return;
      setLiveSearchResults(finalResults);

      // UNIFICAÇÃO COM O ÍNDICE CENTRAL DO CATÁLOGO:
      // Apenas adiciona ao estado se houver títulos genuinamente novos (evita invalidar Home desnecessariamente)
      const nonAdultResults = finalResults.filter(i => !adultContentService.isAdultContent(i));
      if (nonAdultResults.length > 0) {
        const existingIds = new Set(contentRef.current.map(i => i.id));
        const trulyNewItems = nonAdultResults.filter(i => !existingIds.has(i.id));

        if (trulyNewItems.length > 0) {
          setContent(prev => deduplicateContentItems([...prev, ...trulyNewItems]));

          const newMovies = trulyNewItems.filter(i => searchService.isMovieItem(i));
          if (newMovies.length > 0) {
            setPopularMovies(prev => deduplicateContentItems([...prev, ...newMovies]));
          }
          const newSeries = trulyNewItems.filter(i => searchService.isSeriesItem(i));
          if (newSeries.length > 0) {
            setPopularSeries(prev => deduplicateContentItems([...prev, ...newSeries]));
          }
          const newAnimes = trulyNewItems.filter(i => searchService.isAnimeItem(i));
          if (newAnimes.length > 0) {
            setAnimeItems(prev => deduplicateContentItems([...prev, ...newAnimes]));
          }
        }
      }
    }).catch(() => {
      // Falha de rede não apaga os resultados locais já exibidos
    });

    return () => {
      active = false;
      searchService.cancelPageSearch();
    };
  }, [submittedSearchQuery, currentView, activeProfile]);

  useEffect(() => {
    db.keyValueStore.put({ key: 'zapitv_theme', value: isDarkMode });
    document.body.className = isDarkMode ? 'dark text-white overflow-x-hidden no-scrollbar' : 'text-gray-900 overflow-x-hidden no-scrollbar';
  }, [isDarkMode]);

  // PERSISTÊNCIA LOCAL
  useEffect(() => {
    try {
      if (activeProfile) {
        db.keyValueStore.put({ key: 'zapitv_active_profile', value: activeProfile });
      } else {
        db.keyValueStore.delete('zapitv_active_profile');
      }
    } catch (e) {
      console.warn("Falha ao salvar no dexie", e);
    }
  }, [activeProfile]);

  useEffect(() => {
    try {
      db.keyValueStore.put({ key: 'zapitv_auth', value: isAuthenticated });
      if (isAuthenticated) {
        db.keyValueStore.put({ key: 'zapitv_current_user', value: withoutPlaintextPassword(currentUser) });
        db.keyValueStore.put({ key: 'zapitv_last_email', value: currentUser.email });
      } else {
        db.keyValueStore.delete('zapitv_current_user');
      }
    } catch (e) {
       console.warn("Falha ao salvar sessão", e);
    }
  }, [isAuthenticated, currentUser]);

  // ==================================================================================
  // SINCRONIZAÇÃO ENTRE ABAS (REMOVIDO PARA DEXIE)
  // ==================================================================================

  const handleResetPassword = useCallback(async (email: string): Promise<void> => {
    console.log("App: Attempting password reset for:", email);
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('./firebase');
      await sendPasswordResetEmail(auth, email);
      console.log("App: Password reset email sent successfully to:", email);
    } catch (error: any) {
      console.error("App: Password reset error:", error);
      if (error.code === 'auth/user-not-found') {
        throw new Error('E-mail não encontrado. Verifique se digitou corretamente ou crie uma nova conta.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('E-mail inválido. Verifique o formato digitado.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Muitas solicitações. Tente novamente mais tarde.');
      } else {
        throw new Error(error.message || 'Erro ao enviar e-mail de redefinição.');
      }
    }
  }, []);

  const handleLogin = useCallback(async (email: string, pass: string): Promise<string | null> => {
    try {
      const trimmedEmail = (email || '').trim();
      const cleanEmail = trimmedEmail.toLowerCase();

      if (!trimmedEmail) {
        return 'Por favor, informe seu e-mail.';
      }

      // 1. Procurar se já existe usuário na lista local ou mock
      const existingUser = users.find(u => u.email.toLowerCase() === cleanEmail) ||
                           MOCK_USERS.find(u => u.email.toLowerCase() === cleanEmail);

      let firestoreUserData: User | null = null;
      let firebaseUid: string | null = null;

      // 2. Tentar autenticação no Firebase em segundo plano sem bloquear em caso de erro
      try {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const { auth, db: firestoreDb } = await import('./firebase');
        const { doc, getDoc } = await import('firebase/firestore');

        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
        firebaseUid = userCredential.user.uid;
        const userDoc = await getDoc(doc(firestoreDb, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          firestoreUserData = userDoc.data() as User;
        }
      } catch (fbErr) {
        // Firebase não tem este usuário ou senha diferente: permitir login livremente
        console.info("Firebase Auth ignorado ou não encontrado - permitindo login livre:", fbErr);
      }

      // 3. Montar usuário autenticado
      let targetUser: User;
      const baseName = trimmedEmail.includes('@') ? trimmedEmail.split('@')[0] : trimmedEmail;
      const formattedName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

      if (firestoreUserData) {
        targetUser = {
          ...withoutPlaintextPassword(firestoreUserData),
          role: firebaseUid && firestoreUserData.role === 'admin' ? 'admin' : 'user',
          profiles: (firestoreUserData.profiles && firestoreUserData.profiles.length > 0)
            ? firestoreUserData.profiles
            : [{ id: `p-${Date.now()}`, name: firestoreUserData.name || formattedName, avatar: AVATARS[0], isChild: false }]
        };
      } else if (existingUser) {
        targetUser = {
          ...withoutPlaintextPassword(existingUser),
          role: 'user',
          profiles: (existingUser.profiles && existingUser.profiles.length > 0)
            ? existingUser.profiles
            : [{ id: `p-${Date.now()}`, name: existingUser.name || formattedName, avatar: AVATARS[0], isChild: false }]
        };
      } else {
        // Novo usuário criado dinamicamente com qualquer e-mail/senha digitados
        targetUser = {
          id: firebaseUid || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: formattedName,
          email: trimmedEmail,
          role: 'user',
          devMode: false,
          memberSince: new Date().toLocaleDateString('pt-BR'),
          plan: 'Premium 4K',
          status: 'Ativo',
          profiles: [
            {
              id: `p-${Date.now()}`,
              name: formattedName,
              avatar: AVATARS[0],
              isChild: false
            }
          ]
        };

        // Salvar no Firestore se possível
        try {
          const { db: firestoreDb } = await import('./firebase');
          const { doc, setDoc } = await import('firebase/firestore');
          await setDoc(doc(firestoreDb, 'users', targetUser.id), withoutPlaintextPassword(targetUser));
        } catch (e) {
          console.warn('Não foi possível persistir no Firestore, continuando local:', e);
        }
      }

      // Atualizar lista de usuários
      setUsers(prev => {
        const idx = prev.findIndex(u => u.email.toLowerCase() === cleanEmail || u.id === targetUser.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = targetUser;
          return copy;
        }
        return [...prev, targetUser];
      });

      // Gravar persistência local
      await db.keyValueStore.put({ key: 'zapitv_mock_auth', value: true });
      await db.keyValueStore.put({ key: 'zapitv_mock_user', value: withoutPlaintextPassword(targetUser) });
      await db.keyValueStore.put({ key: 'zapitv_last_email', value: trimmedEmail });

      setCurrentUser(targetUser);
      setIsAuthenticated(true);
      setCurrentView('profile-selector');
      return null; // Sucesso imediato
    } catch (error: any) {
      console.error("Login fallback error:", error);
      const fallbackName = (email || 'Usuário').split('@')[0];
      const fallbackUser: User = {
        id: `user-${Date.now()}`,
        name: fallbackName,
        email: (email || 'usuario@zapitv.com').trim(),
        role: 'user',
        devMode: false,
        memberSince: new Date().toLocaleDateString('pt-BR'),
        plan: 'Premium 4K',
        status: 'Ativo',
        profiles: [{ id: `p-${Date.now()}`, name: fallbackName, avatar: AVATARS[0], isChild: false }]
      };
      setCurrentUser(fallbackUser);
      setIsAuthenticated(true);
      setCurrentView('profile-selector');
      return null;
    }
  }, [users]);

  const handleSignup = useCallback(async (name: string, email: string, pass: string, plan: string) => {
    const trimmedEmail = email.trim();
    const cleanEmail = trimmedEmail.toLowerCase();
    try {
      let uid = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      try {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        const { auth } = await import('./firebase');
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
        uid = userCredential.user.uid;
      } catch (fbErr) {
        console.warn("Firebase signup error (permitido):", fbErr);
      }

      const newUser: User = {
        id: uid,
        name: name || trimmedEmail.split('@')[0] || 'Usuário',
        email: trimmedEmail,
        role: 'user',
        devMode: false,
        memberSince: new Date().toLocaleDateString('pt-BR'),
        plan: plan,
        status: 'Ativo',
        profiles: [{ id: `p-${Date.now()}`, name: (name || trimmedEmail.split('@')[0] || 'Perfil').split(' ')[0], avatar: AVATARS[0], isChild: false }]
      };
      
      try {
        const { db: firestoreDb } = await import('./firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(firestoreDb, 'users', uid), withoutPlaintextPassword(newUser));
      } catch (err) {
        console.warn("Could not save to firestore:", err);
      }
      
      await db.keyValueStore.put({ key: 'zapitv_mock_auth', value: true });
      await db.keyValueStore.put({ key: 'zapitv_mock_user', value: withoutPlaintextPassword(newUser) });
      await db.keyValueStore.put({ key: 'zapitv_last_email', value: trimmedEmail });

      setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), newUser]);
      setCurrentUser(newUser);
      setIsAuthenticated(true);
      setCurrentView('profile-selector');
    } catch (error: any) {
      console.error("Signup error:", error);
      throw error;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const { signOut } = await import('firebase/auth');
      const { auth } = await import('./firebase');
      await signOut(auth);
      await db.keyValueStore.delete('zapitv_mock_auth');
      await db.keyValueStore.delete('zapitv_mock_user');
    } catch (error) {
      console.error("Logout error:", error);
    }
    setIsAuthenticated(false);
    setActiveProfile(null);
    setCurrentView('home');
  }, []);

  const toggleMyListById = useCallback(async (id: string) => {
    if (!currentUser) return;
    uiSoundService.prime();
    const isAdding = !myList.includes(id);
    const newList = isAdding ? [...myList, id] : myList.filter(i => i !== id);
    setMyList(newList);

    const target = content.find(i => i.id === id);
    if (target) {
      userPreferenceStore.recordFavorite(target, isAdding, activeProfile?.id || 'default');
      recommendationEngine.invalidateCache();
      hybridRecommendationEngine.invalidateCache();
    }

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      await setDoc(doc(firestoreDb, 'keyValueStore', `zapitv_mylist_${currentUser.id}`), { value: newList });
      uiSoundService.play(isAdding ? 'listAdd' : 'listRemove');
    } catch (error) {
      console.error("Error saving myList:", error);
    }
  }, [myList, currentUser, content, activeProfile?.id]);

  const toggleMyList = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    return toggleMyListById(id);
  }, [toggleMyListById]);

  const toggleFavoriteById = useCallback(async (id: string) => {
    if (!currentUser) return;
    const isAdding = !favorites.includes(id);
    const newFavorites = isAdding ? [...favorites, id] : favorites.filter(i => i !== id);
    setFavorites(newFavorites);

    const target = content.find(i => i.id === id);
    if (target) {
      userPreferenceStore.recordFavorite(target, isAdding, activeProfile?.id || 'default');
      recommendationEngine.invalidateCache();
      hybridRecommendationEngine.invalidateCache();
    }

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      await setDoc(doc(firestoreDb, 'keyValueStore', `zapitv_favorites_${currentUser.id}`), { value: newFavorites });
    } catch (error) {
      console.error("Error saving favorites:", error);
    }
  }, [favorites, currentUser, content, activeProfile?.id]);

  const toggleFavorite = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    return toggleFavoriteById(id);
  }, [toggleFavoriteById]);

  const updateUser = useCallback(async (updatedUser: User) => {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      const safeUser = withoutPlaintextPassword(updatedUser);
      await setDoc(doc(firestoreDb, 'users', safeUser.id), safeUser);
      setUsers(prev => prev.map(u => u.id === safeUser.id ? safeUser : u));
      if (currentUser.id === updatedUser.id) {
        setCurrentUser(safeUser);
        if (activeProfile) {
          const matchingProfile = updatedUser.profiles.find(p => p.id === activeProfile.id);
          if (matchingProfile) setActiveProfile(matchingProfile);
        }
      }
    } catch (error) {
      console.error("Error updating user:", error);
    }
  }, [currentUser.id, activeProfile]);

  const removeUndefined = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(removeUndefined);
    } else if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, removeUndefined(v)])
      );
    }
    return obj;
  };

  const handleUpdateContent = async (item: ContentItem) => {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      const cleanItem = removeUndefined(item);
      await setDoc(doc(firestoreDb, 'content', item.id), cleanItem);
      setContent(prev => prev.map(c => c.id === item.id ? item : c));
    } catch (error) {
      console.error("Error updating content:", error);
    }
  };

  // Handler para adicionar novo conteúdo (vindo do Hero)
  const handleAddContent = async (item: ContentItem) => {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      const cleanItem = removeUndefined(item);
      await setDoc(doc(firestoreDb, 'content', item.id), cleanItem);
      setContent(prev => [...prev, item]);
    } catch (error) {
      console.error("Error adding content:", error);
    }
  };

  const handleEditSectionTitle = async (key: keyof typeof sectionTitles) => {
    setSectionTitleSaveError('');
    setEditingSection({ key, title: sectionTitles[key] });
  };

  const saveSectionTitle = async () => {
    if (editingSection && editingSection.title.trim() !== "") {
      const newTitles = { ...sectionTitles, [editingSection.key]: editingSection.title };
      try {
        if (sectionTitlesQuery.isError || sectionTitlesQuery.isPending) {
          throw new Error('Não foi possível verificar o banco. Tente salvar novamente.');
        }
        if (sectionTitlesQuery.data.configured) {
          const saved = await saveSectionTitles(newTitles, sectionTitlesQuery.data.version);
          queryClient.setQueryData(['global-settings', 'section-titles'], saved);
        } else {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db: firestoreDb } = await import('./firebase');
          await setDoc(doc(firestoreDb, 'keyValueStore', 'zapitv_section_titles'), { value: newTitles });
        }
        await db.keyValueStore.put({ key: 'zapitv_section_titles', value: newTitles });
        await db.keyValueStore.put({ key: 'zapitv_section_titles_manual_v1', value: true });
        setSectionTitles(newTitles);
        setEditingSection(null);
      } catch (error) {
        console.error("Error saving section title:", error);
        setSectionTitleSaveError(error instanceof Error ? error.message : 'Não foi possível salvar o título.');
      }
    }
  };

  // Funções para Seções Customizadas
  const handleAddCustomSection = async (title: string, selectedItems: string[]) => {
    const newSection: CustomSection = {
      id: `cs-${Date.now()}`,
      title,
      items: selectedItems
    };
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      const cleanSection = removeUndefined(newSection);
      await setDoc(doc(firestoreDb, 'customSections', newSection.id), cleanSection);
      setCustomSections(prev => [...prev, newSection]);
    } catch (error) {
      console.error("Error adding custom section:", error);
    }
  };

  const handleDeleteCustomSection = async (id: string) => {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      await deleteDoc(doc(firestoreDb, 'customSections', id));
      setCustomSections(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error("Error deleting custom section:", error);
    }
  };

  const handleEditCustomSectionTitle = async (id: string) => {
    const section = customSections.find(s => s.id === id);
    if (section) {
      const newTitle = prompt("Novo título da seção:", section.title);
      if (newTitle && newTitle.trim()) {
        const updatedSection = { ...section, title: newTitle };
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db: firestoreDb } = await import('./firebase');
          const cleanSection = removeUndefined(updatedSection);
          await setDoc(doc(firestoreDb, 'customSections', id), cleanSection);
          setCustomSections(prev => prev.map(s => s.id === id ? updatedSection : s));
        } catch (error) {
          console.error("Error updating custom section:", error);
        }
      }
    }
  };

  const personalizedHomeRows = useMemo(() => {
    const allAvailable = deduplicateContentItems([
      ...trendingItems,
      ...popularMovies,
      ...popularSeries,
      ...animeItems,
      ...content
    ]);
    const cwItems = continueWatchingList.map(p => p.item);
    return hybridRecommendationEngine.getHybridHomeRows(
      allAvailable,
      activeProfile?.id || 'default',
      cwItems,
      activeProfile?.isChild === true,
      customSections
    );
  }, [trendingItems, popularMovies, popularSeries, animeItems, content, continueWatchingList, activeProfile?.id, activeProfile?.isChild, customSections, catalogEligibilityVersion]);

  const filteredContent = useMemo(() => {
    let baseFiltered = content;
    
    if (submittedSearchQuery.trim()) {
      const isAdultSearch = adultContentService.isIntentionalAdultSearch(submittedSearchQuery, content.map(i => i.title));
      const allowAdult = isAdultSearch && !activeProfile?.isChild && adultContentService.isAgeConfirmed(activeProfile?.id);

      if (liveSearchResults.length > 0) {
        const deduped = deduplicateContentItems(liveSearchResults);
        return catalogEligibilityService.filterEligibleItemsSync(deduped, { allowAdult });
      }
      const category = searchService.mapAppViewToCategory(currentView);
      const localMatches = searchService.filterLocalCatalog(submittedSearchQuery, category, baseFiltered, activeProfile);
      const deduped = deduplicateContentItems(localMatches);
      return catalogEligibilityService.filterEligibleItemsSync(deduped, { allowAdult });
    }

    // Para Filmes, Séries e Animes sem busca ativa, utiliza o Snapshot Estável de Navegação com Isolamento Total
    if (currentView === 'movies') {
      const currentSort = categorySorts.movies || 'recommended';
      const targetKey = getSnapshotKeyForView('movies', selectedGenre, currentSort);
      const cached = catalogSnapshots[targetKey];
      if (cached && cached.length > 0) {
        return deduplicateContentItems(cached);
      }
      const baseItems = getEligibleBrowseItems('movies', selectedGenre);
      const sorted = catalogSnapshotManager.createInitialSnapshot(baseItems, currentSort, {
        profileId: activeProfile?.id || 'default',
        isChild: activeProfile?.isChild === true,
        category: 'movies',
        genreFilter: selectedGenre
      });
      return deduplicateContentItems(sorted.filter(i => searchService.isMovieItem(i, false)));
    }

    if (currentView === 'series') {
      const currentSort = categorySorts.series || 'recommended';
      const targetKey = getSnapshotKeyForView('series', selectedGenre, currentSort);
      const cached = catalogSnapshots[targetKey];
      if (cached && cached.length > 0) {
        return deduplicateContentItems(cached);
      }
      const baseItems = getEligibleBrowseItems('series', selectedGenre);
      const sorted = catalogSnapshotManager.createInitialSnapshot(baseItems, currentSort, {
        profileId: activeProfile?.id || 'default',
        isChild: activeProfile?.isChild === true,
        category: 'series',
        genreFilter: selectedGenre
      });
      return deduplicateContentItems(sorted.filter(i => searchService.isSeriesItem(i)));
    }

    if (currentView === 'animes') {
      const currentSort = categorySorts.animes || 'recommended';
      const targetKey = getSnapshotKeyForView('animes', selectedGenre, currentSort);
      const cached = catalogSnapshots[targetKey];
      if (cached && cached.length > 0) {
        return deduplicateContentItems(cached);
      }
      const baseItems = getEligibleBrowseItems('animes', selectedGenre);
      const sorted = catalogSnapshotManager.createInitialSnapshot(baseItems, currentSort, {
        profileId: activeProfile?.id || 'default',
        isChild: activeProfile?.isChild === true,
        category: 'animes',
        genreFilter: selectedGenre
      });
      return deduplicateContentItems(sorted.filter(i => searchService.isAnimeItem(i)));
    }

    if (currentView === 'home' && (!selectedGenre || selectedGenre === 'Todos')) {
      return allowedContent;
    }

    if (currentView === 'featured') {
      const source = trendingItems.length > 0 ? trendingItems : baseFiltered;
      baseFiltered = source.filter(i => i.isFeatured);
    } else if (currentView === 'mylist') {
      baseFiltered = baseFiltered.filter(i => favoritesSet.has(i.id) || myListSet.has(i.id));
    }

    const isAdultGenre = selectedGenre === 'Adulto';
    if (selectedGenre && selectedGenre !== 'Todos') {
      if (isAdultGenre) {
        baseFiltered = baseFiltered.filter(i => adultContentService.isAdultContent(i));
      } else {
        baseFiltered = baseFiltered.filter(i => i.genres?.includes(selectedGenre) && !adultContentService.isAdultContent(i));
      }
    } else {
      // Ocultar por padrão: em 'Todos' ou sem filtro, oculta 100% de conteúdos adultos
      baseFiltered = baseFiltered.filter(i => !adultContentService.isAdultContent(i));
    }

    // Camada Central de Deduplicação Canônica e Elegibilidade Real
    const uniqueBase = deduplicateContentItems(baseFiltered);
    const eligible = catalogEligibilityService.filterEligibleItemsSync(uniqueBase, { allowAdult: isAdultGenre });

    return eligible;
  }, [
    catalogSnapshots, snapshotKey, currentView, categorySorts, selectedGenre,
    getEligibleBrowseItems, getSnapshotKeyForView, submittedSearchQuery, liveSearchResults, content,
    allowedContent, trendingItems, favoritesSet, myListSet, activeProfile?.id, activeProfile?.isChild,
    catalogEligibilityVersion
  ]);

  // Rolagem Infinita Automática Estabilizada (Infinite Scroll — revela lotes em memória instantaneamente e carrega mais da rede sob demanda)
  const visibleGridCountRef = useRef(visibleGridCount);
  visibleGridCountRef.current = visibleGridCount;

  const filteredContentLengthRef = useRef(filteredContent.length);
  filteredContentLengthRef.current = filteredContent.length;

  const hasMoreRemoteRef = useRef(false);
  hasMoreRemoteRef.current = currentView === 'movies' ? hasMoreMovies : currentView === 'series' ? hasMoreSeries : currentView === 'animes' ? hasMoreAnimes : false;

  const handleLoadMoreRef = useRef(handleLoadMore);
  handleLoadMoreRef.current = handleLoadMore;

  const isAdvancingRef = useRef(false);

  const advanceCatalogWindow = useCallback(() => {
    if (currentViewRef.current !== currentView) return;
    if (isLoadingMoreRef.current || isAdvancingRef.current) return;

    const count = visibleGridCountRef.current;
    const totalLocal = filteredContentLengthRef.current;
    const hasRemote = hasMoreRemoteRef.current;

    if (count >= totalLocal && !hasRemote) return;

    isAdvancingRef.current = true;
    try {
      if (count < totalLocal) {
        setVisibleGridCount(prev => prev + 42);
        if (count + 42 >= totalLocal && hasRemote && !isLoadingMoreRef.current) {
          handleLoadMoreRef.current(currentView);
        }
      } else if (hasRemote && !isLoadingMoreRef.current) {
        setVisibleGridCount(prev => prev + 42);
        handleLoadMoreRef.current(currentView);
      }
    } finally {
      setTimeout(() => {
        isAdvancingRef.current = false;
      }, 250);
    }
  }, [currentView]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    const isBrowseView = currentView === 'movies' || currentView === 'series' || currentView === 'animes';

    if (!isBrowseView) return;

    let observer: IntersectionObserver | null = null;
    let mountTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (typeof IntersectionObserver !== 'undefined' && sentinelRef.current) {
        observer = new IntersectionObserver((entries) => {
          const [entry] = entries;
          if (entry && entry.isIntersecting) {
            advanceCatalogWindow();
          }
        }, {
          root: scrollContainerRef.current || null,
          rootMargin: '600px',
          threshold: 0.01
        });
        observer.observe(sentinelRef.current);
      }
    }, 100);

    const handleScroll = () => {
      if (!scrollContainerRef.current || currentViewRef.current !== currentView) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 700) {
        advanceCatalogWindow();
      }
    };

    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    const handleWindowScroll = () => {
      if (currentViewRef.current !== currentView) return;
      const scrollPos = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.offsetHeight - 700;
      if (scrollPos >= threshold) {
        advanceCatalogWindow();
      }
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });

    return () => {
      if (mountTimer) clearTimeout(mountTimer);
      if (observer) observer.disconnect();
      if (container) container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [currentView, advanceCatalogWindow]);

  const renderContent = () => {
    const gridClass = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5 lg:gap-6 px-3 sm:px-6 md:px-12 max-w-[2560px] mx-auto";
    const headerClass = `flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 md:gap-7 pb-4 mb-6 md:mb-10 px-3 sm:px-6 md:px-12 max-w-[2560px] mx-auto border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`;
    const titleClass = `text-xl sm:text-2xl md:text-5xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`;
    const countClass = "text-xs md:text-sm font-bold opacity-50 uppercase tracking-widest mt-1 md:mt-2 block";
    const iconClass = "w-7 h-7 sm:w-10 sm:h-10 md:w-14 md:h-14 text-orange-600 shrink-0";

    if (submittedSearchQuery.trim() && currentView !== 'admin') {
      const category = searchService.mapAppViewToCategory(currentView);
      const emptyMsg = searchService.getEmptyMessage(category, submittedSearchQuery);

      return (
        <ViewWrapper>
          <div className="py-4 sm:py-6 md:py-8 pb-32">
             <div className={headerClass}>
               <div>
                 <h2 className={titleClass}>Busca: "{submittedSearchQuery}"</h2>
               </div>
             </div>

             {/* Seção de Artistas / Atores Encontrados (Fotos Circulares Oficiais) */}
             {liveSearchActors.length > 0 && (
               <div className="mb-8 sm:mb-10 px-3 sm:px-6 md:px-12 max-w-[2560px] mx-auto">
                 <div className="flex items-center gap-2 mb-3 sm:mb-4">
                   <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#007df7] px-3 py-1 rounded-full bg-[#007df7]/10 border border-[#007df7]/30 flex items-center gap-1.5">
                     <UserIcon className="w-3.5 h-3.5" />
                     Artistas Encontrados ({liveSearchActors.length})
                   </span>
                 </div>
                 <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
                   {liveSearchActors.map((actor) => (
                     <button
                       key={`search-actor-${actor.id}`}
                       onClick={() => {
                         navigate(`/atores/${actor.id}`);
                       }}
                       className={`flex flex-col items-center gap-2.5 p-3.5 rounded-2xl border transition-all cursor-pointer shrink-0 w-32 sm:w-36 group ${
                         isDarkMode 
                           ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-[#007df7]/60 shadow-lg' 
                           : 'bg-black/5 hover:bg-black/10 border-black/10 hover:border-[#007df7]/60 shadow-md'
                       }`}
                     >
                       {/* Foto oficial circular do ator */}
                       <img
                         src={actor.image}
                         alt={actor.name}
                         className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-[#007df7]/40 shadow-md group-hover:scale-105 transition-transform ring-2 ring-white/10"
                         onError={(e) => {
                           (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';
                         }}
                       />
                       <span className="font-bold text-xs text-white text-center line-clamp-1 group-hover:text-[#007df7] transition-colors">
                         {actor.name}
                       </span>
                       <span className="text-[10px] text-gray-400 -mt-1 font-medium truncate max-w-full">
                         {actor.knownForDepartment || 'Ator'}
                       </span>
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {filteredContent.length > 0 ? (
               <div className={gridClass}>
                  {filteredContent.map((item, idx) => (
                    <ContentCard 
                      key={`search-${item.imdbId || item.id}-${idx}`}
                      item={item}
                      isDarkMode={isDarkMode}
                      onItemClick={handleSelectContent}
                      isFavorite={favorites.includes(item.id)}
                      isInList={myList.includes(item.id)}
                      onToggleFavorite={toggleFavorite}
                      onToggleList={toggleMyList}
                    />
                  ))}
               </div>
             ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-gray-400 opacity-60" />
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-white mb-2">
                    {emptyMsg.title}
                  </p>
                  <p className="text-sm text-gray-400 max-w-md leading-relaxed">
                    {emptyMsg.subtitle}
                  </p>
                </div>
             )}
          </div>
        </ViewWrapper>
      );
    }

    switch (currentView) {
      case 'home':
        return (
          <ViewWrapper>
            <div className="pb-12">
              <div className="px-3 sm:px-6 md:px-12 pt-4 sm:pt-6 max-w-[2560px] mx-auto">
                <Hero 
                  featuredItems={heroCarouselItems.length > 0 ? heroCarouselItems : heroCarouselStore.getCarouselItems(content)} 
                  isDarkMode={isDarkMode} 
                  onActionClick={handleSelectContent} 
                  onPlayClick={handlePlayFromHero}
                  isAdmin={currentUser.role === 'admin' || currentUser.devMode}
                  onUpdateItem={handleUpdateContent}
                  onAddContent={handleAddContent}
                  onSaveCarousel={async (newItems) => {
                    if (heroCarouselQuery.isError || heroCarouselQuery.isPending) {
                      throw new Error('Não foi possível verificar o banco. Tente salvar novamente.');
                    }
                    if (heroCarouselQuery.data.configured) {
                      const saved = await saveHeroCarousel(newItems, heroCarouselQuery.data.version);
                      queryClient.setQueryData(['global-settings', 'hero-carousel'], saved);
                    }
                    heroCarouselStore.saveCarouselItems(newItems);
                    setHeroCarouselItems(newItems);
                  }}
                />
              </div>
              <div className="space-y-4">
                {/* Fileiras Personalizadas Ponderadas pelo Motor de Recomendações */}
                {personalizedHomeRows.map((row) => (
                  <ContentRow 
                    key={`rec-row-${row.id}`}
                    title={row.title}
                    subtitle={row.subtitle}
                    items={catalogEligibilityService.filterEligibleItemsSync(row.items)}
                    isDarkMode={isDarkMode}
                    onItemClick={handleSelectContent}
                    myList={myList}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onToggleList={toggleMyList}
                    isAdmin={currentUser.role === 'admin'}
                  />
                ))}

                {/* Seções Customizadas */}
                {customSections.map(section => {
                  const sectionItems = content.filter(item => section.items.includes(item.id));
                  if (sectionItems.length === 0) return null;
                  return (
                    <ContentRow 
                      key={section.id}
                      title={section.title}
                      items={catalogEligibilityService.filterEligibleItemsSync(sectionItems)}
                      isDarkMode={isDarkMode}
                      onItemClick={handleSelectContent}
                      myList={myList}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                      onToggleList={toggleMyList}
                      isAdmin={currentUser.role === 'admin'}
                      onEditTitle={() => handleEditCustomSectionTitle(section.id)}
                      onDeleteSection={() => handleDeleteCustomSection(section.id)}
                    />
                  );
                })}

                {/* Botão Adicionar Seção (Apenas Admin) */}
                {currentUser.role === 'admin' && (
                  <div className="flex justify-center py-10 px-4 md:px-12">
                    <button 
                      onClick={() => setIsAddSectionModalOpen(true)}
                      className={`w-full max-w-4xl py-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all group ${
                        isDarkMode 
                          ? 'border-gray-800 hover:border-orange-600 bg-white/5 hover:bg-orange-600/10' 
                          : 'border-gray-300 hover:border-orange-600 bg-gray-50 hover:bg-orange-50'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className={`font-black text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Adicionar Nova Seção</p>
                        <p className="text-sm text-gray-500">Crie uma lista personalizada de filmes ou séries</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </ViewWrapper>
        );
      case 'featured': {
        const rawMovies = featuredSelection?.featuredMovies || [];
        const rawSeries = featuredSelection?.featuredSeries || [];
        const rawAnimes = featuredSelection?.featuredAnimes || [];

        const eligibleMovies = catalogEligibilityService.filterEligibleItemsSync(
          deduplicateContentItems(rawMovies.filter(it => searchService.isMovieItem(it)))
        );
        const eligibleSeries = catalogEligibilityService.filterEligibleItemsSync(
          deduplicateContentItems(rawSeries.filter(it => searchService.isSeriesItem(it) && !searchService.isAnimeItem(it)))
        );
        const eligibleAnimes = catalogEligibilityService.filterEligibleItemsSync(
          deduplicateContentItems(rawAnimes.filter(it => searchService.isAnimeItem(it)))
        );

        // Associa cada obra ao seu rank real (1 a 10) no Top 10 oficial
        const top10MoviesWithRank = eligibleMovies.slice(0, 10).map((item, idx) => ({
          item,
          rank: idx + 1
        }));

        const top10SeriesWithRank = eligibleSeries.slice(0, 10).map((item, idx) => ({
          item,
          rank: idx + 1
        }));

        const top10AnimesWithRank = eligibleAnimes.slice(0, 10).map((item, idx) => ({
          item,
          rank: idx + 1
        }));

        // Preserva a classificação original dos títulos restantes mesmo com lacunas por gênero/busca
        const displayMovies = top10MoviesWithRank
          .filter(({ item }) => !selectedGenre || selectedGenre === 'Todos' || item.genres?.includes(selectedGenre))
          .filter(({ item }) => !submittedSearchQuery || item.title.toLowerCase().includes(submittedSearchQuery.toLowerCase()));

        const displaySeries = top10SeriesWithRank
          .filter(({ item }) => !selectedGenre || selectedGenre === 'Todos' || item.genres?.includes(selectedGenre))
          .filter(({ item }) => !submittedSearchQuery || item.title.toLowerCase().includes(submittedSearchQuery.toLowerCase()));

        const displayAnimes = top10AnimesWithRank
          .filter(({ item }) => !selectedGenre || selectedGenre === 'Todos' || item.genres?.includes(selectedGenre))
          .filter(({ item }) => !submittedSearchQuery || item.title.toLowerCase().includes(submittedSearchQuery.toLowerCase()));

        const monthlyStatusLabel = featuredSelection?.monthlyStatusLabel || (featuredSelection?.monthLabel ? `${featuredSelection.monthLabel} · Parcial` : 'Mês Atual · Parcial');

        return (
          <ViewWrapper>
            <div className="px-3 sm:px-6 md:px-12 py-6 sm:py-8 pb-32 space-y-10 sm:space-y-14 md:space-y-18 max-w-[2560px] mx-auto">
              {/* Cabeçalho Principal da Página Em Destaque */}
              <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 md:gap-7 pb-4 border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <h2 className={titleClass}>
                    Em Destaque
                  </h2>
                  <span className="text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-md bg-[#007df7]/15 text-[#007df7] border border-[#007df7]/30 tracking-wide">
                    {monthlyStatusLabel}
                  </span>
                  <GenreDropdown genres={availableGenres} selectedGenre={selectedGenre} onSelect={handleSelectGenre} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* SEÇÃO 1: TOP 10 FILMES DO MÊS (CARROSSEL HORIZONTAL RANKING) */}
              <FeaturedRankedCarousel
                title="Top 10 Filmes do Mês"
                subtitle={`${monthlyStatusLabel} · Filmes mais populares e aclamados`}
                icon={Film}
                iconColor="#007df7"
                items={displayMovies}
                isDarkMode={isDarkMode}
                onItemClick={handleSelectContent}
                favorites={favorites}
                myList={myList}
                onToggleFavorite={toggleFavorite}
                onToggleList={toggleMyList}
                emptyMessage="Nenhum filme em destaque corresponde ao filtro selecionado."
              />

              {/* SEÇÃO 2: TOP 10 SÉRIES DO MÊS (CARROSSEL HORIZONTAL RANKING) */}
              <FeaturedRankedCarousel
                title="Top 10 Séries do Mês"
                subtitle={`${monthlyStatusLabel} · Séries mais assistidas e aclamadas`}
                icon={Tv}
                iconColor="#c084fc"
                items={displaySeries}
                isDarkMode={isDarkMode}
                onItemClick={handleSelectContent}
                favorites={favorites}
                myList={myList}
                onToggleFavorite={toggleFavorite}
                onToggleList={toggleMyList}
                emptyMessage="Nenhuma série em destaque corresponde ao filtro selecionado."
              />

              {/* SEÇÃO 3: TOP 10 ANIMES DO MÊS (CARROSSEL HORIZONTAL RANKING) */}
              <FeaturedRankedCarousel
                title="Top 10 Animes do Mês"
                subtitle={`${monthlyStatusLabel} · Animes mais populares e tendências da temporada`}
                icon={Flame}
                iconColor="#06b6d4"
                items={displayAnimes}
                isDarkMode={isDarkMode}
                onItemClick={handleSelectContent}
                favorites={favorites}
                myList={myList}
                onToggleFavorite={toggleFavorite}
                onToggleList={toggleMyList}
                emptyMessage="Nenhum anime em destaque corresponde ao filtro selecionado."
              />
            </div>
          </ViewWrapper>
        );
      }
      case 'movies':
      case 'series':
      case 'animes':
        return (
          <ViewWrapper key={`view-wrapper-${currentView}`}>
            <div className="px-3 sm:px-6 md:px-12 py-6 sm:py-8 pb-32 max-w-[2560px] mx-auto">
              <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 md:gap-7 pb-4 mb-6 sm:mb-8 md:mb-12 border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <h2 className={titleClass}>
                    {currentView === 'movies' ? 'Filmes' : 
                     currentView === 'series' ? 'Séries' : 'Animes'}
                  </h2>
                  <GenreDropdown genres={availableGenres} selectedGenre={selectedGenre} onSelect={handleSelectGenre} isDarkMode={isDarkMode} />
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <SortDropdown 
                    selectedSort={currentCategorySort} 
                    onSelect={handleSelectSort} 
                    onSelectSort={handleSelectSort} 
                    isDarkMode={isDarkMode} 
                  />
                </div>
              </div>
              <VirtualizedCatalogGrid 
                items={filteredContent.slice(0, visibleGridCount)}
                isDarkMode={isDarkMode}
                onItemClick={handleSelectContent}
                favoritesSet={favoritesSet}
                myListSet={myListSet}
                onToggleFavorite={toggleFavorite}
                onToggleList={toggleMyList}
                currentView={currentView}
                scrollContainerRef={scrollContainerRef}
              />

              {/* Sentinela de Rolagem Infinita (Carrega mais conteúdos automaticamente conforme o usuário desce) */}
              {(visibleGridCount < filteredContent.length || (currentView === 'movies' ? hasMoreMovies : currentView === 'series' ? hasMoreSeries : currentView === 'animes' ? hasMoreAnimes : false)) && (
                <div ref={sentinelRef} className="flex justify-center py-12 min-h-[64px] select-none">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-bold shadow-lg backdrop-blur-md animate-in fade-in duration-200">
                      <ZapiLoader size="sm" />
                      <span>Carregando mais conteúdos...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ViewWrapper>
        );
      case 'programas':
        return <ViewWrapper><ProgramasView isDarkMode={isDarkMode} /></ViewWrapper>;
      case 'mylist':
        return (
          <ViewWrapper>
            <div className="px-3 sm:px-6 md:px-12 py-6 sm:py-8 pb-32 max-w-[2560px] mx-auto">
              <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 md:gap-7 pb-4 mb-6 sm:mb-8 md:mb-12 border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
                <div>
                  <h2 className={titleClass}>Minha Lista</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                {catalogEligibilityService.filterEligibleItemsSync(content.filter(i => myList.includes(i.id))).map(item => (
                  <ContentCard 
                    key={item.id}
                    item={item}
                    isDarkMode={isDarkMode}
                    onItemClick={handleSelectContent}
                    isFavorite={favorites.includes(item.id)}
                    isInList={myList.includes(item.id)}
                    onToggleFavorite={toggleFavorite}
                    onToggleList={toggleMyList}
                  />
                ))}
              </div>
            </div>
          </ViewWrapper>
        );
      case 'admin':
        return <ViewWrapper><AdminView isDarkMode={isDarkMode} users={users} onDeleteUser={async (id) => {
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const { db: firestoreDb } = await import('./firebase');
            await deleteDoc(doc(firestoreDb, 'users', id));
            setUsers(u => u.filter(x => x.id !== id));
          } catch (error) {
            console.error("Error deleting user:", error);
          }
        }} onUpdateUser={async (user) => {
          await updateUser(user);
        }} content={content} onAddContent={handleAddContent} onUpdateContent={handleUpdateContent} onDeleteContent={async (id) => {
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const { db: firestoreDb } = await import('./firebase');
            await deleteDoc(doc(firestoreDb, 'content', id));
            setContent(prev => prev.filter(c => c.id !== id));
          } catch (error) {
            console.error("Error deleting content:", error);
          }
        }} onSendGlobalNotification={async (n) => {
          try {
            const { doc, setDoc } = await import('firebase/firestore');
            const { db: firestoreDb } = await import('./firebase');
            await setDoc(doc(firestoreDb, 'notifications', n.id), n);
            setSiteNotifications(prev => [n, ...prev]);
          } catch (error) {
            console.error("Error sending notification:", error);
          }
        }} onClearNotifications={async () => {
          try {
            const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
            const { db: firestoreDb } = await import('./firebase');
            const snapshot = await getDocs(collection(firestoreDb, 'notifications'));
            snapshot.forEach(async (d) => {
              await deleteDoc(doc(firestoreDb, 'notifications', d.id));
            });
            setSiteNotifications([]);
          } catch (error) {
            console.error("Error clearing notifications:", error);
          }
        }} /></ViewWrapper>;
      case 'profile': return <ViewWrapper><ProfileView user={currentUser} isDarkMode={isDarkMode} onLogout={handleLogout} onUpdateUser={updateUser} onNavigate={setCurrentView} /></ViewWrapper>;
      case 'settings':
        return (
          <ViewWrapper>
            <SettingsView 
              isDarkMode={isDarkMode} 
              setIsDarkMode={setIsDarkMode} 
              user={currentUser} 
              onUpdateUser={updateUser} 
              onNavigate={setCurrentView} 
              onLogout={handleLogout} 
              notifications={siteNotifications} 
            />
          </ViewWrapper>
        );

      case 'help': return <ViewWrapper><HelpView isDarkMode={isDarkMode} onNavigate={setCurrentView} /></ViewWrapper>;
      case 'actor':
        return (
          <ViewWrapper>
            <ActorView
              actorId={activeActorId || ''}
              isDarkMode={isDarkMode}
              onSelectContent={handleSelectContent}
              favorites={favorites}
              myList={myList}
              toggleFavorite={toggleFavorite}
              toggleMyList={toggleMyList}
              activeProfile={activeProfile}
              onBack={() => navigate(-1)}
            />
          </ViewWrapper>
        );
      case 'explore':
        navigate('/filmes', { replace: true });
        return null;
      case 'search':
        navigate('/', { replace: true });
        return null;
      case 'my-zapitv':
        navigate('/perfil', { replace: true });
        return null;
      case 'notfound':
      default:
        return <ViewWrapper><NotFoundPage isDarkMode={isDarkMode} /></ViewWrapper>;
    }
  };

  const viewContent = useMemo(() => isWatchRoute ? null : renderContent(), [
    isWatchRoute, currentView, submittedSearchQuery, liveSearchActors, activeActorId, isDarkMode, favorites, myList, selectedGenre,
    currentUser, activeProfile, users, content, sectionTitles, customSections,
    filteredContent, visibleGridCount, trendingItems, popularMovies, popularSeries, animeItems,
    topRatedItems, featuredSelection, continueWatchingList, isLoadingMore,
    hasMoreMovies, hasMoreSeries, hasMoreAnimes, handlePlayFromHero
  ]);

  if (!isAuthenticated) return <React.Suspense fallback={<ZapiLoader size="xl" />}><AuthView isDarkMode={isDarkMode} onLogin={handleLogin} onSignup={handleSignup} onResetPassword={handleResetPassword} users={users} initialEmail={initialState.lastEmail} /></React.Suspense>;

  if (!activeProfile || currentView === 'profile-selector') {
    return (
      <React.Suspense fallback={<ZapiLoader size="xl" />}><ProfileSelectorView
        user={currentUser} 
        onSelectProfile={(p) => { 
          setActiveProfile(p); 
          setCurrentView('home'); 
        }} 
        onUpdateUser={updateUser} 
        isDarkMode={isDarkMode} 
      /></React.Suspense>
    );
  }

  if (location.pathname.startsWith('/tv')) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-[#05070a] flex items-center justify-center"><ZapiLoader size="xl" /></div>}>
        <TvApp
          content={allowedContent}
          trendingItems={trendingItems}
          popularMovies={popularMovies}
          popularSeries={popularSeries}
          animeItems={animeItems}
          featuredItems={heroCarouselItems.length > 0 ? heroCarouselItems : heroCarouselStore.getCarouselItems(allowedContent)}
          myList={myList}
          favorites={favorites}
          onToggleList={toggleMyList}
          onToggleFavorite={toggleFavorite}
          onToggleListById={toggleMyListById}
          onToggleFavoriteById={toggleFavoriteById}
          currentUser={currentUser}
          activeProfile={activeProfile}
        />
      </React.Suspense>
    );
  }

  return (
    <div className={`min-h-screen relative ${isWatchRoute ? 'zapi-watch-route bg-black' : ''}`}>
      <AnimatedBackground isDarkMode={isDarkMode} />
      
      {isMobileViewport && !isWatchRoute ? (
        <MobileLayout
          currentView={currentView}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          currentUser={currentUser}
          activeProfile={activeProfile}
          onSwitchProfile={() => { setActiveProfile(null); handleNavigateView('profile-selector'); }}
          onSelectProfile={(p) => { setActiveProfile(p); handleNavigateView('home'); }}
          onLogout={handleLogout}
          notifications={siteNotifications}
          onSelectContent={handleSelectContent}
          onPlayClick={handlePlayFromHero}
          allContent={allowedContent}
          myList={myList}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onToggleList={toggleMyList}
          heroItems={heroCarouselItems.length > 0 ? heroCarouselItems : heroCarouselStore.getCarouselItems(content)}
          trendingItems={trendingItems}
          personalizedRows={personalizedHomeRows}
          featuredSelection={featuredSelection}
          onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
          hasOpenModal={Boolean(selectedContent || isDiagnosticModalOpen)}
          onCloseModal={() => {
            if (selectedContent) handleCloseDetailModal();
            else if (isDiagnosticModalOpen) setIsDiagnosticModalOpen(false);
          }}
        />
      ) : (
        <>
          <Sidebar 
            currentView={currentView} 
            setCurrentView={(view) => {
              searchService.cancelPending();
              setCurrentView(view);
              setIsMobileMenuOpen(false);
              setSelectedGenre(''); 
              setSearchQuery('');
              setSubmittedSearchQuery('');
              setLiveSearchResults([]);
            }} 
            isDarkMode={isDarkMode} 
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => {
              uiSoundService.play(isSidebarCollapsed ? 'sidebarOpen' : 'sidebarClose');
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }}
            isMobileMenuOpen={isMobileMenuOpen}
            onToggleMobileMenu={() => {
              uiSoundService.play(isMobileMenuOpen ? 'sidebarClose' : 'sidebarOpen');
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }}
            activeProfile={activeProfile}
          />
          
          <main className={`transition-[margin] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[margin] ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} min-h-screen flex flex-col relative z-10`}>
            <Header 
              isDarkMode={isDarkMode} 
              setIsDarkMode={setIsDarkMode} 
              currentUser={currentUser} 
              activeProfile={activeProfile}
              currentView={currentView}
              setCurrentView={(view) => {
                searchService.cancelPending();
                setCurrentView(view);
                setSearchQuery('');
                setSubmittedSearchQuery('');
                setLiveSearchResults([]);
              }} 
              onSwitchProfile={() => { setActiveProfile(null); setCurrentView('profile-selector'); }}
              onSelectProfile={(p) => { setActiveProfile(p); setCurrentView('home'); }}
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery}
              onSearchSubmit={(q) => {
                searchHistoryService.addSearch(q);
                setSubmittedSearchQuery(q);
              }}
              onClearSearch={() => {
                setSubmittedSearchQuery('');
                setLiveSearchResults([]);
              }}
              onSelectContent={handleSelectContent}
              allContent={content}
              notifications={siteNotifications}
              onLogout={handleLogout}
              onToggleMobileMenu={() => {
                if (!isMobileMenuOpen) uiSoundService.play('sidebarOpen');
                setIsMobileMenuOpen(true);
              }}
              onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
            />
            
            <ScrollToTop 
              dependency={`${currentView}-${submittedSearchQuery}`} 
              currentView={currentView}
              searchQuery={submittedSearchQuery}
              targetRef={scrollContainerRef} 
            />

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar pb-20 scroll-smooth transform-gpu">
              {isCatalogLoading && trendingItems.length === 0 ? (
                <div key="catalog-initial-loader" className="min-h-[75vh] flex flex-col items-center justify-center select-none">
                  <ZapiLoader size="xl" />
                </div>
              ) : (
                <div key={`active-view-${submittedSearchQuery ? 'search' : currentView}`}>
                  <React.Suspense fallback={<div className="min-h-[75vh] flex items-center justify-center"><ZapiLoader size="xl" /></div>}>
                    {viewContent}
                  </React.Suspense>
                </div>
              )}
            </div>
          </main>
        </>
      )}

      {/* Admin Button (Floating) */}
      {currentUser.role === 'admin' && !isMobileViewport && (
        <button 
          onClick={() => {
            if (currentView === 'admin') {
              handleNavigateView(previousView === 'admin' ? 'home' : previousView);
            } else {
              handleNavigateView('admin');
            }
          }} 
          className="fixed bottom-8 right-8 z-50 w-16 h-16 rounded-2xl bg-orange-600 text-white shadow-2xl transition-transform hover:scale-110 active:scale-95 flex items-center justify-center transform-gpu"
        >
          <ShieldCheck className="w-8 h-8" />
        </button>
      )}

      {/* Modal Edição Título Seção Padrão */}
      {editingSection && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl ${isDarkMode ? 'bg-[#151C26] border border-gray-800' : 'bg-white'}`}>
              <h3 className={`text-xl font-black mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Editar Título da Seção</h3>
              <input 
                autoFocus
                type="text" 
                value={editingSection.title} 
                onChange={(e) => setEditingSection({...editingSection, title: e.target.value})} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveSectionTitle();
                  if (e.key === 'Escape') setEditingSection(null);
                }}
                className={`w-full p-4 rounded-xl border outline-none font-bold mb-6 ${isDarkMode ? 'bg-black/20 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
              />
              {sectionTitleSaveError && <p role="alert" className="text-sm text-red-400 mb-4">{sectionTitleSaveError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setEditingSection(null)} className="flex-1 py-3 font-bold rounded-xl bg-transparent border border-gray-500/30 text-gray-500 hover:bg-gray-500/10">Cancelar</button>
                <button onClick={saveSectionTitle} className="flex-1 py-3 font-bold rounded-xl bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-600/20">Salvar</button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Adicionar Seção Customizada */}
      {isAddSectionModalOpen && <React.Suspense fallback={null}><AddSectionModal
        isOpen={isAddSectionModalOpen}
        onClose={() => setIsAddSectionModalOpen(false)}
        onSave={handleAddCustomSection}
        allContent={content}
        genres={GENRES_LIST}
        isDarkMode={isDarkMode}
      /></React.Suspense>}

      {/* Modal de Diagnóstico e Saúde do Catálogo */}
      {isDiagnosticModalOpen && <React.Suspense fallback={null}><CatalogDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        isDarkMode={isDarkMode}
      /></React.Suspense>}

      {/* Modal de Confirmação de Maioridade (+18) e Proteção Parental */}
      <AgeVerificationModal
        isOpen={isAgeVerificationOpen}
        isDarkMode={isDarkMode}
        profileId={activeProfile?.id}
        isChild={activeProfile?.isChild}
        onConfirm={handleConfirmAge}
        onCancel={handleCancelAge}
      />

      {selectedContent && (!isWatchRoute || ((selectedContent.id === parsedWatch.id || selectedContent.imdbId === parsedWatch.id || selectedContent.tmdbId === parsedWatch.id) && getWatchRoute(selectedContent).split('/')[2] === (parsedWatch.mediaType === 'movie' ? 'filme' : parsedWatch.mediaType === 'anime' ? 'anime' : 'serie'))) && (
        <React.Suspense fallback={<div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"><ZapiLoader size="xl" /></div>}><ContentDetailModal
          item={selectedContent} 
          onClose={handleCloseDetailModal} 
          isDarkMode={isDarkMode}
          myList={myList}
          favorites={favorites}
          onToggleList={toggleMyList}
          onToggleFavorite={toggleFavorite}
          allContent={allowedContent}
          initialSeason={effectiveSeasonNum}
          initialEpisode={effectiveEpisodeNum}
          autoPlayInitialEpisode={effectiveAutoPlay}
          playerOnly={isWatchRoute}
          originRoute={detailOriginRouteRef.current}
        /></React.Suspense>
      )}

      {isWatchRoute && (!selectedContent || (selectedContent.id !== parsedWatch.id && selectedContent.imdbId !== parsedWatch.id && selectedContent.tmdbId !== parsedWatch.id) || getWatchRoute(selectedContent).split('/')[2] !== (parsedWatch.mediaType === 'movie' ? 'filme' : parsedWatch.mediaType === 'anime' ? 'anime' : 'serie')) && (
        <div className="zapi-watch-surface fixed inset-0 z-[2000] flex items-center justify-center bg-black text-white">
          {watchRouteNotFound ? <div className="text-center"><p>Conteúdo não encontrado ou indisponível.</p><button className="mt-5 rounded-lg bg-[#007df7] px-5 py-2" onClick={() => navigate('/', { replace: true })}>Voltar ao início</button></div> : <ZapiLoader size="xl" />}
        </div>
      )}

      {/* Modal de Entrada Direta em Watch Party por Link (/sala/:roomId) */}
      {showDirectWatchPartyModal && watchPartyRoomId && (
        <FeatureErrorBoundary featureName="a Watch Party" closeLabel="Voltar ao início" onClose={() => {
          setShowDirectWatchPartyModal(false);
          navigate('/', { replace: true });
        }}>
          <React.Suspense fallback={null}>
            <WatchPartyModal
            isOpen={showDirectWatchPartyModal}
            initialRoomId={watchPartyRoomId}
            currentProfileName={activeProfile?.name || currentUser?.name || 'Convidado'}
            onClose={() => {
              setShowDirectWatchPartyModal(false);
              if (location.pathname.startsWith('/sala')) {
                navigate('/', { replace: true });
              }
            }}
            onStartWatchPartyPlayback={async (synthItem, targetSeason, targetEpisode) => {
              let existing = content.find(candidate => matchesRoomMedia(candidate, synthItem));

              if (!existing) {
                try {
                  if (synthItem.imdbId) {
                    const found = await tmdbService.findByImdb(synthItem.imdbId);
                    if (found && matchesRoomMedia(found, synthItem)) existing = found;
                  }
                  if (!existing && synthItem.tmdbId) {
                    const found = await tmdbService.getDetails(synthItem.tmdbId, roomMediaType(synthItem), roomMediaFormat(synthItem));
                    if (found?.item && matchesRoomMedia(found.item, synthItem)) existing = found.item;
                  }
                } catch (e) {
                  console.warn('[WatchParty] Erro ao resolver mídia do TMDB:', e);
                }
              }

              if (!existing) return false;
              setShowDirectWatchPartyModal(false);
              setDirectPartyEpisode({ season: targetSeason, episode: targetEpisode });
              setSelectedContent(existing);
              return true;
            }}
            />
          </React.Suspense>
        </FeatureErrorBoundary>
      )}

      <TvRemoteDiagnosticOverlay />
    </div>
  );
};

export default App;
