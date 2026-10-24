
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { ContentItem } from '../types';
import ContentCard from './ContentCard';
import { deduplicateContentItems } from '../src/core/catalog/catalogDeduplication';
import { uiSoundService } from '../src/core/audio/uiSoundService';
import { tvModeService } from '../src/core/tv/tvModeService';

interface ContentRowProps {
  title: string;
  items: ContentItem[];
  isDarkMode: boolean;
  onItemClick?: (item: ContentItem) => void;
  myList: string[];
  favorites: string[];
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  isAdmin?: boolean;
  onEditTitle?: () => void;
  onDeleteSection?: () => void;
}

const ContentRow: React.FC<ContentRowProps> = ({ 
  title, 
  items, 
  isDarkMode, 
  onItemClick,
  myList,
  favorites,
  onToggleFavorite,
  onToggleList,
  isAdmin,
  onEditTitle,
  onDeleteSection
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [shouldRenderCards, setShouldRenderCards] = useState(false);

  useEffect(() => {
    if (shouldRenderCards) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShouldRenderCards(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShouldRenderCards(true);
        observer.disconnect();
      }
    }, { rootMargin: '500px' });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [shouldRenderCards]);
  
  // Logic Refs
  const isDown = useRef(false);
  const lastX = useRef(0);
  const startX = useRef(0); // Armazena a posição inicial do clique para calcular o limiar de arrasto
  const dragSoundPlayed = useRef(false);
  const touchStart = useRef<{ x: number; y: number; scrollLeft: number } | null>(null);
  
  // Estado visual
  const [isActive, setIsActive] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);

  const rowFocusKey = useMemo(() => `row-${title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'default'}`, [title]);

  // Filtra itens únicos para garantir que não haja duplicatas na lista base
  const uniqueItems = useMemo(() => {
    return deduplicateContentItems(items);
  }, [items]);

  // O carrossel só é infinito em desktop/mobile quando tiver mais de 8 capas
  const isTv = tvModeService.isTvMode();
  const isInfinite = !isTv && uniqueItems.length > 8;

  // Limita a base do loop infinito a 20 itens para evitar montar centenas de cards desnecessários
  const carouselBaseItems = useMemo(() => {
    if (!isInfinite) return uniqueItems;
    return uniqueItems.length > 20 ? uniqueItems.slice(0, 20) : uniqueItems;
  }, [uniqueItems, isInfinite]);

  // Uma cópia de cada lado mantém o loop sem montar cinco vezes todos os cards.
  const multiplier = isInfinite ? 3 : 1;
  const extendedItems = useMemo(() => {
    if (!isInfinite) return uniqueItems;
    return Array(multiplier).fill(carouselBaseItems).flat();
  }, [uniqueItems, carouselBaseItems, isInfinite, multiplier]);

  const getSetWidth = useCallback(() => {
    if (!sliderRef.current || !isInfinite || carouselBaseItems.length === 0) return 0;
    const container = sliderRef.current;
    const firstItem = container.children[0] as HTMLElement;
    
    if (!firstItem) return 0;
    
    // getBoundingClientRect é mais preciso que offsetWidth
    const itemWidth = firstItem.getBoundingClientRect().width;
    const style = window.getComputedStyle(container);
    const gap = parseFloat(style.gap || '0'); 
    
    return carouselBaseItems.length * (itemWidth + gap);
  }, [carouselBaseItems.length, isInfinite]);

  // Inicializa posição no centro apenas se for infinito; senão mantém na posição inicial (0)
  useEffect(() => {
    if (!isInfinite) {
      if (sliderRef.current) {
        sliderRef.current.style.scrollBehavior = 'auto';
        sliderRef.current.scrollLeft = 0;
      }
      return;
    }

    const timer = setTimeout(() => {
      const setWidth = getSetWidth();
      if (sliderRef.current && setWidth > 0) {
        sliderRef.current.style.scrollBehavior = 'auto';
        sliderRef.current.scrollLeft = setWidth * Math.floor(multiplier / 2);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isInfinite, multiplier, getSetWidth, shouldRenderCards]);

  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Lógica de Scroll Infinito Otimizada (ativa apenas se isInfinite for true)
  const handleInfiniteScroll = useCallback(() => {
    if (!isInfinite || !sliderRef.current || uniqueItems.length === 0) return;
    
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

    scrollTimeout.current = setTimeout(() => {
      const container = sliderRef.current;
      if (!container) return;
      
      const setWidth = getSetWidth();
      if (setWidth === 0) return;
      
      const currentScroll = container.scrollLeft;
      
      const leftBound = setWidth * 0.5;
      const rightBound = setWidth * 2.2;

      if (currentScroll < leftBound || currentScroll > rightBound) {
        const relativeScroll = currentScroll % setWidth;
        container.style.scrollBehavior = 'auto';
        container.scrollLeft = (setWidth * Math.floor(multiplier / 2)) + relativeScroll;
      }
    }, 150);
  }, [isInfinite, uniqueItems.length, multiplier, getSetWidth]);

  // --- LÓGICA DO DRAGGABLE SLIDE ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    
    isDown.current = true;
    setIsActive(true);
    setDragMoved(false);

    lastX.current = e.pageX;
    startX.current = e.pageX; // Salva o ponto inicial exato
    dragSoundPlayed.current = false;
    
    sliderRef.current.style.scrollSnapType = 'none';
    sliderRef.current.style.scrollBehavior = 'auto';
  };

  const handleMouseLeave = () => {
    if (!isDown.current) return;
    stopDragging();
  };

  const handleMouseUp = () => {
    stopDragging();
  };

  const stopDragging = () => {
    isDown.current = false;
    setIsActive(false);
    
    if (sliderRef.current) {
      sliderRef.current.style.scrollSnapType = 'x proximity';
      sliderRef.current.style.scrollBehavior = 'smooth';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !sliderRef.current) return;
    
    e.preventDefault();
    
    const currentX = e.pageX;
    const delta = currentX - lastX.current;
    lastX.current = currentX;

    // Velocidade 1:1 para um arraste mais natural e fluido
    const previousScroll = sliderRef.current.scrollLeft;
    sliderRef.current.scrollLeft -= delta;

    // Só considera como arraste se mover mais de 5 pixels do ponto inicial
    // Isso evita bloquear o clique em movimentos microscópicos do mouse
    const totalMove = Math.abs(currentX - startX.current);
    if (totalMove > 5 && !dragMoved) {
      setDragMoved(true);
    }
    if (totalMove > 5 && !dragSoundPlayed.current && Math.abs(sliderRef.current.scrollLeft - previousScroll) > 0.5) {
      dragSoundPlayed.current = true;
      uiSoundService.play('slide');
    }
  };

  const handleCaptureClick = (e: React.MouseEvent) => {
    // Se houve movimento significativo, bloqueia o clique nos cards
    if (dragMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  useEffect(() => () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
  }, []);

  const scrollByButton = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const container = sliderRef.current;
      const moveAmount = container.offsetWidth * 0.8; 
      const canMove = isInfinite || (direction === 'left' ? container.scrollLeft > 1 :
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
      if (!canMove) return;
      uiSoundService.play(direction === 'left' ? 'slideLeft' : 'slideRight');
      
      container.style.scrollBehavior = 'smooth';
      container.scrollLeft = direction === 'left' ? container.scrollLeft - moveAmount : container.scrollLeft + moveAmount;
    }
  };

  if (items.length === 0 || uniqueItems.length === 0) return null;

  return (
    <section ref={sectionRef} className="relative group/section select-none">
      <div className="flex items-center justify-between mb-3 md:mb-6 px-3 sm:px-6 md:px-12">
        <div className="flex items-center gap-3 group/title">
          <h3 className={`text-base sm:text-xl md:text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h3>
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
              {onEditTitle && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onEditTitle(); }}
                  className={`p-2 rounded-lg transition-all scale-90 hover:scale-100 ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-gray-900 hover:bg-black/10'}`}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {onDeleteSection && (
                <button 
                  onClick={(e) => { e.stopPropagation(); if(confirm('Tem certeza?')) onDeleteSection(); }}
                  className={`p-2 rounded-lg transition-all scale-90 hover:scale-100 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        
        {(isInfinite || uniqueItems.length > 5) && (
          <div className="hidden md:flex gap-3 opacity-0 group-hover/section:opacity-100 transition-all duration-300 z-30">
            <button onClick={() => scrollByButton('left')} className={`p-3 rounded-2xl border transition-all hover:scale-110 active:scale-90 shadow-2xl ${isDarkMode ? 'border-gray-800 bg-gray-900/50 hover:bg-gray-800 text-white' : 'border-gray-200 bg-white hover:bg-gray-100'}`} aria-label="Rolar para a esquerda">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={() => scrollByButton('right')} className={`p-3 rounded-2xl border transition-all hover:scale-110 active:scale-90 shadow-2xl ${isDarkMode ? 'border-gray-800 bg-gray-900/50 hover:bg-gray-800 text-white' : 'border-gray-200 bg-white hover:bg-gray-100'}`} aria-label="Rolar para a direita">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      <div className="relative overflow-visible min-h-[190px] sm:min-h-[250px] md:min-h-[350px]">
        {shouldRenderCards && (
        <div 
          ref={sliderRef}
          onTouchStart={e => {
            const touch = e.touches[0];
            const container = sliderRef.current;
            touchStart.current = touch && container
              ? { x: touch.clientX, y: touch.clientY, scrollLeft: container.scrollLeft } : null;
          }}
          onTouchEnd={e => {
            const start = touchStart.current;
            const end = e.changedTouches[0];
            const container = sliderRef.current;
            if (start && end && container && Math.abs(end.clientX - start.x) > 25 &&
              Math.abs(end.clientX - start.x) > Math.abs(end.clientY - start.y) &&
              Math.abs(container.scrollLeft - start.scrollLeft) > 1) uiSoundService.play('slide');
            touchStart.current = null;
          }}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onScroll={handleInfiniteScroll}
          onClickCapture={handleCaptureClick}
          className={`
            flex gap-2.5 sm:gap-3.5 md:gap-5 lg:gap-6 overflow-x-auto no-scrollbar pb-4 sm:pb-8 md:pb-12 pt-2 md:pt-4 px-3 sm:px-6 md:px-12 
            will-change-scroll transform-gpu 
            ${isActive ? 'cursor-grabbing' : 'cursor-grab'} 
          `}
          style={{ 
            scrollSnapType: isActive ? 'none' : 'x proximity',
            WebkitMaskImage: isInfinite ? 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)' : 'none',
            maskImage: isInfinite ? 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)' : 'none'
          }}
        >
          <FocusContext.Provider value={rowFocusKey}>
            {extendedItems.map((item, index) => (
              <div 
                key={`${item.id}-${index}`} 
                className={`flex-none w-[115px] sm:w-[150px] md:w-[185px] lg:w-[215px] 2xl:w-[245px]`}
              >
                <ContentCard 
                  item={item}
                  isDarkMode={isDarkMode}
                  onItemClick={onItemClick || (() => {})}
                  isFavorite={favorites.includes(item.id)}
                  isInList={myList.includes(item.id)}
                  onToggleFavorite={onToggleFavorite}
                  onToggleList={onToggleList}
                />
              </div>
            ))}
          </FocusContext.Provider>
        </div>
        )}
      </div>
    </section>
  );
};

export default ContentRow;
