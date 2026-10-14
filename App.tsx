
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams, matchPath } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Hero from './components/Hero';
import ContentRow from './components/ContentRow';
import ContentCard from './components/ContentCard';
import ProfileView from './components/ProfileView';
import AdminView from './components/AdminView';
import SettingsView from './components/SettingsView';
import HelpView from './components/HelpView';
import ContentDetailModal from './components/ContentDetailModal';
import AnimatedBackground from './components/AnimatedBackground';
import AuthView from './components/AuthView';
import ScrollToTop from './components/ScrollToTop';
import GenreDropdown from './components/GenreDropdown';
import ProfileSelectorView from './components/ProfileSelectorView';
import AddSectionModal from './components/AddSectionModal';
import ProgramasView from './components/ProgramasView';
import { NotFoundPage } from './src/pages/NotFoundPage';
import { DownloadsPage } from './src/pages/DownloadsPage';
import { getContentRoute, ROUTES } from './src/core/routes/navigationRoutes';
import { AppView, User, ContentType, ContentItem, SiteNotification, Profile, CustomSection } from './types';
import { MOCK_USERS, AVATARS, filmesData } from './constants';
import { ShieldCheck, Flame, Film, Tv, List, Search, Sparkles, Plus, RefreshCw, Activity } from 'lucide-react';

import { db } from './db';
import { tmdbService } from './src/core/tmdb/tmdbClient';
import { storageService, WatchProgress } from './src/core/storage/storageService';
import { VERIFIED_OPEN_ITEMS } from './src/core/catalog/verifiedCatalog';
import { ZapiLoader } from './src/components/common/ZapiLoader';
import { catalogDiscoveryService } from './src/core/catalog/CatalogDiscoveryService';
import { mediaAvailabilityIndex } from './src/core/catalog/MediaAvailabilityIndex';
import { catalogAvailabilityQueue } from './src/core/catalog/CatalogAvailabilityQueue';
import { CatalogDiagnosticModal } from './src/components/catalog/CatalogDiagnosticModal';
import { theatricalFilterService } from './src/core/catalog/theatricalFilterService';
import { catalogEligibilityService } from './src/core/catalog/CatalogEligibilityService';
import { searchService } from './src/core/search/searchService';
import { featuredRankingService } from './src/core/rankings/FeaturedRankingService';
import { FeaturedSelectionResult } from './src/core/rankings/featuredRankingTypes';

const GENRES_LIST = [
  'Ação', 'Animação', 'Anime', 'Aventura', 'Biografia', 'Comédia', 
  'Documentários', 'Drama', 'Fantasia', 'Faroeste', 'Ficção Científica', 
  'Guerra', 'Histórico', 'Infantil / Família', 'Mistério', 'Musical', 
  'Policial', 'Premiados', 'Reality Show', 'Religioso', 'Romance', 
  'Suspense', 'Terror'
];

const ViewWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="animate-in fade-in duration-500 fill-mode-both transform-gpu">
    {children}
  </div>
);

