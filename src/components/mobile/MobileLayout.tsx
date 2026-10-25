import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  onCloseModal
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
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
    if (p.startsWith('/em-destaque')) return 'featured';
    return 'all';
  }, [location.pathname]);

  // Monitora rolagem para efeitos do header
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hierarquia do botão Voltar do Android
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. Se houver modal aberto (detalhes ou diagnóstico), fecha o modal
      if (hasOpenModal && onCloseModal) {
        e.preventDefault();
        onCloseModal();
        return;
      }

      // 2. Se estiver em uma sub-aba que não seja Home, volta para Home
      if (activeTab !== 'home') {
        navigate('/', { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasOpenModal, onCloseModal, activeTab, navigate]);

  const handleSelectTab = (tab: MobileTab) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      {/* 1. Mobile Header (visível na Home e páginas gerais) */}
      <MobileHeader
        currentUser={currentUser}
        activeProfile={activeProfile}
        notifications={notifications}
        isDarkMode={isDarkMode}
        scrollY={scrollY}
        onOpenProfile={() => handleSelectTab('my-zapitv')}
      />

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

      {/* 3. Barra de Navegação Inferior Fixa */}
      <MobileBottomNavigation
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        unreadNotificationsCount={notifications.filter(n => !n.read).length}
      />
    </div>
  );
};
