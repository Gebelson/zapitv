import React, { useState, useRef, useLayoutEffect, useMemo, useEffect, useId, useCallback } from 'react';
import { SkipForward } from 'lucide-react';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvModeService } from '../../core/tv/tvModeService';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { generatePillPath } from './ZapiSkipButton';
import { NextEpisodeInfo } from './ZapiPlayer';

export interface TvNextEpisodeButtonProps {
  nextEpisodeInfo: NextEpisodeInfo;
  onNextEpisode: () => void;
  autoPlayEnabled?: boolean;
  isAutoPlayCountdownActive?: boolean;
  countdownSeconds?: number;
  onCancelAutoPlay?: () => void;
  isLoadingStreams?: boolean;
  isSkipCreditsVisible?: boolean;
  className?: string;
}

export const TvNextEpisodeButton: React.FC<TvNextEpisodeButtonProps> = ({
  nextEpisodeInfo,
  onNextEpisode,
  autoPlayEnabled = true,
  isAutoPlayCountdownActive = false,
  countdownSeconds = 10,
  onCancelAutoPlay,
  isLoadingStreams = false,
  isSkipCreditsVisible = false,
  className = ''
}) => {
  const isTv = tvModeService.isTvMode() || (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv'));

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dimensions, setDimensions] = useState(() => ({ width: 260, height: 60 }));
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const isTransitioningRef = useRef(false);
  const transitionTimerRef = useRef<{ flashTimer?: NodeJS.Timeout; doneTimer?: NodeJS.Timeout }>({});
  const hasAutoFocusedRef = useRef(false);

  const rawId = useId();
  const gradientId = `zapi-next-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const filterId = `zapi-next-filter-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Executa o avanço imediato para o próximo episódio
  const triggerNext = useCallback(() => {
    if (isTransitioningRef.current || isLoadingStreams) return;
    isTransitioningRef.current = true;

    // 1. Toca efeito sonoro de reprodução/avanço
    try {
      uiSoundService.play('watch', { playerControl: true });
    } catch {}

    // 2. DISPARA A TROCA DE EPISÓDIO IMEDIATAMENTE (zero delay)
    onNextEpisode();

    // 3. Feedback visual acelerado (preenchimento e flash no contorno)
    setIsTransitioning(true);

    if (transitionTimerRef.current.flashTimer) clearTimeout(transitionTimerRef.current.flashTimer);
    if (transitionTimerRef.current.doneTimer) clearTimeout(transitionTimerRef.current.doneTimer);

    transitionTimerRef.current.flashTimer = setTimeout(() => {
      setIsFlashing(true);
    }, 100);

    transitionTimerRef.current.doneTimer = setTimeout(() => {
      setIsTransitioning(false);
      setIsFlashing(false);
      isTransitioningRef.current = false;
    }, 500);
  }, [onNextEpisode, isLoadingStreams]);

  // Integração com sistema de navegação espacial do Modo Smart TV
  const { ref: tvFocusRef, focused: isTvFocused } = useTvFocusable({
    focusKey: 'tv-player-next-contextual',
    onArrowPress: (direction) => {
      // Se "Pular Créditos" estiver visível logo acima, seta o foco nele com D-pad UP
      if (direction === 'up' && isSkipCreditsVisible) {
        try {
          setFocus('tv-skip-button');
          return false;
        } catch {}
      }
      return true;
    },
    onEnterPress: () => {
      triggerNext();
    }
  });

  // Foco automático inteligente quando o botão surge no Modo TV (sem roubar de menus/modais/drawers)
  useEffect(() => {
    if (hasAutoFocusedRef.current) return;
    if (!isTv) return;

    // Se houver algum menu, modal ou drawer aberto, o botão contextual não deve roubar o foco
    const isModalOrDrawerOpen = Boolean(
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[data-focus-key^="tv-drawer-"]') ||
      document.querySelector('[data-focus-key^="tv-player-drawer-"]') ||
      document.querySelector('[data-focus-key^="tv-modal-"]')
    );
    if (isModalOrDrawerOpen) return;

    // Se o botão "Pular Créditos" já estiver focado pelo usuário, não rouba o foco
    const currentFocus = getCurrentFocusKey();
    if (currentFocus === 'tv-skip-button') return;

    hasAutoFocusedRef.current = true;
    try {
      setFocus('tv-player-next-contextual');
    } catch {}
  }, [isTv]);

  // Restauração de foco ao desmontar (após o avanço ou fim de exibição)
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current.flashTimer) clearTimeout(transitionTimerRef.current.flashTimer);
      if (transitionTimerRef.current.doneTimer) clearTimeout(transitionTimerRef.current.doneTimer);
      try {
        const current = getCurrentFocusKey();
        if (current === 'tv-player-next-contextual') {
          setFocus('tv-player-play');
        }
      } catch {}
    };
  }, []);

  // Atalho no teclado ('N') e tecla OK / Enter do controle remoto da TV
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        e.stopPropagation();
        triggerNext();
      } else if (
        isTvFocused &&
        (e.key === 'Enter' || e.key === 'Select' || e.keyCode === 13 || e.keyCode === 65385)
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isTvFocused, triggerNext]);

  // Merge das refs de medição de layout e do spatial navigation
  const setMergedRef = useCallback((node: HTMLButtonElement | null) => {
    (buttonRef as any).current = node;
    if (typeof tvFocusRef === 'function') {
      (tvFocusRef as any)(node);
    } else if (tvFocusRef && 'current' in tvFocusRef) {
      (tvFocusRef as any).current = node;
    }
  }, [tvFocusRef]);

  // Mede as dimensões reais do botão para contorno SVG pixel-perfect
  useLayoutEffect(() => {
    if (!buttonRef.current) return;

    const measure = () => {
      if (buttonRef.current) {
        const { offsetWidth, offsetHeight } = buttonRef.current;
        if (offsetWidth > 0 && offsetHeight > 0) {
          setDimensions({ width: offsetWidth, height: offsetHeight });
        }
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(buttonRef.current);
      return () => ro.disconnect();
    }
  }, [nextEpisodeInfo.title, isAutoPlayCountdownActive, countdownSeconds]);

  const pathD = useMemo(() => {
    return generatePillPath(dimensions.width, dimensions.height, 4);
  }, [dimensions.width, dimensions.height]);

  // Progresso do contorno durante a contagem regressiva (10s até 0s)
  const strokeDashoffset = useMemo(() => {
    if (isTransitioning) return '0.00';
    if (!isAutoPlayCountdownActive) return '0.00';
    const progress = Math.max(0, Math.min(1, countdownSeconds / 10));
    return ((1 - progress) * 100).toFixed(2);
  }, [countdownSeconds, isAutoPlayCountdownActive, isTransitioning]);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerNext();
  };

  const displayText = useMemo(() => {
    if (isAutoPlayCountdownActive && countdownSeconds > 0) {
      return `Próximo Episódio (${countdownSeconds}s)`;
    }
    return 'Próximo Episódio';
  }, [isAutoPlayCountdownActive, countdownSeconds]);

  return (
    <div
      className={`fixed bottom-[200px] sm:bottom-[210px] right-[5vw] z-[85] pointer-events-auto inline-flex items-center group select-none animate-in fade-in zoom-in-95 duration-200 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes nextContourPulse {
          0% {
            filter: drop-shadow(0 0 8px #00f0ff) drop-shadow(0 0 16px #007df7);
            stroke: #00f0ff;
            opacity: 1;
          }
          50% {
            filter: drop-shadow(0 0 30px #00f0ff) drop-shadow(0 0 55px #007df7);
            stroke: #00f0ff;
            opacity: 1;
          }
          100% {
            filter: drop-shadow(0 0 35px #00f0ff) drop-shadow(0 0 65px #007df7);
            stroke: #00f0ff;
            opacity: 1;
          }
        }
      `}</style>

      {/* Aura de Glow de Fundo ao Carregar / Foco na TV */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-300 pointer-events-none ${
          isFlashing
            ? 'bg-cyan-400/35 blur-xl opacity-100 scale-125 animate-pulse'
            : isTvFocused
            ? 'bg-[#00e5ff]/25 blur-lg opacity-90 scale-115'
            : isTransitioning
            ? 'bg-blue-500/25 blur-lg opacity-80 scale-110'
            : 'opacity-0'
        }`}
      />

      {/* Contorno SVG Dinâmico (Trilha de Fundo + Contorno com Glow Marcante) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="50%" stopColor="#00b4d8" />
            <stop offset="100%" stopColor="#007df7" />
          </linearGradient>

          <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#00f0ff" floodOpacity="0.85" />
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#007df7" floodOpacity="0.65" />
          </filter>
        </defs>

        {/* Trilha de contorno */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={isTvFocused ? 'rgba(0, 229, 255, 0.45)' : 'rgba(255, 255, 255, 0.28)'}
            strokeWidth={isTvFocused ? 4 : 3.5}
          />
        )}

        {/* Contorno dinâmico que avança na contagem e brilha no foco */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={isFlashing ? '#00f0ff' : isTvFocused ? '#00e5ff' : `url(#${gradientId})`}
            strokeWidth={isTransitioning || isFlashing ? 5 : isTvFocused ? 4.5 : 4}
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter={isFlashing ? undefined : `url(#${filterId})`}
            style={{
              transition: isAutoPlayCountdownActive
                ? 'stroke-dashoffset 0.95s linear, stroke-width 0.2s ease'
                : 'stroke-dashoffset 0.25s linear',
              animation: isFlashing ? 'nextContourPulse 0.22s ease-in-out infinite' : undefined
            }}
          />
        )}
      </svg>

      {/* Botão Clicável e com Foco Espacial */}
      <button
        ref={setMergedRef}
        type="button"
        id="zapi-tv-next-episode-button"
        data-focus-key="tv-player-next-contextual"
        data-tv-focused={isTvFocused ? 'true' : undefined}
        onClick={handleButtonClick}
        disabled={isTransitioning || isLoadingStreams}
        className={`relative z-10 flex items-center gap-3 rounded-full backdrop-blur-md uppercase tracking-wider transition-all cursor-pointer group focus:outline-none min-h-[58px] sm:min-h-[62px] min-w-[220px] sm:min-w-[250px] px-7 py-3.5 sm:px-8 sm:py-4 text-base sm:text-[18px] font-extrabold justify-center ${
          isFlashing
            ? 'bg-black/95 text-cyan-200 scale-105 shadow-[0_0_40px_rgba(0,240,255,0.95)] ring-4 ring-cyan-300 border border-cyan-300'
            : isTvFocused
            ? 'bg-black/95 text-cyan-300 scale-105 sm:scale-110 shadow-[0_0_40px_rgba(0,229,255,0.85)] ring-4 ring-[#00e5ff] border border-[#00e5ff]'
            : isTransitioning
            ? 'bg-black/95 text-white scale-105 shadow-[0_0_25px_rgba(0,125,247,0.6)]'
            : 'bg-black/85 hover:bg-black/95 text-white hover:scale-105 shadow-2xl hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] border border-white/20'
        }`}
        title={`T${nextEpisodeInfo.season}E${nextEpisodeInfo.episode} • ${nextEpisodeInfo.title}`}
      >
        <span className={isFlashing || isTvFocused ? 'text-cyan-200 font-extrabold' : ''}>
          {displayText}
        </span>
        <SkipForward
          className={`transition-transform duration-300 w-5 h-5 sm:w-6 sm:h-6 ${
            isFlashing
              ? 'text-cyan-200 translate-x-1.5 animate-pulse'
              : isTvFocused
              ? 'text-[#00e5ff] translate-x-1 scale-110'
              : isTransitioning
              ? 'text-cyan-400 translate-x-1'
              : 'text-cyan-400 group-hover:translate-x-0.5 group-hover:text-cyan-300'
          }`}
        />
      </button>
    </div>
  );
};
