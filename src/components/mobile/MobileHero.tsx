import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Info, Bookmark } from 'lucide-react';
import { ContentItem } from '../../../types';
import { uiSoundService } from '../../core/audio/uiSoundService';
import { heroCarouselStore, MAX_HERO_DISPLAY_COUNT } from '../../core/catalog/heroCarouselStore';
import { catalogEligibilityService } from '../../core/catalog/CatalogEligibilityService';
import { heroImageService, ZAPITV_HERO_FALLBACK_IMAGE } from '../../core/catalog/heroImageService';

interface MobileHeroProps {
  featuredItems: ContentItem[];
  myList?: string[];
  onPlayClick?: (item: ContentItem) => void;
  onActionClick?: (item: ContentItem) => void;
  onToggleList?: (e: React.MouseEvent, id: string) => void;
}

export interface ActiveHeroSlide {
  item: ContentItem;
  imageUrl: string;
  generation: number;
}

export const MobileHero: React.FC<MobileHeroProps> = ({
  featuredItems,
  myList = [],
  onPlayClick,
  onActionClick,
  onToggleList
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedItemIds, setFailedItemIds] = useState<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const generationRef = useRef(0);

  const displayItems = useMemo(() => {
    return heroCarouselStore.getDisplayItems(featuredItems, MAX_HERO_DISPLAY_COUNT);
  }, [featuredItems]);

  // Filtra itens cujas imagens falharam completamente em todas as fontes
  const activeItems = useMemo(() => {
    const valid = displayItems.filter(item => item && !failedItemIds.has(item.id));
    return valid.length > 0 ? valid : displayItems;
  }, [displayItems, failedItemIds]);

  const total = activeItems.length;
  const targetItem = activeItems[currentIndex % Math.max(1, total)] || activeItems[0];

  // Slide ativo unificado mantendo item, imagem validada e geração rigorosamente sincronizados
  const [displayedSlide, setDisplayedSlide] = useState<ActiveHeroSlide | null>(() => {
    const initialItem = activeItems[0];
    if (!initialItem) return null;
    const candidates = heroImageService.getCandidateUrls(initialItem);
    const initialUrl = candidates.find(u => !heroImageService.isUrlFailed(u)) || ZAPITV_HERO_FALLBACK_IMAGE;
    return {
      item: initialItem,
      imageUrl: initialUrl,
      generation: 0
    };
  });
  const [prevSlide, setPrevSlide] = useState<ActiveHeroSlide | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Transição coordenada atômica: garante que título, metadados e imagem pertençam à mesma obra
  useEffect(() => {
    if (!targetItem) return;

    const currentGen = ++generationRef.current;
    const controller = new AbortController();
    let isMounted = true;

    const isSameItem = displayedSlide?.item?.id === targetItem.id;

    const transitionToSlide = async () => {
      try {
        const imageResult = await heroImageService.resolveHeroImageForItem(targetItem, controller.signal);
        if (!isMounted || controller.signal.aborted || currentGen !== generationRef.current) {
          return;
        }

        // Se falhou completamente em todas as fontes e retornou o fallback institucional,
        // e há outros itens válidos no carrossel, ignora este item da rotação
        if (imageResult.isFallback && activeItems.length > 1) {
          setFailedItemIds(prev => new Set(prev).add(targetItem.id));
          return;
        }

        const nextImageUrl = imageResult.url;

        // Se o slide exibido já é este item com a imagem resolvida idêntica, nada a alterar
        if (isSameItem && displayedSlide && displayedSlide.imageUrl === nextImageUrl) {
          return;
        }

        // Atualização atômica coordenada:
        // Preserva o slide anterior na camada de baixo para transição suave sem flash
        if (displayedSlide) {
          setPrevSlide(displayedSlide);
        }

        setDisplayedSlide({
          item: targetItem,
          imageUrl: nextImageUrl,
          generation: currentGen
        });
        setIsTransitioning(true);

        setTimeout(() => {
          if (isMounted && currentGen === generationRef.current) {
            setPrevSlide(null);
            setIsTransitioning(false);
          }
        }, 500);

        // Pré-carrega o próximo slide antecipadamente (apenas imagem de fundo)
        if (total > 1) {
          const nextIndex = (currentIndex + 1) % total;
          const nextItem = activeItems[nextIndex];
          if (nextItem && nextItem.id !== targetItem.id) {
            heroImageService.preloadHeroItem(nextItem);
          }
        }
      } catch {
        // Ignora cancelamentos
      }
    };

    transitionToSlide();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [currentIndex, targetItem?.id, total, activeItems.length]);

  // Rotação automática suave
  useEffect(() => {
    if (total <= 1) return;
    autoPlayTimerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % total);
    }, 7000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [total]);

  const slideItem = displayedSlide?.item || targetItem;
  if (!slideItem || !displayedSlide) return null;

  // Aliases sincronizados para a camada dupla anti-flash do banner
  const currentDisplayImage = displayedSlide.imageUrl;
  const prevImage = prevSlide?.imageUrl || null;

  const isInList = myList.includes(slideItem.id);
  const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(slideItem);

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
        {/* Camada do slide anterior preservada durante transição para eliminar flash preto */}
        {prevImage && (
          <img
            src={prevImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-top filter brightness-[0.9]"
          />
        )}

        {/* Camada ativa do slide atual com transição suave */}
        <img
          key={`hero-bg-${displayedSlide.item.id}-${currentDisplayImage}`}
          src={currentDisplayImage}
          alt={displayedSlide.item.title}
          className={`w-full h-full object-cover object-top filter brightness-[0.9] transition-opacity duration-500 ${
            isTransitioning ? 'opacity-90' : 'opacity-100'
          }`}
          onError={() => {
            // Em caso de erro em tempo de execução, registra a falha e tenta o próximo candidato para o item ativo
            heroImageService.markUrlFailed(currentDisplayImage);
            const candidates = heroImageService.getCandidateUrls(displayedSlide.item);
            const nextCand = candidates.find(u => u !== currentDisplayImage && !heroImageService.isUrlFailed(u));
            const fallbackUrl = nextCand || ZAPITV_HERO_FALLBACK_IMAGE;
            setDisplayedSlide(prev => (prev ? { ...prev, imageUrl: fallbackUrl } : null));
          }}
        />

        {/* Gradientes cinematográficos para legibilidade mobile */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/60 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070a]/80 via-transparent to-transparent opacity-80 pointer-events-none" />
      </div>

      {/* Conteúdo sobreposto */}
      <div className="absolute inset-0 flex flex-col justify-end px-4 pb-[9px] z-10 max-w-lg mx-auto">
        {/* Metadados: Gêneros / Ano / Classificação */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5 text-[11px] text-slate-300 font-medium">
          {slideItem.genres && slideItem.genres.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md font-semibold text-white text-[10px]">
              {slideItem.genres[0]}
            </span>
          )}
          {slideItem.year && (
            <span>• {slideItem.year}</span>
          )}
          {slideItem.rating > 0 && (
            <span className="text-amber-400 font-bold">• ★ {slideItem.rating.toFixed(1)}</span>
          )}
          {slideItem.duration && (
            <span>• {slideItem.duration}m</span>
          )}
        </div>

        {/* Título Principal em Texto (Tipografia Sora, Branco, Sem Logos) */}
        <div className="flex items-end justify-start mb-3.5 min-h-[56px]">
          <h1
            className={`font-extrabold text-white text-left tracking-tight line-clamp-2 break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] ${
              slideItem.title.length > 30
                ? 'text-lg xs:text-xl sm:text-2xl leading-snug'
                : slideItem.title.length > 18
                ? 'text-xl xs:text-2xl sm:text-3xl leading-snug'
                : 'text-2xl xs:text-3xl sm:text-4xl leading-tight'
            }`}
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {slideItem.title}
          </h1>
        </div>

        {/* Botões de Ação Principais (Ordem: 1. Assistir, 2. Detalhes, 3. Minha Lista) */}
        <div className="flex items-center gap-2.5 w-full">
          {/* 1. Assistir */}
          {isPlayable ? (
            <button
              type="button"
              onClick={() => {
                uiSoundService.play('watch');
                if (onPlayClick) onPlayClick(slideItem);
                else if (onActionClick) onActionClick(slideItem);
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
                if (onActionClick) onActionClick(slideItem);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-white/15 active:bg-white/20 text-white font-bold text-sm flex items-center justify-center gap-2 backdrop-blur-md transition-transform active:scale-95 cursor-pointer min-h-[44px]"
            >
              <Info className="w-4 h-4" />
              <span>Ver Detalhes</span>
            </button>
          )}

          {/* 2. Detalhes (Posição 2, somente ícone Info, 44x44) */}
          <button
            type="button"
            onClick={() => {
              uiSoundService.play('click');
              if (onActionClick) onActionClick(slideItem);
            }}
            aria-label="Ver detalhes da obra"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-black/40 border border-white/20 text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center cursor-pointer shrink-0"
          >
            <Info className="w-5 h-5 text-white" />
          </button>

          {/* 3. Minha Lista (Posição 3, somente ícone Bookmark, 44x44) */}
          <button
            type="button"
            onClick={(e) => {
              uiSoundService.play('click');
              if (onToggleList) onToggleList(e, slideItem.id);
            }}
            aria-label={isInList ? 'Remover da minha lista' : 'Adicionar à minha lista'}
            className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 ${
              isInList
                ? 'bg-[#007df7]/20 border-[#007df7]'
                : 'bg-black/40 border-white/20 hover:bg-white/10'
            }`}
          >
            <Bookmark
              className={`w-5 h-5 transition-colors ${
                isInList
                  ? 'fill-[#007df7] text-[#007df7]'
                  : 'text-white stroke-[1.8]'
              }`}
            />
          </button>
        </div>

        {/* Indicadores de slides (dots) posicionados discretamente mais baixos */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-[19px]">
            {activeItems.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  uiSoundService.play('slide');
                  setCurrentIndex(idx);
                }}
                aria-label={`Ir para destaque ${idx + 1}`}
                className={`transition-all duration-300 rounded-full h-1 ${
                  idx === (currentIndex % total)
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
