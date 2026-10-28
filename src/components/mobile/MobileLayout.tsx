import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, Profile, ContentItem, SiteNotification, AppView } from '../../../types';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNavigation, MobileTab } from './MobileBottomNavigation';
import { MobileHomeView } from './MobileHomeView';
import { MobileExploreView, ExploreCategory } from './MobileExploreView';
import { MobileSearchView } from './MobileSearchView';
import { MobileMyZapiView } from './MobileMyZapiView';
import { ZapiLoader } from '../common/ZapiLoader';

const ProgramasView = React.lazy(() => import('../../../components/ProgramasView'));
const HelpView = React.lazy(() => import('../../../components/HelpView'));
const SettingsView = React.lazy(() => import('../../../components/SettingsView'));
const ProfileSelectorView = React.lazy(() => import('../../../components/ProfileSelectorView'));
const ActorView = React.lazy(() => import('../../pages/ActorView').then(m => ({ default: m.ActorView })));

interface MobileLayoutProps {
  currentView: AppView;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  currentUser: User;
  activeProfile: Profile | null;
  onSwitchProfile: () => void;
  onSelectProfile: (p: Profile) => void;
  onLogout: () => void;
  notifications: SiteNotification[];
  onSelectContent: (item: ContentItem) => void;
  onPlayClick?: (item: ContentItem) => void;
  allContent: ContentItem[];
  myList: string[];
  favorites: string[];
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  heroItems: ContentItem[];
  trendingItems: ContentItem[];
  personalizedRows: Array<{ id: string; title: string; subtitle?: string; items: ContentItem[] }>;
  featuredSelection?: any;
  onOpenDiagnostics?: () => void;
  hasOpenModal?: boolean;
  onCloseModal?: () => void;
  onLoadMore?: (category: 'movies' | 'series' | 'animes') => void;
  hasMore?: boolean | { movies?: boolean; series?: boolean; animes?: boolean };
  isLoadingMore?: boolean;
  selectedGenre?: string;
  onSelectGenre?: (genre: string) => void;
  onCategoryChange?: (category: 'movies' | 'series' | 'animes') => void;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  currentView,
  isDarkMode,
  setIsDarkMode,
  currentUser,
  activeProfile,
  onSwitchProfile,
  onSelectProfile,
  onLogout,
  notifications,
  onSelectContent,
  onPlayClick,
  allContent,
  myList,
  favorites,
  onToggleFavorite,
  onToggleList,
  heroItems,
  trendingItems,
  personalizedRows,
  featuredSelection,
  onOpenDiagnostics,
  hasOpenModal = false,
  onCloseModal,
  onLoadMore,
  hasMore = true,
  isLoadingMore = false,
  selectedGenre,
  onSelectGenre,
  onCategoryChange
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [isGenreMenuOpen, setIsGenreMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mapeia a URL/View atual para uma das 5 abas principais
  const activeTab: MobileTab = useMemo(() => {
    const p = location.pathname;
    if (p === '/' || p.startsWith('/sala')) return 'home';
    if (
      p.startsWith('/explorar') ||
      p.startsWith('/filmes') ||
      p.startsWith('/series') ||
      p.startsWith('/animes') ||
      p.startsWith('/em-destaque') ||
      currentView === 'movies' ||
      currentView === 'series' ||
      currentView === 'animes' ||
      currentView === 'featured' ||
      currentView === 'explore'
    ) {
      return 'explore';
    }
    if (p.startsWith('/buscar') || currentView === 'search') return 'search';
    if (p.startsWith('/programas') || p.startsWith('/televisao') || currentView === 'programas' || currentView === 'television') {
      return 'programas';
    }
    return 'my-zapitv';
  }, [location.pathname, currentView]);

  // Categoria inicial para a aba Explorar baseada na rota
  const exploreInitialCategory: ExploreCategory = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/filmes')) return 'movies';
    if (p.startsWith('/series')) return 'series';
    if (p.startsWith('/animes')) return 'animes';
    return 'movies';
  }, [location.pathname]);

  // Monitora rolagem para efeitos do header
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Posicionamento instantâneo no topo antes da pintura ao navegar entre páginas/abas no mobile
  // Evita qualquer animação de rolagem da página anterior e elimina flashes ou saltos visuais
  useLayoutEffect(() => {
    // Desativa qualquer transição animada de scroll durante a mudança de rota
    const htmlEl = typeof document !== 'undefined' ? document.documentElement : null;
    const prevScrollBehavior = htmlEl ? htmlEl.style.scrollBehavior : '';
    if (htmlEl) {
      htmlEl.style.scrollBehavior = 'auto';
    }

    // Posiciona imediatamente no topo (sem animação, sem flashes, sem atrasos)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
    if (htmlEl) {
      htmlEl.scrollTop = 0;
    }
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }

    setScrollY(0);

    // Restaura o estilo de scrollBehavior anterior
    if (htmlEl) {
      htmlEl.style.scrollBehavior = prevScrollBehavior;
    }
  }, [location.pathname, location.search]);

  // Hierarquia do botão Voltar do Android
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Se houver menu de gêneros aberto, fecha o menu sem navegar
      if (isGenreMenuOpen) {
        e.preventDefault();
        setIsGenreMenuOpen(false);
        document.body.style.overflow = '';
        return;
      }

      // Se houver modal aberto (detalhes ou diagnóstico), fecha o modal sem trocar de rota
      if (hasOpenModal && onCloseModal) {
        e.preventDefault();
        onCloseModal();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isGenreMenuOpen, hasOpenModal, onCloseModal]);

  const handleSelectTab = (tab: MobileTab) => {
    setIsGenreMenuOpen(false);
    document.body.style.overflow = '';
    if (activeTab === tab) return;

    switch (tab) {
      case 'home': navigate('/'); break;
      case 'explore': navigate('/explorar'); break;
      case 'search': navigate('/buscar'); break;
      case 'programas': navigate('/programas'); break;
      case 'my-zapitv': navigate('/minha-zapitv'); break;
    }
  };

  const handleQuickCategory = (cat: 'all' | 'movies' | 'series' | 'animes' | 'featured') => {
    switch (cat) {
      case 'movies': navigate('/filmes'); break;
      case 'series': navigate('/series'); break;
      case 'animes': navigate('/animes'); break;
      case 'featured': navigate('/em-destaque'); break;
      default: navigate('/explorar'); break;
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="mobile-layout-container"
      className={`min-h-screen ${isDarkMode ? 'bg-[#05070a] text-slate-100' : 'bg-[#F8F9FC] text-gray-900'} flex flex-col relative select-none`}
    >
      {/* 1. Mobile Header (visível na Home e páginas gerais, oculto com menu fullscreen de gêneros) */}
      {!isGenreMenuOpen && (
        <MobileHeader
          currentUser={currentUser}
          activeProfile={activeProfile}
          notifications={notifications}
          isDarkMode={isDarkMode}
          scrollY={scrollY}
          onOpenProfile={() => handleSelectTab('my-zapitv')}
        />
      )}

      {/* 2. Área Central de Conteúdo */}
      <main className="flex-1 w-full max-w-lg mx-auto">
        {/* Renderiza a aba ativa */}
        {activeTab === 'home' && (
          <MobileHomeView
            heroItems={heroItems}
            allContent={allContent}
            trendingItems={trendingItems}
            personalizedRows={personalizedRows}
            featuredSelection={featuredSelection}
            myList={myList}
            favorites={favorites}
            onSelectContent={onSelectContent}
            onPlayClick={onPlayClick}
            onToggleList={onToggleList}
            onSelectCategoryFilter={handleQuickCategory}
          />
        )}

        {activeTab === 'explore' && (
          <MobileExploreView
            initialCategory={exploreInitialCategory}
            allContent={allContent}
            featuredSelection={featuredSelection}
            onSelectContent={onSelectContent}
            isGenreMenuOpen={isGenreMenuOpen}
            onToggleGenreMenu={setIsGenreMenuOpen}
            onLoadMore={onLoadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            selectedGenreProp={selectedGenre}
            onSelectGenre={onSelectGenre}
            onCategoryChange={onCategoryChange}
          />
        )}

        {activeTab === 'search' && (
          <MobileSearchView
            allContent={allContent}
            activeProfile={activeProfile}
            onSelectContent={onSelectContent}
          />
        )}

        {activeTab === 'programas' && (
          <div className="pt-16 pb-28">
            <React.Suspense fallback={<div className="py-24 flex justify-center"><ZapiLoader size="xl" /></div>}>
              <ProgramasView
                isDarkMode={isDarkMode}
              />
            </React.Suspense>
          </div>
        )}

        {activeTab === 'my-zapitv' && (
          <MobileMyZapiView
            currentUser={currentUser}
            activeProfile={activeProfile}
            allContent={allContent}
            myList={myList}
            favorites={favorites}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            onLogout={onLogout}
            onSwitchProfile={onSwitchProfile}
            onOpenDiagnostics={onOpenDiagnostics}
            onSelectContent={onSelectContent}
          />
        )}
      </main>

      {/* 3. Barra de Navegação Inferior Fixa (oculta com menu fullscreen de gêneros) */}
      {!isGenreMenuOpen && (
        <MobileBottomNavigation
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          unreadNotificationsCount={notifications.filter(n => !n.read).length}
        />
      )}
    </div>
  );
};
