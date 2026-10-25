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
 * Subcomponente individual do card de ranking Top 10.
 * Unidade visual de alta fidelidade: [ NÚMERO SÓLIDO BRANCO + BANNER CINEMATOGRÁFICO ]
 * - Número com preenchimento sólido branco (#ffffff), sem nenhum efeito de traçado ou contorno.
 * - Posicionado à esquerda e parcialmente atrás do banner (z-0).
 * - Banner com proporção rígida 2:3 (aspect-[2/3]), sobrepondo o número com z-10.
 * - Dimensões e espaçamentos 100% fluidos e proporcionais dentro de cada coluna do grid.
 * - Adaptação de origem do hover: borda esquerda no 1º card e borda direita no 5º card para evitar qualquer corte.
 */
const RankedCard = memo<{
  rankedItem: RankedItem;
  isDarkMode: boolean;
  isFavorite: boolean;
  isInList: boolean;
  onItemClick: (item: ContentItem) => void;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  columnIndex: number;
  onFocus?: () => void;
}>(({
  rankedItem,
  isDarkMode,
  isFavorite,
  isInList,
  onItemClick,
  onToggleFavorite,
  onToggleList,
  columnIndex,
  onFocus
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
    e.preventDefault();
    onItemClick(item);
  };

  // Ajuste do transform-origin para evitar overflow nas extremidades no hover
  const hoverOriginClass = columnIndex === 0
    ? 'origin-left'
    : columnIndex === 4
      ? 'origin-right'
      : 'origin-center';

  return (
    <div
      className="relative flex items-end w-full select-none group/ranked cursor-pointer focus:outline-none"
      style={{
        containerType: 'inline-size'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onFocus={onFocus}
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
        - Preenchimento sólido branco puro (#ffffff), tipografia pesada e monumental
        - Removido completamente qualquer traçado externo ou contorno
        - Posicionado à esquerda da capa, parcialmente atrás dela (z-0)
        - Para o número 10 (dois dígitos): kerning ajustado (-0.16em) e proporção equilibrada
        - Drop shadow para contraste cristalino sobre qualquer fundo
        ========================================================================
      */}
      <div 
        className="absolute left-0 bottom-[-2px] sm:bottom-[-4px] md:bottom-[-6px] z-0 flex items-end select-none pointer-events-none"
        style={{
          width: isDoubleDigit ? '54%' : '44%',
          justifyContent: 'flex-start'
        }}
      >
        <span
          className={`font-black select-none tracking-tighter ${
            isDoubleDigit
              ? 'text-[65px] sm:text-[85px] md:text-[105px] lg:text-[128px] xl:text-[145px] 2xl:text-[160px]'
              : 'text-[78px] sm:text-[102px] md:text-[124px] lg:text-[150px] xl:text-[170px] 2xl:text-[190px]'
          }`}
          style={{
            lineHeight: 0.72,
            fontFamily: "'Sora', 'Impact', 'Arial Black', sans-serif",
            color: '#ffffff',
            fontSize: isDoubleDigit ? 'clamp(4.2rem, 48cqw, 9.4rem)' : 'clamp(5.0rem, 58cqw, 11rem)',
            filter: isHovered
              ? 'drop-shadow(0 10px 24px rgba(0, 125, 247, 0.45)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.9))'
              : 'drop-shadow(0 4px 14px rgba(0, 0, 0, 0.85))',
            letterSpacing: isDoubleDigit ? '-0.16em' : '-0.04em',
            transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
            display: 'inline-block'
          }}
        >
          {rank}
        </span>
      </div>

      {/* 
        ========================================================================
        BANNER / PÔSTER DA OBRA
        - Alinhado à direita (ml-auto) para expor a porção visível do número à esquerda
        - Proporção rígida vertical 2:3 (aspect-[2/3]), sem esticar ou achatar
        - z-10 sobrepondo o número monumental
        - Efeito hover cinematográfico com brilho e borda azul ZapiTV
        ========================================================================
      */}
      <div
        className={`ml-auto relative z-10 w-[70%] aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${hoverOriginClass} ${
          isDarkMode ? 'bg-slate-900 border border-white/10' : 'bg-slate-200 border border-black/10'
        } ${
          isHovered
            ? 'scale-[1.03] border-[#007df7]/80 shadow-[0_15px_35px_rgba(0,125,247,0.35)] z-20'
            : 'border-white/10 shadow-black/80'
        } group-focus-visible/ranked:scale-[1.03] group-focus-visible/ranked:border-[#007df7] group-focus-visible/ranked:ring-2 group-focus-visible/ranked:ring-[#007df7]/50`}
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
          <div className="w-full h-full flex flex-col justify-end p-3 sm:p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-white select-none">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-[#007df7] mb-1">{genreLabel}</span>
            <h4 className="font-black text-xs sm:text-sm line-clamp-2">{item.title}</h4>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-[10px] sm:text-[11px] text-gray-400">
              <span>{item.year || 'N/A'}</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">★ {ratingStr}</span>
            </div>
          </div>
        )}

        {/* Badge Discreto de Avaliação no Topo Esquerdo */}
        {typeof item.rating === 'number' && item.rating > 0 && (
          <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10 pointer-events-none">
            <span className="px-1.5 py-0.5 sm:px-2 rounded-md text-[9px] sm:text-[10px] font-black bg-black/75 text-amber-400 border border-amber-400/30 backdrop-blur-md shadow-lg flex items-center gap-1">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span>{item.rating.toFixed(1)}</span>
            </span>
          </div>
        )}

        {/* Badge de Tipo no Topo Direito */}
        <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10 pointer-events-none">
          <span className={`px-1.5 py-0.5 sm:px-2 rounded-md text-[8px] sm:text-[9px] font-black text-white shadow-lg backdrop-blur-sm ${
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent opacity-0 group-hover/ranked:opacity-100 transition-opacity duration-300 p-2.5 sm:p-3 md:p-4 flex flex-col justify-between z-20">
          {/* Botões de Ação Superiores */}
          <div className="flex justify-end gap-1.5 sm:gap-2 relative z-30">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(e, item.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-200 transform active:scale-125 ${
                isFavorite 
                  ? 'bg-[#007df7] text-white shadow-lg shadow-[#007df7]/40 scale-105' 
                  : 'bg-black/60 text-white hover:bg-[#007df7]'
              }`}
              title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-label="Favoritar"
            >
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleList(e, item.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-200 transform active:scale-125 ${
                isInList 
                  ? 'bg-white text-[#007df7] shadow-lg shadow-white/40 scale-105' 
                  : 'bg-black/60 text-white hover:bg-[#007df7]'
              }`}
              title={isInList ? 'Remover da minha lista' : 'Adicionar à minha lista'}
              aria-label="Minha Lista"
            >
              <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isInList ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Botão Play Central */}
          <div className="flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-[#007df7] text-white flex items-center justify-center shadow-2xl shadow-[#007df7]/50 transform scale-90 group-hover/ranked:scale-100 transition-transform duration-300 pointer-events-auto">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white ml-0.5" />
            </div>
          </div>

          {/* Informações Inferiores */}
          <div className="text-white relative z-30 pointer-events-none">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[#007df7] block mb-0.5">
              {genreLabel}
            </span>
            <h4 className="font-black text-xs sm:text-sm text-white leading-tight mb-0.5 line-clamp-2 drop-shadow-md">
              {item.title}
            </h4>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-semibold text-gray-300">
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
 * Componente de ranking Top 10 finito, dividido exatamente em duas páginas:
 * - Página 0: Posições 1, 2, 3, 4 e 5 (exibidas simultaneamente em 5 colunas).
 * - Página 1: Posições 6, 7, 8, 9 e 10 (exibidas simultaneamente em 5 colunas).
 * - Sem loop infinito, sem clones, sem repetição cíclica.
 * - Navegação limitada entre as páginas 0 e 1, com desabilitação de setas nas extremidades.
 * - Espaçamento horizontal uniforme via CSS Grid distribuído rigorosamente em 100% da área útil,
 *   garantindo que o 5º e o 10º banners nunca fiquem cortados.
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
  // Índice da página atual: 0 (posições 1 a 5) ou 1 (posições 6 a 10)
  const [pageIndex, setPageIndex] = useState<0 | 1>(0);

  // Divide rigidamente em duas páginas de até 5 itens cada
  const page1Items = useMemo(() => items.slice(0, 5), [items]);
  const page2Items = useMemo(() => items.slice(5, 10), [items]);
  const hasSecondPage = items.length > 5;

  // Se o número de itens diminuir (ex: filtro por gênero) e não houver mais 2ª página, volta para a página 0
  useEffect(() => {
    if (!hasSecondPage && pageIndex !== 0) {
      setPageIndex(0);
    }
  }, [hasSecondPage, pageIndex]);

  // Transição de página com efeito sonoro
  const goToPage = useCallback((newIndex: 0 | 1) => {
    if (newIndex === pageIndex) return;
    uiSoundService.play(newIndex === 1 ? 'slideRight' : 'slideLeft');
    setPageIndex(newIndex);
  }, [pageIndex]);

  // Navegação por teclado acessível
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && pageIndex === 0 && hasSecondPage) {
      e.preventDefault();
      goToPage(1);
    } else if (e.key === 'ArrowLeft' && pageIndex === 1) {
      e.preventDefault();
      goToPage(0);
    }
  }, [pageIndex, hasSecondPage, goToPage]);

  // Suporte a gestos de deslize (swipe) em dispositivos touch
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50 && pageIndex === 0 && hasSecondPage) {
      goToPage(1);
    } else if (diff < -50 && pageIndex === 1) {
      goToPage(0);
    }
    touchStartX.current = null;
  };

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

        {/* Setas de Navegação Finitas do Carrossel (Página 1: 1 a 5 | Página 2: 6 a 10) */}
        {hasSecondPage && (
          <div className="flex items-center gap-2 sm:gap-2.5 z-30">
            <span className="text-xs font-semibold text-gray-400 mr-1 select-none hidden sm:inline-block">
              Página {pageIndex + 1} de 2
            </span>
            <button
              type="button"
              onClick={() => goToPage(0)}
              disabled={pageIndex === 0}
              className={`p-2.5 sm:p-3 rounded-2xl border transition-all shadow-xl shadow-black/50 ${
                pageIndex === 0
                  ? 'border-gray-800/40 bg-gray-900/30 text-gray-600 opacity-30 cursor-not-allowed pointer-events-none'
                  : 'border-gray-800 bg-gray-900/80 text-white hover:bg-[#007df7] hover:border-[#007df7] hover:scale-105 active:scale-95 cursor-pointer'
              }`}
              aria-label="Ver posições 1 a 5"
              title="Posições 1 a 5"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(1)}
              disabled={pageIndex === 1}
              className={`p-2.5 sm:p-3 rounded-2xl border transition-all shadow-xl shadow-black/50 ${
                pageIndex === 1
                  ? 'border-gray-800/40 bg-gray-900/30 text-gray-600 opacity-30 cursor-not-allowed pointer-events-none'
                  : 'border-gray-800 bg-gray-900/80 text-white hover:bg-[#007df7] hover:border-[#007df7] hover:scale-105 active:scale-95 cursor-pointer'
              }`}
              aria-label="Ver posições 6 a 10"
              title="Posições 6 a 10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Trilha Finitas de Duas Páginas com Transição Suave e Espaçamento Perfeito */}
      <div 
        className="relative w-full overflow-hidden py-6 -my-6 px-1 -mx-1 focus:outline-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label={`Ranking Top 10 - ${title}`}
      >
        <div
          className="flex w-[200%] transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{
            transform: `translateX(-${pageIndex * 50}%)`,
            willChange: 'transform'
          }}
        >
          {/* PÁGINA 1: Posições 1 a 5 */}
          <div className="w-1/2 px-1 sm:px-2">
            <div className="grid grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 w-full">
              {page1Items.map((rankedItem, idx) => (
                <RankedCard
                  key={`page0-${rankedItem.rank}-${rankedItem.item.id}`}
                  rankedItem={rankedItem}
                  isDarkMode={isDarkMode}
                  isFavorite={favorites.includes(rankedItem.item.id)}
                  isInList={myList.includes(rankedItem.item.id)}
                  onItemClick={onItemClick}
                  onToggleFavorite={onToggleFavorite}
                  onToggleList={onToggleList}
                  columnIndex={idx}
                  onFocus={() => {
                    if (pageIndex !== 0) setPageIndex(0);
                  }}
                />
              ))}
            </div>
          </div>

          {/* PÁGINA 2: Posições 6 a 10 */}
          <div className="w-1/2 px-1 sm:px-2">
            <div className="grid grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 w-full">
              {page2Items.map((rankedItem, idx) => (
                <RankedCard
                  key={`page1-${rankedItem.rank}-${rankedItem.item.id}`}
                  rankedItem={rankedItem}
                  isDarkMode={isDarkMode}
                  isFavorite={favorites.includes(rankedItem.item.id)}
                  isInList={myList.includes(rankedItem.item.id)}
                  onItemClick={onItemClick}
                  onToggleFavorite={onToggleFavorite}
                  onToggleList={onToggleList}
                  columnIndex={idx}
                  onFocus={() => {
                    if (pageIndex !== 1) setPageIndex(1);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedRankedCarousel;
