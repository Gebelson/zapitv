import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Flame, Film, Tv, List, ChevronLeft, ChevronRight, Sparkles, MonitorPlay, DownloadCloud } from 'lucide-react';
import { AppView, Profile } from '../types';

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
    { id: 'downloads', path: '/downloads', label: 'Downloads', icon: DownloadCloud },
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

  const sidebarClasses = `fixed left-0 top-0 h-screen flex flex-col border-r transition-all duration-300 z-[150] ${
    isDarkMode 
      ? 'bg-[#05070A] border-gray-800 text-gray-400' 
      : 'bg-[#F8F9FC] border-gray-200 text-gray-600'
  }`;

  return (
    <>
      <div 
        onClick={onToggleMobileMenu}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] lg:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`} 
      />

      <aside className={`${sidebarClasses} ${
        isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72 lg:translate-x-0'
      } ${
        isCollapsed ? 'lg:w-20' : 'lg:w-64'
      }`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute inset-0 transition-opacity duration-1000 ${isDarkMode ? 'opacity-40' : 'opacity-70'}`}>
            <div 
              className="absolute bottom-[-25%] right-[-10%] w-[110vw] h-[110vh] rounded-full blur-[140px] animate-mesh-vibrant-2 transition-all duration-1000"
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
          className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 right-0 w-4 h-16 items-center justify-center transition-all z-[60] group/toggle hover:w-6 rounded-l-xl ${
            isDarkMode 
              ? 'bg-white/5 border-y border-l border-white/10 text-gray-500 hover:text-white hover:bg-white/10' 
              : 'bg-black/5 border-y border-l border-black/5 text-gray-400 hover:text-[#007df7] hover:bg-black/10'
          } backdrop-blur-sm`}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 transition-transform group-hover/toggle:scale-125" />
          ) : (
            <ChevronLeft className="w-3 h-3 transition-transform group-hover/toggle:scale-125" />
          )}
        </button>

        {/* Logo clicável que retorna para a Home */}
        <div 
          role="button"
          onClick={() => handleNavigate('/', 'home')}
          className={`pt-4 lg:pt-6 px-6 pb-4 flex items-center cursor-pointer hover:opacity-80 active:scale-95 transition-all group/logo ${isCollapsed ? 'lg:justify-center' : 'gap-3'} relative z-10`}
        >
          <div className="w-12 h-10 shrink-0 transition-transform group-hover/logo:scale-110">
            <svg id="Camada_1" data-name="Camada 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 374.87 315.93" className="w-full h-full">
              <defs>
                <linearGradient id="Gradiente_Sidebar_Solid" x1="-657.62" y1="773.63" x2="-322.95" y2="1096.47" gradientTransform="translate(677 -778)" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#b273d8">
                    <animate attributeName="stopColor" values="#b273d8;#00baa3;#007df7;#b273d8" dur="4s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="1" stopColor="#00baa3">
                    <animate attributeName="stopColor" values="#00baa3;#007df7;#b273d8;#00baa3" dur="4s" repeatCount="indefinite" />
                  </stop>
                </linearGradient>
              </defs>
              <path fill="url(#Gradiente_Sidebar_Solid)" d="M217.84,315.93c-20.71-.34-41.38-.68-62-1.01-25.86.33-51.86.66-78,1l-58.67-.27c-8.71-.05-16.27-6.38-17.35-14.45-.89-6.67.79-11.65,4.8-16.59l42.96-52.9,34.5-41.58,46.93-57.01c4.73-5.74,8.53-12.04,14.93-16.09,4.47-2.83,11.02-1.13,15.32,1.5l29.66,18.14c5.5,3.37,12.16,1.15,15.73-4l16.82-24.22,47.74-74.06c.21-.33.37-.67.48-1.02,1.14-3.55-2.09-6.98-5.78-6.4-2.82.44-5.47,1.54-8.49,2.82l-128.58,54.14L9.09,134.06c-2.46,1.03-5.17.89-6.68-.21C1.28,133.02,0,130.3,0,128.19L.2,21.58C.23,9.78,8.11,0,20.12,0l335.27.02c5.38,0,11.72,3.13,14.46,6.66,6.08,7.82,3.13,17.81-2.26,24.85-5.81,7.6-11.51,14.36-17.53,21.64l-24.48,29.57-56.42,68.45-33.94,42.01c-5,6.19-12.76,9.24-19.74,5.04l-28.69-17.27c-3.83-2.31-10.24-5.82-14.33-3.45-5.92,3.43-8.84,10.15-12.43,15.62l-33.7,51.33-27.21,42.72c-.76,1.19-.35,3.03.15,3.78,1.9,2.87,9.6-.54,12.85-1.93l116.86-49.98,138.78-59.06c1.63-.7,3.99-.15,4.9.39s2.21,2,2.21,3.81l-.4,109.09c-.04,12.22-8.55,22.45-20.82,22.46l-135.81.19Z"/>
            </svg>
          </div>
          <div className={`${isCollapsed ? 'lg:hidden' : 'block'} animate-in fade-in slide-in-from-left-2 duration-300`}>
            <h1 
              className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              ZAPI<span className="text-blue-500">TV</span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest font-semibold opacity-60">Premium</p>
          </div>
        </div>

        <nav className={`flex-1 px-4 mt-1 lg:mt-4 relative z-10 overflow-y-auto no-scrollbar ${(!isCollapsed || isMobileMenuOpen) ? 'pr-4' : ''}`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path, item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center transition-all duration-200 group rounded-xl mb-1.5 ${
                  isCollapsed ? 'lg:justify-center p-3' : 'px-4 py-2.5 gap-3'
                } ${
                  active 
                    ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/20 font-bold' 
                    : `hover:bg-black/10 ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-600 hover:text-gray-900'}`
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 transition-opacity ${active ? 'text-white opacity-100' : 'group-hover:text-[#007df7] opacity-90'}`} />
                <span className={`text-sm whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300 ${
                  isCollapsed ? 'lg:hidden' : 'block'
                }`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto relative z-10 flex items-center justify-center border-t border-white/5">
          <div className={`transition-all duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
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
