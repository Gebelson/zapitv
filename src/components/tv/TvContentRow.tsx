import React, { memo, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { ContentItem } from '../../../types';
import { TvCard16x9, getCardAmbientGlow } from './TvCard16x9';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { uiSoundService } from '../../core/audio/uiSoundService';

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

// Constantes de transição cinematográfica fluida (estilo Netflix)
const NORMAL_DURATION = 320; // Duração cinematográfica suave para toques individuais (300-350ms)
const CHAINED_DURATION = 260; // Duração ágil e contínua para toques rápidos ou tecla mantida pressionada
const EASING_CURVE = 'cubic-bezier(0.22, 1, 0.36, 1)'; // Desaceleração suave e natural sem trancos

/**
 * Retorna os slots visíveis no carrossel de acordo com a quantidade de mídias disponíveis.
 * Garante que nenhuma mídia seja duplicada simultaneamente na tela quando o catálogo for reduzido,
 * mantendo sempre um slot à esquerda (-1) e à direita (1) para transição contínua.
 */
const getVisibleSlots = (count: number): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count === 2) return [-1, 0, 1];
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
  const [transitionDuration, setTransitionDuration] = useState(NORMAL_DURATION);

  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;

  const isAnimatingRef = useRef(false);
  const pendingSlideRef = useRef<'right' | 'left' | null>(null);
  const queuedDirectionRef = useRef<'right' | 'left' | null>(null);
  const targetIndexRef = useRef(0);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Finalização da transição suave com atualização atômica de slots
  const handleTransitionEnd = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (!isAnimatingRef.current) return;

    const dir = pendingSlideRef.current;
    pendingSlideRef.current = null;

    let nextIndex = currentIndexRef.current;
    if (dir === 'right') {
      nextIndex = (currentIndexRef.current + 1) % items.length;
    } else if (dir === 'left') {
      nextIndex = (currentIndexRef.current - 1 + items.length) % items.length;
    }

    // Atualiza o índice do item ativo
    setCurrentIndex(nextIndex);
    currentIndexRef.current = nextIndex;
    targetIndexRef.current = nextIndex;

    // Reseta o deslocamento físico instantaneamente com a transição desativada
    setTransitionEnabled(false);
    setTranslateX(0);

    // Se o usuário enfileirou nova direção enquanto animava, dispara continuamente sem saltos
    const queuedDir = queuedDirectionRef.current;
    queuedDirectionRef.current = null;

    if (queuedDir && items.length > 1) {
      requestAnimationFrame(() => {
        if (trackRef.current) {
          void trackRef.current.offsetHeight; // Força reflow do layout antes da próxima animação
        }
        uiSoundService.play(queuedDir === 'right' ? 'slideRight' : 'slideLeft');
        triggerSlide(queuedDir, CHAINED_DURATION);
      });
    } else {
      isAnimatingRef.current = false;
    }
  }, [items.length]);

  // Inicia o deslocamento horizontal suave do carrossel
  const triggerSlide = useCallback((direction: 'right' | 'left', duration: number = NORMAL_DURATION) => {
    if (!items || items.length <= 1) return;

    isAnimatingRef.current = true;
    pendingSlideRef.current = direction;

    const nextTarget = direction === 'right'
      ? (currentIndexRef.current + 1) % items.length
      : (currentIndexRef.current - 1 + items.length) % items.length;
    targetIndexRef.current = nextTarget;

    setTransitionDuration(duration);
    setTransitionEnabled(true);
    setTranslateX(direction === 'right' ? -stepSize : stepSize);

    // Timer de segurança caso a Smart TV demore ou descarte o evento onTransitionEnd
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = setTimeout(() => {
      handleTransitionEnd();
    }, duration + 60);
  }, [items, stepSize, handleTransitionEnd]);

  // Navegação horizontal circular para a direita: transição contínua
  const slideNext = useCallback(() => {
    if (!items || items.length <= 1) return;
    if (isAnimatingRef.current) {
      queuedDirectionRef.current = 'right';
      return;
    }
    uiSoundService.play('slideRight');
    triggerSlide('right', NORMAL_DURATION);
  }, [items, triggerSlide]);

  // Navegação horizontal circular para a esquerda: transição contínua
  const slidePrev = useCallback(() => {
    if (!items || items.length <= 1) return;
    if (isAnimatingRef.current) {
      queuedDirectionRef.current = 'left';
      return;
    }
    uiSoundService.play('slideLeft');
    triggerSlide('left', NORMAL_DURATION);
  }, [items, triggerSlide]);

  // Listener nativo de fim de transição no track
  const onTrackTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current || e.propertyName !== 'transform') return;
    handleTransitionEnd();
  }, [handleTransitionEnd]);

  // Foco espacial do Norigin na fileira inteira com ancoragem no Slot 0
  const focusKey = `row-${rowId}`;
  const { ref: noriginRef, focused } = useTvFocusable({
    focusKey,
    soundType: 'hoverCard',
    onEnterPress: () => {
      if (!items || items.length === 0) return;
      // Se estiver no meio de um deslizamento, abre o item que está chegando à seleção ativa
      const targetIdx = isAnimatingRef.current ? targetIndexRef.current : currentIndex;
      const selectedItem = items[targetIdx] || items[currentIndex] || items[0];
      if (selectedItem) {
        uiSoundService.play('detailOpen');
        onItemClick(selectedItem);
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
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
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
          {/* 1. GLOW AMBIENTE SUTIL (ATRÁS DA CAPA): Iluminação discreta projetada no fundo da página */}
          {focused && currentItem && (
            <div 
              className="absolute z-0 pointer-events-none transition-all duration-300"
              style={{
                left: `${SAFE_MARGIN_LEFT}px`,
                top: '2rem',
                width: `${cardWidth}px`,
                height: `${Math.round(cardWidth * 1.5)}px`
              }}
              aria-hidden="true"
            >
              <div 
                className="absolute -inset-4 sm:-inset-5 rounded-3xl opacity-35 filter blur-xl transform-gpu pointer-events-none"
                style={{
                  background: getCardAmbientGlow(currentItem),
                }}
              />
            </div>
          )}

          {/* 2. MOLDURA EXTERNA DE SELEÇÃO (Z-30): Fica estritamente FORA da imagem, contornando o card com 4px de respiro */}
          {focused && currentItem && (
            <div 
              className="absolute z-30 pointer-events-none transition-all duration-150 border-2 border-cyan-400"
              style={{
                left: `${SAFE_MARGIN_LEFT - 4}px`,
                top: 'calc(2rem - 4px)',
                width: `${cardWidth + 8}px`,
                height: `${Math.round(cardWidth * 1.5) + 8}px`,
                borderRadius: '20px',
                boxShadow: '0 0 14px rgba(0, 229, 255, 0.45)',
                background: 'transparent'
              }}
              aria-hidden="true"
            />
          )}

          {/* 3. Track Deslizante com cards verticais 2:3 (Z-10, entre o glow de fundo e a moldura externa) */}
          <div 
            ref={trackRef}
            onTransitionEnd={onTrackTransitionEnd}
            className="relative z-10 flex items-center gap-6 will-change-transform"
            style={{
              transform: `translate3d(${baseOffset + translateX}px, 0, 0)`,
              transition: transitionEnabled ? `transform ${transitionDuration}ms ${EASING_CURVE}` : 'none',
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
