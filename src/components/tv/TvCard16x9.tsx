import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Play, Star } from 'lucide-react';
import { ContentItem, ContentType } from '../../../types';
import { storageService, PlaybackContinuityInfo } from '../../core/storage/storageService';
import { posterRecoveryService } from '../../core/catalog/PosterRecoveryService';
import { useTvFocusable } from '../../core/tv/useTvFocusable';

interface TvCard16x9Props {
  item: ContentItem;
  onClick: (item: ContentItem) => void;
  showProgress?: boolean;
  className?: string;
  focusKeyPrefix?: string;
  priority?: boolean;
}

export const TvCard16x9: React.FC<TvCard16x9Props> = memo(({
  item,
  onClick,
  showProgress = false,
  className = "",
  focusKeyPrefix = "tv-card",
  priority = false
}) => {
  const [imgSrc, setImgSrc] = useState<string>(() => {
    return item.backdrop || posterRecoveryService.getCachedPoster(item) || item.image || item.poster || '';
  });
  const [hasImageError, setHasImageError] = useState(false);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Progresso de reprodução real para "Continuar Assistindo"
  const [continuity, setContinuity] = useState<PlaybackContinuityInfo>(() => {
    return storageService.getPlaybackContinuity(item);
  });

  useEffect(() => {
    const handleProgress = (e: any) => {
      const cid = e?.detail?.contentId;
      if (!cid || storageService.getCandidateKeys(item).includes(cid)) {
        setContinuity(storageService.getPlaybackContinuity(item));
      }
    };
    window.addEventListener('zapitv_progress_updated', handleProgress);
    return () => window.removeEventListener('zapitv_progress_updated', handleProgress);
  }, [item]);

  // Atualiza imagem quando o item muda
  useEffect(() => {
    const nextSrc = item.backdrop || posterRecoveryService.getCachedPoster(item) || item.image || item.poster || '';
    setImgSrc(nextSrc);
    setHasImageError(!nextSrc);
  }, [item.id, item.backdrop, item.image, item.poster]);

  const handleImgError = () => {
    if (imgSrc === item.backdrop && (item.image || item.poster)) {
      setImgSrc(item.image || item.poster || '');
      return;
    }
    setHasImageError(true);
  };

  const focusKey = `${focusKeyPrefix}-${item.id}`;
  const { ref: tvFocusRef, focused: isTvFocused } = useTvFocusable({
    focusKey,
    onEnterPress: () => onClick(item),
    autoScroll: true,
    scrollInline: 'center',
    scrollBlock: 'nearest'
  });

  const setCombinedRef = useCallback((node: HTMLDivElement | null) => {
    (cardContainerRef as any).current = node;
    (tvFocusRef as any).current = node;
  }, [tvFocusRef]);

  const isEpisodic = item.type === ContentType.SERIES || item.type === ContentType.ANIME || Boolean(item.seasonsCount && item.seasonsCount > 0);
  const progressPercent = Math.min(100, Math.max(0, continuity?.percentage || 0));
  const hasValidProgress = showProgress && progressPercent > 2 && progressPercent < 95;

  return (
    <div
      ref={setCombinedRef}
      role="button"
      tabIndex={0}
      data-focus-key={focusKey}
      data-tv-focused={isTvFocused ? "true" : undefined}
      onClick={() => onClick(item)}
      className={`group/tvcard relative flex-none select-none outline-none cursor-pointer transition-all duration-200 transform-gpu ${
        isTvFocused 
          ? 'scale-105 z-40' 
          : 'hover:scale-102 z-10'
      } ${className}`}
    >
      {/* GLOW AMBIENTE DAS CAPAS (Samsung The Frame / Tizen optimized) */}
      {/* Iluminação ambiental suave associada às cores da imagem, pulsando em foco */}
      <div 
        className={`absolute -inset-2.5 sm:-inset-3.5 rounded-2xl pointer-events-none transition-all duration-300 transform-gpu ${
          isTvFocused 
            ? 'opacity-100 scale-105' 
            : 'opacity-0 scale-95'
        }`}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 125, 247, 0.55) 0%, rgba(0, 229, 255, 0.38) 40%, rgba(147, 51, 234, 0.18) 70%, transparent 80%)',
          filter: 'blur(14px)',
          zIndex: -1
        }}
        aria-hidden="true"
      />

      {/* Caixa 16:9 Principal */}
      <div className={`relative w-full aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-[#0d121d] border transition-all duration-200 shadow-xl ${
        isTvFocused
          ? 'border-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.45)] ring-2 ring-[#00e5ff]/50'
          : 'border-white/10 group-hover/tvcard:border-white/20'
      }`}>
        {/* Imagem de Fundo 16:9 */}
        {!hasImageError && imgSrc ? (
          <img
            src={imgSrc}
            alt={item.title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onError={handleImgError}
            className="w-full h-full object-cover object-center transition-transform duration-300 group-hover/tvcard:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#131b2c] via-[#0d131f] to-[#070a0f] p-4 text-center">
            <Play className="w-10 h-10 text-cyan-400/40 mb-2" />
            <span className="text-xs font-bold text-gray-300 line-clamp-1">{item.title}</span>
          </div>
        )}

        {/* Gradiente de Legibilidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent pointer-events-none" />

        {/* Informações Sobrepostas no Card */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 flex flex-col justify-end pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-gray-300">
            {item.rating ? (
              <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold bg-black/40 px-1.5 py-0.5 rounded text-[10px]">
                <Star className="w-2.5 h-2.5 fill-amber-400" />
                {item.rating.toFixed(1)}
              </span>
            ) : null}
            {item.year ? <span>{item.year}</span> : null}
            {isEpisodic && (
              <>
                <span>•</span>
                <span className="text-cyan-400 font-medium">
                  {continuity?.label || (item.type === ContentType.ANIME ? 'Anime' : 'Série')}
                </span>
              </>
            )}
          </div>

          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide line-clamp-1 drop-shadow-md">
            {item.title}
          </h3>
        </div>

        {/* Barra de Progresso Fina para Continuar Assistindo */}
        {hasValidProgress && (
          <div className="absolute inset-x-0 bottom-0 h-1 sm:h-1.5 bg-black/60 overflow-hidden pointer-events-none">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 rounded-r-full shadow-[0_0_8px_#00e5ff]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

TvCard16x9.displayName = 'TvCard16x9';
