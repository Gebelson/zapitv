import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ChevronLeft, ChevronRight, Play, Heart, Bookmark, Star } from 'lucide-react';
import { ContentItem, ContentType } from '../types';
import { posterRecoveryService } from '../src/core/catalog/PosterRecoveryService';
import { uiSoundService } from '../src/core/audio/uiSoundService';

export interface RankedItem {
  item: ContentItem;
  rank: number;
}

export interface FeaturedRankedCarouselProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  items: RankedItem[];
  isDarkMode?: boolean;
  onItemClick: (item: ContentItem) => void;
  myList: string[];
  favorites: string[];
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  emptyMessage?: string;
}

/**
 * RankedCard
 * Subcomponente individual do card do ranking.
 * Unidade visual coesa: [ NÚMERO DISCRETO PROPORCIONAL + CAPA CINEMATOGRÁFICA ]
 * - Bounding box com largura fixa e uniforme para todos os ranks (1 a 10).
 * - O número fica posicionado à esquerda e parcialmente atrás da capa (z-0).
 * - Altura do número proporcional ao pôster (~65%), contorno cinza-azulado (#64748b) e preenchimento escuro (#070c18).
 * - Número 10 possui kerning e escala ajustados para manter rigorosamente a mesma largura externa.
 */
const RankedCard = memo<{
  rankedItem: RankedItem;
  isDarkMode: boolean;
  isFavorite: boolean;
  isInList: boolean;
  onItemClick: (item: ContentItem) => void;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  canClick: () => boolean;
}>(({
  rankedItem,
  isDarkMode,
  isFavorite,
  isInList,
  onItemClick,
  onToggleFavorite,
  onToggleList,
  canClick
}) => {
  const { item, rank } = rankedItem;
  const [isHovered, setIsHovered] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>(() => {
    return posterRecoveryService.getCachedPoster(item) || item.image || item.backdrop || '';
  });
  const [hasImageError, setHasImageError] = useState(false);

  const isDoubleDigit = rank >= 10;

  // Gênero ou tipo de mídia para o rótulo
  const genreLabel = item.genres && item.genres.length > 0 
    ? item.genres.slice(0, 2).join(' • ') 
    : (item.type === ContentType.SERIES ? 'Série' : 'Filme');

  const ratingStr = typeof item.rating === 'number' && item.rating > 0 
    ? item.rating.toFixed(1) 
    : (item.rating || '—');

  const handleClick = (e: React.MouseEvent) => {
    if (!canClick()) {
      e.preventDefault();
      return;
    }
    onItemClick(item);
  };

  return (
    <div
      className="relative flex items-end flex-shrink-0 select-none group/ranked cursor-pointer transition-transform duration-300 w-[190px] sm:w-[225px] md:w-[250px] lg:w-[280px] xl:w-[295px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onItemClick(item);
        }
      }}
      aria-label={`${rank}º lugar: ${item.title}`}
    >
      {/* 
        ========================================================================
        NÚMERO DO RANKING
        - Fica à esquerda da capa, parcialmente atrás dela (z-0)
        - Altura proporcional ao pôster (~60-65% da altura)
        - Contorno cinza-azulado (#64748b) discreto com iluminação azul (#38bdf8) no hover
        - Preenchimento azul-escuro fechado (#070c18)
        - Para rank 10: escala ajustada (-12%) e kerning apertado (-0.15em)
        ========================================================================
      */}
      <div 
        className="absolute left-0 bottom-[-2px] sm:bottom-[-4px] z-0 flex items-end select-none pointer-events-none"
        style={{
          width: isDoubleDigit ? '60%' : '48%',
          justifyContent: 'flex-start'
        }}
      >
        <span
          className={`font-black select-none ${
            isDoubleDigit
              ? 'text-[115px] sm:text-[135px] md:text-[150px] lg:text-[170px] xl:text-[180px]'
              : 'text-[130px] sm:text-[155px] md:text-[175px] lg:text-[195px] xl:text-[205px]'
          }`}
          style={{
            lineHeight: 0.74,
            fontFamily: "'Sora', 'Impact', 'Arial Black', sans-serif",
            color: isDarkMode ? '#070c18' : '#0f172a',
            WebkitTextFillColor: isDarkMode ? '#070c18' : '#0f172a',
            WebkitTextStroke: isHovered 
              ? '2.5px #38bdf8' 
              : '2.5px #64748b',
            filter: isHovered
              ? 'drop-shadow(0 10px 22px rgba(0, 125, 247, 0.45))'
              : 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.85))',
            letterSpacing: isDoubleDigit ? '-0.15em' : '-0.05em',
            transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
            display: 'inline-block'
          }}
        >
          {rank}
        </span>
      </div>

      {/* 
        ========================================================================
        PÔSTER DA OBRA
        - Alinhado rigidamente à direita do card (ml-auto)
        - Proporção 2:3 rígida e cinematográfica
        - z-10 sobrepondo parcialmente o número à esquerda
        - Efeito de hover suave com brilho e borda azul ZapiTV
        ========================================================================
      */}
      <div
        className={`ml-auto relative z-10 w-[140px] sm:w-[168px] md:w-[188px] lg:w-[210px] xl:w-[220px] aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
          isDarkMode ? 'bg-slate-900 border border-white/10' : 'bg-slate-200 border border-black/10'
        } ${
          isHovered
            ? 'scale-[1.03] border-[#007df7]/80 shadow-[0_15px_40px_rgba(0,125,247,0.35)] z-20'
            : 'border-white/10 shadow-black/80'
        }`}
      >
        {/* Imagem de Capa */}
        {!hasImageError && imgSrc ? (
          <img
            src={imgSrc}
            alt={item.title}
            onError={() => {
              setHasImageError(true);
            }}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 pointer-events-none group-hover/ranked:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col justify-end p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-white select-none">
            <span className="text-[10px] font-black uppercase text-[#007df7] mb-1">{genreLabel}</span>
            <h4 className="font-black text-xs md:text-sm line-clamp-2">{item.title}</h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
              <span>{item.year || 'N/A'}</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">★ {ratingStr}</span>
            </div>
          </div>
        )}

        {/* Badge Discreto de Avaliação no Topo Esquerdo */}
        {typeof item.rating === 'number' && item.rating > 0 && (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/70 text-amber-400 border border-amber-400/30 backdrop-blur-md shadow-lg flex items-center gap-1">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span>{item.rating.toFixed(1)}</span>
            </span>
          </div>
        )}

        {/* Badge de Tipo no Topo Direito */}
        <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black text-white shadow-lg backdrop-blur-sm ${
            item.type === ContentType.SERIES ? 'bg-purple-600/90' : 'bg-blue-600/90'
          }`}>
            {item.type === ContentType.SERIES ? 'SÉRIE' : 'FILME'}
          </span>
        </div>

        {/* 
          ========================================================================
          OVERLAY INTERATIVO NO HOVER
          - Favoritar e Minha Lista
          - Botão Play ZapiTV
          - Metadados elegantes
          ========================================================================
        */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover/ranked:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-between z-20">
          {/* Botões de Ação Superiores */}
          <div className="flex justify-end gap-2 relative z-30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(e, item.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 transform active:scale-125 ${
                isFavorite 
                  ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/40 scale-105' 
                  : 'bg-black/60 text-white hover:bg-[#007df7]'
              }`}
              title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-label="Favoritar"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleList(e, item.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 transform active:scale-125 ${
                isInList 
                  ? 'bg-white text-[#007df7] shadow-lg shadow-white/40 scale-105' 
                  : 'bg-black/60 text-white hover:bg-[#007df7]'
              }`}
              title={isInList ? 'Remover da minha lista' : 'Adicionar à minha lista'}
              aria-label="Minha Lista"
            >
              <Bookmark className={`w-4 h-4 ${isInList ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Botão Play Central */}
          <div className="flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-[#007df7] text-white flex items-center justify-center shadow-2xl shadow-[#007df7]/50 transform scale-90 group-hover/ranked:scale-100 transition-transform duration-300 pointer-events-auto">
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </div>
          </div>

          {/* Informações Inferiores */}
          <div className="text-white relative z-30 pointer-events-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#007df7] block mb-1">
              {genreLabel}
            </span>
            <h4 className="font-black text-xs sm:text-sm text-white leading-tight mb-1 line-clamp-2 drop-shadow-md">
              {item.title}
            </h4>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-300">
              <span className="text-amber-400 font-bold flex items-center gap-0.5">
                ★ {ratingStr}
              </span>
              <span>•</span>
              <span>{item.year || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

RankedCard.displayName = 'RankedCard';

/**
 * FeaturedRankedCarousel
 * Componente de Carrossel Horizontal Infinito para as seções Top 10 da página Em Destaque
 */
export const FeaturedRankedCarousel: React.FC<FeaturedRankedCarouselProps> = ({
  title,
  icon: Icon,
  iconColor = '#007df7',
  items,
  isDarkMode = true,
  onItemClick,
  myList,
  favorites,
  onToggleFavorite,
  onToggleList,
  emptyMessage
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const dragMoved = useRef(false);
  const isNavigating = useRef(false);

  // O carrossel opera em modo infinito quando houver ao menos 4 itens
  const isInfinite = items.length >= 4;

  // Triplicar ordenadamente os itens (Block 0: clone, Block 1: principal, Block 2: clone)
  // Permite rolagem circular infinita perfeita para esquerda e direita
  const renderList = useMemo(() => {
    if (!isInfinite) return items;
    return [
      ...items.map(it => ({ ...it, instanceId: `b0-${it.rank}-${it.item.id}` })),
      ...items.map(it => ({ ...it, instanceId: `b1-${it.rank}-${it.item.id}` })),
      ...items.map(it => ({ ...it, instanceId: `b2-${it.rank}-${it.item.id}` }))
    ];
  }, [items, isInfinite]);

  // Mede subpixel-accurate layout metrics via DOM offsetLeft
  const getBlockMetrics = useCallback(() => {
    if (!sliderRef.current || !isInfinite || items.length === 0) {
      return { totalBlockWidth: 0, unitWidth: 0 };
    }
    const container = sliderRef.current;
    const children = container.children;
    if (children.length < items.length * 2) {
      return { totalBlockWidth: 0, unitWidth: 0 };
    }

    const firstCard = children[0] as HTMLElement;
    const block1Card = children[items.length] as HTMLElement;
    if (!firstCard || !block1Card) return { totalBlockWidth: 0, unitWidth: 0 };

    // Distância geométrica exata entre o 1º card do Bloco 0 e o 1º card do Bloco 1
    const totalBlockWidth = block1Card.offsetLeft - firstCard.offsetLeft;
    const unitWidth = totalBlockWidth / items.length;

    return { totalBlockWidth, unitWidth };
  }, [isInfinite, items.length]);

  // Inicializa o scroll RIGOROSAMENTE alinhado ao Item 1 do Bloco 1 (sem exibir o 10 na frente)
  useEffect(() => {
    if (!sliderRef.current) return;
    if (!isInfinite) {
      sliderRef.current.style.scrollBehavior = 'auto';
      sliderRef.current.scrollLeft = 0;
      return;
    }

    const alignToItem1 = () => {
      if (!sliderRef.current) return;
      const { totalBlockWidth } = getBlockMetrics();
      if (totalBlockWidth > 0) {
        sliderRef.current.style.scrollBehavior = 'auto';
        sliderRef.current.scrollLeft = totalBlockWidth;
      }
    };

    // Alinhamento imediato + requestAnimationFrame + timeout defensivo para garantir cálculo após reflow
    alignToItem1();
    const rId = requestAnimationFrame(alignToItem1);
    const timer = setTimeout(alignToItem1, 60);

    return () => {
      cancelAnimationFrame(rId);
      clearTimeout(timer);
    };
  }, [isInfinite, items, getBlockMetrics]);

  // Navegação suave por botões com transição modular perfeita
  const scrollByButton = useCallback((direction: 'left' | 'right') => {
    if (!sliderRef.current) return;
    const container = sliderRef.current;

    const { totalBlockWidth, unitWidth } = getBlockMetrics();
    if (totalBlockWidth === 0 || unitWidth === 0) return;

    // Avança ~2 a 3 cards por clique dependendo do tamanho da tela
    const cardsToMove = Math.max(1, Math.min(3, Math.floor(container.clientWidth / unitWidth) || 2));
    const moveAmount = cardsToMove * unitWidth;
    const current = container.scrollLeft;

    uiSoundService.play(direction === 'left' ? 'slideLeft' : 'slideRight');
    isNavigating.current = true;

    if (direction === 'right') {
      let target = current + moveAmount;
      // Se ultrapassar o bloco 2, normaliza para o bloco 1 antes de deslizar
      if (target >= 2 * totalBlockWidth) {
        container.style.scrollBehavior = 'auto';
        container.scrollLeft = current - totalBlockWidth;
        target = container.scrollLeft + moveAmount;
      }
      container.style.scrollBehavior = 'smooth';
      container.scrollLeft = target;
    } else {
      let target = current - moveAmount;
      // Se recuar antes do bloco 1, normaliza para o bloco 2 antes de deslizar
      if (target < totalBlockWidth) {
        container.style.scrollBehavior = 'auto';
        container.scrollLeft = current + totalBlockWidth;
        target = container.scrollLeft - moveAmount;
      }
      container.style.scrollBehavior = 'smooth';
      container.scrollLeft = target;
    }

    // Libera a trava de navegação após a animação de deslizamento
    setTimeout(() => {
      isNavigating.current = false;
    }, 450);
  }, [getBlockMetrics]);

  // Monitor de normalização para scroll livre via trackpad ou mouse drag
  const handleScroll = useCallback(() => {
    if (!isInfinite || !sliderRef.current || isNavigating.current) return;
    const container = sliderRef.current;
    const { totalBlockWidth } = getBlockMetrics();
    if (totalBlockWidth === 0) return;

    const current = container.scrollLeft;

    // Se estiver muito à direita (no final do bloco 2)
    if (current >= 2 * totalBlockWidth) {
      container.style.scrollBehavior = 'auto';
      container.scrollLeft = current - totalBlockWidth;
    } 
    // Se estiver muito à esquerda (no bloco 0)
    else if (current < totalBlockWidth * 0.5) {
      container.style.scrollBehavior = 'auto';
      container.scrollLeft = current + totalBlockWidth;
    }
  }, [isInfinite, getBlockMetrics]);

  // Manipulação de Arraste com Mouse (Draggable)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    isDown.current = true;
    dragMoved.current = false;
    startX.current = e.pageX;
    scrollStart.current = sliderRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !sliderRef.current) return;
    const dx = e.pageX - startX.current;
    if (Math.abs(dx) > 6) {
      dragMoved.current = true;
    }
    sliderRef.current.style.scrollBehavior = 'auto';
    sliderRef.current.scrollLeft = scrollStart.current - dx;
    handleScroll();
  };

  const handleMouseUp = () => {
    isDown.current = false;
  };

  const handleMouseLeave = () => {
    isDown.current = false;
  };

  // Navegação por teclado acessível
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollByButton('right');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollByButton('left');
    }
  };

  const canClickCard = useCallback(() => !dragMoved.current, []);

  // Seção vazia quando nenhum item corresponder aos filtros aplicados
  if (!items || items.length === 0) {
    return (
      <section className="space-y-4 select-none">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-5 h-5 md:w-6 md:h-6" />}
          <h3 className="text-base sm:text-lg md:text-2xl font-black text-white tracking-tight">
            {title}
          </h3>
        </div>
        <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 text-gray-400 text-sm">
          {emptyMessage || 'Nenhum conteúdo em destaque corresponde ao filtro selecionado.'}
        </div>
      </section>
    );
  }

  return (
    <section className="relative group/ranked-section select-none space-y-4 sm:space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-md"
              style={{
                backgroundColor: `${iconColor}15`,
                borderColor: `${iconColor}30`,
                color: iconColor
              }}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight leading-tight">
              {title}
            </h3>
          </div>
        </div>

        {/* Setas de Navegação do Carrossel */}
        {isInfinite && (
          <div className="hidden sm:flex items-center gap-2.5 z-30">
            <button
              onClick={() => scrollByButton('left')}
              className="p-2.5 sm:p-3 rounded-2xl border border-gray-800 bg-gray-900/60 text-white hover:bg-[#007df7] hover:border-[#007df7] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/50"
              aria-label={`Rolar ${title} para a esquerda`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollByButton('right')}
              className="p-2.5 sm:p-3 rounded-2xl border border-gray-800 bg-gray-900/60 text-white hover:bg-[#007df7] hover:border-[#007df7] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/50"
              aria-label={`Rolar ${title} para a direita`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Trilha Horizontal do Carrossel */}
      <div className="relative overflow-visible">
        <div
          ref={sliderRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="flex items-end gap-4 sm:gap-5 md:gap-6 lg:gap-7 xl:gap-8 overflow-x-auto scrollbar-none py-6 sm:py-8 px-2 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 rounded-2xl"
          style={{
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {renderList.map((rankedItem: any) => (
            <div 
              key={rankedItem.instanceId || `item-${rankedItem.rank}-${rankedItem.item.id}`}
              className="flex-shrink-0"
            >
              <RankedCard
                rankedItem={rankedItem}
                isDarkMode={isDarkMode}
                isFavorite={favorites.includes(rankedItem.item.id)}
                isInList={myList.includes(rankedItem.item.id)}
                onItemClick={onItemClick}
                onToggleFavorite={onToggleFavorite}
                onToggleList={onToggleList}
                canClick={canClickCard}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedRankedCarousel;
