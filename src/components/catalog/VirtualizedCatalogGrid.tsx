import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ContentItem } from '../../../types';
import ContentCard from '../../../components/ContentCard';

interface VirtualizedCatalogGridProps {
  items: ContentItem[];
  isDarkMode: boolean;
  onItemClick: (item: ContentItem) => void;
  favoritesSet: Set<string>;
  myListSet: Set<string>;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  currentView: string;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  overscanRows?: number;
}

/**
 * Mapeamento exato dos breakpoints responsivos da grade ZapiTV:
 * grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7
 * gap-3 sm:gap-4 md:gap-5 lg:gap-6
 */
function getGridColumns(width: number): { cols: number; gap: number } {
  if (width >= 1536) return { cols: 7, gap: 24 }; // 2xl (gap-6 = 24px)
  if (width >= 1280) return { cols: 6, gap: 24 }; // xl (gap-6 = 24px)
  if (width >= 1024) return { cols: 5, gap: 24 }; // lg (gap-6 = 24px)
  if (width >= 768) return { cols: 4, gap: 20 };  // md (gap-5 = 20px)
  if (width >= 640) return { cols: 3, gap: 16 };  // sm (gap-4 = 16px)
  return { cols: 2, gap: 12 };                     // <640 (gap-3 = 12px)
}

