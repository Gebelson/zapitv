import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Star } from 'lucide-react';
import { ContentItem, ContentType } from '../../../types';
import { storageService, PlaybackContinuityInfo } from '../../core/storage/storageService';
import { posterRecoveryService } from '../../core/catalog/PosterRecoveryService';
import { useTvFocusable } from '../../core/tv/useTvFocusable';
import { tvPerformanceProfileService } from '../../core/tv/tvPerformanceProfileService';

interface TvCardProps {
  item: ContentItem;
  onClick: (item: ContentItem) => void;
  showProgress?: boolean;
  className?: string;
  focusKeyPrefix?: string;
  priority?: boolean;
  onUpPress?: () => void;
  onFocus?: () => void;
  isFocused?: boolean;
  isFocusable?: boolean;
  disableScale?: boolean;
  suppressFocusBorder?: boolean;
}

// Gera o gradiente de glow ambiente suave personalizado de acordo com o gênero e tom da obra
export function getCardAmbientGlow(item: ContentItem): string {
  const genreStr = ((item.genres && item.genres[0]) || item.type || '').toLowerCase();
  
  if (genreStr.includes('terror') || genreStr.includes('suspense') || genreStr.includes('guerra')) {
    return 'radial-gradient(ellipse at center, rgba(225, 29, 72, 0.6) 0%, rgba(190, 18, 60, 0.4) 40%, rgba(159, 18, 57, 0.2) 70%, transparent 80%)';
  }
  if (genreStr.includes('comédia') || genreStr.includes('aventura') || genreStr.includes('infantil') || genreStr.includes('família')) {
    return 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.6) 0%, rgba(234, 88, 12, 0.4) 40%, rgba(180, 83, 9, 0.2) 70%, transparent 80%)';
  }
  if (genreStr.includes('drama') || genreStr.includes('romance')) {
    return 'radial-gradient(ellipse at center, rgba(217, 70, 239, 0.6) 0%, rgba(168, 85, 247, 0.4) 40%, rgba(126, 34, 206, 0.2) 70%, transparent 80%)';
  }
  if (genreStr.includes('anime') || genreStr.includes('fantasia')) {
    return 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.6) 0%, rgba(59, 130, 246, 0.42) 40%, rgba(6, 182, 212, 0.22) 70%, transparent 80%)';
  }
  // Padrão ZapiTV: azul elétrico e ciano neon atmosférico
  return 'radial-gradient(ellipse at center, rgba(0, 125, 247, 0.6) 0%, rgba(0, 229, 255, 0.42) 40%, rgba(147, 51, 234, 0.2) 70%, transparent 80%)';
}

/**
 * Card Vertical Cinematográfico 2:3 para Smart TV
 * Exportado como TvCard16x9 e TvCardVertical para compatibilidade com a suíte de testes e componentes.
 */
