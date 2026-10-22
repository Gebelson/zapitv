import React, { useState, useEffect, useRef } from 'react';
import { Search, User as UserIcon } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { TvProfileMenu } from './TvProfileMenu';

export type TvTab = 'home' | 'movies' | 'series' | 'animes' | 'featured';

interface TvHeaderProps {
  suspended?: boolean;
  currentTab: TvTab;
  onSelectTab: (tab: TvTab) => void;
  onOpenSearch: () => void;
  onNavigateProfileMenu: (view: 'mylist' | 'history' | 'settings') => void;
  userName?: string;
  avatarUrl?: string;
  accountPlan?: string;
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
    onArrowPress: (direction) => {
      if (direction === 'down') {
        setFocus('tv-hero-play');
        return false;
      }
      if (direction === 'right' && focusKey === 'tv-nav-featured') {
        setFocus('tv-nav-search');
        return false;
      }
      return true;
    },
    autoScroll: false
  });

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      onClick={onClick}
      className={`relative py-2 px-2 text-[20px] lg:text-[23px] font-bold tracking-wide transition-all duration-150 outline-none select-none cursor-pointer whitespace-nowrap inline-flex items-center justify-center ${
        focused
          ? 'text-cyan-300 scale-105 drop-shadow-[0_0_14px_rgba(0,229,255,0.7)]'
          : isActive
          ? 'text-white font-extrabold drop-shadow'
          : 'text-gray-300/85 hover:text-white'
      }`}
    >
      <span className="relative inline-block">
        {label}
        {/* Indicador refinado da página atual / foco proporcional ao texto, aproximado a 5px */}
        {focused ? (
          <span className="absolute top-[calc(100%+5px)] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-cyan-400 rounded-full shadow-[0_0_10px_#00e5ff] transition-all duration-200 pointer-events-none" />
        ) : isActive ? (
          <span className="absolute top-[calc(100%+5px)] left-1/2 -translate-x-1/2 w-6 h-[3px] bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full shadow-[0_0_8px_#00e5ff] transition-all duration-200 pointer-events-none" />
        ) : null}
      </span>
    </button>
  );
};

export const TvHeader: React.FC<TvHeaderProps> = ({
  suspended = false,
  currentTab,
  onSelectTab,
  onOpenSearch,
  onNavigateProfileMenu,
  userName = 'Convidado',
  avatarUrl,
  accountPlan
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const logoVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = logoVideoRef.current;
    if (!video) return;
    if (suspended) video.pause();
    else void video.play().catch(() => {});
  }, [suspended]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { ref: noriginRef, focusKey } = useFocusable({
    focusKey: 'tv-header',
    trackChildren: true,
    saveLastFocusedChild: true
  });

  // Botão de Busca Ampliado (Área 56px, Ícone 28px)
  const { ref: searchRef, focused: searchFocused } = useTvFocusable({
    focusKey: 'tv-nav-search',
    onEnterPress: onOpenSearch,
    onArrowPress: (direction) => {
      if (direction === 'left') {
        setFocus('tv-nav-featured');
        return false;
      }
      if (direction === 'right') {
        setFocus('tv-nav-profile');
        return false;
      }
      if (direction === 'down') {
        setFocus('tv-hero-play');
        return false;
      }
      return true;
    }
  });

  // Botão de Perfil Ampliado (Área 56px, Avatar 48px)
  const { ref: profileRef, focused: profileFocused } = useTvFocusable({
    focusKey: 'tv-nav-profile',
    onEnterPress: () => setIsProfileMenuOpen(prev => !prev),
    onArrowPress: (direction) => {
      if (direction === 'left') {
        setFocus('tv-nav-search');
        return false;
      }
      if (direction === 'down') {
        setFocus('tv-hero-details');
        return false;
      }
      return true;
    }
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <header
        ref={noriginRef as any}
        className="fixed top-0 inset-x-0 z-[120] h-24 sm:h-[100px] px-14 sm:px-16 flex items-center justify-between pointer-events-none select-none border-none shadow-none bg-transparent"
      >
        <div
          aria-hidden="true"
          className={`absolute z-0 inset-x-0 top-0 h-[220px] pointer-events-none transition-opacity duration-700 ease-in-out ${isScrolled ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'linear-gradient(to bottom, rgba(5,7,10,0.94) 0%, rgba(5,7,10,0.68) 36%, rgba(5,7,10,0.22) 72%, transparent 100%)' }}
        />
        {/* Esquerda: Logotipo Oficial ZapiTV Ampliado (Largura proporcional ~190-210px) */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => onSelectTab('home')}
          className="relative z-10 flex items-center gap-3.5 cursor-pointer group/logo outline-none focus:outline-none pointer-events-auto"
        >
          <div className="w-12 h-12 sm:w-[50px] sm:h-[50px] flex items-center justify-center relative flex-shrink-0">
            <video
              ref={logoVideoRef}
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
            className="h-[28px] sm:h-[32px] w-auto object-contain select-none ml-1 hidden sm:block drop-shadow-lg"
            style={{ transform: 'translateY(3px)' }}
            draggable={false}
          />
        </div>

        {/* Centro: Navegação Flutuante Livre (SEM RETÂNGULO EXTERNO, CENTRALIZADA NA LARGURA TOTAL) */}
        <nav className="absolute z-10 left-1/2 -translate-x-1/2 flex items-center gap-6 sm:gap-8 lg:gap-10 pointer-events-auto">
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

        {/* Direita: Busca e Perfil Ampliados (Áreas 56px, Ícones 28px) */}
        <div className="relative z-10 flex items-center gap-4 sm:gap-5 pointer-events-auto ml-auto">
          {/* Botão de Busca */}
          <button
            ref={searchRef}
            type="button"
            data-focus-key="tv-nav-search"
            data-tv-focused={searchFocused ? "true" : undefined}
            onClick={onOpenSearch}
            aria-label="Buscar títulos"
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 outline-none ${
              searchFocused
                ? 'bg-cyan-500/25 text-cyan-300 border-2 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(0,229,255,0.6)]'
                : 'text-gray-200 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20'
            }`}
          >
            <Search className="w-7 h-7" />
          </button>

          {/* Botão de Perfil e Dropdown Encapsulado */}
          <div className="relative">
            <button
              ref={profileRef}
              type="button"
              data-focus-key="tv-nav-profile"
              data-tv-focused={profileFocused ? "true" : undefined}
              onClick={() => setIsProfileMenuOpen(prev => !prev)}
              aria-label="Menu do perfil"
              className={`w-14 h-14 rounded-full p-1 flex items-center justify-center transition-all duration-200 outline-none ${
                profileFocused
                  ? 'border-2 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(0,229,255,0.6)]'
                  : 'border-2 border-white/20 hover:border-white/40'
              }`}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-6 h-6 text-white" />
                )}
              </div>
            </button>

            {/* Menu Dropdown do Perfil (Minha Lista fica exclusivamente aqui) */}
            <TvProfileMenu
              isOpen={isProfileMenuOpen}
              onClose={() => setIsProfileMenuOpen(false)}
              onNavigate={(target) => {
                setIsProfileMenuOpen(false);
                onNavigateProfileMenu(target);
              }}
              userName={userName}
              avatarUrl={avatarUrl}
              accountPlan={accountPlan}
            />
          </div>
        </div>
      </header>
    </FocusContext.Provider>
  );
};
