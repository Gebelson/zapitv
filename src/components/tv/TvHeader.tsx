import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User as UserIcon } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { TvProfileMenu } from './TvProfileMenu';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { ZapiAnimatedLogo } from '../common/ZapiAnimatedLogo';

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
  onFocusTab: (key: string, el: HTMLElement | null) => void;
  onBlurTab: (key: string) => void;
}> = ({ focusKey, label, isActive, onClick, onFocusTab, onBlurTab }) => {
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
    onFocus: () => {
      onFocusTab(focusKey, ref.current);
    },
    onBlur: () => {
      onBlurTab(focusKey);
    },
    autoScroll: false
  });

  useEffect(() => {
    if (focused) {
      onFocusTab(focusKey, ref.current);
    } else {
      onBlurTab(focusKey);
    }
  }, [focused, focusKey, onFocusTab, onBlurTab]);

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

  // Estado e refs para o traço indicador único deslizante entre os links do header
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [indicatorX, setIndicatorX] = useState(0);
  const [hasTransition, setHasTransition] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);
  const buttonMapRef = useRef<Record<string, HTMLElement | null>>({});
  const focusedKeyRef = useRef<string | null>(null);
  const isIndicatorVisibleRef = useRef<boolean>(false);
  const blurTimerRef = useRef<any>(null);

  const updateIndicatorPosition = useCallback((buttonEl: HTMLElement, animate: boolean = true) => {
    const navEl = navRef.current;
    if (!navEl || !buttonEl) return;

    const navRect = navEl.getBoundingClientRect();
    const buttonRect = buttonEl.getBoundingClientRect();

    let centerX = 0;
    if (navRect.width > 0 && buttonRect.width > 0) {
      centerX = (buttonRect.left + buttonRect.width / 2) - navRect.left;
    } else {
      centerX = buttonEl.offsetLeft + (buttonEl.offsetWidth || 80) / 2;
    }
    const targetX = Math.round(centerX - 16);

    if (!animate || !isIndicatorVisibleRef.current) {
      // Primeira aparição vinda de outra área: posiciona diretamente sob o link sem cruzar o header
      setHasTransition(false);
      setIndicatorX(targetX);
      requestAnimationFrame(() => {
        setHasTransition(true);
        setIndicatorVisible(true);
        isIndicatorVisibleRef.current = true;
      });
    } else {
      // Navegação direta entre links: desliza suavemente com curva natural
      setHasTransition(true);
      setIndicatorX(targetX);
      setIndicatorVisible(true);
      isIndicatorVisibleRef.current = true;
    }
  }, []);

  const handleTabFocus = useCallback((key: string, buttonEl: HTMLElement | null) => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    focusedKeyRef.current = key;
    if (buttonEl) {
      buttonMapRef.current[key] = buttonEl;
      updateIndicatorPosition(buttonEl, isIndicatorVisibleRef.current);
    }
  }, [updateIndicatorPosition]);

  const handleTabBlur = useCallback((key: string) => {
    if (focusedKeyRef.current === key) {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
      blurTimerRef.current = setTimeout(() => {
        focusedKeyRef.current = null;
        setIndicatorVisible(false);
        isIndicatorVisibleRef.current = false;
      }, 60);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (focusedKeyRef.current && buttonMapRef.current[focusedKeyRef.current]) {
        updateIndicatorPosition(buttonMapRef.current[focusedKeyRef.current], false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };
  }, [updateIndicatorPosition]);

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
        {/* Camada de fundo flutuante com Desfoque Real e Degradê Escuro Cinematográfico */}
        <div
          aria-hidden="true"
          className="absolute z-0 inset-x-0 top-0 h-[140px] sm:h-[160px] pointer-events-none select-none overflow-hidden"
        >
          {/* Desfoque Real Progressivo via backdrop-filter e máscara gradual */}
          <div
            className={`tv-header-blur absolute inset-0 pointer-events-none transform-gpu transition-opacity duration-500 ease-in-out ${
              isScrolled ? 'opacity-100' : 'opacity-70'
            }`}
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.92) 35%, rgba(0,0,0,0.45) 68%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.92) 35%, rgba(0,0,0,0.45) 68%, transparent 100%)'
            }}
          />

          {/* Degradê Escuro Cinematográfico (Garante contraste e legibilidade sem faixa sólida) */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ease-in-out ${
              isScrolled ? 'opacity-100' : 'opacity-65'
            }`}
            style={{
              background: 'linear-gradient(to bottom, rgba(5,7,10,0.92) 0%, rgba(5,7,10,0.70) 38%, rgba(5,7,10,0.20) 75%, transparent 100%)'
            }}
          />
        </div>
        {/* Esquerda: Logotipo Oficial ZapiTV Ampliado (Largura proporcional ~190-210px) */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => {
            uiSoundService.play('navigate');
            onSelectTab('home');
          }}
          className="relative z-10 flex items-center gap-3.5 cursor-pointer group/logo outline-none focus:outline-none pointer-events-auto"
        >
          <div className="w-12 h-12 sm:w-[50px] sm:h-[50px] flex items-center justify-center relative flex-shrink-0">
            <ZapiAnimatedLogo
              videoSrc="/zapi-icon.webm"
              className="w-full h-full object-contain pointer-events-none"
              alt="ZapiTV"
            />
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
        <nav
          ref={navRef}
          className="absolute z-10 left-1/2 -translate-x-1/2 flex items-center gap-6 sm:gap-8 lg:gap-10 pointer-events-auto"
        >
          {/* Único traço indicador deslizante suave entre os links do header aproximado a 5px do texto (top-[calc(100%+5px)]) */}
          <div
            aria-hidden="true"
            data-testid="tv-nav-indicator"
            className={`absolute left-0 bottom-0 h-[3px] w-8 bg-cyan-400 rounded-full shadow-[0_0_10px_#00e5ff] pointer-events-none will-change-transform ${
              indicatorVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              transform: `translate3d(${indicatorX}px, 0, 0)`,
              transition: hasTransition
                ? 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out'
                : 'opacity 200ms ease-out',
            }}
          />
          <TvNavTabButton
            focusKey="tv-nav-home"
            label="Início"
            isActive={currentTab === 'home'}
            onFocusTab={handleTabFocus}
            onBlurTab={handleTabBlur}
            onClick={() => {
              uiSoundService.play('navigate');
              onSelectTab('home');
            }}
          />
          <TvNavTabButton
            focusKey="tv-nav-movies"
            label="Filmes"
            isActive={currentTab === 'movies'}
            onFocusTab={handleTabFocus}
            onBlurTab={handleTabBlur}
            onClick={() => {
              uiSoundService.play('navigate');
              onSelectTab('movies');
            }}
          />
          <TvNavTabButton
            focusKey="tv-nav-series"
            label="Séries"
            isActive={currentTab === 'series'}
            onFocusTab={handleTabFocus}
            onBlurTab={handleTabBlur}
            onClick={() => {
              uiSoundService.play('navigate');
              onSelectTab('series');
            }}
          />
          <TvNavTabButton
            focusKey="tv-nav-animes"
            label="Animes"
            isActive={currentTab === 'animes'}
            onFocusTab={handleTabFocus}
            onBlurTab={handleTabBlur}
            onClick={() => {
              uiSoundService.play('navigate');
              onSelectTab('animes');
            }}
          />
          <TvNavTabButton
            focusKey="tv-nav-featured"
            label="Em Destaque"
            isActive={currentTab === 'featured'}
            onFocusTab={handleTabFocus}
            onBlurTab={handleTabBlur}
            onClick={() => {
              uiSoundService.play('navigate');
              onSelectTab('featured');
            }}
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
            onClick={() => {
              uiSoundService.play('click');
              onOpenSearch();
            }}
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
              onClick={() => {
                uiSoundService.play('confirm');
                setIsProfileMenuOpen(prev => !prev);
              }}
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
