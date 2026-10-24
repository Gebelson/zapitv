import React from 'react';
import { Home, Compass, Search, Tv, UserRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { uiSoundService } from '../../core/audio/uiSoundService';

export type MobileTab = 'home' | 'explore' | 'search' | 'programas' | 'my-zapitv';

interface MobileBottomNavigationProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  unreadNotificationsCount?: number;
}

export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  unreadNotificationsCount = 0
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: Array<{
    id: MobileTab;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    path: string;
  }> = [
    { id: 'home', label: 'Início', icon: Home, path: '/' },
    { id: 'explore', label: 'Explorar', icon: Compass, path: '/explorar' },
    { id: 'search', label: 'Buscar', icon: Search, path: '/buscar' },
    { id: 'programas', label: 'Programas', icon: Tv, path: '/programas' },
    { id: 'my-zapitv', label: 'Minha Zapi', icon: UserRound, path: '/minha-zapitv' }
  ];

  const handleTabClick = (item: typeof navItems[0]) => {
    uiSoundService.play('click');
    onSelectTab(item.id);
    navigate(item.path);
  };

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label="Navegação móvel principal"
      className="fixed bottom-0 left-0 right-0 z-[120] bg-[#07090E]/95 backdrop-blur-xl border-t border-white/10 select-none pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-[48px] h-full flex flex-col items-center justify-center gap-1 transition-all duration-200 relative group cursor-pointer ${
                isActive ? 'text-[#007df7]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110' : 'group-hover:scale-105'
                  }`}
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
                {item.id === 'my-zapitv' && unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[#007df7] ring-2 ring-[#07090E]" />
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight leading-none font-medium transition-colors ${
                  isActive ? 'font-bold text-[#007df7]' : 'text-slate-400'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#007df7] shadow-[0_0_8px_rgba(0,125,247,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
