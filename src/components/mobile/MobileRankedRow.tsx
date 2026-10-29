import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { Flame, Star, Play } from 'lucide-react';
import { ContentItem } from '../../../types';
import { posterRecoveryService, isCorruptedPosterUrl } from '../../core/catalog/PosterRecoveryService';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface MobileRankedRowProps {
  title: string;
  items: Array<{ item: ContentItem; rank: number } | ContentItem>;
  onItemClick: (item: ContentItem) => void;
  icon?: React.ComponentType<{ className?: string }>;
}

interface RankedPosterCardProps {
  item: ContentItem;
  rank: number;
  onItemClick: (item: ContentItem) => void;
  isDraggingRef: React.MutableRefObject<boolean>;
}

const RankedPosterCard: React.FC<RankedPosterCardProps> = memo(({
  item,
  rank,
  onItemClick,
  isDraggingRef
}) => {
  const getInitialPoster = (targetItem: ContentItem): string => {
    if (!targetItem) return '';
    const cached = posterRecoveryService.getCachedPoster(targetItem);
    if (cached && !isCorruptedPosterUrl(cached)) return cached;
    const direct = targetItem.image || targetItem.poster || targetItem.backdrop || '';
    if (direct && !isCorruptedPosterUrl(direct)) return direct;
    return '';
  };

  const initialPoster = getInitialPoster(item);
  const [prevItemId, setPrevItemId] = useState(item.id);
  const [imgSrc, setImgSrc] = useState<string>(initialPoster);
  const [hasError, setHasError] = useState<boolean>(!initialPoster);

  const isMountedRef = useRef(true);
  const currentItemIdRef = useRef(item.id);
  currentItemIdRef.current = item.id;
  const isRecoveringRef = useRef(false);
  const generationRef = useRef(0);
  const recoveryAttemptsRef = useRef(0);
  const failedUrlsRef = useRef<Set<string>>(new Set());

  if (prevItemId !== item.id) {
    setPrevItemId(item.id);
    generationRef.current++;
    recoveryAttemptsRef.current = 0;
    failedUrlsRef.current.clear();
    isRecoveringRef.current = false;
    const nextPoster = getInitialPoster(item);
    setImgSrc(nextPoster);
    setHasError(!nextPoster);
  }

  const triggerRecovery = useCallback(async () => {
    if (isRecoveringRef.current || !item) return;
    if (recoveryAttemptsRef.current >= 3) {
      setHasError(true);
      return;
    }

    const activeId = item.id;
    const activeGen = generationRef.current;
    recoveryAttemptsRef.current++;
    isRecoveringRef.current = true;

    try {
      const recovered = await posterRecoveryService.recoverPoster(item);
      if (!isMountedRef.current || currentItemIdRef.current !== activeId || generationRef.current !== activeGen) {
        return;
      }
      if (recovered && !isCorruptedPosterUrl(recovered) && !failedUrlsRef.current.has(recovered)) {
        setImgSrc(recovered);
        setHasError(false);
      } else {
        setHasError(true);
      }
    } catch {
      if (isMountedRef.current && currentItemIdRef.current === activeId && generationRef.current === activeGen) {
        setHasError(true);
      }
    } finally {
      isRecoveringRef.current = false;
    }
  }, [item]);

  useEffect(() => {
    isMountedRef.current = true;
    if (hasError && !isRecoveringRef.current && recoveryAttemptsRef.current === 0) {
      triggerRecovery();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [hasError, item.id, triggerRecovery]);

  useEffect(() => {
    const unsubscribe = posterRecoveryService.subscribe((recoveredItemId, newUrl) => {
      if (!isMountedRef.current || currentItemIdRef.current !== item.id) return;
      const isMatch = recoveredItemId === item.id || (item.imdbId && recoveredItemId === item.imdbId);
      if (isMatch && newUrl && !isCorruptedPosterUrl(newUrl) && !failedUrlsRef.current.has(newUrl)) {
        setImgSrc(newUrl);
        setHasError(false);
      }
    });
    return unsubscribe;
  }, [item.id, item.imdbId]);

  const handleImgError = (e?: React.SyntheticEvent<HTMLImageElement>) => {
    if (e?.currentTarget && e.currentTarget.getAttribute('data-item-id') !== String(item.id)) {
      return;
    }

    if (imgSrc) {
      failedUrlsRef.current.add(imgSrc);
      posterRecoveryService.reportImageFailure(item, imgSrc);
    }

    const cached = posterRecoveryService.getCachedPoster(item);
    const candidates = [
      cached || '',
      item.poster || '',
      item.backdrop || '',
      ...(Array.isArray(item.images) ? item.images : []),
      ...(Array.isArray(item.backdrops) ? item.backdrops : [])
    ].filter((url): url is string => Boolean(url && typeof url === 'string' && url.startsWith('http') && !isCorruptedPosterUrl(url)));

    const nextCandidate = candidates.find(url => url !== imgSrc && !failedUrlsRef.current.has(url));
    if (nextCandidate) {
      setImgSrc(nextCandidate);
      setHasError(false);
    } else {
      setHasError(true);
      triggerRecovery();
    }
  };

  const isTwoDigits = rank >= 10;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isDraggingRef.current) return;
        uiSoundService.play('click');
        onItemClick(item);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          uiSoundService.play('click');
          onItemClick(item);
        }
      }}
      aria-label={`Posição ${rank}: ${item.title}`}
      className="relative flex items-end shrink-0 cursor-pointer active:opacity-90 transition-opacity group focus:outline-none"
      style={{ width: isTwoDigits ? '160px' : '150px' }}
    >
      {/* Número Gigante Estilizado Monumental Atrás da Capa - Sólido Branco */}
      <div
        className="select-none pointer-events-none font-black italic absolute left-0 bottom-[-8px] z-0 leading-none"
        style={{
          fontFamily: "'Sora', 'Impact', sans-serif",
          fontSize: isTwoDigits ? '92px' : '106px',
          color: '#ffffff',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.85))'
        }}
      >
        {rank}
      </div>

      {/* Capa do Conteúdo Sobreposta */}
      <div
        className="relative z-10 w-[114px] xs:w-[124px] aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-white/10 shadow-xl ml-auto"
      >
        {!hasError && imgSrc ? (
          <img
            key={`ranked-${item.id}-${imgSrc}`}
            data-item-id={item.id}
            src={imgSrc}
            alt={item.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={handleImgError}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#090d16] to-[#030712] p-2 text-center">
            <div className="w-8 h-8 rounded-full bg-[#007df7]/15 border border-[#007df7]/30 flex items-center justify-center mb-1.5 shadow-inner">
              <Play className="w-3.5 h-3.5 text-[#007df7] fill-[#007df7] ml-0.5" />
            </div>
            <span className="text-[10px] font-bold text-slate-200 line-clamp-2 px-1 leading-tight tracking-tight">
              {item.title}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />

        {item.rating > 0 && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-white/10 pointer-events-none">
            <Star className="w-2.5 h-2.5 fill-amber-400" />
            <span>{item.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
});

RankedPosterCard.displayName = 'RankedPosterCard';

export const MobileRankedRow: React.FC<MobileRankedRowProps> = ({
  title,
  items,
  onItemClick,
  icon: Icon = Flame
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  if (!items || items.length === 0) return null;

  // Normaliza lista para { item, rank }
  const normalized = items.slice(0, 10).map((entry, idx) => {
    if ('rank' in entry && 'item' in entry) {
      return entry as { item: ContentItem; rank: number };
    }
    return { item: entry as ContentItem, rank: idx + 1 };
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current !== null && touchStartY.current !== null) {
      const diffX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const diffY = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (diffX > 6 || diffY > 6) {
        isDraggingRef.current = true;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current !== null) {
      const diff = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
      if (diff > 50) {
        uiSoundService.play('slide');
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <section className="my-5 select-none" aria-label={title}>
      <div className="px-4 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-[#007df7]" />
          <h3
            className="text-base sm:text-lg font-black text-white tracking-tight"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {title}
          </h3>
        </div>
      </div>

      <div
        ref={rowRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex gap-4 overflow-x-auto overflow-y-hidden no-scrollbar px-4 pt-2 pb-6"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'auto',
          overflowAnchor: 'none'
        }}
      >
        {normalized.map(({ item, rank }) => (
          <RankedPosterCard
            key={`ranked-${item.id}-${rank}`}
            item={item}
            rank={rank}
            onItemClick={onItemClick}
            isDraggingRef={isDraggingRef}
          />
        ))}
      </div>
    </section>
  );
};
