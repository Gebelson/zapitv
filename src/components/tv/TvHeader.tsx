import React, { useState } from 'react';
import { Search, User as UserIcon } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { TvProfileMenu } from './TvProfileMenu';

export type TvTab = 'home' | 'movies' | 'series' | 'animes' | 'featured';

interface TvHeaderProps {
  currentTab: TvTab;
  onSelectTab: (tab: TvTab) => void;
  onOpenSearch: () => void;
  onNavigateProfileMenu: (view: 'mylist' | 'history' | 'settings') => void;
  userName?: string;
  avatarUrl?: string;
}

const TvNavTabButton: React.FC<{
  focusKey: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ focusKey, label, isActive, onClick }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    autoScroll: false
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      onClick={onClick}
      className={`relative px-4 py-2 rounded-xl text-sm font-black tracking-wider transition-all duration-200 outline-none select-none ${
        focused
          ? 'text-cyan-300 scale-110 bg-white/10 shadow-[0_0_15px_rgba(0,229,255,0.4)]'
          : isActive
          ? 'text-white'
          : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      {label}
      {isActive && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full shadow-[0_0_8px_#00e5ff]" />
      )}
    </button>
  );
};

export const TvHeader: React.FC<TvHeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenSearch,
  onNavigateProfileMenu,
  userName = 'Convidado',
  avatarUrl
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-header',
    trackChildren: true
  });

  // Botão de Busca
  const { ref: searchRef, focused: searchFocused } = useTvFocusable({
    focusKey: 'tv-nav-search',
    onEnterPress: onOpenSearch
  });

  // Botão de Perfil
  const { ref: profileRef, focused: profileFocused } = useTvFocusable({
    focusKey: 'tv-nav-profile',
    onEnterPress: () => setIsProfileMenuOpen(prev => !prev)
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <header
        ref={noriginRef as any}
        className="fixed top-0 inset-x-0 z-[120] h-20 px-8 sm:px-12 md:px-16 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/95 via-black/60 to-transparent transition-all select-none"
      >
        {/* Esquerda: Logotipo Oficial ZapiTV */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2 cursor-pointer group/logo outline-none focus:outline-none"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center relative">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain pointer-events-none"
              aria-label="ZapiTV"
            >
              <source src="/zapi-icon.webm" type="video/webm; codecs=vp9" />
              <img
                src="/zapi-icon.webp"
                alt="ZapiTV"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/zapi-icon.png';
                }}
              />
            </video>
          </div>
          <img
            src="/zapitv-text.png"
            alt="ZapiTV"
            className="h-[22px] sm:h-[25px] w-auto object-contain select-none ml-1 hidden sm:block drop-shadow"
            draggable={false}
          />
        </div>

        {/* Centro: Navegação Principal Minimalista (SEM "Minha Lista"!) */}
        <nav className="flex items-center gap-1 sm:gap-2 bg-black/40 backdrop-blur-none px-3 py-1.5 rounded-2xl border border-white/10 shadow-lg">
          <TvNavTabButton
            focusKey="tv-nav-home"
            label="Início"
            isActive={currentTab === 'home'}
            onClick={() => onSelectTab('home')}
          />
          <TvNavTabButton
            focusKey="tv-nav-movies"
            label="Filmes"
            isActive={currentTab === 'movies'}
            onClick={() => onSelectTab('movies')}
          />
          <TvNavTabButton
            focusKey="tv-nav-series"
            label="Séries"
            isActive={currentTab === 'series'}
            onClick={() => onSelectTab('series')}
          />
          <TvNavTabButton
            focusKey="tv-nav-animes"
            label="Animes"
            isActive={currentTab === 'animes'}
            onClick={() => onSelectTab('animes')}
          />
          <TvNavTabButton
            focusKey="tv-nav-featured"
            label="Em Destaque"
            isActive={currentTab === 'featured'}
            onClick={() => onSelectTab('featured')}
          />
        </nav>

        {/* Direita: Busca e Perfil */}
        <div className="flex items-center gap-3">
          {/* Botão de Busca */}
          <button
            ref={searchRef}
            type="button"
            data-focus-key="tv-nav-search"
            data-tv-focused={searchFocused ? "true" : undefined}
            onClick={onOpenSearch}
            aria-label="Buscar títulos"
            className={`p-2.5 rounded-full transition-all duration-200 outline-none ${
              searchFocused
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400 scale-110 shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'text-gray-300 hover:text-white bg-white/5 border border-white/10'
            }`}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Botão de Perfil */}
          <button
            ref={profileRef}
            type="button"
            data-focus-key="tv-nav-profile"
            data-tv-focused={profileFocused ? "true" : undefined}
            onClick={() => setIsProfileMenuOpen(prev => !prev)}
            aria-label="Menu do perfil"
            className={`p-0.5 rounded-full transition-all duration-200 outline-none ${
              profileFocused
                ? 'ring-2 ring-cyan-400 scale-110 shadow-[0_0_20px_rgba(0,229,255,0.5)]'
                : 'ring-1 ring-white/20'
            }`}
          >
            <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-white" />
              )}
            </div>
          </button>
        </div>

        {/* Menu Dropdown do Perfil (contém Minha Lista) */}
        <TvProfileMenu
          isOpen={isProfileMenuOpen}
          onClose={() => setIsProfileMenuOpen(false)}
          onNavigate={(target) => {
            setIsProfileMenuOpen(false);
            onNavigateProfileMenu(target);
          }}
          userName={userName}
          avatarUrl={avatarUrl}
        />
      </header>
    </FocusContext.Provider>
  );
};
