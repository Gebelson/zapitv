
import React, { memo, useState, useEffect, useRef } from 'react';
import { Heart, Bookmark, Play, Star } from 'lucide-react';
import { ContentItem, ContentType } from '../types';
import { storageService, PlaybackContinuityInfo } from '../src/core/storage/storageService';
import { posterRecoveryService } from '../src/core/catalog/PosterRecoveryService';

interface ContentCardProps {
  item: ContentItem;
  isDarkMode: boolean;
  onItemClick: (item: ContentItem) => void;
  isFavorite: boolean;
  isInList: boolean;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
  onToggleList: (e: React.MouseEvent, id: string) => void;
  className?: string;
  rankPosition?: number;
}

const ContentCard: React.FC<ContentCardProps> = ({
  item,
  isDarkMode,
  onItemClick,
  isFavorite,
  isInList,
  onToggleFavorite,
  onToggleList,
  className = "",
  rankPosition
}) => {
  // Verifica se é visualmente um Anime (por tipo ou gênero)
  const isAnime = item.type === ContentType.ANIME || item.genres?.includes('Anime');

  const [isInViewport, setIsInViewport] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>(() => {
    return posterRecoveryService.getCachedPoster(item) || item.image || item.backdrop || '';
  });
  const [hasImageError, setHasImageError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const [continuity, setContinuity] = useState<PlaybackContinuityInfo>(() => {
    return storageService.getPlaybackContinuity(item);
  });

  // Detecção de Visibilidade no Viewport: carrega automaticamente antes de entrar na tela, sem depender de hover
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true);
      return;
    }

    const currentCard = cardRef.current;
    if (!currentCard) {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '400px', // Antecipa o carregamento 400px antes de entrar na área visível
        threshold: 0.01
      }
    );

    observer.observe(currentCard);
    return () => observer.disconnect();
  }, [item.id]);

  useEffect(() => {
    setContinuity(storageService.getPlaybackContinuity(item));
    const handleProgress = (e: any) => {
      const keys = storageService.getCandidateKeys(item);
      if (keys.includes(e.detail?.contentId)) {
        setContinuity(storageService.getPlaybackContinuity(item));
      }
    };
    window.addEventListener('zapitv_progress_updated', handleProgress);
    return () => window.removeEventListener('zapitv_progress_updated', handleProgress);
  }, [item.id]);

  // Sincroniza imagem se o item mudar
  useEffect(() => {
    const cached = posterRecoveryService.getCachedPoster(item);
    const initial = cached || item.image || item.backdrop || '';
    setImgSrc(initial);
    setHasImageError(!initial);

    // Se o item inicial não possui imagem ou tem URL nula/vazia, tenta recuperação imediata
    if (!initial) {
      let isMounted = true;
      posterRecoveryService.recoverPoster(item).then(recovered => {
        if (isMounted && recovered) {
          setImgSrc(recovered);
          setHasImageError(false);
        }
      });
      return () => { isMounted = false; };
    }
  }, [item.id, item.image, item.backdrop]);

  // Tratamento inteligente de erro de imagem com recuperação automática oficial
  const handleImageError = () => {
    if (imgSrc && imgSrc === item.image && item.backdrop && item.backdrop !== item.image) {
      setImgSrc(item.backdrop);
      return;
    }

    // Tenta recuperação canônica via TMDB/AniList sem depender de ação do usuário
    posterRecoveryService.recoverPoster(item).then(recoveredUrl => {
      if (recoveredUrl && recoveredUrl !== imgSrc) {
        setImgSrc(recoveredUrl);
        setHasImageError(false);
      } else {
        setHasImageError(true);
      }
    }).catch(() => {
      setHasImageError(true);
    });
  };

  useEffect(() => {
    let active = true;
    import('../src/core/catalog/CatalogAvailabilityQueue').then(({ catalogAvailabilityQueue }) => {
      if (active) catalogAvailabilityQueue.enqueue(item, 1);
    }).catch(error => console.warn('Falha ao iniciar verificação da fonte:', error));
    return () => { active = false; };
  }, [item.id]);

  return (
    <div 
      ref={cardRef}
      onClick={() => onItemClick(item)}
      className={`flex-none w-full max-w-full min-w-0 group/card cursor-pointer transition-all duration-300 hover:scale-105 hover:z-30 relative transform-gpu will-change-transform ${className}`}
    >
      {/* Brilho Azul no Hover - hardware accelerated */}
          <div className="absolute inset-x-0 inset-y-[35%] rounded-full opacity-0 group-hover/card:opacity-100 transition-all duration-500 blur-2xl pointer-events-none transform-gpu translate-z-0" style={{ backgroundColor: '#007df7', zIndex: -1 }} />
          
          <div className={`relative w-full max-w-full aspect-[2/3] rounded-xl md:rounded-2xl overflow-hidden transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900 border border-white/10 group-hover/card:border-white/20 shadow-lg'
              : 'bg-transparent border-0 border-none shadow-md shadow-black/5 group-hover/card:border-none'
          }`}>
            {hasImageError || !imgSrc ? (
              <div className={`w-full h-full flex flex-col justify-end p-4 relative select-none ${
                isDarkMode
                  ? 'bg-gradient-to-br from-[#1a2232] via-[#0f141d] to-[#070a0f] border border-white/5'
                  : 'bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300'
              }`}>
                <div className="absolute inset-0 flex items-center justify-center opacity-15">
                  <Play className="w-16 h-16 text-[#007df7]" />
                </div>
                <div className="relative z-10">
                  <span className="text-[10px] font-black uppercase text-[#007df7] tracking-wider mb-1 block">
                    {item.genres?.[0] || item.type}
                  </span>
                  <h4 className="font-black text-xs md:text-sm text-white line-clamp-2 leading-tight drop-shadow">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400 font-bold">
                    <span>{item.year}</span>
                    <span>•</span>
                    <span className="text-yellow-400 flex items-center gap-0.5">
                      ★ {item.rating}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <img 
                src={imgSrc} 
                alt={item.title} 
                onError={handleImageError}
                className="w-full h-full max-w-full object-cover transition-transform duration-700 pointer-events-none block" 
                loading={isInViewport ? "eager" : "lazy"}
                decoding="async"
                referrerPolicy="no-referrer"
              />
            )}
            
            {/* Badges de Áudio e Ranking Oficial */}
            <div className="absolute top-2 md:top-3 left-2 md:left-3 z-10 flex flex-col gap-1 items-start">
              {typeof rankPosition === 'number' && (
                <span className="px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-lg flex items-center gap-0.5 border border-amber-300/60 tracking-wider">
                  #{rankPosition}
                  {item.imdbRank && item.imdbRank !== rankPosition && (
                    <span className="text-[8px] font-bold text-black/75 ml-0.5 font-mono">
                      (IMDb #{item.imdbRank})
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Badge de Tipo */}
            <div className="absolute top-2 md:top-3 right-2 md:right-3 z-10">
              <span className={`px-2 md:px-2.5 py-1 md:py-1 rounded-md md:rounded text-[9px] md:text-[10px] font-black text-white shadow-lg ${
                item.type === ContentType.SERIES ? 'bg-purple-600' : 
                isAnime ? 'bg-cyan-600' : 'bg-blue-600'
              }`}>
                {isAnime ? ContentType.ANIME : item.type}
              </span>
            </div>

            {/* Badge de Episódio em Andamento para Séries/Animes */}
            {continuity.hasStarted && (item.type === ContentType.SERIES || isAnime) && (
              <div className="absolute bottom-2 md:bottom-2.5 left-2 md:left-2.5 z-10 pointer-events-none">
                <span className="px-2 py-0.5 rounded text-[8px] md:text-[9px] font-black bg-blue-600/90 text-white shadow-lg backdrop-blur-sm border border-blue-400/40">
                  {continuity.label}
                </span>
              </div>
            )}

            {/* Overlay Interativo */}
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2 md:p-6 z-20">
              <div className="flex flex-row gap-1.5 md:gap-3 items-center relative z-30">
                <button 
                  onClick={(e) => onToggleFavorite(e, item.id)} 
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md md:rounded-lg transition-all duration-300 transform active:scale-125 ${
                    isFavorite ? 'bg-[#007df7] text-white scale-110 shadow-lg shadow-[#007df7]/40' : 'bg-black/60 text-white hover:bg-[#007df7]'
                  }`}
                >
                  <Heart className={`w-3 h-3 md:w-4 md:h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
                <button 
                  onClick={(e) => onToggleList(e, item.id)} 
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md md:rounded-lg transition-all duration-300 transform active:scale-125 ${
                    isInList ? 'bg-white text-[#007df7] scale-110 shadow-lg shadow-white/40' : 'bg-black/60 text-white hover:bg-[#007df7]'
                  }`}
                >
                  <Bookmark className={`w-3 h-3 md:w-4 md:h-4 ${isInList ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 md:w-16 md:h-16 bg-[#007df7] rounded-full flex items-center justify-center shadow-xl transform scale-75 group-hover/card:scale-100 transition-transform duration-300 pointer-events-auto">
                  <Play className="w-5 h-5 md:w-8 md:h-8 text-white fill-current ml-0.5 md:ml-1" />
                </div>
              </div>

              <div className="text-white relative z-30 pb-1">
                {continuity.hasStarted && (item.type === ContentType.SERIES || isAnime) && (
                  <span className="text-[9px] md:text-xs text-[#007df7] font-black block mb-0.5">
                    {continuity.label} • {continuity.formattedPosition}
                  </span>
                )}
                <h4 className="font-bold text-[10px] md:text-lg mb-1 md:mb-2 leading-snug line-clamp-2 drop-shadow-md py-0.5">{item.title}</h4>
                <div className="flex items-center gap-1 md:gap-3">
                  <span className="text-[8px] md:text-xs flex items-center gap-0.5 md:gap-1.5 font-black">
                    <Star className="w-2 h-2 md:w-4 md:h-4 fill-[#007df7] text-[#007df7]" />
                    {item.rating}
                  </span>
                  <span className="text-[8px] md:text-xs opacity-60 font-bold">{item.year}</span>
                </div>
              </div>
            </div>

            {/* Barrinha Vermelha de Progresso Assistido (Estilo Netflix) */}
            {continuity.percentage > 0 && (
              <div className="absolute bottom-0 inset-x-0 h-1 md:h-1.5 bg-black/70 z-30 overflow-hidden pointer-events-none">
                <div 
                  className="h-full bg-red-600 transition-all duration-300 shadow-[0_0_8px_rgba(220,38,38,0.8)]"
                  style={{ width: `${Math.min(100, Math.max(3, continuity.percentage))}%` }}
                />
              </div>
            )}
          </div>
    </div>
  );
};

export default memo(ContentCard);
