import React, { useRef } from 'react';
import { Flame, Star } from 'lucide-react';
import { ContentItem } from '../../../types';
import { posterRecoveryService } from '../../core/catalog/PosterRecoveryService';
import { uiSoundService } from '../../core/audio/uiSoundService';

interface MobileRankedRowProps {
  title: string;
  items: Array<{ item: ContentItem; rank: number } | ContentItem>;
  onItemClick: (item: ContentItem) => void;
  icon?: React.ComponentType<{ className?: string }>;
}

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
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 60);
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
        className="flex gap-4 overflow-x-auto overflow-y-hidden no-scrollbar px-4 pt-2 pb-6 scroll-smooth will-change-scroll"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'none',
          overflowAnchor: 'none'
        }}
      >
        {normalized.map(({ item, rank }) => {
          const imgSrc = posterRecoveryService.getCachedPoster(item) || item.image || item.backdrop;
          const isTwoDigits = rank >= 10;

          return (
            <div
              key={`ranked-${item.id}-${rank}`}
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
                <img
                  src={imgSrc}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=300';
                  }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                {item.rating > 0 && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 backdrop-blur-md text-amber-400 flex items-center gap-0.5 border border-white/10">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    <span>{item.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
