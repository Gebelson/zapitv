import React, { useState, useRef, useLayoutEffect, useMemo, useEffect, useId, useCallback } from 'react';
import { SkipForward } from 'lucide-react';
import { SkipInterval } from '../../core/skip/skipService';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvModeService } from '../../core/tv/tvModeService';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';

export interface ZapiSkipButtonProps {
  interval: SkipInterval;
  currentTime: number;
  onSkip: (interval: SkipInterval) => void;
  className?: string;
}

/**
 * Calcula o progresso normalizado (0 a 1) do intervalo de intro com base no tempo atual.
 */
export function calculateSkipProgress(currentTime: number, startTime: number, endTime: number): number {
  const duration = endTime - startTime;
  if (duration <= 0) return 0;
  const elapsed = currentTime - startTime;
  return Math.max(0, Math.min(1, elapsed / duration));
}

/**
 * Gera a string do path SVG de uma pílula (rounded-full) começando às 12 horas (topo central)
 * e percorrendo o contorno no sentido horário com padding para strokeWidth.
 */
export function generatePillPath(width: number, height: number, strokeWidth: number = 3.5): string {
  if (width <= 0 || height <= 0) return '';
  const pad = strokeWidth / 2;
  const effR = Math.max(0, (height - 2 * pad) / 2);
  
  const topY = pad;
  const botY = height - pad;
  const leftX = pad + effR;
  const rightX = width - pad - effR;
  const midX = width / 2;

  return [
    `M ${midX.toFixed(2)} ${topY.toFixed(2)}`,
    `L ${rightX.toFixed(2)} ${topY.toFixed(2)}`,
    `A ${effR.toFixed(2)} ${effR.toFixed(2)} 0 0 1 ${rightX.toFixed(2)} ${botY.toFixed(2)}`,
    `L ${leftX.toFixed(2)} ${botY.toFixed(2)}`,
    `A ${effR.toFixed(2)} ${effR.toFixed(2)} 0 0 1 ${leftX.toFixed(2)} ${topY.toFixed(2)}`,
    'Z'
  ].join(' ');
}