const App: React.FC<{ initialState: any }> = ({ initialState }) => {
  const [users, setUsers] = useState<User[]>(() => {
    try {
      let parsedUsers = initialState.users;
      if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) parsedUsers = [];

      // MERGE STRATEGY: 
      // Garante que os MOCK_USERS essenciais existam e tenham as credenciais mais recentes (senha '123'),
      // sobrescrevendo dados antigos do localStorage para esses IDs específicos.
      const mergedUsers = [...parsedUsers];
      
      MOCK_USERS.forEach(mockUser => {
        const index = mergedUsers.findIndex(u => u.id === mockUser.id);
        if (index !== -1) {
          // Força a atualização de senha e email para garantir o login
          mergedUsers[index] = { 
            ...mergedUsers[index], 
            password: mockUser.password, // Garante que a senha é '123'
            email: mockUser.email,       // Garante que o email está correto
            // Mantém perfis se o usuário já os customizou, senão usa o mock
            profiles: (mergedUsers[index].profiles && mergedUsers[index].profiles.length > 0) ? mergedUsers[index].profiles : mockUser.profiles 
          };
        } else {
          mergedUsers.push(mockUser);
        }
      });
      
      return mergedUsers;
    } catch { return MOCK_USERS; }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => initialState.auth);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const user = initialState.currentUser;
    if (user) {
      const mockUser = MOCK_USERS.find(m => m.id === user.id);
      return { 
        ...user, 
        profiles: (user.profiles && user.profiles.length > 0) ? user.profiles : (mockUser?.profiles || [])
      };
    }
    return user as User;
  });
  const [activeProfile, setActiveProfile] = useState<Profile | null>(() => initialState.activeProfile || currentUser?.profiles?.[0] || null);

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Matchers para rotas de detalhes e episódios
  const matchMovieDetail = matchPath('/filmes/:id', location.pathname);
  const matchSeriesEpisode = matchPath('/series/:id/temporada/:season/episodio/:episode', location.pathname);
  const matchSeriesDetail = matchPath('/series/:id', location.pathname);
  const matchAnimeEpisode = matchPath('/animes/:id/temporada/:season/episodio/:episode', location.pathname);
  const matchAnimeDetail = matchPath('/animes/:id', location.pathname);

  // Derivação automática da view com base no pathname
  const currentView: AppView = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/em-destaque')) return 'featured';
    if (path.startsWith('/filmes')) return 'movies';
    if (path.startsWith('/series')) return 'series';
    if (path.startsWith('/animes')) return 'animes';
    if (path === '/programas' || path.startsWith('/televisao')) return 'programas';
    if (path.startsWith('/downloads')) return 'downloads';
    if (path.startsWith('/minha-lista')) return 'mylist';
    if (path.startsWith('/historico')) return 'profile';
    if (path.startsWith('/perfil-selector')) return 'profile-selector';
    if (path.startsWith('/perfil')) return 'profile';
    if (path.startsWith('/configuracoes')) return 'settings';
    if (path.startsWith('/ajuda')) return 'help';
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/login') || path.startsWith('/auth')) return 'login';
    return 'notfound';
  }, [location.pathname]);

  const [previousView, setPreviousView] = useState<AppView>('home');
  useEffect(() => {
    if (currentView !== 'admin' && currentView !== 'notfound') {
      setPreviousView(currentView);
    }
  }, [currentView]);

  const activeDetailId = matchSeriesEpisode?.params.id ||
                         matchSeriesDetail?.params.id ||
                         matchAnimeEpisode?.params.id ||
                         matchAnimeDetail?.params.id ||
                         matchMovieDetail?.params.id;

  const urlSeason = matchSeriesEpisode?.params.season || matchAnimeEpisode?.params.season;
  const urlEpisode = matchSeriesEpisode?.params.episode || matchAnimeEpisode?.params.episode;
  const initialSeasonNum = urlSeason ? parseInt(urlSeason, 10) : undefined;
  const initialEpisodeNum = urlEpisode ? parseInt(urlEpisode, 10) : undefined;
  const hasDeepLinkEpisode = initialEpisodeNum !== undefined;

  const handleNavigateView = useCallback((view: AppView) => {
    setSelectedContent(null);
    searchService.cancelPending();
    setIsMobileMenuOpen(false);
    setSelectedGenre('');
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setLiveSearchResults([]);

    switch (view) {
      case 'home': navigate('/'); break;
      case 'featured': navigate('/em-destaque'); break;
      case 'movies': navigate('/filmes'); break;
      case 'series': navigate('/series'); break;
      case 'animes': navigate('/animes'); break;
      case 'programas':
      case 'television':
      case 'live': navigate('/programas'); break;
      case 'downloads': navigate('/downloads'); break;
      case 'mylist': navigate('/minha-lista'); break;
      case 'history': navigate('/perfil'); break;
      case 'profile': navigate('/perfil'); break;
      case 'settings': navigate('/configuracoes'); break;
      case 'help': navigate('/ajuda'); break;
      case 'admin': navigate('/admin'); break;
      case 'login':
      case 'signup': navigate('/login'); break;
      case 'profile-selector': navigate('/perfil-selector'); break;
      default: navigate('/'); break;
    }
  }, [navigate]);

  const setCurrentView = handleNavigateView;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => initialState.theme);

  // Estado para títulos das seções padrão
  const [sectionTitles, setSectionTitles] = useState(() => initialState.sectionTitles);

  // Estado para Seções Customizadas Dinâmicas
  const [customSections, setCustomSections] = useState<CustomSection[]>(() => initialState.customSections);

  const [editingSection, setEditingSection] = useState<{ key: keyof typeof sectionTitles, title: string } | null>(null);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);

  const [content, setContent] = useState<ContentItem[]>(() => {
    const initial = Array.isArray(initialState.content) ? initialState.content : [];
    const map = new Map<string, ContentItem>();
    VERIFIED_OPEN_ITEMS.forEach(item => map.set(item.id, item));
    initial.forEach(item => {
      if (!map.has(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values());
  });
  const [siteNotifications, setSiteNotifications] = useState<SiteNotification[]>(() => initialState.notifications);
  const [myList, setMyList] = useState<string[]>(() => initialState.myList);
  const [favorites, setFavorites] = useState<string[]>(() => initialState.favorites);

  // Catálogos Dinâmicos em PT-BR (TMDB + Local) com Hidratação Instantânea via Cache
  const [trendingItems, setTrendingItems] = useState<ContentItem[]>(() => storageService.getCachedCatalog('trending'));
  const [popularMovies, setPopularMovies] = useState<ContentItem[]>(() => storageService.getCachedCatalog('movies'));
  const [popularSeries, setPopularSeries] = useState<ContentItem[]>(() => storageService.getCachedCatalog('series'));
  const [topRatedItems, setTopRatedItems] = useState<ContentItem[]>(() => storageService.getCachedCatalog('top_rated'));
  const [animeItems, setAnimeItems] = useState<ContentItem[]>(() => storageService.getCachedCatalog('animes'));
  const [featuredSelection, setFeaturedSelection] = useState<FeaturedSelectionResult>(() => featuredRankingService.getFeaturedSelectionSync());
  const [continueWatchingList, setContinueWatchingList] = useState<WatchProgress[]>([]);
  const [liveSearchResults, setLiveSearchResults] = useState<ContentItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  useEffect(() => {
    return featuredRankingService.subscribe((res) => {
      setFeaturedSelection(res);
    });
  }, []);

  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [moviesPage, setMoviesPage] = useState(2);
  const [seriesPage, setSeriesPage] = useState(2);
  const [animesPage, setAnimesPage] = useState(2);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMovies, setHasMoreMovies] = useState(true);
  const [hasMoreSeries, setHasMoreSeries] = useState(true);
  const [hasMoreAnimes, setHasMoreAnimes] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsCatalogLoading(false);
      }
    }, 3500);

    const fetchLiveCatalogs = async () => {
      setIsCatalogLoading(true);
      try {
        const [
          trendingRes, 
          moviesP1, moviesP2, 
          seriesP1, seriesP2, 
          animesP1, animesP2,
          progressRes, 
          favsRes
        ] = await Promise.allSettled([
          catalogDiscoveryService.discoverTrending(),
          catalogDiscoveryService.discoverMovies(1),
          catalogDiscoveryService.discoverMovies(2),
          catalogDiscoveryService.discoverSeries(1),
          catalogDiscoveryService.discoverSeries(2),
          catalogDiscoveryService.discoverAnimes(1),
          catalogDiscoveryService.discoverAnimes(2),
          storageService.getContinueWatching(),
          storageService.getFavorites()
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
          setTrendingItems(trendingRes.value);
          storageService.saveCachedCatalog('trending', trendingRes.value);
          trendingRes.value.forEach(addItem);
        }

        // Combina filmes TMDB + Cinemeta
        const combinedMovies: ContentItem[] = [];
        if (moviesP1.status === 'fulfilled') combinedMovies.push(...moviesP1.value.items);
        if (moviesP2.status === 'fulfilled') combinedMovies.push(...moviesP2.value.items);
        if (combinedMovies.length > 0) {
          setPopularMovies(combinedMovies);
          storageService.saveCachedCatalog('movies', combinedMovies);
          combinedMovies.forEach(addItem);
        }

        // Combina séries TMDB + Cinemeta
        const combinedSeries: ContentItem[] = [];
        if (seriesP1.status === 'fulfilled') combinedSeries.push(...seriesP1.value.items);
        if (seriesP2.status === 'fulfilled') combinedSeries.push(...seriesP2.value.items);
        if (combinedSeries.length > 0) {
          setPopularSeries(combinedSeries);
          storageService.saveCachedCatalog('series', combinedSeries);
          combinedSeries.forEach(addItem);
        }

        // Combina animes (séries + filmes de anime como Shinkai/Ghibli/Mugen Train)
        const combinedAnimes: ContentItem[] = [];
        if (animesP1.status === 'fulfilled') combinedAnimes.push(...animesP1.value.items);
        if (animesP2.status === 'fulfilled') combinedAnimes.push(...animesP2.value.items);
        if (combinedAnimes.length > 0) {
          setAnimeItems(combinedAnimes);
          storageService.saveCachedCatalog('animes', combinedAnimes);
          combinedAnimes.forEach(addItem);
        }

        if (progressRes.status === 'fulfilled') {
          setContinueWatchingList(progressRes.value);
        }
        if (favsRes.status === 'fulfilled' && favsRes.value.length > 0) {
          setFavorites(favsRes.value);
        }

        if (newItems.length > 0) {
          setContent(prev => {
            const map = new Map<string, ContentItem>();
            newItems.forEach(item => map.set(item.id, item));
            prev.forEach(item => {
              if (!map.has(item.id)) map.set(item.id, item);
            });
            return Array.from(map.values());
          });
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

    fetchLiveCatalogs();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Busca sob demanda quando o usuário seleciona um gênero específico
  useEffect(() => {
    if (!selectedGenre || selectedGenre === 'Todos') return;

    let isMounted = true;
    const loadGenreCatalog = async () => {
      try {
        if (currentView === 'movies') {
          const res = await catalogDiscoveryService.discoverMovies(1, selectedGenre);
          if (isMounted && res.items.length > 0) {
            setPopularMovies(prev => {
              const ids = new Set(res.items.map(i => i.id));
              return [...res.items, ...prev.filter(i => !ids.has(i.id))];
            });
            setMoviesPage(1);
          }
        } else if (currentView === 'series') {
          const res = await catalogDiscoveryService.discoverSeries(1, selectedGenre);
          if (isMounted && res.items.length > 0) {
            setPopularSeries(prev => {
              const ids = new Set(res.items.map(i => i.id));
              return [...res.items, ...prev.filter(i => !ids.has(i.id))];
            });
            setSeriesPage(1);
          }
        } else if (currentView === 'animes') {
          const res = await catalogDiscoveryService.discoverAnimes(1, selectedGenre);
          if (isMounted && res.items.length > 0) {
            setAnimeItems(prev => {
              const ids = new Set(res.items.map(i => i.id));
              return [...res.items, ...prev.filter(i => !ids.has(i.id))];
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
  }, [selectedGenre, currentView]);

  // Paginação e carregamento incremental sob demanda ("Carregar Mais")
  const handleLoadMore = useCallback(async (view: AppView) => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      if (view === 'movies') {
        let nextPage = moviesPage + 1;
        let res = await catalogDiscoveryService.discoverMovies(nextPage, selectedGenre);
        
        // Se a página retornou poucos itens ou vazia após filtragem teatral, tenta a próxima página uma vez
        if (res.items.length === 0 && res.hasMore && nextPage < 10) {
          nextPage++;
          res = await catalogDiscoveryService.discoverMovies(nextPage, selectedGenre);
        }

        if (res.items.length > 0) {
          setPopularMovies(prev => {
            const seen = new Set(prev.map(i => i.id));
            const fresh = res.items.filter(i => !seen.has(i.id));
            const updated = [...prev, ...fresh];
            storageService.saveCachedCatalog('movies', updated);
            return updated;
          });

          // Sincroniza também a lista global de conteúdo
          setContent(prev => {
            const seen = new Set(prev.map(i => i.id));
            const fresh = res.items.filter(i => !seen.has(i.id));
            return [...prev, ...fresh];
          });

          setMoviesPage(nextPage);
          setHasMoreMovies(res.hasMore);
        } else {
          setHasMoreMovies(false);
        }
      } else if (view === 'series') {
        let nextPage = seriesPage + 1;
        let res = await catalogDiscoveryService.discoverSeries(nextPage, selectedGenre);

        if (res.items.length === 0 && res.hasMore && nextPage < 10) {
          nextPage++;
          res = await catalogDiscoveryService.discoverSeries(nextPage, selectedGenre);
        }

        if (res.items.length > 0) {
          setPopularSeries(prev => {
            const seen = new Set(prev.map(i => i.id));
            const fresh = res.items.filter(i => !seen.has(i.id));
            const updated = [...prev, ...fresh];
            storageService.saveCachedCatalog('series', updated);
            return updated;
          });

          setContent(prev => {
            const seen = new Set(prev.map(i => i.id));
            const fresh = res.items.filter(i => !seen.has(i.id));
            return [...prev, ...fresh];
          });

          setSeriesPage(nextPage);
          setHasMoreSeries(res.hasMore);
        } else {
          setHasMoreSeries(false);
        }
      } else if (view === 'animes') {
        let nextPage = animesPage + 1;
        let res = await catalogDiscoveryService.discoverAnimes(nextPage, selectedGenre);

        if (res.items.length === 0 && res.hasMore && nextPage < 10) {
          nextPage++;
          res = await catalogDiscoveryService.discoverAnimes(nextPage, selectedGenre);
        }

        if (res.items.length > 0) {
          setAnimeItems(prev => {
            const seen = new Set(prev.map(i => i.id));
            const fresh = res.items.filter(i => !seen.has(i.id));
            const updated = [...prev, ...fresh];
            storageService.saveCachedCatalog('animes', updated);
            return updated;
          });

          setContent(prev => {
            const seen = new Set(prev.map(i => i.id));
            const fresh = res.items.filter(i => !seen.has(i.id));
            return [...prev, ...fresh];
          });

          setAnimesPage(nextPage);
          setHasMoreAnimes(res.hasMore);
        } else {
          setHasMoreAnimes(false);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar mais itens:', e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, moviesPage, seriesPage, animesPage, selectedGenre]);

  // Rolagem Infinita Automática (Infinite Scroll — carrega mais títulos conforme o usuário desce)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    const isBrowseView = currentView === 'movies' || currentView === 'series' || currentView === 'animes';
    const hasMore = currentView === 'movies' ? hasMoreMovies : currentView === 'series' ? hasMoreSeries : currentView === 'animes' ? hasMoreAnimes : false;

    if (!isBrowseView || !hasMore || isLoadingMore) return;

    // 1. IntersectionObserver para detecção prévia e suave com antecedência de 500px
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && sentinel) {
      observer = new IntersectionObserver((entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMore) {
          handleLoadMore(currentView);
        }
      }, {
        root: container || null,
        rootMargin: '500px',
        threshold: 0.05
      });
      observer.observe(sentinel);
    }

    // 2. Scroll listener no container como garantia adicional de fluidez
    const handleScroll = () => {
      if (!container || isLoadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 600) {
        handleLoadMore(currentView);
      }
    };

    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    // 3. Fallback no objeto window caso a rolagem ocorra na janela principal
    const handleWindowScroll = () => {
      if (isLoadingMore) return;
      const scrollPos = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.offsetHeight - 600;
      if (scrollPos >= threshold) {
        handleLoadMore(currentView);
      }
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });

    return () => {
      if (observer) observer.disconnect();
      if (container) container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [currentView, hasMoreMovies, hasMoreSeries, hasMoreAnimes, isLoadingMore, handleLoadMore]);

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

    import('firebase/firestore').then(({ collection, onSnapshot, doc }) => {
      import('./firebase').then(({ db: firestoreDb }) => {
        // Listen to content changes
        unsubscribes.push(onSnapshot(collection(firestoreDb, 'content'), (snapshot) => {
          const newContent = snapshot.docs.map(doc => doc.data() as ContentItem);
          setContent(newContent);
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
              return { ...u, profiles: u.profiles || [] };
            });
            setUsers(newUsers);
            
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
              updatedCurrentUser = { ...updatedCurrentUser, profiles: updatedCurrentUser.profiles || [] };
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
          setCustomSections(newSections);
        }, (error) => {
          if (error.code !== 'permission-denied') {
            console.error("Error listening to custom sections:", error);
          }
        }));

        // Listen to notifications changes
        unsubscribes.push(onSnapshot(collection(firestoreDb, 'notifications'), (snapshot) => {
          const newNotifications = snapshot.docs.map(doc => doc.data() as SiteNotification);
          setSiteNotifications(newNotifications);
        }, (error) => {
          if (error.code !== 'permission-denied') {
            console.error("Error listening to notifications:", error);
          }
        }));

        // Listen to myList changes
        if (currentUser) {
          unsubscribes.push(onSnapshot(doc(firestoreDb, 'keyValueStore', `zapitv_mylist_${currentUser.id}`), (doc) => {
            if (doc.exists()) {
              setMyList(doc.data().value);
            } else {
              setMyList([]);
            }
          }, (error) => {
            if (error.code !== 'permission-denied') {
              console.error("Error listening to myList:", error);
            }
          }));

          // Listen to favorites changes
          unsubscribes.push(onSnapshot(doc(firestoreDb, 'keyValueStore', `zapitv_favorites_${currentUser.id}`), (doc) => {
            if (doc.exists()) {
              setFavorites(doc.data().value);
            } else {
              setFavorites([]);
            }
          }, (error) => {
            if (error.code !== 'permission-denied') {
              console.error("Error listening to favorites:", error);
            }
          }));
        }
      });
    });

    return () => {
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

  // Abertura in-loco de detalhes: abre o modal preservando a rota, página atual, scroll e contexto
  const handleSelectContent = useCallback((item: ContentItem) => {
    if (!catalogEligibilityService.isItemPubliclyPlayableSync(item)) {
      return;
    }
    setSelectedContent(item);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setSelectedContent(null);
    const path = location.pathname;
    // Apenas limpa a URL se o usuário tiver acessado diretamente por deep link (/filmes/:id, etc.)
    if (path.startsWith('/filmes/')) {
      navigate('/filmes', { replace: true });
    } else if (path.startsWith('/series/')) {
      navigate('/series', { replace: true });
    } else if (path.startsWith('/animes/')) {
      navigate('/animes', { replace: true });
    }
    // Para todas as outras páginas (/, /em-destaque, /minha-lista, /downloads, etc.),
    // NÃO executa navegação nem navigate(-1), mantendo o usuário exatamente onde ele estava!
  }, [location.pathname, navigate]);

  // Sincronização de conteúdo EXCLUSIVAMENTE para links diretos/profundos na URL (/filmes/:id, /series/:id, /animes/:id, etc.)
  useEffect(() => {
    if (!activeDetailId) {
      return;
    }

    if (selectedContent && (selectedContent.id === activeDetailId || selectedContent.imdbId === activeDetailId || selectedContent.tmdbId === activeDetailId)) {
      return;
    }

    let active = true;

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

      if (localFound) {
        if (active) setSelectedContent(localFound);
        return;
      }

      // 2. Se não estiver no cache imediato, busca metadados no TMDB/Cinemeta
      try {
        const isAnime = location.pathname.startsWith('/animes');
        const isSeries = location.pathname.startsWith('/series') || isAnime;
        const mediaType = isAnime ? ContentType.ANIME : (isSeries ? ContentType.SERIES : ContentType.MOVIE);

        let details: ContentItem | null = null;
        if (activeDetailId.startsWith('tt')) {
          details = await tmdbService.findByImdb(activeDetailId);
        } else if (/^\d+$/.test(activeDetailId)) {
          const res = await tmdbService.getDetails(activeDetailId, mediaType);
          details = res?.item || null;
        }

        if (active && details) {
          setSelectedContent(details);
        }
      } catch (err) {
        console.warn('Erro ao carregar conteúdo da URL profunda:', err);
      }
    };

    resolveItemFromRoute();

    return () => {
      active = false;
    };
  }, [activeDetailId, content, location.pathname, selectedContent]);

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
  }, [content]);

  // Memoize row items to prevent filtering 48,000 items on every render
  const netflixItems = useMemo(() => allowedContent.filter(i => i.platform?.includes('Netflix')), [allowedContent]);
  const primeItems = useMemo(() => allowedContent.filter(i => i.platform?.includes('Prime Video')), [allowedContent]);
  const hboItems = useMemo(() => allowedContent.filter(i => i.platform?.includes('Max') || i.platform?.includes('HBO')), [allowedContent]);
  const recentItems = useMemo(() => allowedContent.slice().reverse(), [allowedContent]);
  const premiumItems = useMemo(() => allowedContent.slice(0, 12), [allowedContent]);

  // A busca na página só roda quando o usuário submete a busca (Enter ou clicar em Ver todos os resultados)
  useEffect(() => {
    if (!submittedSearchQuery.trim()) {
      setLiveSearchResults([]);
      return;
    }
    let active = true;
    const runSearch = async () => {
      try {
        const category = searchService.mapAppViewToCategory(currentView);
        const results = await searchService.search(submittedSearchQuery, category, content);
        if (active) {
          setLiveSearchResults(results);
        }
      } catch (e) {
        if (active) setLiveSearchResults([]);
      }
    };
    runSearch();
    return () => {
      active = false;
      searchService.cancelPending();
    };
  }, [submittedSearchQuery, currentView, content]);

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
        db.keyValueStore.put({ key: 'zapitv_current_user', value: currentUser });
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

      const isAdminEmail = cleanEmail === 'admin@zapitv.com' ||
                           cleanEmail === 'graficadfuturo@gmail.com' ||
                           cleanEmail === 'gbrielcerqueira@gmail.com' ||
                           cleanEmail.includes('admin');

      // 1. Procurar se já existe usuário na lista local ou mock
      const existingUser = users.find(u => u.email.toLowerCase() === cleanEmail) ||
                           MOCK_USERS.find(u => u.email.toLowerCase() === cleanEmail);

      let firestoreUserData: User | null = null;
      let firebaseUid: string | null = null;

      // 2. Tentar autenticação no Firebase em segundo plano sem bloquear em caso de erro
      try {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const { auth, db: firestoreDb } = await import('./firebase');
        const { doc, getDoc, updateDoc } = await import('firebase/firestore');

        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
        firebaseUid = userCredential.user.uid;
        const userDoc = await getDoc(doc(firestoreDb, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          firestoreUserData = userDoc.data() as User;
          if (isAdminEmail && firestoreUserData.role !== 'admin') {
            firestoreUserData.role = 'admin';
            updateDoc(doc(firestoreDb, 'users', userCredential.user.uid), { role: 'admin' }).catch(() => {});
          }
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
          ...firestoreUserData,
          password: pass || firestoreUserData.password,
          role: isAdminEmail ? 'admin' : (firestoreUserData.role || 'user'),
          profiles: (firestoreUserData.profiles && firestoreUserData.profiles.length > 0)
            ? firestoreUserData.profiles
            : [{ id: `p-${Date.now()}`, name: firestoreUserData.name || formattedName, avatar: AVATARS[0], isChild: false }]
        };
      } else if (existingUser) {
        targetUser = {
          ...existingUser,
          password: pass || existingUser.password,
          role: isAdminEmail ? 'admin' : (existingUser.role || 'user'),
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
          password: pass,
          role: isAdminEmail ? 'admin' : 'user',
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
          await setDoc(doc(firestoreDb, 'users', targetUser.id), targetUser);
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
      await db.keyValueStore.put({ key: 'zapitv_mock_user', value: targetUser });
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
        password: pass,
        role: email?.toLowerCase().includes('admin') ? 'admin' : 'user',
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
    const isAdminEmail = cleanEmail === 'graficadfuturo@gmail.com' || 
                         cleanEmail === 'gbrielcerqueira@gmail.com' || 
                         cleanEmail === 'admin@zapitv.com' ||
                         cleanEmail.includes('admin');
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
        password: pass,
        role: isAdminEmail ? 'admin' : 'user',
        devMode: false,
        memberSince: new Date().toLocaleDateString('pt-BR'),
        plan: plan,
        status: 'Ativo',
        profiles: [{ id: `p-${Date.now()}`, name: (name || trimmedEmail.split('@')[0] || 'Perfil').split(' ')[0], avatar: AVATARS[0], isChild: false }]
      };
      
      try {
        const { db: firestoreDb } = await import('./firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(firestoreDb, 'users', uid), newUser);
      } catch (err) {
        console.warn("Could not save to firestore:", err);
      }
      
      await db.keyValueStore.put({ key: 'zapitv_mock_auth', value: true });
      await db.keyValueStore.put({ key: 'zapitv_mock_user', value: newUser });
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

  const toggleMyList = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!currentUser) return;
    const newList = myList.includes(id) ? myList.filter(i => i !== id) : [...myList, id];
    setMyList(newList);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      await setDoc(doc(firestoreDb, 'keyValueStore', `zapitv_mylist_${currentUser.id}`), { value: newList });
    } catch (error) {
      console.error("Error saving myList:", error);
    }
  }, [myList, currentUser]);

  const toggleFavorite = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!currentUser) return;
    const newFavorites = favorites.includes(id) ? favorites.filter(i => i !== id) : [...favorites, id];
    setFavorites(newFavorites);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      await setDoc(doc(firestoreDb, 'keyValueStore', `zapitv_favorites_${currentUser.id}`), { value: newFavorites });
    } catch (error) {
      console.error("Error saving favorites:", error);
    }
  }, [favorites, currentUser]);

  const updateUser = useCallback(async (updatedUser: User) => {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db: firestoreDb } = await import('./firebase');
      await setDoc(doc(firestoreDb, 'users', updatedUser.id), updatedUser);
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      if (currentUser.id === updatedUser.id) {
        setCurrentUser(updatedUser);
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
    setEditingSection({ key, title: sectionTitles[key] });
  };

  const saveSectionTitle = async () => {
    if (editingSection && editingSection.title.trim() !== "") {
      const newTitles = { ...sectionTitles, [editingSection.key]: editingSection.title };
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db: firestoreDb } = await import('./firebase');
        await setDoc(doc(firestoreDb, 'keyValueStore', 'zapitv_section_titles'), { value: newTitles });
        setSectionTitles(newTitles);
        setEditingSection(null);
      } catch (error) {
        console.error("Error saving section title:", error);
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

  const filteredContent = useMemo(() => {
    let baseFiltered = content;
    
    if (submittedSearchQuery.trim()) {
      if (liveSearchResults.length > 0) {
        return catalogEligibilityService.filterEligibleItemsSync(liveSearchResults);
      }
      const category = searchService.mapAppViewToCategory(currentView);
      const localMatches = searchService.filterLocalCatalog(submittedSearchQuery, category, baseFiltered);
      return catalogEligibilityService.filterEligibleItemsSync(localMatches);
    }

    if (currentView === 'movies') {
      baseFiltered = popularMovies.length > 0 ? popularMovies : baseFiltered.filter(i => searchService.isMovieItem(i));
    } else if (currentView === 'series') {
      baseFiltered = popularSeries.length > 0 ? popularSeries : baseFiltered.filter(i => searchService.isSeriesItem(i));
    } else if (currentView === 'animes') {
      baseFiltered = animeItems.length > 0 ? animeItems : baseFiltered.filter(i => searchService.isAnimeItem(i));
    } else if (currentView === 'featured') {
      baseFiltered = trendingItems.length > 0 ? trendingItems : baseFiltered.filter(i => i.isFeatured);
    } else if (currentView === 'mylist') {
      baseFiltered = baseFiltered.filter(i => favorites.includes(i.id) || myList.includes(i.id));
    }

    if (selectedGenre) baseFiltered = baseFiltered.filter(i => i.genres?.includes(selectedGenre));

    // Camada Central de Elegibilidade e Reprodução Real
    return catalogEligibilityService.filterEligibleItemsSync(baseFiltered);
  }, [content, submittedSearchQuery, liveSearchResults, currentView, selectedGenre, popularMovies, popularSeries, animeItems, trendingItems, favorites, myList]);

  const renderContent = () => {
    const gridClass = "grid grid-cols-3 md:grid-cols-5 gap-x-2 md:gap-x-5 lg:gap-x-6 gap-y-6 md:gap-y-12 px-3 md:px-12 lg:px-24";
    const headerClass = "flex flex-col md:flex-row md:items-center gap-4 md:gap-7 mb-8 md:mb-14 px-4 md:px-12 lg:px-24";
    const titleClass = "text-2xl md:text-5xl font-black whitespace-nowrap tracking-tight";
    const countClass = "text-xs md:text-sm font-bold opacity-50 uppercase tracking-widest mt-1 md:mt-2 block";
    const iconClass = "w-8 h-8 md:w-14 md:h-14 text-orange-600 shrink-0";

    if (submittedSearchQuery.trim() && currentView !== 'admin') {
      const category = searchService.mapAppViewToCategory(currentView);
      const emptyMsg = searchService.getEmptyMessage(category, submittedSearchQuery);

      return (
        <ViewWrapper>
          <div className="p-4 md:p-8 pb-32">
             <div className={headerClass}>
               <div className="flex items-center gap-3 md:gap-5">
                 <Search className={iconClass} />
                 <div>
                   <h2 className={titleClass}>Busca: "{submittedSearchQuery}"</h2>
                   <span className={countClass}>{filteredContent.length} resultados encontrados</span>
                 </div>
               </div>
             </div>
             {filteredContent.length > 0 ? (
               <div className={gridClass}>
                  {filteredContent.map(item => (
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
              <div className="px-4 md:px-12 pt-6">
                <Hero 
                  featuredItems={catalogEligibilityService.filterEligibleItemsSync(trendingItems.length > 0 ? trendingItems.slice(0, 8) : content.filter(i => i.isFeatured))} 
                  isDarkMode={isDarkMode} 
                  onActionClick={handleSelectContent} 
                  isAdmin={currentUser.role === 'admin' || currentUser.devMode}
                  onUpdateItem={handleUpdateContent}
                  onAddContent={handleAddContent}
                />
              </div>
              <div className="space-y-4">
                {continueWatchingList.length > 0 && (
                  <ContentRow 
                    title="Continuar Assistindo" 
                    items={continueWatchingList.map(p => p.item).filter(i => catalogEligibilityService.isItemPubliclyPlayableSync(i))} 
                    isDarkMode={isDarkMode} 
                    onItemClick={handleSelectContent} 
                    myList={myList} 
                    favorites={favorites} 
                    onToggleFavorite={toggleFavorite} 
                    onToggleList={toggleMyList} 
                  />
                )}

                <ContentRow 
                  title={sectionTitles.premium} 
                  items={catalogEligibilityService.filterEligibleItemsSync(trendingItems.length > 0 ? trendingItems : premiumItems)} 
                  isDarkMode={isDarkMode} 
                  onItemClick={handleSelectContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('premium')}
                />
                <ContentRow 
                  title={sectionTitles.recent} 
                  items={catalogEligibilityService.filterEligibleItemsSync(popularMovies.length > 0 ? popularMovies : recentItems)} 
                  isDarkMode={isDarkMode} 
                  onItemClick={handleSelectContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('recent')}
                />
                <ContentRow 
                  title={sectionTitles.netflix} 
                  items={catalogEligibilityService.filterEligibleItemsSync(popularSeries.length > 0 ? popularSeries : content.filter(i => i.platform?.includes('Netflix')))} 
                  isDarkMode={isDarkMode} 
                  onItemClick={handleSelectContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('netflix')}
                />
                <ContentRow 
                  title={sectionTitles.prime} 
                  items={catalogEligibilityService.filterEligibleItemsSync(topRatedItems.length > 0 ? topRatedItems : content.filter(i => i.platform?.includes('Prime Video')))} 
                  isDarkMode={isDarkMode} 
                  onItemClick={handleSelectContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('prime')}
                />
                <ContentRow 
                  title={sectionTitles.hbo} 
                  items={catalogEligibilityService.filterEligibleItemsSync(animeItems.length > 0 ? animeItems : content.filter(i => i.platform?.includes('Max') || i.platform?.includes('HBO')))} 
                  isDarkMode={isDarkMode} 
                  onItemClick={handleSelectContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('hbo')}
                />

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
        const displayMovies = (featuredSelection?.featuredMovies || [])
          .filter(it => !selectedGenre || it.genres?.includes(selectedGenre))
          .filter(it => !submittedSearchQuery || it.title.toLowerCase().includes(submittedSearchQuery.toLowerCase()));

        const displaySeries = (featuredSelection?.featuredSeries || [])
          .filter(it => !selectedGenre || it.genres?.includes(selectedGenre))
          .filter(it => !submittedSearchQuery || it.title.toLowerCase().includes(submittedSearchQuery.toLowerCase()));

        return (
          <ViewWrapper>
            <div className="px-4 md:px-12 py-8 pb-32 space-y-12 md:space-y-16">
              {/* Cabeçalho Principal da Página Em Destaque */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-7 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="p-2.5 md:p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 text-amber-400 shadow-lg">
                    <Flame className="w-8 h-8 md:w-12 md:h-12" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-5xl font-black tracking-tight text-white">
                      Em Destaque
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <GenreDropdown genres={GENRES_LIST} selectedGenre={selectedGenre} onSelect={setSelectedGenre} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* SEÇÃO 1: FILMES EM DESTAQUE (TOP 10) */}
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-2.5">
                  <Film className="w-5 h-5 md:w-6 md:h-6 text-[#007df7]" />
                  <h3 className="text-lg md:text-2xl font-black text-white tracking-tight">
                    Filmes em Destaque
                  </h3>
                </div>

                {displayMovies.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
                    {displayMovies.map((item, idx) => (
                      <ContentCard 
                        key={`feat-movie-${item.id}`}
                        item={item}
                        rankPosition={idx + 1}
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
                  <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 text-gray-400 text-sm">
                    Nenhum filme em destaque corresponde ao filtro selecionado.
                  </div>
                )}
              </div>

              {/* SEÇÃO 2: SÉRIES EM DESTAQUE (TOP 10) */}
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-2.5">
                  <Tv className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                  <h3 className="text-lg md:text-2xl font-black text-white tracking-tight">
                    Séries em Destaque
                  </h3>
                </div>

                {displaySeries.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
                    {displaySeries.map((item, idx) => (
                      <ContentCard 
                        key={`feat-series-${item.id}`}
                        item={item}
                        rankPosition={idx + 1}
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
                  <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 text-gray-400 text-sm">
                    Nenhuma série em destaque corresponde ao filtro selecionado.
                  </div>
                )}
              </div>
            </div>
          </ViewWrapper>
        );
      }
      case 'movies':
      case 'series':
      case 'animes':
        return (
          <ViewWrapper>
            <div className="px-4 md:px-12 py-8 pb-32">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-7 mb-8 md:mb-14">
                <div className="flex items-center gap-3 md:gap-5">
                  {currentView === 'movies' ? <Film className={iconClass} /> : 
                   currentView === 'series' ? <Tv className={iconClass} /> : <Sparkles className={iconClass} />}
                  <h2 className={titleClass}>
                    {currentView === 'movies' ? 'Filmes' : 
                     currentView === 'series' ? 'Séries' : 'Animes'}
                  </h2>
                </div>
                <GenreDropdown genres={GENRES_LIST} selectedGenre={selectedGenre} onSelect={setSelectedGenre} isDarkMode={isDarkMode} />
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
                {filteredContent.map(item => (
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

              {/* Sentinela de Rolagem Infinita (Carrega mais conteúdos automaticamente conforme o usuário desce) */}
              {(currentView === 'movies' ? hasMoreMovies : currentView === 'series' ? hasMoreSeries : currentView === 'animes' ? hasMoreAnimes : false) && (
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
            <div className="px-4 md:px-12 py-8 pb-32">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-7 mb-8 md:mb-14">
                <div className="flex items-center gap-3 md:gap-5">
                  <List className={iconClass} />
                  <h2 className={titleClass}>Minha Lista</h2>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
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
          try {
            const { doc, setDoc } = await import('firebase/firestore');
            const { db: firestoreDb } = await import('./firebase');
            await setDoc(doc(firestoreDb, 'users', user.id), user);
            updateUser(user);
          } catch (error) {
            console.error("Error updating user:", error);
          }
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
      case 'downloads':
        return <ViewWrapper><DownloadsPage isDarkMode={isDarkMode} onSelectItem={handleSelectContent} /></ViewWrapper>;
      case 'help': return <ViewWrapper><HelpView isDarkMode={isDarkMode} onNavigate={setCurrentView} /></ViewWrapper>;
      case 'notfound':
      default:
        return <ViewWrapper><NotFoundPage isDarkMode={isDarkMode} /></ViewWrapper>;
    }
  };

  const viewContent = useMemo(() => renderContent(), [currentView, submittedSearchQuery, isDarkMode, favorites, myList, selectedGenre, currentUser, activeProfile, users, content, sectionTitles, customSections]);

  if (!isAuthenticated) return <AuthView isDarkMode={isDarkMode} onLogin={handleLogin} onSignup={handleSignup} onResetPassword={handleResetPassword} users={users} initialEmail={initialState.lastEmail} />;

  if (!activeProfile || currentView === 'profile-selector') {
    return (
      <ProfileSelectorView 
        user={currentUser} 
        onSelectProfile={(p) => { 
          setActiveProfile(p); 
          setCurrentView('home'); 
        }} 
        onUpdateUser={updateUser} 
        isDarkMode={isDarkMode} 
      />
    );
  }

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground isDarkMode={isDarkMode} />
      
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
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        activeProfile={activeProfile}
      />
      
      <main className={`transition-[margin] duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} min-h-screen flex flex-col relative z-10`}>
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
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
        />
        
        <ScrollToTop dependency={`${currentView}-${submittedSearchQuery}`} targetRef={scrollContainerRef} />

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar pb-20 scroll-smooth transform-gpu">
          {isCatalogLoading && trendingItems.length === 0 ? (
            <div className="min-h-[75vh] flex flex-col items-center justify-center select-none">
              <ZapiLoader size="xl" />
            </div>
          ) : (
            viewContent
          )}
        </div>
      </main>

      {/* Admin Button (Floating) */}
      {currentUser.role === 'admin' && (
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
              <div className="flex gap-3">
                <button onClick={() => setEditingSection(null)} className="flex-1 py-3 font-bold rounded-xl bg-transparent border border-gray-500/30 text-gray-500 hover:bg-gray-500/10">Cancelar</button>
                <button onClick={saveSectionTitle} className="flex-1 py-3 font-bold rounded-xl bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-600/20">Salvar</button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Adicionar Seção Customizada */}
      <AddSectionModal 
        isOpen={isAddSectionModalOpen}
        onClose={() => setIsAddSectionModalOpen(false)}
        onSave={handleAddCustomSection}
        allContent={content}
        genres={GENRES_LIST}
        isDarkMode={isDarkMode}
      />

      {/* Modal de Diagnóstico e Saúde do Catálogo */}
      <CatalogDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        isDarkMode={isDarkMode}
      />

      {selectedContent && (
        <ContentDetailModal 
          item={selectedContent} 
          onClose={handleCloseDetailModal} 
          isDarkMode={isDarkMode}
          myList={myList}
          favorites={favorites}
          onToggleList={toggleMyList}
          onToggleFavorite={toggleFavorite}
          allContent={allowedContent}
          initialSeason={initialSeasonNum}
          initialEpisode={initialEpisodeNum}
          autoPlayInitialEpisode={hasDeepLinkEpisode}
        />
      )}
    </div>
  );
};

export default App;
