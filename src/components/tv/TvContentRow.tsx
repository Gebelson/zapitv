import React, { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { ContentItem } from '../../../types';
import { TvCard16x9, getCardAmbientGlow } from './TvCard16x9';
import { useTvFocusable } from '../../core/tv/useTvFocusable';

interface TvContentRowProps {
  title: string;
  items: ContentItem[];
  rowId: string;
  onItemClick: (item: ContentItem) => void;
  showProgress?: boolean;
  badge?: string;
  onRowUp?: () => void;
  onRowDown?: () => void;
}

// Margem segura da interface (55-65px na resolução de referência 1920x1080)
// 64px alinha com precisão milimétrica com o título da seção (sm:px-16 = 4rem = 64px)
const SAFE_MARGIN_LEFT = 64;
const CARD_GAP = 24; // gap-6 = 24px

/**
 * Retorna os slots visíveis no carrossel de acordo com a quantidade de mídias disponíveis.
 * Garante que nenhuma mídia seja duplicada simultaneamente na tela quando o catálogo for reduzido.
 */
const getVisibleSlots = (count: number): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count === 2) return [-1, 0];
  if (count === 3) return [-1, 0, 1];
  if (count === 4) return [-1, 0, 1, 2];
  if (count === 5) return [-1, 0, 1, 2, 3];
  if (count === 6) return [-1, 0, 1, 2, 3, 4];
  if (count === 7) return [-1, 0, 1, 2, 3, 4, 5];
  // Catálogo completo (>= 8 itens): buffer de 2 cards à esquerda (-2, -1), card selecionado (0) e cards visíveis à direita (1 a 7)
  return [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
};