export const VirtualizedCatalogGrid: React.FC<VirtualizedCatalogGridProps> = ({
  items,
  isDarkMode,
  onItemClick,
  favoritesSet,
  myListSet,
  onToggleFavorite,
  onToggleList,
  currentView,
  scrollContainerRef,
  overscanRows = 2
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') return window.innerWidth;
    return 1280;
  });

  const [measuredCardHeight, setMeasuredCardHeight] = useState<number>(0);

  // Monitora largura do container de forma reativa com ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth(w);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { cols, gap } = useMemo(() => getGridColumns(containerWidth), [containerWidth]);

  // Altura teórica calculada por geometria pura: largura disponível dividida pelas colunas, proporção 2:3 + gap vertical
  const calculatedRowHeight = useMemo(() => {
    const availableWidth = Math.max(280, containerWidth - (cols - 1) * gap);
    const cardWidth = availableWidth / cols;
    const cardHeight = cardWidth * 1.5; // proporção 2:3 exata de ContentCard (aspect-[2/3])
    return Math.round(cardHeight + gap);
  }, [containerWidth, cols, gap]);

  // Mede a altura real de UM ÚNICO card no DOM (invariante em relação ao total de linhas montadas)
  useEffect(() => {
    if (firstCardRef.current) {
      const h = firstCardRef.current.getBoundingClientRect().height;
      if (h > 60 && Math.abs(h - measuredCardHeight) > 2) {
        setMeasuredCardHeight(Math.round(h));
      }
    }
  }, [containerWidth, items.length, measuredCardHeight]);

  // Altura efetiva por linha: utiliza a medição real de um card (se disponível) ou o cálculo geométrico preciso
  const effectiveRowHeight = useMemo(() => {
    if (measuredCardHeight > 60) {
      return measuredCardHeight + gap;
    }
    return calculatedRowHeight;
  }, [measuredCardHeight, gap, calculatedRowHeight]);

  const totalRows = Math.ceil(items.length / cols);

  // Intervalo de linhas visíveis
  const [visibleRange, setVisibleRange] = useState<{ startRow: number; endRow: number }>(() => {
    const rowsInView = Math.ceil((typeof window !== 'undefined' ? window.innerHeight : 1080) / calculatedRowHeight);
    return {
      startRow: 0,
      endRow: Math.min(totalRows, rowsInView + overscanRows)
    };
  });

  // Atualiza a janela visível no sistema de coordenadas correto do contêiner de rolagem ativo
  const updateVisibleRange = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl || totalRows === 0) {
      setVisibleRange(prev => (prev.startRow === 0 && prev.endRow === 0 ? prev : { startRow: 0, endRow: 0 }));
      return;
    }

    const containerRect = containerEl.getBoundingClientRect();
    const scroller = scrollContainerRef?.current;
    const isScrollerScrollable = !!scroller && scroller.scrollHeight > scroller.clientHeight + 1;

    let scrolledPastTop = 0;
    let viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    if (isScrollerScrollable && scroller) {
      const scrollerRect = scroller.getBoundingClientRect();
      // Distância do topo do container em relação ao topo do viewport do scroller interno
      const relativeTop = containerRect.top - scrollerRect.top;
      scrolledPastTop = Math.max(0, -relativeTop);
      viewportHeight = scroller.clientHeight || scrollerRect.height || 1080;
    } else {
      // Scroll padrão na janela (window / document)
      scrolledPastTop = Math.max(0, -containerRect.top);
      viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    }

    const rowH = effectiveRowHeight;
    if (rowH <= 0) return;

    // Linha inicial: baseada na distância rolada além do topo, com margem de respiro overscan
    const start = Math.max(0, Math.floor(scrolledPastTop / rowH) - overscanRows);
    // Linha final: baseada no final da área visível do viewport, com margem de respiro overscan
    const visibleBottom = scrolledPastTop + viewportHeight;
    const end = Math.min(totalRows, Math.ceil(visibleBottom / rowH) + overscanRows);

    setVisibleRange(prev => {
      if (prev.startRow === start && prev.endRow === end) return prev;
      return { startRow: start, endRow: end };
    });
  }, [totalRows, effectiveRowHeight, overscanRows, scrollContainerRef]);

  // Reseta ou ajusta a janela visível ao mudar de categoria (currentView) ou quando os itens mudam
  useEffect(() => {
    setVisibleRange(prev => {
      if (totalRows === 0) {
        return { startRow: 0, endRow: 0 };
      }
      // Se a posição anterior excede o novo total de linhas (ex: transição de Filmes com 500 itens para Animes com 56 itens)
      if (prev.startRow >= totalRows) {
        const viewportHeight = scrollContainerRef?.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1080);
        const rowsInView = Math.ceil(viewportHeight / effectiveRowHeight);
        return {
          startRow: 0,
          endRow: Math.min(totalRows, rowsInView + overscanRows)
        };
      }
      const validEnd = Math.min(totalRows, Math.max(prev.startRow + 1, prev.endRow));
      if (validEnd !== prev.endRow) {
        return { startRow: prev.startRow, endRow: validEnd };
      }
      return prev;
    });

    // Recalcula imediatamente a área visível
    updateVisibleRange();
  }, [currentView, totalRows, effectiveRowHeight, overscanRows, scrollContainerRef, updateVisibleRange]);

  // Listener de rolagem com requestAnimationFrame para fluidez máxima
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateVisibleRange();
          ticking = false;
        });
        ticking = true;
      }
    };

    updateVisibleRange();

    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll, { passive: true });
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      }
    };
  }, [updateVisibleRange, scrollContainerRef]);

  // Fatiamento dos itens estritamente dentro da janela visível
  const startIndex = visibleRange.startRow * cols;
  const endIndex = Math.min(items.length, visibleRange.endRow * cols);
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  // Espaçadores virtuais superior e inferior (preservam altura e posições sem desmontar excessivamente)
  const topSpacerHeight = visibleRange.startRow * effectiveRowHeight;
  const bottomSpacerHeight = Math.max(0, (totalRows - visibleRange.endRow) * effectiveRowHeight);

  return (
    <div ref={containerRef} className="w-full relative">
      {/* Espaçador Superior proporcional às linhas anteriores */}
      {topSpacerHeight > 0 && (
        <div 
          style={{ height: `${topSpacerHeight}px` }} 
          className="w-full pointer-events-none select-none"
          aria-hidden="true" 
        />
      )}

      {/* Grade Virtualizada Ativa (monta apenas cards no viewport + margem de respiro) */}
      <div 
        ref={gridRef}
        data-testid="virtualized-grid"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5 lg:gap-6"
      >
        {visibleItems.map((item, idx) => {
          const itemKey = `browse-${currentView}-${item.canonicalId || item.imdbId || item.tmdbId || item.id}`;
          return (
            <div
              key={itemKey}
              ref={idx === 0 ? firstCardRef : undefined}
              className="w-full"
            >
              <ContentCard
                item={item}
                isDarkMode={isDarkMode}
                onItemClick={onItemClick}
                isFavorite={favoritesSet.has(item.id)}
                isInList={myListSet.has(item.id)}
                onToggleFavorite={onToggleFavorite}
                onToggleList={onToggleList}
              />
            </div>
          );
        })}
      </div>

      {/* Espaçador Inferior proporcional às linhas restantes do catálogo */}
      {bottomSpacerHeight > 0 && (
        <div 
          style={{ height: `${bottomSpacerHeight}px` }} 
          className="w-full pointer-events-none select-none"
          aria-hidden="true" 
        />
      )}
    </div>
  );
};
