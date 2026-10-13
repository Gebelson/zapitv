
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { AppView, User, ContentType, ContentItem, SiteNotification, Profile, CustomSection } from './types';
import { MOCK_USERS, AVATARS } from './constants';
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

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [previousView, setPreviousView] = useState<AppView>('home');
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
  const [continueWatchingList, setContinueWatchingList] = useState<WatchProgress[]>([]);
  const [liveSearchResults, setLiveSearchResults] = useState<ContentItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [moviesPage, setMoviesPage] = useState(2);
  const [seriesPage, setSeriesPage] = useState(2);
  const [animesPage, setAnimesPage] = useState(2);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMovies, setHasMoreMovies] = useState(true);
  const [hasMoreSeries, setHasMoreSeries] = useState(true);
  const [hasMoreAnimes, setHasMoreAnimes] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('');

  useEffect(() => {
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
        setIsCatalogLoading(false);
      }
    };

    fetchLiveCatalogs();
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
        const nextPage = moviesPage + 1;
        const res = await catalogDiscoveryService.discoverMovies(nextPage, selectedGenre);
        if (res.items.length > 0) {
          setPopularMovies(prev => {
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
        const nextPage = seriesPage + 1;
        const res = await catalogDiscoveryService.discoverSeries(nextPage, selectedGenre);
        if (res.items.length > 0) {
          setPopularSeries(prev => {
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
        const nextPage = animesPage + 1;
        const res = await catalogDiscoveryService.discoverAnimes(nextPage, selectedGenre);
        if (res.items.length > 0) {
          setAnimeItems(prev => {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Memoize row items to prevent filtering 48,000 items on every render
  const netflixItems = useMemo(() => content.filter(i => i.platform?.includes('Netflix')), [content]);
  const primeItems = useMemo(() => content.filter(i => i.platform?.includes('Prime Video')), [content]);
  const hboItems = useMemo(() => content.filter(i => i.platform?.includes('Max') || i.platform?.includes('HBO')), [content]);
  const recentItems = useMemo(() => content.slice().reverse(), [content]);
  const premiumItems = useMemo(() => content.slice(0, 12), [content]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setLiveSearchResults([]);
      return;
    }
    const runSearch = async () => {
      try {
        const results = await tmdbService.searchMulti(debouncedSearchQuery);
        setLiveSearchResults(results);
      } catch (e) {
        console.warn('Erro na busca TMDB:', e);
      }
    };
    runSearch();
  }, [debouncedSearchQuery]);

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
    
    if (debouncedSearchQuery.trim()) {
      if (liveSearchResults.length > 0) {
        return liveSearchResults.filter(item => mediaAvailabilityIndex.isPubliclyPlayable(item.imdbId || item.id));
      }
      const normalizedQuery = debouncedSearchQuery.toLowerCase();
      return baseFiltered.filter(item => 
        item.title.toLowerCase().includes(normalizedQuery) &&
        mediaAvailabilityIndex.isPubliclyPlayable(item.imdbId || item.id)
      );
    }

    if (currentView === 'movies') {
      baseFiltered = popularMovies.length > 0 ? popularMovies : baseFiltered.filter(i => i.type === ContentType.MOVIE);
    } else if (currentView === 'series') {
      baseFiltered = popularSeries.length > 0 ? popularSeries : baseFiltered.filter(i => i.type === ContentType.SERIES);
    } else if (currentView === 'animes') {
      baseFiltered = animeItems.length > 0 ? animeItems : baseFiltered.filter(i => 
        i.type === ContentType.ANIME || 
        (i.genres && i.genres.includes('Anime'))
      );
    } else if (currentView === 'featured') {
      baseFiltered = trendingItems.length > 0 ? trendingItems : baseFiltered.filter(i => i.isFeatured);
    } else if (currentView === 'mylist') {
      baseFiltered = baseFiltered.filter(i => favorites.includes(i.id) || myList.includes(i.id));
    }

    if (selectedGenre) baseFiltered = baseFiltered.filter(i => i.genres?.includes(selectedGenre));

    // Camada B (Disponibilidade): Oculta apenas itens com indisponibilidade confirmada
    return baseFiltered.filter(item => mediaAvailabilityIndex.isPubliclyPlayable(item.imdbId || item.id));
  }, [content, debouncedSearchQuery, liveSearchResults, currentView, selectedGenre, popularMovies, popularSeries, animeItems, trendingItems, favorites, myList]);

  const renderContent = () => {
    const gridClass = "grid grid-cols-3 md:grid-cols-5 gap-x-2 md:gap-x-5 lg:gap-x-6 gap-y-6 md:gap-y-12 px-3 md:px-12 lg:px-24";
    const headerClass = "flex flex-col md:flex-row md:items-center gap-4 md:gap-7 mb-8 md:mb-14 px-4 md:px-12 lg:px-24";
    const titleClass = "text-2xl md:text-5xl font-black whitespace-nowrap tracking-tight";
    const countClass = "text-xs md:text-sm font-bold opacity-50 uppercase tracking-widest mt-1 md:mt-2 block";
    const iconClass = "w-8 h-8 md:w-14 md:h-14 text-orange-600 shrink-0";

    if (debouncedSearchQuery.trim() && currentView !== 'admin') {
      return (
        <ViewWrapper>
          <div className="p-4 md:p-8 pb-32">
             <div className={headerClass}>
               <div className="flex items-center gap-3 md:gap-5">
                 <Search className={iconClass} />
                 <div>
                   <h2 className={titleClass}>Busca: "{debouncedSearchQuery}"</h2>
                   <span className={countClass}>{filteredContent.length} resultados encontrados</span>
                 </div>
               </div>
             </div>
             <div className={gridClass}>
                {filteredContent.map(item => (
                  <ContentCard 
                    key={item.id}
                    item={item}
                    isDarkMode={isDarkMode}
                    onItemClick={setSelectedContent}
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
    }

    switch (currentView) {
      case 'home':
        return (
          <ViewWrapper>
            <div className="pb-12">
              <div className="px-4 md:px-12 pt-6">
                <Hero 
                  featuredItems={trendingItems.length > 0 ? trendingItems.slice(0, 8) : content.filter(i => i.isFeatured)} 
                  isDarkMode={isDarkMode} 
                  onActionClick={setSelectedContent} 
                  isAdmin={currentUser.role === 'admin' || currentUser.devMode}
                  onUpdateItem={handleUpdateContent}
                  onAddContent={handleAddContent}
                />
              </div>
              <div className="space-y-4">
                {continueWatchingList.length > 0 && (
                  <ContentRow 
                    title="Continuar Assistindo" 
                    items={continueWatchingList.map(p => p.item)} 
                    isDarkMode={isDarkMode} 
                    onItemClick={setSelectedContent} 
                    myList={myList} 
                    favorites={favorites} 
                    onToggleFavorite={toggleFavorite} 
                    onToggleList={toggleMyList} 
                  />
                )}

                <ContentRow 
                  title={sectionTitles.premium} 
                  items={trendingItems.length > 0 ? trendingItems : premiumItems} 
                  isDarkMode={isDarkMode} 
                  onItemClick={setSelectedContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('premium')}
                />
                <ContentRow 
                  title={sectionTitles.recent} 
                  items={popularMovies.length > 0 ? popularMovies : recentItems} 
                  isDarkMode={isDarkMode} 
                  onItemClick={setSelectedContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('recent')}
                />
                <ContentRow 
                  title={sectionTitles.netflix} 
                  items={popularSeries.length > 0 ? popularSeries : content.filter(i => i.platform?.includes('Netflix'))} 
                  isDarkMode={isDarkMode} 
                  onItemClick={setSelectedContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('netflix')}
                />
                <ContentRow 
                  title={sectionTitles.prime} 
                  items={topRatedItems.length > 0 ? topRatedItems : content.filter(i => i.platform?.includes('Prime Video'))} 
                  isDarkMode={isDarkMode} 
                  onItemClick={setSelectedContent} 
                  myList={myList} 
                  favorites={favorites} 
                  onToggleFavorite={toggleFavorite} 
                  onToggleList={toggleMyList} 
                  isAdmin={currentUser.role === 'admin'}
                  onEditTitle={() => handleEditSectionTitle('prime')}
                />
                <ContentRow 
                  title={sectionTitles.hbo} 
                  items={animeItems.length > 0 ? animeItems : content.filter(i => i.platform?.includes('Max') || i.platform?.includes('HBO'))} 
                  isDarkMode={isDarkMode} 
                  onItemClick={setSelectedContent} 
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
                      items={sectionItems}
                      isDarkMode={isDarkMode}
                      onItemClick={setSelectedContent}
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
      case 'featured':
      case 'movies':
      case 'series':
      case 'animes':
        return (
          <ViewWrapper>
            <div className="px-4 md:px-12 py-8 pb-32">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-7 mb-8 md:mb-14">
                <div className="flex items-center gap-3 md:gap-5">
                  {currentView === 'featured' ? <Flame className={iconClass} /> : 
                   currentView === 'movies' ? <Film className={iconClass} /> : 
                   currentView === 'series' ? <Tv className={iconClass} /> : <Sparkles className={iconClass} />}
                  <div>
                    <h2 className={titleClass}>
                      {currentView === 'featured' ? 'Em Destaque' : 
                       currentView === 'movies' ? 'Filmes' : 
                       currentView === 'series' ? 'Séries' : 'Animes'}
                    </h2>
                    <span className={countClass}>{filteredContent.length} títulos</span>
                  </div>
                </div>
                <GenreDropdown genres={GENRES_LIST} selectedGenre={selectedGenre} onSelect={setSelectedGenre} isDarkMode={isDarkMode} />
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
                {filteredContent.map(item => (
                  <ContentCard 
                    key={item.id}
                    item={item}
                    isDarkMode={isDarkMode}
                    onItemClick={setSelectedContent}
                    isFavorite={favorites.includes(item.id)}
                    isInList={myList.includes(item.id)}
                    onToggleFavorite={toggleFavorite}
                    onToggleList={toggleMyList}
                  />
                ))}
              </div>

              {/* Botão de Paginação / Carregar Mais */}
              {(currentView === 'movies' ? hasMoreMovies : currentView === 'series' ? hasMoreSeries : currentView === 'animes' ? hasMoreAnimes : false) && (
                <div className="flex justify-center mt-12 mb-6">
                  <button
                    onClick={() => handleLoadMore(currentView)}
                    disabled={isLoadingMore}
                    className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-bold text-sm shadow-xl shadow-orange-600/20 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Carregando mais títulos...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Carregar Mais Conteúdos</span>
                      </>
                    )}
                  </button>
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
                {content.filter(i => myList.includes(i.id)).map(item => (
                  <ContentCard 
                    key={item.id}
                    item={item}
                    isDarkMode={isDarkMode}
                    onItemClick={setSelectedContent}
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
      case 'help': return <ViewWrapper><HelpView isDarkMode={isDarkMode} onNavigate={setCurrentView} /></ViewWrapper>;
      default: return null;
    }
  };

  const viewContent = useMemo(() => renderContent(), [currentView, debouncedSearchQuery, isDarkMode, favorites, myList, selectedGenre, currentUser, activeProfile, users, content, sectionTitles, customSections]);

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
          setCurrentView(view);
          setIsMobileMenuOpen(false);
          setSelectedGenre(''); 
          setSearchQuery('');
        }} 
        isDarkMode={isDarkMode} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        activeProfile={activeProfile}
      />
      
      <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} min-h-screen flex flex-col relative z-10`}>
        <Header 
          isDarkMode={isDarkMode} 
          setIsDarkMode={setIsDarkMode} 
          currentUser={currentUser} 
          activeProfile={activeProfile}
          setCurrentView={setCurrentView} 
          onSwitchProfile={() => { setActiveProfile(null); setCurrentView('profile-selector'); }}
          onSelectProfile={(p) => { setActiveProfile(p); setCurrentView('home'); }}
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery}
          notifications={siteNotifications}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
        />
        
        <ScrollToTop dependency={`${currentView}-${debouncedSearchQuery}`} targetRef={scrollContainerRef} />

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
          onClick={() => setCurrentView(v => v === 'admin' ? previousView : 'admin')} 
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
          onClose={() => setSelectedContent(null)} 
          isDarkMode={isDarkMode}
          myList={myList}
          favorites={favorites}
          onToggleList={toggleMyList}
          onToggleFavorite={toggleFavorite}
          allContent={content}
        />
      )}
    </div>
  );
};

export default App;
