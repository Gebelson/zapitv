import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Flame, Film, Tv, List, ChevronLeft, Sparkles, MonitorPlay } from 'lucide-react';
import { AppView, Profile } from '../types';
import { ZapiAnimatedLogo } from '../src/components/common/ZapiAnimatedLogo';

// Ícone de Séries - Refinado para strokeWidth 2.2
const SeriesIcon = (props: any) => <Tv {...props} strokeWidth={2.2} />;

interface SidebarProps {
  currentView?: AppView;
  setCurrentView?: (view: AppView) => void;
  isDarkMode: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  activeProfile?: Profile | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, setCurrentView, isDarkMode, isCollapsed, onToggleCollapse,
  isMobileMenuOpen = false, onToggleMobileMenu, activeProfile
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const menuItems = [
    { id: 'home', path: '/', label: 'Home', icon: Home },
    { id: 'featured', path: '/em-destaque', label: 'Em Destaque', icon: Flame },
    { id: 'movies', path: '/filmes', label: 'Filmes', icon: Film },
    { id: 'series', path: '/series', label: 'Séries', icon: SeriesIcon },
    { id: 'animes', path: '/animes', label: 'Animes', icon: Sparkles },
    { id: 'programas', path: '/programas', label: 'Programas', icon: MonitorPlay },
    { id: 'mylist', path: '/minha-lista', label: 'Minha Lista', icon: List },
  ];

  const isItemActive = (item: typeof menuItems[0]) => {
    if (item.path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(item.path);
  };

  const handleNavigate = (path: string, viewId: string) => {
    navigate(path);
    if (setCurrentView) {
      setCurrentView(viewId as AppView);
    }
    if (isMobileMenuOpen && onToggleMobileMenu) {
      onToggleMobileMenu();
    }
  };

  const sidebarClasses = `fixed left-0 top-0 h-screen flex flex-col border-r transition-[width,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[width,transform] z-[150] select-none ${
    isDarkMode 
      ? 'bg-[#05070A] border-gray-800 text-gray-400' 
      : 'bg-[#F8F9FC] border-gray-200 text-gray-600'
  }`;

  return (
    <>
      <div 
        onClick={onToggleMobileMenu}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] lg:hidden transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`} 
      />

      <aside data-ui-sound-sidebar="" className={`${sidebarClasses} ${
        isMobileMenuOpen ? 'translate-x-0 w-[280px] max-w-[85vw]' : '-translate-x-full w-[280px] max-w-[85vw] lg:translate-x-0'
      } ${
        isCollapsed ? 'lg:w-20' : 'lg:w-64'
      }`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute inset-0 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isDarkMode ? 'opacity-40' : 'opacity-70'}`}>
            <div 
              className="absolute bottom-[-25%] right-[-10%] w-[110vw] h-[110vh] rounded-full blur-[140px] animate-mesh-vibrant-2"
              style={{
                background: isDarkMode 
                  ? 'radial-gradient(circle at center, rgba(120, 80, 220, 0.2) 0%, rgba(60, 20, 120, 0) 70%)'
                  : 'radial-gradient(circle at center, rgba(200, 180, 255, 0.35) 0%, rgba(120, 80, 220, 0) 75%)',
                mixBlendMode: isDarkMode ? 'screen' : 'multiply'
              }}
            />
          </div>
        </div>

        <button 
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 right-0 w-4 h-16 items-center justify-center transition-[width,background-color] duration-200 z-[60] group/toggle hover:w-6 rounded-l-xl ${
            isDarkMode 
              ? 'bg-white/5 border-y border-l border-white/10 text-gray-500 hover:text-white hover:bg-white/10' 
              : 'bg-black/5 border-y border-l border-black/5 text-gray-400 hover:text-[#007df7] hover:bg-black/10'
          } backdrop-blur-sm`}
        >
          <ChevronLeft className={`w-3 h-3 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/toggle:scale-125 ${
            isCollapsed ? 'rotate-180' : 'rotate-0'
          }`} />
        </button>

        {/* Logo clicável que retorna para a Home */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => handleNavigate('/', 'home')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNavigate('/', 'home');
            }
          }}
          className="h-16 sm:h-20 px-4 flex items-center cursor-pointer select-none group/logo focus-visible:outline-none relative z-10 shrink-0 overflow-hidden"
        >
          <div className="w-12 h-12 shrink-0 flex items-center justify-center">
            <div className="w-[40px] h-[40px] sm:w-[46px] sm:h-[46px] shrink-0 sidebar-logo-glow flex items-center justify-center transition-transform duration-200 group-hover/logo:scale-105 relative">
              <ZapiAnimatedLogo
                videoSrc="/zapi-icon.webm"
                className="w-full h-full object-contain pointer-events-none select-none"
                alt="ZapiTV"
              />
            </div>
          </div>
          <div className={`overflow-hidden transition-[opacity,transform,max-width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center shrink-0 ${
            isCollapsed 
              ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none' 
              : 'max-w-[150px] opacity-100 translate-x-0 ml-1.5'
          }`}>
            <img 
              src={isDarkMode ? "/zapitv-text.png" : "/zapitv-text-light.png"} 
              alt="ZapiTV" 
              className="h-[21px] sm:h-[24px] w-auto object-contain select-none relative top-[2px]" 
              draggable={false}
            />
          </div>
        </div>

        <nav className="flex-1 px-4 mt-4 sm:mt-6 relative z-10 overflow-y-auto overflow-x-hidden no-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path, item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full h-11 flex items-center transition-colors duration-200 group rounded-xl mb-1.5 overflow-hidden text-left ${
                  active 
                    ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/20 font-bold' 
                    : `hover:bg-black/10 ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-600 hover:text-gray-900'}`
                }`}
              >
                <div className="w-12 h-11 shrink-0 flex items-center justify-center">
                  <Icon className={`w-5 h-5 shrink-0 transition-opacity ${active ? 'text-white opacity-100' : 'group-hover:text-[#007df7] opacity-90'}`} />
                </div>
                <div className={`overflow-hidden transition-[opacity,transform,max-width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex-1 min-w-0 ${
                  isCollapsed 
                    ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none' 
                    : 'max-w-[180px] opacity-100 translate-x-0'
                }`}>
                  <span className="text-sm whitespace-nowrap block truncate pr-3">
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className={`p-4 mt-auto relative z-10 flex items-center justify-center border-t transition-colors duration-300 ${
          isDarkMode ? 'border-white/5' : 'border-gray-200'
        }`}>
          <div className={`overflow-hidden transition-[opacity,transform,max-height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            isCollapsed ? 'opacity-0 max-h-0 -translate-y-1 pointer-events-none' : 'opacity-100 max-h-6 translate-y-0'
          }`}>
             <p className={`text-[10px] font-black uppercase tracking-[0.25em] whitespace-nowrap ${isDarkMode ? 'text-white/20' : 'text-gray-400/50'}`}>
                ZapiTV © 2026
             </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
