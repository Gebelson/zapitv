import React, { useState, useRef, useLayoutEffect, useMemo, useEffect, useId } from 'react';
import { SkipForward } from 'lucide-react';
import { SkipInterval } from '../../core/skip/skipService';

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dimensions, setDimensions] = useState({ width: 195, height: 44 });
  const prevTimeRef = useRef(currentTime);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const isSkippingRef = useRef(false);

  const rawId = useId();
  const gradientId = `zapi-skip-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const filterId = `zapi-skip-filter-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // Calcula progresso normalizado (0 a 1)
  const progress = useMemo(() => {
    return calculateSkipProgress(currentTime, interval.startTime, interval.endTime);
  }, [currentTime, interval.startTime, interval.endTime]);

  // Tempo restante em segundos
  const remainingSeconds = useMemo(() => {
    return Math.max(0, Math.ceil(interval.endTime - currentTime));
  }, [currentTime, interval.endTime]);

  // Detecta saltos manuais (seek) para evitar transições arrastadas
  useEffect(() => {
    const delta = Math.abs(currentTime - prevTimeRef.current);
    if (delta > 1.5) {
      setIsSeeking(true);
      const timer = setTimeout(() => setIsSeeking(false), 80);
      prevTimeRef.current = currentTime;
      return () => clearTimeout(timer);
    }
    prevTimeRef.current = currentTime;
  }, [currentTime]);

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
  }, [interval.label]);

  const pathD = useMemo(() => {
    return generatePillPath(dimensions.width, dimensions.height, 3.5);
  }, [dimensions.width, dimensions.height]);

  // Quando o usuário clica em pular, o offset força 0 (100% preenchido)
  const strokeDashoffset = useMemo(() => {
    if (isSkipping) return '0.00';
    return (100 - progress * 100).toFixed(2);
  }, [progress, isSkipping]);

  const handleSkipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSkippingRef.current) return;
    isSkippingRef.current = true;

    // 1. Inicia animação fluida acelerada preenchendo 100% do botão
    setIsSkipping(true);

    // 2. Quando o contorno completa 100% (~300ms), ativa o piscar intenso com glow
    setTimeout(() => {
      setIsFlashing(true);
    }, 300);

    // 3. Após o flash de glow (~520ms), dispara a ação de pular
    setTimeout(() => {
      onSkip(interval);
    }, 520);
  };

  return (
    <div
      className={`absolute bottom-24 sm:bottom-28 right-6 sm:right-8 z-30 inline-flex items-center group select-none animate-in fade-in zoom-in-95 duration-200 ${className}`}
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

      {/* Aura de Glow de Fundo ao Carregar / Piscar */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-300 pointer-events-none ${
          isFlashing
            ? 'bg-cyan-400/35 blur-xl opacity-100 scale-125 animate-pulse'
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
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth={3.5}
          />
        )}

        {/* Contorno dinâmico que carrega 100% no clique e pisca com glow intenso */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={isFlashing ? '#00f0ff' : `url(#${gradientId})`}
            strokeWidth={isSkipping || isFlashing ? 4.5 : 3.5}
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter={isFlashing ? undefined : `url(#${filterId})`}
            style={{
              transition: isSeeking
                ? 'none'
                : isSkipping
                ? 'stroke-dashoffset 0.3s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.2s ease'
                : 'stroke-dashoffset 0.25s linear',
              animation: isFlashing ? 'skipContourPulse 0.22s ease-in-out infinite' : undefined
            }}
          />
        )}
      </svg>

      {/* Botão Clicável Estilizado com Feedback Tátil e Visual */}
      <button
        ref={buttonRef}
        onClick={handleSkipClick}
        disabled={isSkipping}
        className={`relative z-10 flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer group focus:outline-none ${
          isFlashing
            ? 'bg-black/95 text-cyan-300 scale-105 shadow-[0_0_35px_rgba(0,240,255,0.7)] ring-2 ring-cyan-400'
            : isSkipping
            ? 'bg-black/95 text-white scale-105 shadow-[0_0_25px_rgba(0,125,247,0.6)]'
            : 'bg-black/85 hover:bg-black/95 text-white hover:scale-105 shadow-2xl hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]'
        }`}
        title={`${interval.label} (${remainingSeconds}s restantes) • Pressione 'S' ou clique para pular`}
      >
        <span className={isFlashing ? 'animate-pulse text-cyan-200' : ''}>
          {interval.label}
        </span>
        <SkipForward
          className={`w-4 h-4 transition-transform duration-300 ${
            isFlashing
              ? 'text-cyan-200 translate-x-1.5 animate-pulse'
              : isSkipping
              ? 'text-cyan-400 translate-x-1'
              : 'text-cyan-400 group-hover:translate-x-0.5 group-hover:text-cyan-300'
          }`}
        />
      </button>
    </div>
  );
};