export const TvCard16x9: React.FC<TvCardProps> = memo(({
  item,
  onClick,
  showProgress = false,
  className = "",
  focusKeyPrefix = "tv-card",
  priority = false,
  onUpPress,
  onFocus,
  isFocused,
  isFocusable = true,
  disableScale = false,
  suppressFocusBorder = false
}) => {
  // Prioriza o poster vertical real em 2:3 com luminosidade e cores originais
  const rawPoster = posterRecoveryService.getCachedPoster(item) || item.image || item.poster || item.backdrop || '';
  const targetPoster = tvPerformanceProfileService.getOptimizedPosterUrl(rawPoster);
  const [prevItemId, setPrevItemId] = useState(item.id);
  const [imgSrc, setImgSrc] = useState<string>(targetPoster);
  const [hasImageError, setHasImageError] = useState(!targetPoster);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const failedUrlsRef = useRef<Set<string>>(new Set());

  // Sincronização síncrona no render: elimina o atraso de 1 frame e evita piscadas na troca de itens dos slots
  if (prevItemId !== item.id) {
    setPrevItemId(item.id);
    failedUrlsRef.current.clear();
    setImgSrc(targetPoster);
    setHasImageError(!targetPoster);
  }

  // Progresso de reprodução real exclusivo para fileira de "Continuar Assistindo" (elimina custo síncrono em todas as outras fileiras)
  const [continuity, setContinuity] = useState<PlaybackContinuityInfo | null>(() => {
    return showProgress ? storageService.getPlaybackContinuity(item) : null;
  });

  useEffect(() => {
    if (!showProgress) return;
    const handleProgress = (e: any) => {
      const cid = e?.detail?.contentId;
      if (!cid || storageService.getCandidateKeys(item).includes(cid)) {
        setContinuity(storageService.getPlaybackContinuity(item));
      }
    };
    window.addEventListener('zapitv_progress_updated', handleProgress);
    return () => window.removeEventListener('zapitv_progress_updated', handleProgress);
  }, [item, showProgress]);

  // Atualiza imagem quando o item muda preservando rigorosamente a URL otimizada sem loops
  useEffect(() => {
    const raw = posterRecoveryService.getCachedPoster(item) || item.image || item.poster || item.backdrop || '';
    const optimized = tvPerformanceProfileService.getOptimizedPosterUrl(raw);
    if (optimized && optimized !== imgSrc) {
      failedUrlsRef.current.clear();
      setImgSrc(optimized);
      setHasImageError(false);
    }
  }, [item.id, item.image, item.poster, item.backdrop]);

  const handleImgError = (e?: React.SyntheticEvent<HTMLImageElement>) => {
    // Se o evento foi disparado por uma imagem que não corresponde ao item atual, descarta
    if (e?.currentTarget && e.currentTarget.getAttribute('data-item-id') !== String(item.id)) {
      return;
    }

    if (imgSrc) {
      failedUrlsRef.current.add(imgSrc);
    }

    // Candidatos em ordem de preferência:
    // 1. URL original do poster
    // 2. Backdrop otimizado
    // 3. Backdrop original
    const rawBackdrop = item.backdrop || '';
    const optBackdrop = tvPerformanceProfileService.getOptimizedPosterUrl(rawBackdrop);

    const candidates = [rawPoster, optBackdrop, rawBackdrop].filter((url): url is string => Boolean(url));
    const nextCandidate = candidates.find(url => url !== imgSrc && !failedUrlsRef.current.has(url));

    if (nextCandidate) {
      setImgSrc(nextCandidate);
    } else {
      setHasImageError(true);
    }
  };

  const focusKey = `${focusKeyPrefix}-${item.id}`;
  const { ref: tvFocusRef, focused: isTvFocusHook } = useTvFocusable({
    focusKey,
    onEnterPress: () => onClick(item),
    onFocus,
    onArrowPress: (direction) => {
      if (direction === 'up' && onUpPress) {
        onUpPress();
        return false;
      }
      return true;
    },
    autoScroll: true,
    scrollInline: 'center',
    scrollBlock: 'nearest',
    focusable: isFocusable
  });

  const isTvFocused = isFocusable ? isTvFocusHook : (isFocused ?? false);

  const setCombinedRef = useCallback((node: HTMLDivElement | null) => {
    (cardContainerRef as any).current = node;
    if (isFocusable) {
      (tvFocusRef as any).current = node;
    }
  }, [isFocusable, tvFocusRef]);

  const isEpisodic = item.type === ContentType.SERIES || item.type === ContentType.ANIME || Boolean(item.seasonsCount && item.seasonsCount > 0);
  const progressPercent = Math.min(100, Math.max(0, continuity?.percentage || 0));
  const hasValidProgress = showProgress && progressPercent > 2 && progressPercent < 95;

  const ambientGlowStyle = useMemo(() => getCardAmbientGlow(item), [item]);

  return (
    <div
      ref={setCombinedRef}
      role="button"
      tabIndex={0}
      data-focus-key={focusKey}
      data-tv-focused={isTvFocused ? "true" : undefined}
      onClick={() => onClick(item)}
      className={`group/tvcard relative w-full flex-none select-none outline-none cursor-pointer transition-all duration-200 ${
        disableScale
          ? 'z-10'
          : isTvFocused
          ? 'scale-105 z-40 transform-gpu' 
          : 'hover:scale-102 z-10 transform-gpu'
      } ${className}`}
    >
      {/* GLOW AMBIENTE DAS CAPAS (Samsung The Frame / Tizen / Media Station X) */}
      {/* Iluminação suave e atmosférica que acompanha as cores originais da capa, posicionada estritamente ATRÁS do card */}
      {isTvFocused && !suppressFocusBorder && (
        <div 
          className="absolute -inset-3 sm:-inset-4 rounded-3xl pointer-events-none transition-all duration-300 transform-gpu opacity-35 scale-100"
          style={{
            background: ambientGlowStyle,
            filter: 'blur(20px)',
            zIndex: 0
          }}
          aria-hidden="true"
        />
      )}

      {/* Caixa Vertical 2:3 Principal (Poster com cores vivas e naturais, sem camada luminosa ou desbotamento sobre a imagem) */}
      <div 
        data-card-poster="true"
        className="relative z-10 w-full aspect-[2/3] rounded-2xl overflow-hidden bg-[#0d121d] transition-all duration-200 border border-white/10 group-hover/tvcard:border-white/25"
        style={{
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          clipPath: 'inset(0 round 1rem)',
          WebkitClipPath: 'inset(0 round 1rem)',
          transform: 'translateZ(0)',
          contain: 'paint'
        }}
      >
        {/* Imagem do Poster Vertical 2:3 (Cores vivas, contraste natural e nitidez original) */}
        {!hasImageError && imgSrc ? (
          <img
            key={`${item.id}`}
            data-item-id={item.id}
            src={imgSrc}
            alt={item.title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={handleImgError}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#131b2c] via-[#0d131f] to-[#070a0f] p-4 text-center">
            <Play className="w-12 h-12 text-cyan-400/40 mb-2" />
            <span className="text-xs font-bold text-gray-300 line-clamp-2 px-2">{item.title}</span>
          </div>
        )}

        {/* Gradiente de Legibilidade Suave e Restrito à Base (Preserva as cores originais, nitidez e luminosidade das capas) */}
        <div className="absolute inset-x-0 bottom-0 h-24 sm:h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* Informações Sobrepostas no Card Vertical */}
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5 flex flex-col justify-end pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-gray-300">
            {item.rating ? (
              <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold bg-black/60 px-1.5 py-0.5 rounded text-[10px] border border-amber-400/30">
                <Star className="w-2.5 h-2.5 fill-amber-400" />
                {item.rating.toFixed(1)}
              </span>
            ) : null}
            {item.year ? <span>{item.year}</span> : null}
            {isEpisodic && (
              <>
                <span>•</span>
                <span className="text-cyan-300 font-medium">
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
          <div 
            className="absolute inset-x-0 bottom-0 h-1.5 bg-black/75 overflow-hidden pointer-events-none rounded-b-2xl"
            style={{
              clipPath: 'inset(0 round 0 0 1rem 1rem)',
              WebkitClipPath: 'inset(0 round 0 0 1rem 1rem)',
            }}
          >
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 rounded-r-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Contorno Externo de Seleção para navegação individual (Respiro de 4px externo à capa, sem invadir os pixels do poster) */}
      {isTvFocused && !suppressFocusBorder && (
        <div 
          className="absolute -inset-[6px] rounded-[22px] border-2 border-cyan-400 pointer-events-none z-20 shadow-[0_0_14px_rgba(0,229,255,0.45)]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.isFocused === next.isFocused &&
    prev.showProgress === next.showProgress &&
    prev.priority === next.priority &&
    prev.isFocusable === next.isFocusable &&
    prev.disableScale === next.disableScale &&
    prev.suppressFocusBorder === next.suppressFocusBorder &&
    prev.className === next.className
  );
});

TvCard16x9.displayName = 'TvCard16x9';
export const TvCardVertical = TvCard16x9;