export const ZapiSkipButton: React.FC<ZapiSkipButtonProps> = ({
  interval,
  currentTime,
  onSkip,
  className = ''
}) => {
  const isTv = tvModeService.isTvMode() || (typeof window !== 'undefined' && window.location.pathname.startsWith('/tv'));

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dimensions, setDimensions] = useState(() => (isTv ? { width: 240, height: 60 } : { width: 195, height: 44 }));
  const prevTimeRef = useRef(currentTime);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const isSkippingRef = useRef(false);
  const skipTimerRef = useRef<{ flashTimer?: NodeJS.Timeout; doneTimer?: NodeJS.Timeout }>({});
  const hasAutoFocusedRef = useRef(false);

  const rawId = useId();
  const gradientId = `zapi-skip-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const filterId = `zapi-skip-filter-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Execução fluida do pulo com disparo imediato da ação
  const triggerSkip = useCallback(() => {
    if (isSkippingRef.current) return;
    isSkippingRef.current = true;

    // 1. Toca som de confirmação se disponível
    try {
      uiSoundService.play('confirm', { playerControl: true });
    } catch {}

    // 2. DISPARA O PULO IMEDIATAMENTE (zero delay de seek ou avanço de episódio)
    onSkip(interval);

    // 3. Feedback visual acelerado (preenchimento 100% e flash intenso)
    setIsSkipping(true);

    if (skipTimerRef.current.flashTimer) clearTimeout(skipTimerRef.current.flashTimer);
    if (skipTimerRef.current.doneTimer) clearTimeout(skipTimerRef.current.doneTimer);

    skipTimerRef.current.flashTimer = setTimeout(() => {
      setIsFlashing(true);
    }, 120);

    skipTimerRef.current.doneTimer = setTimeout(() => {
      setIsSkipping(false);
      setIsFlashing(false);
      isSkippingRef.current = false;
    }, 450);
  }, [interval, onSkip]);

  // Integração com sistema de navegação espacial do Modo Smart TV
  const { ref: tvFocusRef, focused: isTvFocused } = useTvFocusable({
    focusKey: 'tv-skip-button',
    onEnterPress: () => {
      triggerSkip();
    }
  });

  // Foco automático único no controle remoto quando o botão surge no Modo TV (sem roubar de menus/modais)
  useEffect(() => {
    if (hasAutoFocusedRef.current) return;
    if (!isTv) return;

    // Se houver algum menu, modal ou drawer aberto, o botão de pular não deve roubar o foco
    const isModalOpen = Boolean(
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[data-focus-key^="tv-drawer-"]') ||
      document.querySelector('[data-focus-key^="tv-player-drawer-"]') ||
      document.querySelector('[data-focus-key^="tv-modal-"]')
    );
    if (isModalOpen) return;

    hasAutoFocusedRef.current = true;
    try {
      setFocus('tv-skip-button');
    } catch {}
  }, [isTv]);

  // Restauração de foco ao desmontar (após o pulo ou fim do intervalo)
  useEffect(() => {
    return () => {
      if (skipTimerRef.current.flashTimer) clearTimeout(skipTimerRef.current.flashTimer);
      if (skipTimerRef.current.doneTimer) clearTimeout(skipTimerRef.current.doneTimer);
      try {
        const current = getCurrentFocusKey();
        if (current === 'tv-skip-button') {
          setFocus('tv-player-play');
        }
      } catch {}
    };
  }, []);

  // Suporte a atalho no teclado ('S') e tecla OK / Enter do controle remoto da TV
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        triggerSkip();
      } else if (
        isTvFocused &&
        (e.key === 'Enter' || e.key === 'Select' || e.keyCode === 13 || e.keyCode === 65385)
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isTvFocused, triggerSkip]);

  // Merge das refs de medição de layout e do spatial navigation
  const setMergedRef = useCallback((node: HTMLButtonElement | null) => {
    (buttonRef as any).current = node;
    if (typeof tvFocusRef === 'function') {
      (tvFocusRef as any)(node);
    } else if (tvFocusRef && 'current' in tvFocusRef) {
      (tvFocusRef as any).current = node;
    }
  }, [tvFocusRef]);

  // Calcula progresso normalizado (0 a 1)
  const progress = useMemo(() => {
    return calculateSkipProgress(currentTime, interval.startTime, interval.endTime);
  }, [currentTime, interval.startTime, interval.endTime]);

  // Tempo restante em segundos
  const remainingSeconds = useMemo(() => {
    return Math.max(0, Math.ceil(interval.endTime - currentTime));
  }, [currentTime, interval.endTime]);

  // Detecta saltos manuais (seek) para evitar transições arrastadas e permitir reuso imediato ao retroceder
  useEffect(() => {
    const delta = Math.abs(currentTime - prevTimeRef.current);
    if (delta > 1.2) {
      setIsSeeking(true);
      setIsSkipping(false);
      setIsFlashing(false);
      isSkippingRef.current = false;
      const timer = setTimeout(() => setIsSeeking(false), 80);
      prevTimeRef.current = currentTime;
      return () => clearTimeout(timer);
    }
    prevTimeRef.current = currentTime;
  }, [currentTime]);

  // Reseta estado ao trocar de intervalo ou episódio
  useEffect(() => {
    setIsSkipping(false);
    setIsFlashing(false);
    isSkippingRef.current = false;
  }, [interval.startTime, interval.endTime, interval.type]);

  // Mede as dimensões reais do botão para renderização vetorial pixel-perfect
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
  }, [interval.label, isTv]);

  const pathD = useMemo(() => {
    return generatePillPath(dimensions.width, dimensions.height, isTv ? 4 : 3.5);
  }, [dimensions.width, dimensions.height, isTv]);

  // Quando o usuário clica em pular, o offset força 0 (100% preenchido)
  const strokeDashoffset = useMemo(() => {
    if (isSkipping) return '0.00';
    return (100 - progress * 100).toFixed(2);
  }, [progress, isSkipping]);

  const handleSkipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerSkip();
  };

  return (
    <div
      className={`z-50 pointer-events-auto inline-flex items-center group select-none animate-in fade-in zoom-in-95 duration-200 ${
        isTv
          ? 'fixed bottom-[200px] sm:bottom-[210px] right-[5vw] z-[85]'
          : 'absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-28 right-[calc(1.5rem+env(safe-area-inset-right,0px))]'
      } ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes skipContourPulse {
          0% {
            filter: drop-shadow(0 0 8px #00f0ff) drop-shadow(0 0 16px #007df7);
            stroke: #00f0ff;
            opacity: 1;
          }
          25% {
            filter: drop-shadow(0 0 25px #ffffff) drop-shadow(0 0 45px #00f0ff) drop-shadow(0 0 70px #007df7);
            stroke: #ffffff;
            opacity: 0.35;
          }
          50% {
            filter: drop-shadow(0 0 30px #00f0ff) drop-shadow(0 0 55px #007df7);
            stroke: #00f0ff;
            opacity: 1;
          }
          75% {
            filter: drop-shadow(0 0 25px #ffffff) drop-shadow(0 0 45px #00f0ff);
            stroke: #ffffff;
            opacity: 0.45;
          }
          100% {
            filter: drop-shadow(0 0 35px #00f0ff) drop-shadow(0 0 65px #007df7);
            stroke: #00f0ff;
            opacity: 1;
          }
        }
      `}</style>

      {/* Aura de Glow de Fundo ao Carregar / Piscar / Foco na TV */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-300 pointer-events-none ${
          isFlashing
            ? 'bg-cyan-400/35 blur-xl opacity-100 scale-125 animate-pulse'
            : isTvFocused
            ? 'bg-[#00e5ff]/25 blur-lg opacity-90 scale-115'
            : isSkipping
            ? 'bg-blue-500/25 blur-lg opacity-80 scale-110'
            : 'opacity-0'
        }`}
      />

      {/* Contorno SVG Dinâmico (Trilha de Fundo + Contorno Progressivo com Glow Marcante) */}
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

        {/* Trilha do contorno bem visível com opacidade refinada */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={isTvFocused ? "rgba(0, 229, 255, 0.45)" : "rgba(255, 255, 255, 0.28)"}
            strokeWidth={isTv ? (isTvFocused ? 4 : 3.5) : 3.5}
          />
        )}

        {/* Contorno dinâmico que carrega 100% no clique e pisca com glow intenso */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={isFlashing ? '#00f0ff' : isTvFocused ? '#00e5ff' : `url(#${gradientId})`}
            strokeWidth={isTv ? (isSkipping || isFlashing ? 5 : isTvFocused ? 4.5 : 4) : (isSkipping || isFlashing ? 4.5 : isTvFocused ? 4 : 3.5)}
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter={isFlashing ? undefined : `url(#${filterId})`}
            style={{
              transition: isSeeking
                ? 'none'
                : isSkipping
                ? 'stroke-dashoffset 0.25s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.2s ease'
                : 'stroke-dashoffset 0.25s linear',
              animation: isFlashing ? 'skipContourPulse 0.22s ease-in-out infinite' : undefined
            }}
          />
        )}
      </svg>

      {/* Botão Clicável Estilizado com Feedback Tátil, Visual e Foco TV */}
      <button
        ref={setMergedRef}
        type="button"
        id="zapi-skip-button"
        data-focus-key="tv-skip-button"
        data-tv-focused={isTvFocused ? "true" : undefined}
        onClick={handleSkipClick}
        disabled={isSkipping}
        className={`relative z-10 flex items-center gap-3 rounded-full backdrop-blur-md uppercase tracking-wider transition-all cursor-pointer group focus:outline-none ${
          isTv
            ? 'min-h-[58px] sm:min-h-[62px] min-w-[220px] sm:min-w-[250px] px-7 py-3.5 sm:px-8 sm:py-4 text-base sm:text-[18px] font-extrabold justify-center'
            : 'px-5 py-2.5 text-xs font-bold'
        } ${
          isFlashing
            ? 'bg-black/95 text-cyan-200 scale-105 shadow-[0_0_40px_rgba(0,240,255,0.95)] ring-4 ring-cyan-300 border border-cyan-300'
            : isTvFocused
            ? 'bg-black/95 text-cyan-300 scale-105 sm:scale-110 shadow-[0_0_40px_rgba(0,229,255,0.85)] ring-4 ring-[#00e5ff] border border-[#00e5ff]'
            : isSkipping
            ? 'bg-black/95 text-white scale-105 shadow-[0_0_25px_rgba(0,125,247,0.6)]'
            : 'bg-black/85 hover:bg-black/95 text-white hover:scale-105 shadow-2xl hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]'
        }`}
        title={`${interval.label} (${remainingSeconds}s restantes) • Pressione 'S' ou clique para pular`}
      >
        <span className={isFlashing || isTvFocused ? 'text-cyan-200 font-extrabold' : ''}>
          {interval.label}
        </span>
        <SkipForward
          className={`transition-transform duration-300 ${
            isTv ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4'
          } ${
            isFlashing
              ? 'text-cyan-200 translate-x-1.5 animate-pulse'
              : isTvFocused
              ? 'text-[#00e5ff] translate-x-1 scale-110'
              : isSkipping
              ? 'text-cyan-400 translate-x-1'
              : 'text-cyan-400 group-hover:translate-x-0.5 group-hover:text-cyan-300'
          }`}
        />
      </button>
    </div>
  );
};
