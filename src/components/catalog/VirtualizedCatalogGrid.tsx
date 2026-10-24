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

function getGridColumns(width: number): { cols: number; gap: number } {
  if (width >= 1536) return { cols: 7, gap: 24 };
  if (width >= 1280) return { cols: 6, gap: 24 };
  if (width >= 1024) return { cols: 5, gap: 24 };
  if (width >= 768) return { cols: 4, gap: 20 };
  if (width >= 640) return { cols: 3, gap: 16 };
  return { cols: 2, gap: 12 };
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
  const sampleRowRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') return window.innerWidth;
    return 1280;
  });

  const [measuredRowHeight, setMeasuredRowHeight] = useState<number>(0);

  // Monitora largura do container de forma reativa
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

  // Mede altura real de uma linha renderizada
  const estimatedRowHeight = useMemo(() => {
    if (measuredRowHeight > 0) return measuredRowHeight;
    // Estimativa precisa baseada na proporção 2:3 + gap
    const effectiveWidth = Math.max(300, containerWidth - (cols - 1) * gap);
    const cardWidth = effectiveWidth / cols;
    const cardHeight = cardWidth * 1.5;
    return cardHeight + gap;
  }, [measuredRowHeight, containerWidth, cols, gap]);

  const totalRows = Math.ceil(items.length / cols);

  // Intervalo de linhas visíveis (startRowIndex até endRowIndex)
  const [visibleRange, setVisibleRange] = useState<{ startRow: number; endRow: number }>({
    startRow: 0,
    endRow: Math.min(totalRows, 6)
  });

  const updateVisibleRange = useCallback(() => {
    const gridEl = containerRef.current;
    if (!gridEl || totalRows === 0) return;

    const gridRect = gridEl.getBoundingClientRect();
    const viewportHeight = scrollContainerRef?.current 
      ? scrollContainerRef.current.clientHeight 
      : (typeof window !== 'undefined' ? window.innerHeight : 1080);

    const rowH = estimatedRowHeight;
    if (rowH <= 0) return;

    // Distância do topo do grid em relação ao topo da área de visualização
    const scrolledPastTop = Math.max(0, -gridRect.top);
    const start = Math.max(0, Math.floor(scrolledPastTop / rowH) - overscanRows);
    
    const visibleBottom = Math.max(0, -gridRect.top + viewportHeight);
    const end = Math.min(totalRows, Math.ceil(visibleBottom / rowH) + overscanRows);

    setVisibleRange(prev => {
      if (prev.startRow === start && prev.endRow === end) return prev;
      return { startRow: start, endRow: end };
    });
  }, [totalRows, estimatedRowHeight, overscanRows, scrollContainerRef]);

  // Registra medição precisa da linha no primeiro render ou após redimensionamento
  useEffect(() => {
    if (sampleRowRef.current) {
      const h = sampleRowRef.current.getBoundingClientRect().height;
      if (h > 100 && Math.abs(h - measuredRowHeight) > 4) {
        setMeasuredRowHeight(h + gap);
      }
    }
  }, [containerWidth, gap, measuredRowHeight, items.length]);

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

  // Fatiamento dos itens visíveis
  const startIndex = visibleRange.startRow * cols;
  const endIndex = Math.min(items.length, visibleRange.endRow * cols);
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const topSpacerHeight = visibleRange.startRow * estimatedRowHeight;
  const bottomSpacerHeight = Math.max(0, (totalRows - visibleRange.endRow) * estimatedRowHeight);

  return (
    <div ref={containerRef} className="w-full relative">
      {/* Espaçador Superior para preservar a altura e posição de rolagem */}
      {topSpacerHeight > 0 && (
        <div 
          style={{ height: `${topSpacerHeight}px` }} 
          className="w-full pointer-events-none select-none"
          aria-hidden="true" 
        />
      )}

      {/* Grade Virtualizada Ativa (monta apenas cards no viewport + margem de respiro) */}
      <div 
        ref={sampleRowRef}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5 lg:gap-6"
      >
        {visibleItems.map((item, idx) => {
          const itemKey = `browse-${currentView}-${item.canonicalId || item.imdbId || item.tmdbId || item.id}`;
          return (
            <ContentCard
              key={itemKey}
              item={item}
              isDarkMode={isDarkMode}
              onItemClick={onItemClick}
              isFavorite={favoritesSet.has(item.id)}
              isInList={myListSet.has(item.id)}
              onToggleFavorite={onToggleFavorite}
              onToggleList={onToggleList}
            />
          );
        })}
      </div>

      {/* Espaçador Inferior para preservar a altura total do catálogo */}
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
