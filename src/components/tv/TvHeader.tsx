import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User as UserIcon } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { FocusContext, useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { TvProfileMenu } from './TvProfileMenu';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { tvPerformanceService } from '../../core/tv/tvPerformanceService';
import { useTvViewport, TvScaleCategory } from '../../core/tv/tvViewportService';
import { ZapiAnimatedLogo } from '../common/ZapiAnimatedLogo';

export type TvTab = 'home' | 'movies' | 'series' | 'animes' | 'featured';

interface TvHeaderProps {
  suspended?: boolean;
  hidden?: boolean;
  currentTab: TvTab;
  onSelectTab: (tab: TvTab) => void;
  onOpenSearch: () => void;
  onNavigateProfileMenu: (view: 'mylist' | 'history' | 'settings') => void;
  userName?: string;
  avatarUrl?: string;
  accountPlan?: string;
  isAuthenticated?: boolean;
  onOpenQrLink?: () => void;
  onSwitchProfile?: () => void;
  onLogout?: () => void;
}

const TvNavTabButton: React.FC<{
  focusKey: string;
  label: string;
  isActive: boolean;
  fontSize?: number;
  scaleCategory?: TvScaleCategory;
  isFireTv?: boolean;
  onClick: () => void;
  onFocusTab: (key: string, el: HTMLElement | null) => void;
  onBlurTab: (key: string) => void;
}> = ({ focusKey, label, isActive, fontSize, scaleCategory = 'expanded', isFireTv = false, onClick, onFocusTab, onBlurTab }) => {
  const { ref, focused } = useTvFocusable({
    focusKey,
    onEnterPress: onClick,
    onArrowPress: (direction) => {
      // Limite superior: não permite subir além do header
      if (direction === 'up') {
        return false;
      }
      // Limite esquerdo: no link 'Início', não permite navegar à esquerda
      if (direction === 'left' && focusKey === 'tv-nav-home') {
        return false;
      }
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

  const paddingClass = isFireTv
    ? (scaleCategory === 'compact' ? 'py-0.5 px-1.5' : scaleCategory === 'standard' ? 'py-1 px-2' : 'py-1.5 px-2.5')
    : (scaleCategory === 'compact' ? 'py-1 px-2' : scaleCategory === 'standard' ? 'py-1.5 px-2.5' : 'py-2 px-3');

  return (
    <button
      ref={ref}
      type="button"
      data-focus-key={focusKey}
      data-tv-focused={focused ? "true" : undefined}
      data-tv-active={isActive ? "true" : undefined}
      onClick={onClick}
      style={{ fontSize: fontSize ? `${fontSize}px` : undefined }}
      className={`relative ${paddingClass} font-medium tracking-wide transition-all duration-150 outline-none select-none cursor-pointer whitespace-nowrap flex-shrink-0 inline-flex items-center justify-center ${
        focused
          ? 'text-cyan-300 scale-105 drop-shadow-[0_0_14px_rgba(0,229,255,0.7)]'
          : isActive
          ? 'text-white drop-shadow'
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
  hidden = false,
  currentTab,
  onSelectTab,
  onOpenSearch,
  onNavigateProfileMenu,
  userName = 'Convidado',
  avatarUrl,
  accountPlan,
  isAuthenticated = false,
  onOpenQrLink,
  onSwitchProfile,
  onLogout
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isFireTvOrEco = tvPerformanceService.isFireTv() || tvPerformanceService.getHardwareProfile() === 'eco';
  const logoVideoRef = useRef<HTMLVideoElement>(null);
  const viewport = useTvViewport();
  const isFireTv = viewport.isFireTv;

  const indicatorWidth = isFireTv
    ? (viewport.scaleCategory === 'compact' ? 20 : viewport.scaleCategory === 'standard' ? 24 : 28)
    : (viewport.scaleCategory === 'compact' ? 24 : viewport.scaleCategory === 'standard' ? 28 : 32);
  const indicatorBottom = viewport.scaleCategory === 'compact' ? 10 : viewport.scaleCategory === 'standard' ? 16 : 22;
  const actionBtnSize = viewport.actionBtnSize;
  const searchIconSize = viewport.actionIconSize;
  const avatarIconSize = Math.round(viewport.actionIconSize * 0.9);

  // Estado e refs para o traço indicador único deslizante entre os links do header
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [indicatorX, setIndicatorX] = useState(0);
  const [indicatorTop, setIndicatorTop] = useState(42);
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
    let computedTop = 42;
    if (navRect.width > 0 && buttonRect.width > 0) {
      centerX = (buttonRect.left + buttonRect.width / 2) - navRect.left;
      computedTop = Math.round(buttonRect.bottom - navRect.top + (isFireTv ? 2 : 3));
    } else {
      centerX = buttonEl.offsetLeft + (buttonEl.offsetWidth || 80) / 2;
      computedTop = Math.round(buttonEl.offsetTop + buttonEl.offsetHeight + (isFireTv ? 2 : 3));
    }
    const currentIndicatorW = isFireTv
      ? (viewport.scaleCategory === 'compact' ? 20 : viewport.scaleCategory === 'standard' ? 24 : 28)
      : (viewport.scaleCategory === 'compact' ? 24 : viewport.scaleCategory === 'standard' ? 28 : 32);
    const targetX = Math.round(centerX - currentIndicatorW / 2);

    setIndicatorTop(computedTop);

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
  }, [viewport.scaleCategory, isFireTv]);

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

  // Botão de Busca
  const { ref: searchRef, focused: searchFocused } = useTvFocusable({
    focusKey: 'tv-nav-search',
    onEnterPress: onOpenSearch,
    onArrowPress: (direction) => {
      // Limite superior: não permite subir além do header
      if (direction === 'up') {
        return false;
      }
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

  // Botão de Perfil
  const { ref: profileRef, focused: profileFocused } = useTvFocusable({
    focusKey: 'tv-nav-profile',
    onEnterPress: () => setIsProfileMenuOpen(prev => !prev),
    onArrowPress: (direction) => {
      // Limite superior: não permite subir além do header
      if (direction === 'up') {
        return false;
      }
      // Limite direito: no botão 'Perfil', não permite navegar à direita
      if (direction === 'right') {
        return false;
      }
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
        data-testid="tv-header"
        style={{
          height: `${viewport.headerHeight}px`,
          paddingLeft: `${viewport.safeMarginX}px`,
          paddingRight: `${viewport.safeMarginX}px`,
        }}
        className={`fixed top-0 inset-x-0 z-[120] flex items-center justify-between select-none border-none shadow-none bg-transparent transition-all duration-300 transform-gpu ${
          hidden ? 'opacity-0 -translate-y-full pointer-events-none invisible' : 'opacity-100 translate-y-0 pointer-events-none'
        }`}
      >
        {/* Camada de fundo flutuante com Desfoque Real e Degradê Escuro Cinematográfico */}
        <div
          aria-hidden="true"
          className="absolute z-0 inset-x-0 top-0 pointer-events-none select-none overflow-hidden"
          style={{ height: `${viewport.headerHeight + (isFireTv ? 38 : 50)}px` }}
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

        {/* Container Flex de 3 Regiões Não-Sobreponíveis */}
        <div className="relative z-10 flex items-center justify-between w-full h-full">
          {/* 1. Região Esquerda: Logotipo Oficial ZapiTV (flex-shrink-0) */}
          <div 
            role="button"
            tabIndex={0}
            onClick={() => {
              uiSoundService.play('navigate');
              onSelectTab('home');
            }}
            className={`flex items-center ${isFireTv ? 'gap-1' : 'gap-1.5 sm:gap-2'} flex-shrink-0 cursor-pointer group/logo outline-none focus:outline-none pointer-events-auto`}
          >
            <div 
              className="flex items-center justify-center relative flex-shrink-0"
              style={{
                width: `${viewport.logoIconSize}px`,
                height: `${viewport.logoIconSize}px`
              }}
            >
              <ZapiAnimatedLogo
                videoSrc="/zapi-icon.webm"
                className="w-full h-full object-contain pointer-events-none"
                alt="ZapiTV"
              />
            </div>
            <img
              src="/zapitv-text.png"
              alt="ZapiTV"
              className="w-auto object-contain select-none ml-0 drop-shadow-lg"
              style={{
                height: `${viewport.logoTextHeight}px`,
                transform: 'translateY(2px)'
              }}
              draggable={false}
            />
          </div>

          {/* 2. Região Central: Navegação Flutuante Flexível (flex-1 flex items-center justify-center min-w-0) */}
          <nav
            ref={navRef}
            className="flex-1 flex items-center justify-center min-w-0 relative pointer-events-auto px-2"
            style={{ gap: `${viewport.navGap}px` }}
          >
            {/* Único traço indicador deslizante suave entre os links do header */}
            <div
              aria-hidden="true"
              data-testid="tv-nav-indicator"
              className={`absolute left-0 h-[3px] bg-cyan-400 rounded-full shadow-[0_0_10px_#00e5ff] pointer-events-none will-change-transform ${
                indicatorVisible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                width: `${indicatorWidth}px`,
                top: `${indicatorTop}px`,
                transform: `translate3d(${indicatorX}px, 0, 0)`,
                transition: hasTransition
                  ? 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out'
                  : 'opacity 200ms ease-out',
              }}
            />
            <TvNavTabButton
              focusKey="tv-nav-home"
              label="Início"
              fontSize={viewport.navFontSize}
              scaleCategory={viewport.scaleCategory}
              isFireTv={isFireTv}
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
              fontSize={viewport.navFontSize}
              scaleCategory={viewport.scaleCategory}
              isFireTv={isFireTv}
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
              fontSize={viewport.navFontSize}
              scaleCategory={viewport.scaleCategory}
              isFireTv={isFireTv}
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
              fontSize={viewport.navFontSize}
              scaleCategory={viewport.scaleCategory}
              isFireTv={isFireTv}
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
              label="Ao Vivo"
              fontSize={viewport.navFontSize}
              scaleCategory={viewport.scaleCategory}
              isFireTv={isFireTv}
              isActive={currentTab === 'featured'}
              onFocusTab={handleTabFocus}
              onBlurTab={handleTabBlur}
              onClick={() => {
                uiSoundService.play('navigate');
                onSelectTab('featured');
              }}
            />
          </nav>

          {/* 3. Região Direita: Busca e Perfil (flex-shrink-0 ml-auto) */}
          <div 
            className="flex items-center flex-shrink-0 ml-auto pointer-events-auto"
            style={{ gap: isFireTv ? (viewport.scaleCategory === 'compact' ? '8px' : '12px') : (viewport.scaleCategory === 'compact' ? '12px' : '16px') }}
          >
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
              style={{
                width: actionBtnSize,
                height: actionBtnSize
              }}
              className={`rounded-full flex items-center justify-center transition-all duration-200 outline-none ${
                searchFocused
                  ? 'bg-cyan-500/25 text-cyan-300 border-2 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(0,229,255,0.6)]'
                  : 'text-gray-200 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20'
              }`}
            >
              <Search style={{ width: searchIconSize, height: searchIconSize }} />
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
                style={{
                  width: actionBtnSize,
                  height: actionBtnSize
                }}
                className={`rounded-full p-1 flex items-center justify-center transition-all duration-200 outline-none ${
                  profileFocused
                    ? 'border-2 border-cyan-400 scale-105 shadow-[0_0_20px_rgba(0,229,255,0.6)]'
                    : 'border-2 border-white/20 hover:border-white/40'
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon style={{ width: avatarIconSize, height: avatarIconSize }} className="text-white" />
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
                anchorRef={profileRef}
                isAuthenticated={isAuthenticated}
                onOpenQrLink={onOpenQrLink}
                onSwitchProfile={onSwitchProfile}
                onLogout={onLogout}
              />
            </div>
          </div>
        </div>
      </header>
    </FocusContext.Provider>
  );
};
