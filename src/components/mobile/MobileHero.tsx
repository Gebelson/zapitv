import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Plus, Check, Info } from 'lucide-react';
import { ContentItem } from '../../../types';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { heroCarouselStore, MAX_HERO_DISPLAY_COUNT } from '../../core/catalog/heroCarouselStore';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';

interface MobileHeroProps {
  featuredItems: ContentItem[];
  myList?: string[];
  onPlayClick?: (item: ContentItem) => void;
  onActionClick?: (item: ContentItem) => void;
  onToggleList?: (e: React.MouseEvent, id: string) => void;
}

export const MobileHero: React.FC<MobileHeroProps> = ({
  featuredItems,
  myList = [],
  onPlayClick,
  onActionClick,
  onToggleList
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const displayItems = useMemo(() => {
    return heroCarouselStore.getDisplayItems(featuredItems, MAX_HERO_DISPLAY_COUNT);
  }, [featuredItems]);

  const total = displayItems.length;

  useEffect(() => {
    if (total <= 1) return;
    autoPlayTimerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % total);
    }, 7000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [total]);

  const currentItem = displayItems[currentIndex] || displayItems[0];
  const isInList = currentItem ? myList.includes(currentItem.id) : false;

  const isPlayable = currentItem
    ? catalogEligibilityService.isItemPubliclyPlayableSync(currentItem)
    : false;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Next
        uiSoundService.play('slide');
        setCurrentIndex(prev => (prev + 1) % total);
      } else {
        // Prev
        uiSoundService.play('slide');
        setCurrentIndex(prev => (prev - 1 + total) % total);
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!currentItem) return null;

  // Usa pôster vertical de preferência no smartphone, com fallback de backdrop
  const bgImage = currentItem.poster || currentItem.image || currentItem.backdrop;

  return (
    <section
      data-testid="mobile-hero"
      aria-label="Destaque principal"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-[58vh] min-h-[420px] max-h-[560px] overflow-hidden select-none bg-[#05070a]"
    >
      {/* Imagem de Fundo com Enquadramento Otimizado para Mobile */}
      <div className="absolute inset-0">
        <img
          key={`hero-bg-${currentItem.id}`}
          src={bgImage}
          alt={currentItem.title}
          className="w-full h-full object-cover object-top filter brightness-[0.9] transition-opacity duration-500"
          onError={(e) => {
            if (currentItem.backdrop && (e.target as HTMLImageElement).src !== currentItem.backdrop) {
              (e.target as HTMLImageElement).src = currentItem.backdrop;
            }
          }}
        />

        {/* Gradientes cinematográficos para legibilidade mobile */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070a]/80 via-transparent to-transparent opacity-80" />
      </div>

      {/* Conteúdo sobreposto */}
      <div className="absolute inset-0 flex flex-col justify-end px-4 pb-4 z-10 max-w-lg mx-auto">
        {/* Metadados: Gêneros / Ano / Classificação */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5 text-[11px] text-slate-300 font-medium">
          {currentItem.genres && currentItem.genres.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md font-semibold text-white text-[10px]">
              {currentItem.genres[0]}
            </span>
          )}
          {currentItem.year && (
            <span>• {currentItem.year}</span>
          )}
          {currentItem.rating > 0 && (
            <span className="text-amber-400 font-bold">• ★ {currentItem.rating.toFixed(1)}</span>
          )}
          {currentItem.duration && (
            <span>• {currentItem.duration}m</span>
          )}
        </div>

        {/* Título do Conteúdo */}
        <h1
          className="text-2xl xs:text-3xl font-black text-white leading-tight mb-2 line-clamp-2 drop-shadow-md"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          {currentItem.title}
        </h1>

        {/* Sinopse resumida (máximo 2 linhas) */}
        {currentItem.description && (
          <p className="text-xs text-slate-300/90 line-clamp-2 mb-3.5 leading-relaxed font-normal">
            {currentItem.description}
          </p>
        )}

        {/* Botões de Ação Principais */}
        <div className="flex items-center gap-2.5 w-full">
          {/* Assistir */}
          {isPlayable ? (
            <button
              type="button"
              onClick={() => {
                uiSoundService.play('watch');
                if (onPlayClick) onPlayClick(currentItem);
                else if (onActionClick) onActionClick(currentItem);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-[#007df7] active:bg-[#0066cc] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#007df7]/30 transition-transform active:scale-95 cursor-pointer min-h-[44px]"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Assistir</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                uiSoundService.play('click');
                if (onActionClick) onActionClick(currentItem);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-white/15 active:bg-white/20 text-white font-bold text-sm flex items-center justify-center gap-2 backdrop-blur-md transition-transform active:scale-95 cursor-pointer min-h-[44px]"
            >
              <Info className="w-4 h-4" />
              <span>Ver Detalhes</span>
            </button>
          )}

          {/* Minha Lista */}
          <button
            type="button"
            onClick={(e) => {
              uiSoundService.play('click');
              if (onToggleList) onToggleList(e, currentItem.id);
            }}
            aria-label={isInList ? 'Remover da minha lista' : 'Adicionar à minha lista'}
            className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all active:scale-95 cursor-pointer min-h-[44px] ${
              isInList
                ? 'bg-[#007df7]/20 border-[#007df7] text-[#007df7]'
                : 'bg-black/40 border-white/20 text-white hover:bg-white/10'
            }`}
          >
            {isInList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>Minha Lista</span>
          </button>

          {/* Botão Info / Detalhes */}
          {isPlayable && (
            <button
              type="button"
              onClick={() => {
                uiSoundService.play('click');
                if (onActionClick) onActionClick(currentItem);
              }}
              aria-label="Mais informações da obra"
              className="p-3 rounded-xl bg-black/40 border border-white/20 text-white hover:bg-white/10 active:scale-95 transition-transform flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Indicadores de slides (dots) */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {displayItems.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  uiSoundService.play('slide');
                  setCurrentIndex(idx);
                }}
                aria-label={`Ir para destaque ${idx + 1}`}
                className={`transition-all duration-300 rounded-full h-1 ${
                  idx === currentIndex
                    ? 'w-5 bg-[#007df7]'
                    : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
