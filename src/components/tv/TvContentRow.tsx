import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { ContentItem } from '../../../types';
import { TvCard16x9 } from './TvCard16x9';
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

  // Índice do item ativo fixado na primeira posição visível (Slot 0)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const isAnimatingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Medição precisa da largura do card + gap (step) para transição fluida sem saltos
  const slotMeasureRef = useRef<HTMLDivElement>(null);
  const [stepSize, setStepSize] = useState(284);

  useEffect(() => {
    const measure = () => {
      if (slotMeasureRef.current) {
        const w = slotMeasureRef.current.getBoundingClientRect().width;
        if (w > 120) {
          setStepSize(Math.round(w + 24)); // 24px = gap-6
        }
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Navegação horizontal circular: avança mantendo a seleção na primeira posição
  const slideNext = useCallback(() => {
    if (!items || items.length <= 1 || isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setTransitionEnabled(true);
    setTranslateX(-stepSize);

    timerRef.current = setTimeout(() => {
      setTransitionEnabled(false);
      setCurrentIndex(prev => (prev + 1) % items.length);
      setTranslateX(0);
      isAnimatingRef.current = false;
    }, 200);
  }, [items, stepSize]);

  // Navegação horizontal circular: retrocede mantendo a seleção na primeira posição
  const slidePrev = useCallback(() => {
    if (!items || items.length <= 1 || isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setTransitionEnabled(true);
    setTranslateX(stepSize);

    timerRef.current = setTimeout(() => {
      setTransitionEnabled(false);
      setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
      setTranslateX(0);
      isAnimatingRef.current = false;
    }, 200);
  }, [items, stepSize]);

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
        return false; // Intercepta para deslocar o track e fixar o foco no Slot 0
      }
      if (direction === 'left') {
        slidePrev();
        return false; // Intercepta para deslocar o track e fixar o foco no Slot 0
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

  // Janela deslizante circular: Slot -1 (trazido na volta), Slot 0 (ativo), Slots 1 a 8 (à direita)
  const visibleSlots = items.length > 1 
    ? [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8] 
    : [0];

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
        {/* Título da Fileira (Alinhado à margem segura, sem contadores e sem selos decorativos) */}
        <div className="px-14 sm:px-16 mb-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide drop-shadow-md">
            {title}
          </h2>
        </div>

        {/* Trilho Horizontal Infinito de Ponta a Ponta na Tela */}
        <div className="relative w-full overflow-hidden py-7 sm:py-8">
          <div 
            ref={trackRef}
            className="flex items-center gap-6 will-change-transform"
            style={{
              transform: `translate3d(${translateX}px, 0, 0)`,
              transition: transitionEnabled ? 'transform 200ms cubic-bezier(0.2, 0, 0, 1)' : 'none',
              paddingLeft: '3.5rem' // 56px (pl-14) garantindo safe area e zero corte no foco
            }}
          >
            {visibleSlots.map((slotIdx) => {
              const itemIndex = (currentIndex + slotIdx + items.length * 1000) % items.length;
              const item = items[itemIndex];
              const isSlotActive = slotIdx === 0;
              const isSlotFocused = isSlotActive && focused;

              // Slot -1 fica invisível quando parado para não invadir a margem esquerda
              const isSlotMinusOne = slotIdx === -1;
              const slotOpacityClass = isSlotMinusOne 
                ? (translateX > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none') 
                : 'opacity-100';

              return (
                <div 
                  key={`slot-${slotIdx}-${item.id}`}
                  ref={slotIdx === 0 ? slotMeasureRef : undefined}
                  className={`flex-none w-[220px] sm:w-[245px] md:w-[260px] lg:w-[275px] transition-opacity duration-200 ${slotOpacityClass}`}
                >
                  <TvCard16x9
                    item={item}
                    onClick={() => onItemClick(item)}
                    showProgress={showProgress}
                    priority={slotIdx >= 0 && slotIdx <= 4}
                    isFocusable={false}
                    isFocused={isSlotFocused}
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