export const TvContentRow: React.FC<TvContentRowProps> = memo(({
  title,
  items,
  rowId,
  onItemClick,
  showProgress = false,
  badge,
  onRowUp,
  onRowDown
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Índice do item ativo fixado na primeira posição visível (Slot 0 em SAFE_MARGIN_LEFT)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const isAnimatingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSlideRef = useRef<'right' | 'left' | null>(null);

  // Medição precisa da largura do card + gap (step) para transição fluida sem saltos
  const slotMeasureRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(260);
  const [stepSize, setStepSize] = useState(284);

  useEffect(() => {
    const measure = () => {
      if (slotMeasureRef.current) {
        const w = slotMeasureRef.current.getBoundingClientRect().width;
        if (w > 100) {
          const wInt = Math.round(w);
          setCardWidth(wInt);
          setStepSize(wInt + CARD_GAP);
        }
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Descarrega qualquer animação pendente imediatamente para permitir navegação rápida contínua
  const flushPendingSlide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isAnimatingRef.current && pendingSlideRef.current) {
      const dir = pendingSlideRef.current;
      pendingSlideRef.current = null;
      if (dir === 'right') {
        setCurrentIndex(prev => (prev + 1) % items.length);
      } else if (dir === 'left') {
        setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
      }
      setTransitionEnabled(false);
      setTranslateX(0);
      isAnimatingRef.current = false;
    }
  }, [items.length]);

  // Navegação horizontal circular para a direita: o trilho desliza e a seleção permanece fixa
  const slideNext = useCallback(() => {
    if (!items || items.length <= 1) return;
    if (isAnimatingRef.current) {
      flushPendingSlide();
    }

    isAnimatingRef.current = true;
    pendingSlideRef.current = 'right';
    setTransitionEnabled(true);
    setTranslateX(-stepSize);

    timerRef.current = setTimeout(() => {
      setTransitionEnabled(false);
      setCurrentIndex(prev => (prev + 1) % items.length);
      setTranslateX(0);
      isAnimatingRef.current = false;
      pendingSlideRef.current = null;
    }, 180);
  }, [items, stepSize, flushPendingSlide]);

  // Navegação horizontal circular para a esquerda: o trilho desliza e a seleção permanece fixa
  const slidePrev = useCallback(() => {
    if (!items || items.length <= 1) return;
    if (isAnimatingRef.current) {
      flushPendingSlide();
    }

    isAnimatingRef.current = true;
    pendingSlideRef.current = 'left';
    setTransitionEnabled(true);
    setTranslateX(stepSize);

    timerRef.current = setTimeout(() => {
      setTransitionEnabled(false);
      setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
      setTranslateX(0);
      isAnimatingRef.current = false;
      pendingSlideRef.current = null;
    }, 180);
  }, [items, stepSize, flushPendingSlide]);

  // Foco espacial do Norigin na fileira inteira com ancoragem no Slot 0
  const focusKey = `row-${rowId}`;
  const { ref: noriginRef, focused } = useTvFocusable({
    focusKey,
    onEnterPress: () => {
      if (items && items[currentIndex]) {
        onItemClick(items[currentIndex]);
      }
    },
    onArrowPress: (direction) => {
      if (direction === 'right') {
        slideNext();
        return false; // Intercepta para deslocar o track mantendo o foco fixo no Slot 0
      }
      if (direction === 'left') {
        slidePrev();
        return false; // Intercepta para deslocar o track mantendo o foco fixo no Slot 0
      }
      if (direction === 'up') {
        if (onRowUp) {
          onRowUp();
          return false;
        }
        return true;
      }
      if (direction === 'down') {
        if (onRowDown) {
          onRowDown();
          return false;
        }
        return true;
      }
      return true;
    },
    autoScroll: false
  });

  const setRowRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as any).current = node;
    (noriginRef as any).current = node;
  }, [noriginRef]);

  // Centralização suave no viewport vertical ao receber foco
  useEffect(() => {
    if (focused && containerRef.current) {
      containerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [focused]);

  // Limpeza de timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!items || items.length === 0) {
    return null;
  }

  // Janela circular de renderização calculada com base na quantidade real de itens
  const visibleSlots = useMemo(() => getVisibleSlots(items.length), [items.length]);
  const negativeSlotsCount = visibleSlots.filter(s => s < 0).length;
  // Offset base posiciona o Slot 0 rigorosamente em SAFE_MARGIN_LEFT (64px)
  const baseOffset = SAFE_MARGIN_LEFT - negativeSlotsCount * stepSize;
  const currentItem = items[currentIndex] || items[0];

  return (
    <FocusContext.Provider value={focusKey}>
      <section 
        ref={setRowRef}
        id={`row-${rowId}`}
        data-focus-key={focusKey}
        data-tv-focused={focused ? "true" : undefined}
        className="w-full mb-10 sm:mb-12 select-none overflow-hidden focus:outline-none"
        aria-label={title}
      >
        {/* Título da Fileira (Alinhado com a margem segura de 64px, sem contadores) */}
        <div className="px-14 sm:px-16 mb-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide drop-shadow-md">
            {title}
          </h2>
        </div>

        {/* Trilho Horizontal Infinito de Ponta a Ponta na Tela */}
        <div className="relative w-full overflow-hidden py-8">
          {/* MOLDURA FIXA DE SELEÇÃO: Permanece imóvel em SAFE_MARGIN_LEFT enquanto o conteúdo desliza por baixo */}
          {focused && currentItem && (
            <div 
              className="absolute z-30 pointer-events-none transition-all duration-200"
              style={{
                left: `${SAFE_MARGIN_LEFT}px`,
                top: '2rem', // 32px alinhado exatamente ao py-8 do container
                width: `${cardWidth}px`,
                aspectRatio: '2/3'
              }}
            >
              {/* Glow Ambiente Atmosférico que acompanha as cores do item selecionado */}
              <div 
                className="absolute -inset-3 sm:-inset-4 rounded-3xl pointer-events-none transition-all duration-300 transform-gpu opacity-85"
                style={{
                  background: getCardAmbientGlow(currentItem),
                  filter: 'blur(20px)',
                  zIndex: -1
                }}
                aria-hidden="true"
              />

              {/* Contorno Ciano Original ZapiTV de 2px com glow suave e cantos perfeitamente simétricos */}
              <div className="w-full h-full rounded-2xl border-2 border-cyan-400 shadow-[0_0_24px_rgba(0,229,255,0.6),0_12px_28px_rgba(0,0,0,0.85)]" />
            </div>
          )}

          {/* Track Deslizante com cards verticais 2:3 */}
          <div 
            ref={trackRef}
            className="flex items-center gap-6 will-change-transform"
            style={{
              transform: `translate3d(${baseOffset + translateX}px, 0, 0)`,
              transition: transitionEnabled ? 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
          >
            {visibleSlots.map((slotIdx) => {
              const itemIndex = ((currentIndex + slotIdx) % items.length + items.length) % items.length;
              const item = items[itemIndex];
              const isSlotActive = slotIdx === 0;
              const isSlotFocused = isSlotActive && focused;

              return (
                <div 
                  key={`slot-${slotIdx}`}
                  ref={slotIdx === 0 ? slotMeasureRef : undefined}
                  className="flex-none w-[220px] sm:w-[245px] md:w-[260px] lg:w-[275px] opacity-100"
                >
                  <TvCard16x9
                    item={item}
                    onClick={() => onItemClick(item)}
                    showProgress={showProgress}
                    priority={slotIdx >= 0 && slotIdx <= 4}
                    isFocusable={false}
                    isFocused={isSlotFocused}
                    disableScale={true}
                    suppressFocusBorder={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </FocusContext.Provider>
  );
});

TvContentRow.displayName = 'TvContentRow';
